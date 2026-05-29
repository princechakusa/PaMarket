/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { currentUser, escHtml, timeAgo, uid, toast, modal,
          innerTopbar, emptyState, openInner, goBack, renderPage,
          initials, pushNotif, fmtPrice, ICONS } = H;

  function conversations() {
    if (!Array.isArray(H.state.conversations)) {
      H.state.conversations = [];
      H.saveState();
    }
    const deleted = H.state.deletedConvIds || [];
    return deleted.length
      ? H.state.conversations.filter(function (c) { return !deleted.includes(c.id); })
      : H.state.conversations;
  }

  function users() {
    if (!Array.isArray(H.state.users)) H.state.users = [];
    return H.state.users;
  }

  // Fetch a single user profile from Supabase and cache it, then re-render the current page.
  // Prevents repeated network calls using a per-session pending map.
  H._pendingProfileFetch = H._pendingProfileFetch || {};
  H._resolvedProfileFetch = H._resolvedProfileFetch || {};
  H._resolveOtherName = function(otherId, conv) {
    // Skip if a fetch is already in-flight OR if we've already resolved a non-empty name
    if (!otherId || H._pendingProfileFetch[otherId] || H._resolvedProfileFetch[otherId]) return;
    H._pendingProfileFetch[otherId] = true;
    var sb = window.supabase;
    if (!sb || typeof sb.from !== 'function') { delete H._pendingProfileFetch[otherId]; return; }
    sb.from('profiles')
      .select('id,name,phone,email,avatar,verified,role,status,created_at')
      .eq('id', otherId)
      .single()
      .then(function(res) {
        var p = res && res.data;
        var nameResolved = '';
        if (p) {
          var existing = (H.state.users||[]).find(function(x){ return x.id === p.id; });
          if (existing) {
            if (p.name) { existing.name = p.name; }
            if (p.avatar && !existing.avatar) { existing.avatar = p.avatar; }
            nameResolved = existing.name;
          } else {
            var entry = {
              id: p.id, name: p.name||'', phone: p.phone||'', email: p.email||'',
              avatar: p.avatar||null, verified: !!p.verified, role: p.role||'user',
              status: p.status||'active',
              joinedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now()
            };
            (H.state.users = H.state.users||[]).push(entry);
            nameResolved = entry.name;
          }
        }
        // If profiles table gave no name, fall back to message sender_name
        if (!nameResolved && conv && Array.isArray(conv.messages)) {
          var msgWithName = conv.messages.find(function(m){ return m.from === otherId && m.senderName; });
          if (msgWithName) { nameResolved = msgWithName.senderName; }
          var userEntry = (H.state.users||[]).find(function(x){ return x.id === otherId; });
          if (nameResolved) {
            if (userEntry) { userEntry.name = nameResolved; }
            else { (H.state.users = H.state.users||[]).push({ id: otherId, name: nameResolved, phone: '', email: '', avatar: null, verified: false, role: 'user', status: 'active', joinedAt: Date.now() }); }
          }
        }
        if (nameResolved && conv && !conv.otherName) { conv.otherName = nameResolved; }
        if (nameResolved) {
          // Mark as permanently resolved so we don't re-fetch
          H._resolvedProfileFetch[otherId] = true;
          H.saveState();
          var page = H.currentPageName;
          if (page === 'Messages' || page === 'Chat') { H.renderPage(page); }
        }
        // Always clear the in-flight flag so a future render can retry if name is still empty
        delete H._pendingProfileFetch[otherId];
      })
      .catch(function() {
        // Clear the in-flight flag on error so the next render can retry
        delete H._pendingProfileFetch[otherId];
      });
  };

  function conversationSignature() {
    const u = currentUser();
    if (!u) return '';
    return conversations()
      .filter(c => Array.isArray(c.members) && c.members.includes(u.id))
      .map(c => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        const last = msgs[msgs.length - 1] || {};
        const unread = msgs.filter(m => m.from !== u.id && !m.read).length;
        const otherId = Array.isArray(c.members) ? c.members.find(m => m !== u.id) : '';
        const other = otherId ? users().find(x => x.id === otherId) : null;
        return [c.id, msgs.length, last.id || '', last.t || 0, unread, (other && other.name) || '', (other && other.avatar) || ''].join(':');
      })
      .sort()
      .join('|');
  }

  function otherAvatarFor(c, u) {
    const otherId = c && Array.isArray(c.members) ? c.members.find(m => m !== u.id) : null;
    const other = otherId ? users().find(x => x.id === otherId) : null;
    const ini = other ? initials(other.name || 'Deleted User') : '?';
    const initialsDiv = '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + ini + '</div>';
    return (other && other.avatar)
      ? '<img src="' + escHtml(other.avatar) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'flex\')">'
        + '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + ini + '</div>'
      : initialsDiv;
  }

  function appendThemMessage(thread, avatarHtml, m) {
    if (!thread || !m || thread.querySelector('[data-msg-id="' + escHtml(m.id) + '"]')) return;
    const row = document.createElement('div');
    row.className = 'chat-msg-row them';
    row.setAttribute('data-msg-id', m.id);
    const avaEl = document.createElement('div');
    avaEl.className = 'chat-row-av';
    avaEl.innerHTML = avatarHtml;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble them';
    bubble.innerHTML = escHtml(m.text) + '<div class="chat-bubble-meta">' + timeAgo(m.t) + '</div>';
    row.appendChild(avaEl);
    row.appendChild(bubble);
    thread.appendChild(row);
  }

  // ---------------------------------------------------
  // MESSAGES LIST
  // ---------------------------------------------------
  pages.Messages = function () {
    const u = currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Messages')}
        <div style="padding:20px">${H.emptyState('Sign in required', 'Sign in to view and send messages.', 'Sign In', "H.requireAuth('Sign in to view messages')")}</div>
      </div>`;
    }
    const convos = conversations()
      .filter(c => Array.isArray(c.members) && c.members.includes(u.id) && Array.isArray(c.messages) && c.messages.length)
      .sort((a, b) => {
        const am = (a.messages || [])[( a.messages || []).length - 1] || {};
        const bm = (b.messages || [])[(b.messages || []).length - 1] || {};
        return (bm.t || 0) - (am.t || 0);
      });

    const totalUnread = convos.reduce((sum, c) => sum + (c.messages || []).filter(m => m.from !== u.id && !m.read).length, 0);
    return `<div class="page active">${H.innerTopbar('Messages')}
      <div style="padding:10px 14px;font-size:12px;color:var(--sub);display:flex;align-items:center;justify-content:space-between">${convos.length} conversation${convos.length === 1 ? '' : 's'}${totalUnread > 0 ? '<button onclick="H._markAllRead()" style="background:none;border:none;font-size:12px;font-weight:600;color:#1A3A8F;cursor:pointer;padding:4px 8px;font-family:Inter,sans-serif">Mark all read</button>' : ''}</div>
      <div>
        ${convos.length ? convos.map(c => {
          const otherId = c.members.find(m => m !== u.id);
          // Backfill c.otherName from any message senderName we have
          if (!c.otherName) {
            const sn = ((c.messages || []).find(function(m){ return m.from===otherId && m.senderName; })||{}).senderName;
            if (sn) { c.otherName = sn; H.saveState(); }
          }
          const other   = otherId ? users().find(x => x.id === otherId) : null;
          // If name is still blank, trigger async profile fetch which will re-render when resolved
          if (other && !other.name && otherId) { H._resolveOtherName(otherId, c); }
          else if (!other && otherId && !(c.otherName)) { H._resolveOtherName(otherId, c); }
          const otherDisplayName = (other && other.name) || c.otherName || 'Deleted User';
          const last    = (c.messages || [])[( c.messages || []).length - 1];
          const unread  = (c.messages || []).some(m => m.from !== u.id && !m.read);
          return `<div class="swipe-del-row" style="position:relative;overflow:hidden;background:#ef4444"><div style="position:absolute;right:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;pointer-events:none"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span style="font-size:10px;font-weight:700;color:#fff">Delete</span></div><div class="msg-item" data-cid="${escHtml(c.id)}" onclick="H.openChat('${c.id}')">
            <div class="msg-av">${initials(otherDisplayName)}</div>
            <div class="msg-body">
              <div class="msg-name-row">
                <div class="msg-name">${escHtml(otherDisplayName)}</div>
                <div class="msg-time">${timeAgo(last.t)}</div>
              </div>
              <div class="msg-preview">${last.from === u.id ? 'You: ' : ''}${escHtml(last.text)}</div>
            </div>
            ${unread ? '<div class="msg-unread-dot"></div>' : ''}
          </div></div>`;
        }).join('') : H.emptyState('No messages yet', 'When buyers message you about a listing, it will show up here.', null, null)}
      </div>
    </div>`;
  };

  
  pages.Chat = function ({ id }) {
    const c = conversations().find(x => x.id === id);
    if (!c) return '<div class="page active">' + H.innerTopbar('Chat') + '<div class="empty-state"><div class="empty-title">Conversation not found</div></div></div>';
    const u = currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Chat')}
        <div style="padding:20px">${H.emptyState('Sign in required', 'Sign in to view and send messages.', 'Sign In', "H.requireAuth('Sign in to view messages')")}</div>
      </div>`;
    }
    if (!Array.isArray(c.members)) c.members = [];
    if (!Array.isArray(c.messages)) c.messages = [];
    const otherId = c.members.find(m => m !== u.id);
    // Backfill c.otherName from any message senderName we have
    if (!c.otherName) {
      const sn = ((c.messages || []).find(function(msg){ return msg.from===otherId && msg.senderName; })||{}).senderName;
      if (sn) { c.otherName = sn; H.saveState(); }
    }
    const other = otherId ? (users().find(x => x.id === otherId) || null) : null;
    // If name is still blank, trigger async profile fetch — will re-render when resolved
    if (other && !other.name && otherId) { H._resolveOtherName(otherId, c); }
    else if (!other && otherId && !c.otherName) { H._resolveOtherName(otherId, c); }
    const otherDisplayName = (other && other.name) || c.otherName || 'Deleted User';
    const listing = (state.listings || []).find(l => l.id === c.listingId);
    c.messages.forEach(m => { if (m.from !== u.id) m.read = true; });
    H.saveState();
    if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    H._activeChat = id;

    const otherIni = initials(otherDisplayName);
    const otherAvatarUrl = other && other.avatar;
    const otherAvatar = otherAvatarUrl
      ? '<img src="' + escHtml(otherAvatarUrl) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'flex\')">'
        + '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + otherIni + '</div>'
      : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + otherIni + '</div>';

    const msgs = c.messages.map(function(m) {
      const mine = m.from === u.id;
      if (mine) {
        return '<div class="chat-msg-row me" data-msg-id="' + escHtml(m.id) + '">'
          + '<div class="chat-bubble me">'
          + escHtml(m.text)
          + '<div class="chat-bubble-meta" style="text-align:right">' + timeAgo(m.t) + '</div>'
          + '</div></div>';
      }
      return '<div class="chat-msg-row them" data-msg-id="' + escHtml(m.id) + '">'
        + '<div class="chat-row-av">' + otherAvatar + '</div>'
        + '<div class="chat-bubble them">'
        + escHtml(m.text)
        + '<div class="chat-bubble-meta">' + timeAgo(m.t) + '</div>'
        + '</div></div>';
    }).join('');

    const otherIdSafe = escHtml(otherId || '');
    const hdrSub = (other && other.verified)
      ? '<div class="chat-hdr-sub"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="color:#4ade80">Verified</span></div>'
      : ((other && other.privacySettings && other.privacySettings.showActivity)
         ? '<div class="chat-hdr-sub"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0"></span><span style="color:#4ade80">Online</span></div>'
         : '<div class="chat-hdr-sub">Tap to view profile</div>');
    return '<div id="chatPageWrap" class="page active" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;">'
      + '<div class="chat-header">'
      + '<button class="chat-hdr-back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="chat-hdr-av" onclick="H._chat.showProfile(\'' + otherIdSafe + '\')">' + otherAvatar + '</div>'
      + '<div class="chat-hdr-info" onclick="H._chat.showProfile(\'' + otherIdSafe + '\')">'
      + '<div class="chat-hdr-name">' + escHtml(otherDisplayName) + '</div>'
      + hdrSub + '</div>'
      + '<button class="chat-hdr-menu" onclick="H._chat.openMenu(\'' + otherIdSafe + '\')"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
      + '</div>'
      + (listing ? '<div class="chat-context-strip"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' + escHtml(listing.title) + '</div>' : '')
      + '<div class="chat-thread" id="chatThread"><div class="chat-thread-spacer"></div>'
      + (msgs || '<div style="text-align:center;padding:48px 20px 20px;font-size:14px;color:var(--sub)">No messages yet. Say hello!</div>')
      + '</div>'
      + '<div class="chat-input-bar">'
      + '<input id="chatIn" placeholder="Type a message…" onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();H.sendChat();}">'
      + '<button class="chat-send" onclick="H.sendChat()"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
      + '</div></div>';
  };

  pages.Chat_after = function () {
    if (window._messagesPoll) { clearInterval(window._messagesPoll); window._messagesPoll = null; }
    const t = document.getElementById('chatThread');
    if (t) t.scrollTop = t.scrollHeight;
    const ma = document.getElementById('mainArea');
    if (ma) { ma.style.position = 'relative'; ma.style.overflowY = 'hidden'; ma.scrollTop = 0; }

    // When the virtual keyboard appears, the visual viewport shrinks but the DOM layout does not.
    // Without this, the browser scrolls #mainArea content upward to reveal the input, hiding the chat header.
    // We resize #chatPageWrap to match the visual viewport so the flex layout (header + thread + input)
    // always fits exactly the visible area — header stays pinned at top, input stays above keyboard.
    if (window.visualViewport) {
      function _chatVPResize() {
        const wrap = document.getElementById('chatPageWrap');
        if (!wrap) { window.visualViewport.removeEventListener('resize', _chatVPResize); return; }
        wrap.style.height = window.visualViewport.height + 'px';
        wrap.style.bottom = 'auto';
      }
      window._chatVPHandler = _chatVPResize;
      window.visualViewport.addEventListener('resize', _chatVPResize);
      _chatVPResize();
    }

    setTimeout(() => document.getElementById('chatIn')?.focus(), 200);
    if (H.currentPageParams && H.currentPageParams.id) H.startChatPolling(H.currentPageParams.id);
  };


  H.openChat = function (id) { H.openInner('Chat', { id }); };

  H.startChatWith = function (otherId, listingId) {
    const u = currentUser();
    if (!u) { H.requireAuth('Sign in to message sellers'); return; }
    if (!otherId) { H.toast('Seller profile is not available yet'); return; }
    if (otherId === u.id) { H.toast('You cannot message yourself'); return; }
    // Check if the target user has turned off direct messages
    const targetUser = (H.state.users || []).find(function(x) { return x.id === otherId; });
    if (targetUser && targetUser.privacySettings && targetUser.privacySettings.allowMessages === false) {
      H.toast('This seller has turned off direct messages');
      return;
    }
    // Use deterministic ID so both users get same conversation
    const ids = [u.id, otherId].sort();
    const convId = 'conv_' + ids[0].slice(-6) + '_' + ids[1].slice(-6) + '_' + (listingId||'').slice(-6);
    // If this conv was previously deleted, un-delete it so new messages from this person show
    if (Array.isArray(H.state.deletedConvIds) && H.state.deletedConvIds.includes(convId)) {
      H.state.deletedConvIds = H.state.deletedConvIds.filter(function(id){ return id !== convId; });
    }
    // Resolve the other user's name for display before they reply
    const otherUser = (H.state.users||[]).find(function(x){ return x.id === otherId; });
    const listingObj = listingId ? (H.state.listings||[]).find(function(x){ return x.id === listingId; }) : null;
    const otherName = (otherUser && otherUser.name) || (listingObj && listingObj.sellerName) || '';
    let c = conversations().find(x => x.id === convId);
    if (!c) {
      // Conversation not in state (was deleted and pruned, or never created locally).
      // Re-create it with the correct members so the chat is immediately usable.
      c = { id: convId, members: [u.id, otherId], listingId: listingId||null, messages: [], otherName: otherName };
      if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
      H.state.conversations.push(c);
      H.saveState();
      if (typeof H.ensureConversationInCloud === 'function') H.ensureConversationInCloud(c);
    } else {
      // Conversation exists — ensure members array is complete (sync may have added it with
      // an incomplete members list, e.g. only [u.id] when no received messages were found).
      let dirty = false;
      if (!Array.isArray(c.members)) { c.members = [u.id, otherId]; dirty = true; }
      else if (!c.members.includes(otherId)) { c.members = [u.id, otherId]; dirty = true; }
      if (!c.otherName && otherName) { c.otherName = otherName; dirty = true; }
      if (dirty) H.saveState();
    }
    H.openInner('Chat', { id: convId });
  };

  pages.Messages_after = function () {
    // Mark all received messages as read when the inbox is opened
    const _u = H.currentUser();
    if (_u) {
      let _dirty = false;
      (H.state.conversations || []).forEach(function(c) {
        if (!Array.isArray(c.members) || !c.members.includes(_u.id)) return;
        (c.messages || []).forEach(function(m) {
          if (m.from !== _u.id && !m.read) { m.read = true; _dirty = true; }
        });
      });
      if (_dirty) H.saveState();
      if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    }
    if (window._chatPoll) { clearInterval(window._chatPoll); window._chatPoll = null; }
    if (window._messagesPoll) clearInterval(window._messagesPoll);
    H._refreshMessagesPage();
    window._messagesPoll = setInterval(function () {
      if (H.currentPageName !== 'Messages') {
        clearInterval(window._messagesPoll);
        window._messagesPoll = null;
        return;
      }
      H._refreshMessagesPage();
    }, 5000);
    H._setupMsgSwipe();
  };

  H._refreshMessagesPage = function (opts) {
    opts = opts || {};
    if (H._syncingMessagesPage || !H.currentUser()) return Promise.resolve(false);
    if (opts.skipSync) {
      if (H.currentPageName === 'Messages') H.renderPage('Messages');
      return Promise.resolve(true);
    }
    if (typeof H.syncConversations !== 'function') return Promise.resolve(false);
    H._syncingMessagesPage = true;
    const before = conversationSignature();
    return H.syncConversations().then(function () {
      const after = conversationSignature();
      if (H.currentPageName === 'Messages' && after !== before) H.renderPage('Messages');
      return after !== before;
    }).finally(function () {
      H._syncingMessagesPage = false;
    });
  };

  H.startChatPolling = function(convId) {
    if (window._chatPoll) clearInterval(window._chatPoll);
    window._chatPoll = setInterval(async function() {
      if (H.currentPageName !== 'Chat' || H._activeChat !== convId) {
        clearInterval(window._chatPoll);
        return;
      }
      const conv = conversations().find(c => c.id === convId);
      const idsBefore = new Set(((conv && conv.messages) || []).map(m => m.id));
      if (typeof H.syncConversations === 'function') {
        await H.syncConversations();
      }
      const convAfter = conversations().find(c => c.id === convId);
      if (!convAfter) return;
      // Append only the new messages without a full page re-render
      const thread = document.getElementById('chatThread');
      if (!thread) return;
      const u = H.currentUser();
      if (!u) return;
      const ava2 = otherAvatarFor(convAfter, u);
      const newMsgs = (convAfter.messages || []).filter(m => !idsBefore.has(m.id));
      newMsgs.forEach(function(m) {
        if (m.from === u.id) return;
        m.read = true;
        appendThemMessage(thread, ava2, m);
      });
      thread.scrollTop = thread.scrollHeight;
      H.saveState();
      if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    }, 4000);
  };

  H._appendChatMessages = function (convId, msgs) {
    if (H.currentPageName !== 'Chat' || !H.currentPageParams || H.currentPageParams.id !== convId) return false;
    const thread = document.getElementById('chatThread');
    const u = H.currentUser();
    const conv = conversations().find(c => c.id === convId);
    if (!thread || !u || !conv) return false;
    const ava = otherAvatarFor(conv, u);
    let appended = false;
    (msgs || []).forEach(function(m) {
      if (!m || m.from === u.id) return;
      m.read = true;
      appendThemMessage(thread, ava, m);
      appended = true;
    });
    if (appended) {
      thread.scrollTop = thread.scrollHeight;
      H.saveState();
    }
    return appended;
  };


  // syncConversations is defined in app.js (cloud-aware version)


  H.sendChat = async function () {
    if (H.checkBan && H.checkBan()) return;
    const inp = document.getElementById('chatIn');
    const text = inp ? inp.value.trim() : '';
    if (!text) return;
    const c = conversations().find(function(x){ return x.id === H._activeChat; });
    if (!c) return;
    const u = H.currentUser();
    var msgId = H.uid();
    var msgT = Date.now();
    c.messages.push({ id: msgId, from: u.id, senderName: u.name||'', text: text, t: msgT, read: false });
    H.saveState();
    inp.value = '';
    // Append to DOM directly — no full page re-render to avoid flicker
    const thread = document.getElementById('chatThread');
    if (thread) {
      const row = document.createElement('div');
      row.className = 'chat-msg-row me';
      row.setAttribute('data-msg-id', msgId);
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble me';
      bubble.innerHTML = escHtml(text) + '<div class="chat-bubble-meta" style="text-align:right">just now</div>';
      row.appendChild(bubble);
      thread.appendChild(row);
      thread.scrollTop = thread.scrollHeight;
    }
    try {
      // Try to persist the conversation entry (non-fatal if table doesn't exist yet)
      if (typeof H.ensureConversationInCloud === 'function') {
        H.ensureConversationInCloud(c).catch(function(e){ console.warn('conv sync (non-fatal):', e.message); });
      }
      // Save the message — this is what matters
      var msgSaved = false;
      if (typeof H.saveMessageToCloud === 'function') {
        var cloudResult = await H.saveMessageToCloud(c.id, c.messages[c.messages.length - 1]);
        if (cloudResult && cloudResult.ok === false) throw new Error(cloudResult.error || 'Message sync failed');
        msgSaved = true;
      }
      if (!msgSaved && window.supabase && typeof window.supabase.from === 'function') {
        var r = await window.supabase.from('messages').insert({
          id: msgId, conversation_id: c.id,
          sender_id: u.id, sender_name: u.name || '',
          text: text, created_at: new Date(msgT).toISOString(), read: false
        });
        if (r && r.error) throw new Error(r.error.message);
      }
      var otherId = c.members.find(function(m){ return m !== u.id; });
      if (otherId && typeof H.pushNotif === 'function') H.pushNotif(otherId, 'New Message', (u.name || 'Someone') + ': ' + text.slice(0, 80), 'message');
    } catch(e) {
      console.warn('Msg cloud error:', e.message);
      H.toast('Message could not be sent. Check your connection and try again.', 5000, true);
    }
  };


  H._setupMsgSwipe = function () {
    document.querySelectorAll('.swipe-del-row').forEach(function (row) {
      var inner = row.querySelector('.msg-item');
      if (!inner) return;
      var convId = inner.dataset.cid;
      var startX = 0, startY = 0, dx = 0, hor = false, swiped = false;
      var THRESHOLD = 72;

      row.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        dx = 0; hor = false; swiped = false;
        inner.style.transition = 'none';
      }, { passive: true });

      row.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dxNow = t.clientX - startX;
        var dyNow = t.clientY - startY;
        if (!hor) {
          if (Math.abs(dxNow) > 8 && Math.abs(dxNow) > Math.abs(dyNow)) hor = true;
          else if (Math.abs(dyNow) > 8) return;
          else return;
        }
        dx = Math.min(0, dxNow);
        inner.style.transform = 'translateX(' + dx + 'px)';
        swiped = Math.abs(dx) > 10;
      }, { passive: true });

      row.addEventListener('touchend', function () {
        if (!hor) return;
        inner.style.transition = 'transform .22s ease';
        if (dx <= -THRESHOLD) {
          inner.style.transform = 'translateX(-110%)';
          setTimeout(function () { H._deleteConversation(convId); }, 240);
        } else {
          inner.style.transform = 'translateX(0)';
        }
        hor = false;
      });

      inner.addEventListener('click', function (e) {
        if (swiped) { e.preventDefault(); e.stopImmediatePropagation(); swiped = false; }
      }, true);
    });
  };

  H._deleteConversation = function (convId) {
    // Mark as deleted locally — do NOT delete from Supabase so the other party keeps their messages
    if (!Array.isArray(H.state.deletedConvIds)) H.state.deletedConvIds = [];
    if (!H.state.deletedConvIds.includes(convId)) H.state.deletedConvIds.push(convId);
    H.state.conversations = (H.state.conversations || []).filter(function (c) { return c.id !== convId; });
    H.saveState();
    if (H.currentPageName === 'Messages') H.renderPage('Messages');
  };

  // ── Chat menu: block, view profile, report ───────────────
  H._chat = {
    openMenu(userId) {
      const u = H.currentUser();
      const other = (H.state.users || []).find(x => x.id === userId);
      const name = other ? escHtml(other.name || 'User') : 'User';
      const isBlocked = ((H.currentUser() || {}).blockedUsers || []).includes(userId);
      H.modal({
        title: name,
        body: `<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">
          <button onclick="H.closeModal();setTimeout(()=>H._chat.showProfile('${escHtml(userId)}'),80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>View Profile &amp; Listings
          </button>
          <button onclick="H.closeModal();setTimeout(()=>H._chat.blockUser('${escHtml(userId)}'),80)" style="width:100%;padding:13px;background:${isBlocked?'var(--bg)':'#FEF2F2'};border:1px solid ${isBlocked?'var(--border)':'#FECACA'};border-radius:12px;font-size:15px;font-weight:600;color:${isBlocked?'var(--text)':'#DC2626'};cursor:pointer;font-family:inherit;text-align:left">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>${isBlocked ? 'Unblock User' : 'Block User'}
          </button>
          <button onclick="H.closeModal();setTimeout(()=>H._chat.reportUser('${escHtml(userId)}'),80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Report
          </button>
        </div>`,
        confirmText: null,
        cancelText: 'Close',
      });
    },

    showProfile(userId) {
      const other = (H.state.users || []).find(x => x.id === userId);
      if (!other) { H.toast('Profile not available'); return; }
      const listings = (H.state.listings || []).filter(l => l.sellerId === userId && l.status === 'active');
      const ini = H.initials(other.name || 'U');
      const avatar = other.avatar
        ? `<img src="${escHtml(other.avatar)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:none;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${ini}</div>`
        : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${ini}</div>`;
      const listingCards = listings.slice(0, 4).map(l => {
        const ph = (l.photos && l.photos[0])
          ? `<img src="${escHtml(l.photos[0])}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0">`
          : `<div style="width:52px;height:52px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>`;
        return `<div onclick="H.closeModal();setTimeout(()=>H.openListing('${l.id}'),80)" style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--bg);border-radius:10px;cursor:pointer">
          ${ph}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
            <div style="font-size:12px;color:var(--blue);font-weight:700">${escHtml(H.fmtPrice(l.price, l.currency))}</div>
          </div>
        </div>`;
      }).join('');
      const phone = other.phone ? escHtml(other.phone) : '';
      const waPhone = other.phone ? other.phone.replace(/\D/g, '') : '';
      H.modal({
        title: escHtml(other.name || 'User'),
        body: `<div style="font-family:'Inter',-apple-system,sans-serif">
          <div style="text-align:center;padding:16px 0 20px">
            <div style="display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
              ${other.avatar
                ? `<img src="${escHtml(other.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:none;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;font-family:'Inter',-apple-system,sans-serif">${ini}</div>`
                : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;font-family:'Inter',-apple-system,sans-serif">${ini}</div>`}
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--text);font-family:'Inter',-apple-system,sans-serif">${escHtml(other.name || 'User')}${other.verified ? '&nbsp;<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#22c55e" stroke-width="2.5" style="vertical-align:middle;margin-bottom:2px"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
            ${other.joinedAt ? `<div style="font-size:12px;color:var(--sub);margin-top:5px;font-family:'Inter',-apple-system,sans-serif">Member since ${new Date(other.joinedAt).toLocaleDateString()}</div>` : ''}
            ${other.phone ? `<div style="font-size:12px;color:var(--sub);margin-top:3px;font-family:'Inter',-apple-system,sans-serif">${phone}</div>` : ''}
          </div>
          <div style="border-top:1px solid var(--border);margin:0 -4px"></div>
          <div style="padding-top:16px">
            ${listings.length
              ? `<div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;font-family:'Inter',-apple-system,sans-serif">Active Listings (${listings.length})</div>
                 <div style="display:flex;flex-direction:column;gap:8px">${listingCards}</div>`
              : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:10px 0;font-family:'Inter',-apple-system,sans-serif">No active listings</div>`}
          </div>
          ${other.phone ? `<div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <button onclick="H.callSeller('${phone}')" style="flex:1;padding:11px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',-apple-system,sans-serif">Call</button>
            <button onclick="window.open('https://wa.me/${waPhone}','_blank')" style="flex:1;padding:11px;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',-apple-system,sans-serif">WhatsApp</button>
          </div>` : ''}
        </div>`,
        confirmText: null,
        cancelText: 'Close',
      });
    },

    blockUser(userId) {
      const u = H.currentUser();
      if (!u) return;
      if (!Array.isArray(u.blockedUsers)) u.blockedUsers = [];
      const already = u.blockedUsers.includes(userId);
      if (already) {
        u.blockedUsers = u.blockedUsers.filter(id => id !== userId);
        H.saveState();
        H.toast('User unblocked');
      } else {
        u.blockedUsers.push(userId);
        H.saveState();
        H.toast('User blocked — you will no longer receive messages from them');
        H.goBack();
      }
    },

    reportUser(userId) {
      const other = (H.state.users || []).find(x => x.id === userId);
      if (!Array.isArray(H.state.reports)) H.state.reports = [];
      const u = H.currentUser();
      const rep = { id: H.uid(), reporterId: u.id, targetType: 'user', targetId: userId,
        reason: 'Reported from chat', t: Date.now(), status: 'open' };
      H.state.reports.push(rep);
      H.saveState();
      H.toast('Report submitted — our team will review within 24 hours');
      if (window.supabase && typeof window.supabase.from === 'function') {
        window.supabase.from('reports').insert({ id: rep.id, reporter_id: rep.reporterId,
          target_type: 'user', target_id: userId, reason: rep.reason,
          created_at: new Date(rep.t).toISOString(), status: 'open' }).catch(() => {});
      }
    },
  };

  H._markAllRead = function() {
    const u = H.currentUser();
    if (!u) return;
    (H.state.conversations || []).forEach(c => {
      if (Array.isArray(c.messages)) {
        c.messages.forEach(m => {
          if (m.from !== u.id) m.read = true;
        });
      }
    });
    H.saveState();
    H.updateMsgBadge && H.updateMsgBadge();
    H.openInner('Messages');
  };

})(window.H);
