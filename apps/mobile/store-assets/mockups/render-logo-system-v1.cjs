const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = __dirname;
const outSvg = path.join(root, "logo-system-v1.svg");
const outPng = path.join(root, "logo-system-v1.png");

const W = 1600;
const H = 2000;
const NAVY = "#06266F";
const NAVY_DARK = "#031A55";
const BLUE = "#153E91";
const GOLD = "#F59A00";
const GOLD_LIGHT = "#FFB21B";
const BG = "#F5F8FE";
const INK = "#101828";
const MUTED = "#667085";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";

function text(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
    <linearGradient id="pageGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EEF4FF"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#06122F" flood-opacity=".17"/>
    </filter>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#06122F" flood-opacity=".12"/>
    </filter>
  </defs>`;
}

function logoSymbol(x, y, size, mode = "color") {
  const s = size / 512;
  const canopy = mode === "white" ? WHITE : "url(#goldGrad)";
  const hand = mode === "white" ? WHITE : NAVY;
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path fill="${canopy}" d="M108 188C129 111 187 72 256 72s127 39 148 116c4 14-5 28-19 31-31 7-58-7-72-33-10 32-31 49-57 49s-47-17-57-49c-14 26-41 40-72 33-14-3-23-17-19-31z"/>
    <path fill="${hand}" d="M83 229c0-24 8-39 22-39 16 0 20 18 20 44 0 35 15 68 41 91 9 8 16 13 21 16 10 7 14 0 7-9l-38-51c-9-13-7-29 6-36 11-6 23-2 35 10l61 61c20 20 30 45 30 74v63c0 11-9 20-20 18-56-9-102-35-136-78-32-41-49-95-49-164z"/>
    <path fill="${hand}" d="M429 229c0-24-8-39-22-39-16 0-20 18-20 44 0 35-15 68-41 91-9 8-16 13-21 16-10 7-14 0-7-9l38-51c9-13 7-29-6-36-11-6-23-2-35 10l-61 61c-20 20-30 45-30 74v63c0 11 9 20 20 18 56-9 102-35 136-78 32-41 49-95 49-164z"/>
  </g>`;
}

function wordmark(x, y, size = 88, mode = "color", align = "start") {
  const pa = mode === "white" ? WHITE : GOLD;
  const market = mode === "white" ? WHITE : NAVY;
  const anchor = align === "center" ? ` text-anchor="middle"` : "";
  if (align === "center") {
    return `
    <text x="${x}" y="${y}"${anchor} font-family="Segoe UI, Inter, Arial, sans-serif" font-size="${size}" font-weight="900" letter-spacing="-4">
      <tspan fill="${pa}">Pa</tspan><tspan fill="${market}">Market</tspan>
    </text>`;
  }
  return `
  <text x="${x}" y="${y}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="${size}" font-weight="900" letter-spacing="-4">
    <tspan fill="${pa}">Pa</tspan><tspan fill="${market}">Market</tspan>
  </text>`;
}

function sectionTitle(x, y, title, subtitle) {
  return `
  <text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="900" fill="${INK}">${text(title)}</text>
  <text x="${x}" y="${y + 38}" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="650" fill="${MUTED}">${text(subtitle)}</text>`;
}

function phoneMockup(x, y) {
  return `
  <g transform="translate(${x} ${y})" filter="url(#shadow)">
    <rect x="0" y="0" width="330" height="680" rx="54" fill="#0B0D12"/>
    <rect x="14" y="14" width="302" height="652" rx="42" fill="#FFFFFF"/>
    <rect x="112" y="26" width="106" height="24" rx="12" fill="#0B0D12"/>
    <rect x="14" y="14" width="302" height="170" rx="42" fill="url(#navyGrad)"/>
    ${logoSymbol(110, 72, 86, "white")}
    ${wordmark(166, 210, 36, "color", "center")}
    <text x="166" y="250" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="${MUTED}">Welcome back</text>
    <rect x="42" y="288" width="246" height="48" rx="16" fill="#05070B"/>
    <text x="166" y="319" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="850" fill="#FFFFFF">Continue with Apple</text>
    <rect x="42" y="350" width="246" height="48" rx="16" fill="#FFFFFF" stroke="${BORDER}" stroke-width="2"/>
    <text x="166" y="381" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="850" fill="${INK}">Continue with Google</text>
    <rect x="42" y="430" width="246" height="48" rx="15" fill="#F8FAFC" stroke="${BORDER}" stroke-width="2"/>
    <rect x="42" y="494" width="246" height="48" rx="15" fill="#F8FAFC" stroke="${BORDER}" stroke-width="2"/>
    <rect x="42" y="568" width="246" height="54" rx="18" fill="${BLUE}"/>
    <text x="166" y="602" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="900" fill="#FFFFFF">Sign In</text>
  </g>`;
}

