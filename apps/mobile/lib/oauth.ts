import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URL = Linking.createURL("login-callback");
const NONCE_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";

function createNonce(length = 32) {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (byte) => NONCE_CHARSET[byte % NONCE_CHARSET.length]).join("");
}

function isAppleRequestCancelled(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
  );
}

function parseCallbackParams(url: string) {
  // Supabase can return either a PKCE `?code=` in the query string or an
  // implicit-flow `#access_token=&refresh_token=` in the URL fragment,
  // depending on project auth settings — handle both.
  const [withoutHash, hash] = url.split("#");
  const queryParams = new URL(withoutHash).searchParams;
  const hashParams = new URLSearchParams(hash || "");

  return {
    errorDescription:
      queryParams.get("error_description") ||
      queryParams.get("error") ||
      hashParams.get("error_description") ||
      hashParams.get("error"),
    code: queryParams.get("code"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
  };
}

export async function signInWithOAuthProvider(provider: "google" | "apple") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: REDIRECT_URL,
      skipBrowserRedirect: true,
      ...(provider === "google"
        ? { queryParams: { prompt: "select_account", access_type: "offline" } }
        : {}),
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("Could not start sign-in");

  // Android's Chrome Custom Tab is closed by the OS the instant the
  // com.pamarket.app://login-callback intent is delivered to MainActivity —
  // which races openAuthSessionAsync's own "success" detection and can make
  // it report the tab as dismissed/cancelled even though the redirect landed.
  // So we resolve from whichever fires first: the real incoming deep link,
  // or openAuthSessionAsync's own result.
  const callbackUrl = await new Promise<string | null>((resolve) => {
    let settled = false;
    const settle = (url: string | null) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      resolve(url);
    };

    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url.startsWith(REDIRECT_URL)) settle(event.url);
    });

    WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL).then((result) => {
      if (result.type === "success" && result.url) settle(result.url);
      else settle(null);
    });
  });

  if (!callbackUrl) return null;

  const { errorDescription, code, accessToken, refreshToken } = parseCallbackParams(callbackUrl);
  if (errorDescription) throw new Error(errorDescription);

  if (accessToken && refreshToken) {
    const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setSessionError) throw setSessionError;
    return sessionData.session;
  }

  if (code) {
    const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return exchanged.session;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) return sessionData.session;

  throw new Error("Sign-in did not complete. Please try again.");
}

export async function signInWithApple() {
  const isAvailable = await AppleAuthentication.isAvailableAsync();

  if (!isAvailable) {
    return signInWithOAuthProvider("apple");
  }

  const rawNonce = createNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error("Apple sign-in did not return an identity token. Please try again.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;
    return data.session;
  } catch (error) {
    if (isAppleRequestCancelled(error)) return null;
    throw error;
  }
}
