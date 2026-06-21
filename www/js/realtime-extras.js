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

  H.RT._setState = function (s) {
    if (H.RT._state !== s) H.RT._state = s;
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
    clearTimeout(H.RT._reconnectTimer);
    H.RT._reconnectTimer = setTimeout(function () {
      H.RT._reconnecting = false;
      if (!document.hidden) {
        H.RT.reconnectAll(reason || 'backoff');
      } else {
        // App is backgrounded — skip now, onForeground will reconnect when visible.
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
  // H.state.businesses. Called by:
  //   • Realtime handlers  (source = 'realtime') — individual INSERT/UPDATE/DELETE
  //   • fetchListingsFromSupabase / fetchAllActiveBusinesses (source = 'poll')
  //
  // Cache conflict rules
  // ────────────────────
  // listings_full   Server active listings replace local active listings.
  //                 Non-active (pending/banned) local items are preserved —
  //                 they come from the user's own posts not yet approved.
  //                 Items received via a realtime INSERT within the last 5 s
  //                 that did not appear in the server response are also kept
  //                 (query-vs-realtime race guard: the INSERT was committed
  //                 after the server query window closed but before our
  //                 realtime event arrived).
  //
  // listing_event   INSERT: add to front if not already present (id dedup).
  //                 UPDATE: merge, server wins — skipped if item has
  //                         _pendingSync=true (local write in-flight).
  //                 DELETE: always remove.
  //
  // businesses_full Upsert-merge each server item; never overwrite a local
  //                 logo/cover with null (cloud-write race condition where
  //                 the image CDN URL was not yet committed on read).
  //
  // business_event  Same merge rules as listing_event + null logo/cover guard.
  // ===================================================================

  // Track ids added via realtime INSERT so a concurrent full fetch cannot
  // silently drop items that arrived after the query window closed.
  H._rtInsertWindow    = H._rtInsertWindow    || {};
  H._rtInsertWindowBiz = H._rtInsertWindowBiz || {};
  var _RT_WIN_MS = 5000;

  H.applyFeedUpdate = function (payload, source) {
    if (!payload) return;
    H.state.listings   = H.state.listings   || [];
    H.state.businesses = H.state.businesses || [];
    var type = payload.type;

    // ── Single listing event from realtime ──────────────────────────────────────
    if (type === 'listing_event') {
      var evt    = payload.evt;
      var mapped = payload.data;
      var delId  = payload.id;

      if (evt === 'DELETE') {
        H.state.listings = H.state.listings.filter(function (l) { return l.id !== delId; });
        delete H._rtInsertWindow[delId];

      } else if (evt === 'INSERT' || evt === 'UPDATE') {
        if (!mapped) return;
        if (mapped.status === 'active') {
          var idx = H.state.listings.findIndex(function (l) { return l.id === mapped.id; });
          if (idx >= 0) {
            if (H.state.listings[idx]._pendingSync && source === 'realtime') return;
            H.state.listings[idx] = Object.assign({}, H.state.listings[idx], mapped);
          } else {
            H.state.listings.unshift(mapped);
            if (evt === 'INSERT') H._rtInsertWindow[mapped.id] = Date.now();
          }
        } else {
          H.state.listings = H.state.listings.filter(function (l) { return l.id !== mapped.id; });
          delete H._rtInsertWindow[mapped.id];
        }
      }
      H.saveState && H.saveState();

    // ── Full listings result from server (poll / startup) ───────────────────────
    } else if (type === 'listings_full') {
      var cloud    = payload.data || [];
      var now      = Date.now();
      var cloudIds = {};
      cloud.forEach(function (l) { cloudIds[l.id] = true; });

      // Non-active local items (user's pending/banned listings).
      var nonActive = H.state.listings.filter(function (l) { return l.status !== 'active'; });

      // Realtime-insert race guard: keep items added by a realtime event within
      // the last 5 s that didn't make it into this server query's result window.
      var rtSafe = H.state.listings.filter(function (l) {
        var ts = H._rtInsertWindow[l.id];
        return ts && (now - ts < _RT_WIN_MS) && !cloudIds[l.id];
      });

      // Purge stale window entries.
      Object.keys(H._rtInsertWindow).forEach(function (id) {
        if (now - H._rtInsertWindow[id] >= _RT_WIN_MS) delete H._rtInsertWindow[id];
      });

      H.state.listings = rtSafe.concat(cloud).concat(nonActive);
      H.saveState && H.saveState();

    // ── Single business event from realtime ─────────────────────────────────────
    } else if (type === 'business_event') {
      var bevt    = payload.evt;
      var bmapped = payload.data;
      var bdelId  = payload.id;

      if (bevt === 'DELETE') {
        H.state.businesses = H.state.businesses.filter(function (b) { return b.id !== bdelId; });
        delete H._rtInsertWindowBiz[bdelId];

      } else if (bevt === 'INSERT' || bevt === 'UPDATE') {
        if (!bmapped) return;
        if (bmapped.status === 'active') {
          var bidx = H.state.businesses.findIndex(function (b) { return b.id === bmapped.id; });
          if (bidx >= 0) {
            var bprev = H.state.businesses[bidx];
            if (!bmapped.logo  && bprev.logo)  bmapped.logo  = bprev.logo;
            if (!bmapped.cover && bprev.cover) bmapped.cover = bprev.cover;
            H.state.businesses[bidx] = Object.assign({}, bprev, bmapped);
          } else {
            H.state.businesses.unshift(bmapped);
            if (bevt === 'INSERT') H._rtInsertWindowBiz[bmapped.id] = Date.now();
          }
        } else {
          H.state.businesses = H.state.businesses.filter(function (b) { return b.id !== bmapped.id; });
          delete H._rtInsertWindowBiz[bmapped.id];
        }
      }
      H.saveState && H.saveState();

    // ── Full businesses result from server (poll) ────────────────────────────────
    } else if (type === 'businesses_full') {
      var bcloud  = payload.data || [];
      var bnow    = Date.now();
      H.state.businesses = H.state.businesses || [];

      bcloud.forEach(function (bm) {
        var bi = H.state.businesses.findIndex(function (b) { return b.id === bm.id; });
        if (bi >= 0) {
          var bp = H.state.businesses[bi];
          if (!bm.logo  && bp.logo)  bm.logo  = bp.logo;
          if (!bm.cover && bp.cover) bm.cover = bp.cover;
          H.state.businesses[bi] = Object.assign({}, bp, bm);
        } else {
          H.state.businesses.push(bm);
        }
      });

      // Purge stale business insert-window entries.
      Object.keys(H._rtInsertWindowBiz).forEach(function (id) {
        if (bnow - H._rtInsertWindowBiz[id] >= _RT_WIN_MS) delete H._rtInsertWindowBiz[id];
      });

      H.saveState && H.saveState();
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
  H._renderBatchTimer = null;

  H._scheduleRender = function () {
    if (!H.RM || typeof H.RM._renderPreserved !== 'function') return;
    var capturedPage   = H.currentPageName;
    var capturedParams = H.currentPageParams;

    clearTimeout(H._renderBatchTimer);
    H._renderBatchTimer = setTimeout(function () {
      H._renderBatchTimer = null;
      if (!H.RM || typeof H.RM._renderPreserved !== 'function') return;
      if (H.currentPageName !== capturedPage) return;   // navigated away — skip
      if (H.RM._inBgRender) {
        // RM is already rendering; re-queue so we run cleanly after it settles.
        H._renderBatchTimer = setTimeout(function () {
          H._renderBatchTimer = null;
          if (H.currentPageName === capturedPage && !H.RM._inBgRender) {
            H.RM._renderPreserved(capturedPage, H.currentPageParams);
          }
        }, 200);
        return;
      }
      H.RM._renderPreserved(capturedPage, H.currentPageParams);
    }, 350);
  };

  // ===================================================================
  // BOOTSTRAP — wait for supabase + a signed-in user, then wire everything.
  // ===================================================================
  var tries = 0;
  (function boot() {
    tries++;
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
      // Connection health monitor (lightweight polling fallback). Every 30s while
      // foregrounded, if the realtime socket is DOWN, reconnect every channel and
      // do a one-off catch-up sync. This costs nothing while realtime is healthy
      // (the common case) — it is gated on actual disconnection, so it never burns
      // data when the live stream is working. That is the deliberate design: rely
      // on realtime when it works, poll only when it doesn't.
      if (!H._rtHealthInterval) {
        H._rtHealthInterval = setInterval(function () {
          if (document.hidden || !canRealtime()) return;
          if (!realtimeConnected()) {
            H.RT.reconnectAll('health');
            if (me() && typeof H.syncConversations === 'function') H.syncConversations().catch(function () {});
            if (me() && typeof H.syncNotifications === 'function') H.syncNotifications().catch(function () {});
            if (H.RM && typeof H.RM.resume === 'function') H.RM.resume();
          }
        }, 30000);
      }
    } else if (tries < 60) {
      setTimeout(boot, 1000);
    }
  })();

  // Refresh data after the app returns to the foreground.
  // RM (refresh-manager.js) handles re-fetching and re-rendering all RM-managed
  // pages (Home, Browse, categories, Notifications, etc.) via its own
  // appStateChange + visibilitychange listeners. Here we handle:
  //   • presence / last-seen housekeeping
  //   • user-specific data (conversations, notifications) that RM doesn't own
  //   • immediate kick for Messages / Chat, which use their own polls outside RM
  function onForeground() {
    H.touchLastSeen(true);
    // Re-establish EVERY realtime channel through the supervisor (listings,
    // businesses, reviews, messages, notifications, presence, receipts + the open
    // chat). The WebSocket is frequently dropped by the OS while backgrounded.
    H.RT.reconnectAll('foreground');
    // Short delay so the network re-establishes after an app switch, then catch
    // up on history the realtime stream can't backfill (messages / notifications
    // that arrived while we were away) and kick the page-specific polls.
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
  }

  // App open/close/background. onForeground reconnects realtime (public channels
  // need no auth; user channels self-gate on me()), so we call it even when
  // signed out — that keeps the public feed live for browsing visitors too.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (me()) H.touchLastSeen(true);       // record the moment we left
    } else {
      onForeground();
    }
  });
  // Native (Capacitor) background/foreground — covers Android app-switch where
  // visibilitychange can be unreliable.
  try {
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && typeof App.addListener === 'function') {
      App.addListener('appStateChange', function (st) {
        if (st && st.isActive) { onForeground(); }
        else if (me()) { H.touchLastSeen(true); }
      });
    }
  } catch (e) {}

  // Network recovery — when the device regains connectivity (mobile data toggled,
  // Wi-Fi reconnected, tunnel re-established) the realtime socket is usually dead.
  // Reconnect every channel and immediately refresh the visible page so content
  // catches up the instant the connection returns.
  window.addEventListener('online', function () {
    if (!canRealtime()) return;
    H.RT.reconnectAll('online');
    if (!document.hidden && H.RM && typeof H.RM.resume === 'function') H.RM.resume();
  });

})(window.H);
