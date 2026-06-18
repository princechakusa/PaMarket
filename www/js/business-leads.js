/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 6 — LEAD SYSTEM (no payments)
 * A lead is captured when a user acts on a business listing (WhatsApp / Call /
 * Chat). Every lead links to a listing (and via the listing, to a business).
 * Owner manages leads through New → Active → Closed. Listings never take payment.
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
  function leadsMap() { H.state.businessLeads = H.state.businessLeads || {}; return H.state.businessLeads; }
  function leadsOf(id) { return leadsMap()[id] || []; }

  // Record a lead from a listing contact action. Only listings tied to a business
  // produce leads (a business is the recipient inbox); honours "every lead → listing".
  H.recordLead = function (listingId, type) {
    const l = (H.state.listings || []).find(x => x.id === listingId);
    if (!l || !l.businessId) return; // no business inbox to receive it
    const u = currentUser();
    const row = {
      id: H.uid(), businessId: l.businessId, listingId: listingId,
      userId: u ? u.id : null, userName: u ? (u.name || u.phone || 'User') : 'Guest',
      type: type, status: 'new', createdAt: Date.now()
    };
    leadsMap()[l.businessId] = [row].concat(leadsOf(l.businessId));
    l.leads = (l.leads || 0) + 1;
    l.clicks = (l.clicks || 0) + 1;
    saveState();
    const sb = window.supabase;
    if (sb) {
      try { sb.from('business_leads').insert({ id: row.id, business_id: row.businessId, listing_id: listingId, user_id: row.userId, user_name: row.userName, type: type, status: 'new' }).then(function(){}, function(){}); } catch (e) {}
      try { sb.from('listings').update({ leads: l.leads, clicks: l.clicks }).eq('id', listingId).then(function(){}, function(){}); } catch (e) {}
    }
    const b = getBiz(l.businessId);
    if (b && typeof H.pushNotif === 'function') { try { H.pushNotif(b.ownerUserId, 'New lead', (row.userName) + ' is interested in "' + (l.title || 'your listing') + '"', 'lead'); } catch (e) {} }
  };

  H.fetchBusinessLeads = async function (businessId) {
    const sb = window.supabase; if (!sb || !businessId) return leadsOf(businessId);
    try {
      const { data, error } = await sb.from('business_leads').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
      if (error || !Array.isArray(data)) return leadsOf(businessId);
      leadsMap()[businessId] = data.map(r => ({ id: r.id, businessId: r.business_id, listingId: r.listing_id, userId: r.user_id, userName: r.user_name, type: r.type, status: r.status, createdAt: new Date(r.created_at || Date.now()).getTime() }));
      saveState();
      return leadsMap()[businessId];
    } catch (e) { return leadsOf(businessId); }
  };

  const TYPE_LABEL = { whatsapp: 'WhatsApp', call: 'Call', chat: 'Chat' };

  pages.BusinessLeads = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Leads')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    if (!u || b.ownerUserId !== u.id) return `<div class="page active">${innerTopbar('Leads')}${H.emptyState('Owner only', 'Only the owner can view leads.')}</div>`;

    const tab = (params && params.tab) || 'new';
    const all = leadsOf(b.id);
    const counts = { new: all.filter(l => l.status === 'new').length, active: all.filter(l => l.status === 'active').length, closed: all.filter(l => l.status === 'closed').length };
    const rows = all.filter(l => l.status === tab);
    const listingTitle = (lid) => { const l = (H.state.listings || []).find(x => x.id === lid); return l ? (l.title || 'Listing') : 'Listing'; };

    const tabBtn = (id, label) => `<button onclick="H._bizLeads.tab('${b.id}','${id}')" style="flex:1;padding:9px;border:none;border-bottom:2.5px solid ${tab === id ? '#1A3A8F' : 'transparent'};background:none;font-family:inherit;font-size:13px;font-weight:${tab === id ? 800 : 600};color:${tab === id ? '#1A3A8F' : 'var(--sub)'};cursor:pointer">${label} ${counts[id] ? '(' + counts[id] + ')' : ''}</button>`;

    const card = (ld) => `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${escHtml(ld.userName || 'User')}</div>
        <span style="font-size:10.5px;font-weight:800;color:#1A3A8F;background:#1A3A8F12;border-radius:20px;padding:2px 8px">${TYPE_LABEL[ld.type] || ld.type}</span>
      </div>
      <div style="font-size:12.5px;color:var(--sub);margin-top:4px">On: ${escHtml(listingTitle(ld.listingId))} · ${typeof H.timeAgo === 'function' ? H.timeAgo(ld.createdAt) : ''}</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        ${ld.status === 'new' ? `<button onclick="H._bizLeads.setStatus('${b.id}','${ld.id}','active')" style="flex:1;padding:8px;border-radius:9px;border:none;background:#1A3A8F;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Mark active</button>` : ''}
        ${ld.status !== 'closed' ? `<button onclick="H._bizLeads.setStatus('${b.id}','${ld.id}','closed')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Close</button>` : `<button onclick="H._bizLeads.setStatus('${b.id}','${ld.id}','active')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Reopen</button>`}
      </div>
    </div>`;

    return `<div class="page active">
      ${innerTopbar('Leads')}
      <div style="display:flex;border-bottom:1px solid var(--border,#E8ECF4);background:var(--card,#fff)">${tabBtn('new', 'New')}${tabBtn('active', 'Active')}${tabBtn('closed', 'Closed')}</div>
      <div class="inner-content" style="padding-bottom:40px">
        ${rows.length ? rows.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:30px 0">No ${tab} leads.</div>`}
      </div>
    </div>`;
  };

  H._bizLeads = {
    open(id) { H.fetchBusinessLeads(id).then(() => renderPage('BusinessLeads', { id, tab: 'new' })); H.openInner('BusinessLeads', { id, tab: 'new' }); },
    tab(id, tab) { renderPage('BusinessLeads', { id, tab }); },
    async setStatus(businessId, leadId, status) {
      const ld = leadsOf(businessId).find(x => x.id === leadId); if (!ld) return;
      ld.status = status; saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('business_leads').update({ status }).eq('id', leadId); } catch (e) {} }
      renderPage('BusinessLeads', { id: businessId, tab: ld.status === 'new' ? 'new' : status });
    }
  };

})(window.H = window.H || {});
