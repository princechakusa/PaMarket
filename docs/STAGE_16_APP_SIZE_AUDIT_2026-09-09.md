# Stage 16: Android and iOS App Size Audit

Audit date: 2026-09-09

## Scope and measurement rules

- The active mobile application is the Expo/React Native project in `apps/mobile`.
- No Android AAB or iOS production build was created.
- Google Play download size was calculated from the existing AAB with bundletool 1.18.1. It is not compared with the raw AAB size.
- No Android phone or iPhone was connected. Real installed size and device launch/feature checks remain unmeasured.
- The available iOS IPA is EAS production build `ba47bbef-5f74-4260-abac-1f9abdd6147e`, build number 26, commit `51091e03d230f2815a61c6924378d23a9130c3fb`. It predates the current working tree, so it is an archive baseline rather than an exact current-source build.

## Android results

| Measurement | Before | After | Status |
| --- | ---: | ---: | --- |
| Existing AAB archive | 65,819,040 bytes (62.77 MiB) | Not produced | Exact baseline; production build prohibited |
| Google Play split download | 19,545,006–21,433,213 bytes (18.64–20.44 MiB) | About 388,743 bytes lower | Before is bundletool exact; after is the measured compressed-resource delta |
| Category image payload | 1,317,271 compressed bytes | 928,528 compressed bytes | Measured with equivalent ZIP deflate |
| Installed size on a real phone | Not measurable | Not measurable | No device connected |
| Hermes bytecode | 6,263,780 bytes in pre-change export | 6,271,844 bytes in post-change export | Other working-tree edits occurred during the audit, so the 8,064-byte difference is not attributed to the image change |

The AAB includes 20,039,745 compressed bytes of upload metadata, including the R8 mapping and native debug symbols. This material explains much of the apparent AAB size and is not part of the Play-delivered split download. It is retained for Play and Sentry symbolication.

### Android native libraries by ABI

| ABI | Compressed in AAB | Uncompressed | Libraries |
| --- | ---: | ---: | ---: |
| armeabi-v7a | 6,876,827 | 16,600,808 | 28 |
| arm64-v8a | 7,884,633 | 24,001,048 | 28 |
| x86 | 8,642,276 | 25,380,460 | 28 |
| x86_64 | 8,470,517 | 25,556,464 | 28 |

Play splits these ABIs. Bundletool's download ranges by ABI are:

| ABI | Download range |
| --- | ---: |
| armeabi-v7a | 19,545,006–19,661,482 bytes |
| arm64-v8a | 20,556,419–20,672,895 bytes |
| x86 | 21,316,737–21,433,213 bytes |
| x86_64 | 21,143,728–21,260,204 bytes |

Largest native families across all four ABIs are React Native (9,248,141 compressed bytes), Hermes (4,309,072), AVIF decoding (2,070,533), Reanimated (1,984,115), libc++ (1,609,010), Expo Modules Core (1,432,271), Worklets (1,108,698), and Sentry (1,019,963 including both Sentry libraries).

R8 minification and Android resource shrinking are already enabled. Hermes and the New Architecture are enabled. All four supported ABIs remain enabled. Release native libraries are stripped in the user package; separate native symbols are retained as upload metadata.

The Android export also includes a 963 KB Material Symbols font through Expo Router/Expo Symbols. Application code does not directly import it, but removing or shimming a transitive Router dependency was not considered proven-safe.

## iOS results

| Measurement | Before | After | Status |
| --- | ---: | ---: | --- |
| Existing EAS IPA archive | 27,464,758 bytes (26.19 MiB) | Not produced | Exact build-26 baseline; production build prohibited |
| Uncompressed `.app` payload | 52,269,676 bytes (49.85 MiB) | Not measurable exactly | Archive-derived estimate, not real installed size |
| App Store download | Not measurable | Not measurable | Requires App Store Connect's processed size report |
| Installed size on a real iPhone | Not measurable | Not measurable | No iPhone connected and no Apple tooling available |
| Category image payload | 1,347,203 compressed bytes | 928,528 compressed bytes | Measured with equivalent ZIP deflate |
| Current Hermes bytecode export | 5,996,912 bytes | 5,996,992 bytes | 80-byte path-string change; function payload is materially unchanged |

