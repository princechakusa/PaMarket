/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Real-time messaging extras: online presence, typing indicators, read receipts.
 * All features are best-effort and degrade gracefully (polling already keeps
 * read state and messages in sync) so a missing Realtime connection never breaks chat.
 */
'use strict';
(function (H) {
  if (!H) return;

  function sb() { return window.supabase; }
  function me() { return (H.currentUser && H.currentUser()) || null; }
  function canRealtime() { var s = sb(); return s && typeof s.channel === 'function'; }

  // ===================================================================
  // ONLINE PRESENCE  (Supabase Realtime presence — no DB schema needed)
  // ===================================================================
  H._onlineUsers = H._onlineUsers || {};
  H.isUserOnline = function (id) { return !!(id && H._onlineUsers[String(id)]); };

  var presenceCh = null;
  H.initPresence = function () {
    if (presenceCh || !canRealtime()) return;
    var u = me();
    if (!u) return;
    // Honour the "show activity" privacy preference: only broadcast our own
    // presence when the user hasn't turned it off. We still observe others.
    var share = !(u.privacySettings && u.privacySettings.showActivity === false);
    try {
      presenceCh = sb().channel('online-users', { config: { presence: { key: String(u.id) } } });
      presenceCh.on('presence', { event: 'sync' }, function () {
        var state = presenceCh.presenceState() || {};
        var map = {};
        Object.keys(state).forEach(function (k) { map[String(k)] = true; });
        H._onlineUsers = map;
        applyPresenceToUI();
      });
      presenceCh.subscribe(function (status) {
        if (status === 'SUBSCRIBED' && share) {
          presenceCh.track({ online_at: new Date().toISOString() });
        }
      });
    } catch (e) { presenceCh = null; }
  };
  H.teardownPresence = function () {
    if (presenceCh) { try { sb().removeChannel(presenceCh); } catch (e) {} presenceCh = null; }
    H._onlineUsers = {};
  };

  // Update presence-driven UI in place (no full re-render, keeps scroll/typing intact).
  function applyPresenceToUI() {
    // Messages list: toggle each row's online dot.
    document.querySelectorAll('.msg-item[data-oid]').forEach(function (row) {
      var on = H.isUserOnline(row.getAttribute('data-oid'));
      var dot = row.querySelector('.p-on');
      if (on && !dot) {
        var w = row.querySelector('.p-av-wrap');
        if (w) { var d = document.createElement('span'); d.className = 'p-on'; w.appendChild(d); }
      } else if (!on && dot) { dot.remove(); }
    });
    // Chat header subtitle.
    if (typeof H._refreshChatPresence === 'function') H._refreshChatPresence();
  }
  H._applyPresenceToUI = applyPresenceToUI;

  // ===================================================================
  // TYPING INDICATORS  (Realtime broadcast on a per-conversation channel)
  // ===================================================================
  var chatCh = null, chatChId = null, typingTimer = null, lastSent = 0;
  H._otherTyping = false;

  H.joinChatChannel = function (convId) {
    if (!canRealtime() || !convId) return;
    if (chatChId === convId && chatCh) return;
    H.leaveChatChannel();
    var u = me(); if (!u) return;
    chatChId = convId;
    H._otherTyping = false;
    try {
      chatCh = sb().channel('chat-' + convId, { config: { broadcast: { self: false } } });
      chatCh.on('broadcast', { event: 'typing' }, function (payload) {
        var p = (payload && payload.payload) || {};
        if (String(p.userId) === String(u.id)) return;        // ignore our own echo
        H._otherTyping = !!p.typing;
        if (typeof H._renderTyping === 'function') H._renderTyping(H._otherTyping);
        if (typeof H._refreshChatPresence === 'function') H._refreshChatPresence();   // header shows "Typing…"
        // Auto-clear if the "stopped" event is ever missed.
        clearTimeout(H._otherTypingClear);
        if (H._otherTyping) {
          H._otherTypingClear = setTimeout(function () {
            H._otherTyping = false;
            if (typeof H._renderTyping === 'function') H._renderTyping(false);
            if (typeof H._refreshChatPresence === 'function') H._refreshChatPresence();
          }, 5000);
        }
      });
      chatCh.subscribe();
    } catch (e) { chatCh = null; chatChId = null; }
  };
  H.leaveChatChannel = function () {
    clearTimeout(typingTimer); typingTimer = null;
    clearTimeout(H._otherTypingClear);
    H._otherTyping = false;
    if (chatCh) { try { sb().removeChannel(chatCh); } catch (e) {} chatCh = null; chatChId = null; }
  };
  // Called from the chat input. Throttles "typing" broadcasts and schedules a "stopped".
  H.notifyTyping = function () {
    if (!chatCh) return;
    var u = me(); if (!u) return;
    var now = Date.now();
    if (now - lastSent > 1500) {
      lastSent = now;
      try { chatCh.send({ type: 'broadcast', event: 'typing', payload: { userId: u.id, typing: true } }); } catch (e) {}
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(H.stopTyping, 2500);
  };
  H.stopTyping = function () {
    clearTimeout(typingTimer); typingTimer = null;
    if (!chatCh) return;
    var u = me(); if (!u) return;
    lastSent = 0;
    try { chatCh.send({ type: 'broadcast', event: 'typing', payload: { userId: u.id, typing: false } }); } catch (e) {}
  };

  // ===================================================================
  // READ RECEIPTS  (uses the existing messages.read column)
  // ===================================================================
  // When we open a conversation we mark the OTHER person's messages read in the
  // cloud, so their app can show ✓✓. Polling (syncConversations) already pulls
  // those flags back for the sender, so receipts update even without UPDATE realtime.
  H.markConversationReadInCloud = function (convId, otherId) {
    var s = sb();
    if (!s || typeof s.from !== 'function' || !convId || !otherId) return;
    try {
      s.from('messages').update({ read: true })
        .eq('conversation_id', convId).eq('sender_id', String(otherId)).eq('read', false)
        .then(function () {}, function () {});
    } catch (e) {}
  };

  // Best-effort: listen for read-flag UPDATEs so the sender's ticks turn blue
  // instantly. Harmless if the table isn't in the realtime publication for UPDATE.
  var readCh = null;
  H.initReadReceipts = function () {
    if (readCh || !canRealtime()) return;
    var u = me(); if (!u) return;
    try {
      readCh = sb().channel('msg-reads')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, function (p) {
          var row = p && p.new; if (!row || !row.read) return;
          if (String(row.sender_id) !== String(u.id)) return;  // only our own sent messages
          var convs = (H.state && H.state.conversations) || [];
          var conv = convs.find(function (c) { return c.id === row.conversation_id; });
          if (!conv || !Array.isArray(conv.messages)) return;
          var m = conv.messages.find(function (x) { return x.id === row.id; });
          if (m && !m.read) {
            m.read = true; H.saveState && H.saveState();
            if (typeof H._refreshReceipts === 'function') H._refreshReceipts(conv.id);
          }
        })
        .subscribe();
    } catch (e) { readCh = null; }
  };
  H._teardownReadReceipts = function () {
    if (readCh) { try { sb().removeChannel(readCh); } catch (e) {} readCh = null; }
  };

  // ===================================================================
  // LAST SEEN  (persisted to profiles.last_seen; respects showActivity privacy)
  // ===================================================================
  H._lastSeen = H._lastSeen || {};          // cache: userId -> last_seen (ms)
  H._lastSeenWroteAt = 0;

  // Write our own last_seen (throttled to ≥60s unless forced, e.g. on background).
  // Honours the user's own activity-sharing preference — same rule as presence.
  H.touchLastSeen = function (force) {
    var u = me(); if (!u) return;
    if (u.privacySettings && u.privacySettings.showActivity === false) return;
    var s = sb(); if (!s || typeof s.from !== 'function') return;
    var now = Date.now();
    if (!force && now - H._lastSeenWroteAt < 60000) return;
    H._lastSeenWroteAt = now;
    try { s.from('profiles').update({ last_seen: new Date(now).toISOString() }).eq('id', u.id).then(function () {}, function () {}); } catch (e) {}
  };

  // Fetch a chat partner's last_seen + privacy so the header can show it and
  // honour their showActivity setting (stored in profiles.privacy).
  H.fetchLastSeen = function (otherId) {
    var s = sb();
    if (!otherId || !s || typeof s.from !== 'function') return Promise.resolve();
    // Best message timestamp from this user across all local conversations — used
    // as fallback when profiles.last_seen is NULL (not yet written to DB).
    function latestMsgTs() {
      var latest = 0;
      ((H.state && H.state.conversations) || []).forEach(function(c) {
        (c.messages || []).forEach(function(m) {
          if (String(m.from) === String(otherId) && (m.t||0) > latest) latest = m.t;
        });
      });
      return latest;
    }
    return s.from('profiles').select('last_seen, privacy').eq('id', String(otherId)).maybeSingle()
      .then(function (res) {
        var d = res && res.data;
        if (d) {
          // Use DB last_seen when available; fall back to last message time.
          var ts = d.last_seen ? new Date(d.last_seen).getTime() : latestMsgTs();
          H._lastSeen[String(otherId)] = ts || 0;  // 0 = fetched but truly no data
          if (d.privacy && typeof d.privacy === 'object') {
            var ou = (H.state.users || []).find(function (x) { return String(x.id) === String(otherId); });
            if (ou) ou.privacySettings = Object.assign({}, ou.privacySettings || {}, d.privacy);
          }
        } else {
          // No profile row — use last message time as best available signal.
          H._lastSeen[String(otherId)] = latestMsgTs() || 0;
        }
      }, function () {
        // Network error — use local conversation data as silent fallback.
        if (H._lastSeen[String(otherId)] === undefined) {
          H._lastSeen[String(otherId)] = latestMsgTs() || 0;
        }
      });
  };

  // Format a last_seen timestamp into the chat-header label.
  H.formatLastSeen = function (ts) {
    if (!ts) return null;
    var t = (typeof ts === 'number') ? ts : new Date(ts).getTime();
    if (!t || isNaN(t)) return null;
    var now = Date.now();
    var diff = now - t; if (diff < 0) diff = 0;
    if (diff < 45000) return 'Last seen just now';
    var min = Math.floor(diff / 60000);
    if (min < 60) return 'Last seen ' + min + ' minute' + (min === 1 ? '' : 's') + ' ago';
    var d = new Date(t), nd = new Date(now);
    var time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === nd.toDateString()) return 'Last seen today at ' + time;
    var y = new Date(now); y.setDate(nd.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Last seen yesterday at ' + time;
    if (diff < 7 * 86400000) return 'Last seen ' + d.toLocaleDateString(undefined, { weekday: 'long' }) + ' at ' + time;
    return 'Last seen ' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' at ' + time;
  };

  // ===================================================================
  // REALTIME SUPERVISOR  (H.RT)
  // One place that (re)subscribes EVERY realtime channel and keeps the live
  // connection healthy. Each channel's own setup function tears down its old
  // channel before creating a new one, so reconnectAll is safe to call
  // repeatedly. It is triggered by:
  //   • app foreground (Capacitor appStateChange / visibilitychange)
  //   • the browser 'online' event (network came back)
  //   • a channel reporting CHANNEL_ERROR / TIMED_OUT (scheduleReconnect)
  //   • the 30s health monitor when the socket is found disconnected
  //
  // State machine:
  //   OFFLINE     — no active subscription, not attempting
  //   CONNECTING  — reconnect cycle in progress
  //   CONNECTED   — at least one channel SUBSCRIBED successfully
  //   DEGRADED    — one or more channels errored; others may still be live
  // ===================================================================
  function realtimeConnected() {
    try {
      var s = sb();
      return !!(s && s.realtime && typeof s.realtime.isConnected === 'function' && s.realtime.isConnected());
    } catch (e) { return false; }
  }
  H._realtimeConnected = realtimeConnected;

  H.RT = H.RT || {};
  H.RT._lastReconnect    = 0;
  H.RT._reconnectTimer   = null;
  H.RT._state            = 'OFFLINE';   // OFFLINE | CONNECTING | CONNECTED | DEGRADED
  H.RT._reconnecting     = false;        // mutex: at most one reconnect cycle in flight
  H.RT._backoffMs        = 2000;         // current delay; doubles on failure, capped at 30s
  H.RT._backoffAttempt   = 0;

  // Minimal structured logger. No-ops unless H.RT.debug = true.
  // Enable from the browser/logcat console: H.RT.debug = true
  // Log format: [RT:category] message  data
  H.RT.debug = !!(typeof localStorage !== 'undefined' && localStorage.getItem('pmRtDebug') === '1');
  H.RT._log = function (cat, msg, data) {
    if (!H.RT.debug) return;
    try { console.log('[RT:' + cat + ']', msg, data !== undefined ? data : ''); } catch (e) {}
  };
  // H.RT.enableDebug() / H.RT.disableDebug() — run in console to toggle without refreshing
  H.RT.enableDebug  = function () { H.RT.debug = true;  try { localStorage.setItem('pmRtDebug', '1'); } catch(e) {} console.log('[RT] debug ON — watching pipeline'); };
  H.RT.disableDebug = function () { H.RT.debug = false; try { localStorage.removeItem('pmRtDebug');    } catch(e) {} console.log('[RT] debug OFF'); };

  H.RT._setState = function (s) {
    if (H.RT._state !== s) {
      H.RT._log('state', H.RT._state + ' -> ' + s);
      H.RT._state = s;
    }
  };

  // Called by every channel's .subscribe() status callback.
  // SUBSCRIBED  → reset backoff, mark CONNECTED.
  // CHANNEL_ERROR / TIMED_OUT → move to DEGRADED and schedule a backoff reconnect.
  H.RT._onChannelStatus = function (name, status) {
    if (status === 'SUBSCRIBED') {
      H.RT._backoffMs      = 2000;    // reset exponential backoff on first success
      H.RT._backoffAttempt = 0;
      if (H.RT._state === 'CONNECTING' || H.RT._state === 'DEGRADED' || H.RT._state === 'OFFLINE') {
        H.RT._setState('CONNECTED');
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      H.RT._setState('DEGRADED');
      H.RT.scheduleReconnect(name + ':' + status);
    }
  };

  // Re-subscribe every realtime channel. Guarded by a 4s storm-collapse and
  // the _reconnecting mutex so multiple simultaneous triggers (e.g. 'online' +
  // foreground + health monitor) only produce one reconnect cycle.
  H.RT.reconnectAll = function (reason) {
    if (!canRealtime()) return;
    var now = Date.now();
    if (now - H.RT._lastReconnect < 4000) return;     // collapse event storms
    H.RT._lastReconnect = now;
    H.RT._setState('CONNECTING');
    try {
      // Public content — no auth required.
      if (typeof H._setupRealtimeListings   === 'function') H._setupRealtimeListings();
      if (typeof H._setupRealtimeBusinesses === 'function') H._setupRealtimeBusinesses();
      if (typeof H._setupRealtimeReviews    === 'function') H._setupRealtimeReviews();
      // User-specific content — only when signed in.
      if (me()) {
        if (typeof H._setupRealtimeMessages === 'function') H._setupRealtimeMessages();
        if (typeof H._setupRealtimeNotifs   === 'function') H._setupRealtimeNotifs();
        // Presence + read receipts skip re-init while a handle exists, so tear
        // them down first to guarantee a fresh subscription.
        H.teardownPresence();
        if (typeof H._teardownReadReceipts === 'function') H._teardownReadReceipts();
        H.initPresence();
        H.initReadReceipts();
        // Rejoin the open chat's typing channel.
        if (H.currentPageName === 'Chat' && H._activeChat && typeof H.joinChatChannel === 'function') {
          H.joinChatChannel(H._activeChat);
        }
      }
    } catch (e) { console.warn('RT.reconnectAll:', e && e.message); }
  };

  // Schedule a reconnect with exponential backoff. At most ONE pending reconnect
  // can be queued at a time (mutex). Backoff sequence: 2s, 4s, 8s, 16s, 30s (cap).
  // The backoff resets to 2s the first time any channel reports SUBSCRIBED.
  H.RT.scheduleReconnect = function (reason) {
    if (H.RT._reconnecting) return;    // mutex: ignore if a cycle is already queued
    H.RT._reconnecting = true;
    H.RT._setState('CONNECTING');
    H.RT._backoffAttempt++;
    var delay = Math.min(H.RT._backoffMs, 30000);
    H.RT._backoffMs = Math.min(H.RT._backoffMs * 2, 30000);
    H.RT._log('reconnect', 'scheduled delay=' + delay + 'ms attempt=' + H.RT._backoffAttempt, { reason: reason });
    clearTimeout(H.RT._reconnectTimer);
    H.RT._reconnectTimer = setTimeout(function () {
      H.RT._reconnecting = false;
      if (!document.hidden) {
        H.RT.reconnectAll(reason || 'backoff');
      } else {
        H.RT._log('reconnect', 'deferred:hidden', { reason: reason });
        H.RT._setState('OFFLINE');
      }
    }, delay);
  };

  // ── Realtime for shop reviews (live ratings / new reviews) ───────
  // Reuses the existing in-place section refresh (H.fetchShopReviews) so only
  // the reviews block redraws — never the whole page. Requires 'business_reviews'
  // in the Supabase realtime publication; if it is not, this no-ops silently and
  // the 30s BusinessShop poll keeps reviews fresh. We deliberately do NOT
  // schedule reconnects from this channel: a CHANNEL_ERROR here most likely means
  // the table is simply unpublished, and reconnecting would loop pointlessly.
  H._setupRealtimeReviews = function () {
    var s = sb(); if (!s || typeof s.channel !== 'function') return;
    if (H._reviewsChannel) { try { s.removeChannel(H._reviewsChannel); } catch (e) {} H._reviewsChannel = null; }
    try {
      H._reviewsChannel = s.channel('reviews-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'business_reviews' }, function (payload) {
          var row = payload.new || payload.old; if (!row) return;
          var bizId = row.business_id; if (!bizId) return;
          var pg = H.currentPageName;
          var viewing = (pg === 'BusinessShop' || pg === 'BusinessProfile') &&
            H.currentPageParams && String(H.currentPageParams.id) === String(bizId);
          if (viewing && typeof H.fetchShopReviews === 'function') H.fetchShopReviews(bizId);
        })
        .subscribe(function (status) {
          if (status === 'CHANNEL_ERROR') console.warn('reviews realtime unavailable (business_reviews not in publication?) — poll fallback active');
        });
    } catch (e) { H._reviewsChannel = null; }
  };

  // ===================================================================
  // UNIFIED FEED UPDATE PIPELINE  (H.applyFeedUpdate)
  // Single point of truth for all mutations to H.state.listings and
  // H.state.businesses.
  //
  // ARCHITECTURE CONTRACT (server is the source of truth):
  //   • The server snapshot ALWAYS wins. Local state is a cache/projection of
  //     server data and never overrides it.
  //   • NO persistent tombstones or deletion caches. The only client-side
  //     reconciliation state is two SHORT-LIVED in-memory structures, both
  //     keyed by row id and never persisted to storage:
  //       _rtInsertWindow(Biz) — an item just INSERTed via realtime that a
  //         poll snapshot taken microseconds earlier may not contain yet.
  //       _pendingDeletes      — an item the user just deleted/deactivated,
  //         so an already-in-flight poll cannot momentarily resurrect it.
  //     Both expire on a few-second TTL; after that, the server snapshot is
  //     taken verbatim.
  // ===================================================================

  // ── Short-lived in-memory reconciliation structures (never persisted) ────────
  H._rtInsertWindow    = H._rtInsertWindow    || {};   // { id: insertedAtMs }
  H._rtInsertWindowBiz = H._rtInsertWindowBiz || {};   // same for businesses
  var _RT_WIN_MS = 5000;                               // 5s insert-race window

  // Pending optimistic deletes: { id: expiresAtMs }. Lets an in-flight poll
  // that started BEFORE a user delete avoid re-adding the row for a brief
  // window. Strictly temporary — NOT a tombstone: it self-expires and is never
  // written to localStorage, so the server snapshot wins as soon as it lands.
  H._pendingDeletes = H._pendingDeletes || {};
  var _PENDING_DELETE_MS = 10000;                      // 10s reconciliation window

  H.markPendingDelete = function (id) {
    if (id != null) H._pendingDeletes[id] = Date.now() + _PENDING_DELETE_MS;
  };
  function _isPendingDelete(id) {
    var exp = H._pendingDeletes[id];
    if (!exp) return false;
    if (Date.now() > exp) { delete H._pendingDeletes[id]; return false; }
    return true;
  }
  function _prunePendingDeletes() {
    var now = Date.now();
    Object.keys(H._pendingDeletes).forEach(function (id) {
      if (now > H._pendingDeletes[id]) delete H._pendingDeletes[id];
    });
  }

  // ===================================================================
  // STATE MERGE  (H.resolveStateConflict) — SERVER ALWAYS WINS
  // resolveStateConflict(local, server)
  //   Returns { action: 'accept', data } where data is the server row with
  //   any purely local-only fields (UI-derived props the server does not send)
  //   preserved. Server-provided fields ALWAYS take precedence — local values
  //   never override the server, and this function never rejects an update.
  //   The legacy (source, evt) args are accepted but ignored for callsite
  //   compatibility.
  // ===================================================================
  H.resolveStateConflict = function (local, server /*, source, evt */) {
    if (!server) return { action: 'accept', data: local || null };
    // Merge server OVER local: server keys win; local-only keys (not present on
    // the server row) are retained. This is a projection refresh, not a merge
    // that could let a stale local value mask server truth.
    var out = local ? Object.assign({}, local, server) : Object.assign({}, server);
    out._updatedAt = server.updatedAt || server.createdAt || Date.now();
    return { action: 'accept', data: out };
  };

  // ===================================================================
  // applyFeedUpdate(payload, source)
  //   payload.type: 'listing_event' | 'listings_full'
  //                 'business_event' | 'businesses_full'
  // ===================================================================
  H._lastRtEvent = H._lastRtEvent || 0;

  H.applyFeedUpdate = function (payload, source) {
    if (!payload) return;
    H._lastRtEvent = Date.now();   // realtime is delivering events — stale-check resets
    H.RT._log('pipeline', '[1] event received', { type: payload.type, evt: payload.evt, source: source, id: (payload.data && payload.data.id) || payload.id });
    H.state.listings   = H.state.listings   || [];
    H.state.businesses = H.state.businesses || [];
    var type = payload.type;

    // ── Single listing event from realtime ──────────────────────────────────────
    if (type === 'listing_event') {
      var evt    = payload.evt;
      var mapped = payload.data;
      var delId  = payload.id || (mapped && mapped.id);

      if (evt === 'DELETE') {
        if (delId) {
          H.state.listings = H.state.listings.filter(function (l) { return l.id !== delId; });
          H.markPendingDelete(delId);   // brief in-flight-poll guard, self-expiring
          delete H._rtInsertWindow[delId];
          H.RT._log('feed', 'listing DELETE', { id: delId });
        }

      } else if (evt === 'INSERT' || evt === 'UPDATE') {
        if (!mapped) return;
        // A fresh server event is authoritative — clear any pending-delete guard.
        delete H._pendingDeletes[mapped.id];
        if (mapped.status === 'active') {
          var idx = H.state.listings.findIndex(function (l) { return l.id === mapped.id; });
          if (idx >= 0) {
            H.state.listings[idx] = H.resolveStateConflict(H.state.listings[idx], mapped).data;
          } else {
            H.state.listings.unshift(H.resolveStateConflict(null, mapped).data);
            if (evt === 'INSERT') H._rtInsertWindow[mapped.id] = Date.now();
          }
        } else {
          // Status changed to non-active (sold/deleted/pending) — drop from feed.
          H.state.listings = H.state.listings.filter(function (l) { return l.id !== mapped.id; });
          H.markPendingDelete(mapped.id);
          delete H._rtInsertWindow[mapped.id];
        }
      }
      H.RT._log('pipeline', '[2] data merged', { type: type, evt: evt, listings: H.state.listings.length });
      H.saveState && H.saveState();

    // ── Full listings result from server (poll / startup) ───────────────────────
    } else if (type === 'listings_full') {
      var cloud = payload.data || [];
      var now   = Date.now();

      // 1. Dedup server array by id (guards against any DB-level anomaly)
      var seen = {};
      cloud = cloud.filter(function (l) {
        if (seen[l.id]) return false; seen[l.id] = true; return true;
      });
      var cloudIds = seen;

      // 2. Drop rows the user just deleted/deactivated locally if this snapshot
      //    was already in flight when they did so (brief, self-expiring guard).
      cloud = cloud.filter(function (l) { return !_isPendingDelete(l.id); });

      // 3. Server wins: take each server row verbatim, preserving only local-only
      //    UI fields. No version checks, no local overrides.
      var localById = {};
      H.state.listings.forEach(function (l) { if (l.status === 'active') localById[l.id] = l; });
      cloud = cloud.map(function (serverItem) {
        return H.resolveStateConflict(localById[serverItem.id] || null, serverItem).data;
      });

      // 4. Realtime-insert race guard: keep items INSERTed via realtime in the
      //    last 5 s that this (slightly stale) snapshot did not include yet.
      var rtSafe = H.state.listings.filter(function (l) {
        var ts = H._rtInsertWindow[l.id];
        return ts && (now - ts < _RT_WIN_MS) && !cloudIds[l.id];
      });

      // 5. Non-active local items (the user's own pending/sold posts) — these
      //    come from a different query and are not contradicted by this snapshot.
      var nonActive = H.state.listings.filter(function (l) { return l.status !== 'active'; });

      // 6. Expire the short-lived reconciliation structures.
      Object.keys(H._rtInsertWindow).forEach(function (id) {
        if (now - H._rtInsertWindow[id] >= _RT_WIN_MS) delete H._rtInsertWindow[id];
      });
      _prunePendingDeletes();

      H.state.listings = rtSafe.concat(cloud).concat(nonActive);
      H.RT._log('feed', 'listings_full applied', { server: cloud.length, rtSafe: rtSafe.length, nonActive: nonActive.length });
      H.RT._log('pipeline', '[2] data merged', { type: 'listings_full', total: H.state.listings.length });
      H.saveState && H.saveState();
      if (typeof H._pruneCache === 'function') H._pruneCache('listings');

    // ── Single business event from realtime ─────────────────────────────────────
    } else if (type === 'business_event') {
      var bevt    = payload.evt;
      var bmapped = payload.data;
      var bdelId  = payload.id || (bmapped && bmapped.id);

      if (bevt === 'DELETE') {
        if (bdelId) {
          H.state.businesses = H.state.businesses.filter(function (b) { return b.id !== bdelId; });
          H.markPendingDelete(bdelId);   // brief in-flight-poll guard, self-expiring
          delete H._rtInsertWindowBiz[bdelId];
          H.RT._log('feed', 'business DELETE', { id: bdelId });
        }

      } else if (bevt === 'INSERT' || bevt === 'UPDATE') {
        if (!bmapped) return;
        // A fresh server event is authoritative — clear any pending-delete guard.
        delete H._pendingDeletes[bmapped.id];
        // Only ACTIVE (admin-approved) businesses are public. Pending/draft/
        // suspended ones must not appear in the shared feed.
        if (bmapped.status === 'active') {
          var bidx = H.state.businesses.findIndex(function (b) { return b.id === bmapped.id; });
          if (bidx >= 0) {
            H.state.businesses[bidx] = H.resolveStateConflict(H.state.businesses[bidx], bmapped).data;
          } else {
            H.state.businesses.unshift(H.resolveStateConflict(null, bmapped).data);
            if (bevt === 'INSERT') H._rtInsertWindowBiz[bmapped.id] = Date.now();
          }
        } else {
          var _meId = (H.currentUser && H.currentUser() || {}).id;
          if (bmapped.ownerUserId && _meId && String(bmapped.ownerUserId) === String(_meId)) {
            // The owner's OWN non-active business stays in state so their
            // management view keeps it; the public feed hides it via the
            // status==='active' filter on Home / Local Shops.
            var _oidx = H.state.businesses.findIndex(function (b) { return b.id === bmapped.id; });
            if (_oidx >= 0) H.state.businesses[_oidx] = H.resolveStateConflict(H.state.businesses[_oidx], bmapped).data;
            else H.state.businesses.push(H.resolveStateConflict(null, bmapped).data);
          } else {
            H.state.businesses = H.state.businesses.filter(function (b) { return b.id !== bmapped.id; });
            H.markPendingDelete(bmapped.id);
          }
          delete H._rtInsertWindowBiz[bmapped.id];
        }
      }
      H.saveState && H.saveState();

    // ── Full businesses result from server (poll) ────────────────────────────────
    } else if (type === 'businesses_full') {
      var bcloud = payload.data || [];
      var bnow   = Date.now();

      // 1. Dedup server array by id
      var bseen = {};
      bcloud = bcloud.filter(function (b) {
        if (bseen[b.id]) return false; bseen[b.id] = true; return true;
      });
      var bcloudIds = bseen;

      // 2. Drop rows the user just deleted/deactivated if this snapshot raced.
      bcloud = bcloud.filter(function (b) { return !_isPendingDelete(b.id); });

      // 3. Server wins: this snapshot IS the authoritative set of active
      //    businesses. Take each server row verbatim (preserving local-only UI
      //    fields). Active businesses NOT in the snapshot have been
      //    suspended/removed server-side and must drop out of the public feed.
      var bLocalById = {};
      H.state.businesses.forEach(function (b) { if (b.status === 'active') bLocalById[b.id] = b; });
      var bMerged = bcloud.map(function (bm) {
        return H.resolveStateConflict(bLocalById[bm.id] || null, bm).data;
      });

      // 4. Keep the current user's OWN non-active businesses (draft/pending/
      //    suspended) — these come from fetchMyBusinesses, not this active-only
      //    snapshot, and the owner's management view needs them.
      var _meIdB = (H.currentUser && H.currentUser() || {}).id;
      var ownNonActive = H.state.businesses.filter(function (b) {
        return b.status !== 'active' && _meIdB && String(b.ownerUserId) === String(_meIdB);
      });

      // 5. Preserve businesses INSERTed via realtime in the last 5 s that this
      //    (slightly stale) snapshot did not include yet.
      var bRtSafe = H.state.businesses.filter(function (b) {
        var ts = H._rtInsertWindowBiz[b.id];
        return ts && (bnow - ts < _RT_WIN_MS) && !bcloudIds[b.id];
      });

      H.state.businesses = bRtSafe.concat(bMerged).concat(ownNonActive);

      // 6. Expire the short-lived reconciliation structures.
      Object.keys(H._rtInsertWindowBiz).forEach(function (id) {
        if (bnow - H._rtInsertWindowBiz[id] >= _RT_WIN_MS) delete H._rtInsertWindowBiz[id];
      });
      _prunePendingDeletes();

      H.RT._log('feed', 'businesses_full applied', { count: bcloud.length });
      H.RT._log('pipeline', '[2] data merged', { type: 'businesses_full', total: H.state.businesses.length });
      H.saveState && H.saveState();
      if (typeof H._pruneCache === 'function') H._pruneCache('businesses');
    }
  };

  // ===================================================================
  // BATCHED RENDER SCHEDULER  (H._scheduleRender)
  // Groups rapid realtime events (e.g. a burst of inserts) into a single
  // re-render 350 ms after the last update. Prevents scroll jumps and
  // redundant layout recalculations from per-event re-renders.
  //
  // Cancelled / deferred if:
  //   • RM is already mid-render (_inBgRender) — re-queued for 200 ms after
  //   • The visible page changed since scheduling — stale render is skipped
  //
  // Note: only realtime handlers call this. Poll-driven renders go through
  // RM's own sig-compare path, which already debounces via _renderPreserved.
  // ===================================================================
  H._navEpoch        = H._navEpoch        || 0;
  H._renderBatchTimer = null;

  H._scheduleRender = function () {
    if (!H.RM || typeof H.RM._renderPreserved !== 'function') return;
    var capturedPage   = H.currentPageName;
    var capturedParams = H.currentPageParams;
    var capturedEpoch  = H._navEpoch;

    H.RT._log('pipeline', '[3] render queued', { page: capturedPage, epoch: capturedEpoch });
    H.RT._log('render', 'scheduled', { page: capturedPage, epoch: capturedEpoch });

    clearTimeout(H._renderBatchTimer);
    H._renderBatchTimer = setTimeout(function () {
      H._renderBatchTimer = null;
      if (!H.RM || typeof H.RM._renderPreserved !== 'function') return;
      // Cancel if navigation occurred since this render was scheduled
      if (H._navEpoch !== capturedEpoch || H.currentPageName !== capturedPage) {
        H.RT._log('render', 'cancelled:nav', { page: capturedPage, epoch: capturedEpoch });
        return;
      }
      if (H.RM._inBgRender) {

        // RM is mid-render; retry with backoff until it settles (up to 5 attempts)
        var _retries = 0;
        function _retryRender() {
          H._renderBatchTimer = null;
          if (H._navEpoch !== capturedEpoch || H.currentPageName !== capturedPage) return;
          if (!H.RM._inBgRender) {
            H.RT._log('render', 'deferred:fire', { page: capturedPage, attempt: _retries });
            H.RM._renderPreserved(capturedPage, H.currentPageParams);
            return;
          }
          _retries++;
          if (_retries >= 5) {
            H.RT._log('render', 'deferred:abandoned', { page: capturedPage });
            return;
          }
          H._renderBatchTimer = setTimeout(_retryRender, 200 * _retries);
        }
        H._renderBatchTimer = setTimeout(_retryRender, 200);
        return;
      }
      H.RT._log('render', 'fire', { page: capturedPage });
      H.RM._renderPreserved(capturedPage, H.currentPageParams);
    }, 120);
  };

  // ===================================================================
  // CACHE MEMORY MANAGER  (H._pruneCache)
  // Called after every full-fetch. Enforces hard limits on H.state.listings
  // (500) and H.state.businesses (300). Prunes stale non-active entries
  // older than 7 days, and expires the short-lived reconciliation structures.
  // ===================================================================
  H._pruneCache = function (which) {
    var MAX_LISTINGS   = 500;
    var MAX_BUSINESSES = 300;
    var PRUNE_AGE_MS   = 7 * 24 * 60 * 60 * 1000;
    var now            = Date.now();

    if (!which || which === 'listings') {
      var ls = H.state.listings;
      if (ls && ls.length > MAX_LISTINGS) {
        var active = ls.filter(function (l) { return l.status === 'active'; });
        if (active.length > MAX_LISTINGS) {
          active.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          active = active.slice(0, MAX_LISTINGS);
        }
        var kept = ls.filter(function (l) {
          return l.status !== 'active' && (now - (l.createdAt || 0)) <= PRUNE_AGE_MS;
        });
        H.state.listings = active.concat(kept);
        H.RT._log('memory', 'listings pruned', { total: H.state.listings.length });
      }
    }

    if (!which || which === 'businesses') {
      var bz = H.state.businesses;
      if (bz && bz.length > MAX_BUSINESSES) {
        H.state.businesses = bz.filter(function (b) { return b.status === 'active'; })
                               .slice(0, MAX_BUSINESSES);
        H.RT._log('memory', 'businesses pruned', { total: H.state.businesses.length });
      }
    }

    _prunePendingDeletes();
  };

  // ===================================================================
  // BOOTSTRAP — wait for supabase + a signed-in user, then wire everything.
  // ===================================================================
  var tries = 0;
  var _navHooked = false;

  // Wrap navigation functions to increment _navEpoch and cancel any pending
  // batch render. Installed once; idempotent on repeated calls.
  function _hookNavigation() {
    if (_navHooked) return;
    var _wrap = function (orig) {
      return function () {
        H._navEpoch++;
        clearTimeout(H._renderBatchTimer);
        H._renderBatchTimer = null;
        H.RT._log('nav', 'epoch:' + H._navEpoch);
        return orig.apply(this, arguments);
      };
    };
    if (typeof H.navTo     === 'function') { H.navTo     = _wrap(H.navTo);     _navHooked = true; }
    if (typeof H.openInner === 'function') { H.openInner = _wrap(H.openInner); _navHooked = true; }
    if (typeof H.goBack    === 'function') { H.goBack    = _wrap(H.goBack);    _navHooked = true; }
  }

  (function boot() {
    tries++;
    _hookNavigation();   // install nav epoch hooks as soon as H.navTo etc. are available
    if (canRealtime() && me()) {
      H.initPresence();
      H.initReadReceipts();
      if (typeof H._setupRealtimeReviews === 'function') H._setupRealtimeReviews();
      H.touchLastSeen(true);                 // mark active on app open
      // Keep our last_seen fresh while the app is foregrounded.
      if (!H._lastSeenInterval) {
        H._lastSeenInterval = setInterval(function () {
          if (!document.hidden && me()) H.touchLastSeen();
        }, 60000);
      }
      // Connection health monitor — runs every 30 s while foregrounded.
      // Two failure modes handled:
      //   1. Socket disconnected → reconnect channels + throttled catch-up poll.
      //      NOTE: we do NOT call RM.resume() here because resume() resets both
      //      fetch throttle timestamps to 0, causing full SELECT* dumps on every
      //      5-second tick when WebSocket drops on mobile — the primary cause of
      //      runaway egress. Instead we call RM._poll() which respects the 30s
      //      throttle and only fetches when data is actually stale.
      //   2. Socket connected but no event in 60 s — could be a silent channel
      //      drop or a low-traffic table. Poll once (throttle-respecting).
      if (!H._rtHealthInterval) {
        H._rtHealthInterval = setInterval(function () {
          if (document.hidden || !canRealtime()) return;
          var _now = Date.now();
          if (!realtimeConnected()) {
            H._lastRtEvent = _now;
            H.RT.reconnectAll('health');
            if (me() && typeof H.syncConversations === 'function') H.syncConversations().catch(function () {});
            if (me() && typeof H.syncNotifications === 'function') H.syncNotifications().catch(function () {});
            // Throttle-respecting poll — does NOT reset _lastListingsFetch/_lastBizFetch
            var _pg = H.currentPageName; var _pr = H.currentPageParams;
            if (_pg && H.RM && typeof H.RM._poll === 'function') H.RM._poll(_pg, _pr, false);
          } else if (_now - (H._lastRtEvent || 0) > 60000) {
            // Realtime socket up but silent for 60 s — poll once with throttle.
            H._lastRtEvent = _now;
            var _pg = H.currentPageName;
            var _pr = H.currentPageParams;
            if (_pg && H.RM && typeof H.RM._poll === 'function') H.RM._poll(_pg, _pr, false);
            if (me() && typeof H.syncNotifications === 'function') H.syncNotifications().catch(function () {});
          }
        }, 30000);
      }
    } else if (tries < 60) {
      setTimeout(boot, 1000);
    }
  })();

  // ===================================================================
  // LIFECYCLE CALLBACKS  (invoked by lifecycle.js — not registered here)
  // All OS event listeners live in lifecycle.js (single lifecycle owner).
  // These three functions are the RT module's response to each state change.
  // ===================================================================

  // Called by H._onAppStateChange('foreground').
  // Reconnects realtime and catches up on missed user-specific history.
  H._rtOnForeground = function () {
    H.touchLastSeen(true);
    H.RT.reconnectAll('foreground');
    // Short delay lets the network re-establish before syncing history
    // the realtime stream cannot backfill (messages, notifications).
    setTimeout(function () {
      var pg = H.currentPageName;
      if (pg === 'Messages' && typeof H._refreshMessagesPage === 'function') {
        H._refreshMessagesPage();
      } else if (pg === 'Chat' && H._activeChat && typeof H.startChatPolling === 'function') {
        H.startChatPolling(H._activeChat);
      }
      if (me() && typeof H.syncConversations === 'function') H.syncConversations().catch(function () {});
      if (me() && typeof H.syncNotifications === 'function') H.syncNotifications().catch(function () {});
    }, 600);
  };

  // Called by H._onAppStateChange('background').
  H._rtOnBackground = function () {
    if (me()) H.touchLastSeen(true);
  };

  // Called by H._onAppStateChange('online').
  H._rtOnOnline = function () {
    if (!canRealtime()) return;
    H.RT.reconnectAll('online');
    if (!document.hidden && H.RM && typeof H.RM.resume === 'function') H.RM.resume();
  };

})(window.H);
