'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { ROOT } = require('./file-utils');
const { assembleHtml } = require('./shell');
const PAGE_PATH = path.join(ROOT, 'browse.html');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'controllers', 'browse-page.js');
function currentInlineController(page) {
  const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  const inline = scripts.find(script => script.includes('const PIN=') && script.includes('function runQuery'));
  if (!inline) throw new Error('Cannot find the current inline Browse controller');
  const adStart = inline.indexOf('// Sponsored ads');
  const controllerStart = inline.indexOf('const PAGE_SIZE');
  assert.ok(adStart > 0 && controllerStart > adStart, 'paid-ad boundary precedes Browse controller');
  return inline.slice(0, adStart) + inline.slice(controllerStart);
}
function controllerSource(page) {
  return fs.existsSync(CONTROLLER_PATH) ? fs.readFileSync(CONTROLLER_PATH, 'utf8') : currentInlineController(page);
}
class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) { const on=force===undefined?!this.values.has(name):!!force; if(on)this.values.add(name);else this.values.delete(name); return on; }
}
class FakeElement {
  constructor(id) {
    Object.assign(this,{id,value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,style:{},dataset:{},attributes:{}});
    this.classList = new FakeClassList();
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  insertAdjacentHTML(_position, html) { this.innerHTML += html; }
  querySelectorAll(selector) {
    const count=(this.innerHTML.match(/class="(?:gcard|shopcard)"/g)||[]).length;
    return selector==='.gcard, .shopcard'?Array.from({length:count},()=>new FakeElement('card')):[];
  }
  addEventListener() {}
  remove() { this.removed = true; }
}
function createRuntime(search, overrides) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };
  get('sortSelect').value = 'created_at.desc';
  const appended=[],historyUrls=[],historyPushes=[],listingCalls=[],businessCalls=[],saves=[],favourites=[];
  const listing = {
    id: 'listing-1', title: 'Phone', price: 25, currency: 'USD', category: 'electronics',
    city: 'Harare', province: 'Harare', photos: ['phone.jpg'], created_at: '2026-08-22T00:00:00Z',
  };
  const business = { id: 'business-1', name: 'Verified Shop', city: 'Harare', verification_level: 1 };
  let session = { user: { id: 'user-1' }, access_token: 'token' };
  const document = {title:'',getElementById:get,querySelectorAll(){return[];},addEventListener(){},
    head:{appendChild(node){appended.push(node);if(node.id)elements.set(node.id,node);}},createElement(tag){return new FakeElement(tag);}};
  const context = {
    console, Date, Promise, URLSearchParams, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout,
    document,
    location: { search: search || '', pathname: '/browse' },
    history: {
      replaceState(_state, _title, url) { historyUrls.push(url); },
      pushState(_state, _title, url) { historyPushes.push(url); },
    },
    prompt: () => 'My search', alert() {},
    PMListings:{fetchListings(opts){listingCalls.push(opts);return Promise.resolve([listing]);},fetchListingCount(){return Promise.resolve(1);}},
    PMBusinesses:{fetchBusinesses(opts){businessCalls.push(opts);return Promise.resolve([business]);}},
    PMUrls:{listingPath(row){return'/l/'+row.id;},listingUrl(row){return'https://pamarketzw.com/l/'+row.id;}},
    PMFeedback:{empty(message){return'EMPTY:'+message;},error(message){return'ERROR:'+message;}},
    PM: {
      money(value) { return '$' + value; },
      fetchExactCount() { return Promise.resolve(1); },
      getSession() { return session; },
    },
    PMSavedContent: {
      saveSearch(name, filters) { saves.push({ name, filters }); return Promise.resolve(); },
      saveListing(id) { favourites.push({ action: 'save', id }); return Promise.resolve(); },
      unsaveListing(id) { favourites.push({ action: 'unsave', id }); return Promise.resolve(); },
      listFavouriteIds() { return Promise.resolve([]); },
    },
  };
  context.window=context.self=context.globalThis=context;
  context.IntersectionObserver=class{constructor(callback){context.intersectionCallback=callback;}observe(element){context.observedElement=element;}};
  Object.assign(context, overrides || {});
  vm.createContext(context);
  return {context,elements,get,appended,historyUrls,historyPushes,listingCalls,businessCalls,saves,favourites,listing,business,setSession(value){session=value;}};
}
function exposeInline(source) {
  return source + `\n;globalThis.PMBrowsePage=Object.freeze({
    init:function(){},getState:function(){return Object.assign({},state)},runQuery:runQuery,
    loadMore:loadMore,syncFromUrl:syncFromUrl,applyFilters:applyFilters,
    applyFiltersMobile:applyFiltersMobile,saveCurrentSearch:saveCurrentSearch,
    toggleFavourite:toggleFavourite,renderListingCard:gcard,renderBusinessCard:bcard,
    updateItemListSchema:updateItemListSchema
  });`;
}
async function loadRuntime(search, overrides) {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  const source = controllerSource(page);
  const runtime = createRuntime(search, overrides);
  if (fs.existsSync(CONTROLLER_PATH)) {
    vm.runInContext(source, runtime.context, { filename: 'browse-page.js' });
    runtime.context.PMBrowsePage.init();
  } else {
    vm.runInContext(exposeInline(source), runtime.context, { filename: 'browse-inline.js' });
  }
  await new Promise(resolve => setImmediate(resolve));
  return runtime;
}
async function characterizeBrowsePage() {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  const built = assembleHtml(page, PAGE_PATH);
  const source = controllerSource(page);
  let assertions = 0;
  const dependencyOrder = [
    'js/supabase-config.js', 'js/core/supabase-client.js', 'js/services/service-transport.js',
    'js/services/saved-content.js', 'js/services/listings.js', 'js/services/businesses.js', 'js/marketplace-data.js',
  ].map(name => built.indexOf(name));
  assert.ok(dependencyOrder.every((at, index) => at >= 0 && (!index || at > dependencyOrder[index - 1]))); assertions++;
  assert.match(page, /PM\.fetchActiveAds\(\{placement:'browse',limit:8\}\)/); assertions++; assert.match(page, /PM\.trackAdEvent\(a\.id,'impression'\)/); assertions++;
  assert.doesNotMatch(source, /fetchActiveAds|trackAdEvent/); assertions++; assert.doesNotMatch(source, /SUPABASE|\/rest\/v1\/|(?:supabase|client|sb)\.from\s*\(|\.rpc\s*\(/i); assertions++;
  for (const api of ['PMListings', 'PMBusinesses', 'PMUrls', 'PMFeedback']) {
    assert.match(source, new RegExp('\\b' + api.replace('$', '\\$') + '\\b')); assertions++;
  }
  assert.doesNotMatch(source, /(?:min|max)(?:Price)?\s*[:=]|[?&](?:min|max)_?price=/i); assertions++;
  const parsed = await loadRuntime('?q=phone&cat=electronics&prov=Harare&city=Harare&shops=1&business=biz-1&sub=phones&sort=price.asc');
  const state = parsed.context.PMBrowsePage.getState();
  assert.equal(state.q, 'phone'); assertions++; assert.equal(state.cat, 'electronics'); assertions++;
  assert.equal(state.prov, 'Harare'); assertions++; assert.equal(state.city, 'Harare'); assertions++;
  assert.equal(state.shops, true); assertions++; assert.equal(state.business, 'biz-1'); assertions++;
  assert.equal(state.sub, 'phones'); assertions++; assert.equal(Object.prototype.hasOwnProperty.call(state, 'minPrice'), false); assertions++;
  assert.equal(state.sort, 'price.asc'); assertions++; assert.equal(parsed.get('sortSelect').value, 'price.asc'); assertions++;
  assert.equal(parsed.businessCalls[0].q, 'phone'); assertions++; assert.equal(parsed.businessCalls[0].offset, 0); assertions++;
  const restoredPrice = await loadRuntime('?cat=electronics&sort=price.asc');
  assert.equal(restoredPrice.listingCalls[0].order, 'price.asc'); assertions++; assert.equal(restoredPrice.listingCalls[0].featuredFirst, false); assertions++;
  const defaults = await loadRuntime('?cat=electronics&city=Mutare');
  assert.equal(defaults.listingCalls[0].category, 'electronics'); assertions++; assert.equal(defaults.listingCalls[0].city, 'Mutare'); assertions++;
  assert.equal(defaults.listingCalls[0].featuredFirst, true); assertions++; assert.equal(defaults.listingCalls[0].order, undefined); assertions++;
  assert.equal(defaults.context.PMBrowsePage.getState().sort, 'created_at.desc'); assertions++;
  assert.equal(defaults.get('sortSelect').value, 'created_at.desc'); assertions++;
  assert.equal(defaults.listingCalls[0].limit, 20); assertions++; assert.equal(defaults.listingCalls[0].offset, 0); assertions++;
  assert.match(defaults.context.PMBrowsePage.renderListingCard(defaults.listing, 0), /href="\/l\/listing-1"/); assertions++;
  const shopCard = defaults.context.PMBrowsePage.renderBusinessCard(defaults.business, 0);
  assert.match(shopCard, /href="business\?id=business-1"/); assertions++;
  assert.match(shopCard, /shopcard-verified/); assertions++;

  defaults.context.PMBrowsePage.updateItemListSchema([defaults.listing]);
  const schema = defaults.appended.at(-1);
  assert.equal(schema.id, 'itemListSchema'); assertions++; assert.equal(JSON.parse(schema.textContent)['@type'], 'ItemList'); assertions++;
  assert.equal(JSON.parse(schema.textContent).itemListElement[0].url, 'https://pamarketzw.com/l/listing-1'); assertions++;

  defaults.get('sortSelect').value = 'price.asc';
  defaults.context.PMBrowsePage.applyFilters();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(defaults.listingCalls.at(-1).order, 'price.asc'); assertions++; assert.equal(defaults.listingCalls.at(-1).featuredFirst, false); assertions++;
  assert.match(defaults.historyUrls.at(-1), /^browse\?cat=electronics&city=Mutare&sort=price\.asc$/); assertions++;
  assert.equal(defaults.historyPushes.length, 0); assertions++;
  defaults.get('sortSelect').value = 'price.desc';
  defaults.context.PMBrowsePage.applyFilters();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(defaults.listingCalls.at(-1).order, 'price.desc'); assertions++;
  assert.match(defaults.historyUrls.at(-1), /[?&]sort=price\.desc(?:&|$)/); assertions++;

  const descending = await loadRuntime('?sort=price.desc');
  assert.equal(descending.context.PMBrowsePage.getState().sort, 'price.desc'); assertions++;
  assert.equal(descending.get('sortSelect').value, 'price.desc'); assertions++;
  assert.equal(descending.listingCalls[0].order, 'price.desc'); assertions++;
  const invalidSort = await loadRuntime('?sort=created_at.asc');
  assert.equal(invalidSort.context.PMBrowsePage.getState().sort, 'created_at.desc'); assertions++;
  assert.equal(invalidSort.get('sortSelect').value, 'created_at.desc'); assertions++;
  assert.equal(invalidSort.listingCalls[0].order, undefined); assertions++;
  assert.equal(invalidSort.listingCalls[0].featuredFirst, true); assertions++;
  invalidSort.context.PMBrowsePage.applyFilters(); await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(invalidSort.historyUrls.at(-1), /[?&]sort=/); assertions++;

  await defaults.context.PMBrowsePage.loadMore();
  assert.equal(defaults.listingCalls.at(-1).offset, 20); assertions++; assert.ok(defaults.get('resultsGrid').innerHTML.includes('/l/listing-1')); assertions++;
  assert.strictEqual(defaults.context.observedElement, defaults.get('loadMoreBtn')); assertions++;

  defaults.get('fCatM').value='vehicles'; defaults.get('fQM').value='Toyota';
  defaults.get('fProvM').value='Manicaland'; defaults.get('fCityM').value='Mutare';
  defaults.context.PMBrowsePage.applyFiltersMobile();
  assert.equal(defaults.get('fCat').value, 'vehicles'); assertions++; assert.equal(defaults.get('fQ').value, 'Toyota'); assertions++;
  assert.equal(defaults.get('fProv').value, 'Manicaland'); assertions++; assert.equal(defaults.get('fCity').value, 'Mutare'); assertions++;

  await defaults.context.PMBrowsePage.saveCurrentSearch();
  assert.equal(defaults.saves.length, 1); assertions++; assert.equal(defaults.saves[0].filters.category, 'vehicles'); assertions++;
  const button = new FakeElement('favourite');
  button.setAttribute('data-save-listing', 'listing-1');
  await defaults.context.PMBrowsePage.toggleFavourite(button);
  assert.deepEqual(defaults.favourites[0], { action: 'save', id: 'listing-1' }); assertions++;
  button.classList.add('saved');
  await defaults.context.PMBrowsePage.toggleFavourite(button);
  assert.deepEqual(defaults.favourites[1], { action: 'unsave', id: 'listing-1' }); assertions++;

  const unauthenticated = await loadRuntime('');
  unauthenticated.setSession(null);
  await unauthenticated.context.PMBrowsePage.saveCurrentSearch();
  assert.match(String(unauthenticated.context.location.href || unauthenticated.context.location), /auth\?return=/); assertions++;
  const anonymousButton = new FakeElement('anonymous-favourite');
  anonymousButton.setAttribute('data-save-listing', 'listing-1');
  await unauthenticated.context.PMBrowsePage.toggleFavourite(anonymousButton);
  assert.match(String(unauthenticated.context.location.href || unauthenticated.context.location), /auth\?return=/); assertions++;

  assert.match(source, /PMSavedContent\.listFavouriteIds\(\)[\s\S]*classList\.toggle\('saved'/); assertions++;
  assert.match(source, /PMSavedContent\.(?:saveListing|unsaveListing)/); assertions++;
  assert.doesNotMatch(source, /PM\.(?:saveListing|unsaveListing|listFavouriteIds|saveSearch)/); assertions++;

  const empty = await loadRuntime('', { PMListings: { fetchListings: () => Promise.resolve([]), fetchListingCount: () => Promise.resolve(0) } });
  assert.match(empty.get('resultsGrid').innerHTML, /^EMPTY:/); assertions++;
  const failed = await loadRuntime('', { PMListings: { fetchListings: () => Promise.reject(new Error('fail')), fetchListingCount: () => Promise.resolve(0) } });
  assert.match(failed.get('resultsGrid').innerHTML, /^ERROR:/); assertions++;
  assert.match(source, /grid\.innerHTML=skeletons\(8\).*Loading /s); assertions++; assert.match(source, /if\(loadingMore\)return;[\s\S]*loadingMore=true/); assertions++;
  assert.match(source, /syncFromUrl\(\);\s*updateHero\(\);\s*highlightCatNav\(\);\s*runQuery\(false\);/); assertions++;
  assert.match(source, /pageTitle=catLabel\+' for Sale in '\+place\+' \| PaMarket Zimbabwe'/); assertions++; assert.match(source, /pageTitle='Classifieds in '\+place\+', Zimbabwe \| PaMarket'/); assertions++;

  return { assertions, priceFilterContract: 'not present in existing Browse behavior', paidAdsBoundary: 'inline and unchanged' };
}

if (require.main === module) {
  characterizeBrowsePage().then(result => console.log(JSON.stringify({ ok: true, ...result }, null, 2))).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { characterizeBrowsePage };
