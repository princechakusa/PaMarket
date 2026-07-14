const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SESSION_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'session.js'), 'utf8');
const MARKET_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'marketplace-data.js'), 'utf8');

function makeRuntime(session, responseFactory) {
  const values = new Map();
  if (session) values.set('pm_session', JSON.stringify(session));
  const windowListeners = {};
  const documentListeners = {};
  const calls = [];
  let reloads = 0;

  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const document = {
    readyState: 'complete',
    visibilityState: 'visible',
    getElementById() { return null; },
    addEventListener(type, handler) { documentListeners[type] = handler; },
    head: { appendChild() {} },
    createElement() { return { style: {}, appendChild() {} }; },
  };
  const window = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    localStorage,
    document,
    location: { reload() { reloads += 1; } },
    setInterval(handler) { window.intervalHandler = handler; return 1; },
    addEventListener(type, handler) { windowListeners[type] = handler; },
  };
  const fetch = async function (url, options) {
    calls.push({ url, options });
    return responseFactory(url, options);
  };
  const context = vm.createContext({
    window, document, localStorage, fetch,
    Promise, Date, JSON, Object, Error, Number, Math,
    encodeURIComponent, decodeURIComponent, URLSearchParams,
    console,
  });
  vm.runInContext(SESSION_SOURCE, context, { filename: 'js/session.js' });

  return {
    context, window, localStorage, calls, windowListeners,
    get reloads() { return reloads; },
    storedSession() {
      const raw = localStorage.getItem('pm_session');
      return raw ? JSON.parse(raw) : null;
    },
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function testNearExpiryRefresh() {
  const original = {
    access_token: 'old-access',
    refresh_token: 'valid-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 90,
    user: { id: 'user-1', email: 'person@example.com' },
  };
  const runtime = makeRuntime(original, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        access_token: 'new-access',
        refresh_token: 'rotated-refresh',
        expires_in: 3600,
        user: original.user,
      };
    },
  }));

  // Existing callers remain synchronous and see a session while renewal runs.
  assert.strictEqual(runtime.window.PMSession.getSession().access_token, 'old-access');
  await settle();

  const renewed = runtime.storedSession();
  assert.strictEqual(runtime.calls.length, 1);
  assert.match(runtime.calls[0].url, /token\?grant_type=refresh_token$/);
  assert.deepStrictEqual(JSON.parse(runtime.calls[0].options.body), { refresh_token: 'valid-refresh' });
  assert.strictEqual(renewed.access_token, 'new-access');
  assert.strictEqual(renewed.refresh_token, 'rotated-refresh');
  assert.ok(renewed.expires_at > original.expires_at);
  assert.strictEqual(runtime.reloads, 0);

  vm.runInContext(MARKET_SOURCE, runtime.context, { filename: 'js/marketplace-data.js' });
  assert.strictEqual(runtime.window.PM.getSession().access_token, 'new-access');
  await runtime.window.PM.listFavouriteIds();
  assert.strictEqual(runtime.calls[1].options.headers.Authorization, 'Bearer new-access');
}

async function testRevokedRefreshSignsOut() {
  const runtime = makeRuntime({
    access_token: 'expired-access',
    refresh_token: 'revoked-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 30,
    user: { id: 'user-1' },
  }, async () => ({ ok: false, status: 401, async json() { return {}; } }));

  await settle();
  assert.strictEqual(runtime.storedSession(), null);
  assert.strictEqual(runtime.reloads, 1);
}

async function testTransientFailurePreservesSession() {
  const runtime = makeRuntime({
    access_token: 'old-access',
    refresh_token: 'valid-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 30,
    user: { id: 'user-1' },
  }, async () => ({ ok: false, status: 503, async json() { return {}; } }));

  await settle();
  assert.ok(runtime.storedSession());
  assert.strictEqual(runtime.reloads, 0);
}

async function testCrossTabSignOut() {
  const session = {
    access_token: 'access', refresh_token: 'refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'user-1' },
  };
  const runtime = makeRuntime(session, async () => {
    throw new Error('refresh should not run');
  });
  const storageHandler = runtime.windowListeners.storage;
  assert.strictEqual(typeof storageHandler, 'function');

  runtime.localStorage.removeItem('pm_session');
  storageHandler({ key: 'pm_session', oldValue: JSON.stringify(session), newValue: null });
  assert.strictEqual(runtime.reloads, 1);
}

async function testCrossTabRefreshDoesNotReload() {
  const before = {
    access_token: 'old', refresh_token: 'refresh-old',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'user-1' },
  };
  const after = Object.assign({}, before, { access_token: 'new', refresh_token: 'refresh-new' });
  const runtime = makeRuntime(before, async () => {
    throw new Error('refresh should not run');
  });
  runtime.localStorage.setItem('pm_session', JSON.stringify(after));
  runtime.windowListeners.storage({
    key: 'pm_session', oldValue: JSON.stringify(before), newValue: JSON.stringify(after),
  });
  assert.strictEqual(runtime.reloads, 0);
  assert.strictEqual(runtime.window.PMSession.getSession().access_token, 'new');
}

(async function main() {
  await testNearExpiryRefresh();
  await testRevokedRefreshSignsOut();
  await testTransientFailurePreservesSession();
  await testCrossTabSignOut();
  await testCrossTabRefreshDoesNotReload();
  console.log('PASS session refresh regression tests');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
