const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('database prevents overlapping live vehicle bookings', () => {
  const sql = read('supabase/migrations/20260924130000_rental_phase1_booking_core.sql');
  assert.match(sql, /constraint rb_no_double_booking/i);
  assert.match(sql, /exclude using gist/i);
  assert.match(sql, /status in \('confirmed', 'picked_up', 'active'\)/i);
});

test('busy availability combines provider blocks and live bookings', () => {
  const sql = read('supabase/migrations/20260924130000_rental_phase1_booking_core.sql');
  assert.match(sql, /rental_vehicle_availability/i);
  assert.match(sql, /rental_bookings/i);
  assert.match(sql, /status in \('confirmed', 'picked_up', 'active'\)/i);
});

test('web and mobile use the same date-aware search RPC', () => {
  const web = read('js/services/rentals.js');
  const mobile = read('apps/mobile/app/rentals/index.tsx');
  for (const source of [web, mobile]) {
    assert.match(source, /rental_search_listings/);
  }
  assert.match(web, /p_start_date/);
  assert.match(web, /p_end_date/);
});

test('booking prices are quoted and persisted by server RPCs', () => {
  const core = read('supabase/migrations/20260924130000_rental_phase1_booking_core.sql');
  const hardening = read('supabase/migrations/20260925120000_rental_production_hardening.sql');
  const web = read('js/services/rentals.js');
  const mobile = read('apps/mobile/lib/rentals.ts');
  assert.match(hardening, /create or replace function public\.rental_quote_booking/i);
  assert.match(core, /from public\.rental_quote_booking/i);
  assert.match(web, /request_rental_booking/);
  assert.match(mobile, /request_rental_booking/);
  assert.doesNotMatch(web, /p_total_amount|p_daily_rate|p_rate_subtotal/);
  assert.doesNotMatch(mobile, /p_total_amount|p_daily_rate|p_rate_subtotal/);
});

test('public rental clients never request private vehicle identifiers', () => {
  const sources = [
    read('js/services/rentals.js'),
    read('apps/mobile/lib/rentals.ts'),
    read('apps/mobile/app/rentals/[id].tsx'),
  ].join('\n').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(sources, /\bregistration\b|\bvin\b|\bengine_number\b/i);

  const privacy = read('supabase/migrations/20260924120000_rental_phase0_private_fields_and_availability.sql');
  assert.match(privacy, /array\['registration'\]/i);
  assert.match(privacy, /array\['vin', 'engine_number'\]/i);
  assert.match(privacy, /'revoke select \(%s\) on public\.%I from %I'/i);
});

test('rental lifecycle includes both customer and provider operations', () => {
  const web = read('js/services/rentals.js');
  const mobile = read('apps/mobile/lib/rentals.ts');
  for (const operation of [
    'accept_rental_booking', 'decline_rental_booking', 'cancel_rental_booking',
    'mark_rental_picked_up', 'mark_rental_returned', 'complete_rental_booking',
  ]) {
    assert.match(web, new RegExp(operation));
    assert.match(mobile, new RegExp(operation));
  }
});

test('admin legacy page remains outside rental implementation', () => {
  const hardening = read('supabase/migrations/20260925120000_rental_production_hardening.sql');
  assert.doesNotMatch(hardening, /www[\\/]admin\.html/i);
});
