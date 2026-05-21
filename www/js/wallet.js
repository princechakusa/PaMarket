/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const { escHtml } = H;

  const I = {
    boost: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  };

  // ─── Shared inquiry form ──────────────────────────────────────────────────────
  function buildForm(listing) {
    const u = H.currentUser();
    const nameVal = escHtml((u && (u.name || u._name || u.email)) || '');
    const listingBanner = listing
      ? `<div style="background:var(--blue-light);border:1.5px solid var(--blue-soft);border-radius:12px;padding:12px 14px;margin-bottom:18px;font-size:13px;color:var(--blue);display:flex;gap:10px;align-items:flex-start;line-height:1.5">
          <span style="flex-shrink:0;margin-top:1px">${I.boost}</span>
          <div><strong>Listing selected:</strong> ${escHtml(listing.title)}</div>
        </div>`
      : '';

    return `
      ${listingBanner}
      <div style="font-size:19px;font-weight:900;color:var(--text);margin-bottom:4px">Tell us about you...</div>
      <div style="font-size:13px;color:var(--sub);line-height:1.65;margin-bottom:20px">
        Whether you want to promote a property, vehicle, electronics or your business —
        reach out and tell us what you need. We'll find the best way to help.<br><br>
        <strong style="color:var(--text)">Note:</strong> please use this form for advertising enquiries only.
        For other questions, contact us on WhatsApp.
      </div>

      <div id="advErr" style="background:var(--red-light);border-radius:10px;color:var(--red);font-size:13px;font-weight:600;padding:10px 12px;margin-bottom:14px;display:none"></div>

      <div class="fg">
        <div class="fl">Full Name</div>
        <input class="fi" id="advName" placeholder="Your name" value="${nameVal}">
      </div>
      <div class="fg">
        <div class="fl">Phone / WhatsApp</div>
        <input class="fi" id="advPhone" type="tel" placeholder="+263 77 ...">
      </div>
      <div class="fg">
        <div class="fl">What do you want to advertise?</div>
        <select class="fi" id="advType">
          <option value="">Select one</option>
          <option value="listing"${listing ? ' selected' : ''}>A specific listing</option>
          <option value="property">Property</option>
          <option value="vehicles">Vehicles</option>
          <option value="electronics">Electronics &amp; Gadgets</option>
          <option value="business">Business / Services</option>
          <option value="jobs">Jobs</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="fg">
        <div class="fl">Requirements</div>
        <textarea class="fi" id="advMsg" rows="3" placeholder="Tell us what you're advertising and the results you're looking for...">${listing ? escHtml('I would like to boost my listing: ' + listing.title) : ''}</textarea>
      </div>

      <button id="advBtn" class="btn-submit" style="width:100%;font-size:15px;margin-top:4px"
        onclick="H._adv.submit(${listing ? `'${escHtml(listing.id)}'` : 'null'})">
        Submit Enquiry
      </button>
      <div style="text-align:center;font-size:12px;color:var(--sub);margin-top:8px;margin-bottom:4px">
        Our team will contact you within 24 hours
      </div>

      <div id="advSuccess" style="display:none;text-align:center;padding:32px 0">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <div style="font-size:17px;font-weight:900;color:var(--text);margin-bottom:8px">Enquiry Received!</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.65">
          Our team will reach out via WhatsApp or call within 24 hours to discuss your advertising options.
        </div>
      </div>`;
  }

  // ─── Advertisements / Ads page ───────────────────────────────────────────────
  function adsPage() {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Advertisements')}
        ${H.emptyState('Sign in to continue', 'Create a free account to advertise on PaMarket', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const totalListings = (H.state.listings || []).filter(l => l.status === 'active').length;
    const statNum = totalListings > 100 ? totalListings.toLocaleString() + '+' : '10K+';

    return `<div class="page active">${H.innerTopbar('Advertisements')}

      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:28px 20px 26px;text-align:center">
        <div style="font-size:23px;font-weight:900;color:#fff;margin-bottom:6px">
          Pa<span style="color:#F5A623">Market</span> for Business
        </div>
        <div style="font-size:19px;font-weight:900;color:#fff;line-height:1.3;margin-bottom:10px">
          Reach Active Buyers<br>Across Zimbabwe
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);line-height:1.6;max-width:280px;margin:0 auto">
          We leverage our marketplace reach and traffic to help sellers, agents and businesses grow.
        </div>
      </div>

      <div style="display:flex;justify-content:space-around;align-items:center;padding:18px 20px;background:var(--blue-light);border-bottom:1px solid var(--blue-soft)">
        <div style="text-align:center">
          <div style="font-size:21px;font-weight:900;color:var(--blue)">${statNum}</div>
          <div style="font-size:11px;color:var(--sub);font-weight:600;margin-top:2px">Active Listings</div>
        </div>
        <div style="width:1px;height:36px;background:var(--blue-soft)"></div>
        <div style="text-align:center">
          <div style="font-size:21px;font-weight:900;color:var(--blue)">10</div>
          <div style="font-size:11px;color:var(--sub);font-weight:600;margin-top:2px">Provinces</div>
        </div>
        <div style="width:1px;height:36px;background:var(--blue-soft)"></div>
        <div style="text-align:center">
          <div style="font-size:21px;font-weight:900;color:var(--blue)">Free</div>
          <div style="font-size:11px;color:var(--sub);font-weight:600;margin-top:2px">To Post</div>
        </div>
      </div>

      <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
        ${[
          ['🏠','For Property Agents','Get your listings in front of buyers searching for homes and rentals.'],
          ['🚗','For Car Dealers','Robust placement plans to turbocharge your vehicle sales.'],
          ['📱','For Electronics','Premium placements for gadgets, phones and appliances.'],
          ['💼','For Businesses','Connect with customers looking for your services every day.'],
        ].map(([ icon, title, desc ]) =>
          `<div style="flex:1;padding:14px 10px;border-right:1px solid var(--border);text-align:center;background:var(--card)">
            <div style="font-size:24px;margin-bottom:6px">${icon}</div>
            <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:4px;line-height:1.3">${title}</div>
            <div style="font-size:11px;color:var(--sub);line-height:1.4">${desc}</div>
          </div>`
        ).join('')}
      </div>

      <div style="padding:20px 16px 80px">
        ${buildForm(null)}
      </div>
    </div>`;
  }

  pages.Ads      = adsPage;
  pages.Wallet   = adsPage;
  pages.Payments = adsPage;
  pages.TopUp    = adsPage;

  // ─── Boost page ──────────────────────────────────────────────────────────────
  pages.Boost = function ({ listingId } = {}) {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Boost a Listing')}
        ${H.emptyState('Sign in to continue', 'Sign in to boost your listings', 'Sign In', 'H.authPage()')}
      </div>`;
    }
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
    const listing = myActive.find(l => l.id === listingId) || myActive[0];

    return `<div class="page active">${H.innerTopbar('Boost a Listing')}
      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:22px 20px 20px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:6px">${I.boost} Get More Visibility</div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);line-height:1.5">
          Boosted listings appear at the top of search results and reach more buyers across Zimbabwe
        </div>
      </div>
      <div style="padding:16px 16px 80px">
        ${buildForm(listing)}
      </div>
    </div>`;
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────
  H._adv = {
    async submit(listingId) {
      const name  = (document.getElementById('advName')?.value  || '').trim();
      const phone = (document.getElementById('advPhone')?.value || '').trim();
      const type  = document.getElementById('advType')?.value   || '';
      const msg   = (document.getElementById('advMsg')?.value   || '').trim();
      const errEl = document.getElementById('advErr');
      const btn   = document.getElementById('advBtn');

      errEl.style.display = 'none';
      const showErr = m => { errEl.textContent = m; errEl.style.display = 'block'; };

      if (!name)  { showErr('Please enter your full name');               return; }
      if (!phone) { showErr('Please enter your phone / WhatsApp number'); return; }
      if (!type)  { showErr('Please select what you want to advertise');  return; }
      if (!msg)   { showErr('Please describe your requirements');         return; }

      btn.disabled = true; btn.textContent = 'Submitting…';

      const u = H.currentUser();
      const note = listingId
        ? `Boost enquiry · Listing: ${listingId} · ${type} · ${msg}`
        : `Ad enquiry · ${type} · ${msg}`;

      try {
        if (!window.supabase || typeof window.supabase.from !== 'function') throw new Error('Not connected');
        const { error } = await window.supabase.from('topup_requests').insert({
          user_id: u.id, user_name: name,
          amount: 0, method: phone,
          reference: type, status: 'pending', note,
        });
        if (error) throw error;
        document.getElementById('advSuccess').style.display = '';
        btn.style.display = 'none';
        errEl.style.display = 'none';
        ['advName','advPhone','advType','advMsg'].forEach(id => {
          const el = document.getElementById(id);
          if (el && el.closest('.fg')) el.closest('.fg').style.display = 'none';
        });
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Submit Enquiry';
        showErr('Could not submit. Please try again.');
      }
    },
  };

  H._wallet   = { openTopUp() { H.openInner('Ads'); }, openSite() { H.openInner('Ads'); } };
  H.showTopUp = () => H.openInner('Ads');

  H._copyText = function (el) {
    const text = (el && el.dataset) ? el.dataset.v : String(el);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    H.toast('Copied: ' + text);
  };

})(window.H);
