// Generates static, crawlable category and city landing pages at
// c/<slug>.html (served extensionless as /c/<slug>) so head search terms like
// "cars for sale in Zimbabwe" or "fashion in Harare" have a real page to rank.
// /browse?cat=X can't do this: it ships identical HTML for every filter.
//
// Reads the already pre-rendered listing pages (l/*.html, from prerender.js)
// so it needs no database access. Run after prerender.js:
//   node tools/generate-landing-pages.js
const fs = require('fs');
const path = require('path');

const SITE = 'https://pamarketzw.com';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'c');
const GRID_LIMIT = 48;
const CITY_MIN_LISTINGS = 3;
const CITIES = ['Harare', 'Bulawayo'];

const CATEGORIES = [
  {
    key: 'vehicles', label: 'Vehicles', icon: 'directions_car', slug: 'cars-for-sale',
    h1: 'Cars for Sale', noun: 'cars', title: 'Cars for Sale',
    intro: 'Browse used and new cars, pickups, SUVs, spares and accessories for sale from private sellers and small dealers, priced in USD or ZiG.',
    tips: ['Inspect the car in daylight at a safe public place and test-drive it before paying.', 'Check the registration book, chassis and engine numbers match, and confirm ZINARA licence and insurance are current.', 'Popular models include the Honda Fit, Toyota Wish, Nissan Note, Mazda Demio, Nissan X-Trail and Ford Ranger.'],
  },
  {
    key: 'fashion', label: 'Fashion', icon: 'checkroom', slug: 'fashion-clothing',
    h1: 'Fashion & Clothing for Sale', noun: 'fashion items', title: 'Fashion & Clothing for Sale',
    intro: "Shop women's and men's clothing, dresses, shoes, bags, bales and beauty products from local sellers and boutiques.",
    tips: ['Ask the seller for exact measurements and extra photos of labels and any wear.', 'Bulk bales are common; confirm the grade and mix before buying.', 'Meet in a busy public place, or use a trusted courier for deliveries between cities.'],
  },
  {
    key: 'electronics', label: 'Electronics', icon: 'devices', slug: 'phones-electronics',
    h1: 'Phones, Laptops & Electronics for Sale', noun: 'phones and electronics', title: 'Phones & Electronics for Sale',
    intro: 'Find smartphones, laptops, TVs, speakers, solar gear and accessories for sale, new and second-hand.',
    tips: ['Power the device on and test the screen, battery, camera and charging port before paying.', 'For phones, check the IMEI and that the device is not iCloud or Google locked.', 'Ask for the original receipt or box where possible.'],
  },
  {
    key: 'property', label: 'Property', icon: 'home_work', slug: 'property',
    h1: 'Houses, Rooms & Property', noun: 'property listings', title: 'Houses, Rooms & Property for Sale and Rent',
    intro: 'Find houses, flats, rooms, stands and commercial property for sale or rent.',
    tips: ['Always view the property in person before paying any deposit.', 'For sales, verify the title deed with the Deeds Office and the seller\'s ID.', 'Never pay "viewing fees" to people you have not met.'],
  },
  {
    key: 'furniture', label: 'Furniture', icon: 'chair', slug: 'furniture-for-sale',
    h1: 'Furniture & Home Items for Sale', noun: 'furniture and home items', title: 'Furniture & Home Items for Sale',
    intro: 'Buy sofas, beds, tables, wardrobes, kitchen items and home decor from sellers near you.',
    tips: ['Check measurements against your space and doorways before buying.', 'Inspect for damage, pests and loose joints in person.', 'Agree on who handles transport before you pay.'],
  },
  {
    key: 'services', label: 'Services', icon: 'construction', slug: 'services',
    h1: 'Local Services', noun: 'services', title: 'Local Services & Tradespeople',
    intro: 'Hire builders, plumbers, electricians, cleaners, tutors, designers and other service providers.',
    tips: ['Ask for photos of previous work and references.', 'Agree on the price and scope in writing before work starts.', 'Avoid paying the full amount upfront for large jobs.'],
  },
  {
    key: 'kids', label: 'Baby & Kids', icon: 'child_care', slug: 'baby-kids',
    h1: 'Baby & Kids Items for Sale', noun: 'baby and kids items', title: 'Baby & Kids Items for Sale',
    intro: "Shop children's clothing, prams, car seats, toys and school supplies.",
    tips: ['Check car seats and cots for damage and missing parts.', 'Ask about age ranges and sizes before buying clothing.', 'Wash second-hand items before use.'],
  },
  {
    key: 'pets', label: 'Pets', icon: 'pets', slug: 'pets-for-sale',
    h1: 'Pets & Animals for Sale', noun: 'pets', title: 'Pets & Animals for Sale',
    intro: 'Find puppies, kittens, birds and other animals, plus pet food and accessories.',
    tips: ['Visit the animal in person and see it with its mother where possible.', 'Ask for vaccination and deworming records.', 'Never pay a deposit for an animal you have not seen.'],
  },
  {
    key: 'agriculture', label: 'Agriculture', icon: 'eco', slug: 'agriculture',
    h1: 'Agriculture, Livestock & Farm Equipment', noun: 'agriculture listings', title: 'Agriculture, Livestock & Farm Equipment for Sale',
    intro: 'Buy livestock, seed, fertiliser, produce, tractors and farm equipment.',
    tips: ['Inspect livestock and equipment in person before paying.', 'Confirm movement permits for livestock.', 'Check inputs are within their expiry dates.'],
  },
];

