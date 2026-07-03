// Generates sitemap.xml for pamarketzw.com from the static pages list plus
// live, active listings pulled from Supabase. Run: node tools/generate-sitemap.js
// Requires SUPABASE_URL / SUPABASE_ANON_KEY env vars (or js/supabase-config.js locally).
const fs = require('fs');
const path = require('path');

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
  { loc: '/browse.html', changefreq: 'daily', priority: '0.9' },
  { loc: '/browse.html?cat=property', changefreq: 'daily', priority: '0.9' },
  { loc: '/browse.html?cat=vehicles', changefreq: 'daily', priority: '0.9' },
  { loc: '/browse.html?cat=electronics', changefreq: 'daily', priority: '0.8' },
  { loc: '/browse.html?cat=furniture', changefreq: 'daily', priority: '0.8' },
  { loc: '/browse.html?cat=fashion', changefreq: 'daily', priority: '0.8' },
  { loc: '/browse.html?cat=services', changefreq: 'daily', priority: '0.8' },
  { loc: '/browse.html?cat=agriculture', changefreq: 'daily', priority: '0.7' },
  { loc: '/browse.html?cat=rooms', changefreq: 'daily', priority: '0.7' },
  { loc: '/browse.html?cat=pets', changefreq: 'daily', priority: '0.7' },
  { loc: '/browse.html?cat=kids', changefreq: 'daily', priority: '0.7' },
  { loc: '/browse.html?cat=other', changefreq: 'daily', priority: '0.6' },
  { loc: '/browse.html?shops=1', changefreq: 'daily', priority: '0.8' },
  { loc: '/jobs.html', changefreq: 'daily', priority: '0.9' },
  { loc: '/rentals.html', changefreq: 'daily', priority: '0.8' },
  { loc: '/plans.html', changefreq: 'weekly', priority: '0.6' },
  { loc: '/advertise.html', changefreq: 'monthly', priority: '0.5' },
  { loc: '/post-ad.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/about.html', changefreq: 'monthly', priority: '0.4' },
  { loc: '/services.html', changefreq: 'monthly', priority: '0.5' },
  { loc: '/help.html', changefreq: 'monthly', priority: '0.4' },
  { loc: '/contact.html', changefreq: 'monthly', priority: '0.4' },
  { loc: '/terms.html', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { loc: '/community-guidelines.html', changefreq: 'yearly', priority: '0.3' },
  { loc: '/delete-account.html', changefreq: 'yearly', priority: '0.3' },
];

async function fetchActiveListingIds(cfg) {
  const headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  const pageSize = 1000;
  let offset = 0;
  const ids = [];
  for (;;) {
    const url =
      cfg.url +
      '/rest/v1/listings?status=eq.active&select=id,created_at&order=created_at.desc&limit=' +
      pageSize +
      '&offset=' +
      offset;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Supabase listings fetch failed: ' + res.status + ' ' + (await res.text()));
    const rows = await res.json();
    ids.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return ids;
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
  const listings = await fetchActiveListingIds(cfg);

  const today = new Date().toISOString().slice(0, 10);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const p of STATIC_PAGES) {
    xml += urlEntry(p.loc, today, p.changefreq, p.priority);
  }

  for (const l of listings) {
    const lastmod = l.created_at ? l.created_at.slice(0, 10) : today;
    xml += urlEntry('/detail.html?id=' + l.id, lastmod, 'weekly', '0.6');
  }

  xml += '</urlset>\n';

  const outPath = path.join(__dirname, '..', 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log('sitemap.xml written with ' + STATIC_PAGES.length + ' static pages and ' + listings.length + ' listing pages.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
