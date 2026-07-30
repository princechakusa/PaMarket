const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const brandDir = path.join(assets, "brand");

const NAVY = "#06266F";
const NAVY_DARK = "#031A55";
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
    <radialGradient id="goldGlow" cx="0.8" cy="0.1" r="0.6">
      <stop offset="0" stop-color="${GOLD_LIGHT}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${GOLD_LIGHT}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

// The launcher icon, splash, and every brand mark are wordmark-only now — no
// hands/leaf symbol anywhere (that glyph was explicitly rejected). "Pa" is
// always gold, "Market" is always white-on-navy or navy-on-white, matching
// the in-app Home header (components/BrandLogo.tsx's BrandWordmark).

// Square icon (App Store hero, favicon): navy tile, stacked two lines so it
// stays legible at launcher size.
function iconSvg({ size = 512, rounded = true } = {}) {
  const bg = `<rect width="512" height="512"${rounded ? ' rx="116"' : ""} fill="url(#navyGrad)"/>`;
  const glow = `<circle cx="410" cy="60" r="220" fill="url(#goldGlow)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${defs()}
  ${bg}
  ${glow}
  <text x="256" y="234" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="108" font-weight="900" letter-spacing="-3" fill="${GOLD}">Pa</text>
  <text x="256" y="330" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="108" font-weight="900" letter-spacing="-3" fill="${WHITE}">Market</text>
</svg>`;
}

// Android adaptive-icon foreground layer: transparent background, wordmark
// scaled down to stay inside the circular/squircle safe zone the OS masks
// it with (roughly the middle 66% of the 512 canvas).
function adaptiveForegroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <text x="256" y="245" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="900" letter-spacing="-2" fill="${GOLD}">Pa</text>
  <text x="256" y="317" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="900" letter-spacing="-2" fill="${WHITE}">Market</text>
</svg>`;
}

function adaptiveMonochromeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <text x="256" y="245" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="900" letter-spacing="-2" fill="${WHITE}">Pa</text>
  <text x="256" y="317" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="900" letter-spacing="-2" fill="${WHITE}">Market</text>
</svg>`;
}

// Wordmark lockup (splash screen, in-app brand marks): single line, "Pa" in
// gold, "Market" in white (dark/on-brand backgrounds) or navy (light).
function wordmarkSvg({ mode = "light", width = 1280, height = 400 } = {}) {
  const onBrand = mode === "dark";
  const wordColor = onBrand ? WHITE : NAVY;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text x="640" y="237" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="116" font-weight="900" letter-spacing="-5">
    <tspan fill="${GOLD}">Pa</tspan><tspan fill="${wordColor}">Market</tspan>
  </text>
</svg>`;
}

// Android status-bar notification icon: OS renders this as a flat white
// silhouette regardless of the fill color given, and at ~24dp text isn't
// legible — a bold "P" glyph reads better than either the old symbol or an
// illegible full wordmark.
function notificationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <text x="48" y="72" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="900" fill="${WHITE}">P</text>
</svg>`;
}

async function renderPng(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size.width, size.height).png().toFile(path.join(assets, file));
}

async function main() {
  ensureDir(brandDir);

  const wordmarkLight = wordmarkSvg({ mode: "light" });
  const wordmarkDark = wordmarkSvg({ mode: "dark" });

  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-light.svg"), wordmarkLight);
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-dark.svg"), wordmarkDark);

  await renderPng(iconSvg({ rounded: false }), "icon.png", { width: 1024, height: 1024 });
  await renderPng(iconSvg({ rounded: false }), "icon-dark.png", { width: 1024, height: 1024 });
  await renderPng(adaptiveMonochromeSvg(), "icon-tinted.png", { width: 1024, height: 1024 });
  await renderPng(adaptiveForegroundSvg(), "android-icon-foreground.png", { width: 1024, height: 1024 });
  await renderPng(adaptiveMonochromeSvg(), "android-icon-monochrome.png", { width: 1024, height: 1024 });
  await renderPng(iconSvg({ rounded: false }), "favicon.png", { width: 64, height: 64 });
  await renderPng(notificationSvg(), "notification-icon.png", { width: 96, height: 96 });
  await renderPng(wordmarkLight, "splash-icon.png", { width: 1280, height: 400 });
  await renderPng(wordmarkDark, "splash-icon-dark.png", { width: 1280, height: 400 });

  await sharp(Buffer.from(wordmarkLight)).png().toFile(path.join(brandDir, "pamarket-wordmark-light.png"));
  await sharp(Buffer.from(wordmarkDark)).png().toFile(path.join(brandDir, "pamarket-wordmark-dark.png"));

  console.log("Rendered PaMarket brand assets (wordmark-only, no symbol).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
