import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const STUBS = {
  "react-native": "data:text/javascript,export const Platform = { OS: 'android', select: (o) => o.android ?? o.default };",
};

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const base = new URL(specifier, context.parentURL);
    const path = fileURLToPath(base);
    if (!/\.[cm]?[jt]sx?$|\.json$/.test(path)) {
      for (const ext of [".ts", "/index.ts"]) {
        if (existsSync(path + ext)) return { url: pathToFileURL(path + ext).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
