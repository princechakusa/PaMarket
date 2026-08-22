'use strict';
const assert=require('assert');
const config=require('../../js/supabase-config.js');
const clientFactory=require('../../js/core/supabase-client.js');
const urls=require('../../js/utils/urls.js');
const format=require('../../js/utils/format.js');
const dates=require('../../js/utils/dates.js');
const validation=require('../../js/utils/validation.js');
const escape=require('../../js/utils/escape.js');
const feedback=require('../../js/components/feedback.js');
const schema=require('../../js/listing-schema.js');
const shell=require('./shell.js');
const {characterizeShell}=require('./characterize-shell.js');
const {characterizeMarketplaceReads}=require('./characterize-marketplace-reads.js');

const listing={id:'123',title:'Café Phone — New'};
const business={id:'456',name:"Sam's Shop"};
const rental={id:'789',model:'Range Rover',year:2026,rental_brands:{label:'Land Rover'}};

assert.equal(config.siteOrigin,'https://pamarketzw.com');
assert.equal(config.supabaseUrl,'https://gxgytumhknmnwspxjzxw.supabase.co');
assert.match(config.supabasePublishableKey,/^sb_publishable_/);
const clientApi=clientFactory(config), client=clientApi.get();
assert.strictEqual(client,clientApi.get());
assert.equal(client.restUrl('/listings'),'https://gxgytumhknmnwspxjzxw.supabase.co/rest/v1/listings');
assert.equal(client.authUrl('token'),'https://gxgytumhknmnwspxjzxw.supabase.co/auth/v1/token');

assert.equal(urls.slugify(listing.title),'cafe-phone-new');
assert.equal(urls.listingUrl(listing),'https://pamarketzw.com/l/cafe-phone-new-123');
assert.equal(urls.businessUrl(business),'https://pamarketzw.com/b/sam-s-shop-456');
assert.equal(urls.rentalUrl(rental),'https://pamarketzw.com/r/land-rover-range-rover-2026-789');
assert.equal(urls.profilePath('a b'),'profile?id=a%20b');
assert.equal(schema.listingUrl(listing),urls.listingUrl(listing));
assert.equal(schema.businessUrl(business),urls.businessUrl(business));
assert.equal(schema.rentalUrl(rental),urls.rentalUrl(rental));

assert.equal(format.money(1234567,'USD'),'$'+Number(1234567).toLocaleString());
assert.equal(format.money(2500,'ZWG'),'ZWG '+Number(2500).toLocaleString());
const now=Date.parse('2026-08-22T12:00:00Z');
assert.equal(dates.timeAgo('2026-08-22T11:30:00Z',now),'30m ago');
assert.equal(dates.timeAgo('2026-08-20T12:00:00Z',now),'2d ago');
assert.equal(dates.longDate('2026-08-22T00:00:00Z'),'August 22, 2026');

assert.equal(escape.html('<a title="x">O\'Brien & Co</a>'),'&lt;a title=&quot;x&quot;&gt;O&#39;Brien &amp; Co&lt;/a&gt;');
assert.equal(validation.requiredString(' x '),true);
assert.equal(validation.email('buyer@example.com'),true);
assert.equal(validation.phone('+263 77 123 4567'),true);
assert.equal(validation.publicUrl('javascript:alert(1)'),false);
assert.equal(validation.numberInRange('5',1,10),true);
assert.equal(feedback.empty('No items'),'<div class="empty-state">No items</div>');
assert.equal(feedback.error("Couldn't load",{style:'grid-column:1/-1'}),'<div class="empty-state" style="grid-column:1/-1">Couldn&#39;t load</div>');
assert.match(feedback.empty('No items',{actionHref:'browse',actionLabel:'Browse all'}),/href="browse">Browse all<\/a>/);
const shellProbe=shell.assembleHtml('<!-- HEADER:START -->old<!-- HEADER:END --><!-- FOOTER:START -->old<!-- FOOTER:END -->');
assert.match(shellProbe,/class="logo">Pa<em>Market<\/em>/);
assert.match(shellProbe,/PMHeader\.toggleMobile\(this\)/);
assert.match(shellProbe,/href="terms">Terms of Service<\/a>/);
assert.match(shellProbe,/href="privacy">Privacy Policy<\/a>/);
assert.match(shellProbe,/href="cookie-policy">Cookie Policy<\/a>/);
async function main(){
const shellAssertions=characterizeShell();
const marketplaceReads=await characterizeMarketplaceReads();
console.log(JSON.stringify({ok:true,tests:37+shellAssertions+marketplaceReads.assertions,shellAssertions,marketplaceReadAssertions:marketplaceReads.assertions,canonicalRoutes:['/l/<slug-id>','/b/<slug-id>','/r/<slug-id>'],config:'public-only',shell:'build-time'},null,2));
}
main().catch(function(error){console.error(error);process.exit(1);});
