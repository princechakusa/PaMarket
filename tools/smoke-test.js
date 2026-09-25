// Post-deploy smoke test for the live website. Fails (exit 1) if a core
// page stops rendering its listings — the class of silent breakage where
// a JS error blocks init and the page sits on "Loading…" forever (this
// exact failure shipped once: browse broke when a header refactor removed
// an element id that page JS still referenced).
//
// Run: node tools/smoke-test.js [baseUrl]   (default https://pamarketzw.com)
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'https://pamarketzw.com';

const CHECKS = [
  {
    url: '/',
    name: 'homepage renders live listing counts',
    // catCount-electronics is a per-category count badge fed by a real
    // data fetch on load (unlike the scroll-triggered category rails,
    // this one always renders without scrolling). Its markup ships with a
    // static placeholder value, so the check must confirm the fetch
    // actually replaced it with a live number, not just that the element
    // exists.
    test: (page) => page.evaluate(() => {
      const el = document.getElementById('catCount-electronics');
      if (!el) return false;
      return /^[\d.,]+k?$/i.test((el.textContent || '').trim());
    }),
  },
  {
    url: '/browse',
    name: 'browse renders listing cards',
    test: (page) => page.evaluate(() => document.querySelectorAll('#listingsGrid > article').length > 0),
  },
  {
    url: '/browse?shops=1',
    name: 'shops browse renders shop cards',
    test: (page) => page.evaluate(() => document.querySelectorAll('#listingsGrid > article').length > 0),
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let failed = 0;
  for (const check of CHECKS) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let pass = false;
    try {
      // 'networkidle' never fires on pages that hold a persistent
      // connection (e.g. a realtime subscription on /browse) — it isn't a
      // signal of brokenness, just an open socket. 'load' plus a fixed
      // settle window is a wait strategy that works across every page.
      await page.goto(BASE + check.url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(4000);
      pass = await check.test(page);
    } catch (e) {
      errors.push('nav: ' + e.message);
    }
    const status = pass && errors.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failed++;
    console.log(`${status}  ${check.name}  (${BASE}${check.url})` + (errors.length ? `  errors: ${errors.join(' | ')}` : ''));
    await page.close();
  }
  await browser.close();
  if (failed) {
    console.error(`\n${failed} smoke check(s) FAILED — the live site may be broken.`);
    process.exit(1);
  }
  console.log('\nAll smoke checks passed.');
})();
