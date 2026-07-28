const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const brandDir = path.join(assets, "brand");

const NAVY = "#06266F";
const NAVY_DARK = "#031A55";
const BLUE = "#153E91";
const GOLD = "#F59A00";
const GOLD_LIGHT = "#FFB21B";
const WHITE = "#FFFFFF";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function defs() {
  return `
  <defs>
    <linearGradient id="navyGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY_DARK}"/>
      <stop offset=".62" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="#1749B2"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset=".62" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="#E48500"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#06122F" flood-opacity=".16"/>
    </filter>
  </defs>`;
}

function symbolPaths(mode = "color") {
  const canopy = mode === "white" ? WHITE : "url(#goldGrad)";
  const hands = mode === "white" ? WHITE : NAVY;
  return `
    <path fill="${canopy}" d="M108 188C129 111 187 72 256 72s127 39 148 116c4 14-5 28-19 31-31 7-58-7-72-33-10 32-31 49-57 49s-47-17-57-49c-14 26-41 40-72 33-14-3-23-17-19-31Z"/>
    <path fill="${hands}" d="M83 229c0-24 8-39 22-39 16 0 20 18 20 44 0 35 15 68 41 91 9 8 16 13 21 16 10 7 14 0 7-9l-38-51c-9-13-7-29 6-36 11-6 23-2 35 10l61 61c20 20 30 45 30 74v63c0 11-9 20-20 18-56-9-102-35-136-78-32-41-49-95-49-164Z"/>
    <path fill="${hands}" d="M429 229c0-24-8-39-22-39-16 0-20 18-20 44 0 35-15 68-41 91-9 8-16 13-21 16-10 7-14 0-7-9l38-51c9-13 7-29-6-36-11-6-23-2-35 10l-61 61c-20 20-30 45-30 74v63c0 11 9 20 20 18 56-9 102-35 136-78 32-41 49-95 49-164Z"/>`;
}

function symbolSvg({ mode = "color", background = "transparent", pad = 70 } = {}) {
  const bg =
    background === "white"
      ? `<rect width="512" height="512" rx="116" fill="${WHITE}"/>`
      : background === "navy"
        ? `<rect width="512" height="512" rx="116" fill="url(#navyGrad)"/>`
        : "";
  const scale = (512 - pad * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${defs()}
  ${bg}
  <g transform="translate(${pad} ${pad}) scale(${scale})">${symbolPaths(mode)}</g>
</svg>`;
}

function wordmarkSvg({ mode = "light", width = 1280, height = 400 } = {}) {
  const dark = mode === "dark";
  const bg = dark ? `<rect width="${width}" height="${height}" fill="url(#navyGrad)"/>` : "";
  const symbolMode = dark ? "white" : "color";
  const wordColor = dark ? WHITE : NAVY;
  const paColor = dark ? WHITE : GOLD;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs()}
  ${bg}
  <g transform="translate(166 72) scale(.48)">${symbolPaths(symbolMode)}</g>
  <text x="432" y="237" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="116" font-weight="900" letter-spacing="-5">
    <tspan fill="${paColor}">Pa</tspan><tspan fill="${wordColor}">Market</tspan>
  </text>
</svg>`;
}

function notificationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
  <path fill="#FFFFFF" d="M108 188C129 111 187 72 256 72s127 39 148 116c4 14-5 28-19 31-31 7-58-7-72-33-10 32-31 49-57 49s-47-17-57-49c-14 26-41 40-72 33-14-3-23-17-19-31Z"/>
  <path fill="#FFFFFF" d="M83 229c0-24 8-39 22-39 16 0 20 18 20 44 0 35 15 68 41 91 9 8 16 13 21 16 10 7 14 0 7-9l-38-51c-9-13-7-29 6-36 11-6 23-2 35 10l61 61c20 20 30 45 30 74v63c0 11-9 20-20 18-56-9-102-35-136-78-32-41-49-95-49-164Z"/>
  <path fill="#FFFFFF" d="M429 229c0-24-8-39-22-39-16 0-20 18-20 44 0 35-15 68-41 91-9 8-16 13-21 16-10 7-14 0-7-9l38-51c9-13 7-29-6-36-11-6-23-2-35 10l-61 61c-20 20-30 45-30 74v63c0 11 9 20 20 18 56-9 102-35 136-78 32-41 49-95 49-164Z"/>
</svg>`;
}

async function renderPng(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size.width, size.height).png().toFile(path.join(assets, file));
}

async function main() {
  ensureDir(brandDir);

  const symbol = symbolSvg({ mode: "color" });
  const symbolMono = symbolSvg({ mode: "white" });
  const wordmarkLight = wordmarkSvg({ mode: "light" });
  const wordmarkDark = wordmarkSvg({ mode: "dark" });

  fs.writeFileSync(path.join(brandDir, "pamarket-symbol.svg"), symbol);
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-monochrome.svg"), symbolMono);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-light.svg"), wordmarkLight);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-dark.svg"), wordmarkDark);

  await renderPng(symbolSvg({ mode: "color", background: "white", pad: 58 }), "icon.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "white", background: "navy", pad: 58 }), "icon-dark.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "white", background: "navy", pad: 58 }), "icon-tinted.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "color", background: "transparent", pad: 92 }), "android-icon-foreground.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "white", background: "transparent", pad: 92 }), "android-icon-monochrome.png", { width: 1024, height: 1024 });
  await renderPng(symbolSvg({ mode: "color", background: "white", pad: 58 }), "favicon.png", { width: 64, height: 64 });
  await renderPng(notificationSvg(), "notification-icon.png", { width: 96, height: 96 });
  await renderPng(wordmarkLight, "splash-icon.png", { width: 1280, height: 400 });
  await renderPng(wordmarkDark, "splash-icon-dark.png", { width: 1280, height: 400 });

  await sharp(Buffer.from(wordmarkLight)).png().toFile(path.join(brandDir, "pamarket-wordmark-light.png"));
  await sharp(Buffer.from(wordmarkDark)).png().toFile(path.join(brandDir, "pamarket-wordmark-dark.png"));

  console.log("Rendered PaMarket brand assets.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
