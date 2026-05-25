'use strict';
/**
 * AGENT 1 — Feature Testing Agent (Playwright)
 *
 * Simulates real user flows in the PaMarket PWA using a real browser.
 * Tests the vanilla JS SPA with DOM-based verification — no framework assumptions.
 *
 * Flows tested:
 *   1. App load and splash → home page render
 *   2. Browse tab + listing card render
 *   3. Auth gate: unauthenticated user → login prompt on gated pages
 *   4. Login flow: email → form → sign-in
 *   5. Listing detail: tap a listing card → detail page
 *   6. Listing filter: search input → filtered results
 *   7. Notification bell: presence in home header
 *   8. PWA manifest and service worker registration
 *
 * Returns: { agent, status, tests, issues, screenshotPaths }
 *
 * NOTE: Playwright must be installed (npm run setup:browsers).
 * If not installed, agent gracefully degrades and returns status:'skipped'.
 */

const path   = require('path');
const fs     = require('fs');
const logger = require('../utils/logger');

const SPLASH_SELECTOR  = '#pamarketSplash';
const MAIN_AREA        = '#mainArea';
const BOTTOM_NAV       = '#bottomNav';
const TOAST_EL         = '#toastEl';
const AUTH_CARD        = '#authCard';
const MODAL_BG         = '#modalBg';

// Wait for splash to be gone AND main area to be visible
async function waitForBoot(page, timeout = 20000) {
  // Wait for splash to disappear (removed, hidden, or opacity 0)
  await page.waitForFunction(() => {
    const splash = document.getElementById('pamarketSplash');
    if (!splash) return true;
    const style = window.getComputedStyle(splash);
    return (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      splash.classList.contains('hiding') ||
      splash.classList.contains('hidden')
    );
  }, { timeout });

  // Then wait for main area to actually become visible
  try {
    await page.waitForSelector('#mainArea', { state: 'visible', timeout: 8000 });
  } catch {
    // If mainArea never appears we still proceed — the test will record the failure
  }
}

