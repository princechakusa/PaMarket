'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./file-utils');
const { characterizeBrowsePage } = require('./characterize-browse-page');
const { assembleHtml } = require('./shell');

const DETAIL_PATH = path.join(ROOT, 'detail.html');
const ACCOUNT_PATH = path.join(ROOT, 'js', 'account-pages.js');
const BROWSE_PATH = path.join(ROOT, 'js', 'controllers', 'browse-page.js');

function functionSource(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('Cannot find ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Cannot parse ' + name);
}

function button(attributes) {
  return {
    dataset: {}, disabled: false, attributes: Object.assign({}, attributes), listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    getAttribute(name) { return this.attributes[name] || null; },
    closest() { return this.card || null; },
  };
}

async function settle() { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); }

async function detailRuntime(options) {
  const favouriteButton = button(), label = { textContent: 'Save to Favourites' }, alerts = [], calls = [];
  let session = options.session;
  const savedContent = {
    isListingSaved(id) { calls.push(['is', id]); return options.isSaved instanceof Error ? Promise.reject(options.isSaved) : Promise.resolve(!!options.isSaved); },
    saveListing(id) { calls.push(['save', id]); return options.mutationError ? Promise.reject(options.mutationError) : Promise.resolve({ ok: true }); },
    unsaveListing(id) { calls.push(['unsave', id]); return options.mutationError ? Promise.reject(options.mutationError) : Promise.resolve({ ok: true }); },
  };
  const context = {
    console, Promise, encodeURIComponent,
    location: { pathname: '/detail', search: '?id=listing-1', href: '' },
    alert(message) { alerts.push(message); },
    document: { getElementById(id) { return id === 'favouriteBtn' ? favouriteButton : id === 'favouriteLabel' ? label : null; } },
    PM: Object.assign({ getSession() { return session; } }, savedContent),
    PMSavedContent: savedContent,
  };
  context.window = context.self = context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(functionSource(fs.readFileSync(DETAIL_PATH, 'utf8'), 'initFavouriteButton'), context);
  context.initFavouriteButton('listing-1');
  await settle();
  return { context, favouriteButton, label, alerts, calls, setSession(value) { session = value; } };
}

function accountRuntime(page, options) {
  const buttons = [], calls = [], cards = [];
  const root = {
    _html: '',
    set innerHTML(value) { this._html = value; }, get innerHTML() { return this._html; },
    querySelectorAll(selector) {
      if (selector === '[data-unsave]' && /data-unsave=/.test(this._html)) {
        const id = (this._html.match(/data-unsave="([^"]+)/) || [])[1];
        const b = button({ 'data-unsave': id });
        b.card = { remove() { cards.length = 0; } }; buttons.push(b); cards.push(b.card); return [b];
      }
      if (selector === '[data-delete-search]' && /data-delete-search=/.test(this._html)) {
        const id = (this._html.match(/data-delete-search="([^"]+)/) || [])[1];
        const b = button({ 'data-delete-search': id }); buttons.push(b); return [b];
      }
      return [];
    },
    querySelector(selector) { return selector === '.account-card' && cards.length ? cards[0] : null; },
  };
  let favouriteLoads = 0, searchLoads = 0;
  const savedContent = {
    listFavourites() { calls.push(['listFavourites']); return Promise.resolve((options.favouriteRows || [])[favouriteLoads++] || []); },
    unsaveListing(id) { calls.push(['unsaveListing', id]); return options.unsaveError ? Promise.reject(options.unsaveError) : Promise.resolve({ ok: true }); },
    listSavedSearches() { calls.push(['listSavedSearches']); return Promise.resolve((options.searchRows || [])[searchLoads++] || []); },
    deleteSavedSearch(id) { calls.push(['deleteSavedSearch', id]); return Promise.resolve({ ok: true }); },
  };
  if (options.listError) {
    savedContent.listFavourites = savedContent.listSavedSearches = function () { return Promise.reject(options.listError); };
  }
  const context = {
    console, Promise, URLSearchParams, encodeURIComponent,
    location: { pathname: '/' + page, search: '' }, confirm() { return options.confirm !== false; },
    document: { body: { getAttribute() { return page; } }, getElementById(id) { return id === 'accountPage' ? root : null; } },
    PM: Object.assign({ getSession() { return options.session; }, money(value) { return '$' + value; } }, savedContent),
    PMSavedContent: savedContent,
  };
  context.window = context.self = context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(ACCOUNT_PATH, 'utf8'), context, { filename: 'account-pages.js' });
  return { context, root, buttons, calls, cards };
}

