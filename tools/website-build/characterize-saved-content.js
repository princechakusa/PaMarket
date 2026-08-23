'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./file-utils');

const MARKET_PATH = path.join(ROOT, 'js', 'marketplace-data.js');
const SERVICE_PATH = path.join(ROOT, 'js', 'services', 'saved-content.js');
const METHODS = [
  'saveListing', 'unsaveListing', 'listFavouriteIds', 'listFavourites',
  'isListingSaved', 'listSavedSearches', 'saveSearch', 'deleteSavedSearch',
];

function response(status, body, text) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json() { return body instanceof Error ? Promise.reject(body) : Promise.resolve(body); },
    text() { return Promise.resolve(text == null ? '' : String(text)); },
    headers: { get() { return null; } },
  };
}

function runtime(initialSession) {
  let session = initialSession || null;
  const calls = [], replies = [];
  const context = {
    console, Date, Promise, URLSearchParams, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout,
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    PMSession: { getSession() { return session; } },
    PMListings: {}, PMProfiles: {}, PMBusinesses: {}, PMRentals: {},
    fetch(url, options) {
      calls.push({ url, options: options || {} });
      if (!replies.length) throw new Error('Unexpected fetch: ' + url);
      const next = replies.shift();
      return Promise.resolve(typeof next === 'function' ? next(url, options || {}) : next);
    },
  };
  context.window = context.self = context.globalThis = context;
  vm.createContext(context);
  if (fs.existsSync(SERVICE_PATH)) {
    vm.runInContext(fs.readFileSync(SERVICE_PATH, 'utf8'), context, { filename: 'saved-content.js' });
  }
  vm.runInContext(fs.readFileSync(MARKET_PATH, 'utf8'), context, { filename: 'marketplace-data.js' });
  return {
    context, calls, replies,
    api: context.PMSavedContent || context.PM,
    setSession(value) { session = value; },
  };
}

async function rejectsMessage(promise, expected) {
  await assert.rejects(promise, error => error && error.message === expected);
}

