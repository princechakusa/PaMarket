/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 10 — ANALYTICS ENGINE
 * Client-side aggregation of a business's listing performance, lead conversion
 * and engagement. Depth gated by plan analytics entitlement (none/basic/full).
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function listingsOf(id) { return (H.state.listings || []).filter(l => l.businessId === id); }
  function leadsOf(id) { return (H.state.businessLeads || {})[id] || []; }
  function analyticsTier(b) { return (typeof H.planEntitlements === 'function') ? H.planEntitlements(b.planId).analytics : 'none'; }

  pages.BusinessAnalytics = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Analytics')}${H.emptyState('Business not found', '')}</div>`;
    const u = currentUser();
    if (!u || b.ownerUserId !== u.id) return `<div class="page active">${innerTopbar('Analytics')}${H.emptyState('Owner only', 'Only the owner can view analytics.')}</div>`;

    const tier = analyticsTier(b);
    if (tier === 'none') {
      return `<div class="page active">${innerTopbar('Analytics')}
        <div class="inner-content" style="text-align:center;padding:40px 24px">
          <div style="width:64px;height:64px;border-radius:50%;background:#EEF2FB;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#1A3A8F" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">Analytics not included</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:22px">Upgrade to Starter or higher to unlock performance insights.</div>
          <button class="btn-pri" style="width:100%;max-width:280px" onclick="H._bizSub.open('${b.id}')">View plans</button>
        </div></div>`;
    }

    const mine = listingsOf(b.id);
    const leads = leadsOf(b.id);
    const views = mine.reduce((n, l) => n + (l.views || 0), 0);
    const clicks = mine.reduce((n, l) => n + (l.clicks || 0), 0);
    const saves = mine.reduce((n, l) => n + (l.saves || 0), 0);
    const conv = views ? Math.round((leads.length / views) * 100) : 0;
    const full = tier === 'full';

    const statCard = (val, label) => `<div style="flex:1;min-width:0;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px 8px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:#1A3A8F">${val}</div><div style="font-size:11px;color:var(--sub);font-weight:600;margin-top:2px">${label}</div></div>`;

    const top = mine.slice().sort((a, c) => (c.views || 0) - (a.views || 0)).slice(0, 5);
    const maxV = Math.max(1, ...top.map(l => l.views || 0));
    const topRows = top.length ? top.map(l => `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">${escHtml(l.title || 'Untitled')}</span><span style="font-weight:700;color:var(--sub)">${l.views || 0}</span></div>
        <div style="height:7px;background:#E8ECF4;border-radius:5px;overflow:hidden"><div style="width:${Math.round((l.views || 0) / maxV * 100)}%;height:100%;background:linear-gradient(90deg,#1A3A8F,#2952cc)"></div></div>
      </div>`).join('') : '<div style="color:var(--sub);font-size:13px;text-align:center;padding:14px 0">No listings yet.</div>';

    const byType = { whatsapp: 0, call: 0, chat: 0 };
    leads.forEach(l => { byType[l.type] = (byType[l.type] || 0) + 1; });
    const typeRow = (label, n) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border,#E8ECF4);font-size:13px"><span style="color:var(--sub)">${label}</span><span style="font-weight:700;color:var(--text)">${n}</span></div>`;

    return `<div class="page active">
      ${innerTopbar('Analytics')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="display:flex;gap:10px;margin-bottom:12px">${statCard(views, 'Views')}${statCard(clicks, 'Clicks')}${statCard(leads.length, 'Leads')}</div>
        <div style="display:flex;gap:10px;margin-bottom:18px">${statCard(saves, 'Saves')}${statCard(conv + '%', 'Conversion')}${statCard(mine.length, 'Listings')}</div>

        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">Top listings by views</div>
          ${topRows}
        </div>

        ${full ? `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:16px;padding:4px 16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:800;color:var(--text);padding:14px 0 6px">Leads by channel</div>
          ${typeRow('WhatsApp', byType.whatsapp || 0)}${typeRow('Call', byType.call || 0)}${typeRow('Chat', byType.chat || 0)}
        </div>
        <div style="background:#EEF2FB;border-radius:14px;padding:14px;font-size:12.5px;color:var(--sub);line-height:1.55">Conversion rate is leads divided by listing views. Boost top listings (Featured) to lift views and leads.</div>`
          : `<div style="background:#FFF8EC;border-radius:14px;padding:14px;font-size:12.5px;color:var(--sub);line-height:1.55">Upgrade to Pro for full analytics — lead channel breakdown and conversion insights.</div>`}
      </div>
    </div>`;
  };

  H._bizAnalytics = { open(id) { H.openInner('BusinessAnalytics', { id }); } };

})(window.H = window.H || {});
