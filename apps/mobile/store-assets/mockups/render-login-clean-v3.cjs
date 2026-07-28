const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = __dirname;
const outSvg = path.join(root, "login-clean-v3.svg");
const outPng = path.join(root, "login-clean-v3.png");

const W = 738;
const H = 1600;
const NAVY = "#071D49";
const BLUE = "#153E91";
const GOLD = "#F5A000";
const INK = "#101828";
const MUTED = "#667085";
const BORDER = "#E4E9F2";
const BG = "#F6F8FC";
const WHITE = "#FFFFFF";

function defs() {
  return `
  <defs>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06183D"/>
      <stop offset=".62" stop-color="${BLUE}"/>
      <stop offset="1" stop-color="#2563D6"/>
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#06122F" flood-opacity=".14"/>
    </filter>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#06122F" flood-opacity=".10"/>
    </filter>
  </defs>`;
}

function statusBar() {
  return `
  <text x="70" y="65" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#FFFFFF">12:55</text>
  <rect x="592" y="42" width="38" height="18" rx="8" fill="#FFFFFF" opacity=".92"/>
  <rect x="640" y="39" width="48" height="24" rx="10" fill="#39D353"/>
  <text x="664" y="58" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="900" fill="#FFFFFF">99</text>`;
}

function glassBack() {
  return `
  <g transform="translate(36 104)" filter="url(#softShadow)">
    <circle cx="34" cy="34" r="34" fill="#FFFFFF" opacity=".18"/>
    <circle cx="34" cy="34" r="33" fill="none" stroke="#FFFFFF" opacity=".26"/>
    <path d="M38 21 L25 34 L38 47" fill="none" stroke="#FFFFFF" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function brandSymbol(x, y, size) {
  const scale = size / 512;
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path fill="${GOLD}" d="M108 188C129 111 187 72 256 72s127 39 148 116c4 14-5 28-19 31-31 7-58-7-72-33-10 32-31 49-57 49s-47-17-57-49c-14 26-41 40-72 33-14-3-23-17-19-31Z"/>
    <path fill="${NAVY}" d="M83 229c0-24 8-39 22-39 16 0 20 18 20 44 0 35 15 68 41 91 9 8 16 13 21 16 10 7 14 0 7-9l-38-51c-9-13-7-29 6-36 11-6 23-2 35 10l61 61c20 20 30 45 30 74v63c0 11-9 20-20 18-56-9-102-35-136-78-32-41-49-95-49-164Z"/>
    <path fill="${NAVY}" d="M429 229c0-24-8-39-22-39-16 0-20 18-20 44 0 35-15 68-41 91-9 8-16 13-21 16-10 7-14 0-7-9l38-51c9-13 7-29-6-36-11-6-23-2-35 10l-61 61c-20 20-30 45-30 74v63c0 11 9 20 20 18 56-9 102-35 136-78 32-41 49-95 49-164Z"/>
  </g>`;
}

function appleIcon(x, y, size, fill = "#FFFFFF") {
  return `<g transform="translate(${x} ${y}) scale(${size / 512})"><path fill="${fill}" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.6-2.8-74.5 20.7-88.5 20.7-14.8 0-48.8-19.7-75.6-19.2-39 .6-75 22.7-95.1 57.6-40.6 70.5-10.4 174.9 29.2 232.1 19.4 28 42.4 59.5 72.7 58.4 29.2-1.2 40.2-18.9 75.5-18.9 35.1 0 45.3 18.9 76.2 18.3 31.5-.6 51.4-28.6 70.6-56.8 22.3-32.5 31.5-64.1 32-65.7-.7-.3-61.7-23.7-62.3-97.1zM260.6 101.9C276.7 82.4 287.6 55.3 284.6 28c-23.3.9-51.5 15.5-68.2 35-15 17.3-28.1 45.1-24.6 71.6 26 .2 52.6-13.2 68.8-32.7z"/></g>`;
}

function googleIcon(x, y, size) {
  const s = size / 48;
  return `<g transform="translate(${x} ${y}) scale(${s})"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.4-4.6 2.2-7.7 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 39.7 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.6C41.4 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"/></g>`;
}

