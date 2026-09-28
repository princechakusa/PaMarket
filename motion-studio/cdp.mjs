// node cdp.mjs shot                 → shots/social.png of the Business Suite tab
// node cdp.mjs run "<async js>"     → runs Playwright code with `page` in scope, then screenshots
import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://localhost:9333');
const pages = b.contexts()[0].pages();
const page = pages.find(p => /business\.facebook\.com/.test(p.url())) || pages[0];
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'run') {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try { const r = await new AsyncFunction('page', arg)(page); if (r !== undefined) console.log(JSON.stringify(r, null, 1)); } catch (e) { console.log('ERR', e.message.split('\n')[0]); }
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: 'shots/social.png' });
console.log(page.url().slice(0, 90));
process.exit(0);