const CATEGORY_BY_LABEL = {
  Vehicles: 'vehicles', Fashion: 'fashion', Electronics: 'electronics', Property: 'property',
  Furniture: 'furniture', Services: 'services', 'Baby & Kids': 'kids', Kids: 'kids',
  'Kids & Baby': 'kids', Pets: 'pets', Agriculture: 'agriculture',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function jsonLd(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>';
}

function formatPrice(price, currency) {
  if (price == null || price === '' || Number(price) === 0) return 'Contact seller';
  const n = Number(price);
  const amount = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return currency === 'ZWG' || currency === 'ZiG' ? 'ZiG ' + amount : '$' + amount;
}

function loadListings() {
  const dir = path.join(ROOT, 'l');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) continue;
    let data;
    try { data = JSON.parse(m[1]); } catch (_) { continue; }
    if (data['@type'] === 'JobPosting') continue;
    const key = CATEGORY_BY_LABEL[data.category];
    if (!key) continue;
    const loc = html.match(/class="d-meta"><span>([^<]*)<\/span>/);
    const parts = loc ? decodeEntities(loc[1]).split(',').map((s) => s.trim()).filter(Boolean) : [];
    const offer = data.offers || {};
    const images = Array.isArray(data.image) ? data.image : data.image ? [data.image] : [];
    out.push({
      category: key,
      name: data.name || 'Listing',
      url: SITE + '/l/' + file.replace(/\.html$/, ''),
      path: 'l/' + file.replace(/\.html$/, ''),
      image: images[0] || '',
      price: offer.price,
      currency: offer.priceCurrency,
      date: offer.validFrom || '',
      suburb: parts[0] || '',
      province: parts[parts.length - 1] || '',
      place: parts.length > 1 ? parts[0] + ', ' + parts[parts.length - 1] : parts[0] || 'Zimbabwe',
    });
  }
  out.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.path.localeCompare(b.path));
  return out;
}

function pageSlug(cat, city) {
  return cat.slug + '-' + (city ? city.toLowerCase() : 'zimbabwe');
}

function readPartial(name) {
  return fs.readFileSync(path.join(ROOT, 'partials', name + '.html'), 'utf8').replace(/\s+$/, '');
}

