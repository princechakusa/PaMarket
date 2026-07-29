const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const brandDir = path.join(assets, "brand");

const BLUE = "#1A3A8F";
const BLUE_DARK = "#122A6B";
const GOLD = "#F5A623";
const GOLD_DARK = "#E2920F";
const WHITE = "#FFFFFF";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function wordmarkSvg({ width = 1400, height = 360, background = "transparent" } = {}) {
  const bg =
    background === "blue"
      ? `<rect width="${width}" height="${height}" rx="${Math.round(height * 0.22)}" fill="${BLUE}"/>`
      : background === "blueDark"
        ? `<rect width="${width}" height="${height}" rx="${Math.round(height * 0.22)}" fill="${BLUE_DARK}"/>`
        : "";
  const fontSize = Math.round(height * 0.38);
  const y = Math.round(height * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bg}
  <text x="${width / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="-1">
    <tspan fill="${GOLD}">Pa</tspan><tspan fill="${WHITE}">Market</tspan>
  </text>
</svg>`;
}

function iconSvg({ size = 1024, background = BLUE } = {}) {
  const fontSize = Math.round(size * 0.135);
  const y = Math.round(size * 0.55);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${background}"/>
  <text x="${size / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="-1">
    <tspan fill="${GOLD}">Pa</tspan><tspan fill="${WHITE}">Market</tspan>
  </text>
</svg>`;
}

function notificationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <text x="48" y="58" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="-.5" fill="${WHITE}">Pa</text>
</svg>`;
}

async function renderPng(svg, relativePath, size) {
  await sharp(Buffer.from(svg)).resize(size.width, size.height).png().toFile(path.join(assets, relativePath));
}

async function renderWebp(svg, outputPath, size) {
  await sharp(Buffer.from(svg)).resize(size.width, size.height).webp({ quality: 95 }).toFile(outputPath);
}

async function main() {
  ensureDir(brandDir);

  fs.writeFileSync(path.join(brandDir, "pamarket-symbol.svg"), iconSvg({ size: 512, background: BLUE }));
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-compact.svg"), iconSvg({ size: 512, background: BLUE }));
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-detailed.svg"), iconSvg({ size: 512, background: BLUE }));
  fs.writeFileSync(path.join(brandDir, "pamarket-symbol-monochrome.svg"), wordmarkSvg({ width: 512, height: 512 }));
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-light.svg"), wordmarkSvg({ background: "blue" }));
  fs.writeFileSync(path.join(brandDir, "pamarket-wordmark-dark.svg"), wordmarkSvg({ background: "blueDark" }));

  await renderPng(iconSvg({ background: BLUE }), "icon.png", { width: 1024, height: 1024 });
  await renderPng(iconSvg({ background: BLUE_DARK }), "icon-dark.png", { width: 1024, height: 1024 });
  await renderPng(iconSvg({ background: BLUE }), "icon-tinted.png", { width: 1024, height: 1024 });
  await renderPng(wordmarkSvg({ width: 1024, height: 1024 }), "android-icon-foreground.png", { width: 1024, height: 1024 });
  await renderPng(wordmarkSvg({ width: 1024, height: 1024 }), "android-icon-monochrome.png", { width: 1024, height: 1024 });
  await renderPng(iconSvg({ size: 128, background: BLUE }), "favicon.png", { width: 128, height: 128 });
  await renderPng(notificationSvg(), "notification-icon.png", { width: 96, height: 96 });
  await renderPng(wordmarkSvg(), "splash-icon.png", { width: 1400, height: 360 });
  await renderPng(wordmarkSvg(), "splash-icon-dark.png", { width: 1400, height: 360 });

  await sharp(Buffer.from(wordmarkSvg({ background: "blue" }))).png().toFile(path.join(brandDir, "pamarket-wordmark-light.png"));
  await sharp(Buffer.from(wordmarkSvg({ background: "blueDark" }))).png().toFile(path.join(brandDir, "pamarket-wordmark-dark.png"));

  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(densities)) {
    const dir = path.join(root, "android", "app", "src", "main", "res", `mipmap-${density}`);
    await renderWebp(iconSvg({ size, background: BLUE }), path.join(dir, "ic_launcher.webp"), { width: size, height: size });
    await renderWebp(iconSvg({ size, background: BLUE }), path.join(dir, "ic_launcher_round.webp"), { width: size, height: size });
    await renderWebp(wordmarkSvg({ width: size, height: size }), path.join(dir, "ic_launcher_foreground.webp"), { width: size, height: size });
    await renderWebp(wordmarkSvg({ width: size, height: size }), path.join(dir, "ic_launcher_monochrome.webp"), { width: size, height: size });
  }

  const splash = { mdpi: [280, 72], hdpi: [420, 108], xhdpi: [560, 144], xxhdpi: [840, 216], xxxhdpi: [1120, 288] };
  for (const [density, [width, height]] of Object.entries(splash)) {
    await renderPng(wordmarkSvg({ width, height }), path.join("..", "android", "app", "src", "main", "res", `drawable-${density}`, "splashscreen_logo.png"), { width, height });
    await renderPng(wordmarkSvg({ width, height }), path.join("..", "android", "app", "src", "main", "res", `drawable-night-${density}`, "splashscreen_logo.png"), { width, height });
  }

  console.log("Rendered PaMarket blue/gold/white brand assets.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
