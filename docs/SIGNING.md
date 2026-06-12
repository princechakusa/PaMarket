# Release signing & secret management

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
