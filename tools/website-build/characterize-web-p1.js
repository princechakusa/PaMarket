'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./file-utils');

function response(data, count) {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: name => name.toLowerCase() === 'content-range' ? count || null : null },
    json: () => Promise.resolve(data),
  });
}

async function characterizeWebP1() {
  const requests = [];
  const now = Date.now();
  const visibleAd = { id: 'ad-1', headline: 'Live ad', image_url: 'ad.jpg', link_url: '/browse', target_section: 'home', starts_at: new Date(now - 60000).toISOString(), ends_at: new Date(now + 60000).toISOString() };
  const futureAd = { id: 'ad-2', headline: 'Future ad', target_section: 'home', starts_at: new Date(now + 60000).toISOString(), ends_at: null };
  const expiredAd = { id: 'ad-3', headline: 'Expired ad', target_section: 'home', starts_at: null, ends_at: new Date(now - 60000).toISOString() };
  const context = {
    console, Date, Promise, encodeURIComponent,
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key',
    PMListings: {}, PMProfiles: {}, PMBusinesses: {}, PMRentals: {},
  };
  context.fetch = (url, options) => {
    requests.push({ url, options: options || {} });
    if (url.includes('target_section=eq.error')) return Promise.reject(new Error('network failure'));
    if (url.includes('/paid_ads?')) return response([visibleAd, futureAd, expiredAd]);
    if (url.includes('/business_followers?')) return response([], '0-0/7');
    return response([]);
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'marketplace-data.js'), 'utf8'), context, { filename: 'marketplace-data.js' });

  let assertions = 0;
  assert.deepEqual(await context.PM.fetchActiveAds({ placement: 'home', limit: 8 }), [visibleAd]); assertions++;
  const adRequest = requests.at(-1);
  assert.match(adRequest.url, /paid_ads\?active=eq\.true&target_section=eq\.home/); assertions++;
  assert.match(adRequest.url, /select=id,headline,image_url,link_url,target_section,starts_at,ends_at/); assertions++;
  assert.match(adRequest.url, /order=created_at\.desc&limit=8$/); assertions++;
  assert.equal(adRequest.options.headers.Authorization, 'Bearer anon-key'); assertions++;
  assert.doesNotMatch(adRequest.url, /(?:select=[^&]*\btitle\b|[?&]placement=)/); assertions++;
  await assert.rejects(context.PM.fetchActiveAds({ placement: 'error' }), /network failure/); assertions++;

  assert.equal(await context.PM.fetchExactCount('business_followers', 'business_id=eq.business-1', 'user_id'), 7); assertions++;
  const followerRequest = requests.at(-1);
  assert.match(followerRequest.url, /business_followers\?business_id=eq\.business-1&select=user_id&limit=0$/); assertions++;
  assert.equal(followerRequest.options.method, undefined); assertions++;
  assert.equal(followerRequest.options.headers.Prefer, 'count=exact'); assertions++;
  assert.equal(followerRequest.options.headers.Range, '0-0'); assertions++;
  assert.doesNotMatch(followerRequest.url, /select=id/); assertions++;

  const business = fs.readFileSync(path.join(ROOT, 'business.html'), 'utf8');
  const productCard = business.slice(business.indexOf('function prodCard'), business.indexOf('function bizCard'));
  assert.match(productCard, /PMUrls\.listingPath\(l\)/); assertions++;
  assert.doesNotMatch(productCard, /detail\?id=/); assertions++;
  const profile = fs.readFileSync(path.join(ROOT, 'profile.html'), 'utf8');
  const profileCard = profile.slice(profile.indexOf('function gcard'), profile.indexOf('// Boost picker'));
  assert.match(profileCard, /PMUrls\.listingPath\(listing\)/); assertions++;
  assert.doesNotMatch(profileCard, /detail\?id=/); assertions++;
  const listingExtras = fs.readFileSync(path.join(ROOT, 'js', 'listing-extras.js'), 'utf8');
  const recentCard = listingExtras.slice(listingExtras.indexOf('function card'), listingExtras.indexOf('function initShare'));
  assert.match(recentCard, /PMSchema\.listingPath\(r\)/); assertions++;
  assert.doesNotMatch(recentCard, /detail\?id=/); assertions++;
  const rentals = fs.readFileSync(path.join(ROOT, 'rentals.html'), 'utf8');
  const rentalCard = rentals.slice(rentals.indexOf('function rcard'), rentals.indexOf('function esc('));
  assert.match(rentalCard, /PMUrls\.rentalPath\(v\)/); assertions++;
  assert.doesNotMatch(rentalCard, /rental-detail\?id=/); assertions++;
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const homeRentalCard = home.slice(home.indexOf('function rentalCard'), home.indexOf('function loadRentalHighlights'));
  assert.match(homeRentalCard, /PMUrls\.rentalPath\(v\)/); assertions++;
  assert.doesNotMatch(homeRentalCard, /rental-detail\?id=/); assertions++;
  const detail = fs.readFileSync(path.join(ROOT, 'detail.html'), 'utf8');
  const relatedCard = detail.slice(detail.indexOf('function simCard'), detail.indexOf('function setNoIndex'));
  assert.match(relatedCard, /PMSchema\.listingPath\(l\)/); assertions++;
  assert.doesNotMatch(relatedCard, /detail\?id=/); assertions++;

  return { assertions };
}

module.exports = { characterizeWebP1 };
