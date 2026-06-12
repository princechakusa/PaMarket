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
        // Auto-clear if the "stopped" event is ever missed.
        clearTimeout(H._otherTypingClear);
        if (H._otherTyping) {
          H._otherTypingClear = setTimeout(function () {
            H._otherTyping = false;
            if (typeof H._renderTyping === 'function') H._renderTyping(false);
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
  // BOOTSTRAP — wait for supabase + a signed-in user, then wire everything.
  // ===================================================================
  var tries = 0;
  (function boot() {
    tries++;
    if (canRealtime() && me()) {
      H.initPresence();
      H.initReadReceipts();
    } else if (tries < 60) {
      setTimeout(boot, 1000);
    }
  })();

  // Re-establish presence after returning to the app.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && me()) { H.initPresence(); H.initReadReceipts(); }
  });

})(window.H);
