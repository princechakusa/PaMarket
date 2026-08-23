'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./file-utils');
const sitemap = require('../generate-sitemap.js');

function migration(name) {
  return fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', name), 'utf8');
}

function characterizeSitemapProfileAuthority() {
  const authority = migration('20260822180000_public_indexable_profiles_authority.sql');
  const keyset = migration('20260822234500_public_indexable_profiles_keyset_page.sql');
  const source = fs.readFileSync(path.join(ROOT, 'tools', 'generate-sitemap.js'), 'utf8');
  let assertions = 0;

  for (const sql of [authority, keyset]) {
    assert.match(sql, /returns\s+table\s*\(\s*id\s+uuid\s*,\s*updated_at\s+timestamptz\s*\)/i); assertions++;
    assert.match(sql, /security\s+definer/i); assertions++;
    assert.match(sql, /set\s+search_path\s*=\s*''/i); assertions++;
    assert.match(sql, /p\.status\s*=\s*'active'/i); assertions++;
    assert.match(sql, /p\.ban_until\s+is\s+null\s+or\s+p\.ban_until\s*<=\s*now\(\)/i); assertions++;
    assert.match(sql, /u\.deleted_at\s+is\s+null/i); assertions++;
    assert.match(sql, /u\.banned_until\s+is\s+null\s+or\s+u\.banned_until\s*<=\s*now\(\)/i); assertions++;
    assert.match(sql, /not\s+coalesce\(u\.is_anonymous,\s*false\)/i); assertions++;
    assert.match(sql, /nullif\(btrim\(p\.name\),\s*''\)\s+is\s+not\s+null/i); assertions++;
    assert.doesNotMatch(sql, /phone|email|cv_file|recruitment_candidate_refs/i); assertions++;
  }

  assert.match(authority, /grant\s+execute[\s\S]+to\s+anon,\s*service_role/i); assertions++;
  assert.match(authority, /revoke\s+all[\s\S]+from\s+public,\s*anon,\s*authenticated/i); assertions++;
  assert.match(keyset, /p_after_id\s+is\s+null\s+or\s+p\.id\s*>\s*p_after_id/i); assertions++;
  assert.match(keyset, /order\s+by\s+p\.id\s+asc/i); assertions++;
  assert.match(source, /fetchAllKeysetRpcRows\(cfg,\s*['"]list_public_indexable_profiles_page['"]\)/); assertions++;
  assert.doesNotMatch(source, /fetchAllRows\(cfg,\s*['"]profiles_public/); assertions++;

  const entry = sitemap.profileUrlEntry(
    { id: '08734bdc-d18a-4212-b4ba-2f9861e1e3a9', updated_at: '2026-08-21T12:34:56Z' },
    '2026-08-22'
  );
  assert.match(entry, /<loc>https:\/\/pamarketzw\.com\/profile\?id=08734bdc-d18a-4212-b4ba-2f9861e1e3a9<\/loc>/); assertions++;
  assert.match(entry, /<lastmod>2026-08-21<\/lastmod>/); assertions++;
  assert.match(entry, /<changefreq>monthly<\/changefreq>/); assertions++;
  assert.match(entry, /<priority>0\.4<\/priority>/); assertions++;

  return { assertions };
}

module.exports = { characterizeSitemapProfileAuthority };