The IPA contains 10,296,066 compressed bytes of `Symbols/` data. This is upload/archive support data rather than the installed `.app` payload and should be retained for crash symbolication.

Largest executable contributors in the available IPA are the PaMarket executable (12,527,040 uncompressed bytes), React.framework (12,129,662), Hermes (5,122,657), libavif (4,024,058), ExpoModulesCore (3,802,137), the Hermes JavaScript bundle (5,878,632), and ExpoModulesJSI (1,435,179). Static framework linkage is configured because React Native Firebase requires it in this project.

No local Xcode, CocoaPods, archive, or iOS device was available, so current-source framework stripping and launch behavior could not be revalidated locally.

## Shared audit findings

- The release Hermes bundle is about 6.27 MB on Android and 6.00 MB on iOS. Source maps are 15.04 MB and 14.54 MB respectively and are emitted separately, not shipped as runtime assets.
- All direct mobile dependencies have a source, config-plugin, peer, or native-autolink reason to remain. No dependency removal was proven safe.
- Firebase Messaging, Expo Notifications, Sentry, Expo IAP, Supabase/authentication, Reanimated, Worklets, image manipulation, and secure storage are present and retained.
- The lockfile contains multiple versions of some build-time/transitive packages. No duplicate user-delivered native library was found, and blind dependency upgrades or overrides were not applied.
- Exact duplicate source assets exist for intentional icon/splash variants. Removing them has either zero measured runtime benefit or risks platform branding, so they remain.
- Unreferenced brand source files are not included in Metro's mobile export. Deleting them would save repository space but zero measured app payload, so they remain.
- AVIF, GIF, WebP, and HEIC-related image paths were left intact. Removing codecs could save native space but would violate the image-compatibility requirement without production-content proof.

## Implemented optimization

The 12 mobile category illustrations were converted from PNG to lossless WebP and the two static require maps were updated. Every decoded 512×512 RGBA pixel buffer has the same SHA-256 hash before and after conversion.

| Layer | Before | After | Saved |
| --- | ---: | ---: | ---: |
| Repository/export assets | 1,368,430 | 928,464 | 439,966 bytes (32.15%) |
| Android compressed-resource estimate | 1,317,271 | 928,528 | 388,743 bytes |
| iOS IPA compressed-resource estimate | 1,347,203 | 928,528 | 418,675 bytes |

Platform impact is limited to decoding lossless WebP for these bundled category thumbnails. Android WebP support is enabled in Gradle, iOS 16.4+ supports WebP, and both platform exports resolved all 12 replacements. Listing images, uploads, HEIC conversion, and remote image viewing are unchanged.

## Features preserved and validation

- `npx tsc --noEmit`: passed.
- Android Hermes export with asset map and source map: passed before and after.
- iOS Hermes export with asset map and source map: passed before and after.
- Pixel equality for all 12 converted category assets: passed.
- Static search for removed mobile PNG references: passed.
- Git whitespace/error check: passed.
- Expo Doctor: 20/21 checks passed. It reports 14 patch-version mismatches within SDK 57; packages were not upgraded because blind upgrades are out of scope.
- Static inspection confirms the authentication, cart, orders, image, notification, category/location, and Sentry paths remain present. This is not a substitute for device behavior tests.
- Capacitor files remain unchanged after the user's scope correction.

Android/iOS launch, login/logout, cart/order, image loading, notifications, category/location, and Sentry event delivery require connected devices and appropriate test accounts. They were not run and must not be reported as passed.

## Release implications and remaining work

Shipping this optimization requires new store binaries, so both stores require unique build identifiers. The working tree currently sets Android `versionCode` 128; it is usable only if Play Console has not already consumed it. EAS iOS build number 26 already exists, so the next iOS production archive must use 27 or higher.

Before release builds:

1. Finish or isolate the unrelated working-tree changes.
2. Run the required Android and iOS real-device feature matrix.
3. Confirm Android installed size through device storage or `adb shell dumpsys package`/filesystem measurements after installing the Play-equivalent split set.
4. Build new store artifacts only when authorized, then repeat bundletool/AAB analysis and Xcode/App Store size reporting for exact after figures.
5. Check App Store Connect's processed download and installed-size estimates after upload.
6. Review the Expo Doctor patch mismatches individually; do not combine dependency upgrades with this size-only change without regression testing.
