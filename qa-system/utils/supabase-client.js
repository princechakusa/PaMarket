'use strict';
/**
 * Supabase client factory for the QA system.
 *
 * Creates clients at three privilege levels:
 *   anon   — unauthenticated, mirrors what a browser visitor sees
 *   user   — authenticated as test user
 *   admin  — authenticated as test admin user
 *
 * All clients use the ANON KEY (no service-role key).
 * This is intentional: the QA system tests the same RLS policies that real
 * users face. Admin privilege comes from role='admin' in the profiles table,
 * exactly as the real app works.
 */

const { createClient } = require('@supabase/supabase-js');

let _anonClient   = null;
let _userClient   = null;
let _adminClient  = null;

function makeClient(url, anonKey, options = {}) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...options,
  });
}

/**
 * Returns an anonymous (unauthenticated) Supabase client.
 */
function anonClient(config) {
  if (!_anonClient) {
    _anonClient = makeClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return _anonClient;
}

/**
 * Signs in as the test user and returns an authenticated client.
 * Caches the session for the lifetime of the process.
 */
async function userClient(config) {
  if (_userClient) return _userClient;
  if (!config.TEST_USER || !config.TEST_USER.email) {
    throw new Error('TEST_USER credentials not configured in config.js');
  }

  const client = makeClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email:    config.TEST_USER.email,
    password: config.TEST_USER.password,
  });

  if (error) throw new Error(`Test user sign-in failed: ${error.message}`);
  if (!data.session) throw new Error('Test user sign-in returned no session');

  _userClient = client;
  return _userClient;
}

/**
 * Signs in as the test admin and returns an authenticated client.
 */
async function adminClient(config) {
  if (_adminClient) return _adminClient;
  if (!config.TEST_ADMIN || !config.TEST_ADMIN.email) {
    throw new Error('TEST_ADMIN credentials not configured in config.js');
  }

  const client = makeClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email:    config.TEST_ADMIN.email,
    password: config.TEST_ADMIN.password,
  });

  if (error) throw new Error(`Test admin sign-in failed: ${error.message}`);
  if (!data.session) throw new Error('Test admin sign-in returned no session');

  // Verify the signed-in user actually has role='admin'
  const { data: profile } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    throw new Error(`TEST_ADMIN user does not have role='admin' in profiles table`);
  }

  _adminClient = client;
  return _adminClient;
}

/**
 * Resets all cached clients (useful between test runs).
 */
function reset() {
  _anonClient  = null;
  _userClient  = null;
  _adminClient = null;
}

/**
 * Low-level: performs a raw PostgREST REST call without the SDK.
 * Useful for testing exact HTTP semantics (headers, status codes, etc.).
 */
async function rawGet(config, path, token = null) {
  const url     = `${config.SUPABASE_URL}/rest/v1/${path}`;
  // Always include Authorization: anon key is valid as a Bearer token for public reads.
  // Using plain fetch (no supabase-js SDK) avoids X-Client-Info and Host allowlist checks.
  const headers = {
    'apikey':         config.SUPABASE_ANON_KEY,
    'Authorization':  `Bearer ${token || config.SUPABASE_ANON_KEY}`,
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'Prefer':         'count=exact',
  };


  const res      = await fetch(url, { headers });
  const resHdrs  = Object.fromEntries(res.headers);
  const body     = await res.json().catch(() => null);
  const denyReason = resHdrs['x-deny-reason'] || null;
  return { status: res.status, headers: resHdrs, body, denyReason };
}

/**
 * Signs in and returns the raw JWT access token (for rawGet).
 */
async function getAccessToken(config, credentials) {
  const url  = `${config.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: {
      'apikey':       config.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

module.exports = { anonClient, userClient, adminClient, reset, rawGet, getAccessToken };
