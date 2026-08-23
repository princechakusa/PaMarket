'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./file-utils');

function characterizePaidAdsAuthority() {
  const sql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260823130000_paid_ads_server_authority.sql'),
    'utf8'
  );
  const targetSectionHardening = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20260823140000_require_paid_ads_target_section.sql'),
    'utf8'
  );
  const admin = fs.readFileSync(path.join(ROOT, 'www', 'admin.html'), 'utf8');
  const legacyWebsite = fs.readFileSync(path.join(ROOT, 'www', 'js', 'app.js'), 'utf8');
  const mobile = fs.readFileSync(path.join(ROOT, 'apps', 'mobile', 'lib', 'ads.ts'), 'utf8');
  let assertions = 0;

  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.paid_ads\s+from\s+anon/i); assertions++;
  assert.match(sql, /grant\s+select\s+on\s+table\s+public\.paid_ads\s+to\s+anon/i); assertions++;
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.paid_ads\s+from\s+anon,\s*authenticated/i); assertions++;
  assert.match(sql, /grant\s+select\s+on\s+table\s+public\.paid_ads\s+to\s+anon,\s*authenticated/i); assertions++;
  assert.doesNotMatch(sql, /grant\s+(?:select,\s*)?(?:insert|update|delete)/i); assertions++;
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+"anon write paid_ads"/i); assertions++;
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+"admin_all"/i); assertions++;
  assert.match(sql, /for\s+select\s+to\s+anon,\s*authenticated\s+using\s*\(active\s*=\s*true\)/i); assertions++;
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+"paid_ads admin write"/i); assertions++;
  assert.doesNotMatch(sql, /create\s+policy\s+"paid_ads admin write"/i); assertions++;
  assert.match(targetSectionHardening, /p_target_section\s+is\s+null\s+or\s+p_target_section\s+not\s+in\s*\(\s*'home'\s*,\s*'category'\s*\)/i); assertions++;
  assert.match(targetSectionHardening, /raise\s+exception\s+'Invalid target section'\s+using\s+errcode\s*=\s*'22023'/i); assertions++;
  assert.match(targetSectionHardening, /revoke\s+all\s+on\s+function\s+public\.admin_create_paid_ad[\s\S]+from\s+public,\s*anon,\s*service_role/i); assertions++;
  assert.match(targetSectionHardening, /grant\s+execute\s+on\s+function\s+public\.admin_create_paid_ad[\s\S]+to\s+authenticated/i); assertions++;
  ['admin_create_paid_ad','admin_set_paid_ad_active','admin_pause_scheduled_paid_ad','admin_expire_due_paid_ads','admin_delete_paid_ad'].forEach(name => {
    const start=sql.indexOf('function public.'+name), end=sql.indexOf('$$;',start);
    const body=sql.slice(start,end);
    assert.match(body,/security\s+definer/i); assertions++;
    assert.match(body,/set\s+search_path\s*=\s*''/i); assertions++;
    assert.match(body,/auth\.uid\(\)\s+is\s+null\s+or\s+not\s+public\.is_admin\(\)/i); assertions++;
    assert.doesNotMatch(body,/execute\s+format|execute\s+\w/i); assertions++;
  });
  assert.match(sql, /grant execute on function public\.track_ad_impression\(text\) to anon, authenticated/i); assertions++;
  assert.match(sql, /grant execute on function public\.track_ad_click\(text\) to anon, authenticated/i); assertions++;
  assert.doesNotMatch(admin, /(?:from\(['"]paid_ads['"]\)\.(?:insert|update|delete)|updRow\(['"]paid_ads['"])/); assertions++;
  assert.match(admin, /rpc\(['"]admin_create_paid_ad['"]/); assertions++;
  assert.match(admin, /rpc\(['"]admin_delete_paid_ad['"]/); assertions++;
  assert.doesNotMatch(legacyWebsite, /from\(['"]paid_ads['"]\)[\s\S]{0,120}\.update\(/); assertions++;
  assert.match(legacyWebsite, /rpc\(['"]track_ad_impression['"]/); assertions++;
  assert.match(legacyWebsite, /rpc\(['"]track_ad_click['"]/); assertions++;
  assert.doesNotMatch(mobile, /from\(["']paid_ads["']\)[\s\S]{0,120}\.update\(/); assertions++;
  assert.match(mobile, /rpc\("track_ad_impression"/); assertions++;
  assert.match(mobile, /rpc\("track_ad_click"/); assertions++;
  return { assertions };
}

module.exports = { characterizePaidAdsAuthority };
