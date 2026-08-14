# Release signing & secret management

This document covers two independent signing setups:
- **Android** (Capacitor app, repo root) — keystore-based, described below.
- **iOS** (Expo/RN app, `apps/mobile/`) — see [iOS CI signing](#ios-ci-signing-apps-mobile) near the bottom. Normal iOS builds go through EAS Build, which manages its own Apple credentials separately; the GitHub Actions path below is a fallback for when EAS's Free-tier build quota is exhausted.

The app-signing keystore and its passwords are **secrets**. They must never be
committed to git. This document describes how signing is wired up so that:

- **Local builds** read credentials from a gitignored file.
- **CI builds** (GitHub Actions) read credentials from encrypted repository secrets.
- If **no** credentials are present, the release still builds — just unsigned.

Anything secret (`*.keystore`, `*.jks`, `keystore.properties`, `*.aab`, `*.apk`)
is listed in `.gitignore`. Keep it that way.

---

## Files involved

| File | Committed? | Purpose |
|------|-----------|---------|
| `pamarket.keystore` | **No** (gitignored) | The signing key. Back it up securely (see below). |
| `android/keystore.properties` | **No** (gitignored) | Local dev credentials. |
| `android/keystore.properties.example` | Yes | Template to copy. No real secrets. |
| `android/app/build.gradle` | Yes | Resolves credentials: env vars → properties file → unsigned. |
| `.github/workflows/release-aab.yml` | Yes | CI build using GitHub secrets. |

The Gradle config resolves each credential in this order:
1. Environment variable (CI)
2. `android/keystore.properties` (local)
3. Not found → unsigned release

---

## Local development setup

1. Put your keystore somewhere outside the repo, or at the repo root (it's gitignored).
2. Copy the template and fill it in:
   ```bash
   cp android/keystore.properties.example android/keystore.properties
   # edit android/keystore.properties with the real path + passwords
   ```
3. Build:
   ```bash
   npx cap sync android
   cd android && ./gradlew :app:bundleRelease
   ```
   The signed AAB lands at `android/app/build/outputs/bundle/release/app-release.aab`.

> `android/keystore.properties` is gitignored — never commit it.

---

## CI setup (GitHub Actions) — one time

### 1. Encode the keystore as base64

Run this **locally** (do not paste the output anywhere public):

```bash
base64 -w0 pamarket.keystore > pamarket.keystore.b64   # Linux
# macOS: base64 -i pamarket.keystore -o pamarket.keystore.b64
```

### 2. Add repository secrets

GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**.
Create these four:

| Secret name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | contents of `pamarket.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore (store) password |
| `ANDROID_KEY_ALIAS` | the key alias (e.g. `pamarket`) |
| `ANDROID_KEY_PASSWORD` | the key password |

Then delete the local `pamarket.keystore.b64` file:
```bash
rm pamarket.keystore.b64
```

### 3. Run the build

- **Manually:** Actions tab → *Build Signed Release AAB* → *Run workflow*.
- **Automatically:** push a tag, e.g.
  ```bash
  git tag v1.0.9 && git push origin v1.0.9
  ```

The signed AAB is uploaded as the `pamarket-release-aab` workflow artifact,
ready to upload to the Play Console. The decoded keystore is removed from the
runner after the build, and runners are ephemeral.

---

## Keystore backup & recovery

- **Back up `pamarket.keystore` and its passwords** in a password manager / secure
  vault. If you lose the *app signing key* and are **not** on Play App Signing,
  you can never publish updates to this app again.
- If the keystore is ever exposed (committed, shared, leaked):
  - If it is your **upload key** and the app uses **Play App Signing**, request an
    upload-key reset: Play Console → *Setup → App integrity → Upload key certificate
    → Request upload key reset*.
  - If it is the **app signing key** and you are not on Play App Signing, the
    exposure is permanent — treat it as compromised.

## Rotating the secrets

If a password changes or you reset the upload key:
1. Update `android/keystore.properties` locally.
2. Re-encode the keystore (step 1 above) and update the four GitHub secrets.
No code changes are needed.

---

## iOS CI signing (`apps/mobile`)

`.github/workflows/ios-release.yml` builds and uploads the iOS app to
TestFlight on a GitHub-hosted macOS runner, as a fallback when EAS Build's
free-tier iOS quota is exhausted. It uses a **separate Distribution
Certificate** from the one EAS manages internally — EAS does not allow
exporting its stored certificate's private key (by design), so a second,
independent certificate was generated specifically for this workflow. Apple
fully supports multiple active distribution certificates on one account;
this is not a conflict.

### Required repository secrets

| Secret | Source |
|---|---|
| `IOS_DIST_CERTIFICATE_BASE64` | base64 of the `.p12` (cert + private key) — see below |
| `IOS_DIST_CERTIFICATE_PASSWORD` | the password set when the `.p12` was created |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 of the `.mobileprovision` file |
| `ASC_API_KEY_BASE64` | base64 of the App Store Connect API `.p8` key |
| `ASC_API_KEY_ID` | Key ID (embedded in the `.p8` filename, e.g. `AuthKey_XXXXXXXXXX.p8`) |
| `ASC_API_ISSUER_ID` | Issuer ID — same for every key on the Apple Developer account |
| `EXPO_PUBLIC_SUPABASE_URL` | same value as `apps/mobile/.env` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same value as `apps/mobile/.env` |
| `EXPO_PUBLIC_SENTRY_DSN` | optional, same value as `apps/mobile/.env` |
| `SENTRY_AUTH_TOKEN` | optional, only needed to upload de-minified source maps |

### One-time credential generation (already done once — repeat only if rotating)

1. **Certificate**: generate a CSR + private key locally (`openssl genrsa` /
   `openssl req -new`), upload the CSR at
   developer.apple.com → Certificates → "+" → **Apple Distribution**,
   download the resulting `.cer`, then combine it with the private key into
   a password-protected `.p12`:
   ```bash
   openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
   openssl pkcs12 -export -inkey <private-key>.key -in distribution.pem \
     -out dist_certificate.p12 -name "PaMarket CI Distribution"
   base64 -w0 dist_certificate.p12   # → IOS_DIST_CERTIFICATE_BASE64
   ```
2. **Provisioning profile**: developer.apple.com → Profiles → "+" →
   **App Store Connect** (under Distribution) → select the `com.pamarket.app`
   App ID and the certificate from step 1 → name it (e.g.
   "PaMarket CI Distribution") → Generate → Download.
   ```bash
   base64 -w0 PaMarket_CI_Distribution.mobileprovision   # → IOS_PROVISIONING_PROFILE_BASE64
   ```
3. **App Store Connect API key**: appstoreconnect.apple.com → Users and
   Access → Integrations → Keys → generate a new key with the **App
   Manager** role (App Manager is sufficient for TestFlight uploads; no need
   for Admin). Download the `.p8` immediately — Apple only allows this once.
   ```bash
   base64 -w0 AuthKey_<KEY_ID>.p8   # → ASC_API_KEY_BASE64
   ```
   The `<KEY_ID>` in the filename is `ASC_API_KEY_ID`; the Issuer ID shown
   on the same Keys page (same for all keys on the account) is
   `ASC_API_ISSUER_ID`.

Delete every local copy of the `.p12`, `.mobileprovision`, `.p8`, and any
`.txt` files holding their base64 encodings or passwords once the GitHub
secrets are set — nothing from this process should be kept on disk
afterward.

### Running the workflow

Actions tab → **Build & Upload iOS Release (TestFlight)** → **Run workflow**
→ enter a build number strictly higher than any build previously uploaded
to App Store Connect for the current app version (check
App Store Connect → the app → TestFlight, or `apps/mobile/app.config.ts`'s
existing `buildNumber` comment, for the last-known value — this workflow
does not query Apple to auto-detect it).

### Certificate/profile expiration

Both the Distribution Certificate and Provisioning Profile generated for
this workflow expire **26 Jul 2027**. Before then, generate a new
certificate + profile pair (steps 1–2 above) and update the corresponding
secrets — no code changes needed.
