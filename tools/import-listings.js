#!/usr/bin/env node
/*!
 * PaMarket — bulk listing importer
 *
 * WHY: seeding a marketplace one listing at a time through the UI is the
 * bottleneck when you have 31 listings and need 200. This turns a spreadsheet
 * into live, SEO-indexed listings.
 *
 * Imported listings are INDISTINGUISHABLE from app-posted ones: same table,
 * same fields, same status. tools/prerender.js picks them up automatically
 * (it selects status=active), so each one gets a static /l/<slug>-<id>.html
 * page with Product/Offer schema, and generate-sitemap.js indexes it.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────
 *   1. Make a CSV (see listings-template.csv, or run: node tools/import-listings.js --template)
 *   2. Dry run first — validates everything, writes NOTHING:
 *        node tools/import-listings.js my-listings.csv
 *   3. Actually import:
 *        node tools/import-listings.js my-listings.csv --commit
 *   4. Publish to the web:
 *        node tools/prerender.js && node tools/generate-sitemap.js
 *
 * ── AUTH ─────────────────────────────────────────────────────────────────
 * Listings are inserted as YOU (RLS requires an authenticated seller). Set:
 *   PAMARKET_EMAIL=you@example.com  PAMARKET_PASSWORD=...  node tools/import-listings.js ...
 * or pass --email / --password. The listing's displayed seller name/phone come
 * from the CSV, so you can seed on behalf of a real shop while owning the row.
 *
 * ── PHOTOS ───────────────────────────────────────────────────────────────
 * The `photos` column takes 1+ image URLs separated by `|`. Any http(s) URL
 * works — the importer downloads each one and re-uploads it to PaMarket's R2
 * bucket, so listings never hotlink to someone else's server (which would break
 * the moment they delete the image).
 *
 * ── IMPORTANT ────────────────────────────────────────────────────────────
 * Only list things that are genuinely for sale, with the seller's permission.
 * Fake or unauthorised listings destroy the trust a marketplace runs on, and
 * a buyer who contacts a "seller" who never agreed to be listed is a buyer you
 * lose permanently.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────
function loadConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  }
  const src = fs.readFileSync(path.join(ROOT, 'js', 'supabase-config.js'), 'utf8');
  return {
    url: src.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1],
    key: src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1],
  };
}

// Valid values — mirrors what the app itself accepts.
const CATEGORIES = ['electronics','vehicles','property','furniture','fashion','jobs',
                    'agriculture','services','rooms','pets','kids','other'];
const PROVINCES  = ['Harare','Bulawayo','Manicaland','Mashonaland West','Mashonaland East',
                    'Mashonaland Central','Midlands','Masvingo','Matabeleland North','Matabeleland South'];
const CURRENCIES = ['USD','ZiG'];
const CONDITIONS = ['new','used','refurbished',''];

const COLUMNS = ['title','description','price','currency','category','province','city',
                 'suburb','condition','photos','seller_name','seller_phone'];

// ── Minimal RFC-4180 CSV parser (handles quotes, commas and newlines in fields) ──
function parseCSV(text) {
  text = text.replace(/^﻿/, '');           // strip BOM (Excel loves adding one)
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));   // drop blank lines
}

function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);
}

// ── Supabase REST helpers ─────────────────────────────────────────────────
async function signIn(cfg, email, password) {
  const res = await fetch(cfg.url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error('Sign-in failed: ' + (j.error_description || j.msg || res.status));
  return { token: j.access_token, userId: j.user && j.user.id };
}

async function insertListing(cfg, token, row) {
  const res = await fetch(cfg.url + '/rest/v1/listings', {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  const body = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + body.slice(0, 180));
  return JSON.parse(body)[0];
}

// Re-host an image on PaMarket's R2 so the listing never depends on someone
// else's server staying up. Uses the same get-r2-upload-url edge function the
// app uses, so permissions and bucket layout are identical.
async function rehostImage(cfg, token, srcUrl, sellerId) {
  const img = await fetch(srcUrl);
  if (!img.ok) throw new Error('could not fetch image (HTTP ' + img.status + ')');
  const type = (img.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\//.test(type)) throw new Error('not an image (' + type + ')');
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error('image larger than 8MB');

  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const key = 'listings/' + sellerId + '/' + crypto.randomUUID() + '.' + ext;

  const signRes = await fetch(cfg.url + '/functions/v1/get-r2-upload-url', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, contentType: type }),
  });
  if (!signRes.ok) throw new Error('R2 sign failed (HTTP ' + signRes.status + ')');
  const { signedUrl, publicUrl } = await signRes.json();

  const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': type }, body: buf });
  if (!put.ok) throw new Error('R2 upload failed (HTTP ' + put.status + ')');
  return publicUrl;
}

// ── Validation ────────────────────────────────────────────────────────────
function validate(rec, lineNo) {
  const errs = [];
  const need = (f) => { if (!String(rec[f] || '').trim()) errs.push(f + ' is required'); };

  need('title'); need('description'); need('category'); need('province'); need('city');

  const price = parseFloat(rec.price);
  if (rec.price === '' || rec.price == null) errs.push('price is required (use 0 for "contact for price")');
  else if (isNaN(price) || price < 0) errs.push('price must be a number >= 0');
  else if (price > 100000000) errs.push('price looks wrong (over 100,000,000)');

  if (rec.category && !CATEGORIES.includes(rec.category.toLowerCase()))
    errs.push('category "' + rec.category + '" not one of: ' + CATEGORIES.join(', '));
  if (rec.province && !PROVINCES.includes(rec.province))
    errs.push('province "' + rec.province + '" not one of: ' + PROVINCES.join(', '));
  if (rec.currency && !CURRENCIES.includes(rec.currency))
    errs.push('currency must be USD or ZiG');
  if (rec.condition && !CONDITIONS.includes(rec.condition.toLowerCase()))
    errs.push('condition must be new, used, refurbished, or blank');

  if (String(rec.title).length > 120) errs.push('title over 120 chars');

  const photos = String(rec.photos || '').split('|').map(s => s.trim()).filter(Boolean);
  if (!photos.length) errs.push('at least one photo URL is required (listings without photos do not sell)');
  photos.forEach(p => { if (!/^https?:\/\//i.test(p)) errs.push('photo is not a http(s) URL: ' + p.slice(0, 40)); });

  return { errs, photos, price: isNaN(price) ? 0 : price };
}

// ── Template ──────────────────────────────────────────────────────────────
const TEMPLATE =
`title,description,price,currency,category,province,city,suburb,condition,photos,seller_name,seller_phone
Toyota Hilux 2015 Double Cab,"Well maintained, full service history, 180k km. Selling because I am upgrading.",14500,USD,vehicles,Harare,Harare CBD,Avondale,used,https://example.com/hilux-1.jpg|https://example.com/hilux-2.jpg,Tendai Moyo,+263771234567
3 Bedroom House Borrowdale,"Spacious family home on 2000sqm stand, borehole, solar backup, walled with electric fence.",185000,USD,property,Harare,Harare,Borrowdale,,https://example.com/house.jpg,Chipo Ncube,+263712345678
Samsung Galaxy A54,"Barely used, boxed with charger and receipt. Screen is flawless.",280,USD,electronics,Bulawayo,Bulawayo,Hillside,used,https://example.com/phone.jpg,Blessing Dube,+263775551234
`;

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--template')) {
    const out = path.join(ROOT, 'listings-template.csv');
    fs.writeFileSync(out, TEMPLATE);
    console.log('Wrote ' + out);
    console.log('\nFill it in, then dry-run:  node tools/import-listings.js listings-template.csv');
    return;
  }

  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.log('PaMarket bulk listing importer\n');
    console.log('  node tools/import-listings.js --template          make a starter CSV');
    console.log('  node tools/import-listings.js file.csv            DRY RUN (validates, writes nothing)');
    console.log('  node tools/import-listings.js file.csv --commit   actually import\n');
    console.log('Auth: set PAMARKET_EMAIL and PAMARKET_PASSWORD, or pass --email=.. --password=..');
    process.exit(1);
  }

  const commit = args.includes('--commit');
  const getArg = (n) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : null; };
  const email = getArg('email') || process.env.PAMARKET_EMAIL;
  const password = getArg('password') || process.env.PAMARKET_PASSWORD;

  const cfg = loadConfig();
  const rows = parseCSV(fs.readFileSync(path.resolve(file), 'utf8'));
  if (rows.length < 2) { console.error('CSV has no data rows.'); process.exit(1); }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const missing = ['title','description','price','category','province','city','photos'].filter(c => !header.includes(c));
  if (missing.length) { console.error('CSV is missing required column(s): ' + missing.join(', ')); process.exit(1); }

  const records = rows.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
    return o;
  });

  // ── Validate everything BEFORE touching the database ──
  console.log('Validating ' + records.length + ' row(s)…\n');
  let bad = 0;
  const prepared = [];
  records.forEach((rec, i) => {
    const line = i + 2;   // +1 header, +1 to 1-index
    const { errs, photos, price } = validate(rec, line);
    if (errs.length) {
      bad++;
      console.log('  row ' + line + '  "' + (rec.title || '(no title)').slice(0, 40) + '"');
      errs.forEach(e => console.log('        ✗ ' + e));
    } else {
      prepared.push({ rec, photos, price, line });
    }
  });

  if (bad) {
    console.log('\n' + bad + ' row(s) have errors and will be SKIPPED.');
    if (!prepared.length) { console.log('Nothing valid to import.'); process.exit(1); }
  }
  console.log((bad ? '\n' : '') + prepared.length + ' row(s) are valid.');

  if (!commit) {
    console.log('\nDRY RUN — nothing was written.');
    console.log('Re-run with --commit to import for real:');
    console.log('  node tools/import-listings.js ' + file + ' --commit');
    return;
  }

  if (!email || !password) {
    console.error('\nCannot import: set PAMARKET_EMAIL and PAMARKET_PASSWORD (or --email= --password=).');
    process.exit(1);
  }

  // ── Import ──
  console.log('\nSigning in as ' + email + '…');
  const { token, userId } = await signIn(cfg, email, password);
  console.log('Signed in. Importing as seller_id ' + userId + '\n');

  let ok = 0, failed = 0;
  for (const { rec, photos, price, line } of prepared) {
    const title = rec.title.trim();
    try {
      // Re-host every photo on our own R2 first — a listing pointing at someone
      // else's server breaks the day they delete the image.
      const hosted = [];
      for (const src of photos) {
        try { hosted.push(await rehostImage(cfg, token, src, userId)); }
        catch (e) { console.log('  ! row ' + line + ' photo skipped (' + e.message + ')'); }
      }
      if (!hosted.length) throw new Error('no photos could be uploaded');

      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 86400000);   // 30-day listing life
      const row = {
        id: crypto.randomUUID(),
        seller_id: userId,
        title,
        description: rec.description.trim(),
        price,
        currency: rec.currency || 'USD',
        category: rec.category.toLowerCase(),
        province: rec.province,
        city: rec.city,
        suburb: rec.suburb || null,
        condition: (rec.condition || '').toLowerCase() || null,
        photos: hosted,
        status: 'active',
        views: 0,
        seller_name: rec.seller_name || '',
        seller_phone: rec.seller_phone || '',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        expires_at: expires.toISOString(),
        attributes: {},
        custom_questions: [],
      };

      const saved = await insertListing(cfg, token, row);
      ok++;
      console.log('  ✓ ' + title.slice(0, 46).padEnd(48) + '/l/' + slugify(title) + '-' + saved.id + '.html');
    } catch (e) {
      failed++;
      console.log('  ✗ row ' + line + ' "' + title.slice(0, 34) + '" — ' + e.message);
    }
  }

  console.log('\n' + ok + ' imported, ' + failed + ' failed.');
  if (ok) {
    console.log('\nNow publish them to the web (this is what gets them into Google):');
    console.log('  node tools/prerender.js');
    console.log('  node tools/generate-sitemap.js');
    console.log('  git add l sitemap.xml && git commit -m "chore: seed listings" && git push');
  }
}

main().catch(e => { console.error('\nFATAL: ' + e.message); process.exit(1); });
