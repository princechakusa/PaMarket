'use strict';
/**
 * PaMarket QA System — Configuration
 *
 * Copy this file to config.js and fill in TEST_USER / TEST_ADMIN credentials.
 * NEVER commit config.js — it is gitignored.
 *
 * The SUPABASE_URL and SUPABASE_ANON_KEY are already public (embedded in index.html).
 * Security is enforced entirely by Supabase RLS policies.
 */
module.exports = {
  // ── Supabase (public — same as in www/index.html) ────────────────────────
  SUPABASE_URL:      'https://gxgytumhknmnwspxjzxw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Z3l0dW1oa25tbndzcHhqenh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzMwNDUsImV4cCI6MjA5MzY0OTA0NX0.ddJhWdUy7JVrSfdaSK8a0On3zuwssY2H4DWsxBhgbJs',

  // ── Deployed app URL ──────────────────────────────────────────────────────
  // Set to your GitHub Pages URL or local dev server (e.g. http://localhost:8080/www/)
  APP_URL: 'https://princechakusa.github.io/pamarket/www/',

  // ── QA test accounts — CREATE THESE IN SUPABASE BEFORE RUNNING ───────────
  // These must be DEDICATED QA accounts, never real user accounts.
  // Create them via the Supabase dashboard → Authentication → Users.
  // After creating, sign in once to trigger profile creation via the app.
  TEST_USER: {
    email:    'qa-user@pamarket.test',
    password: 'QAUser2026!',
    userId:   null,   // fill in after creation, or leave null for auto-lookup
    phone:    '0771234567'
  },
  TEST_ADMIN: {
    email:    'qa-admin@pamarket.test',
    password: 'QAAdmin2026!',
    userId:   null,   // fill in after creation
    phone:    '0779876543'
  },

  // ── Safety flags ──────────────────────────────────────────────────────────
  // READ_ONLY: true  — only read/inspect tests, no data writes
  // READ_ONLY: false — enables write tests (listing creation, message send, etc.)
  //                    ONLY use with test accounts, NEVER against real data
  READ_ONLY: true,

  // ── Feature Testing ───────────────────────────────────────────────────────
  // Playwright browser options
  BROWSER_HEADLESS: true,   // false to watch tests run
  BROWSER_SLOW_MO:  0,      // ms delay between actions (useful for debugging)
  PLAYWRIGHT_TIMEOUT: 30000, // ms per test step

  // ── Report output ─────────────────────────────────────────────────────────
  REPORT_DIR: './reports',
  REPORT_FORMAT: 'both',  // 'json' | 'html' | 'both'
};
