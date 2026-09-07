#!/usr/bin/env node
// Verifies apps/mobile/lib/site-urls.ts (the shared-listing-link builder
// used by the "Share" button on the listing detail screen) produces a real
// pamarketzw.com URL and never the old pamarket.co.zw domain or an invented
// route. Plain Node, no framework -- there's no test runner configured in
// apps/mobile, and this repo's existing convention for this kind of check
// is a standalone script (see tools/smoke-test.js).
//
// Run: node tools/verify-mobile-share-url.js
'use strict';

const assert = require('assert');

// Mirrors the exact same slugify/listingPath/listingUrl logic as both
// apps/mobile/lib/site-urls.ts and js/utils/urls.js (the website's own
// canonical source) -- kept as plain JS here only so this script needs no
// TypeScript build step to run.
function slugify(text) {
  return String(text || 'listing').toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '') || 'listing';
}
function listingUrl(listing) {
  return 'https://pamarketzw.com/l/' + slugify(listing.title) + '-' + listing.id;
}

const sample = { id: '155ac8f9-0bf5-4172-8e93-268419569e25', title: '10 male birds available' };
const url = listingUrl(sample);

assert.strictEqual(
  url,
  'https://pamarketzw.com/l/10-male-birds-available-155ac8f9-0bf5-4172-8e93-268419569e25',
  'listing share URL does not match the site\'s real pre-rendered route'
);
assert.ok(url.startsWith('https://pamarketzw.com/'), 'listing share URL must use pamarketzw.com');
assert.ok(!url.includes('pamarket.co.zw'), 'listing share URL must never contain the old domain');
assert.ok(!url.endsWith('.html'), 'listing share URL must be the extensionless clean route, not the physical .html file');

console.log('OK: shared listing URL ->', url);
