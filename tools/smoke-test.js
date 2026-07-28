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
    name: 'homepage renders listing cards',
    // #elCards (electronics) is the one homepage carousel that loads
    // eagerly — every other category carousel is scroll-triggered
    // (lazySection/IntersectionObserver) and won't fire without scrolling,
    // so it's the only section a non-scrolling headless check can rely on.
    // But requiring .lcard > 0 is too strict: index.html's own
    // renderCards() treats a genuinely empty category as healthy ("No
    // listings yet in this category" — happens from normal churn, e.g.
    // electronics briefly had zero active listings and false-failed this
    // exact check) versus a real fetch failure ("Couldn't load listings
    // right now — Retry"). Pass on either cards or the graceful empty
    // state; only fail on the error state or an unpopulated container
    // (stuck loading — the actual JS-blocks-init failure this test
    // exists to catch).
    test: (page) => page.evaluate(() => {
      const el = document.getElementById('elCards');
      if (!el) return false;
      if (el.querySelectorAll('.lcard').length > 0) return true;
      return /no listings yet/i.test(el.textContent || '');
    }),
  },
  {
    url: '/browse',
    name: 'browse renders listing cards',
    test: (page) => page.evaluate(() => document.querySelectorAll('#resultsGrid .gcard').length > 0),
  },
  {
    url: '/browse?shops=1',
    name: 'shops browse renders shop cards',
    test: (page) => page.evaluate(() => document.querySelectorAll('#resultsGrid .shopcard').length > 0),
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
      await page.goto(BASE + check.url, { waitUntil: 'networkidle', timeout: 45000 });
      // Give client-side data fetches a moment past network idle.
      await page.waitForTimeout(3000);
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
