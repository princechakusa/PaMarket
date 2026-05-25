'use strict';
/**
 * PaMarket QA System — Configuration Template
 *
 * For local development:
 *   cp config.example.js config.js
 *   Fill in TEST_USER / TEST_ADMIN credentials.
 *   config.js is gitignored — never commit it.
 *
 * For CI (GitHub Actions):
 *   Set the environment variables listed below as repository secrets.
 *   The orchestrator reads process.env first, then falls back to the
 *   hardcoded defaults in this file.
 *
 * SUPABASE_URL and SUPABASE_ANON_KEY are already public (in index.html).
 * Security is enforced entirely by Supabase RLS policies.
 */

// ── Environment-variable helpers ──────────────────────────────────────────────

function e(key, fallback) {
  const val = process.env[key];
  return (val !== undefined && val !== '') ? val : fallback;
}

function eBool(key, fallback) {
  const val = process.env[key];
  if (val === undefined || val === '') return fallback;
  return val !== 'false' && val !== '0';
}

// ── Config ────────────────────────────────────────────────────────────────────

module.exports = {

  // ── Production Supabase (public — same as in www/index.html) ───────────────
  SUPABASE_URL:      e('SUPABASE_URL',      'https://gxgytumhknmnwspxjzxw.supabase.co'),
  SUPABASE_ANON_KEY: e('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Z3l0dW1oa25tbndzcHhqenh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzMwNDUsImV4cCI6MjA5MzY0OTA0NX0.ddJhWdUy7JVrSfdaSK8a0On3zuwssY2H4DWsxBhgbJs'),

  // ── Staging Supabase ────────────────────────────────────────────────────────
  // Create a SEPARATE Supabase project for staging. NEVER reuse production here.
  // Secret name in GitHub Actions:  SUPABASE_STAGING_URL
  SUPABASE_STAGING_URL:       e('SUPABASE_STAGING_URL',       ''),
  SUPABASE_STAGING_ANON_KEY:  e('SUPABASE_STAGING_ANON_KEY',  ''),

  // Direct PostgreSQL connection to the STAGING database (for SQL fix execution).
  // Format: postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
  // Secret name in GitHub Actions:  SUPABASE_STAGING_DB_URL
  SUPABASE_STAGING_DB_URL:    e('SUPABASE_STAGING_DB_URL',    ''),

  // Git branch that maps to the staging environment
  STAGING_BRANCH: e('STAGING_BRANCH', 'staging'),

  // ── App URLs ───────────────────────────────────────────────────────────────
  APP_URL:         e('APP_URL',         'https://princechakusa.github.io/pamarket/www/'),
  APP_STAGING_URL: e('APP_STAGING_URL', ''),

  // ── QA test accounts ───────────────────────────────────────────────────────
  // Create dedicated QA accounts in Supabase → Authentication → Users.
  // Sign in once via the app to trigger profile creation.
  // Secret names in GitHub Actions:  QA_USER_EMAIL, QA_USER_PASSWORD, etc.
  TEST_USER: {
    email:    e('QA_USER_EMAIL',    'qa-user@pamarket.test'),
    password: e('QA_USER_PASSWORD', 'QAUser2026!'),
    userId:   e('QA_USER_ID',       null),
    phone:    '0771234567',
  },
  TEST_ADMIN: {
    email:    e('QA_ADMIN_EMAIL',    'qa-admin@pamarket.test'),
    password: e('QA_ADMIN_PASSWORD', 'QAAdmin2026!'),
    userId:   e('QA_ADMIN_ID',       null),
    phone:    '0779876543',
  },

  // ── Safety flags ───────────────────────────────────────────────────────────
  // READ_ONLY: true  — only read/inspect tests; no data writes
  // READ_ONLY: false — enables write tests (listing creation, messages, etc.)
  //                    ONLY use with test accounts, never against real data
  READ_ONLY: eBool('QA_READ_ONLY', true),

  // ── Playwright (browser) options ───────────────────────────────────────────
  BROWSER_HEADLESS:   eBool('BROWSER_HEADLESS',   true),
  BROWSER_SLOW_MO:    parseInt(e('BROWSER_SLOW_MO', '0'), 10),
  PLAYWRIGHT_TIMEOUT: parseInt(e('PLAYWRIGHT_TIMEOUT', '30000'), 10),

  // ── Report output ──────────────────────────────────────────────────────────
  REPORT_DIR:    e('REPORT_DIR',    './reports'),
  REPORT_FORMAT: e('REPORT_FORMAT', 'both'),   // 'json' | 'html' | 'both'

};
