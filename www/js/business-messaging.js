/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 7 — MESSAGING SYSTEM (business layer)
 * The core User↔Seller chat (text / image / location) already exists. This adds
 * the business-specific pieces: Quick Replies (owner-defined templates surfaced
 * as chips in chats about that business's listings) and lead tagging (a chat on
 * a business listing already records a lead via Module 6's H.recordLead).
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const toast = (...a) => H.toast(...a);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState = () => H.saveState();
  const renderPage = (...a) => H.renderPage(...a);

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function repliesMap() { H.state.businessReplies = H.state.businessReplies || {}; return H.state.businessReplies; }
  function repliesOf(id) { return repliesMap()[id] || []; }

  H.fetchBusinessReplies = async function (businessId) {
    const sb = window.supabase; if (!sb || !businessId) return repliesOf(businessId);
    try {
      const { data, error } = await sb.from('business_quick_replies').select('*').eq('business_id', businessId).order('created_at');
      if (error || !Array.isArray(data)) return repliesOf(businessId);
      repliesMap()[businessId] = data.map(r => ({ id: r.id, text: r.text }));
      saveState();
      return repliesMap()[businessId];
    } catch (e) { return repliesOf(businessId); }
  };

  // Which business (owned by me) does this conversation's listing belong to?
  function ownedBusinessForConversation(c) {
    if (!c || !c.listingId) return null;
    const l = (H.state.listings || []).find(x => x.id === c.listingId);
    if (!l || !l.businessId) return null;
    const b = getBiz(l.businessId);
    const u = currentUser();
    return (b && u && b.ownerUserId === u.id) ? b : null;
  }

  // ── PAGE: Quick Replies ──────────────────────────────────────
  pages.BusinessQuickReplies = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Quick Replies')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    if (!u || b.ownerUserId !== u.id) return `<div class="page active">${innerTopbar('Quick Replies')}${H.emptyState('Owner only', 'Only the owner can manage quick replies.')}</div>`;
    const list = repliesOf(b.id);

    return `<div class="page active">
      ${innerTopbar('Quick Replies')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:14px">Saved replies appear as one-tap chips when you chat with buyers about this business's listings.</div>
        <div class="fg" style="margin-bottom:14px">
          <div style="display:flex;gap:8px">
            <input class="fi" id="qrText" placeholder="e.g. Yes, it's available!" maxlength="160" style="flex:1">
            <button class="btn-pri" style="width:auto;padding:0 16px" onclick="H._bizMsg.add('${b.id}')">Add</button>
          </div>
        </div>
        ${list.length ? list.map(r => `<div style="display:flex;align-items:center;gap:10px;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:12px;padding:12px;margin-bottom:8px">
            <div style="flex:1;font-size:13.5px;color:var(--text)">${escHtml(r.text)}</div>
            <button onclick="H._bizMsg.remove('${b.id}','${r.id}')" style="background:#FFF1F0;color:#EF4444;border:none;border-radius:9px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">Delete</button>
          </div>`).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">No quick replies yet.</div>`}
      </div>
    </div>`;
  };

  H._bizMsg = {
    open(id) { H.fetchBusinessReplies(id).then(() => renderPage('BusinessQuickReplies', { id })); H.openInner('BusinessQuickReplies', { id }); },

    async add(id) {
      const el = document.getElementById('qrText'); const text = el ? el.value.trim() : '';
      if (!text) { toast('Type a reply first'); return; }
      const row = { id: H.uid(), text };
      repliesMap()[id] = repliesOf(id).concat(row); saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_quick_replies').insert({ id: row.id, business_id: id, text }); } catch (e) {} }
      renderPage('BusinessQuickReplies', { id });
    },

    async remove(id, replyId) {
      repliesMap()[id] = repliesOf(id).filter(r => r.id !== replyId); saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_quick_replies').delete().eq('id', replyId); } catch (e) {} }
      renderPage('BusinessQuickReplies', { id });
    },

    // Rendered into the chat composer (messages.js) for business owners.
    chipRow(c) {
      const b = ownedBusinessForConversation(c);
      if (!b) return '';
      const list = repliesOf(b.id);
      if (!list.length) { H.fetchBusinessReplies(b.id); return ''; }
      return '<div class="biz-qr-row" style="display:flex;gap:7px;overflow-x:auto;padding:8px 12px 0;-webkit-overflow-scrolling:touch">'
        + list.map(r => `<button onclick="H._bizMsg.use('${escHtml(r.text).replace(/'/g, "&#39;")}')" style="flex-shrink:0;white-space:nowrap;background:#EEF2FB;color:#1A3A8F;border:none;border-radius:16px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">${escHtml(r.text)}</button>`).join('')
        + '</div>';
    },

    use(text) {
      const ta = document.getElementById('chatIn');
      if (ta) { ta.value = text.replace(/&#39;/g, "'"); ta.focus(); if (typeof H._autoGrowChat === 'function') H._autoGrowChat(ta); }
    }
  };

})(window.H = window.H || {});
