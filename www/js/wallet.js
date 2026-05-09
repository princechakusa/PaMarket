'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { currentUser, escHtml, uid, toast, modal, innerTopbar,
          emptyState, openInner, goBack, renderPage,
          saveState, fmtPrice, pushNotif, navTo, BOOST_PLANS } = H;

  // Icon fallback (prefer H.ICONS)
  const I = {
    boost: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    up:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    minus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  };

  let _boostState = { planId: 'standard', listingId: null };

  // ---------------------------------------------------
  // BOOST
  // ---------------------------------------------------
  pages.Boost = function ({ listingId }) {
    const u        = currentUser();
    const myActive = (state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active');
    if (!myActive.length) {
      return `<div class="page active">${innerTopbar('Boost a Listing')}
        <div class="empty-state">
          <div class="empty-icon">${I.boost}</div>
          <div class="empty-title">No active listings</div>
          <div class="empty-sub">Post a listing first, then come back to boost it.</div>
          <button class="btn-pri" style="max-width:240px;margin-top:10px" onclick="H.navTo('Post',null)">Post an Ad</button>
        </div>
      </div>`;
    }

    _boostState.listingId = listingId || myActive[0].id;
    const sel = BOOST_PLANS.find(p => p.id === _boostState.planId) || BOOST_PLANS[0];

    return `<div class="page active">${innerTopbar('Boost a Listing')}
      <div class="boost-hero">
        <div class="boost-hero-title">${I.boost} Get More Eyes</div>
        <div class="boost-hero-sub">Boosted listings appear at the top of search results</div>
      </div>
      <div class="inner-content">
        <div class="fl">Select listing</div>
        <select class="fi" style="margin-bottom:14px" id="boostListing" onchange="_boostState.listingId=this.value">
          ${myActive.map(l => `<option value="${l.id}" ${_boostState.listingId === l.id ? 'selected' : ''}>${escHtml(l.title)} · ${escHtml(fmtPrice(l.price, l.currency))}</option>`).join('')}
        </select>
        <div class="fl">Choose boost plan</div>
        ${BOOST_PLANS.map(p => `
          <div class="boost-plan ${_boostState.planId === p.id ? 'sel' : ''}" onclick="H._boost.selectPlan('${p.id}')">
            <div class="boost-plan-top">
              <div>
                <span class="boost-plan-name">${p.name}</span>
                ${p.badgeText ? `<span class="boost-plan-badge ${p.badge || ''}">${p.badgeText}</span>` : ''}
              </div>
              <div class="boost-plan-price">$${p.price}</div>
            </div>
            <div class="boost-plan-desc">${p.desc}</div>
          </div>`).join('')}

        <div style="background:var(--n4);border:1px solid var(--n5);padding:11px 14px;border-radius:12px;margin:12px 0;font-size:13px;color:var(--sub)">
          Wallet balance: <strong style="color:var(--n2)">$${(u.walletUSD || 0).toFixed(2)}</strong>
        </div>
        <button class="btn-submit" onclick="H._boost.activate()">
          Activate ${sel.name} · $${sel.price}
        </button>
        <div style="text-align:center;font-size:12px;color:var(--sub);margin-top:8px">Top up via EcoCash, OneMoney or USD card</div>
      </div>
    </div>`;
  };

  H._boost = {
    selectPlan(pid) { _boostState.planId = pid; renderPage('Boost', { listingId: _boostState.listingId }); },
    activate() {
      const u    = currentUser();
      const plan = BOOST_PLANS.find(p => p.id === _boostState.planId);
      const l    = state.listings.find(x => x.id === _boostState.listingId);
      if (!l) return;
      if ((u.walletUSD || 0) < plan.price) {
        modal({
          title: 'Insufficient balance',
          body: `You need $${(plan.price - (u.walletUSD || 0)).toFixed(2)} more. Top up your wallet first?`,
          confirmText: 'Top Up',
          onConfirm: () => { goBack(); openInner('Payments'); }
        });
        return;
      }
      u.walletUSD = +(u.walletUSD - plan.price).toFixed(2);
      l.boost = { plan: plan.id, until: Date.now() + plan.days * 86400000 };
      state.txns = state.txns || [];
      state.txns.unshift({
        id: uid(), userId: u.id, type: 'boost', amt: -plan.price,
        t: Date.now(), note: plan.name + ' … ' + l.title
      });
      pushNotif(u.id, 'Boost activated', `${l.title} is now boosted for ${plan.days} days.`);
      saveState();
      toast('Boost activated!');
      goBack();
    }
  };

  // ---------------------------------------------------
  // PAYMENTS / WALLET
  // ---------------------------------------------------
  pages.Payments = function () {
    const u    = currentUser();
    const txns = (state.txns || []).filter(t => t.userId === u.id).slice(0, 30);

    return `<div class="page active">${innerTopbar('Wallet & Payments')}
      <div class="inner-content">
        <div class="pay-balance">
          <div class="pay-bal-lbl">Wallet Balance</div>
          <div class="pay-bal-amt">$${(u.walletUSD || 0).toFixed(2)}</div>
          <div class="pay-actions">
            <button class="pay-act" onclick="H._wallet.topUp()">${I.plus} Top Up</button>
            <button class="pay-act" onclick="H._wallet.withdraw()">Withdraw</button>
          </div>
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Transaction History</div>
        <div class="section-card">
          ${txns.length ? txns.map(t => {
            const sign = t.amt >= 0 ? 'plus' : 'minus';
            const ic   = t.type === 'topup' ? 'green' : t.type === 'withdraw' ? 'red' : 'amber';
            // Choose icon based on type
            let iconSvg;
            if (t.type === 'topup') iconSvg = I.down;
            else if (t.type === 'withdraw') iconSvg = I.up;
            else if (t.type === 'boost') iconSvg = I.boost;
            else iconSvg = I.wallet;
            return `<div class="tx-item">
              <div class="tx-icon ${ic}">${iconSvg}</div>
              <div class="tx-body">
                <div class="tx-title">${escHtml(t.note || t.type)}</div>
                <div class="tx-date">${new Date(t.t).toLocaleString()}</div>
              </div>
              <div class="tx-amount ${sign}">${t.amt >= 0 ? '+' : ''}$${Math.abs(t.amt).toFixed(2)}</div>
            </div>`;
          }).join('') : `<div style="padding:24px;text-align:center;color:var(--sub);font-size:13px">No transactions yet</div>`}
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin:16px 0 8px">Payment Methods</div>
        <div class="section-card">
          <div class="mi" onclick="H.toast('EcoCash linked to '+H.currentUser().phone)">
            <div class="mi-icon amber-ic">${I.card}</div>
            <div class="mi-label">EcoCash · ${escHtml(u.phone)}</div>
            <span style="font-size:11px;color:var(--n2);font-weight:700;background:var(--n4);padding:2px 8px;border-radius:10px">Primary</span>
          </div>
          <div class="mi" onclick="H.toast('Coming soon')">
            <div class="mi-icon blue-ic">${I.card}</div>
            <div class="mi-label">Add USD Card</div>
            <div class="mi-arrow">›</div>
          </div>
        </div>
      </div>
    </div>`;
  };

  H._wallet = {
    topUp() {
      modal({
        title: 'Top Up Wallet',
        body: `<div class="fl">Method</div>
          <select class="fi" id="tuMethod"><option>EcoCash</option><option>OneMoney</option><option>USD Card (Visa/Mastercard)</option></select>
          <div class="fl" style="margin-top:10px">Amount (USD)</div>
          <input class="fi" type="number" id="tuAmt" placeholder="5.00" min="1" step="0.50">`,
        confirmText: 'Top Up',
        onConfirm: () => {
          const amt = parseFloat(document.getElementById('tuAmt').value);
          if (!amt || amt < 1) { toast('Min $1.00'); return false; }
          const m = document.getElementById('tuMethod').value;
          const u = currentUser();
          u.walletUSD = +(u.walletUSD + amt).toFixed(2);
          state.txns = state.txns || [];
          state.txns.unshift({ id: uid(), userId: u.id, type: 'topup', amt, t: Date.now(), note: 'Top Up … ' + m });
          saveState(); toast('+$' + amt.toFixed(2) + ' added'); renderPage('Payments');
        }
      });
    },
    withdraw() {
      const u = currentUser();
      if ((u.walletUSD || 0) <= 0) { toast('Nothing to withdraw'); return; }
      modal({
        title: 'Withdraw to EcoCash',
        body: `<div class="fl">Amount</div>
          <input class="fi" type="number" id="wdAmt" placeholder="${u.walletUSD.toFixed(2)}" max="${u.walletUSD}" step="0.50">
          <p style="margin-top:8px;font-size:13px;color:var(--sub)">Sent to ${escHtml(u.phone)} via EcoCash. Processing fee: 3%.</p>`,
        confirmText: 'Withdraw',
        onConfirm: () => {
          const amt = parseFloat(document.getElementById('wdAmt').value);
          if (!amt || amt <= 0 || amt > u.walletUSD) { toast('Invalid amount'); return false; }
          u.walletUSD = +(u.walletUSD - amt).toFixed(2);
          state.txns = state.txns || [];
          state.txns.unshift({ id: uid(), userId: u.id, type: 'withdraw', amt: -amt, t: Date.now(), note: 'Withdraw · EcoCash' });
          saveState(); toast('Withdrawal of $' + amt.toFixed(2) + ' processing'); renderPage('Payments');
        }
      });
    }
  };
// Alias: make "Wallet" open the Payments page
pages.Wallet = pages.Payments;
})(window.H);
