#!/usr/bin/env node
// Targets react-native-worklets 0.10.3 exactly (declared in package.json as a
// transitive dependency of react-native-reanimated, so it can drift on any
// dependency bump). Run any time after `npm install` — it patches the
// installed node_modules copy directly, so it must be re-run after every
// fresh install (npm does not preserve node_modules edits).
//
// Root cause: on Windows, CMake/Ninja invokes this module's C++ link step as
// one very long `cmd.exe /C "..."` command containing several mid-token
// quoted paths (e.g. `--sysroot="C:/Users/Dev Prince/..."`). That combination
// reproducibly drops the implicit libc++ runtime link on this toolchain
// (NDK 27.1.12297006 / CMake 3.22.1) even though the object files, compiler,
// and every other argument are correct — confirmed by manually relinking the
// exact same .o files outside cmd.exe, which succeeds every time. Forcing
// CMake to write the link command to a response file (`@file.rsp`) instead of
// a raw cmd.exe string avoids the entire quoting path and is CMake's own
// documented mechanism for exactly this class of Windows command-line issue.
// It changes nothing about which flags are passed or how the binary links —
// only how the same argument list reaches the linker process.
const fs = require("fs");
const path = require("path");

const EXPECTED_VERSION = "0.10.3";
const gradlePath = path.join(
  __dirname, "..", "node_modules", "react-native-worklets", "android", "build.gradle.kts"
);
const packageJsonPath = path.join(
  __dirname, "..", "node_modules", "react-native-worklets", "package.json"
);

if (!fs.existsSync(packageJsonPath)) {
  console.error(`[patch-worklets-cmake] not found: ${packageJsonPath} — is react-native-worklets installed?`);
  process.exit(1);
}
const installedVersion = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
if (installedVersion !== EXPECTED_VERSION) {
  console.error(
    `[patch-worklets-cmake] react-native-worklets is ${installedVersion}, this patch targets ${EXPECTED_VERSION} exactly. ` +
    `Refusing to apply blindly to a different version — re-verify the CMake block and update EXPECTED_VERSION.`
  );
  process.exit(1);
}

if (!fs.existsSync(gradlePath)) {
  console.error(`[patch-worklets-cmake] not found: ${gradlePath} — package layout may have changed.`);
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, "utf8");

if (gradle.includes("CMAKE_NINJA_FORCE_RESPONSE_FILE")) {
  console.log("[patch-worklets-cmake] already applied, skipping.");
  process.exit(0);
}

const before = `                arguments(
                    "-DANDROID_STL=c++_shared",`;

const after = `                arguments(
                    // Windows-only fix: force CMake/Ninja to pass this link
                    // step's arguments via a response file instead of a raw
                    // cmd.exe command line. See patch-worklets-cmake.cjs for
                    // why this is needed — it does not change any compiler
                    // or linker flag, only how the same flags are delivered.
                    "-DCMAKE_NINJA_FORCE_RESPONSE_FILE=ON",
                    "-DANDROID_STL=c++_shared",`;

if (!gradle.includes(before)) {
  console.error(
    "[patch-worklets-cmake] expected `arguments(` block not found — " +
    "react-native-worklets 0.10.3's build.gradle.kts shape may have changed. Not patching blindly."
  );
  process.exit(1);
}
gradle = gradle.replace(before, after);

fs.writeFileSync(gradlePath, gradle);
console.log("[patch-worklets-cmake] added -DCMAKE_NINJA_FORCE_RESPONSE_FILE=ON to react-native-worklets' CMake arguments.");
