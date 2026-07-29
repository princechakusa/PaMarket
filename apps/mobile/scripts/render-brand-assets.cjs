const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const brandDir = path.join(assets, "brand");

const BLACK = "#030303";
const GOLD = "#D6A12A";
const GOLD_LIGHT = "#FFE078";
const GOLD_DARK = "#8F6415";
const WHITE = "#FFFFFF";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function defs() {
  return `
  <defs>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset=".62" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_DARK}"/>
    </linearGradient>
  </defs>`;
}

function symbolPaths(mode = "brand") {
  const gold = mode === "monochrome" ? WHITE : "url(#goldGrad)";
  const white = WHITE;
  return `
    <text x="186" y="338" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="252" font-weight="700" fill="${gold}">P</text>
    <text x="324" y="338" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="220" font-weight="700" fill="${white}">M</text>`;
}

function compactSymbolPaths(mode = "brand") {
  return symbolPaths(mode);
}

function symbolSvg({ mode = "brand", background = "transparent", pad = 70, rounded = false } = {}) {
  const bg =
    background === "white"
      ? `<rect width="512" height="512"${rounded ? ' rx="116"' : ""} fill="${WHITE}"/>`
      : background === "black"
        ? `<rect width="512" height="512"${rounded ? ' rx="116"' : ""} fill="${BLACK}"/>`
        : "";
  const scale = (512 - pad * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${defs()}
  ${bg}
  <g transform="translate(${pad} ${pad}) scale(${scale})">${symbolPaths(mode)}</g>
</svg>`;
}

function compactSymbolSvg({ mode = "brand", background = "transparent", pad = 46, rounded = false } = {}) {
  const bg =
    background === "white"
      ? `<rect width="512" height="512"${rounded ? ' rx="116"' : ""} fill="${WHITE}"/>`
      : background === "black"
        ? `<rect width="512" height="512"${rounded ? ' rx="116"' : ""} fill="${BLACK}"/>`
        : "";
  const scale = (512 - pad * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${defs()}
  ${bg}
  <g transform="translate(${pad} ${pad}) scale(${scale})">${compactSymbolPaths(mode)}</g>
</svg>`;
}

function wordmarkSvg({ mode = "light", width = 1280, height = 400 } = {}) {
  const onBrand = mode === "dark";
  const bg = "";
  const symbolMode = "brand";
  const wordColor = onBrand ? WHITE : BLACK;
  const paColor = "url(#goldGrad)";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs()}
${bg ? `  ${bg}\n` : ""}
  <g transform="translate(166 72) scale(.48)">${symbolPaths(symbolMode)}</g>
  <text x="432" y="237" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="116" font-weight="900" letter-spacing="-5">
    <tspan fill="${paColor}">Pa</tspan><tspan fill="${wordColor}">Market</tspan>
  </text>
</svg>`;
}

function notificationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
  <g transform="translate(72 72) scale(.71875)">${compactSymbolPaths("monochrome")}</g>
</svg>`;
}

async function renderPng(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size.width, size.height).png().toFile(path.join(assets, file));
}

async function main() {
  ensureDir(brandDir);

  const symbol = symbolSvg({ mode: "brand", background: "black", pad: 52, rounded: true });
  const symbolMono = symbolSvg({ mode: "monochrome", pad: 52 });
  const wordmarkLight = wordmarkSvg({ mode: "light" });
  const wordmarkDark = wordmarkSvg({ mode: "dark" });

  fs.writeFileSync(path.join(brandDir, "pamarket-symbol.svg"), symbol);
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-monochrome.svg"), symbolMono);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-light.svg"), wordmarkLight);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-dark.svg"), wordmarkDark);
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-detailed.svg"), symbolSvg({ mode: "brand", background: "black", pad: 52, rounded: true }));
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-compact.svg"), symbol);

  await renderPng(symbolSvg({ mode: "brand", background: "black", pad: 60 }), "icon.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "brand", background: "black", pad: 60 }), "icon-dark.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "monochrome", background: "black", pad: 60 }), "icon-tinted.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "brand", background: "transparent", pad: 74 }), "android-icon-foreground.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "monochrome", background: "transparent", pad: 74 }), "android-icon-monochrome.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "brand", background: "black", pad: 60 }), "favicon.png", { width: 64, height: 64 });
  await renderPng(notificationSvg(), "notification-icon.png", { width: 96, height: 96 });
  await renderPng(symbolSvg({ mode: "brand", background: "transparent", pad: 58 }), "splash-icon.png", { width: 640, height: 640 });
  await renderPng(symbolSvg({ mode: "brand", background: "transparent", pad: 58 }), "splash-icon-dark.png", { width: 640, height: 640 });

  await sharp(Buffer.from(wordmarkLight)).png().toFile(path.join(brandDir, "pamarket-wordmark-light.png"));
  await sharp(Buffer.from(wordmarkDark)).png().toFile(path.join(brandDir, "pamarket-wordmark-dark.png"));

  console.log("Rendered PaMarket brand assets.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
