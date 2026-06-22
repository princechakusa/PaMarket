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
  // BOOTSTRAP — wait for supabase + a signed-in user, then wire everything.
  // ===================================================================
  var tries = 0;
  (function boot() {
    tries++;
    if (canRealtime() && me()) {
      H.initPresence();
      H.initReadReceipts();
      H.touchLastSeen(true);                 // mark active on app open
      // Keep our last_seen fresh while the app is foregrounded.
      if (!H._lastSeenInterval) {
        H._lastSeenInterval = setInterval(function () {
          if (!document.hidden && me()) H.touchLastSeen();
        }, 60000);
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
    H.initPresence(); H.initReadReceipts();
    H.touchLastSeen(true);
    // Re-subscribe to listings/businesses realtime channels — the WebSocket
    // may have been dropped while the app was in the background.
    if (typeof H._setupRealtimeListings   === 'function') H._setupRealtimeListings();
    if (typeof H._setupRealtimeBusinesses === 'function') H._setupRealtimeBusinesses();
    // Small delay so the network re-establishes after an app switch.
    setTimeout(function () {
      var pg = H.currentPageName;
      // Messages page: kick its own poll immediately instead of waiting up to 5 s.
      if (pg === 'Messages' && typeof H._refreshMessagesPage === 'function') {
        H._refreshMessagesPage();
      // Chat page: restart the poll so new messages appear instantly.
      } else if (pg === 'Chat' && H._activeChat && typeof H.startChatPolling === 'function') {
        H.startChatPolling(H._activeChat);
      }
      // Sync user-specific cloud data (conversations + notifications) for badge
      // counts and so the next poll cycle starts from a fresh baseline.
      if (me() && typeof H.syncConversations === 'function') H.syncConversations().catch(function () {});
      if (me() && typeof H.syncNotifications === 'function') H.syncNotifications().catch(function () {});
    }, 800);
  }

  // App open/close/background — keep presence + last_seen accurate.
  document.addEventListener('visibilitychange', function () {
    if (!me()) return;
    if (document.hidden) {
      H.touchLastSeen(true);                 // record the moment we left
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
        if (!me()) return;
        if (st && st.isActive) { onForeground(); }
        else { H.touchLastSeen(true); }
      });
    }
  } catch (e) {}

})(window.H);
