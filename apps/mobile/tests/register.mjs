// Lets `node --test` run the app's pure TypeScript modules directly:
//  - Node 24 strips TS types natively, but ESM needs explicit extensions,
//    so extensionless relative imports ("./constants") resolve to ".ts".
//  - "react-native" is swapped for a tiny stub (only Platform is needed by
//    the modules under test).
//  - Metro-style require("./x.json") in lib/ modules gets a real require
//    rooted at lib/ (the only place that pattern is used by tested code).
import { register, createRequire } from "node:module";

register("./loader-hooks.mjs", import.meta.url);
globalThis.require = createRequire(new URL("../lib/", import.meta.url));
