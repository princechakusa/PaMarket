/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 9 — FEATURED LISTINGS SYSTEM
 * Time-based boosts for a business's listings. The free slot count comes
 * from the subscription plan (H.planEntitlements.featuredSlots); additional
 * slots beyond that baseline are purchased as Google Play Billing consumables
 * (H.buySlotPack, billing.js) — there is no manual/WhatsApp/admin-invoice
 * path for extra slots. A boost sets boost=true + featuredUntil.
 * Expiry is reconciled on boot (H.processFeaturedExpiry).
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

  const DAY = 86400000;
  const DURATIONS = [[7, '7 days'], [14, '14 days'], [30, '30 days']];

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function isOwner(b) { const u = currentUser(); return !!(u && b && b.ownerUserId === u.id); }
  function listingsOf(id) { return (H.state.listings || []).filter(l => l.businessId === id); }
  // Total slots = plan baseline + any purchased slot packs. extraSlots is
  // fetched async (fetchExtraFeaturedSlots) and cached per business id since
  // pages.BusinessFeatured renders synchronously; see BusinessFeatured_after.
  const _extraSlotsCache = {};
  function planSlots(b) { return (typeof H.planEntitlements === 'function') ? H.planEntitlements(b.planId).featuredSlots : 0; }
  function featuredSlots(b) {
    const base = planSlots(b);
    if (base === Infinity) return Infinity;
    return base + (_extraSlotsCache[b.id] || 0);
  }

  H.isFeatured = function (l) { return !!(l && l.featuredUntil && l.featuredUntil > Date.now()); };

  // Clear expired boosts (called on boot).
  H.processFeaturedExpiry = function () {
    let changed = false;
    (H.state.listings || []).forEach(l => {
      if (l.featuredUntil && l.featuredUntil <= Date.now() && l.boost) { l.boost = false; changed = true; }
    });
    if (changed) saveState();
  };

  async function cloudFeature(listingId, until) {
    const sb = window.supabase; if (!sb) return;
    try { await sb.from('listings').update({ boost: !!until, featured_until: until ? new Date(until).toISOString() : null }).eq('id', listingId); }
    catch (e) { console.warn('cloudFeature:', e); }
  }

  pages.BusinessFeatured = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Featured')}${H.emptyState('Business not found', '')}</div>`;
    if (!isOwner(b)) return `<div class="page active">${innerTopbar('Featured')}${H.emptyState('Owner only', 'Only the owner can boost listings.')}</div>`;

    const slots = featuredSlots(b);
    const mine = listingsOf(b.id);
    const used = mine.filter(H.isFeatured).length;
    const slotLabel = slots === Infinity ? '∞' : slots;
    const noSlots = slots === 0;

    const card = (l) => {
      const feat = H.isFeatured(l);
      const left = feat ? Math.max(1, Math.ceil((l.featuredUntil - Date.now()) / DAY)) : 0;
      return `<div style="background:var(--card,#fff);border:1.5px solid ${feat ? '#F5A623' : 'var(--border,#E8ECF4)'};border-radius:14px;padding:12px;margin-bottom:10px">
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:50px;height:50px;border-radius:10px;overflow:hidden;background:#EEF2FB;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1A3A8F">${l.photos && l.photos[0] ? `<img src="${escHtml(l.photos[0])}" style="width:100%;height:100%;object-fit:cover">` : (typeof H.categoryIcon === 'function' ? H.categoryIcon(l.cat) : '')}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title || 'Untitled')}</div>
            ${feat ? `<div style="font-size:11.5px;color:#b45309;font-weight:700;margin-top:3px">Featured · ${left}d left</div>` : `<div style="font-size:11.5px;color:var(--sub);margin-top:3px">Not featured</div>`}
          </div>
        </div>
        ${feat
          ? `<button onclick="H._bizFeat.unboost('${b.id}','${l.id}')" style="width:100%;margin-top:10px;padding:9px;border-radius:10px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12.5px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">Remove boost</button>`
          : `<div style="display:flex;gap:8px;margin-top:10px">${DURATIONS.map(d => `<button onclick="H._bizFeat.boost('${b.id}','${l.id}',${d[0]})" ${noSlots || used >= slots ? 'disabled style="opacity:.5"' : ''} style="flex:1;padding:9px;border-radius:10px;border:none;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">${d[1]}</button>`).join('')}</div>`}
      </div>`;
    };

    const atCapacity = slots !== Infinity && used >= slots;
    const slotPackHtml = (typeof H.getActiveProducts === 'function' ? H.getActiveProducts('slotPacks') : []).map(p =>
      `<button onclick="H.buySlotPack('${b.id}','${p.productId}')" style="flex:1;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">${escHtml(p.label)}</button>`
    ).join('');

    return `<div class="page active">
      ${innerTopbar('Featured Listings')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#FFF8EC;border-radius:12px;padding:12px 14px;margin-bottom:14px">
          <div style="font-size:13px;color:var(--sub)">Featured slots</div>
          <div style="font-size:14px;font-weight:800;color:#b45309">${used} / ${slotLabel}</div>
        </div>
        ${noSlots ? `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px;font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:14px">Your plan has no featured slots. Upgrade to Pro or Premium, or buy slots below, to boost listings to the top of the feed and category pages.</div>` : ''}
        ${atCapacity ? `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px;margin-bottom:14px">
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px">Need more slots?</div>
          <div style="font-size:12px;color:var(--sub);margin-bottom:10px">Buy extra featured slots securely via Google Play — added instantly.</div>
          <div style="display:flex;gap:8px">${slotPackHtml}</div>
        </div>` : ''}
        ${mine.length ? mine.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">Add listings to this business first.</div>`}
      </div>
    </div>`;
  };

  pages.BusinessFeatured_after = function (params) {
    const b = getBiz(params && params.id);
    if (!b || typeof H.fetchExtraFeaturedSlots !== 'function') return;
    H.fetchExtraFeaturedSlots(b.id).then(extra => {
      if (_extraSlotsCache[b.id] !== extra) {
        _extraSlotsCache[b.id] = extra;
        if (H.currentPageName === 'BusinessFeatured') renderPage('BusinessFeatured', { id: b.id });
      }
    });
  };

  H._bizFeat = {
    open(id) { H.openInner('BusinessFeatured', { id }); },
    // Using a featured slot is a pure plan/pack entitlement — no separate
    // per-boost charge. The old $0.50/day pending-invoice fee is removed;
    // the only paid action in this system is buying MORE slot capacity
    // (H.buySlotPack, via Google Play Billing).
    async boost(businessId, listingId, days) {
      const b = getBiz(businessId); if (!b) return;
      const slots = featuredSlots(b);
      const used = listingsOf(businessId).filter(H.isFeatured).length;
      if (slots !== Infinity && used >= slots) { toast('No featured slots left — buy more slots or upgrade your plan'); return; }
      const l = (H.state.listings || []).find(x => x.id === listingId); if (!l) return;
      l.featuredUntil = Date.now() + days * DAY; l.boost = true; saveState();
      await cloudFeature(listingId, l.featuredUntil);
      toast('Boosted for ' + days + ' days');
      renderPage('BusinessFeatured', { id: businessId });
    },
    async unboost(businessId, listingId) {
      const l = (H.state.listings || []).find(x => x.id === listingId); if (!l) return;
      l.featuredUntil = null; l.boost = false; saveState();
      await cloudFeature(listingId, null);
      toast('Boost removed');
      renderPage('BusinessFeatured', { id: businessId });
    }
  };

})(window.H = window.H || {});