function card(item, where, index) {
  const img = item.image
    ? '<img src="' + esc(item.image) + '" alt="' + esc(item.name + ' for sale in ' + item.place + ', ' + where) + '" loading="' + (index < 8 ? 'eager' : 'lazy') + '" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform">'
    : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined text-[40px]">image</span></div>';
  return '<a href="' + esc(item.path) + '" class="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">' +
    '<div class="aspect-[4/3] overflow-hidden bg-surface-container">' + img + '</div>' +
    '<div class="p-3"><h3 class="font-bold text-on-surface truncate">' + esc(item.name) + '</h3>' +
    '<p class="font-bold text-primary">' + esc(formatPrice(item.price, item.currency)) + '</p>' +
    '<p class="text-label-sm text-on-surface-variant truncate">' + esc(item.place) + '</p></div></a>';
}

function chip(href, text) {
  return '<a class="bg-surface-container-lowest px-3 py-1.5 rounded text-body-sm hover:shadow transition-shadow" href="' + esc(href) + '">' + esc(text) + '</a>';
}

function buildPage(page, allPages) {
  const { cat, city, items } = page;
  const where = city || 'Zimbabwe';
  const heading = cat.h1 + ' in ' + where;
  const title = cat.title + ' in ' + where + ' | PaMarket';
  const canonical = SITE + '/c/' + page.slug;
  const count = items.length;
  const suburbs = [...new Set(items.map((i) => i.suburb).filter((s) => s && s !== city && s.length > 3 && !/^anywhere/i.test(s)))].slice(0, 6);
  const provinces = [...new Set(items.map((i) => i.province).filter(Boolean))];
  const prices = items.map((i) => Number(i.price)).filter((n) => n > 0);
  // Skip the range when placeholder prices ($1, $10) would make it misleading.
  const priceRange = prices.length > 1 && Math.min(...prices) >= Math.max(...prices) / 100
    ? ' Prices currently range from $' + Math.min(...prices).toLocaleString('en-US') + ' to $' + Math.max(...prices).toLocaleString('en-US') + '.'
    : '';
  const description = (count
    ? count + ' ' + cat.noun + ' for sale in ' + where + ' on PaMarket.'
    : cat.title + ' in ' + where + ' on PaMarket.') +
    ' ' + cat.intro.replace(/\.$/, '') + '. Free to post, no commission.';
  const locationLine = city
    ? (suburbs.length ? ' Current listings include ' + suburbs.join(', ') + ' and other parts of ' + city + '.' : '')
    : (provinces.length ? ' Listings currently come from ' + provinces.join(', ') + '.' : '');

  const browseHref = 'browse.html?cat=' + cat.key + (city ? '&province=' + encodeURIComponent(city) : '');
  const grid = count
    ? items.slice(0, GRID_LIMIT).map((i, n) => card(i, where, n)).join('\n')
    : '<p class="col-span-full text-on-surface-variant">No ' + esc(cat.noun) + ' are listed in ' + esc(where) + ' right now. <a class="text-secondary font-semibold hover:underline" href="post-ad.html">Post one free</a> or <a class="text-secondary font-semibold hover:underline" href="browse.html">browse all listings</a>.</p>';

  const sameCatOtherPlaces = allPages.filter((p) => p.cat === cat && p !== page);
  const otherCats = allPages.filter((p) => p.cat !== cat && p.city === city && p.items.length);
  const faqs = [
    { q: 'Where can I find ' + cat.noun + ' for sale in ' + where + '?', a: 'PaMarket lists ' + cat.noun + ' from private sellers and local businesses in ' + where + '. Browse the listings on this page, then message the seller directly in the app or on WhatsApp.' },
    { q: 'Is it free to sell ' + cat.noun + ' on PaMarket?', a: 'Yes. Posting an ad on PaMarket is free, with no listing fee and no commission when you sell.' },
    { q: 'How do I buy safely in ' + where + '?', a: cat.tips.join(' ') },
  ];

  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: heading, url: canonical, description, inLanguage: 'en-ZW',
      isPartOf: { '@type': 'WebSite', name: 'PaMarket', url: SITE + '/' },
      about: { '@type': 'Thing', name: cat.title },
      spatialCoverage: city ? { '@type': 'City', name: city, containedInPlace: { '@type': 'Country', name: 'Zimbabwe' } } : { '@type': 'Country', name: 'Zimbabwe' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: cat.title + ' in Zimbabwe', item: SITE + '/c/' + pageSlug(cat, null) },
    ].concat(city ? [{ '@type': 'ListItem', position: 3, name: cat.title + ' in ' + city, item: canonical }] : []) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  if (count) {
    ld.push({ '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: Math.min(count, GRID_LIMIT),
      itemListElement: items.slice(0, GRID_LIMIT).map((i, n) => ({ '@type': 'ListItem', position: n + 1, url: i.url, name: i.name })) });
  }

  const ogImage = (items.find((i) => i.image) || {}).image || SITE + '/img/pamarket-social-share.png';
  const breadcrumb = '<a href="index.html" class="hover:text-primary">Home</a><span>/</span>' +
    (city ? '<a href="c/' + pageSlug(cat, null) + '" class="hover:text-primary">' + esc(cat.title) + ' in Zimbabwe</a><span>/</span><span>' + esc(city) + '</span>'
      : '<span>' + esc(cat.title) + ' in Zimbabwe</span>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<base href="${SITE}/">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${count ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, follow'}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PaMarket">