async function characterizeSavedContent() {
  let assertions = 0;
  const marketSource = fs.readFileSync(MARKET_PATH, 'utf8');
  const serviceSource = fs.readFileSync(SERVICE_PATH, 'utf8');
  for (const name of METHODS) {
    assert.doesNotMatch(marketSource, new RegExp('function\\s+' + name + '\\s*\\(')); assertions++;
    assert.match(marketSource, new RegExp('global\\.PM\\.' + name + '\\s*=\\s*function')); assertions++;
  }
  assert.doesNotMatch(marketSource, /function\s+favouriteRpc\s*\(/); assertions++;
  assert.match(serviceSource, /root\.PMSavedContent\s*=\s*api/); assertions++;
  assert.match(serviceSource, /Object\.freeze\s*\(/); assertions++;
  const anonymous = runtime(null);
  for (const name of METHODS) { assert.equal(typeof anonymous.api[name], 'function'); assertions++; }
  assert.deepEqual(await anonymous.api.listFavouriteIds(), []); assertions++;
  assert.deepEqual(await anonymous.api.listFavourites(), []); assertions++;
  assert.equal(await anonymous.api.isListingSaved('listing-1'), false); assertions++;
  assert.deepEqual(await anonymous.api.listSavedSearches(), []); assertions++;
  await rejectsMessage(anonymous.api.saveListing('listing-1'), 'not-authenticated'); assertions++;
  await rejectsMessage(anonymous.api.unsaveListing('listing-1'), 'not-authenticated'); assertions++;
  await rejectsMessage(anonymous.api.saveSearch('Search', {}), 'not-authenticated'); assertions++;
  await rejectsMessage(anonymous.api.deleteSavedSearch('search-1'), 'not-authenticated'); assertions++;
  assert.equal(anonymous.calls.length, 0); assertions++;

  const authenticated = runtime({ access_token: 'old-token', user: { id: 'user-1' } });
  authenticated.replies.push(response(200, null), response(200, null));
  assert.deepEqual(await authenticated.api.saveListing('listing-1'), { ok: true }); assertions++;
  assert.deepEqual(await authenticated.api.saveListing('listing-1'), { ok: true }); assertions++;
  for (const call of authenticated.calls.splice(0)) {
    assert.equal(call.url, 'https://project.supabase.co/rest/v1/rpc/save_listing'); assertions++;
    assert.equal(call.options.method, 'POST'); assertions++;
    assert.equal(call.options.headers.apikey, 'anon-key'); assertions++;
    assert.equal(call.options.headers.Authorization, 'Bearer old-token'); assertions++;
    assert.equal(call.options.headers['Content-Type'], 'application/json'); assertions++;
    assert.deepEqual(JSON.parse(call.options.body), { p_listing_id: 'listing-1' }); assertions++;
  }

  authenticated.replies.push(response(200, null), response(200, null));
  assert.deepEqual(await authenticated.api.unsaveListing('listing-1'), { ok: true }); assertions++;
  assert.deepEqual(await authenticated.api.unsaveListing('listing-1'), { ok: true }); assertions++;
  for (const call of authenticated.calls.splice(0)) {
    assert.equal(call.url, 'https://project.supabase.co/rest/v1/rpc/unsave_listing'); assertions++;
    assert.deepEqual(JSON.parse(call.options.body), { p_listing_id: 'listing-1' }); assertions++;
  }

  const savedRows = [
    { listing_id: 'listing-2', saved_at: '2026-08-23T03:00:00Z' },
    { listing_id: 'missing-listing', saved_at: '2026-08-23T02:00:00Z' },
    { listing_id: 'listing-1', saved_at: '2026-08-23T01:00:00Z' },
  ];
  authenticated.replies.push(response(200, savedRows));
  assert.deepEqual(await authenticated.api.listFavouriteIds(), savedRows); assertions++;
  let call = authenticated.calls.shift();
  assert.equal(call.url, 'https://project.supabase.co/rest/v1/user_saves?user_id=eq.user-1&select=listing_id,saved_at&order=saved_at.desc&limit=500'); assertions++;
  assert.equal(call.options.headers.Authorization, 'Bearer old-token'); assertions++;

  authenticated.replies.push(response(200, savedRows), response(200, [
    { id: 'listing-1', title: 'First' }, { id: 'listing-2', title: 'Second' },
  ]));
  const hydrated = await authenticated.api.listFavourites();
  assert.deepEqual(hydrated.map(row => row.id), ['listing-2', 'listing-1']); assertions++;
  assert.deepEqual(hydrated.map(row => row.saved_at), ['2026-08-23T03:00:00Z', '2026-08-23T01:00:00Z']); assertions++;
  authenticated.calls.shift(); call = authenticated.calls.shift();
  assert.match(call.url, /\/rest\/v1\/listings\?id=in\.\(listing-2,missing-listing,listing-1\)&status=eq\.active&expires_at=gt\..+&select=\*$/); assertions++;
  assert.equal(call.options.headers.Authorization, 'Bearer anon-key'); assertions++;

  authenticated.replies.push(response(200, savedRows));
  assert.equal(await authenticated.api.isListingSaved('listing-2'), true); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(200, savedRows));
  assert.equal(await authenticated.api.isListingSaved('missing'), false); assertions++;
  authenticated.calls.shift();

  const searches = [{ id: 'search-1', name: 'Phones', filters: { q: 'phone' } }];
  authenticated.replies.push(response(200, searches));
  assert.deepEqual(await authenticated.api.listSavedSearches(), searches); assertions++;
  call = authenticated.calls.shift();
  assert.equal(call.url, 'https://project.supabase.co/rest/v1/saved_searches?user_id=eq.user-1&select=*&order=saved_at.desc&limit=200'); assertions++;
  assert.equal(call.options.headers.Authorization, 'Bearer old-token'); assertions++;

  const created = { id: 'search-2', user_id: 'user-1', name: 'Phones' };
  authenticated.replies.push(response(201, [created]));
  assert.deepEqual(await authenticated.api.saveSearch('Phones', { q: 'phone', category: 'electronics', city: 'Harare', sort: 'price.asc' }), created); assertions++;
  call = authenticated.calls.shift();
  assert.equal(call.url, 'https://project.supabase.co/rest/v1/saved_searches'); assertions++;
  assert.equal(call.options.method, 'POST'); assertions++;
  assert.equal(call.options.headers.Prefer, 'return=representation'); assertions++;
  assert.deepEqual(JSON.parse(call.options.body), {
    user_id: 'user-1', name: 'Phones', query: 'phone', category: 'electronics',
    filters: { q: 'phone', category: 'electronics', city: 'Harare', sort: 'price.asc' },
  }); assertions++;

  authenticated.replies.push(response(201, [created]));
  assert.deepEqual(await authenticated.api.saveSearch('Phones', { q: 'phone', category: 'electronics', city: 'Harare', sort: 'price.asc' }), created); assertions++;
  call = authenticated.calls.shift();
  assert.equal(call.options.method, 'POST'); assertions++;
  assert.equal(JSON.parse(call.options.body).name, 'Phones'); assertions++;

  authenticated.replies.push(response(201, []));
  const fallback = await authenticated.api.saveSearch('', { category: 'vehicles' });
  assert.equal(fallback.name, 'vehicles'); assertions++;
  assert.equal(fallback.query, null); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(201, []));
  const truncated = await authenticated.api.saveSearch('x'.repeat(100), {});
  assert.equal(truncated.name.length, 80); assertions++;
  authenticated.calls.shift();

  authenticated.replies.push(response(204, null), response(204, null));
  assert.deepEqual(await authenticated.api.deleteSavedSearch('search-1'), { ok: true }); assertions++;
  assert.deepEqual(await authenticated.api.deleteSavedSearch('search-1'), { ok: true }); assertions++;
  for (const deleteCall of authenticated.calls.splice(0)) {
    assert.equal(deleteCall.url, 'https://project.supabase.co/rest/v1/saved_searches?id=eq.search-1&user_id=eq.user-1'); assertions++;
    assert.equal(deleteCall.options.method, 'DELETE'); assertions++;
  }

  authenticated.replies.push(response(401, null, 'expired-token'));
  await rejectsMessage(authenticated.api.saveListing('listing-1'), 'expired-token'); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(500, null, ''));
  await rejectsMessage(authenticated.api.listFavouriteIds(), 'favourites-read-failed'); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(500, null, ''));
  await rejectsMessage(authenticated.api.listSavedSearches(), 'saved-searches-read-failed'); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(400, null, 'save-search-denied'));
  await rejectsMessage(authenticated.api.saveSearch('Denied', {}), 'save-search-denied'); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(400, null, 'delete-search-denied'));
  await rejectsMessage(authenticated.api.deleteSavedSearch('search-1'), 'delete-search-denied'); assertions++;
  authenticated.calls.shift();
  authenticated.replies.push(response(200, new Error('malformed-json')));
  await rejectsMessage(authenticated.api.listSavedSearches(), 'malformed-json'); assertions++;
  authenticated.calls.shift();

  authenticated.setSession({ access_token: 'refreshed-token', user: { id: 'user-1' } });
  authenticated.replies.push(response(200, []));
  await authenticated.api.listFavouriteIds();
  assert.equal(authenticated.calls.shift().options.headers.Authorization, 'Bearer refreshed-token'); assertions++;

  if (authenticated.context.PMSavedContent) {
    assert.deepEqual(Object.keys(authenticated.context.PMSavedContent).sort(), METHODS.slice().sort()); assertions++;
    for (const name of METHODS) { assert.equal(typeof authenticated.context.PM[name], 'function'); assertions++; }
  }
  return { assertions, operations: METHODS.length, mode: fs.existsSync(SERVICE_PATH) ? 'service' : 'legacy-pm' };
}

if (require.main === module) {
  characterizeSavedContent().then(result => console.log(JSON.stringify({ ok: true, ...result }, null, 2))).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { characterizeSavedContent, METHODS };
