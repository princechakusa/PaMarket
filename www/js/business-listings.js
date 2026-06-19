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
        <button class="btn-pri" style="width:100%;margin-bottom:8px;${atLimit ? 'opacity:.5' : ''}" ${atLimit ? 'disabled' : ''} onclick="H._bizListings.addProduct('${b.id}')">+ Add Product</button>
        ${atLimit ? `<div style="font-size:11.5px;color:#b45309;margin-bottom:12px">Listing limit reached. Upgrade your plan for more.</div>` : ''}
        ${mine.length ? mine.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">No products in this store yet. Tap Add Product to get started.</div>`}
      </div>
    </div>`;
  };

  // ── PAGE: Add Product chooser ────────────────────────────────
  pages.BusinessAddProduct = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Add Product')}${H.emptyState('Business not found', '')}</div>`;
    const opt = (gold, icon, name, desc, onclick) => `<button onclick="${onclick}" style="display:flex;gap:13px;align-items:flex-start;width:100%;text-align:left;background:var(--card,#fff);border:1.5px solid ${gold ? '#F5A623' : 'var(--border,#E8ECF4)'};border-radius:16px;padding:16px;margin-bottom:13px;cursor:pointer;font-family:inherit">
      <span style="width:44px;height:44px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${gold ? '#FFF4E0' : '#EEF2FF'};color:${gold ? '#e2920f' : '#1A3A8F'}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg></span>
      <span style="min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:var(--text)">${name}</span><span style="display:block;font-size:12px;color:var(--sub);margin-top:3px;line-height:1.45">${desc}</span></span>
    </button>`;
    return `<div class="page active">${innerTopbar('Add Product')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:18px">How would you like to add products to <b>${escHtml(b.name)}</b>'s store?</div>
        ${opt(false, '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 'Import from my Marketplace', 'Bring products you already posted. Copy keeps both, or Move transfers them to the business.', `H._bizListings.importPicker('${b.id}')`)}
        ${opt(true, '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 'Create new business product', 'Build a fresh product with images, price, category, stock and delivery, straight into your catalog.', `H._bizListings.createNew('${b.id}')`)}
      </div></div>`;
  };

  // ── PAGE: Import picker (multi-select, Copy or Move) ─────────
  pages.BusinessAssignListing = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Import Products')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    const avail = (H.state.listings || []).filter(l => l.sellerId === u.id && !l.businessId);
    const sel = H._importSel || (H._importSel = {});
    const n = Object.keys(sel).filter(k => sel[k]).length;
    const card = (l) => `<div id="imp_${escHtml(l.id)}" onclick="H._bizListings.toggleImport('${l.id}')" style="display:flex;gap:11px;align-items:center;background:${sel[l.id] ? '#EEF2FB' : 'var(--card,#fff)'};border:1.5px solid ${sel[l.id] ? '#1A3A8F' : 'var(--border,#E8ECF4)'};border-radius:13px;padding:11px;margin-bottom:9px;cursor:pointer">
      <span class="imp-ck" style="width:22px;height:22px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:2px solid ${sel[l.id] ? '#1A3A8F' : '#CBD2E0'};background:${sel[l.id] ? '#1A3A8F' : 'transparent'}">${sel[l.id] ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</span>
      <div style="width:46px;height:46px;border-radius:9px;overflow:hidden;background:#EEF2FB;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1A3A8F">${l.photos && l.photos[0] ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">` : (typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '')}</div>
      <div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title || 'Untitled')}</div><div style="font-size:12.5px;color:#1A3A8F;font-weight:800;margin-top:2px">${escHtml(H.fmtPrice ? H.fmtPrice(l.price, l.currency) : l.price)}</div></div>
    </div>`;
    return `<div class="page active">${innerTopbar('Import Products')}
      <div class="inner-content" style="padding-bottom:90px">
        <div style="font-size:13px;color:var(--sub);margin-bottom:14px">Select products from your personal marketplace to add to <b>${escHtml(b.name)}</b>.</div>
        ${avail.length ? avail.map(card).join('') : H.emptyState('Nothing to import', 'You have no personal listings available. Use Create new business product instead.')}
      </div>
      ${avail.length ? `<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card,#fff);border-top:1px solid var(--border,#E8ECF4);padding:12px 14px;padding-bottom:calc(12px + var(--safe-bottom,0px));display:flex;gap:9px;z-index:50">
        <button onclick="H._bizListings.importApply('${b.id}','copy')" style="flex:1;padding:13px;border-radius:12px;border:none;background:#EEF2FF;color:#1A3A8F;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">Copy <span id="impCountA">${n}</span></button>
        <button onclick="H._bizListings.importApply('${b.id}','move')" style="flex:1;padding:13px;border-radius:12px;border:none;background:#1A3A8F;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit">Move <span id="impCountB">${n}</span></button>
      </div>` : ''}
    </div>`;
  };

  H._bizListings = {
    open(id) { H.openInner('BusinessListings', { id }); },

    addProduct(id) {
      const b = getBiz(id); if (!b) return;
      const limit = listingLimit(b);
      if (limit >= 0 && listingsOf(id).length >= limit) { toast('Listing limit reached for your plan'); return; }
      H.openInner('BusinessAddProduct', { id });
    },

    importPicker(id) {
      const b = getBiz(id); if (!b) return;
      H._importSel = {};
      H.openInner('BusinessAssignListing', { id });
    },

    // Toggle a row in the multi-select without a full re-render (keeps scroll).
    toggleImport(listingId) {
      H._importSel = H._importSel || {};
      H._importSel[listingId] = !H._importSel[listingId];
      const on = H._importSel[listingId];
      const row = document.getElementById('imp_' + listingId);
      if (row) {
        row.style.background = on ? '#EEF2FB' : 'var(--card,#fff)';
        row.style.border = '1.5px solid ' + (on ? '#1A3A8F' : 'var(--border,#E8ECF4)');
        const ck = row.querySelector('.imp-ck');
        if (ck) { ck.style.background = on ? '#1A3A8F' : 'transparent'; ck.style.borderColor = on ? '#1A3A8F' : '#CBD2E0'; ck.innerHTML = on ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''; }
      }
      const n = Object.keys(H._importSel).filter(k => H._importSel[k]).length;
      const a = document.getElementById('impCountA'), bb = document.getElementById('impCountB');
      if (a) a.textContent = n; if (bb) bb.textContent = n;
    },

    async importApply(businessId, mode) {
      const b = getBiz(businessId); if (!b) return;
      const ids = Object.keys(H._importSel || {}).filter(k => H._importSel[k]);
      if (!ids.length) { toast('Select at least one product'); return; }
      const limit = listingLimit(b);
      if (limit >= 0 && (listingsOf(businessId).length + ids.length) > limit) { toast('That exceeds your plan listing limit'); return; }
      const u = currentUser();
      for (const id of ids) {
        const l = (H.state.listings || []).find(x => x.id === id); if (!l) continue;
        if (mode === 'copy') {
          const copy = JSON.parse(JSON.stringify(l));
          copy.id = H.uid(); copy.businessId = businessId; copy.createdAt = Date.now();
          copy.views = 0; copy.clicks = 0; copy.saves = 0; copy.leads = 0;
          H.state.listings.push(copy);
          if (typeof H.saveListingToCloud === 'function') H.saveListingToCloud(copy);
        } else {
          l.businessId = businessId;
          await cloudSetBusiness(id, businessId);
        }
      }
      saveState();
      H._importSel = {};
      toast(mode === 'copy' ? (ids.length + ' product' + (ids.length > 1 ? 's' : '') + ' copied') : (ids.length + ' product' + (ids.length > 1 ? 's' : '') + ' moved'));
      H.goBack(); renderPage('BusinessListings', { id: businessId });
    },

    // Create a brand new product directly in the business catalog: open the
    // normal Post flow with a business target so it publishes with business_id.
    createNew(businessId) {
      const b = getBiz(businessId); if (!b) return;
      H._postBizTarget = businessId;
      if (typeof H.openInner === 'function') H.openInner('Post');
      else if (typeof H.navTo === 'function') H.navTo('Post');
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
