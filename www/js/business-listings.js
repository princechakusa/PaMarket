/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 5 — LISTINGS MANAGEMENT (business)
 * A business's listings panel: assign the owner's listings to a business,
 * view per-listing performance (views / clicks / saves / leads), manage status,
 * and enforce the plan listing limit (H.planEntitlements). Reuses the existing
 * listings system — listings carry a business_id; no parallel listing store.
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
  function isOwner(b) { const u = currentUser(); return !!(u && b && b.ownerUserId === u.id); }
  function listingsOf(id) { return (H.state.listings || []).filter(l => l.businessId === id); }
  function listingLimit(b) { return (typeof H.planEntitlements === 'function') ? H.planEntitlements(b.planId).listingLimit : 3; }

  async function cloudSetBusiness(listingId, businessId) {
    const sb = window.supabase; if (!sb) return;
    try { await sb.from('listings').update({ business_id: businessId }).eq('id', listingId); }
    catch (e) { console.warn('cloudSetBusiness:', e); }
  }

  const STATUS = {
    draft:    ['#475569', '#e2e8f0', 'Draft'],
    pending:  ['#92400e', '#fef3c7', 'Pending'],
    active:   ['#166534', '#dcfce7', 'Active'],
    sold:     ['#1e3a8a', '#dbeafe', 'Sold'],
    archived: ['#6b7280', '#f3f4f6', 'Archived']
  };
  function statusPill(s) { const m = STATUS[s] || STATUS.active; return `<span style="font-size:10px;font-weight:800;color:${m[0]};background:${m[1]};border-radius:20px;padding:2px 8px">${m[2]}</span>`; }

  // ── PAGE: Business Listings ──────────────────────────────────
  pages.BusinessListings = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Listings')}${H.emptyState('Business not found', '')}</div>`;
    if (!isOwner(b)) return `<div class="page active">${innerTopbar('Listings')}${H.emptyState('Owner only', 'Only the owner manages listings.')}</div>`;

    const mine = listingsOf(b.id);
    const limit = listingLimit(b);
    const limLabel = limit < 0 ? '∞' : limit;
    const atLimit = limit >= 0 && mine.length >= limit;

    const metric = (icon, val) => `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11.5px;color:var(--sub)">${icon}${val || 0}</span>`;
    const eye = (H.ICONS && H.ICONS.eye) || '';

    const card = (l) => `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:12px;margin-bottom:10px">
      <div style="display:flex;gap:12px">
        <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:#EEF2FB;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1A3A8F">
          ${l.photos && l.photos[0] ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">` : (typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '')}
        </div>
        <div style="flex:1;min-width:0" onclick="H.openListing && H.openListing('${l.id}')">
          <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title || 'Untitled')}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">${statusPill(l.status)}<span style="font-size:12px;font-weight:700;color:#1A3A8F">${escHtml(H.fmtPrice ? H.fmtPrice(l.price, l.currency) : l.price)}</span></div>
          <div style="display:flex;gap:12px;margin-top:6px">${metric(eye, l.views)}${metric('Clicks ', l.clicks)}${metric('Saves ', l.saves)}${metric('Leads ', l.leads)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        ${l.status === 'active' ? `<button onclick="H._bizListings.setStatus('${l.id}','sold','${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">Mark sold</button>` : ''}
        ${l.status !== 'archived' ? `<button onclick="H._bizListings.setStatus('${l.id}','archived','${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">Archive</button>` : `<button onclick="H._bizListings.setStatus('${l.id}','active','${b.id}')" style="flex:1;padding:8px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">Reactivate</button>`}
        <button onclick="H._bizListings.unassign('${l.id}','${b.id}')" style="padding:8px 12px;border-radius:9px;border:1px solid #FECACA;background:#FFF1F0;font-size:12px;font-weight:700;color:#EF4444;cursor:pointer;font-family:inherit">Remove</button>
      </div>
    </div>`;

    return `<div class="page active">
      ${innerTopbar('Listings')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#EEF2FB;border-radius:12px;padding:12px 14px;margin-bottom:14px">
          <div style="font-size:13px;color:var(--sub)">Listings used</div>
          <div style="font-size:14px;font-weight:800;color:#1A3A8F">${mine.length} / ${limLabel}</div>
        </div>
        <button class="btn-pri" style="width:100%;margin-bottom:8px;${atLimit ? 'opacity:.5' : ''}" ${atLimit ? 'disabled' : ''} onclick="H._bizListings.assignPicker('${b.id}')">Add a listing</button>
        ${atLimit ? `<div style="font-size:11.5px;color:#b45309;margin-bottom:12px">Listing limit reached — upgrade your plan for more.</div>` : ''}
        ${mine.length ? mine.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">No listings assigned to this business yet.</div>`}
      </div>
    </div>`;
  };

  // ── PAGE: Assign picker ──────────────────────────────────────
  pages.BusinessAssignListing = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Add Listing')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    const avail = (H.state.listings || []).filter(l => l.sellerId === u.id && !l.businessId);
    const card = (l) => `<div onclick="H._bizListings.assign('${l.id}','${b.id}')" style="display:flex;gap:12px;align-items:center;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer">
      <div style="width:48px;height:48px;border-radius:9px;overflow:hidden;background:#EEF2FB;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1A3A8F">${l.photos && l.photos[0] ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">` : (typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '')}</div>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:var(--text)">${escHtml(l.title || 'Untitled')}</div><div style="font-size:12px;color:#1A3A8F;font-weight:700;margin-top:2px">${escHtml(H.fmtPrice ? H.fmtPrice(l.price, l.currency) : l.price)}</div></div>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>`;
    return `<div class="page active">${innerTopbar('Add Listing')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="font-size:13px;color:var(--sub);margin-bottom:14px">Choose one of your listings to add to <b>${escHtml(b.name)}</b>. To post a new one, use the + tab first.</div>
        ${avail.length ? avail.map(card).join('') : H.emptyState('No unassigned listings', 'All your listings are already assigned, or you have none yet. Post one from the + tab.')}
      </div></div>`;
  };

  H._bizListings = {
    open(id) { H.openInner('BusinessListings', { id }); },
    assignPicker(id) {
      const b = getBiz(id); if (!b) return;
      const limit = listingLimit(b);
      if (limit >= 0 && listingsOf(id).length >= limit) { toast('Listing limit reached for your plan'); return; }
      H.openInner('BusinessAssignListing', { id });
    },
    async assign(listingId, businessId) {
      const b = getBiz(businessId); if (!b) return;
      const limit = listingLimit(b);
      if (limit >= 0 && listingsOf(businessId).length >= limit) { toast('Listing limit reached'); return; }
      const l = (H.state.listings || []).find(x => x.id === listingId); if (!l) return;
      l.businessId = businessId; saveState();
      await cloudSetBusiness(listingId, businessId);
      toast('Listing added');
      H.goBack(); renderPage('BusinessListings', { id: businessId });
    },
    async unassign(listingId, businessId) {
      const l = (H.state.listings || []).find(x => x.id === listingId); if (l) { l.businessId = null; saveState(); }
      await cloudSetBusiness(listingId, null);
      toast('Removed from business');
      renderPage('BusinessListings', { id: businessId });
    },
    async setStatus(listingId, status, businessId) {
      const l = (H.state.listings || []).find(x => x.id === listingId); if (!l) return;
      l.status = status; if (status === 'sold') l.soldAt = Date.now(); saveState();
      const sb = window.supabase;
      if (sb) { try { await sb.from('listings').update({ status }).eq('id', listingId); } catch (e) {} }
      renderPage('BusinessListings', { id: businessId });
    }
  };

})(window.H = window.H || {});
