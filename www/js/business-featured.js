/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 9 — FEATURED LISTINGS SYSTEM
 * Time-based boosts for a business's listings. Featured slots are gated by the
 * subscription plan (H.planEntitlements.featuredSlots). A boost sets boost=true +
 * featuredUntil; existing feed/home ranking already surfaces boosted listings.
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
  function featuredSlots(b) { return (typeof H.planEntitlements === 'function') ? H.planEntitlements(b.planId).featuredSlots : 0; }

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

    return `<div class="page active">
      ${innerTopbar('Featured Listings')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;background:#FFF8EC;border-radius:12px;padding:12px 14px;margin-bottom:14px">
          <div style="font-size:13px;color:var(--sub)">Featured slots</div>
          <div style="font-size:14px;font-weight:800;color:#b45309">${used} / ${slotLabel}</div>
        </div>
        ${noSlots ? `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px;font-size:13px;color:var(--sub);line-height:1.55;margin-bottom:14px">Your plan has no featured slots. Upgrade to Pro or Premium to boost listings to the top of the feed and category pages.</div>` : ''}
        ${mine.length ? mine.map(card).join('') : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:24px 0">Add listings to this business first.</div>`}
      </div>
    </div>`;
  };

  H._bizFeat = {
    open(id) { H.openInner('BusinessFeatured', { id }); },
    async boost(businessId, listingId, days) {
      const b = getBiz(businessId); if (!b) return;
      const slots = featuredSlots(b);
      const used = listingsOf(businessId).filter(H.isFeatured).length;
      if (slots !== Infinity && used >= slots) { toast('No featured slots left — upgrade your plan'); return; }
      const l = (H.state.listings || []).find(x => x.id === listingId); if (!l) return;
      // Module 11 — charge the featured fee against the wallet (no-op if monetization not loaded).
      if (typeof H.chargeBusiness === 'function') {
        const price = typeof H.featuredPrice === 'function' ? H.featuredPrice(days) : 0;
        const res = await H.chargeBusiness(businessId, 'featured', price, days + '-day boost: ' + (l.title || 'listing'));
        if (!res || !res.ok) { toast((res && res.msg) || 'Payment failed'); return; }
      }
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
