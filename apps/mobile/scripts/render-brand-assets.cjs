const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const brandDir = path.join(assets, "brand");
const sourceLogo = path.join(brandDir, "pamarket-final-logo-source.png");

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
    <text x="258" y="336" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="332" font-weight="700" fill="${gold}" letter-spacing="-24">P</text>
    <text x="257" y="362" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="286" font-weight="700" fill="${white}" letter-spacing="-30">M</text>
    <path d="M183 166L338 378" stroke="${gold}" stroke-width="32" stroke-linecap="square" opacity="${mode === "monochrome" ? "0" : ".9"}"/>`;
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
  <text x="258" y="336" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="332" font-weight="700" fill="#FFFFFF" letter-spacing="-24">P</text>
  <text x="257" y="362" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="286" font-weight="700" fill="#FFFFFF" letter-spacing="-30">M</text>
</svg>`;
}

async function renderPng(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size.width, size.height).png().toFile(path.join(assets, file));
}

async function main() {
  ensureDir(brandDir);
  if (!fs.existsSync(sourceLogo)) {
    throw new Error(`Missing final logo source: ${sourceLogo}`);
  }

  const symbol = symbolSvg({ mode: "brand", background: "black", rounded: true });
  const symbolMono = symbolSvg({ mode: "monochrome" });
  const wordmarkLight = wordmarkSvg({ mode: "light" });
  const wordmarkDark = wordmarkSvg({ mode: "dark" });

  fs.writeFileSync(path.join(brandDir, "pamarket-symbol.svg"), symbol);
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-monochrome.svg"), symbolMono);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-light.svg"), wordmarkLight);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-dark.svg"), wordmarkDark);

  const squareLogo = sharp(sourceLogo).resize(1024, 1024, { fit: "cover" }).png();
  await squareLogo.toFile(path.join(assets, "icon.png"));
  await sharp(sourceLogo).resize(1024, 1024, { fit: "cover" }).png().toFile(path.join(assets, "icon-dark.png"));
  await sharp(sourceLogo).resize(1024, 1024, { fit: "cover" }).png().toFile(path.join(assets, "icon-tinted.png"));
  await sharp(sourceLogo).resize(1024, 1024, { fit: "cover" }).png().toFile(path.join(assets, "android-icon-foreground.png"));
  await renderPng(symbolSvg({ mode: "monochrome", background: "transparent", pad: 92 }), "android-icon-monochrome.png", { width: 1024, height: 1024 });
  await sharp(sourceLogo).resize(64, 64, { fit: "cover" }).png().toFile(path.join(assets, "favicon.png"));
  await renderPng(notificationSvg(), "notification-icon.png", { width: 96, height: 96 });
  await sharp(sourceLogo).resize(640, 640, { fit: "contain", background: BLACK }).png().toFile(path.join(assets, "splash-icon.png"));
  await sharp(sourceLogo).resize(640, 640, { fit: "contain", background: BLACK }).png().toFile(path.join(assets, "splash-icon-dark.png"));

  await sharp(Buffer.from(wordmarkLight)).png().toFile(path.join(brandDir, "pamarket-wordmark-light.png"));
  await sharp(Buffer.from(wordmarkDark)).png().toFile(path.join(brandDir, "pamarket-wordmark-dark.png"));

  console.log("Rendered PaMarket brand assets.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