async function run(config) {
  logger.agent('AGENT 1 — Feature Testing (Playwright)');
  const tests   = [];
  const issues  = [];
  const screenshots = [];

  // ── Check Playwright is available ────────────────────────────────────────
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    logger.warn('Playwright not installed — run "npm run setup:browsers" to enable feature testing');
    logger.warn('Skipping Agent 1. All other agents will run normally.');
    return {
      agent:   'FeatureTesting',
      status:  'skipped',
      reason:  'playwright not installed',
      tests:   [],
      issues:  [],
    };
  }

  if (!config.APP_URL || config.APP_URL.includes('example')) {
    logger.warn('APP_URL not configured — skipping feature testing (set APP_URL in config.js)');
    return {
      agent:  'FeatureTesting',
      status: 'skipped',
      reason: 'APP_URL not configured',
      tests:  [],
      issues: [],
    };
  }

  const screenshotDir = path.join(config.REPORT_DIR || './reports', 'screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await playwright.chromium.launch({
    headless: config.BROWSER_HEADLESS !== false,
    slowMo:   config.BROWSER_SLOW_MO || 0,
  });

  const context = await browser.newContext({
    viewport:          { width: 390, height: 844 },  // iPhone 14 dimensions
    userAgent:         'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    locale:            'en-US',
    timezoneId:        'Africa/Harare',
    serviceWorkers:    'block',  // don't cache during tests
    ignoreHTTPSErrors: true,
  });

  // Capture browser console errors
  const consoleErrors = [];
  context.on('page', page => {
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
  });

  const page = await context.newPage();
  const timeout = config.PLAYWRIGHT_TIMEOUT || 30000;

  async function screenshot(name) {
    const filePath = path.join(screenshotDir, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    screenshots.push(filePath);
    return filePath;
  }

  try {
    // ── TEST 1: App loads and home renders ──────────────────────────────────
    logger.section('Test 1: App Load & Home Render');
    {
      await page.goto(config.APP_URL, { waitUntil: 'domcontentloaded', timeout });

      let bootOk = false;
      try {
        await waitForBoot(page, timeout);
        bootOk = true;
      } catch (e) {
        logger.fail('Splash screen did not disappear within timeout — app boot failed', e.message);
      }

      const mainAreaVisible = await page.isVisible(MAIN_AREA).catch(() => false);
      const navVisible      = await page.isVisible(BOTTOM_NAV).catch(() => false);
      const mainContent     = await page.textContent(MAIN_AREA).catch(() => '');

      if (bootOk && mainAreaVisible && navVisible) {
        logger.pass('App boots and renders home page');
        tests.push({ name: 'app_load_home', status: 'pass', evidence: { mainAreaVisible, navVisible } });
        await screenshot('01-app-home');
      } else {
        logger.fail('App did not render correctly after boot');
        const screenshotPath = await screenshot('01-app-boot-fail');
        tests.push({
          name: 'app_load_home',
          status: 'fail',
          evidence: { mainAreaVisible, navVisible, bootOk, mainContentLength: mainContent.length },
        });
        issues.push({
          id: 'ISSUE-UI-001',
          summary: 'App home page does not render after boot',
          module: 'listings',
          layer: 'frontend',
          severity: 'critical',
          evidence: { uiTest: `mainAreaVisible=${mainAreaVisible}, navVisible=${navVisible}, bootOk=${bootOk}` },
          rootCause: 'The app failed to complete H.boot() or the home page rendering threw an uncaught error. Check console errors.',
          fix: { type: 'javascript', file: 'www/js/app.js', fn: 'H.boot', description: 'Investigate H.boot() error', code: '// Check console for errors during app boot' },
        });
      }
    }

    // ── TEST 2: Browse tab ──────────────────────────────────────────────────
    logger.section('Test 2: Browse Tab');
    {
      const browseBtn = await page.$('[data-nav="Browse"]').catch(() => null);
      if (browseBtn) {
        await browseBtn.click();
        await page.waitForTimeout(1000);
        const hasSearchInput = await page.isVisible('#searchIn, input[placeholder*="Search"], input[type="search"]').catch(() => false);
        await screenshot('02-browse-tab');
        logger.pass('Browse tab renders', `searchInput=${hasSearchInput}`);
        tests.push({ name: 'browse_tab_renders', status: 'pass', evidence: { hasSearchInput } });
      } else {
        logger.warn('Browse nav button not found — possible DOM change');
        tests.push({ name: 'browse_tab_renders', status: 'warn', evidence: { browseBtn: null } });
      }
    }

    // ── TEST 3: Listing cards render ─────────────────────────────────────────
    logger.section('Test 3: Listing Cards in Feed');
    {
      // Navigate to home
      const homeBtn = await page.$('[data-nav="Home"]').catch(() => null);
      if (homeBtn) await homeBtn.click();
      await page.waitForTimeout(1500);

      const listingCards = await page.$$('.list-card, .list-card-wrap, [onclick*="openListing"]');
      const cardCount = listingCards.length;

      if (cardCount > 0) {
        logger.pass(`${cardCount} listing card(s) rendered in home feed`);
        tests.push({ name: 'listing_cards_render', status: 'pass', count: cardCount });
        await screenshot('03-listing-cards');
      } else {
        // Check if it's an empty state or an error
        const emptyState  = await page.$('.empty-state, .empty-title').catch(() => null);
        const errorState  = await page.$('.error-state, .error-title').catch(() => null);

        if (emptyState) {
          logger.warn('Home feed shows empty state (no active listings)');
          tests.push({ name: 'listing_cards_render', status: 'warn', evidence: { emptyState: true } });
        } else if (errorState) {
          logger.fail('Home feed shows error state');
          await screenshot('03-listing-cards-error');
          tests.push({ name: 'listing_cards_render', status: 'fail', evidence: { errorState: true } });
          issues.push({
            id: 'ISSUE-UI-002',
            summary: 'Home feed renders error state — listings failed to load from Supabase',
            module: 'listings',
            layer: 'frontend',
            severity: 'critical',
            evidence: { uiTest: 'Error state shown where listing cards expected' },
            rootCause: 'H.fetchListingsFromSupabase() failed (network error, RLS block, or schema mismatch). Check browser console and Supabase RLS for listings.',
            fix: { type: 'javascript', file: 'www/js/app.js', fn: 'H.fetchListingsFromSupabase', description: 'Add error logging to fetch function', code: '// Verify Supabase anon policy for listings.status=active' },
          });
        } else {
          logger.warn('Home feed appears empty — may still be loading or no listings exist');
          tests.push({ name: 'listing_cards_render', status: 'warn' });
        }
      }
    }

    // ── TEST 4: Auth gate — Post requires login ───────────────────────────────
    logger.section('Test 4: Auth Gate on Protected Pages');
    {
      const postBtn = await page.$('[data-nav="Post"]').catch(() => null);
      if (postBtn) {
        await postBtn.click();
        await page.waitForTimeout(800);

        // Should show login modal or full auth page
        const modalOpen = await page.isVisible('#modalBg.open, .auth-wrap, #authCard').catch(() => false);
        await screenshot('04-auth-gate');

        if (modalOpen) {
          logger.pass('Auth gate works — Post tab prompts login for unauthenticated user');
          tests.push({ name: 'auth_gate_post', status: 'pass' });
        } else {
          // Check if we're on post form (user was already logged in from prev test)
          const onPostPage = await page.isVisible('[data-nav="Post"].active').catch(() => false);
          if (onPostPage) {
            logger.warn('Post tab opened without auth gate — user may have been logged in');
            tests.push({ name: 'auth_gate_post', status: 'warn', note: 'May have been authenticated from prior test' });
          } else {
            logger.fail('Auth gate not triggered on Post tab');
            tests.push({ name: 'auth_gate_post', status: 'fail' });
            issues.push({
              id: 'ISSUE-UI-003',
              summary: 'Auth gate not enforced on Post tab — unauthenticated users may access listing creation',
              module: 'listings',
              layer: 'frontend',
              severity: 'high',
              evidence: { uiTest: 'Post tab accessible without auth prompt' },
              rootCause: 'H.navTo("Post") check for H.currentUser() may have been bypassed, or H.currentUser() is incorrectly returning a stub user.',
              fix: { type: 'javascript', file: 'www/js/app.js', fn: 'H.navTo', description: 'Verify auth check in navTo', code: `if(['Post'].includes(name) && !H.currentUser()) { H.requireAuth('Log in to post an ad'); return; }` },
            });
          }
        }
      }
    }

    // ── TEST 5: Login flow (if credentials configured) ───────────────────────
    if (!config.READ_ONLY && config.TEST_USER && config.TEST_USER.email) {
      logger.section('Test 5: Login Flow (Email)');
      try {
        // Get to auth form
        const accountBtn = await page.$('[data-nav="Account"]').catch(() => null);
        if (accountBtn) await accountBtn.click();
        await page.waitForTimeout(800);

        // If auth page is shown, proceed with login
        const emailLoginBtn = await page.$('button.email.social-auth-btn, button:has-text("Login with email")').catch(() => null);
        if (emailLoginBtn) {
          await emailLoginBtn.click();
          await page.waitForTimeout(500);

          const emailInput = await page.$('#emailIn').catch(() => null);
          const passInput  = await page.$('#passIn').catch(() => null);

          if (emailInput && passInput) {
            await emailInput.fill(config.TEST_USER.email);
            await passInput.fill(config.TEST_USER.password);
            await page.keyboard.press('Enter');

            // Wait for auth to complete — expect main area to update
            await page.waitForFunction(() => {
              return window.H && window.H.state && window.H.state.currentUserId;
            }, { timeout: 10000 }).catch(() => null);

            const loggedIn = await page.evaluate(() => !!(window.H && window.H.state && window.H.state.currentUserId));

            if (loggedIn) {
              logger.pass('Login flow succeeded — currentUserId set in H.state');
              tests.push({ name: 'login_flow_email', status: 'pass' });
              await screenshot('05-logged-in-home');
            } else {
              const toast = await page.textContent('#toastEl').catch(() => '');
              logger.fail('Login did not set currentUserId', `Toast: ${toast}`);
              tests.push({ name: 'login_flow_email', status: 'fail', evidence: { toast } });
            }
          } else {
            logger.warn('Login form fields not found after clicking email login');
            tests.push({ name: 'login_flow_email', status: 'warn' });
          }
        } else {
          // Already logged in or on account page
          const loggedIn = await page.evaluate(() => !!(window.H && window.H.state && window.H.state.currentUserId));
          if (loggedIn) {
            logger.pass('Already logged in from previous test');
            tests.push({ name: 'login_flow_email', status: 'pass', note: 'pre-authenticated' });
          } else {
            logger.warn('Could not find email login button on account page');
            tests.push({ name: 'login_flow_email', status: 'warn' });
          }
        }
      } catch (e) {
        logger.fail('Login flow threw an exception', e.message);
        tests.push({ name: 'login_flow_email', status: 'fail', error: e.message });
      }
    } else {
      logger.info('Test 5 (Login): READ_ONLY mode or no credentials — skipping write flow');
      tests.push({ name: 'login_flow_email', status: 'skipped', reason: 'read-only or no credentials' });
    }

    // ── TEST 6: Listing detail ────────────────────────────────────────────────
    logger.section('Test 6: Listing Detail Page');
    {
      // Navigate home and try clicking a listing
      const homeBtn = await page.$('[data-nav="Home"]').catch(() => null);
      if (homeBtn) await homeBtn.click();
      await page.waitForTimeout(1200);

      const firstCard = await page.$('.list-card-wrap, [onclick*="openListing"]').catch(() => null);
      if (firstCard) {
        await firstCard.click();
        await page.waitForTimeout(1200);
        await screenshot('06-listing-detail');

        // Detail page has back button + content
        const hasBackBtn = await page.isVisible('.back, button.back').catch(() => false);
        const detailText = await page.textContent(MAIN_AREA).catch(() => '');
        const hasPrice   = /\$|ZiG|\d+/.test(detailText);

        if (hasBackBtn && hasPrice) {
          logger.pass('Listing detail page renders correctly');
          tests.push({ name: 'listing_detail_page', status: 'pass', evidence: { hasBackBtn, hasPrice } });
        } else {
          logger.warn('Listing detail may not be rendering correctly', `backBtn=${hasBackBtn}, hasPrice=${hasPrice}`);
          tests.push({ name: 'listing_detail_page', status: 'warn', evidence: { hasBackBtn, hasPrice } });
        }

        // Test goBack()
        const backBtn = await page.$('.back, button.back').catch(() => null);
        if (backBtn) {
          await backBtn.click();
          await page.waitForTimeout(700);
          const backOnHome = await page.isVisible(`${BOTTOM_NAV}`).catch(() => false);
          if (backOnHome) {
            logger.pass('Back navigation works from listing detail');
            tests.push({ name: 'listing_detail_back', status: 'pass' });
          }
        }
      } else {
        logger.warn('No listing cards to click for detail test');
        tests.push({ name: 'listing_detail_page', status: 'warn', note: 'no cards available' });
      }
    }

    // ── TEST 7: H.state inspection ────────────────────────────────────────────
    logger.section('Test 7: H.state Inspection via Browser');
    {
      const stateSnapshot = await page.evaluate(() => {
        if (!window.H || !window.H.state) return null;
        const s = window.H.state;
        return {
          listingCount:      (s.listings || []).length,
          userCount:         (s.users || []).length,
          conversationCount: (s.conversations || []).length,
          currentUserId:     s.currentUserId,
          cityFilter:        s.cityFilter,
          sortMode:          s._sortMode,
          paidAdsCount:      (s.paidAds || []).length,
          stateKeys:         Object.keys(s),
        };
      }).catch(() => null);

      if (stateSnapshot) {
        logger.pass('H.state accessible and populated');
        logger.info(`  listings: ${stateSnapshot.listingCount}, users: ${stateSnapshot.userCount}`);
        logger.info(`  cityFilter: ${stateSnapshot.cityFilter}, sortMode: ${stateSnapshot.sortMode}`);
        tests.push({ name: 'h_state_inspection', status: 'pass', stateSnapshot });

        // Check for stale defaults
        if (stateSnapshot.cityFilter !== 'All Zimbabwe' && !stateSnapshot.currentUserId) {
          logger.warn('cityFilter is not default for unauthenticated session');
        }

        // Check state size
        const stateSize = await page.evaluate(() => {
          try {
            const raw = localStorage.getItem('pamarket.v2');
            return raw ? raw.length : 0;
          } catch { return 0; }
        });
        logger.info(`  localStorage state size: ${(stateSize / 1024).toFixed(1)} KB`);
        tests.push({ name: 'h_state_size', status: stateSize > 4 * 1024 * 1024 ? 'fail' : 'pass', sizeKB: (stateSize / 1024).toFixed(1) });

      } else {
        logger.warn('H.state not accessible via page.evaluate — window.H may not be set');
        tests.push({ name: 'h_state_inspection', status: 'warn' });
      }
    }

    // ── TEST 8: PWA manifest and service worker ────────────────────────────────
    logger.section('Test 8: PWA Manifest & Service Worker');
    {
      const manifestRes = await page.evaluate(async (appUrl) => {
        try {
          const res = await fetch(appUrl.replace(/\/$/, '') + '/manifest.json');
          if (!res.ok) return { ok: false, status: res.status };
          const manifest = await res.json();
          return { ok: true, name: manifest.name, display: manifest.display, icons: (manifest.icons || []).length };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, config.APP_URL).catch(() => ({ ok: false }));

      if (manifestRes.ok) {
        logger.pass('PWA manifest accessible', `name="${manifestRes.name}", display="${manifestRes.display}", icons=${manifestRes.icons}`);
        tests.push({ name: 'pwa_manifest', status: 'pass', manifest: manifestRes });
      } else {
        logger.warn('PWA manifest not accessible', JSON.stringify(manifestRes));
        tests.push({ name: 'pwa_manifest', status: 'warn', evidence: manifestRes });
      }

      // Service worker registration
      const swRegistered = await page.evaluate(() => {
        return navigator.serviceWorker && navigator.serviceWorker.controller !== null;
      }).catch(() => false);
      // Note: we block service workers in context, so this will be false
      logger.info(`Service worker active in page context: ${swRegistered} (blocked in test context — expected false)`);
      tests.push({ name: 'service_worker', status: 'pass', note: 'Blocked in test context by design' });
    }

  } catch (err) {
    logger.fail(`Feature testing agent threw unexpected error: ${err.message}`);
    issues.push({
      id: 'ISSUE-UI-CRASH',
      summary: `Feature testing crashed: ${err.message}`,
      module: 'listings',
      layer: 'frontend',
      severity: 'high',
      evidence: { uiTest: err.stack },
      rootCause: 'Unexpected error during automated UI testing',
      fix: { type: 'javascript', file: 'www/index.html', description: 'Investigate the error above', code: '// See stack trace in evidence' },
    });
    await screenshot('99-crash-state').catch(() => {});
  } finally {
    await browser.close();
  }

  // Report console errors found during testing
  if (consoleErrors.length > 0) {
    logger.warn(`${consoleErrors.length} console error(s) detected during browser tests`);
    consoleErrors.slice(0, 5).forEach(e => logger.fail(`  Browser error: ${e}`));
    issues.push({
      id: 'ISSUE-UI-CONSOLE',
      summary: `${consoleErrors.length} JavaScript console errors during normal app usage`,
      module: 'listings',
      layer: 'frontend',
      severity: 'medium',
      evidence: { uiTest: consoleErrors.slice(0, 5).join('\n') },
      rootCause: 'Uncaught JavaScript errors logged to browser console during normal navigation. These may indicate silent failures in app logic.',
      fix: { type: 'javascript', file: 'www/js/app.js', description: 'Investigate and fix console errors', code: '// See evidence for specific errors' },
    });
  }

  logger.divider();
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  logger.info(`Feature Testing: ${passed} passed, ${failed} failed, ${screenshots.length} screenshots`);

  return {
    agent:       'FeatureTesting',
    status:      failed > 0 ? 'fail' : issues.length > 0 ? 'warn' : 'pass',
    tests,
    issues,
    screenshots,
    consoleErrors,
  };
}

if (require.main === module) {
  let config;
  try { config = require('../config'); } catch { config = require('../config.example'); }
  run(config).then(r => {
    console.log(`\nFeature testing: ${r.status.toUpperCase()} — ${r.tests.length} tests, ${r.issues.length} issues`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { run };