async function characterizeSavedContentPages() {
  let assertions = 0;
  const detailTrue = await detailRuntime({ session: { user: { id: 'user-1' } }, isSaved: true });
  assert.equal(detailTrue.label.textContent, 'Remove from Favourites'); assertions++;
  await detailTrue.favouriteButton.listeners.click();
  assert.deepEqual(detailTrue.calls.slice(-1)[0], ['unsave', 'listing-1']); assertions++;
  assert.equal(detailTrue.label.textContent, 'Save to Favourites'); assertions++;
  assert.equal(detailTrue.favouriteButton.disabled, false); assertions++;

  const detailFalse = await detailRuntime({ session: { user: { id: 'user-1' } }, isSaved: false });
  await detailFalse.favouriteButton.listeners.click();
  assert.deepEqual(detailFalse.calls.slice(-1)[0], ['save', 'listing-1']); assertions++;
  assert.equal(detailFalse.label.textContent, 'Remove from Favourites'); assertions++;

  const detailAnon = await detailRuntime({ session: null, isSaved: false });
  await detailAnon.favouriteButton.listeners.click();
  assert.match(detailAnon.context.location.href, /^auth\?return=/); assertions++;
  const detailFail = await detailRuntime({ session: { user: { id: 'user-1' } }, isSaved: false, mutationError: new Error('fail') });
  await detailFail.favouriteButton.listeners.click();
  assert.equal(detailFail.alerts[0], 'Could not update favourites. Please try again.'); assertions++;
  assert.equal(detailFail.favouriteButton.disabled, false); assertions++;

  let account = accountRuntime('favourites', { session: null }); await settle();
  assert.match(account.root.innerHTML, /Sign in required/); assertions++;
  account = accountRuntime('favourites', { session: { user: { id: 'user-1' } }, favouriteRows: [[{ id: 'listing-1', title: 'Phone', price: 10, currency: 'USD', photos: [] }], []] }); await settle();
  assert.match(account.root.innerHTML, /detail\?id=listing-1/); assertions++;
  assert.match(account.root.innerHTML, /data-unsave="listing-1"/); assertions++;
  account.buttons[0].listeners.click(); await settle();
  assert.ok(account.calls.some(call => call[0] === 'unsaveListing')); assertions++;
  assert.match(account.root.innerHTML, /No favourites yet/); assertions++;
  account = accountRuntime('favourites', { session: { user: { id: 'user-1' } }, listError: new Error('fail') }); await settle();
  assert.match(account.root.innerHTML, /Could not load favourites/); assertions++;
  account = accountRuntime('favourites', { session: { user: { id: 'user-1' } }, favouriteRows: [[{ id: 'listing-1', title: 'Phone', price: 10, currency: 'USD', photos: [] }]], unsaveError: new Error('fail') }); await settle();
  account.buttons[0].listeners.click(); await settle();
  assert.equal(account.buttons[0].disabled, false); assertions++;

  account = accountRuntime('saved-searches', { session: null }); await settle();
  assert.match(account.root.innerHTML, /Sign in required/); assertions++;
  const search = { id: 'search-1', name: 'Phones', filters: { category: 'electronics', q: 'phone', province: 'Harare', city: 'Harare', subcategory: 'phones', sort: 'price.asc' } };
  account = accountRuntime('saved-searches', { session: { user: { id: 'user-1' } }, searchRows: [[search], []] }); await settle();
  assert.match(account.root.innerHTML, /browse\?cat=electronics&amp;q=phone&amp;prov=Harare&amp;city=Harare&amp;sub=phones&amp;sort=price.asc/); assertions++;
  account.buttons[0].listeners.click(); await settle();
  assert.ok(account.calls.some(call => call[0] === 'deleteSavedSearch')); assertions++;
  assert.match(account.root.innerHTML, /No saved searches/); assertions++;
  account = accountRuntime('saved-searches', { session: { user: { id: 'user-1' } }, searchRows: [[search]], confirm: false }); await settle();
  account.buttons[0].listeners.click(); await settle();
  assert.equal(account.calls.filter(call => call[0] === 'deleteSavedSearch').length, 0); assertions++;
  account = accountRuntime('saved-searches', { session: { user: { id: 'user-1' } }, listError: new Error('fail') }); await settle();
  assert.match(account.root.innerHTML, /Could not load saved searches/); assertions++;

  const accountSource = fs.readFileSync(ACCOUNT_PATH, 'utf8');
  assert.ok(
    accountSource.includes("PM.deleteSavedSearch(button.getAttribute('data-delete-search')).then(loadSearches);") ||
      accountSource.includes("PMSavedContent.deleteSavedSearch(button.getAttribute('data-delete-search')).then(loadSearches);")
  ); assertions++;
  assert.doesNotMatch(accountSource, /deleteSavedSearch\([^;]+\.catch\(/); assertions++;
  const directPattern = /(?:user_saves|saved_searches|rpc\/(?:save_listing|unsave_listing)|\.from\s*\(\s*['"](?:user_saves|saved_searches)|\.rpc\s*\(\s*['"](?:save_listing|unsave_listing))/;
  for (const file of [DETAIL_PATH, ACCOUNT_PATH, BROWSE_PATH]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, directPattern); assertions++;
    assert.doesNotMatch(source, /PM\.(?:saveListing|unsaveListing|listFavouriteIds|listFavourites|isListingSaved|listSavedSearches|saveSearch|deleteSavedSearch)/); assertions++;
    assert.match(source, /PMSavedContent\./); assertions++;
  }
  for (const pageName of ['browse.html', 'detail.html', 'favourites.html', 'saved-searches.html']) {
    const pagePath = path.join(ROOT, pageName);
    const built = assembleHtml(fs.readFileSync(pagePath, 'utf8'), pagePath);
    const order = ['js/supabase-config.js', 'js/core/supabase-client.js', 'js/services/service-transport.js', 'js/services/saved-content.js', 'js/marketplace-data.js'].map(name => built.indexOf(name));
    assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])), pageName + ' dependency order'); assertions++;
  }
  const browse = await characterizeBrowsePage();
  assert.ok(browse.assertions >= 55); assertions++;
  return { assertions, browseAssertions: browse.assertions, knownParity: ['saved-search sort remains ignored', 'favourite cards retain detail?id=', 'saved-search delete has no rejection handler'] };
}

if (require.main === module) {
  characterizeSavedContentPages().then(result => console.log(JSON.stringify({ ok: true, ...result }, null, 2))).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { characterizeSavedContentPages };