function socialButton(y, label, kind, dark) {
  return `
  <g filter="url(#softShadow)">
    <rect x="48" y="${y}" width="642" height="68" rx="22" fill="${dark ? "#05070B" : WHITE}" stroke="${dark ? "#05070B" : BORDER}" stroke-width="2"/>
    ${kind === "apple" ? appleIcon(88, y + 18, 28) : googleIcon(86, y + 16, 32)}
    <text x="369" y="${y + 43}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="850" fill="${dark ? WHITE : INK}">${label}</text>
  </g>`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0" y="0" width="${W}" height="462" fill="url(#hero)"/>
  <circle cx="646" cy="90" r="172" fill="${GOLD}" opacity=".13"/>
  <circle cx="560" cy="330" r="260" fill="#FFFFFF" opacity=".07"/>
  ${statusBar()}
  ${glassBack()}
  <text x="369" y="152" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="850" fill="#DDE9FF">PaMarket Zimbabwe</text>
  <g transform="translate(126 202)" filter="url(#softShadow)">
    <rect x="0" y="0" width="486" height="178" rx="40" fill="#FFFFFF" opacity=".12"/>
    ${brandSymbol(44, 34, 94)}
    <text x="164" y="78" font-family="Segoe UI, Arial, sans-serif" font-size="43" font-weight="950" letter-spacing="-1.5">
      <tspan fill="${GOLD}">Pa</tspan><tspan fill="${WHITE}">Market</tspan>
    </text>
    <text x="44" y="147" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="950" fill="${WHITE}">Welcome back</text>
  </g>
  <g filter="url(#cardShadow)">
    <rect x="28" y="426" width="682" height="932" rx="42" fill="#FFFFFF"/>
  </g>
  <text x="58" y="500" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="900" fill="${INK}">Sign in to continue</text>
  <text x="58" y="538" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="650" fill="${MUTED}">Buy, sell, browse listings, post ads and chat safely.</text>
  ${socialButton(586, "Continue with Apple", "apple", true)}
  ${socialButton(670, "Continue with Google", "google", false)}
  <line x1="48" y1="790" x2="262" y2="790" stroke="${BORDER}" stroke-width="2"/>
  <text x="369" y="797" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="750" fill="#98A2B3">or use email</text>
  <line x1="476" y1="790" x2="690" y2="790" stroke="${BORDER}" stroke-width="2"/>
  <text x="56" y="850" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="900" letter-spacing="1.25" fill="#7B8497">EMAIL</text>
  <rect x="48" y="866" width="642" height="70" rx="21" fill="#FAFCFF" stroke="${BORDER}" stroke-width="2"/>
  <text x="78" y="911" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="650" fill="#98A2B3">you@example.com</text>
  <text x="56" y="972" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="900" letter-spacing="1.25" fill="#7B8497">PASSWORD</text>
  <rect x="48" y="988" width="642" height="70" rx="21" fill="#FAFCFF" stroke="${BORDER}" stroke-width="2"/>
  <text x="78" y="1033" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="650" fill="#98A2B3">••••••••</text>
  <text x="646" y="1098" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="850" fill="${BLUE}">Forgot password?</text>
  <rect x="48" y="1136" width="642" height="72" rx="23" fill="${BLUE}"/>
  <text x="369" y="1181" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="900" fill="#FFFFFF">Sign In</text>
  <text x="369" y="1266" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="${MUTED}">Don’t have an account? <tspan fill="${BLUE}" font-weight="950">Create one</tspan></text>
  <rect x="74" y="1420" width="590" height="112" rx="32" fill="#FFFFFF" stroke="${BORDER}" stroke-width="2"/>
  <text x="108" y="1466" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="900" fill="${INK}">Sticky top + scrollable form</text>
  <text x="108" y="1498" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="${MUTED}">The logo/header stays calm while content scrolls.</text>
</svg>`;

async function main() {
  fs.writeFileSync(outSvg, svg);
  await sharp(Buffer.from(svg)).png().toFile(outPng);
  console.log(`Wrote ${outSvg}`);
  console.log(`Wrote ${outPng}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
