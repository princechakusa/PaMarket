/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
// supabase.js "” safe Supabase client initialisation
(function () {
  // Make sure the CDN loaded
  if (!window.supabase) {
    console.warn('Supabase CDN not loaded · using mock client.');
    window.supabase = {
      createClient: function () {
        const noop = () => mockClient;
        const mockClient = {
          from: () => {
            console.warn('Supabase mock: operation skipped.');
            return mockClient;
          },
          select: noop,
          insert: noop,
          update: noop,
          delete: noop,
          eq: noop,
          order: noop,
          limit: noop,
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not loaded') }),
          then: (fn) => fn({ data: null, error: new Error('Supabase not loaded') })
        };
        return mockClient;
      }
    };
  }

  const supabaseUrl = window.SUPABASE_URL;
  const supabaseAnonKey = window.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials from supabase-config.js');
  }

  window.supabase = window.supabase.createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: { flowType: 'pkce' }
  });

  // Only handle OAuth callbacks — NOT regular page loads with stored sessions.
  // The app restores login state from H.loadState() (localStorage), not from here.
  var _isOAuthCallback = window.location.search.includes('code=') || window.location.hash.includes('access_token=');
  var _isPasswordReset = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
  var _oauthHandled = false;

  async function handleOAuthSession(session) {
    if (_oauthHandled) return;
    _oauthHandled = true;
    var user   = session.user;
    var userId = user.id;
    var meta   = user.user_metadata || {};
    var name   = meta.full_name || meta.name || user.email || 'User';
    var avatar = meta.avatar_url || meta.picture || null;
    var email  = user.email || '';
    try {
      var pr = await window.supabase.from('profiles').select('id, name, avatar, role, status, verified, phone, created_at').eq('id', userId).single();
      var profile = pr.data;
      if (!profile) {
        await window.supabase.from('profiles').upsert({ id: userId, name: name, avatar: avatar });
        profile = { id: userId, name: name, avatar: avatar, role: 'user', status: 'active', verified: false };
      }
      var attempts = 0;
      var trySetup = function() {
        if (!window.H || !window.H.state || typeof window.H.navTo !== 'function') {
          if (++attempts < 40) { setTimeout(trySetup, 200); return; }
          return;
        }
        var users = window.H.state.users = window.H.state.users || [];
        var existing = users.find(function(u){ return u.id === userId; });
        if (!existing) {
          users.push({ id: userId, email: email, name: profile.name || name, phone: profile.phone || '', avatar: profile.avatar || avatar, verified: !!profile.verified, language: 'English', joinedAt: new Date(profile.created_at || Date.now()).getTime(), role: profile.role || 'user', status: profile.status || 'active', banReason: null, banUntil: null, blocked: [] });
        } else {
          existing.name = profile.name || existing.name;
          existing.avatar = profile.avatar || existing.avatar;
          existing.role = profile.role || existing.role;
          existing.verified = !!profile.verified;
        }
        window.H.state.currentUserId = userId;
        if (typeof window.H.saveState === 'function') window.H.saveState();
        if (typeof window.H.closeLoginModal === 'function') window.H.closeLoginModal();
        var nav = document.getElementById('bottomNav');
        if (nav) nav.style.display = 'flex';
        window.H.navTo('Home');
        window.H.toast('Welcome, ' + (profile.name || name) + '!');
        if (typeof window.H.startRealtime === 'function') window.H.startRealtime();
      };
      trySetup();
    } catch(e) { console.warn('OAuth login handler:', e); }
  }

  if (window.supabase && window.supabase.auth && typeof window.supabase.auth.onAuthStateChange === 'function')
  window.supabase.auth.onAuthStateChange(async function(event, session) {
    // Password reset link clicked — show the set-new-password form
    if (event === 'PASSWORD_RECOVERY') {
      var waitH = function(attempts) {
        if (!window.H || typeof window.H.authShowSetPassword !== 'function') {
          if (attempts < 40) setTimeout(function(){ waitH(attempts + 1); }, 200);
          return;
        }
        window.H.authShowSetPassword();
      };
      waitH(0);
      return;
    }
    if (event !== 'SIGNED_IN' || !session || !session.user) return;
    if (!_isOAuthCallback) return;
    handleOAuthSession(session);
  });

  // Fallback getSession() only on actual OAuth callback pages
  if (_isOAuthCallback) {
    window.supabase.auth.getSession().then(function(result) {
      var session = result && result.data && result.data.session;
      if (session && session.user) handleOAuthSession(session);
    });
  }

  // Real-time sync — subscribes to live database changes
  window.H = window.H || {};
  window.H.startRealtime = function() {
    var sb = window.supabase;
    if (!sb || !sb.channel) return;
    if (window._realtimeStarted) return;
    window._realtimeStarted = true;

    // NOTE: Listings and businesses realtime are handled canonically in app.js
    // (_setupRealtimeListings / _setupRealtimeBusinesses) with full field mapping
    // via _mapCloudListing and scroll-preserving re-renders across ALL feed pages.
    // They used to be DUPLICATED here with a cruder mapping that re-rendered Home
    // from scratch (scroll jumped) and raced the canonical handler. That
    // duplication has been removed. Foreground re-sync is owned by
    // refresh-manager.js (RM.resume) and realtime-extras.js (the RT supervisor),
    // so there is no appStateChange listener here either. This channel keeps only
    // the unique profile-verification stream below.

    // Profile verification approvals
    sb.channel('rt-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, function(payload) {
        var row = payload.new;
        if (!row || !window.H || !window.H.state) return;
        var u = (window.H.state.users || []).find(function(x){ return x.id === row.id; });
        if (u) {
          var wasUnverified = !u.verified;
          u.verified = !!row.verified;
          u.role     = row.role || u.role;
          if (typeof window.H.saveState === 'function') window.H.saveState();
          if (wasUnverified && u.verified && u.id === (window.H.state.currentUserId)) {
            if (typeof window.H.toast === 'function') window.H.toast('Your identity has been verified!');
          }
        }
      })
      .subscribe();
  };
})();
