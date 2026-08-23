'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./file-utils');
const sitemap = require('../generate-sitemap.js');

function response(data, status) {
  return Promise.resolve({ ok: !status || status < 400, status: status || 200, json: () => Promise.resolve(data), text: () => Promise.resolve('authority unavailable') });
}

function uuid(n) { return '00000000-0000-0000-0000-' + String(n).padStart(12, '0'); }

async function runScenario(mutateBeforeSecondPage) {
  let source = Array.from({ length: 1001 }, (_, i) => ({ id: uuid(i * 2), updated_at: '2026-08-20T12:00:00Z' }));
  const requests = [];
  global.fetch = (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, options, body });
    if (requests.length === 2 && mutateBeforeSecondPage) {
      source = mutateBeforeSecondPage(source.slice());
      source.sort((a, b) => a.id.localeCompare(b.id));
    }
    return response(source.filter(row => body.p_after_id === null || row.id > body.p_after_id).slice(0, body.p_limit));
  };
  const profiles = await sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' });
  return { profiles, requests, source };
}

function assertUniqueAscending(rows) {
  const ids = rows.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id, i) => i === 0 || ids[i - 1] < id));
}

async function characterizeSitemapKeysetAuthority() {
  let assertions = 0;
  const base = await runScenario();
  assert.equal(base.profiles.length, 1001); assertions++;
  assert.equal(base.requests.length, 2); assertions++;
  assert.equal(base.requests[0].url, 'https://example.supabase.co/rest/v1/rpc/list_public_indexable_profiles_page'); assertions++;
  assert.equal(base.requests[0].options.method, 'POST'); assertions++;
  assert.deepEqual(base.requests[0].body, { p_after_id: null, p_limit: 1000 }); assertions++;
  assert.equal(base.requests[1].body.p_after_id, base.profiles[999].id); assertions++;
  assert.equal(base.requests[0].options.headers.Range, undefined); assertions++;
  assert.deepEqual(base.profiles.map(row => row.id), base.source.map(row => row.id)); assertions++;
  assertUniqueAscending(base.profiles); assertions += 2;

  const insertedBefore = uuid(1997);
  const insertionBefore = await runScenario(rows => rows.concat({ id: insertedBefore, updated_at: '2026-08-21T00:00:00Z' }));
  assert.equal(insertionBefore.profiles.some(row => row.id === insertedBefore), false); assertions++;
  assertUniqueAscending(insertionBefore.profiles); assertions += 2;

  const deletionBefore = await runScenario(rows => rows.filter(row => row.id !== uuid(1000)));
  assert.equal(deletionBefore.profiles.length, 1001); assertions++;
  assertUniqueAscending(deletionBefore.profiles); assertions += 2;

  const insertedAfter = uuid(1999);
  const insertionAfter = await runScenario(rows => rows.concat({ id: insertedAfter, updated_at: '2026-08-21T00:00:00Z' }));
  assert.equal(insertionAfter.profiles.some(row => row.id === insertedAfter), true); assertions++;
  assertUniqueAscending(insertionAfter.profiles); assertions += 2;

  const deletionAfter = await runScenario(rows => rows.filter(row => row.id !== uuid(2000)));
  assert.equal(deletionAfter.profiles.length, 1000); assertions++;
  assertUniqueAscending(deletionAfter.profiles); assertions += 2;

  const updated = '2026-08-20T12:00:00Z';
  global.fetch = () => response([{ id: uuid(2), updated_at: updated }, { id: uuid(1), updated_at: updated }]);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /out of order/); assertions++;
  global.fetch = () => response([{ id: uuid(1), updated_at: updated }, { id: uuid(1), updated_at: updated }]);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /duplicate profile ID/); assertions++;
  global.fetch = () => response([{ id: 'not-a-uuid', updated_at: updated }]);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /malformed profile row/); assertions++;
  global.fetch = () => response([{ id: uuid(1) }]);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /malformed profile row/); assertions++;
  global.fetch = () => response([{ id: uuid(1), updated_at: 'not-a-date' }]);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /malformed profile row/); assertions++;
  let cursorRequest=0;
  const firstPage=Array.from({length:1000},(_,i)=>({id:uuid(i*2),updated_at:updated}));
  global.fetch = () => response(cursorRequest++ === 0 ? firstPage : [{ id: uuid(1997), updated_at: updated }]);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /cursor did not advance/); assertions++;
  global.fetch = () => response([]);
  assert.deepEqual(await sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), []); assertions++;
  global.fetch = () => response({ rows: [] });
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /invalid profile page/); assertions++;
  global.fetch = () => response([], 500);
  await assert.rejects(sitemap.fetchPublicProfileIds({ url: 'https://example.supabase.co', key: 'anon-key' }), /Sitemap authority failed: 500/); assertions++;

  const source = fs.readFileSync(path.join(ROOT, 'tools', 'generate-sitemap.js'), 'utf8');
  assert.doesNotMatch(source, /fetchAllRows\(cfg,\s*['"]profiles_public/); assertions++;
  assert.doesNotMatch(source, /phone|email|cv_file|recruitment_candidate_refs/i); assertions++;
  const migration = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20260822234500_public_indexable_profiles_keyset_page.sql'), 'utf8');
  assert.match(migration, /p\.id\s*>\s*p_after_id/i); assertions++;
  assert.match(migration, /order\s+by\s+p\.id\s+asc/i); assertions++;
  return { assertions };
}

module.exports = { characterizeSitemapKeysetAuthority };
