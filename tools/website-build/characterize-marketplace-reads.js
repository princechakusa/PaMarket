'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./file-utils');
const { assembleHtml } = require('./shell');

function response(data, count) {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: name => name.toLowerCase() === 'content-range' ? (count || null) : null },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

async function characterizeMarketplaceReads() {
  const requests = [];
  const listing = { id: 'listing-1', title: 'Phone', photos: ['phone.jpg'], price: 20 };
  const profile = { id: 'seller-1', full_name: 'Public Seller', phone: null };
  const business = { id: 'business-1', name: 'Public Shop', status: 'active' };
  const rental = { id: 'rental-1', model: 'Range Rover', rental_vehicle_media: [{ url: 'car.jpg' }] };
  const featured = { id: 'featured-1', title: 'Featured Phone', featured_until: '2099-01-01T00:00:00Z' };
  const context = {
    console,
    Date,
    Promise,
    URLSearchParams,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    PMSupabaseClient: { get: () => ({ url: 'https://shared.example.supabase.co', publishableKey: 'shared-key' }) },
    PMSession: { getSession: () => ({ access_token: 'user-token', user: { id: 'seller-1' } }) },
  };
  context.fetch = (url, options) => {
    requests.push({ url, options: options || {} });
    if (url.includes('error-1')) return Promise.reject(new Error('network failure'));
    if ((options || {}).headers && (options || {}).headers.Prefer === 'count=exact') return response([], '0-0/41');
    if (url.includes('missing-1')) return response([]);
    if (url.includes('/profiles_public?')) return response([profile]);
    if (url.includes('/businesses?id=')) return response([business]);
    if (url.includes('/businesses?')) return response([business]);
    if (url.includes('/rental_vehicle_listings?id=')) return response([rental]);
    if (url.includes('/rental_vehicle_listings?')) return response([rental]);
    if (url.includes('/listings?id=eq.listing-1')) return response([listing]);
    if (url.includes('featured_until=gt.')) return response([featured]);
    if (url.includes('/listings?')) return response([listing]);
    return response([]);
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  const serviceFiles = ['service-transport.js', 'listings.js', 'profiles.js', 'businesses.js', 'rentals.js'];
  for (const file of serviceFiles) {
    const absolute = path.join(ROOT, 'js', 'services', file);
    if (fs.existsSync(absolute)) vm.runInContext(fs.readFileSync(absolute, 'utf8'), context, { filename: file });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'marketplace-data.js'), 'utf8'), context, { filename: 'marketplace-data.js' });

  let assertions = 0;
  assert.ok(requests.length === 0); assertions++;
  assert.deepEqual(await context.PM.fetchListings({ category: 'electronics', city: 'Harare', limit: 10, offset: 20, order: 'price.asc' }), [listing]); assertions++;
  assert.match(requests.at(-1).url, /^https:\/\/shared\.example\.supabase\.co\/rest\/v1\//); assertions++;
  assert.equal(requests.at(-1).options.headers.apikey, 'shared-key'); assertions++;
  assert.match(requests.at(-1).url, /status=eq\.active.*expires_at=gt\..*category=eq\.electronics.*city=ilike\.\*Harare\*.*order=price\.asc.*limit=10.*offset=20/); assertions++;
  assert.match(requests.at(-1).url, /select=id,title,price,currency,category,province,city,suburb,photos,created_at,boost,featured_until,expires_at/); assertions++;
  assert.deepEqual(await context.PM.fetchListingById('listing-1'), listing); assertions++;
  assert.match(requests.at(-1).url, /id=eq\.listing-1.*status=eq\.active.*expires_at=gt\..*&select=\*/); assertions++;
  assert.equal(await context.PM.fetchListingById('missing-1'), null); assertions++;
  await assert.rejects(context.PM.fetchListingById('error-1'), /network failure/); assertions++;
  assert.deepEqual(await context.PM.fetchSimilarListings('electronics', 'listing-2', 4), [listing]); assertions++;
  assert.match(requests.at(-1).url, /category=eq\.electronics.*id=neq\.listing-2.*order=created_at\.desc&limit=4/); assertions++;
  assert.equal(await context.PM.fetchListingCount('electronics'), 41); assertions++;
  assert.match(requests.at(-1).url, /listings\?status=eq\.active.*expires_at=gt\..*select=id.*category=eq\.electronics/); assertions++;
  assert.equal(requests.at(-1).options.method, undefined); assertions++;
  assert.equal(requests.at(-1).options.headers.Prefer, 'count=exact'); assertions++;
  assert.equal(requests.at(-1).options.headers.Range, '0-0'); assertions++;
  const featuredStart = requests.length;
  assert.deepEqual(await context.PM.fetchListings({ featuredFirst: true, limit: 2 }), [featured, listing]); assertions++;
  assert.equal(requests.length, featuredStart + 2); assertions++;
  assert.match(requests[featuredStart].url, /order=created_at\.desc&limit=2/); assertions++;
  assert.match(requests[featuredStart + 1].url, /featured_until=gt\..*order=featured_until\.desc&limit=2/); assertions++;

  assert.deepEqual(await context.PM.fetchProfileById('seller-1'), profile); assertions++;
  assert.match(requests.at(-1).url, /profiles_public\?id=eq\.seller-1&select=\*/); assertions++;
  assert.equal((await context.PM.fetchProfileById('seller-1')).phone, null); assertions++;
  assert.equal(await context.PM.fetchProfileById('missing-1'), null); assertions++;
  await assert.rejects(context.PM.fetchProfileById('error-1'), /network failure/); assertions++;

  assert.deepEqual(await context.PM.fetchBusinesses({ q: 'Shop', limit: 8, offset: 4 }), [business]); assertions++;
  assert.match(requests.at(-1).url, /businesses\?status=eq\.active.*name=ilike\.\*Shop\*.*order=created_at\.desc.*limit=8.*offset=4/); assertions++;
  assert.deepEqual(await context.PM.fetchBusinessById('business-1'), business); assertions++;
  assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer user-token'); assertions++;
  assert.equal(await context.PM.fetchBusinessById('missing-1'), null); assertions++;
  await assert.rejects(context.PM.fetchBusinessById('error-1'), /network failure/); assertions++;
  context.PMSession.getSession = () => null;
  assert.deepEqual(await context.PM.fetchBusinessById('business-1'), business); assertions++;
  assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer shared-key'); assertions++;

  assert.deepEqual(await context.PM.fetchRentalListings({ city: 'Harare', limit: 6, offset: 3 }), [rental]); assertions++;
  assert.match(requests.at(-1).url, /status=eq\.active.*admin_status=eq\.approved.*deleted_at=is\.null.*rental_locations\.city=ilike\.\*Harare\*.*limit=6.*offset=3/); assertions++;
  assert.deepEqual(await context.PM.fetchRentalListingById('rental-1'), rental); assertions++;
  assert.match(requests.at(-1).url, /rental_vehicle_listings\?id=eq\.rental-1.*admin_status=eq\.approved.*select=\*/); assertions++;
  assert.match(requests.at(-1).url, /rental_brands\(label\),rental_categories\(label\),rental_locations\(city,province\),rental_vehicle_media\(url,is_cover,sort_order\),rental_vehicle_specs\(\*\),rental_vehicle_features\(feature\),rental_companies\(business_id,trading_name,rental_phone,rental_whatsapp,rental_email,year_established,deposit_policy,driver_available,cross_border,insurance_included,min_rental_days,avg_rating,review_count,businesses\(owner_user_id\)\)/); assertions++;
  assert.equal(await context.PM.fetchRentalListingById('missing-1'), null); assertions++;
  await assert.rejects(context.PM.fetchRentalListingById('error-1'), /network failure/); assertions++;

  const orderedPages = ['index.html', 'browse.html', 'profile.html', 'business.html', 'rentals.html', 'rental-detail.html', 'detail.html'];
  for (const page of orderedPages) {
    const source = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const built = assembleHtml(source, path.join(ROOT, page));
    const configAt = built.indexOf('js/supabase-config.js');
    const clientAt = built.indexOf('js/core/supabase-client.js');
    const transportAt = built.indexOf('js/services/service-transport.js');
    const listingsAt = built.indexOf('js/services/listings.js');
    const marketplaceAt = built.indexOf('js/marketplace-data.js');
    assert.ok(configAt >= 0 && configAt < clientAt && clientAt < transportAt && transportAt < listingsAt && listingsAt < marketplaceAt, page + ' service script order'); assertions++;
    assert.equal(built.indexOf('js/supabase-config.js', configAt + 1), -1, page + ' duplicate config'); assertions++;
    assert.equal(built.indexOf('js/core/supabase-client.js', clientAt + 1), -1, page + ' duplicate shared client'); assertions++;
  }

  return { assertions, requestCount: requests.length, privacyCoverage: { mock: 'public-view shape and null phone only', live: 'database email/phone authority verified separately' } };
}

module.exports = { characterizeMarketplaceReads };