<meta property="og:locale" content="en_ZW">
<meta property="og:title" content="${esc(heading + ' | PaMarket')}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(heading + ' | PaMarket')}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="geo.region" content="ZW${city === 'Harare' ? '-HA' : city === 'Bulawayo' ? '-BU' : ''}">
<meta name="geo.placename" content="${esc(city ? city + ', Zimbabwe' : 'Zimbabwe')}">
<link rel="icon" href="img/icon-192.png" type="image/png">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="img/icon-192.png">
<link rel="manifest" href="manifest.json">
${ld.map(jsonLd).join('\n')}
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@100..900&family=Manrope:wght@100..900&display=swap" rel="stylesheet"/>
<style>html,body{margin:0;padding:0;}::-webkit-scrollbar{display:none;}</style>
<script src="https://cdn.tailwindcss.com"></script>
<script src="js/tailwind-config.js"></script>
</head>
<body class="bg-surface-container font-body-md text-on-surface antialiased min-h-screen"><!-- HEADER:START -->
${readPartial('header')}
<!-- HEADER:END -->
<main class="w-full pt-[148px] bg-surface-container min-h-screen">
<section class="w-full bg-surface-container-lowest shadow-sm">
<div class="max-w-[1200px] mx-auto px-margin md:px-margin-desktop py-space-sm">
<nav aria-label="Breadcrumb" class="text-body-sm text-on-surface-variant flex items-center gap-1.5 flex-wrap">${breadcrumb}</nav>
</div>
</section>
<section class="w-full py-space-xl">
<div class="max-w-[1000px] mx-auto px-margin md:px-margin-desktop text-center flex flex-col items-center gap-space-sm">
<h1 class="font-headline-lg text-headline-lg font-bold text-on-surface">${esc(heading)}</h1>
<p class="text-body-lg text-on-surface-variant max-w-2xl">${count ? '<strong>' + count + ' ' + esc(cat.noun) + '</strong> listed in ' + esc(where) + ' right now. ' : ''}${esc(cat.intro)}${esc(priceRange)}${esc(locationLine)}</p>
<div class="flex flex-wrap items-center justify-center gap-3 pt-2">
<a href="${esc(browseHref)}" class="bg-secondary text-on-secondary px-5 py-3 rounded font-bold shadow-sm flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">tune</span>Filter by price &amp; location</a>
<a href="post-ad.html" class="bg-primary text-on-primary px-5 py-3 rounded font-bold shadow-sm flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">add_circle</span>Sell yours free</a>
</div>
</div>
</section>
<section class="max-w-[1200px] mx-auto px-margin md:px-margin-desktop pb-space-xl">
<h2 class="font-headline-sm text-headline-sm font-bold text-on-surface mb-space-base">Latest ${esc(cat.noun)} in ${esc(where)}</h2>
<div class="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
${grid}
</div>
${count > GRID_LIMIT ? '<p class="mt-space-base text-center"><a class="text-secondary font-semibold hover:underline" href="' + esc(browseHref) + '">See all ' + count + ' ' + esc(cat.noun) + ' &rarr;</a></p>' : ''}
</section>
${sameCatOtherPlaces.length || otherCats.length ? `<section class="bg-surface-container-lowest py-space-xl">
<div class="max-w-[1100px] mx-auto px-margin md:px-margin-desktop grid grid-cols-1 md:grid-cols-2 gap-space-lg">
${sameCatOtherPlaces.length ? '<div><h2 class="font-bold text-on-surface mb-3">' + esc(cat.title) + ' by location</h2><div class="flex flex-wrap gap-2">' + sameCatOtherPlaces.map((p) => chip('c/' + p.slug, cat.title + ' in ' + (p.city || 'Zimbabwe'))).join('') + '</div></div>' : ''}
${otherCats.length ? '<div><h2 class="font-bold text-on-surface mb-3">More in ' + esc(where) + '</h2><div class="flex flex-wrap gap-2">' + otherCats.map((p) => chip('c/' + p.slug, p.cat.title + ' in ' + where)).join('') + '</div></div>' : ''}
</div>
</section>` : ''}
<section class="max-w-[900px] mx-auto px-margin md:px-margin-desktop py-space-xl">
<h2 class="font-headline-sm text-headline-sm font-bold text-on-surface mb-space-base">Frequently asked questions</h2>
<div class="flex flex-col gap-space-base">
${faqs.map((f) => '<div><h3 class="font-bold text-on-surface">' + esc(f.q) + '</h3><p class="text-on-surface-variant">' + esc(f.a) + '</p></div>').join('\n')}
</div>
<p class="mt-space-base text-body-sm text-on-surface-variant">Read our <a class="text-secondary font-semibold hover:underline" href="safety.html">safety guidelines</a> before meeting a buyer or seller.</p>
</section>
</main>
<!-- FOOTER:START -->
${readPartial('footer')}
<!-- FOOTER:END -->
<script>
window.doHeaderSearch = function () {
  var input = document.getElementById('headerSearchInput');
  var q = input && input.value ? input.value.trim() : '';
  window.location.href = '${SITE}/browse' + (q ? '?q=' + encodeURIComponent(q) : '');
};
window.setCurrency = function (cur) {
  var on = 'px-2 py-1 rounded bg-primary text-on-primary font-bold shadow-sm';
  var off = 'px-2 py-1 rounded text-on-surface-variant hover:text-on-surface transition-colors font-medium';
  var usd = document.getElementById('currencyUsdBtn'), zig = document.getElementById('currencyZigBtn');
  if (usd && zig) { usd.className = cur === 'USD' ? on : off; zig.className = cur === 'ZiG' ? on : off; }
};
</script>
</body>
</html>
`;
}

function planPages(listings) {
  const pages = [];
  for (const cat of CATEGORIES) {
    const items = listings.filter((l) => l.category === cat.key);
    pages.push({ cat, city: null, slug: pageSlug(cat, null), items });
    for (const city of CITIES) {
      const cityItems = items.filter((l) => l.province === city);
      if (cityItems.length >= CITY_MIN_LISTINGS && cityItems.length < items.length) {
        pages.push({ cat, city, slug: pageSlug(cat, city), items: cityItems });
      }
      // When every listing is in one city, the national page already covers it;
      // a second, identical page would be duplicate content.
    }
  }
  return pages;
}

function main() {
  const listings = loadListings();
  const pages = planPages(listings);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const page of pages) fs.writeFileSync(path.join(OUT, page.slug + '.html'), buildPage(page, pages), 'utf8');
  console.log('landing pages: ' + pages.length + ' written from ' + listings.length + ' listings');
  for (const p of pages) console.log('  /c/' + p.slug + ' (' + p.items.length + ')');
}

if (require.main === module) main();
module.exports = { CATEGORIES, pageSlug, planPages, loadListings };
