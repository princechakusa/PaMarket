/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const { escHtml, fmtPrice } = H;

  const WALLET_URL = 'https://princechakusa.github.io/PaMarket/ads.html';

  const I = {
    boost: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    ext:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  };

  // Opens wallet.html in the device's external browser (or new tab on web)
  function openWallet(params) {
    var url = WALLET_URL;
    if (params) url += '?' + new URLSearchParams(params).toString();
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ─── Boost page (listing/plan selection only — no payment in-app) ───────────
  let _boostListingId = null;
  let _boostPlanId = 'standard';

  pages.Boost = function ({ listingId }) {
    const u = H.currentUser();
    const myActive = (H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active');
    if (!myActive.length) {
      return `<div class="page active">${H.innerTopbar('Boost a Listing')}
        <div class="empty-state">
          <div class="empty-icon">${I.boost}</div>
          <div class="empty-title">No active listings</div>
          <div class="empty-sub">Post a listing first, then come back to boost it.</div>
          <button class="btn-pri" style="max-width:240px;margin-top:10px" onclick="H.navTo('Post',null)">Post an Ad</button>
        </div>
      </div>`;
    }

    _boostListingId = listingId || myActive[0].id;
    const sel = H.BOOST_PLANS.find(p => p.id === _boostPlanId) || H.BOOST_PLANS[0];

    return `<div class="page active">${H.innerTopbar('Boost a Listing')}
      <div class="boost-hero">
        <div class="boost-hero-title">${I.boost} Get More Eyes</div>
        <div class="boost-hero-sub">Boosted listings appear at the top of search results</div>
      </div>
      <div class="inner-content">
        <div class="fl">Select listing</div>
        <select class="fi" style="margin-bottom:14px" id="boostListing" onchange="H._boost.setListing(this.value)">
          ${myActive.map(l => `<option value="${escHtml(l.id)}" ${_boostListingId === l.id ? 'selected' : ''}>${escHtml(l.title)} · ${escHtml(fmtPrice(l.price, l.currency))}</option>`).join('')}
        </select>

        <div class="fl">Choose boost plan</div>
        ${H.BOOST_PLANS.map(p => `
          <div class="boost-plan ${_boostPlanId === p.id ? 'sel' : ''}" onclick="H._boost.selectPlan('${p.id}')">
            <div class="boost-plan-top">
              <div>
                <span class="boost-plan-name">${p.name}</span>
                ${p.badgeText ? `<span class="boost-plan-badge ${p.badge || ''}">${p.badgeText}</span>` : ''}
              </div>
              <div class="boost-plan-price">$${p.price}</div>
            </div>
            <div class="boost-plan-desc">${p.desc}</div>
          </div>`).join('')}

        <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:12px 14px;margin:14px 0;font-size:13px;color:#1e40af;line-height:1.5">
          ${I.ext} Payment is completed on the PaMarket website via EcoCash, OneMoney or Bank Transfer.
          Credits are verified by admin within 24 hours.
        </div>

        <button class="btn-submit" onclick="H._boost.proceed()">
          ${I.ext} Boost on Website · $${sel.price}
        </button>
        <div style="text-align:center;font-size:12px;color:var(--sub);margin-top:8px">
          Opens your browser · Same account · No Google Play payment
        </div>
      </div>
    </div>`;
  };

  H._boost = {
    setListing(id) { _boostListingId = id; },
    selectPlan(pid) {
      _boostPlanId = pid;
      H.renderPage('Boost', { listingId: _boostListingId });
    },
    proceed() {
      const plan = H.BOOST_PLANS.find(p => p.id === _boostPlanId);
      openWallet({ listing: _boostListingId, plan: _boostPlanId, price: plan ? plan.price : '' });
    },
  };

  // ─── Wallet page — redirect to wallet.html ───────────────────────────────────
  pages.Wallet = function () {
    const u = H.currentUser();
    if (!u) return `<div class="page active">${H.innerTopbar('Wallet')}${H.emptyState('Not signed in', 'Sign in to access your wallet', 'Sign In', 'H.authPage()')}</div>`;
    return `<div class="page active">${H.innerTopbar('Advertise')}
      <div style="padding:32px 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">📢</div>
        <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px">Advertise on PaMarket</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:24px">
          Boost your listing to the top of search results.<br>
          Pay via EcoCash, OneMoney or Bank Transfer.
        </div>
        <button onclick="H._wallet.openTopUp()" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;background:#1A3A8F;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">
          ${I.ext} Advertise Now
        </button>
        <div style="margin-top:12px;font-size:12px;color:var(--sub)">Opens in your browser · Same account · From $2</div>
      </div>
    </div>`;
  };

  pages.Payments = pages.Wallet;

  // TopUp page — also redirects to wallet.html
  pages.TopUp = function () { return pages.Wallet(); };

  // ─── Public API ───────────────────────────────────────────────────────────────
  H._wallet = {
    openTopUp() { openWallet(); },
    openSite()  { openWallet(); },
  };
  H.showTopUp = () => H._wallet.openTopUp();

  H._copyText = function (el) {
    const text = (el && el.dataset) ? el.dataset.v : String(el);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    H.toast('Copied: ' + text);
  };

})(window.H);