function mockup() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  <rect width="${W}" height="${H}" fill="url(#pageGrad)"/>
  <circle cx="1370" cy="140" r="320" fill="${GOLD}" opacity=".08"/>
  <circle cx="120" cy="1780" r="420" fill="${BLUE}" opacity=".08"/>

  <text x="80" y="94" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="900" letter-spacing="3" fill="${BLUE}">PAMARKET LOGO SYSTEM MOCKUP</text>
  <text x="80" y="142" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="950" letter-spacing="-1.8" fill="${INK}">Market canopy + trusted hands</text>
  <text x="80" y="184" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="650" fill="${MUTED}">A cleaner production-ready version of the concept you approved, shown across real app uses.</text>

  <g transform="translate(80 250)" filter="url(#shadow)">
    <rect x="0" y="0" width="690" height="470" rx="44" fill="#FFFFFF"/>
    ${logoSymbol(224, 50, 242, "color")}
    ${wordmark(345, 356, 86, "color", "center")}
    <text x="345" y="406" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="750" fill="${MUTED}">Primary light wordmark</text>
  </g>

  <g transform="translate(830 250)" filter="url(#shadow)">
    <rect x="0" y="0" width="690" height="470" rx="44" fill="url(#navyGrad)"/>
    ${logoSymbol(224, 50, 242, "white")}
    ${wordmark(345, 356, 86, "white", "center")}
    <text x="345" y="406" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="750" fill="rgba(255,255,255,.72)">Dark mode / splash safe</text>
  </g>

  ${sectionTitle(80, 800, "App icon", "Symbol-only icon keeps details readable on iPhone and Android.")}
  <g transform="translate(80 870)" filter="url(#shadow)">
    <rect x="0" y="0" width="300" height="300" rx="68" fill="#FFFFFF"/>
    ${logoSymbol(54, 48, 192, "color")}
  </g>
  <g transform="translate(430 870)" filter="url(#shadow)">
    <rect x="0" y="0" width="300" height="300" rx="68" fill="url(#navyGrad)"/>
    <rect x="38" y="38" width="224" height="224" rx="52" fill="#FFFFFF"/>
    ${logoSymbol(84, 72, 132, "color")}
  </g>
  <g transform="translate(780 870)" filter="url(#shadow)">
    <rect x="0" y="0" width="300" height="300" rx="68" fill="url(#navyGrad)"/>
    ${logoSymbol(54, 48, 192, "white")}
  </g>
  <g transform="translate(1130 870)" filter="url(#softShadow)">
    <rect x="0" y="0" width="300" height="300" rx="68" fill="#FFFFFF" stroke="${BORDER}" stroke-width="2"/>
    ${logoSymbol(74, 68, 152, "color")}
    <text x="150" y="250" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="900" fill="${NAVY}">small preview</text>
  </g>

  ${sectionTitle(80, 1280, "Splash + login preview", "How the same logo feels in the cleaned login direction.")}
  <g transform="translate(80 1360)" filter="url(#shadow)">
    <rect x="0" y="0" width="620" height="400" rx="44" fill="url(#navyGrad)"/>
    ${logoSymbol(230, 80, 160, "white")}
    ${wordmark(310, 300, 68, "white", "center")}
    <text x="310" y="346" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="rgba(255,255,255,.72)">Zimbabwe’s Marketplace</text>
  </g>
  ${phoneMockup(820, 1235)}

  <g transform="translate(80 1818)">
    <rect x="0" y="0" width="640" height="94" rx="28" fill="#FFFFFF" stroke="${BORDER}" stroke-width="2"/>
    ${logoSymbol(28, 22, 52, "color")}
    ${wordmark(92, 58, 38, "color")}
    <text x="372" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="750" fill="${MUTED}">Header / about screen lockup</text>
  </g>

  <g transform="translate(820 1818)">
    <rect x="0" y="0" width="640" height="94" rx="28" fill="url(#navyGrad)"/>
    ${logoSymbol(28, 22, 52, "white")}
    ${wordmark(92, 58, 38, "white")}
    <text x="372" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="750" fill="rgba(255,255,255,.72)">Home header on brand blue</text>
  </g>
</svg>`;
}

async function main() {
  const svg = mockup();
  fs.writeFileSync(outSvg, svg);
  await sharp(Buffer.from(svg)).png().toFile(outPng);
  console.log(`Wrote ${outSvg}`);
  console.log(`Wrote ${outPng}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
