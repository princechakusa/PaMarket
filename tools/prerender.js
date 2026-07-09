// Pre-renders static, crawlable HTML pages for active listings and jobs so that
// non-JS crawlers (Google, GPTBot, ClaudeBot, PerplexityBot) get real content +
// baked JSON-LD instead of the client-rendered shell at /detail?id=X.
//
// Output: l/<slug>-<id>.html (one file per active listing). Runs in CI inside
// the Pages deploy (see .github/workflows/pages.yml) so the files are a build
// artifact, never committed to the repo, and refresh on every deploy.
//
// Run locally:  node tools/prerender.js            (writes ./l)
//               PRERENDER_OUT=/tmp/l PRERENDER_LIMIT=5 node tools/prerender.js
//               PRERENDER_FIXTURE=tools/_fixtures.json node tools/prerender.js  (offline test)
const fs = require('fs');
const path = require('path');
const PMSchema = require('../js/listing-schema.js');

const SITE = 'https://pamarketzw.com';
const ROOT = path.join(__dirname, '..');
const OUT = process.env.PRERENDER_OUT || path.join(ROOT, 'l');
const LIMIT = process.env.PRERENDER_LIMIT ? parseInt(process.env.PRERENDER_LIMIT, 10) : 0;

function loadSupabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  }
  const src = fs.readFileSync(path.join(ROOT, 'js', 'supabase-config.js'), 'utf8');
  return { url: src.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1] };
}

