// Generates sitemap.xml for pamarketzw.com from the static pages list plus
// live, active listings pulled from Supabase. Run: node tools/generate-sitemap.js
// Requires SUPABASE_URL / SUPABASE_ANON_KEY env vars (or js/supabase-config.js locally).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PMSchema = require('../js/listing-schema.js');

const SITE = 'https://pamarketzw.com';

function loadSupabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  }
  const cfgPath = path.join(__dirname, '..', 'js', 'supabase-config.js');
  const src = fs.readFileSync(cfgPath, 'utf8');
  const url = src.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
  const key = src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1];
  return { url, key };
}

const STATIC_PAGES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/browse', changefreq: 'daily', priority: '0.9' },
  // /browse?cat=X, ?shops=1 and ?city=X were previously listed here as
  // separate indexable URLs, but browse.html serves byte-identical initial
  // HTML for all of them — title/description/canonical are only
  // differentiated client-side after JS reads location.search. The raw
  // <link rel="canonical"> browse.html ships already points every variant
  // back at plain /browse, so listing them separately in the sitemap
  // contradicted that signal. This is a static host with no per-request
  // server rendering, so making each variant a genuinely distinct crawlable
  // page would need real pre-rendering (like /l/<slug>.html already has for
  // listings) — a separate, larger project. Until then, /browse alone is the
  // one indexable hub; category/city are on-site filters, not separate SEO
  // targets.
  { loc: '/jobs', changefreq: 'daily', priority: '0.9' },
  { loc: '/rentals', changefreq: 'daily', priority: '0.8' },
  { loc: '/plans', changefreq: 'weekly', priority: '0.6' },
  { loc: '/advertise', changefreq: 'monthly', priority: '0.5' },
  { loc: '/post-ad', changefreq: 'monthly', priority: '0.6' },
  { loc: '/about', changefreq: 'monthly', priority: '0.4' },
  { loc: '/services', changefreq: 'monthly', priority: '0.5' },
  { loc: '/help', changefreq: 'monthly', priority: '0.4' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.4' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/community-guidelines', changefreq: 'yearly', priority: '0.3' },
  { loc: '/delete-account', changefreq: 'yearly', priority: '0.3' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.7' },
];

function loadBlogPosts() {
  const blogDataPath = path.join(__dirname, '..', 'js', 'blog-data.js');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(blogDataPath, 'utf8'), sandbox);
  return sandbox.window.PMBlog.getAllPosts();
}

async function fetchAllRows(cfg, table, select, filter) {
  const headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  const pageSize = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    const url =
      cfg.url +
      '/rest/v1/' + table + '?' + (filter ? filter + '&' : '') +
      'select=' + select + '&limit=' + pageSize + '&offset=' + offset;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      // Table may not exist or be publicly readable in every environment — skip gracefully.
      console.warn('Skipping ' + table + ': ' + res.status + ' ' + (await res.text()).slice(0, 200));
      return [];
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function fetchActiveListingIds(cfg) {
  // title + category needed to build the pre-rendered /l/<slug>-<id>.html URL.
  return fetchAllRows(cfg, 'listings', 'id,title,category,created_at', 'status=eq.active&order=created_at.desc');
}

async function fetchActiveRentalIds(cfg) {
  // Match the pre-render filter + fields needed for the /r/<slug>-<id> URL.
  return fetchAllRows(cfg, 'rental_vehicle_listings', 'id,model,year,updated_at,rental_brands(label)', 'status=eq.active&admin_status=eq.approved&deleted_at=is.null');
}

async function fetchPublicProfileIds(cfg) {
  return fetchAllRows(cfg, 'profiles_public', 'id,created_at', '');
}

async function fetchActiveBusinessIds(cfg) {
  return fetchAllRows(cfg, 'businesses', 'id,name,updated_at', 'status=eq.active');
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, lastmod, changefreq, priority) {
  let entry = '  <url>\n    <loc>' + xmlEscape(SITE + loc) + '</loc>\n';
  if (lastmod) entry += '    <lastmod>' + lastmod + '</lastmod>\n';
  if (changefreq) entry += '    <changefreq>' + changefreq + '</changefreq>\n';
  if (priority) entry += '    <priority>' + priority + '</priority>\n';
  entry += '  </url>\n';
  return entry;
}

async function main() {
  const cfg = loadSupabaseConfig();
  const [listings, rentals, profiles, businesses] = await Promise.all([
    fetchActiveListingIds(cfg),
    fetchActiveRentalIds(cfg),
    fetchPublicProfileIds(cfg),
    fetchActiveBusinessIds(cfg),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const p of STATIC_PAGES) {
    xml += urlEntry(p.loc, today, p.changefreq, p.priority);
  }

  for (const l of listings) {
    const lastmod = l.created_at ? l.created_at.slice(0, 10) : today;
    // Point at the static pre-rendered page (real HTML + baked JSON-LD),
    // not the client-rendered /detail?id= alias.
    xml += urlEntry('/' + PMSchema.listingPath(l), lastmod, 'weekly', '0.6');
  }

  for (const r of rentals) {
    const lastmod = r.updated_at ? r.updated_at.slice(0, 10) : today;
    xml += urlEntry('/' + PMSchema.rentalPath(r), lastmod, 'weekly', '0.6');
  }

  for (const p of profiles) {
    const lastmod = p.created_at ? p.created_at.slice(0, 10) : today;
    xml += urlEntry('/profile?id=' + p.id, lastmod, 'monthly', '0.4');
  }

  for (const b of businesses) {
    const lastmod = b.updated_at ? b.updated_at.slice(0, 10) : today;
    xml += urlEntry('/' + PMSchema.businessPath(b), lastmod, 'weekly', '0.7');
  }

  const blogPosts = loadBlogPosts();
  for (const post of blogPosts) {
    const lastmod = post.dateModified || post.datePublished || today;
    xml += urlEntry('/blog-post?slug=' + post.slug, lastmod, 'monthly', '0.6');
  }

  xml += '</urlset>\n';

  const outPath = path.join(__dirname, '..', 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(
    'sitemap.xml written with ' + STATIC_PAGES.length + ' static pages, ' +
    listings.length + ' listing pages, ' + rentals.length + ' rental pages, ' +
    profiles.length + ' profile pages, ' + businesses.length + ' business pages, ' +
    blogPosts.length + ' blog posts.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
