// Lightweight, PaMarket-owned error/crash log — feeds the admin Errors
// center (app_error_events, see
// supabase/migrations/20260912120000_app_error_events.sql). This is NOT a
// second monitoring platform: Sentry (lib/sentry.ts) stays the deep
// diagnostic tool (source maps, breadcrumbs, session context); this module
// only ever calls the existing log_client_error() RPC to add a row admins
// can see directly in the admin panel without a Sentry API token anywhere
// near client code.
//
// Every call here is fire-and-forget from the caller's point of view: it
// never throws, never awaits-and-blocks a user action, and a failure to
// log is always swallowed silently. Logging must never be the reason a
// real user action (login, posting, messaging, checkout, an order action)
// fails or feels slower.
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { Sentry } from "./sentry";

export type ErrorSeverity = "fatal" | "error" | "warning";

type LogErrorInput = {
  error: unknown;
  screen?: string;
  component?: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
};

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 8000;

// Best-effort client-side redaction — defense in depth alongside (not a
// replacement for) the server-side redact_error_text() the RPC always
// applies regardless of what reaches it. Kept intentionally simple and
// synchronous so it can never itself become a source of a slow/failed log
// call.
const REDACT_PATTERNS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[redacted-jwt]"],
  [/(bearer|apikey|api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|password|secret)\s*[:=]?\s*\S+/gi, "$1 [redacted]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]"],
  [/(\+?263|0)7[0-9]{8}/g, "[redacted-phone]"],
];

function redact(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  let result = text;
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function safeErrorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  if (typeof error === "string") return "StringError";
  return "UnknownError";
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error).slice(0, MESSAGE_LIMIT);
  } catch {
    return "Non-serializable error";
  }
}

function safeStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack ?? undefined;
  return undefined;
}

// process.env.EXPO_PUBLIC_* is inlined at build time — no dynamic
// require/import.meta needed, consistent with how the rest of this app
// reads its build-time config (see lib/supabase.ts).
const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? undefined;
const BUILD_NUMBER =
  Platform.OS === "ios"
    ? (Constants.expoConfig?.ios?.buildNumber as string | undefined)
    : (Constants.expoConfig?.android?.versionCode as number | undefined)?.toString();

// Fire-and-forget by design — callers never `await` this in a way that
// blocks their own error handling. Always resolves, never rejects.
export function logClientError(input: LogErrorInput): void {
  try {
    const { error, screen, component, severity = "error", metadata } = input;
    // Sentry stays the primary, always-on crash reporter — unaffected by
    // whether the DB log below succeeds. `level` was previously omitted,
    // so every call landed in Sentry at its default "error" level
    // regardless of the caller's own severity — an expected, benign
    // outcome like a wrong password (severity: "warning") looked
    // identical to a real bug in Sentry's issue stream. Passing the
    // caller's severity through as the Sentry level fixes that
    // classification without dropping the event — it's still visible,
    // just correctly leveled, so genuine failures are never hidden.
    try {
      Sentry.captureException(error, {
        level: severity,
        tags: { screen: screen ?? "unknown" },
        extra: { component, ...metadata },
      });
    } catch {
      // Sentry itself failing must never block the DB log attempt below.
    }

    const errorType = safeErrorType(error);
    const message = redact(safeErrorMessage(error))?.slice(0, MESSAGE_LIMIT) ?? "Unknown error";
    const stack = redact(safeStack(error))?.slice(0, STACK_LIMIT);
    const metadataJson = metadata ? JSON.parse(JSON.stringify(metadata)) : {};

    supabase
      .rpc("log_client_error", {
        p_source: "mobile",
        p_error_type: errorType,
        p_message: message,
        p_stack: stack ?? null,
        p_screen: screen ?? null,
        p_component: component ?? null,
        p_app_version: APP_VERSION ?? null,
        p_build_number: BUILD_NUMBER ?? null,
        p_platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null,
        p_os_version: Platform.Version != null ? String(Platform.Version) : null,
        p_device_model: null,
        p_environment: __DEV__ ? "development" : "production",
        p_severity: severity,
        p_metadata: metadataJson,
      })
      .then(
        () => {},
        (e) => {
          // Logging failures are logged to the console only — never
          // surfaced to the user, never retried in a way that could loop.
          if (__DEV__) console.warn("[error-log] failed to record:", e);
        }
      );
  } catch (e) {
    if (__DEV__) console.warn("[error-log] unexpected failure:", e);
  }
}

let installed = false;

// Called once from app/_layout.tsx. Hermes (React Native's default JS
// engine) exposes the standard `unhandledrejection` global event since RN
// 0.63 — wrapped in feature detection + try/catch since this runs at
// startup and must never be the reason the app fails to boot. Sentry's own
// default RN integrations already capture unhandled rejections for Sentry
// itself; this only adds the matching app_error_events row.
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  try {
    const g = global as unknown as { addEventListener?: (type: string, listener: (event: unknown) => void) => void };
    if (typeof g.addEventListener === "function") {
      g.addEventListener("unhandledrejection", (event: unknown) => {
        const reason = (event as { reason?: unknown })?.reason ?? event;
        logClientError({ error: reason, screen: "global", component: "unhandledrejection", severity: "error" });
      });
    }
  } catch (e) {
    if (__DEV__) console.warn("[error-log] could not install unhandledrejection listener:", e);
  }
}