async function fetchActiveListings(cfg) {
  const headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  const pageSize = 1000; let offset = 0; const rows = [];
  const select = 'id,title,description,price,currency,category,province,city,suburb,photos,seller_id,seller_name,seller_phone,business_id,attributes,condition,views,created_at';
  for (;;) {
    const url = cfg.url + '/rest/v1/listings?status=eq.active&order=created_at.desc&select=' + select + '&limit=' + pageSize + '&offset=' + offset;
    const res = await fetch(url, { headers });
    if (!res.ok) { console.warn('prerender: listings fetch ' + res.status + ' — ' + (await res.text()).slice(0, 160)); return rows; }
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    if (LIMIT && rows.length >= LIMIT) break;
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

// --- rendering helpers -------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function money(n, c) {
  n = Number(n) || 0;
  return (c === 'ZWG' || c === 'ZiG' ? 'ZWG ' : '$') + n.toLocaleString('en-US');
}
function timeAgo(iso) {
  const d = new Date(iso); const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  return d.toISOString().slice(0, 10);
}

// Reuse detail.html's <style> block so static pages look identical to the app
// page, and the shared header/footer partials for consistent chrome.
function loadChrome() {
  const detail = fs.readFileSync(path.join(ROOT, 'detail.html'), 'utf8');
  const styleMatch = detail.match(/<style>([\s\S]*?)<\/style>/);
  const header = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8');
  const footer = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8');
  return { style: styleMatch ? styleMatch[1] : '', header: header, footer: footer };
}

function renderPage(l, chrome) {
  const url = PMSchema.listingUrl(l);
  const catLabel = PMSchema.catLabelOf(l);
  const loc = PMSchema.locOf(l);
  const photos = (l.photos && l.photos.length) ? l.photos : [];
  const isJob = l.category === 'jobs';
  const title = esc(l.title);
  const priceStr = isJob ? (l.price ? money(l.price, l.currency) + '/mo' : 'Salary negotiable') : money(l.price, l.currency);
  const pageTitle = l.title + ' — ' + priceStr + ' | PaMarket Zimbabwe';
  const desc = (l.description ? String(l.description).slice(0, 155) : (l.title + ' — ' + catLabel + ' in ' + loc + ' on PaMarket, Zimbabwe.'));
  const ogImg = photos[0] || (SITE + '/img/icon-512.png');

  // Escape "<" as < so a "</script>" inside any user string (title,
  // description) can't break out of the <script type="application/ld+json"> tag.
  const jsonld = function (o) { return JSON.stringify(o).replace(/</g, '\\u003c'); };
  const schema = jsonld(PMSchema.buildListingSchema(l));
  const breadcrumb = jsonld(PMSchema.buildBreadcrumb(l, url));

  // Gallery
  const mainImg = photos.length
    ? '<img src="' + esc(photos[0]) + '" alt="' + title + '">'
    : '<div class="gallery-main-ph">' + title + '</div>';
  const thumbs = photos.length > 1
    ? '<div class="gallery-thumbs">' + photos.map(function (p, i) { return '<div class="gallery-thumb' + (i === 0 ? ' on' : '') + '"><img src="' + esc(p) + '" alt="" loading="lazy"></div>'; }).join('') + '</div>'
    : '';

  // Seller card CTAs (seller_phone is already public on active listings)
  const profileUrl = l.seller_id ? ('profile?id=' + esc(l.seller_id)) : null;
  const phone = l.seller_phone ? String(l.seller_phone).replace(/[^\d+]/g, '') : '';
  const waHref = phone ? ('https://wa.me/' + phone.replace('+', '') + '?text=' + encodeURIComponent('Hi, I saw your listing "' + l.title + '" on PaMarket. Is it still available?')) : '';
  const waBtn = waHref ? '<a class="btn btn-whatsapp contact-btn" href="' + esc(waHref) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' : '';
  const profileBtn = profileUrl ? '<a class="btn btn-navy contact-btn" href="' + profileUrl + '">View Full Profile</a>' : '';

  const initials = esc((l.seller_name || 'Seller').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase());

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<base href="' + SITE + '/">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(pageTitle) + '</title>\n' +
    '<meta name="description" content="' + esc(desc) + '">\n' +
    '<link rel="canonical" href="' + url + '">\n' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">\n' +
    '<meta property="og:type" content="' + (isJob ? 'website' : 'product') + '">\n' +
    '<meta property="og:title" content="' + esc(pageTitle) + '">\n' +
    '<meta property="og:description" content="' + esc(desc) + '">\n' +
    '<meta property="og:image" content="' + esc(ogImg) + '">\n' +
    '<meta property="og:url" content="' + url + '">\n' +
    '<meta property="og:locale" content="en_ZW">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + esc(pageTitle) + '">\n' +
    '<meta name="twitter:description" content="' + esc(desc) + '">\n' +
    '<meta name="twitter:image" content="' + esc(ogImg) + '">\n' +
    '<meta name="geo.region" content="ZW">\n<meta name="geo.placename" content="Zimbabwe">\n' +
    '<link rel="icon" href="img/icon-192.png" type="image/png">\n' +
    '<link rel="stylesheet" href="css/site.css">\n' +
    '<style>' + chrome.style + '</style>\n' +
    '<script type="application/ld+json">' + schema + '</script>\n' +
    '<script type="application/ld+json">' + breadcrumb + '</script>\n' +
    '</head>\n<body>\n' +
    chrome.header + '\n' +
    '<div class="crumb"><a href="/">Home</a> / <a href="browse">Browse</a> / <a href="browse?cat=' + esc(l.category) + '">' + esc(catLabel) + '</a> / <span>' + title + '</span></div>\n' +
    '<div id="detailContent">\n' +
    '  <div class="detail-wrap">\n' +
    '    <div>\n' +
    '      <div class="gallery"><div class="gallery-main" id="galleryMain">' + mainImg + '</div>' + thumbs + '</div>\n' +
    '      <h1 class="d-title">' + title + '</h1>\n' +
    '      <div class="d-price">' + esc(priceStr) + '</div>\n' +
    '      <div class="d-meta">' +
          '<span>' + esc(loc) + '</span>' +
          '<span>Posted ' + esc(timeAgo(l.created_at)) + '</span>' +
          '<span style="background:#EEF2FF;color:var(--navy);padding:3px 10px;border-radius:20px;font-weight:700">' + esc(catLabel) + '</span>' +
        '</div>\n' +
    '      <div class="d-section"><h3>Description</h3><div class="d-desc">' + esc(l.description || 'No description provided.') + '</div></div>\n' +
    '    </div>\n' +
    '    <div class="sidebar">\n' +
    '      <div class="seller-card">\n' +
    '        <div class="seller-top"><div class="seller-avatar">' + initials + '</div><div><div class="seller-name">' + esc(l.seller_name || 'PaMarket Seller') + '</div><div class="seller-sub">View profile →</div></div></div>\n' +
             waBtn + '\n' + profileBtn + '\n' +
    '      </div>\n' +
    '      <div class="safety-card"><h4>Stay Safe</h4><ul><li>Meet in a public place during daylight hours</li><li>Never pay before seeing the item in person</li><li>Keep all conversations and payments inside PaMarket</li></ul></div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div id="unavailableState" class="state-msg" style="display:none">This listing is no longer available or is being reviewed.<br><br><a href="browse">Browse other listings</a></div>\n' +
    chrome.footer + '\n' +
    '<script>window.__LISTING_ID=' + JSON.stringify(String(l.id)) + ';</script>\n' +
    '<script src="js/supabase-config.js"></script>\n' +
    '<script src="js/marketplace-data.js"></script>\n' +
    '<script src="js/nav-dropdowns.js"></script>\n' +
    '<script>(function(){\n' +
    '  // Progressive enhancement: confirm the listing is still publicly active.\n' +
    '  // If it was moderated/sold/removed since this page was generated, hide the\n' +
    '  // content and switch to noindex so crawlers drop the stale page.\n' +
    '  try{ if(window.PM&&PM.fetchListingState){ PM.fetchListingState(window.__LISTING_ID).then(function(state){\n' +
    '    // FAIL OPEN: only hide/noindex on a DEFINITIVE backend hidden state.\n' +
    '    // "unavailable" is also the fallback when the RPC is missing or errors,\n' +
    '    // so never noindex on it — the page was generated for an active listing,\n' +
    '    // and the daily rebuild removes pages for listings that truly went away.\n' +
    '    if(state==="removed"||state==="review"||state==="sold"){\n' +
    '      var c=document.getElementById("detailContent"); if(c)c.style.display="none";\n' +
    '      var u=document.getElementById("unavailableState"); if(u)u.style.display="block";\n' +
    '      var m=document.querySelector("meta[name=robots]"); if(m)m.setAttribute("content","noindex, nofollow");\n' +
    '    }\n' +
    '  }).catch(function(){}); } }catch(e){}\n' +
    '})();</script>\n' +
    '</body>\n</html>\n';
}

async function main() {
  let listings;
  if (process.env.PRERENDER_FIXTURE) {
    listings = JSON.parse(fs.readFileSync(process.env.PRERENDER_FIXTURE, 'utf8'));
  } else {
    listings = await fetchActiveListings(loadSupabaseConfig());
  }
  const chrome = loadChrome();
  // Clean regen so pages for listings that are no longer active are removed
  // (the commit step then stages those deletions out of the deploy).
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;
  for (const l of listings) {
    if (!l || !l.id || !l.title) continue;
    const file = path.basename(PMSchema.listingPath(l)); // l/<slug>-<id>.html -> <slug>-<id>.html
    fs.writeFileSync(path.join(OUT, file), renderPage(l, chrome), 'utf8');
    n++;
  }
  console.log('prerender: wrote ' + n + ' static listing page(s) to ' + OUT);
}

main().catch(function (e) { console.error('prerender failed:', e); process.exit(1); });
