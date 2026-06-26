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
    return H.state.conversations.filter(function(c) {
      return c && !deleted.includes(c.id) && !c.otherDeleted;
    });
  }

  function users() {
    if (!Array.isArray(H.state.users)) H.state.users = [];
    return H.state.users;
  }

  // Collapse duplicate 1-to-1 conversations that share the same two members
  // (e.g. a legacy listing-keyed thread + the new per-person thread both pulled
  // from the cloud). Messages are merged (de-duped) into one canonical thread so
  // each person appears once. Returns true if anything changed.
  H._mergeDuplicateConversations = function () {
    const u = currentUser();
    if (!u) return false;
    const convs = H.state.conversations;
    if (!Array.isArray(convs) || convs.length < 2) return false;
    const groups = {};
    convs.forEach(function (c) {
      if (!c || !Array.isArray(c.members) || c.members.length < 2) return;
      if (String(c.id).indexOf('job_') === 0) return;                 // keep job chats separate
      if (String(c.id).indexOf('biz_') === 0) return;                 // keep business chats separate
      if (c.members.map(String).indexOf(String(u.id)) === -1) return;
      const key = c.members.map(String).sort().join('|');
      (groups[key] = groups[key] || []).push(c);
    });
    let changed = false;
    const removeIds = [];
    Object.keys(groups).forEach(function (key) {
      const group = groups[key];
      if (group.length < 2) return;
      const sorted = key.split('|').sort();
      const pairKey = 'conv_' + sorted[0].slice(-6) + '_' + sorted[1].slice(-6);
      // Canonical: the open chat (don't pull the rug out) > deterministic pairKey > most messages.
      let canonical = group.find(function (c) { return c.id === H._activeChat; })
        || group.find(function (c) { return c.id === pairKey; })
        || group.slice().sort(function (a, b) { return (b.messages || []).length - (a.messages || []).length; })[0];
      // Merge every thread's messages into the canonical one, de-duped.
      const seen = {};
      const merged = [];
      group.forEach(function (c) {
        (c.messages || []).forEach(function (m) {
          const k = m.id || (m.from + '|' + m.t + '|' + (m.text || m.image || ''));
          if (seen[k]) { if (m.read) seen[k].read = true; return; }
          seen[k] = m; merged.push(m);
        });
      });
      merged.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
      canonical.messages = merged;
      group.forEach(function (c) {
        if (c === canonical) return;
        if (!canonical.listingId && c.listingId) canonical.listingId = c.listingId;
        if (!canonical.otherName && c.otherName) canonical.otherName = c.otherName;
        removeIds.push(c.id);
      });
      changed = true;
    });
    if (changed) {
      H.state.conversations = convs.filter(function (c) { return removeIds.indexOf(c.id) === -1; });
      H.saveState();
    }
    return changed;
  };

  // Fetch a single user profile from Supabase and cache it, then re-render the current page.
  // Prevents repeated network calls using a per-session pending map.
  H._pendingProfileFetch = H._pendingProfileFetch || {};
  H._resolvedProfileFetch = H._resolvedProfileFetch || {};

  // ── Chat draft persistence ────────────────────────────────────
  H._chatDrafts = H._chatDrafts || {};
  H._saveChatDraft = function (convId, text) {
    if (!convId) return;
    H._chatDrafts[convId] = text || '';
    if (H._saveDraftTimer) clearTimeout(H._saveDraftTimer);
    if (!text) {
      // Immediately persist the clear so _getChatDraft doesn't return stale text
      H.state._chatDrafts = H.state._chatDrafts || {};
      H.state._chatDrafts[convId] = '';
      H.saveState();
      H._saveDraftTimer = null;
      return;
    }
    H._saveDraftTimer = setTimeout(function () {
      H.state._chatDrafts = H.state._chatDrafts || {};
      H.state._chatDrafts[convId] = text;
      H.saveState();
      H._saveDraftTimer = null;
    }, 800);
  };
  H._clearChatDraft = function (convId) {
    if (!convId) return;
    if (H._saveDraftTimer) { clearTimeout(H._saveDraftTimer); H._saveDraftTimer = null; }
    delete H._chatDrafts[convId];
    if (H.state._chatDrafts) delete H.state._chatDrafts[convId];
  };
  H._getChatDraft = function (convId) {
    if (!convId) return '';
    // Use `in` so an explicitly saved '' (cleared) overrides a stale persisted value
    if (H._chatDrafts && convId in H._chatDrafts) return H._chatDrafts[convId];
    return (H.state._chatDrafts && H.state._chatDrafts[convId]) || '';
  };
  H._resolveOtherName = function(otherId, conv) {
    // Skip if a fetch is already in-flight OR if we've already resolved a non-empty name
    // Fetch a given profile at most once per session — prevents a render→fetch
    // →render loop (which caused the Messages list to flicker for contacts who
    // have no avatar). The avatar is still applied on that one fetch below.
    if (!otherId || H._pendingProfileFetch[otherId] || H._resolvedProfileFetch[otherId]) return;
    H._pendingProfileFetch[otherId] = true;
    var sb = window.supabase;
    if (!sb || typeof sb.from !== 'function') { delete H._pendingProfileFetch[otherId]; return; }
    sb.from('profiles')
      .select('id,name,phone,email,avatar,verified,role,status,created_at')
      .eq('id', otherId)
      .maybeSingle()
      .then(function(res) {
        var p = res && res.data;
        var nameResolved = '';
        if (p) {
          var existing = (H.state.users||[]).find(function(x){ return x.id === p.id; });
          if (existing) {
            if (p.name) { existing.name = p.name; }
            if (p.avatar) { existing.avatar = p.avatar; }
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
          H._resolvedProfileFetch[otherId] = true;
          H.saveState();
          // Re-render WITH the current params (renderPage(page) alone dropped the
          // chat id and dumped the user on "Conversation not found"), and never
          // while they're typing a message.
          var page = H.currentPageName;
          if ((page === 'Messages' || page === 'Chat') && !(H._userIsTyping && H._userIsTyping())) {
            H.renderPage(page, H.currentPageParams);
          }
        } else if (res && res.data) {
          // Row exists but no usable name (rare) — stop retrying to avoid churn.
          H._resolvedProfileFetch[otherId] = true;
        } else if (res && !res.data && !res.error) {
          // No profile row at all (maybeSingle → null, no error) = deleted account.
          // Mark resolved so we don't retry forever (which showed "PaMarket User").
          H._resolvedProfileFetch[otherId] = true;
          if (conv && !conv.otherDeleted && !(conv.id && String(conv.id).startsWith('biz_'))) {
            conv.otherDeleted = true;
            H.saveState();
            if (H.currentPageName === 'Messages') H.renderPage('Messages');
          }
        }
        delete H._pendingProfileFetch[otherId];
      })
      .catch(function() {
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
    const ini = other ? initials(other.name || 'PaMarket User') : '?';
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
    row.appendChild(avaEl);
    const _of = parseOffer(m.text);
    if (_of) {
      const holder = document.createElement('div');
      holder.innerHTML = offerCardHtml(_of, false, m.id, H._activeOtherName || '');
      if (holder.firstChild) row.appendChild(holder.firstChild);
    } else {
      const bwrap = document.createElement('div');
      bwrap.className = 'msg-bwrap msg-bwrap-them';
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble them' + (m.image ? ' chat-bubble-img' : '');
      if (m.image) {
        bubble.innerHTML = '<img src="' + escHtml(m.image) + '" class="chat-img" onclick="H._chat.viewImg(\'' + escHtml(m.image) + '\')" onerror="this.style.display=\'none\'">';
      } else {
        bubble.innerHTML = replyQuoteHtml(m) + escHtml(msgText(m));
      }
      bubble.innerHTML += '<div class="chat-bubble-meta">' + timeAgo(m.t) + '</div>';
      bwrap.appendChild(bubble);
      const _rhtml = _reactionsHtml(m, H.currentUser() && H.currentUser().id);
      if (_rhtml) bwrap.insertAdjacentHTML('beforeend', _rhtml);
      row.appendChild(bwrap);
    }
    const typing = thread.querySelector('#chatTyping');
    if (typing) thread.insertBefore(row, typing); else thread.appendChild(row);
  }

  // ---------------------------------------------------
  // SHARED AVATAR / RECEIPT HELPERS  (used by list + chat)
  // ---------------------------------------------------
  const AV_PALETTE = ['#1E88E5','#00897B','#8E24AA','#F4511E','#3949AB','#00838F','#C2185B','#43A047','#6D4C41','#5E35B1','#0277BD','#AD1457'];
  H.avatarColorFor = function (seed) {
    let h = 0; const s = String(seed || 'x');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AV_PALETTE[h % AV_PALETTE.length];
  };
  // Coloured circular avatar (image if present, else gradient initials).
  function listAvatarHtml(other, name, color, cls) {
    const ini = initials(name || '?');
    const grad = 'background:linear-gradient(135deg,' + color + ',' + color + 'bb)';
    if (other && other.avatar) {
      return '<img src="' + escHtml(other.avatar) + '" class="' + cls + '" style="object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
        + '<span class="' + cls + '" style="display:none;' + grad + '">' + ini + '</span>';
    }
    return '<span class="' + cls + '" style="' + grad + '">' + ini + '</span>';
  }
  // ✓ sent / ✓✓ read tick for the current user's own last message.
  function previewTick(read) {
    return '<span class="msg-rr' + (read ? ' read' : '') + '">' + (read ? '✓✓' : '✓') + '</span>';
  }
  H._previewTick = previewTick;

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
    if (typeof H.initPresence === 'function') H.initPresence();
    H._mergeDuplicateConversations();

    const tab = H._msgTab || 'personal';
    const myBizIds = new Set((H.state.businesses || []).filter(function (b) { return b.ownerUserId === u.id; }).map(function (b) { return b.id; }));

    const allConvs = conversations()
      .filter(c => Array.isArray(c.members) && c.members.includes(u.id) && Array.isArray(c.messages) && c.messages.length)
      .sort((a, b) => {
        const am = (a.messages || [])[(a.messages || []).length - 1] || {};
        const bm = (b.messages || [])[(b.messages || []).length - 1] || {};
        return (bm.t || 0) - (am.t || 0);
      });

    const personalConvs = allConvs.filter(function (c) { return !c.businessId && !(typeof c.id === 'string' && c.id.indexOf('biz_') === 0); });
    const bizConvs      = allConvs.filter(function (c) { return !!c.businessId || (typeof c.id === 'string' && c.id.indexOf('biz_') === 0); });
    const personalUnread = personalConvs.reduce((s, c) => s + (c.messages || []).filter(m => m.from !== u.id && !m.read).length, 0);
    const bizUnread      = bizConvs.reduce((s, c) => s + (c.messages || []).filter(m => m.from !== u.id && !m.read).length, 0);
    const hasBizTab      = bizConvs.length > 0 || myBizIds.size > 0;

    function _tabBadge(unread, count) {
      return unread > 0
        ? ' <span style="background:#EF4444;color:#fff;border-radius:99px;padding:1px 7px;font-size:11px;font-weight:700;vertical-align:middle">' + unread + '</span>'
        : (count ? ' (' + count + ')' : '');
    }
    const tabBar = hasBizTab
      ? '<div style="display:flex;border-bottom:2px solid var(--border,#E8ECF4)">'
        + '<button onclick="H._switchMsgTab(\'personal\')" style="flex:1;padding:13px 8px;background:none;border:none;border-bottom:3px solid ' + (tab === 'personal' ? '#1A3A8F' : 'transparent') + ';margin-bottom:-2px;font-size:14px;font-weight:' + (tab === 'personal' ? '700' : '500') + ';color:' + (tab === 'personal' ? '#1A3A8F' : 'var(--sub)') + ';cursor:pointer;font-family:inherit">Personal' + _tabBadge(personalUnread, personalConvs.length) + '</button>'
        + '<button onclick="H._switchMsgTab(\'business\')" style="flex:1;padding:13px 8px;background:none;border:none;border-bottom:3px solid ' + (tab === 'business' ? '#1A3A8F' : 'transparent') + ';margin-bottom:-2px;font-size:14px;font-weight:' + (tab === 'business' ? '700' : '500') + ';color:' + (tab === 'business' ? '#1A3A8F' : 'var(--sub)') + ';cursor:pointer;font-family:inherit">Business' + _tabBadge(bizUnread, bizConvs.length) + '</button>'
        + '</div>'
      : '';

    // ── PERSONAL TAB ─────────────────────────────────────────
    function renderPersonalTab() {
      const convos = personalConvs;
      if (!convos.length) return H.emptyState('No messages yet', 'When buyers message you about a listing, it will show up here.', null, null);
      const totalUnread = convos.reduce((sum, c) => sum + (c.messages || []).filter(m => m.from !== u.id && !m.read).length, 0);
      const summary = `${convos.length} chat${convos.length === 1 ? '' : 's'}${totalUnread > 0 ? ` · ${totalUnread} unread` : ''}`;
      return `<div class="msg-search-bar"><div class="msg-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input id="msgSearch" type="text" placeholder="Search conversations" autocomplete="off" oninput="H._filterMsgList(this.value)">
        </div></div>
        <div class="msg-summary"><b>${summary}</b>${totalUnread > 0 ? '<button onclick="H._markAllRead()" class="msg-markall">Mark all read</button>' : ''}</div>
        ${convos.map(c => {
          const otherId = Array.isArray(c.members) ? c.members.find(m => m !== u.id) : null;
          if (!c.otherName) {
            const sn = ((c.messages || []).find(function (m) { return m.from === otherId && m.senderName; }) || {}).senderName;
            if (sn) { c.otherName = sn; H.saveState(); }
          }
          const other = otherId ? users().find(x => x.id === otherId) : null;
          if (other && !other.name && otherId) { H._resolveOtherName(otherId, c); }
          else if (!other && otherId && !(c.otherName)) { H._resolveOtherName(otherId, c); }
          const otherDisplayName = (other && other.name) || c.otherName || (c.otherDeleted ? 'Deleted User' : 'PaMarket User');
          const msgs = c.messages || [];
          const last = msgs[msgs.length - 1];
          if (!last) return '';
          const unreadCount = msgs.filter(m => m.from !== u.id && !m.read).length;
          const unread = unreadCount > 0;
          const mine = last.from === u.id;
          const color = H.avatarColorFor(otherId || otherDisplayName);
          const online = typeof H.isUserOnline === 'function' && H.isUserOnline(otherId);
          const verified = other && other.verified;
          const _lastOffer = parseOffer(last.text);
          const previewBody = _lastOffer
            ? MIC.offer + (_lastOffer.k === 'accept' ? 'Offer accepted' : _lastOffer.k === 'decline' ? 'Offer declined' : (_lastOffer.k === 'counter' ? 'Counter: $' : 'Offer: $') + Number(_lastOffer.price || 0).toLocaleString())
            : (last.image ? MIC.photo + 'Photo' : escHtml(msgPreview(last)));
          const _convDraft = typeof H._getChatDraft === 'function' ? H._getChatDraft(c.id) : '';
          const preview = _convDraft
            ? '<span style="color:#F5A623;font-weight:700">Draft: </span>' + escHtml(_convDraft.slice(0, 50))
            : (mine ? previewTick(!!last.read) + ' ' : '') + previewBody;
          return `<div class="swipe-del-row" style="position:relative;overflow:hidden;background:#ef4444"><div style="position:absolute;right:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;pointer-events:none"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span style="font-size:10px;font-weight:700;color:#fff">Delete</span></div><div class="msg-item${unread ? ' unread' : ''}" data-cid="${escHtml(c.id)}" data-oid="${escHtml(otherId || '')}" onclick="H.openChat('${c.id}')">
              <div class="p-av-wrap">${listAvatarHtml({ avatar: other && other.avatar }, otherDisplayName, color, 'p-av')}${online ? '<span class="p-on"></span>' : ''}</div>
              <div class="msg-body">
                <div class="msg-name-row">
                  <div class="msg-name">${escHtml(otherDisplayName)}${verified ? ' ' + H.verifiedBadge(13) : ''}</div>
                  <div class="msg-time${unread ? ' u' : ''}">${timeAgo(last.t)}</div>
                </div>
                <div class="msg-preview${unread ? ' unread' : ''}">${preview}</div>
              </div>
              ${unread ? `<div class="msg-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
            </div></div>`;
        }).join('')}`;
    }

    // ── BUSINESS TAB ─────────────────────────────────────────
    function renderBizTab() {
      // Owner-side: one grouped entry per shop I own
      const ownerBizConvs = bizConvs.filter(function (c) { return myBizIds.has(c.businessId); });
      const ownerGroups = {};
      ownerBizConvs.forEach(function (c) { (ownerGroups[c.businessId] = ownerGroups[c.businessId] || []).push(c); });

      const ownerEntries = Object.keys(ownerGroups).map(function (bizId) {
        const convs = ownerGroups[bizId];
        const biz = (H.state.businesses || []).find(function (b) { return b.id === bizId; });
        if (!biz) return '';
        const latestMsg = convs.reduce(function (latest, c) {
          const msgs = c.messages || []; const last = msgs[msgs.length - 1];
          return (!latest || (last && last.t > (latest.t || 0))) ? last : latest;
        }, null);
        const totalUnread = convs.reduce(function (s, c) { return s + (c.messages || []).filter(function (m) { return m.from !== u.id && !m.read; }).length; }, 0);
        const color = H.avatarColorFor(biz.id || biz.name);
        const listOther = { avatar: biz.logo || null };
        const unread = totalUnread > 0;
        return `<div class="msg-item${unread ? ' unread' : ''}" onclick="H.openInner('BusinessShopInbox',{id:'${escHtml(biz.id)}'})">
          <div class="p-av-wrap">${listAvatarHtml(listOther, biz.name, color, 'p-av')}</div>
          <div class="msg-body">
            <div class="msg-name-row">
              <div class="msg-name">${escHtml(biz.name)}</div>
              <div class="msg-time${unread ? ' u' : ''}">${latestMsg ? timeAgo(latestMsg.t) : ''}</div>
            </div>
            <div class="msg-preview${unread ? ' unread' : ''}">Shop inbox · ${convs.length} inquiry${convs.length === 1 ? '' : 'ies'}${totalUnread > 0 ? ' · ' + totalUnread + ' unread' : ''}</div>
          </div>
          ${unread ? `<div class="msg-badge">${totalUnread > 99 ? '99+' : totalUnread}</div>` : ''}
        </div>`;
      }).join('');

      // Buyer-side: my conversations with shops
      const buyerBizConvs = bizConvs.filter(function (c) { return !myBizIds.has(c.businessId); });
      const buyerEntries = buyerBizConvs.map(function (c) {
        const _mBiz = (H.state.businesses || []).find(function (b) { return b.id === c.businessId; }) || null;
        const listName = _mBiz ? _mBiz.name : (c.otherName || 'Shop');
        const listOther = _mBiz ? { avatar: _mBiz.logo || null } : null;
        const msgs = c.messages || [];
        const last = msgs[msgs.length - 1];
        if (!last) return '';
        const unreadCount = msgs.filter(function (m) { return m.from !== u.id && !m.read; }).length;
        const unread = unreadCount > 0;
        const mine = last.from === u.id;
        const color = H.avatarColorFor(_mBiz ? (_mBiz.id || listName) : listName);
        const _lastOffer = parseOffer(last.text);
        const previewBody = _lastOffer
          ? MIC.offer + (_lastOffer.k === 'accept' ? 'Offer accepted' : _lastOffer.k === 'decline' ? 'Offer declined' : (_lastOffer.k === 'counter' ? 'Counter: $' : 'Offer: $') + Number(_lastOffer.price || 0).toLocaleString())
          : (last.image ? MIC.photo + 'Photo' : escHtml(msgPreview(last)));
        const preview = (mine ? previewTick(!!last.read) + ' ' : '') + previewBody;
        return `<div class="msg-item${unread ? ' unread' : ''}" onclick="H.openChat('${escHtml(c.id)}')">
          <div class="p-av-wrap">${listAvatarHtml(listOther, listName, color, 'p-av')}</div>
          <div class="msg-body">
            <div class="msg-name-row">
              <div class="msg-name">${escHtml(listName)}</div>
              <div class="msg-time${unread ? ' u' : ''}">${timeAgo(last.t)}</div>
            </div>
            <div class="msg-preview${unread ? ' unread' : ''}">${preview}</div>
          </div>
          ${unread ? `<div class="msg-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
        </div>`;
      }).join('');

      const hasContent = ownerEntries || buyerEntries;
      return hasContent
        ? (ownerEntries + buyerEntries)
        : H.emptyState('No business messages', 'Tap Message on any shop to start chatting.', null, null);
    }

    const content = tab === 'business' ? renderBizTab() : renderPersonalTab();
    return `<div class="page active">${H.innerTopbar('Messages')}
      <div id="notifEnableBanner"></div>
      ${tabBar}
      <div id="msgList">${content}</div>
    </div>`;
  };

  // Client-side filter for the conversation search box.
  H._filterMsgList = function (q) {
    q = (q || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#msgList .swipe-del-row');
    rows.forEach(function (row) {
      const item = row.querySelector('.msg-item');
      const name = (item && item.querySelector('.msg-name') ? item.querySelector('.msg-name').textContent : '').toLowerCase();
      const prev = (item && item.querySelector('.msg-preview') ? item.querySelector('.msg-preview').textContent : '').toLowerCase();
      row.style.display = (!q || name.indexOf(q) !== -1 || prev.indexOf(q) !== -1) ? '' : 'none';
    });
  };

  
  pages.Chat = function ({ id }) {
    try {
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
    // One-time avatar fetch for the chat header (only if we have the name but no
    // photo). The guard is set BEFORE the fetch so it can never re-fire — no loop.
    H._chatAvatarTried = H._chatAvatarTried || {};
    if (otherId && other && other.name && !other.avatar && !H._chatAvatarTried[otherId]) {
      H._chatAvatarTried[otherId] = true;
      var _sbAv = window.supabase;
      if (_sbAv && typeof _sbAv.from === 'function') {
        _sbAv.from('profiles').select('avatar').eq('id', otherId).maybeSingle().then(function (res) {
          var p = res && res.data;
          if (!p || !p.avatar) return;
          var ex = (H.state.users || []).find(function (x) { return x.id === otherId; });
          if (ex && ex.avatar !== p.avatar) {
            ex.avatar = p.avatar;
            H.saveState();
            if (H.currentPageName === 'Chat' && !(H._userIsTyping && H._userIsTyping())) H.renderPage('Chat', H.currentPageParams);
          }
        }).catch(function () {});
      }
    }
    const otherDisplayName = (other && other.name) || c.otherName || (c.otherDeleted ? 'Deleted User' : 'PaMarket User');
    // Only show the linked listing card to the buyer. The seller already knows
    // it is their own item; showing it on their side looks like the other
    // person's listing.
    const listing = (H.state.listings || []).find(function(l) {
      return l.id === c.listingId && String(l.sellerId || l.userId || '') !== String(u.id);
    });
    c.messages.forEach(m => { if (m.from !== u.id) m.read = true; });
    H.saveState();
    if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    H._activeChat = id;
    if (H._chat) H._chat.replyTarget = null;   // no carried-over reply target

    // Business-branded chat: customer sees shop name/logo; owner sees the customer as normal
    const _bizChatId = c.businessId || null;
    const _bizChat = _bizChatId ? ((H.state.businesses||[]).find(function(b){ return b.id === _bizChatId; }) || null) : null;
    const showBizBrand = !!(_bizChat && _bizChat.ownerUserId !== u.id);
    const chatDisplayName = showBizBrand ? _bizChat.name : otherDisplayName;
    const otherIni = initials(chatDisplayName);
    const otherAvatarUrl = showBizBrand ? (_bizChat.logo || null) : (other && other.avatar);
    const otherAvatar = otherAvatarUrl
      ? '<img src="' + escHtml(otherAvatarUrl) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'flex\')">'
        + '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + otherIni + '</div>'
      : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + otherIni + '</div>';
    H._chatOtherAvatar = otherAvatar;
    H._activeOtherId = otherId || '';
    H._activeOtherName = chatDisplayName;

    // Date separators between calendar days + ✓/✓✓ receipts on the user's own messages.
    let lastDay = '';
    const msgs = c.messages.map(function(m, idx) {
      let sep = '';
      const dl = chatDayLabel(m.t);
      if (dl !== lastDay) { lastDay = dl; sep = '<div class="chat-datesep"><span>' + escHtml(dl) + '</span></div>'; }
      const mine = m.from === u.id;
      const _of = parseOffer(m.text);
      if (_of) {
        const resolved = (_of.k === 'offer' || _of.k === 'counter') &&
          c.messages.slice(idx + 1).some(function(later) {
            const lof = parseOffer(later.text);
            return lof && (lof.k === 'accept' || lof.k === 'decline' || lof.k === 'counter');
          });
        return sep + '<div class="chat-msg-row ' + (mine ? 'me' : 'them') + '" data-msg-id="' + escHtml(m.id) + '">'
          + (mine ? '' : '<div class="chat-row-av">' + otherAvatar + '</div>')
          + offerCardHtml(_of, mine, m.id, otherDisplayName, resolved)
          + '</div>';
      }
      const content = m.deleted
        ? '<span style="font-style:italic;opacity:.5;font-size:13px">This message was deleted</span>'
        : m.image
          ? '<img src="' + escHtml(m.image) + '" class="chat-img" onclick="H._chat.viewImg(\'' + escHtml(m.image) + '\')" onerror="this.style.display=\'none\'">'
          : (replyQuoteHtml(m) + escHtml(msgText(m)));
      // Business-branded chat: buyer messages go RIGHT (me), shop replies go LEFT (them)
      if (showBizBrand) {
        if (mine) {
          return sep + '<div class="chat-msg-row me" data-msg-id="' + escHtml(m.id) + '">'
            + '<div class="msg-bwrap msg-bwrap-me">'
            + '<div class="chat-bubble me' + (m.image ? ' chat-bubble-img' : '') + '">'
            + content
            + '<div class="chat-bubble-meta" style="text-align:right">Sent to ' + escHtml(chatDisplayName) + ' · ' + timeAgo(m.t) + '</div>'
            + '</div>' + _reactionsHtml(m, u.id) + '</div></div>';
        }
        return sep + '<div class="chat-msg-row them" data-msg-id="' + escHtml(m.id) + '">'
          + '<div class="chat-row-av">' + otherAvatar + '</div>'
          + '<div class="msg-bwrap msg-bwrap-them">'
          + '<div class="chat-bubble them' + (m.image ? ' chat-bubble-img' : '') + '">'
          + content
          + '<div class="chat-bubble-meta">' + escHtml(chatDisplayName) + ' · ' + timeAgo(m.t) + '</div>'
          + '</div>' + _reactionsHtml(m, u.id) + '</div></div>';
      }
      // Owner's view of a business inbox chat: label bubbles by shop name vs buyer name
      const _isOwnerBizChat = !!(_bizChat && _bizChatId);
      if (_isOwnerBizChat) {
        const _shopLabel = escHtml(_bizChat.name || 'Shop');
        const _buyerLabel = escHtml(otherDisplayName);
        if (mine) {
          return sep + '<div class="chat-msg-row me" data-msg-id="' + escHtml(m.id) + '">'
            + '<div class="msg-bwrap msg-bwrap-me">'
            + '<div class="chat-bubble me' + (m.image ? ' chat-bubble-img' : '') + '">'
            + content
            + '<div class="chat-bubble-meta" style="text-align:right">' + _shopLabel + ' · ' + timeAgo(m.t) + ' ' + chatTick(!!m.read) + '</div>'
            + '</div>' + _reactionsHtml(m, u.id) + '</div></div>';
        }
        return sep + '<div class="chat-msg-row them" data-msg-id="' + escHtml(m.id) + '">'
          + '<div class="chat-row-av">' + otherAvatar + '</div>'
          + '<div class="msg-bwrap msg-bwrap-them">'
          + '<div class="chat-bubble them' + (m.image ? ' chat-bubble-img' : '') + '">'
          + content
          + '<div class="chat-bubble-meta">' + _buyerLabel + ' · ' + timeAgo(m.t) + '</div>'
          + '</div>' + _reactionsHtml(m, u.id) + '</div></div>';
      }
      if (mine) {
        return sep + '<div class="chat-msg-row me" data-msg-id="' + escHtml(m.id) + '">'
          + '<div class="msg-bwrap msg-bwrap-me">'
          + '<div class="chat-bubble me' + (m.image ? ' chat-bubble-img' : '') + '">'
          + content
          + (m.edited ? '<span style="font-size:10px;opacity:.55"> · edited</span>' : '')
          + '<div class="chat-bubble-meta" style="text-align:right">' + timeAgo(m.t) + ' ' + chatTick(!!m.read) + '</div>'
          + '</div>' + _reactionsHtml(m, u.id) + '</div></div>';
      }
      return sep + '<div class="chat-msg-row them" data-msg-id="' + escHtml(m.id) + '">'
        + '<div class="chat-row-av">' + otherAvatar + '</div>'
        + '<div class="msg-bwrap msg-bwrap-them">'
        + '<div class="chat-bubble them' + (m.image ? ' chat-bubble-img' : '') + '">'
        + content
        + (m.edited ? '<span style="font-size:10px;opacity:.55"> · edited</span>' : '')
        + '<div class="chat-bubble-meta">' + timeAgo(m.t) + '</div>'
        + '</div>' + _reactionsHtml(m, u.id) + '</div></div>';
    }).join('');

    const otherIdSafe = escHtml(otherId || '');
    const onlineNow = typeof H.isUserOnline === 'function' && H.isUserOnline(otherId);
    return '<div id="chatPageWrap" class="page active" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;">'
      + '<div class="chat-header">'
      + '<button class="chat-hdr-back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="chat-hdr-av" onclick="' + (showBizBrand ? 'H.openBusinessShop&&H.openBusinessShop(\'' + escHtml(_bizChatId||'') + '\')' : 'H._chat.showProfile(\'' + otherIdSafe + '\')') + '">' + otherAvatar + (onlineNow ? '<span style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#22C55E;border:2px solid var(--card);display:block"></span>' : '') + '</div>'
      + '<div class="chat-hdr-info" onclick="' + (showBizBrand ? 'H.openBusinessShop&&H.openBusinessShop(\'' + escHtml(_bizChatId||'') + '\')' : 'H._chat.showProfile(\'' + otherIdSafe + '\')') + '">'
      + '<div class="chat-hdr-name">' + escHtml(chatDisplayName) + '</div>'
      + '<div class="chat-hdr-sub" id="chatHdrSub">' + (showBizBrand ? '<span style="color:var(--sub)">Official Shop' + ((_bizChat && _bizChat.category) ? ' | ' + escHtml(_bizChat.category) : '') + '</span>' : chatHdrSubHtml(other, onlineNow)) + '</div>'
      + (showBizBrand ? '<div onclick="H.openBusinessShop&&H.openBusinessShop(\'' + escHtml(_bizChatId||'') + '\')" style="font-size:11px;color:var(--blue);cursor:pointer;margin-top:1px">View Shop &gt;</div>' : '')
      + '</div>'
      + '<button class="chat-hdr-menu" onclick="H._chat.openMenu(\'' + otherIdSafe + '\'' + (showBizBrand ? ',\'' + escHtml(_bizChatId || '') + '\'' : '') + ')"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
      + '</div>'
      + (listing ? chatContextCard(listing) : '')
      + '<div class="chat-thread" id="chatThread"><div class="chat-thread-spacer"></div>'
      + (showBizBrand ? '<div style="margin:10px 16px 4px;padding:12px 16px;background:#EEF2FB;border:1.5px solid #1A3A8F;border-radius:14px"><div style="font-size:13.5px;font-weight:700;color:#1A3A8F">You are messaging ' + escHtml(chatDisplayName) + '</div><div style="font-size:12px;color:var(--sub);margin-top:3px">Replies come from the business, not a personal account</div></div>' : '')
      + (!showBizBrand && c.messages.length < 6 ? '<div class="chat-safety"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><div><b>Stay safe.</b> Meet in a public place, inspect the item before you pay, and never send a deposit to someone you don\'t know.</div></div>' : '')
      + (msgs || '<div style="text-align:center;padding:48px 20px 20px;font-size:14px;color:var(--sub)">' + (showBizBrand ? 'Send a message to ' + escHtml(chatDisplayName) + '.' : 'No messages yet. Say hello!') + '</div>')
      + '<div class="chat-typing" id="chatTyping" style="display:none"><div class="chat-row-av">' + otherAvatar + '</div><div class="chat-bubble them chat-typing-bubble"><span></span><span></span><span></span></div></div>'
      + '</div>'
      + ((typeof H._bizMsg !== 'undefined' && H._bizMsg.chipRow) ? H._bizMsg.chipRow(c) : '')
      + '<div class="chat-input-bar">'
      + '<button class="chat-attach-btn" onmousedown="event.preventDefault()" onclick="H._chat.openAttach()" aria-label="Attach"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
      + (!showBizBrand ? '<button class="chat-offer-btn" onmousedown="event.preventDefault()" onclick="H._chat.makeOffer()" aria-label="Make an offer"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1.5" x2="12" y2="22.5"/><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></button>' : '')
      + '<textarea id="chatIn" rows="1" inputmode="text" enterkeyhint="enter" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="' + (showBizBrand ? 'Message ' + escHtml(chatDisplayName) + '…' : 'Message…') + '" oninput="H.notifyTyping&&H.notifyTyping();H._autoGrowChat&&H._autoGrowChat(this);H._saveChatDraft&&H._saveChatDraft(\'' + escHtml(id) + '\',this.value)" onblur="H.stopTyping&&H.stopTyping()"></textarea>'
      + '<button class="chat-send chat-send-grad" onmousedown="event.preventDefault()" onclick="H.sendChat()"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
      + '</div>'
      + '<input type="file" id="chatImgGallery" accept="image/*" multiple style="display:none" onchange="H._chat.handleImageFile(this)">'
      + '<input type="file" id="chatImgCamera" accept="image/*" capture="environment" style="display:none" onchange="H._chat.handleImageFile(this)">'
      + '</div>';
    } catch (e) {
      console.error('Chat render error:', e);
      return '<div class="page active">' + H.innerTopbar('Chat')
        + '<div style="padding:32px 20px;text-align:center"><div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px">Could not load chat</div>'
        + '<div style="font-size:13px;color:var(--sub);margin-bottom:20px">Please go back and try again.</div>'
        + '<button onclick="H.goBack()" style="background:#1A3A8F;color:#fff;border:none;border-radius:12px;padding:11px 24px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Go Back</button></div></div>';
    }
  };

  // ----- Chat render helpers -----
  function chatDayLabel(t) {
    const d = new Date(t), now = new Date();
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, now)) return 'Today';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (same(d, y)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  function chatTick(read) { return '<span class="chat-rr' + (read ? ' read' : '') + '">' + (read ? '✓✓' : '✓') + '</span>'; }
  H._chatTick = chatTick;
  function chatHdrSubHtml(other, online) {
    // Use other.id when available, fall back to the active chat partner id.
    var oid = (other && other.id) || H._activeOtherId;
    var sharing = !(other && other.privacySettings && other.privacySettings.showActivity === false);
    if (sharing && H._otherTyping) return '<span style="color:#B45309;font-weight:700">Typing...</span>';
    if (sharing && online) return '<span class="chat-presence-dot"></span><span style="color:#16A34A;font-weight:700">Online now</span>';
    if (sharing && oid && H._lastSeen) {
      var ts = H._lastSeen[oid];
      if (ts > 0 && typeof H.formatLastSeen === 'function') {
        var ls = H.formatLastSeen(ts);
        if (ls) return '<span style="color:var(--sub)">' + ls + '</span>';
      }
      // ts === 0 means fetched but no data at all — show a generic indicator
      if (ts === 0) return '<span style="color:var(--sub)">Seen a while ago</span>';
    }
    if (sharing) return '<span style="color:var(--sub)">Offline</span>';
    return 'Tap to view profile';
  }
  H._chatHdrSubHtml = chatHdrSubHtml;
  function chatContextCard(l) {
    const photo = (l.photos && l.photos[0]) || '';
    const price = l.price ? ('$' + Number(l.price).toLocaleString()) : 'Free';
    const open = "H.openInner('Detail',{id:'" + escHtml(l.id) + "'})";
    const thumb = photo
      ? '<img class="cc-thumb" src="' + escHtml(photo) + '" onerror="this.style.display=\'none\'">'
      : '<div class="cc-thumb cc-ph" style="background:' + H.avatarColorFor(l.cat || l.id) + ';color:#fff">' + (H.categoryIcon ? H.categoryIcon(l.cat) : '') + '</div>';
    return '<div class="chat-ctx-card" onclick="' + open + '">' + thumb
      + '<div class="cc-info"><div class="cc-title">' + escHtml(l.title || '') + '</div><div class="cc-price">' + price + '</div></div>'
      + '<svg class="cc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg></div>';
  }

  // ---------------------------------------------------
  // MAKE AN OFFER  (encoded as JSON in the message text — no schema change.
  // No money moves in-app: buyer & seller just agree a price, then deal offline.)
  // ---------------------------------------------------
  function parseOffer(text) {
    if (typeof text !== 'string' || text.charAt(0) !== '{' || text.indexOf('"_offer"') === -1) return null;
    try { const o = JSON.parse(text); return (o && o._offer) ? o._offer : null; } catch (e) { return null; }
  }
  H._parseOffer = parseOffer;

  // ----- Reply / quote support (WhatsApp-style swipe-to-reply) -----
  // A reply is encoded in the message text as JSON, like offers, so it needs no
  // schema change and syncs to every device:  {"_reply":{i,n,t}, "t":"<reply>"}
  function parseReply(text) {
    if (typeof text !== 'string' || text.charAt(0) !== '{' || text.indexOf('"_reply"') === -1) return null;
    try { const o = JSON.parse(text); return (o && o._reply) ? { ref: o._reply, text: (o.t || '') } : null; } catch (e) { return null; }
  }
  H._parseReply = parseReply;
  // Tiny inline icons for previews (replace emojis with crisp SVGs).
  var MIC = {
    photo: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:3px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    offer: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:3px"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
  };
  H._msgIcons = MIC;
  // The text a message actually shows (unwraps a reply envelope).
  function msgText(m) { const r = parseReply(m && m.text); return r ? r.text : ((m && m.text) || ''); }
  H._msgText = msgText;
  const _REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];
  function _reactionsHtml(m, uid) {
    const r = (m && m.reactions && typeof m.reactions === 'object') ? m.reactions : {};
    const keys = Object.keys(r).filter(function(k){ return Array.isArray(r[k]) && r[k].length > 0; });
    if (!keys.length) return '';
    return '<div class="msg-reactions">' + keys.map(function(e) {
      const users = r[e];
      const isMine = users.indexOf(uid) !== -1;
      return '<span class="react-chip' + (isMine ? ' mine' : '') + '" onclick="H._chat.toggleReaction(\'' + escHtml(m.id) + '\',\'' + e + '\')">'
        + e + (users.length > 1 ? '<span class="react-cnt">' + users.length + '</span>' : '')
        + '</span>';
    }).join('') + '</div>';
  }
  H._reactionsHtml = _reactionsHtml;
  // The quoted block rendered above a reply's own text.
  function replyQuoteHtml(m) {
    const r = parseReply(m && m.text);
    if (!r || !r.ref) return '';
    const nm = escHtml(r.ref.n || 'Message');
    const tx = escHtml(String(r.ref.t || '').slice(0, 100));
    return '<div class="chat-reply-quote" onclick="H._chat.jumpTo(\'' + escHtml(r.ref.i || '') + '\')"><span class="crq-name">' + nm + '</span><span class="crq-text">' + tx + '</span></div>';
  }
  H._replyQuoteHtml = replyQuoteHtml;
  // One-line preview for lists / notifications (image, offer or reply-aware).
  function msgPreview(m) {
    if (!m) return '';
    if (m.image) return 'Photo';
    if (parseOffer(m.text)) return 'Offer';
    return msgText(m);
  }
  H._msgPreview = msgPreview;

  // Drag a message bubble to the right to reply to it (like WhatsApp). Delegated
  // on the thread so it covers messages added live without re-binding each one.
  function attachReplySwipe() {
    const thread = document.getElementById('chatThread');
    if (!thread || thread._replyBound) return;
    thread._replyBound = true;
    let row = null, sx = 0, sy = 0, dx = 0, active = false, decided = false, isReply = false;
    let _lpRowTimer = null;
    thread.addEventListener('touchstart', function (e) {
      const r = e.target.closest && e.target.closest('.chat-msg-row');
      if (!r || !e.touches || !e.touches[0]) { row = null; active = false; return; }
      row = r; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      dx = 0; active = true; decided = false; isReply = false;
      // Delegated long-press — works on all Android versions including MagicOS
      clearTimeout(_lpRowTimer);
      _lpRowTimer = setTimeout(function() {
        if (!row) return;
        const msgId = row.getAttribute('data-msg-id');
        const mine = row.classList.contains('me');
        if (msgId) H._chat.showMsgActions(msgId, mine);
        row = null; active = false;
      }, 350);
    }, { passive: true });
    thread.addEventListener('touchmove', function (e) {
      if (!active || !row || !e.touches || !e.touches[0]) return;
      dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) clearTimeout(_lpRowTimer);
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        decided = true;
        isReply = dx > 0 && Math.abs(dx) > Math.abs(dy);
        if (!isReply) { active = false; row = null; return; }
      }
      if (isReply && dx > 0) {
        e.preventDefault();
        const d = Math.min(dx, 72);
        row.style.transition = 'none';
        row.style.transform = 'translateX(' + d + 'px)';
        row.style.opacity = (1 - Math.min(d / 240, 0.25)).toFixed(2);
      }
    }, { passive: false });
    function end() {
      clearTimeout(_lpRowTimer);
      if (!row) { active = false; return; }
      const r = row, fire = isReply && dx > 48;
      row = null; active = false;
      r.style.transition = 'transform .18s ease, opacity .18s ease';
      r.style.transform = ''; r.style.opacity = '';
      if (fire) {
        const id = r.getAttribute('data-msg-id');
        if (id) H._chat.startReply(id);
      }
    }
    thread.addEventListener('touchend', end, { passive: true });
    thread.addEventListener('touchcancel', end, { passive: true });
  }

  function fmtMoney(n) { return '$' + Number(n || 0).toLocaleString(); }
  function offerCardHtml(of, mine, msgId, otherName, resolved) {
    const price = fmtMoney(of.price);
    var icOk  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>';
    var icNo  = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    if (of.k === 'accept') return '<div class="offer-status accept">' + icOk + 'Offer accepted at ' + price + ' — arrange your deal</div>';
    if (of.k === 'decline') return '<div class="offer-status decline">' + icNo + 'Offer declined</div>';
    const isCounter = of.k === 'counter';
    const label = isCounter ? (mine ? 'YOUR COUNTER-OFFER' : 'COUNTER-OFFER') : (mine ? 'YOUR OFFER' : 'OFFER');
    const listingLine = of.listingTitle
      ? '<div style="font-size:11px;color:var(--sub);margin:-1px 0 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">for ' + escHtml(String(of.listingTitle).slice(0, 50)) + '</div>'
      : '';
    let html = '<div class="offer-card' + (mine ? ' mine' : '') + '">'
      + '<div class="offer-card-top">' + label + '</div>'
      + listingLine
      + '<div class="offer-card-price">' + price + '</div>';
    if (!mine && !resolved) {
      html += '<div class="offer-card-actions">'
        + '<button class="offer-btn accept" onclick="H._chat.respondOffer(\'' + escHtml(msgId) + '\',\'accept\')">Accept</button>'
        + '<button class="offer-btn counter" onclick="H._chat.respondOffer(\'' + escHtml(msgId) + '\',\'counter\')">Counter</button>'
        + '<button class="offer-btn decline" onclick="H._chat.respondOffer(\'' + escHtml(msgId) + '\',\'decline\')">Decline</button>'
        + '</div>';
    } else {
      html += '<div class="offer-card-foot">' + (resolved ? 'Offer closed' : 'Sent · waiting for a reply') + '</div>';
    }
    return html + '</div>';
  }

  H._chat = H._chat || {};
  H._pendingChatImages = H._pendingChatImages || [];

  // ----- Swipe-to-reply -----
  H._chat.startReply = function (msgId) {
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function (x) { return x.id === msgId; });
    if (!m) return;
    const u = H.currentUser();
    const who = (u && m.from === u.id) ? 'You' : (H._activeOtherName || 'Them');
    H._chat.replyTarget = { id: msgId, name: who, text: String(msgPreview(m)).slice(0, 120) };
    H._chat.renderReplyBar();
    const inp = document.getElementById('chatIn'); if (inp) inp.focus();
  };
  H._chat.cancelReply = function () {
    H._chat.replyTarget = null;
    const bar = document.getElementById('chatReplyBar'); if (bar) bar.remove();
  };
  H._chat.renderReplyBar = function () {
    const rt = H._chat.replyTarget; if (!rt) return;
    const old = document.getElementById('chatReplyBar'); if (old) old.remove();
    const inputBar = document.querySelector('.chat-input-bar');
    if (!inputBar || !inputBar.parentNode) return;
    const bar = document.createElement('div');
    bar.id = 'chatReplyBar';
    bar.className = 'chat-reply-bar';
    bar.innerHTML = '<div class="crb-accent"></div><div class="crb-body"><span class="crb-name">Replying to ' + escHtml(rt.name) + '</span><span class="crb-text">' + escHtml(rt.text) + '</span></div>'
      + '<button class="crb-x" onclick="H._chat.cancelReply()" aria-label="Cancel reply"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    inputBar.parentNode.insertBefore(bar, inputBar);
  };
  H._chat.jumpTo = function (msgId) {
    const sel = '[data-msg-id="' + (window.CSS && CSS.escape ? CSS.escape(msgId) : msgId) + '"]';
    const row = document.querySelector(sel);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('chat-row-flash');
    setTimeout(function () { row.classList.remove('chat-row-flash'); }, 1300);
  };

  H._chat.makeOffer = function () {
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    if (!H.currentUser()) { H.requireAuth('Sign in to make an offer'); return; }
    const otherId = H._activeOtherId;
    const sellerListings = (H.state.listings || []).filter(function (l) {
      return (String(l.sellerId) === String(otherId) || String(l.userId) === String(otherId)) && l.status !== 'deleted';
    });
    H._chat._offerListings = sellerListings;
    if (sellerListings.length <= 1) {
      const l = sellerListings[0] || (state.listings || []).find(function (l) { return l.id === c.listingId; });
      H._chat._openOfferAmount(l && l.id, l && l.title, l && l.price);
      return;
    }
    const rows = sellerListings.slice(0, 8).map(function (l, i) {
      const ph = (l.photos && l.photos[0])
        ? '<img src="' + escHtml(l.photos[0]) + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">'
        : '<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);flex-shrink:0"></div>';
      return '<button onclick="H._chat._pickOfferListing(' + i + ')" style="width:100%;display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;margin-bottom:8px">'
        + ph
        + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(l.title || 'Untitled') + '</div>'
        + '<div style="font-size:12px;color:var(--blue);font-weight:700">' + (l.price ? ('$' + Number(l.price).toLocaleString()) : 'No price') + '</div></div>'
        + '</button>';
    }).join('');
    H.modal({
      title: 'Which listing?',
      body: '<div style="font-size:13px;color:var(--sub);margin-bottom:12px">Choose a listing to make an offer on.</div>'
        + '<div style="max-height:55vh;overflow-y:auto">' + rows + '</div>',
      confirmText: null,
      cancelText: 'Cancel',
    });
  };
  H._chat._openOfferAmount = function (listingId, listingTitle, suggestedPrice) {
    H.modal({
      title: 'Make an offer',
      body: '<div style="font-size:12.5px;color:var(--sub);margin-bottom:10px">Propose a price. No money is sent in the app - you agree a price here, then arrange the deal in person.</div>'
        + (listingTitle ? '<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">For: ' + escHtml(String(listingTitle).slice(0, 50)) + '</div>' : '')
        + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px;font-weight:900;color:var(--blue)">$</span>'
        + '<input class="fi" id="offerAmt" type="number" inputmode="decimal" min="1" placeholder="Amount" value="' + (suggestedPrice || '') + '" style="flex:1;font-size:18px;font-weight:700"></div>',
      confirmText: 'Send offer',
      onConfirm: function () {
        const v = parseFloat((document.getElementById('offerAmt') || {}).value);
        if (!v || v <= 0) { H.toast('Enter a valid amount'); return; }
        const offerObj = { k: 'offer', price: v };
        if (listingId) offerObj.listingId = listingId;
        if (listingTitle) offerObj.listingTitle = String(listingTitle).slice(0, 50);
        H._chat.sendOfferMessage(offerObj);
      }
    });
  };
  H._chat._pickOfferListing = function (idx) {
    const l = H._chat._offerListings && H._chat._offerListings[idx];
    if (!l) return;
    H.closeModal();
    setTimeout(function () { H._chat._openOfferAmount(l.id, l.title, l.price); }, 120);
  };
  H._chat._closeOfferCard = function (msgId) {
    var sel = '[data-msg-id="' + (window.CSS && CSS.escape ? CSS.escape(msgId) : msgId) + '"]';
    var row = document.querySelector(sel);
    if (!row) return;
    var actions = row.querySelector('.offer-card-actions');
    if (!actions) return;
    var foot = document.createElement('div');
    foot.className = 'offer-card-foot';
    foot.style.color = 'var(--sub)';
    foot.textContent = 'Offer closed';
    actions.parentNode.replaceChild(foot, actions);
  };
  H._chat.respondOffer = function (msgId, action) {
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const msg = (c.messages || []).find(function (m) { return m.id === msgId; });
    const of = msg && parseOffer(msg.text);
    if (!of) return;
    if (action === 'accept') {
      H._chat._closeOfferCard(msgId);
      H._chat.sendOfferMessage({ k: 'accept', price: of.price });
    } else if (action === 'decline') {
      H._chat._closeOfferCard(msgId);
      H._chat.sendOfferMessage({ k: 'decline', price: of.price });
    } else if (action === 'counter') {
      H.modal({
        title: 'Counter-offer',
        body: '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px;font-weight:900;color:var(--blue)">$</span>'
          + '<input class="fi" id="offerAmt" type="number" inputmode="decimal" min="1" value="' + of.price + '" style="flex:1;font-size:18px;font-weight:700"></div>',
        confirmText: 'Send counter',
        onConfirm: function () {
          const v = parseFloat((document.getElementById('offerAmt') || {}).value);
          if (!v || v <= 0) { H.toast('Enter a valid amount'); return; }
          H._chat._closeOfferCard(msgId);
          H._chat.sendOfferMessage({ k: 'counter', price: v });
        }
      });
    }
  };
  H._chat.sendOfferMessage = async function (of) {
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in'); return; }
    of.by = u.id; if (!of.cur) of.cur = 'USD';
    const msgId = H.uid(), msgT = Date.now();
    const text = JSON.stringify({ _offer: of });
    c.messages.push({ id: msgId, from: u.id, senderName: u.name || '', text: text, t: msgT, read: false });
    H.saveState();
    if (typeof H.stopTyping === 'function') H.stopTyping();
    if (H.currentPageName === 'Chat') {
      H.renderPage('Chat', { id: c.id });
      const th = document.getElementById('chatThread'); if (th) th.scrollTop = th.scrollHeight;
    }
    try {
      if (typeof H.ensureConversationInCloud === 'function') H.ensureConversationInCloud(c).catch(function () {});
      // Persist the offer reliably (same path + fallback as normal messages) so
      // the other person actually receives it.
      var saved = false;
      if (typeof H.saveMessageToCloud === 'function') {
        var r = await H.saveMessageToCloud(c.id, c.messages[c.messages.length - 1]);
        saved = !(r && r.ok === false);
      }
      if (!saved && window.supabase && typeof window.supabase.from === 'function') {
        var ins = await window.supabase.from('messages').insert({
          id: msgId, conversation_id: c.id, sender_id: u.id, sender_name: u.name || '',
          text: text, created_at: new Date(msgT).toISOString(), read: false
        });
        if (ins && ins.error) throw new Error(ins.error.message);
        saved = true;
      }
      if (!saved) { H.toast('Offer saved on your device — will send when you’re online', 4000, true); return; }
      const otherId = c.members.find(function (m) { return m !== u.id; });
      if (otherId && typeof H.pushNotif === 'function') {
        const verb = of.k === 'accept' ? 'accepted your offer' : of.k === 'decline' ? 'declined your offer' : of.k === 'counter' ? 'sent a counter-offer' : 'made an offer';
        H.pushNotif(otherId, 'New offer', (u.name || 'Someone') + ' ' + verb + ' (' + fmtMoney(of.price) + ')', 'message', null, 'Chat?id=' + c.id);
      }
    } catch (e) {
      console.warn('offer send:', e.message);
      H.toast('Could not send the offer — please check your connection and try again', 4000, true);
    }
  };

  // Show/hide the typing bubble (kept as the last child of the thread).
  H._renderTyping = function (show) {
    const t = document.getElementById('chatTyping');
    const thread = document.getElementById('chatThread');
    if (!t || !thread) return;
    if (show) {
      if (H._chatOtherAvatar) { const av = t.querySelector('.chat-row-av'); if (av) av.innerHTML = H._chatOtherAvatar; }
      thread.appendChild(t);            // keep it at the bottom
      t.style.display = '';
      const near = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120;
      if (near) thread.scrollTop = thread.scrollHeight;
    } else {
      t.style.display = 'none';
    }
  };
  // Update the header presence line for the open chat.
  H._refreshChatPresence = function () {
    if (H.currentPageName !== 'Chat') return;
    const el = document.getElementById('chatHdrSub');
    if (!el) return;
    const oid = H._activeOtherId;
    const other = (H.state.users || []).find(x => x.id === oid) || null;
    const online = typeof H.isUserOnline === 'function' && H.isUserOnline(oid);
    // When the partner's profile is not yet in state.users, check last_seen directly
    if (!other && oid && H._lastSeen) {
      var ts = H._lastSeen[oid];
      if (ts > 0 && typeof H.formatLastSeen === 'function') {
        var ls = H.formatLastSeen(ts);
        if (ls) { el.innerHTML = '<span style="color:#cfe0ff">' + ls + '</span>'; return; }
      }
      if (ts === 0) { el.innerHTML = '<span style="color:#9baec8">Seen a while ago</span>'; return; }
    }
    el.innerHTML = chatHdrSubHtml(other, online);
  };
  // Refresh ✓/✓✓ receipts on the user's own messages in the open chat.
  H._refreshReceipts = function (convId) {
    if (H.currentPageName !== 'Chat' || H._activeChat !== convId) return;
    const u = currentUser(); if (!u) return;
    const c = conversations().find(x => x.id === convId); if (!c) return;
    (c.messages || []).forEach(function (m) {
      if (m.from !== u.id) return;
      const row = document.querySelector('.chat-msg-row.me[data-msg-id="' + (window.CSS && CSS.escape ? CSS.escape(m.id) : m.id) + '"]');
      if (!row) return;
      const rr = row.querySelector('.chat-rr');
      if (rr) { rr.textContent = m.read ? '✓✓' : '✓'; rr.className = 'chat-rr' + (m.read ? ' read' : ''); }
    });
  };

  // Reliably pin the chat thread to the most recent message. Repeats over a few
  // frames/delays (layout + late images shift the height) and re-pins as each
  // thread image loads, so the chat never opens stuck on middle messages.
  function forceChatScrollBottom() {
    var th = document.getElementById('chatThread');
    if (!th) return;
    var jump = function () {
      var el = document.getElementById('chatThread');
      if (el) el.scrollTop = el.scrollHeight;
    };
    jump();
    setTimeout(jump, 80);
    setTimeout(jump, 400);
    // Re-pin once after late-loading images grow the thread.
    var imgs = th.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].complete) {
        imgs[i].addEventListener('load',  jump, { once: true });
        imgs[i].addEventListener('error', jump, { once: true });
      }
    }
  }
  H._forceChatScrollBottom = forceChatScrollBottom;

  pages.Chat_after = function () {
    if (window._messagesPoll) { clearInterval(window._messagesPoll); window._messagesPoll = null; }
    // Tear down keyboard/viewport listeners from a PREVIOUS Chat mount before we
    // wire new ones. Without this they accumulate on every chat open, so over a
    // session N handlers fire on each keyboard show/hide — a real source of
    // Android jank and eventual freezing. The input focus/blur listeners die
    // with the old DOM (input is re-created each render), so only these leak.
    if (window.visualViewport && window._chatVPHandler) {
      window.visualViewport.removeEventListener('resize', window._chatVPHandler);
      window.visualViewport.removeEventListener('scroll', window._chatVPHandler);
      window._chatVPHandler = null;
    }
    if (window._chatKBResizeHandler) {
      window.removeEventListener('resize', window._chatKBResizeHandler);
      window._chatKBResizeHandler = null;
    }
    if (window._chatKBShow && typeof window._chatKBShow.remove === 'function') { try { window._chatKBShow.remove(); } catch (e) {} window._chatKBShow = null; }
    if (window._chatKBHide && typeof window._chatKBHide.remove === 'function') { try { window._chatKBHide.remove(); } catch (e) {} window._chatKBHide = null; }
    // Pin to the latest message. A single synchronous scroll lands short because
    // message images/avatars haven't loaded yet — once they do, the thread grows
    // and leaves the user stranded mid-list. So we scroll now, on the next few
    // frames/delays, and again each time a thread image finishes loading.
    forceChatScrollBottom();
    attachReplySwipe();
    const ma  = document.getElementById('mainArea');
    const wrap = document.getElementById('chatPageWrap');

    const inCapacitor = !!(window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform());

    if (inCapacitor) {
      // Keep chatPageWrap as position:absolute inside mainArea (position:relative).
      // When the keyboard appears, push chatPageWrap up by setting its bottom offset.
      if (ma) { ma.style.position = 'relative'; ma.style.overflowY = 'hidden'; ma.scrollTop = 0; }
      const KB = window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard;
      if (KB) {
        var _kbSession = (window._chatKBSession = (window._chatKBSession || 0) + 1);
        KB.addListener('keyboardWillShow', function(info) {
          if (window._chatKBSession !== _kbSession) return;
          const w = document.getElementById('chatPageWrap');
          if (w) w.style.bottom = (info.keyboardHeight || 0) + 'px';
          const th = document.getElementById('chatThread');
          if (th) setTimeout(function() { th.scrollTop = th.scrollHeight; }, 50);
        }).then(function(h) {
          if (window._chatKBSession !== _kbSession) { try { h.remove(); } catch(e) {} return; }
          window._chatKBShow = h;
        });
        KB.addListener('keyboardWillHide', function() {
          if (window._chatKBSession !== _kbSession) return;
          const w = document.getElementById('chatPageWrap');
          if (w) w.style.bottom = '0px';
        }).then(function(h) {
          if (window._chatKBSession !== _kbSession) { try { h.remove(); } catch(e) {} return; }
          window._chatKBHide = h;
        });
      } else {
        // Fallback: window resize fires when the soft keyboard appears (adjustResize mode)
        var _baseH = window.innerHeight;
        function _onCapKBResize() {
          const w = document.getElementById('chatPageWrap');
          if (!w) { window.removeEventListener('resize', _onCapKBResize); return; }
          var diff = _baseH - window.innerHeight;
          w.style.bottom = (diff > 50 ? diff : 0) + 'px';
          if (diff > 50) {
            const th = document.getElementById('chatThread');
            if (th) setTimeout(function() { th.scrollTop = th.scrollHeight; }, 50);
          }
        }
        window.addEventListener('resize', _onCapKBResize);
        window._chatKBResizeHandler = _onCapKBResize;
      }
    } else {
      // Browser / iOS standalone PWA: pin the chat to the visual viewport so the
      // input bar always rides above the on-screen keyboard. We size to
      // visualViewport.height and translate by offsetTop (more reliable on iOS
      // than juggling top/bottom), and only auto-scroll to the latest message
      // when the keyboard actually opens — never while the user reads history.
      if (wrap) { wrap.style.position = 'fixed'; wrap.style.left = '0'; wrap.style.right = '0'; wrap.style.top = '0'; wrap.style.bottom = 'auto'; wrap.style.transform = ''; wrap.style.zIndex = '50'; }
      if (ma) { ma.style.overflowY = 'hidden'; ma.scrollTop = 0; }
      let _prevVPH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      function _syncToViewport() {
        const w = document.getElementById('chatPageWrap');
        const vp = window.visualViewport;
        if (!w || !vp) return;
        // Size the chat to the area above the keyboard.
        w.style.height = vp.height + 'px';
        // iOS scrolls the layout viewport up to reveal the focused input, which
        // slides our fixed header (and the whole chat) off the top. Force the
        // page back to the top so the header stays pinned under the status bar.
        // The guard avoids a scroll<->handler feedback loop.
        const se = document.scrollingElement || document.documentElement;
        if (window.pageYOffset !== 0 || (se && se.scrollTop !== 0)) {
          window.scrollTo(0, 0);
          if (se) se.scrollTop = 0;
        }
        if (vp.height < _prevVPH - 60) {               // keyboard just opened
          const th = document.getElementById('chatThread');
          if (th) th.scrollTop = th.scrollHeight;
        }
        _prevVPH = vp.height;
      }
      window._chatVPHandler = _syncToViewport;
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _syncToViewport);
        window.visualViewport.addEventListener('scroll', _syncToViewport);
        _syncToViewport();
      }
      // iOS often fires the viewport resize late (or not at all on first focus),
      // so re-sync a few times after the field gains focus and scroll to bottom.
      const _inp = document.getElementById('chatIn');
      if (_inp) {
        _inp.addEventListener('focus', function () {
          [60, 200, 350, 550, 800].forEach(function (d) {
            setTimeout(function () {
              _syncToViewport();
              const th = document.getElementById('chatThread');
              if (th) th.scrollTop = th.scrollHeight;
            }, d);
          });
        });
        _inp.addEventListener('blur', function () { setTimeout(_syncToViewport, 100); });
      }
    }
    if (H.currentPageParams && H.currentPageParams.id) {
      const cid = H.currentPageParams.id;
      // Restore any saved draft
      var _draft = typeof H._getChatDraft === 'function' ? H._getChatDraft(cid) : '';
      var _draftEl = document.getElementById('chatIn');
      if (_draftEl && _draft) { _draftEl.value = _draft; if (typeof H._autoGrowChat === 'function') H._autoGrowChat(_draftEl); }
      H.startChatPolling(cid);
      // Real-time: presence, typing channel, and push read-receipts to the cloud.
      if (typeof H.initPresence === 'function') H.initPresence();
      if (typeof H.joinChatChannel === 'function') H.joinChatChannel(cid);
      if (typeof H.markConversationReadInCloud === 'function' && H._activeOtherId) {
        H.markConversationReadInCloud(cid, H._activeOtherId);
      }
      // Last-seen: fetch the partner's last_seen + privacy, then refresh the header.
      if (typeof H.fetchLastSeen === 'function' && H._activeOtherId) {
        H.fetchLastSeen(H._activeOtherId).then(function () {
          if (typeof H._refreshChatPresence === 'function') H._refreshChatPresence();
        });
      }
      // Keep the "last seen X ago" label current while the chat is open. Cleared
      // at the top of Chat_after on the next mount so it never accumulates.
      if (window._lastSeenTick) { clearInterval(window._lastSeenTick); }
      window._lastSeenTick = setInterval(function () {
        if (H.currentPageName !== 'Chat') { clearInterval(window._lastSeenTick); window._lastSeenTick = null; return; }
        if (typeof H._refreshChatPresence === 'function') H._refreshChatPresence();
      }, 60000);
    }
  };


  H._switchMsgTab = function (t) { H._msgTab = t; H.renderPage('Messages'); };

  // ── SHOP INBOX (owner view) ──────────────────────────────
  pages.BusinessShopInbox = function (params) {
    try {
    const bizId = params && params.id;
    const b = (H.state.businesses || []).find(function (b) { return b.id === bizId; });
    const u = currentUser();
    if (!b || !u || String(b.ownerUserId) !== String(u.id)) {
      return '<div class="page active">' + H.innerTopbar('Shop Inbox') + H.emptyState('Not found', '', null, null) + '</div>';
    }
    const tab = H._shopInboxTab || 'all';
    const bizConvs = conversations()
      .filter(function (c) {
        return c.businessId === bizId
          && Array.isArray(c.messages) && c.messages.some(function (m) { return m.from !== u.id; });
      })
      .sort(function (a, b) {
        const am = (a.messages || [])[(a.messages || []).length - 1] || {};
        const bm = (b.messages || [])[(b.messages || []).length - 1] || {};
        return (bm.t || 0) - (am.t || 0);
      });

    const unreadConvs = bizConvs.filter(function (c) { return (c.messages || []).some(function (m) { return m.from !== u.id && !m.read; }); });
    const leadConvs   = bizConvs.filter(function (c) {
      return c.isLead || (c.messages || []).filter(function (m) { return m.from !== u.id; }).length >= 2;
    });
    const tabConvs = tab === 'unread' ? unreadConvs : (tab === 'leads' ? leadConvs : bizConvs);

    const tabBar = ['all', 'unread', 'leads'].map(function (t) {
      const cnt = t === 'all' ? bizConvs.length : t === 'unread' ? unreadConvs.length : leadConvs.length;
      const lbl = t === 'all' ? 'All' : t === 'unread' ? 'Unread' : 'Leads';
      const active = tab === t;
      return '<button onclick="H._shopInboxTab=\'' + t + '\';H.renderPage(\'BusinessShopInbox\',{id:\'' + escHtml(bizId) + '\'})" style="flex:1;padding:12px 4px;background:none;border:none;border-bottom:3px solid ' + (active ? '#1A3A8F' : 'transparent') + ';margin-bottom:-2px;font-size:13px;font-weight:' + (active ? '700' : '500') + ';color:' + (active ? '#1A3A8F' : 'var(--sub)') + ';cursor:pointer;font-family:inherit">' + lbl + ' (' + cnt + ')</button>';
    }).join('');

    const rows = tabConvs.map(function (c) {
      const otherId = (c.members || []).find(function (m) { return m !== u.id; });
      const other = otherId ? (H.state.users || []).find(function (x) { return x.id === otherId; }) : null;
      if (!other && otherId) H._resolveOtherName(otherId, c);
      const buyerName = (other && other.name) || c.otherName || 'Unknown Buyer';
      const msgs = c.messages || [];
      const last = msgs[msgs.length - 1];
      const unreadCount = msgs.filter(function (m) { return m.from !== u.id && !m.read; }).length;
      const unread = unreadCount > 0;
      const color = H.avatarColorFor(otherId || buyerName);
      const isLead = c.isLead || msgs.filter(function (m) { return m.from !== u.id; }).length >= 2;
      const preview = last ? ((last.from === u.id ? 'You: ' : '') + escHtml(String(msgPreview(last)).slice(0, 60))) : 'No messages';
      return `<div class="msg-item${unread ? ' unread' : ''}" onclick="H.openChat('${escHtml(c.id)}')">
        <div class="p-av-wrap">${listAvatarHtml(other, buyerName, color, 'p-av')}</div>
        <div class="msg-body">
          <div class="msg-name-row">
            <div class="msg-name">${escHtml(buyerName)}${isLead ? '<span style="background:#FFF3E0;color:#E65100;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;margin-left:6px;vertical-align:middle">Lead</span>' : ''}</div>
            <div class="msg-time${unread ? ' u' : ''}">${last ? timeAgo(last.t) : ''}</div>
          </div>
          <div class="msg-preview${unread ? ' unread' : ''}">${preview}</div>
        </div>
        ${unread ? `<div class="msg-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
      </div>`;
    }).join('');

    return `<div class="page active">
      ${H.innerTopbar(H.escHtml(b.name) + ' Inbox')}
      <div style="display:flex;border-bottom:2px solid var(--border,#E8ECF4)">${tabBar}</div>
      <div id="shopInboxList">
        ${rows || H.emptyState(tab === 'leads' ? 'No leads yet' : tab === 'unread' ? 'All caught up' : 'No conversations yet', tab === 'leads' ? 'Buyers with 2+ messages count as leads.' : '', null, null)}
      </div>
      <div style="text-align:center;font-size:11.5px;color:var(--sub);padding:16px 20px;line-height:1.55;border-top:1px solid var(--border,#E8ECF4);margin-top:8px">Shop messages are separate from personal DMs. Buyers see your business identity, not your personal name or profile picture.</div>
    </div>`;
    } catch (e) {
      console.error('BusinessShopInbox render error:', e);
      return '<div class="page active">' + H.innerTopbar('Shop Inbox') + '<div style="padding:32px 20px;text-align:center"><div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px">Could not load inbox</div><div style="font-size:13px;color:var(--sub);margin-bottom:20px">Please go back and try again.</div><button onclick="H.goBack()" style="background:#1A3A8F;color:#fff;border:none;border-radius:12px;padding:11px 24px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Go Back</button></div></div>';
    }
  };

  H.openChat = function (id) { H.openInner('Chat', { id }); };

  H.startChatWith = function (otherId, listingId) {
   try {
    const u = currentUser();
    if (!u) { H.requireAuth('Sign in to message sellers'); return; }
    // Normalise inputs — guard against undefined/null so we never throw silently on .slice
    const myId = u.id != null ? String(u.id) : '';
    otherId = otherId != null ? String(otherId) : '';
    listingId = listingId != null ? String(listingId) : '';
    if (!myId) { H.toast('Please sign out and sign back in, then try again.'); return; }
    if (!otherId || otherId === 'undefined' || otherId === 'null') { H.toast('Seller profile is not available yet'); return; }
    if (otherId === myId) { H.toast('You cannot message yourself'); return; }
    // Check if the target user has turned off direct messages
    const targetUser = (H.state.users || []).find(function(x) { return x.id === otherId; });
    if (targetUser && targetUser.privacySettings && targetUser.privacySettings.allowMessages === false) {
      H.toast('This seller has turned off direct messages');
      return;
    }
    // Deterministic per-person ID so both users — and every entry point (the
    // profile "Message" button and the listing "Message in App" button) — share
    // ONE conversation. The listing is kept as context but is NOT part of the id;
    // otherwise messaging the same seller from a listing vs their profile forks
    // into two separate threads (the reported bug).
    const ids = [myId, otherId].sort();
    const pairKey = 'conv_' + ids[0].slice(-6) + '_' + ids[1].slice(-6);
    let convId = pairKey;
    // Adopt any existing 1-to-1 thread with this same person — including older
    // threads that were keyed by listing id — so we never create a duplicate.
    // Match on EITHER the members array OR the conversation id prefix: cloud sync
    // often stores a thread with an incomplete members list (just [myId]) when the
    // other party's messages weren't paired during the scan — e.g. a thread whose
    // last message is "You: …". Those still carry the per-person id prefix
    // (conv_AAAAAA_BBBBBB[_listing]), so prefix matching adopts them even when the
    // members array can't. Without this, opening from a profile/listing forked a
    // fresh empty chat while the real history stayed under the old id.
    const _pairCandidates = conversations().filter(function (x) {
      if (!x || String(x.id).indexOf('job_') === 0) return false;
      if (String(x.id).indexOf('biz_') === 0) return false;           // keep business chats separate
      const mem = Array.isArray(x.members) ? x.members.map(String) : [];
      const byMembers = mem.indexOf(myId) !== -1 && mem.indexOf(otherId) !== -1;
      const byId = String(x.id) === pairKey || String(x.id).indexOf(pairKey + '_') === 0;
      return byMembers || byId;
    }).sort(function (a, b) {
      // Prefer the thread with the most recent message so we land on real history.
      const am = (a.messages || [])[(a.messages || []).length - 1] || {};
      const bm = (b.messages || [])[(b.messages || []).length - 1] || {};
      return (bm.t || 0) - (am.t || 0);
    });
    const _existingPair = _pairCandidates[0];
    if (_existingPair) convId = _existingPair.id;
    // If a thread with this person was deleted, REVIVE it (old listing-keyed ids
    // included): clear the deletion locally and server-side and reuse the old id,
    // so the history comes back and the person never shows as "Deleted User".
    if (Array.isArray(H.state.deletedConvIds)) {
      const revived = H.state.deletedConvIds.filter(function (id) {
        return id === pairKey || String(id).indexOf(pairKey + '_') === 0;
      });
      if (revived.length) {
        if (!_existingPair) convId = revived[0];
        H.state.deletedConvIds = H.state.deletedConvIds.filter(function (id) { return revived.indexOf(id) === -1; });
        if (H.state.deletedConvMeta) revived.forEach(function (id) { delete H.state.deletedConvMeta[id]; });
        H.saveState();
        var _sbU = window.supabase;
        if (_sbU && typeof _sbU.from === 'function') {
          revived.forEach(function (id) {
            _sbU.from('conversation_deletions').delete().eq('user_id', myId).eq('conversation_id', id).then(function () {});
          });
        }
        // Pull the old thread + history back from the cloud, then refresh the open chat.
        if (typeof H.syncConversations === 'function') {
          H.syncConversations().then(function () {
            if (H.currentPageName === 'Chat' && H.currentPageParams && H.currentPageParams.id === convId) H.renderPage('Chat', { id: convId });
          });
        }
      }
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
    // We're actively messaging this person, so any stale "profile not found"
    // marks from a failed fetch are wrong — clear them and re-resolve the name.
    var _known = (H.state.users || []).find(function (x) { return x.id === otherId; });
    if (c.otherDeleted) { delete c.otherDeleted; H.saveState(); }
    if ((!_known || !_known.name) && H._resolvedProfileFetch) { try { delete H._resolvedProfileFetch[otherId]; } catch (e) {} }
    if (!c.otherName && typeof H._resolveOtherName === 'function') H._resolveOtherName(otherId, c);
    H.openInner('Chat', { id: convId });
   } catch (e) {
    console.error('startChatWith failed:', e);
    H.toast('Could not open chat: ' + ((e && e.message) ? e.message : 'unknown error'));
   }
  };

  pages.Messages_after = function () {
    // Nudge to enable phone notifications if they're off
    if (typeof H.maybeShowNotifBanner === 'function') H.maybeShowNotifBanner();
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
      // skipMessageFetch: only discover new conversations; realtime delivers messages live.
      // Interval is 30s because realtime is the primary delivery path; poll is a fallback.
      H._refreshMessagesPage({ skipMessageFetch: true });
    }, 30000);
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
    const syncOpts = opts.skipMessageFetch ? { skipMessageFetch: true } : {};
    return H.syncConversations(syncOpts).then(function () {
      const after = conversationSignature();
      if (H.currentPageName === 'Messages' && after !== before) H.renderPage('Messages');
      return after !== before;
    }).finally(function () {
      H._syncingMessagesPage = false;
    });
  };

  H.startChatPolling = function(convId) {
    if (window._chatPoll) clearInterval(window._chatPoll);
    var _chatPollFn = async function() {
      if (H.currentPageName !== 'Chat' || H._activeChat !== convId) {
        clearInterval(window._chatPoll);
        window._chatPoll = null;
        return;
      }
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return;
      const u = H.currentUser();
      if (!u) return;
      const conv = conversations().find(c => c.id === convId);
      const idsBefore = new Set(((conv && conv.messages) || []).map(m => m.id));

      // Targeted incremental fetch: only messages for THIS conversation that are
      // newer than what we already have. Returns 0 rows (near-zero egress) when
      // nothing new has arrived — vastly cheaper than a full syncConversations().
      const latestTs = conv && conv.messages && conv.messages.length
        ? new Date(Math.max.apply(null, conv.messages.map(function(m){ return m.t || 0; }))).toISOString()
        : null;
      var query = sb.from('messages')
        .select('id, sender_id, sender_name, text, image, read, created_at, edited, deleted, reactions')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (latestTs) query = query.gt('created_at', latestTs);

      const { data: msgs, error } = await query;
      if (error || !msgs || !msgs.length) return;

      // Merge new messages into state; also update reactions/edited/deleted on existing ones
      if (!conv) return;
      if (!Array.isArray(conv.messages)) conv.messages = [];
      msgs.forEach(function(m) {
        const t = m.created_at ? new Date(m.created_at).getTime() : Date.now();
        const existing = conv.messages.find(function(x){ return x.id === m.id; });
        if (!existing) {
          conv.messages.push({ id: m.id, from: m.sender_id, senderName: m.sender_name||'', text: m.text, image: m.image||null, t, read: !!m.read, edited: !!m.edited, deleted: !!m.deleted, reactions: m.reactions || {} });
        } else {
          // Keep remote reactions/edited/deleted in sync
          existing.reactions = m.reactions || existing.reactions || {};
          if (m.edited) existing.edited = true;
          if (m.deleted) { existing.deleted = true; existing.text = m.text; }
          // Refresh reaction chips in DOM for this message
          const _row = document.querySelector('.chat-msg-row[data-msg-id="' + m.id + '"]');
          if (_row) {
            const _bw = _row.querySelector('.msg-bwrap');
            const _ex = _row.querySelector('.msg-reactions');
            const _rh = _reactionsHtml(existing, u.id);
            if (_ex) { if (_rh) _ex.outerHTML = _rh; else _ex.remove(); }
            else if (_bw && _rh) _bw.insertAdjacentHTML('beforeend', _rh);
          }
        }
        if (m.sender_id && m.sender_id !== u.id && !(conv.members||[]).includes(m.sender_id)) {
          conv.members = conv.members || [];
          conv.members.push(m.sender_id);
        }
      });
      conv.messages.sort(function(a,b){ return (a.t||0)-(b.t||0); });

      // Append to DOM — only incoming messages the thread doesn't already show
      const thread = document.getElementById('chatThread');
      if (!thread) { H.saveState(); return; }
      const ava2 = otherAvatarFor(conv, u);
      const newMsgs = conv.messages.filter(function(m){ return !idsBefore.has(m.id) && m.from !== u.id; });
      let gotIncoming = false;
      newMsgs.forEach(function(m) {
        m.read = true;
        gotIncoming = true;
        appendThemMessage(thread, ava2, m);
        var _inOf = parseOffer(m.text);
        if (_inOf && (_inOf.k === 'accept' || _inOf.k === 'decline' || _inOf.k === 'counter')) {
          document.querySelectorAll('.offer-card-actions').forEach(function (el) {
            var r2 = el.closest('[data-msg-id]');
            var mid2 = r2 && r2.getAttribute('data-msg-id');
            if (mid2 && typeof H._chat._closeOfferCard === 'function') H._chat._closeOfferCard(mid2);
          });
        }
      });
      if (gotIncoming) {
        thread.scrollTop = thread.scrollHeight;
        if (typeof H._renderTyping === 'function') H._renderTyping(false);
        const oid = (conv.members || []).find(function(x){ return x !== u.id; });
        if (oid && typeof H.markConversationReadInCloud === 'function') H.markConversationReadInCloud(convId, oid);
      }
      if (typeof H._refreshReceipts === 'function') H._refreshReceipts(convId);
      H.saveState();
      if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    };
    // Run once immediately, then poll every 15 seconds as a realtime fallback.
    // Realtime (postgres_changes) is the primary delivery path; this poll only
    // catches messages when the WebSocket drops — so a 15s interval is sufficient.
    _chatPollFn();
    window._chatPoll = setInterval(_chatPollFn, 15000);
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


  H._chat = H._chat || {};

  H._chat.openAttach = function() {
    const sheet = document.getElementById('actionSheet');
    const bg    = document.getElementById('sheetBg');
    if (!sheet || !bg) return;
    sheet.innerHTML =
      '<div class="sheet-header">Send a photo</div>'
      + '<button class="sheet-item" onclick="H.closeSheet();setTimeout(()=>H._chat.pickImage(\'camera\'),120)">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
      + '<span class="sheet-label">Take Photo</span></button>'
      + '<button class="sheet-item" onclick="H.closeSheet();setTimeout(()=>H._chat.pickImage(\'gallery\'),120)">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
      + '<span class="sheet-label">Choose from Gallery</span></button>'
      + '<button class="sheet-close" onclick="H.closeSheet()">Cancel</button>';
    sheet.classList.add('open');
    bg.classList.add('open');
  };

  H._chat.pickImage = async function(source) {
    const Camera = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera;
    if (Camera) {
      try {
        const CameraSource = source === 'camera' ? 'CAMERA' : 'PHOTOS';
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: 'dataUrl',
          source: CameraSource,
          width: 900
        });
        if (photo && photo.dataUrl) {
          H._pendingChatImages = H._pendingChatImages || [];
          H._pendingChatImages.push({ dataUrl: photo.dataUrl, id: H.uid() });
          H._chat._openStagingTray();
        }
      } catch(e) {
        if (e && e.message && (e.message.toLowerCase().includes('cancel') || e.message.toLowerCase().includes('denied'))) return;
        // Fall back to file input on error
        H._chat._fallbackFilePick(source);
      }
    } else {
      H._chat._fallbackFilePick(source);
    }
  };

  H._chat._fallbackFilePick = function(source) {
    const inputId = source === 'camera' ? 'chatImgCamera' : 'chatImgGallery';
    const el = document.getElementById(inputId);
    if (el) el.click();
  };

  H._chat._sendPickedImage = async function(dataUrl, silent) {
    const c = conversations().find(function(x){ return x.id === H._activeChat; });
    if (!c) return;
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to send photos'); return; }
    if (!silent) H.toast('Sending photo…');
    try {
      let imageUrl = dataUrl;
      try {
        if (typeof H.uploadToR2 === 'function') {
          const key = 'chat/' + u.id + '/' + H.uid() + '.jpg';
          const b64m = dataUrl.split(',')[1];
          const blob = new Blob([Uint8Array.from(atob(b64m), c => c.charCodeAt(0))], { type: 'image/jpeg' });
          const url = await H.uploadToR2(blob, key, 'image/jpeg');
          if (url) imageUrl = url;
        }
      } catch(e) { /* R2 unavailable — fall back to base64 */ }
      await H._chat.sendImageMessage(c, u, imageUrl);
    } catch(e) {
      console.warn('Image send error:', e);
      H.toast('Could not send photo. Please try again.');
    }
  };

  H._chat.handleImageFile = async function(input) {
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!files.length) return;
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to send photos'); return; }
    H._pendingChatImages = H._pendingChatImages || [];
    for (var fi = 0; fi < files.length; fi++) {
      try {
        const dataUrl = await H.compressImage(files[fi], 900, 0.75);
        H._pendingChatImages.push({ dataUrl: dataUrl, id: H.uid() });
      } catch (e) { console.warn('compress error:', e); }
    }
    H._chat._openStagingTray();
  };

  // ── Image staging tray (multi-select) ────────────────────────
  H._chat._openStagingTray = function () {
    var old = document.getElementById('chatImgStage');
    if (old) old.remove();
    if (!H._pendingChatImages || !H._pendingChatImages.length) return;

    var tray = document.createElement('div');
    tray.id = 'chatImgStage';
    tray.style.cssText = 'background:var(--card,#fff);border-top:1.5px solid var(--border,#E8ECF4);padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 -2px 12px rgba(0,0,0,0.06)';

    var thumbRow = document.createElement('div');
    thumbRow.style.cssText = 'display:flex;gap:8px;flex:1;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none';

    H._pendingChatImages.forEach(function (img, i) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;flex-shrink:0;width:56px;height:56px';
      var thumb = document.createElement('img');
      thumb.src = img.dataUrl;
      thumb.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border,#E8ECF4)';
      var del = document.createElement('button');
      del.innerHTML = '&times;';
      del.setAttribute('aria-label', 'Remove');
      del.style.cssText = 'position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;touch-action:manipulation';
      (function (idx) {
        del.onclick = function (e) {
          e.stopPropagation();
          H._pendingChatImages.splice(idx, 1);
          H._chat._openStagingTray();
        };
      })(i);
      wrap.appendChild(thumb);
      wrap.appendChild(del);
      thumbRow.appendChild(wrap);
    });

    // Add more button
    var addBtn = document.createElement('button');
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    addBtn.title = 'Add more photos';
    addBtn.style.cssText = 'width:56px;height:56px;border-radius:8px;background:#EEF2FB;border:1.5px dashed #1A3A8F;color:#1A3A8F;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation';
    addBtn.onclick = function () {
      var g = document.getElementById('chatImgGallery');
      if (g) g.click();
    };
    thumbRow.appendChild(addBtn);
    tray.appendChild(thumbRow);

    var sendBtn = document.createElement('button');
    var cnt = H._pendingChatImages.length;
    sendBtn.textContent = 'Send ' + cnt;
    sendBtn.style.cssText = 'flex-shrink:0;padding:10px 14px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;touch-action:manipulation';
    sendBtn.onclick = function () { H._chat.sendAllPendingImages(); };
    tray.appendChild(sendBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    cancelBtn.title = 'Cancel';
    cancelBtn.style.cssText = 'width:32px;height:32px;flex-shrink:0;background:none;border:none;color:var(--sub);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;touch-action:manipulation';
    cancelBtn.onclick = function () {
      H._pendingChatImages = [];
      var t = document.getElementById('chatImgStage');
      if (t) t.remove();
    };
    tray.appendChild(cancelBtn);

    var inputBar = document.querySelector('.chat-input-bar');
    if (inputBar && inputBar.parentNode) inputBar.parentNode.insertBefore(tray, inputBar);
  };

  H._chat.sendAllPendingImages = async function () {
    var images = H._pendingChatImages ? H._pendingChatImages.slice() : [];
    if (!images.length) return;
    H._pendingChatImages = [];
    var tray = document.getElementById('chatImgStage');
    if (tray) tray.remove();
    var cnt = images.length;
    H.toast('Sending ' + cnt + (cnt === 1 ? ' photo' : ' photos') + '...');
    for (var i = 0; i < images.length; i++) {
      await H._chat._sendPickedImage(images[i].dataUrl, true);
    }
  };

  H._chat.sendImageMessage = async function(c, u, imageUrl) {
    var msgId = H.uid();
    var msgT  = Date.now();
    var msg   = { id: msgId, from: u.id, senderName: u.name || '', text: '[Photo]', image: imageUrl, t: msgT, read: false };
    c.messages.push(msg);
    H.saveState();
    // Append image bubble immediately
    const thread = document.getElementById('chatThread');
    if (thread) {
      const row = document.createElement('div');
      row.className = 'chat-msg-row me';
      row.setAttribute('data-msg-id', msgId);
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble me chat-bubble-img';
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'chat-img';
      img.onclick = function() { H._chat.viewImg(imageUrl); };
      bubble.appendChild(img);
      const meta = document.createElement('div');
      meta.className = 'chat-bubble-meta';
      meta.style.textAlign = 'right';
      meta.innerHTML = 'just now ' + chatTick(false);
      bubble.appendChild(meta);
      row.appendChild(bubble);
      const typingEl = thread.querySelector('#chatTyping');
      if (typingEl) thread.insertBefore(row, typingEl); else thread.appendChild(row);
      thread.scrollTop = thread.scrollHeight;
    }
    // Persist to cloud
    try {
      if (window.supabase && typeof window.supabase.from === 'function') {
        await window.supabase.from('messages').insert({
          id: msgId, conversation_id: c.id,
          sender_id: u.id, sender_name: u.name || '',
          text: '[Photo]', image: imageUrl,
          created_at: new Date(msgT).toISOString(), read: false
        });
      }
      var otherId = c.members.find(function(m){ return m !== u.id; });
      if (otherId && typeof H.pushNotif === 'function') H.pushNotif(otherId, 'New Photo', (u.name || 'Someone') + ' sent you a photo', 'message', null, 'Chat?id=' + c.id);
    } catch(e) { console.warn('Image cloud sync:', e.message); }
  };

  // Global full-screen image viewer (chat photos, profile pictures, etc.)
  H.viewImage = function(url) {
    if (!url) return;
    if (document.getElementById('imgViewer')) return;   // guard double-open
    var overlay = document.createElement('div');
    overlay.id = 'imgViewer';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:100000;display:flex;flex-direction:column';

    // Top bar with a real back arrow, pushed BELOW the status bar (var(--safe-top)
    // is set by the native layer; env() alone is 0 on most Android devices, which
    // is why the old X sat under the status bar and "didn't respond").
    var bar = document.createElement('div');
    bar.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:10px;padding:8px 12px;padding-top:calc(10px + var(--safe-top,0px));background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0))';
    var back = document.createElement('button');
    back.setAttribute('aria-label', 'Back');
    back.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    back.style.cssText = 'width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.18);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex-shrink:0';
    bar.appendChild(back);

    var imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 12px 16px;cursor:zoom-out';
    var img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px';
    imgWrap.appendChild(img);

    overlay.appendChild(bar);
    overlay.appendChild(imgWrap);

    var dismiss = function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
      H._imgViewerClose = null;
    };
    H._imgViewerClose = dismiss;   // lets the Android hardware-back button close it
    function onKey(e){ if (e.key === 'Escape') dismiss(); }
    back.addEventListener('click', function(e){ e.stopPropagation(); dismiss(); });
    imgWrap.addEventListener('click', dismiss);   // tapping the photo area also closes
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  };
  H._chat.viewImg = H.viewImage;   // alias kept for existing chat-image taps

  // Auto-grow the message textarea from 1 line up to its CSS max-height, then
  // let it scroll. Keeps the composer compact but supports multi-line messages.
  H._autoGrowChat = function (el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  H.sendChat = async function () {
    if (H.checkBan && H.checkBan()) return;
    const inp = document.getElementById('chatIn');
    const text = inp ? inp.value.trim() : '';
    if (!text) return;
    // Edit mode: update existing message instead of sending a new one
    if (H._chat && H._chat._editingMsgId) { await H._chat._doEditMsg(text); return; }
    const c = conversations().find(function(x){ return x.id === H._activeChat; });
    if (!c) return;
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to send messages'); return; }
    // Flood guard: block more than 5 messages in 10s to the same chat (spam/bots).
    if (typeof H.isChatSpam === 'function' && H.isChatSpam(c.id, u.id)) {
      H.toast('You’re sending messages too fast. Please slow down.', 3000, true);
      return;
    }
    var msgId = H.uid();
    var msgT = Date.now();
    // If replying, wrap the typed text in a reply envelope so the quote rides
    // along to every device with no schema change.
    const rt = H._chat && H._chat.replyTarget;
    const storeText = rt ? JSON.stringify({ _reply: { i: rt.id, n: rt.name, t: rt.text }, t: text }) : text;
    var msgObj = { id: msgId, from: u.id, senderName: u.name||'', text: storeText, t: msgT, read: false };
    c.messages.push(msgObj);
    H.saveState();
    inp.value = '';
    if (typeof H._clearChatDraft === 'function') H._clearChatDraft(c.id);
    if (typeof H._autoGrowChat === 'function') H._autoGrowChat(inp);   // collapse back to one line
    // Keep the keyboard open and the cursor in the field so the user can keep
    // typing. The send button uses onmousedown preventDefault so it never stole
    // focus; this refocus is a belt-and-braces guarantee across platforms.
    try { inp.focus({ preventScroll: true }); } catch (e) { try { inp.focus(); } catch (e2) {} }
    if (H._chat && H._chat.cancelReply) H._chat.cancelReply();
    if (typeof H.stopTyping === 'function') H.stopTyping();
    // Append to DOM directly — no full page re-render to avoid flicker
    const thread = document.getElementById('chatThread');
    if (thread && !thread.querySelector('[data-msg-id="' + msgId + '"]')) {
      const row = document.createElement('div');
      row.className = 'chat-msg-row me';
      row.setAttribute('data-msg-id', msgId);
      const bwrapMe = document.createElement('div');
      bwrapMe.className = 'msg-bwrap msg-bwrap-me';
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble me';
      bubble.innerHTML = (rt ? replyQuoteHtml({ text: storeText }) : '') + escHtml(text) + '<div class="chat-bubble-meta" style="text-align:right">just now ' + chatTick(false) + '</div>';
      bwrapMe.appendChild(bubble);
      row.appendChild(bwrapMe);
      const typing = thread.querySelector('#chatTyping');
      if (typing) thread.insertBefore(row, typing); else thread.appendChild(row);
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
        var cloudResult = await H.saveMessageToCloud(c.id, msgObj);
        if (cloudResult && cloudResult.ok === false) throw new Error(cloudResult.error || 'Message sync failed');
        msgSaved = true;
      }
      if (!msgSaved && window.supabase && typeof window.supabase.from === 'function') {
        var r = await window.supabase.from('messages').insert({
          id: msgId, conversation_id: c.id,
          sender_id: u.id, sender_name: u.name || '',
          text: storeText, created_at: new Date(msgT).toISOString(), read: false
        });
        if (r && r.error) throw new Error(r.error.message);
      }
      var otherId = c.members.find(function(m){ return m !== u.id; });
      if (otherId && typeof H.pushNotif === 'function') H.pushNotif(otherId, 'New Message', (u.name || 'Someone') + ': ' + text.slice(0, 80), 'message', null, 'Chat?id=' + c.id);
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
    // Record WHEN it was deleted so a reply that arrives later can revive the thread.
    if (!H.state.deletedConvMeta || typeof H.state.deletedConvMeta !== 'object') H.state.deletedConvMeta = {};
    H.state.deletedConvMeta[convId] = Date.now();
    H.state.conversations = (H.state.conversations || []).filter(function (c) { return c.id !== convId; });
    H.saveState();
    // Persist the deletion server-side so it stays hidden after logout/login.
    var sb = window.supabase, u = H.currentUser();
    if (sb && u && typeof sb.from === 'function') {
      sb.from('conversation_deletions')
        .upsert({ user_id: u.id, conversation_id: convId }, { onConflict: 'user_id,conversation_id' })
        .then(function (r) { if (r && r.error) console.warn('conversation deletion persist failed:', r.error.message); });
    }
    if (H.currentPageName === 'Messages') H.renderPage('Messages');
  };

  // ── Chat menu: block, view profile, report ───────────────
  // Merge onto the existing H._chat — the attach/image methods (openAttach,
  // pickImage, …) are defined above; reassigning with `H._chat = {…}` would wipe
  // them out and break the "+" attach button.
  // ── Long-press → message actions ──────────────────────────────
  H._chat._lpTimer = null;
  H._chat._lpStart = function (e, msgId, isMine) {
    clearTimeout(H._chat._lpTimer);
    // Prevent Android from triggering native text-selection before our timer fires
    if (e && e.cancelable) try { e.preventDefault(); } catch(_) {}
    H._chat._lpTimer = setTimeout(function () {
      H._chat.showMsgActions(msgId, isMine);
    }, 500);
  };
  H._chat._lpEnd = function () { clearTimeout(H._chat._lpTimer); };

  H._chat._lastMsgActionsAt = 0;
  H._chat.showMsgActions = function (msgId, isMine) {
    const _now = Date.now();
    if (_now - H._chat._lastMsgActionsAt < 600) return;
    H._chat._lastMsgActionsAt = _now;
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function (x) { return x.id === msgId; });
    if (!m) return;
    const sheet = document.getElementById('actionSheet');
    const bg    = document.getElementById('sheetBg');
    if (!sheet || !bg) return;
    const _ico = function (path) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">' + path + '</svg>'; };
    const mid = escHtml(msgId);
    const _myReactions = (m.reactions && typeof m.reactions === 'object') ? m.reactions : {};
    const _emojiRow = '<div class="emoji-picker-row">'
      + _REACTION_EMOJIS.map(function(e) {
          const active = Array.isArray(_myReactions[e]) && _myReactions[e].indexOf(H.currentUser() && H.currentUser().id) !== -1;
          return '<button class="emoji-pick-btn' + (active ? ' active' : '') + '" onclick="H.closeSheet();H._chat.toggleReaction(\'' + mid + '\',\'' + e + '\')">' + e + '</button>';
        }).join('')
      + '</div>';
    sheet.innerHTML = _emojiRow + '<div class="sheet-header">Message</div>'
      + '<button class="sheet-item" onclick="H.closeSheet();H._chat.startReply(\'' + mid + '\')">'
      + _ico('<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>')
      + '<span class="sheet-label">Reply</span></button>'
      + (isMine && !m.deleted && (Date.now() - m.t < 7 * 60 * 1000) ? '<button class="sheet-item" onclick="H.closeSheet();setTimeout(function(){H._chat.startEdit(\'' + mid + '\')},80)">'
      + _ico('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')
      + '<span class="sheet-label">Edit</span></button>' : '')
      + (!m.image && !m.deleted ? '<button class="sheet-item" onclick="H.closeSheet();H._chat.copyMsg(\'' + mid + '\')">'
      + _ico('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')
      + '<span class="sheet-label">Copy</span></button>' : '')
      + (isMine && !m.deleted ? '<button class="sheet-item danger" onclick="H.closeSheet();H._chat.deleteMsg(\'' + mid + '\')">'
      + _ico('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>')
      + '<span class="sheet-label">Delete</span></button>' : '')
      + (!isMine && !m.deleted ? '<button class="sheet-item" onclick="H.closeSheet();H._chat.reportMsg(\'' + mid + '\')">'
      + _ico('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>')
      + '<span class="sheet-label">Report</span></button>' : '')
      + '<button class="sheet-close" onclick="H.closeSheet()">Cancel</button>';
    sheet.classList.add('open');
    bg.classList.add('open');
  };

  H._chat.startEdit = function (msgId) {
    const u = H.currentUser(); if (!u) return;
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function (x) { return x.id === msgId; });
    if (!m || m.deleted) return;
    if (String(m.from) !== String(u.id)) return;
    if (Date.now() - m.t > 7 * 60 * 1000) { H.toast('Messages can only be edited within 7 minutes of sending'); return; }
    H._chat._editingMsgId   = msgId;
    H._chat._editingOrigText = msgText(m);
    const old = document.getElementById('chatEditBar'); if (old) old.remove();
    const inputBar = document.querySelector('.chat-input-bar');
    if (!inputBar || !inputBar.parentNode) return;
    const bar = document.createElement('div');
    bar.id = 'chatEditBar';
    bar.className = 'chat-reply-bar';
    bar.innerHTML = '<div class="crb-accent" style="background:#F5A623"></div>'
      + '<div class="crb-body"><span class="crb-name" style="color:#F5A623">Editing message</span>'
      + '<span class="crb-text">' + escHtml(H._chat._editingOrigText.slice(0, 80)) + '</span></div>'
      + '<button class="crb-x" onclick="H._chat.cancelEdit()" aria-label="Cancel edit"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    inputBar.parentNode.insertBefore(bar, inputBar);
    const inp = document.getElementById('chatIn');
    if (inp) {
      inp.value = H._chat._editingOrigText;
      if (typeof H._autoGrowChat === 'function') H._autoGrowChat(inp);
      // Android requires a small delay before focus triggers the soft keyboard
      setTimeout(function() { try { inp.focus(); } catch(e){} }, 80);
    }
  };

  H._chat.cancelEdit = function () {
    H._chat._editingMsgId   = null;
    H._chat._editingOrigText = null;
    const bar = document.getElementById('chatEditBar'); if (bar) bar.remove();
    const inp = document.getElementById('chatIn');
    if (inp) { inp.value = ''; if (typeof H._autoGrowChat === 'function') H._autoGrowChat(inp); }
  };

  H._chat._doEditMsg = async function (newText) {
    const msgId = H._chat._editingMsgId;
    H._chat.cancelEdit();
    const u = H.currentUser(); if (!u) return;
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function (x) { return x.id === msgId; });
    if (!m || String(m.from) !== String(u.id)) return;
    if (Date.now() - m.t > 7 * 60 * 1000) { H.toast('Edit window has expired'); return; }
    m.text = newText; m.edited = true;
    H.saveState();
    // Update bubble in DOM without re-render
    const row = document.querySelector('[data-msg-id="' + msgId + '"]');
    if (row) {
      const bubble = row.querySelector('.chat-bubble');
      if (bubble) {
        const meta = bubble.querySelector('.chat-bubble-meta');
        const metaHtml = meta ? meta.outerHTML : '';
        bubble.innerHTML = escHtml(newText) + '<span style="font-size:10px;opacity:.55"> · edited</span>' + metaHtml;
      }
    }
    try {
      if (window.supabase) {
        const editCutoff = new Date(Date.now() - 7 * 60 * 1000).toISOString();
        await window.supabase.from('messages').update({ text: newText, edited: true })
          .eq('id', msgId).gte('created_at', editCutoff);
      }
    } catch (e) { console.warn('edit msg sync:', e); }
  };

  H._chat.copyMsg = function (msgId) {
    const c = conversations().find(function (x) { return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function (x) { return x.id === msgId; });
    if (!m) return;
    var txt = msgText(m);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function () { H.toast('Copied'); }).catch(function () { H.toast('Could not copy'); });
    } else { H.toast('Copy not supported'); }
  };

  H._chat.deleteMsg = function (msgId) {
    H.modal({
      title: 'Delete Message',
      body: 'Delete this message for everyone?',
      confirmText: 'Delete', danger: true,
      onConfirm: async function () {
        const c = conversations().find(function (x) { return x.id === H._activeChat; });
        if (!c) return;
        const m = (c.messages || []).find(function (x) { return x.id === msgId; });
        if (!m) return;
        m.text = ''; m.deleted = true;
        H.saveState();
        const row = document.querySelector('[data-msg-id="' + msgId + '"]');
        if (row) {
          const bubble = row.querySelector('.chat-bubble');
          if (bubble) bubble.innerHTML = '<span style="font-style:italic;opacity:.5;font-size:13px">This message was deleted</span>';
        }
        try {
          if (window.supabase) await window.supabase.from('messages').update({ text: '', deleted: true }).eq('id', msgId);
        } catch (e) { console.warn('delete msg sync:', e); }
      }
    });
  };

  H._chat.reportMsg = function(msgId) {
    const c = conversations().find(function(x){ return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function(x){ return x.id === msgId; });
    if (!m) return;
    const u = H.currentUser(); if (!u) return;
    if (!Array.isArray(H.state.reports)) H.state.reports = [];
    const rep = { id: H.uid(), reporterId: u.id, targetType: 'message', targetId: msgId,
      reason: 'Reported message in chat', t: Date.now(), status: 'open' };
    H.state.reports.push(rep);
    H.saveState();
    H.toast('Message reported — our team will review within 24 hours');
    if (window.supabase && typeof window.supabase.from === 'function') {
      window.supabase.from('reports').insert({ id: rep.id, reporter_id: u.id,
        target_type: 'message', target_id: msgId, reason: rep.reason,
        created_at: new Date(rep.t).toISOString(), status: 'open' }).catch(function(){});
    }
  };

  H._chat.toggleReaction = async function(msgId, emoji) {
    const u = H.currentUser();
    if (!u) return;
    const c = conversations().find(function(x){ return x.id === H._activeChat; });
    if (!c) return;
    const m = (c.messages || []).find(function(x){ return x.id === msgId; });
    if (!m || m.deleted) return;
    if (!m.reactions || typeof m.reactions !== 'object') m.reactions = {};
    if (!Array.isArray(m.reactions[emoji])) m.reactions[emoji] = [];
    const idx = m.reactions[emoji].indexOf(u.id);
    if (idx === -1) { m.reactions[emoji].push(u.id); }
    else {
      m.reactions[emoji].splice(idx, 1);
      if (m.reactions[emoji].length === 0) delete m.reactions[emoji];
    }
    H.saveState();
    // Update reaction chips in DOM without full re-render
    const row = document.querySelector('.chat-msg-row[data-msg-id="' + msgId + '"]');
    if (row) {
      const bwrap = row.querySelector('.msg-bwrap');
      const existing = row.querySelector('.msg-reactions');
      const html = _reactionsHtml(m, u.id);
      if (existing) { if (html) existing.outerHTML = html; else existing.remove(); }
      else if (bwrap && html) { bwrap.insertAdjacentHTML('beforeend', html); }
    }
    try {
      if (window.supabase) await window.supabase.from('messages').update({ reactions: m.reactions }).eq('id', msgId);
    } catch(e) { console.warn('reaction sync:', e); }
  };

  Object.assign(H._chat, {
    openMenu(userId, bizId) {
      // Business chat menu — actions target the shop, not the owner's personal account
      if (bizId) {
        const biz = (H.state.businesses || []).find(function (b) { return b.id === bizId; });
        const shopName = biz ? escHtml(biz.name) : 'Shop';
        H.modal({
          title: shopName,
          body: '<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">'
            + '<button onclick="H.closeModal();setTimeout(function(){H.openBusinessShop&&H.openBusinessShop(\'' + escHtml(bizId) + '\')},80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">'
            + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><path d="M3 9l1.5-6h15L21 9M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm6 0v2a3 3 0 006 0V9"/></svg>View Shop</button>'
            + '<button onclick="H.closeModal();setTimeout(function(){H.openBusinessShop&&H.openBusinessShop(\'' + escHtml(bizId) + '\')},80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">'
            + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>View Listings</button>'
            + '<button onclick="H.closeModal();setTimeout(function(){H._chat.reportShop(\'' + escHtml(bizId) + '\')},80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">'
            + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Report Shop</button>'
            + '</div>',
          confirmText: null,
          cancelText: 'Close',
        });
        return;
      }
      // Personal chat menu
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
        ? `<img src="${escHtml(other.avatar)}" onclick="H.viewImage('${(other.avatar||'').replace(/'/g, "\\'")}')" style="width:64px;height:64px;border-radius:50%;object-fit:cover;cursor:zoom-in" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:none;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${ini}</div>`
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
                ? `<img src="${escHtml(other.avatar)}" onclick="H.viewImage('${(other.avatar||'').replace(/'/g, "\\'")}')" style="width:80px;height:80px;border-radius:50%;object-fit:cover;cursor:zoom-in" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:none;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;font-family:'Inter',-apple-system,sans-serif">${ini}</div>`
                : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;font-family:'Inter',-apple-system,sans-serif">${ini}</div>`}
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--text);font-family:'Inter',-apple-system,sans-serif">${escHtml(other.name || 'User')}${other.verified ? '&nbsp;' + H.verifiedBadge(15) + '' : ''}</div>
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

    reportShop(bizId) {
      if (!Array.isArray(H.state.reports)) H.state.reports = [];
      const u = H.currentUser(); if (!u) return;
      const rep = { id: H.uid(), reporterId: u.id, targetType: 'business', targetId: bizId,
        reason: 'Reported from business chat', t: Date.now(), status: 'open' };
      H.state.reports.push(rep);
      H.saveState();
      H.toast('Report submitted — our team will review within 24 hours');
      if (window.supabase && typeof window.supabase.from === 'function') {
        window.supabase.from('reports').insert({ id: rep.id, reporter_id: u.id,
          target_type: 'business', target_id: bizId, reason: rep.reason,
          created_at: new Date(rep.t).toISOString(), status: 'open' }).catch(() => {});
      }
    },
  });

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
