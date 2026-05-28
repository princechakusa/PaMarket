/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const { escHtml, fmtPrice, PROVINCES, CITIES_BY_PROV, CATEGORIES } = H;

  const IC = {
    bolt:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    star:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    photo:   '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    ads:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>',
    wa:      '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    mail:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    phone:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>',
  };

  // Category map: Ads-page id → H.CATEGORIES id
  const CAT_MAP = {
    property: 'property', vehicles: 'vehicles', electronics: 'electronics',
    business: 'services', jobs: 'jobs', other: 'other',
  };

  const ADS_CATS = [
    { id:'listing',     icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', title:'A specific listing',    desc:'Boost or feature one of your existing ads' },
    { id:'property',    icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', title:'Property',              desc:'Homes, land, rentals and commercial spaces' },
    { id:'vehicles',    icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>', title:'Vehicles',              desc:'Cars, trucks, motorbikes and more' },
    { id:'electronics', icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>', title:'Electronics & Gadgets', desc:'Phones, laptops and appliances' },
    { id:'business',    icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>', title:'Business / Services',   desc:'Promote your services to active buyers' },
    { id:'jobs',        icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', title:'Jobs',                  desc:'Find the best talent for your company' },
    { id:'other',       icon:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', title:'Other',                 desc:'Everything else' },
  ];

  // Module-level state
  let _selIndex     = 0;
  let _selBoostType = 'Sponsored Listing';
  let _myListings   = [];

  // Ad creation form state
  let _cs = { cat:'', title:'', desc:'', price:'', currency:'USD', prov:'', city:'', suburb:'', contact:'chat', photos:[] };

  // ─── ENTRY: category picker ──────────────────────────────────────────────────
  pages.Ads = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Advertisements')}
        ${H.emptyState('Sign in to continue', 'Create a free account to advertise on PaMarket', 'Sign In', 'H.authPage()')}
      </div>`;
    }
    return `<div class="page active">${H.innerTopbar('Advertisements')}

      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:22px 20px 20px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:5px">Pa<span style="color:#F5A623">Market</span> for Business</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.5">Reach active buyers across all 10 provinces of Zimbabwe</div>
      </div>

      <div style="padding:16px 16px 80px">
        <div style="font-size:19px;font-weight:900;color:var(--text);margin-bottom:3px">What do you want to advertise?</div>
        <div style="font-size:13px;color:var(--sub);margin-bottom:16px">Choose a category to get started</div>

        ${ADS_CATS.map(c => `
          <div onclick="H._adv.pickCategory('${c.id}')"
              style="display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:pointer;-webkit-tap-highlight-color:transparent">
            <div style="width:46px;height:46px;background:var(--bg);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text)">${c.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;color:var(--text)">${c.title}</div>
              <div style="font-size:12px;color:var(--sub);margin-top:2px;line-height:1.4">${c.desc}</div>
            </div>
            ${IC.chevron}
          </div>`).join('')}

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:6px 0 20px">
          ${[['🏙️','10','Provinces'],['👥','50K+','Buyers'],['📈','3×','More Reach']].map(([e,n,l])=>`
            <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 8px;text-align:center">
              <div style="font-size:20px">${e}</div>
              <div style="font-size:16px;font-weight:900;color:#1A3A8F">${n}</div>
              <div style="font-size:10px;font-weight:600;color:var(--sub)">${l}</div>
            </div>`).join('')}
        </div>

        <!-- Learn more -->
        <div style="background:var(--blue-light);border:1px solid var(--blue-soft);border-radius:14px;padding:14px 16px;margin-bottom:20px">
          <div style="font-size:14px;font-weight:800;color:#1A3A8F;margin-bottom:6px">How advertising works</div>
          <div style="font-size:13px;color:var(--text);line-height:1.7">1. Choose a category above<br>2. Fill in your ad details &amp; photos<br>3. Our team reviews it (usually within 24 hrs)<br>4. Your ad goes live and reaches buyers across Zimbabwe</div>
          <button onclick="H._adv.learnMore()" style="margin-top:10px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Learn More →</button>
        </div>

        <!-- Social media -->
        <div style="border-top:1px solid var(--border);padding-top:18px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:12px">Follow us on social media</div>
          <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">
            <a href="https://www.facebook.com/pamarket" target="_blank" style="width:44px;height:44px;border-radius:12px;background:#1877F2;display:flex;align-items:center;justify-content:center;text-decoration:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
            <a href="https://www.instagram.com/pamarket" target="_blank" style="width:44px;height:44px;border-radius:12px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;text-decoration:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="#fff" stroke="none"/></svg></a>
            <a href="https://x.com/pamarket" target="_blank" style="width:44px;height:44px;border-radius:12px;background:#000;display:flex;align-items:center;justify-content:center;text-decoration:none"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
            <a href="https://www.tiktok.com/@pamarket" target="_blank" style="width:44px;height:44px;border-radius:12px;background:#010101;display:flex;align-items:center;justify-content:center;text-decoration:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/></svg></a>
            <a href="https://www.youtube.com/@pamarket" target="_blank" style="width:44px;height:44px;border-radius:12px;background:#FF0000;display:flex;align-items:center;justify-content:center;text-decoration:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#FF0000"/></svg></a>
            <a href="https://www.linkedin.com/company/pamarket" target="_blank" style="width:44px;height:44px;border-radius:12px;background:#0A66C2;display:flex;align-items:center;justify-content:center;text-decoration:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
          </div>
        </div>
      </div>
    </div>`;
  };

  pages.Wallet = function () {
    return `<div class="page active">
      ${H.innerTopbar('Wallet')}
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;gap:20px">
        <svg viewBox="0 0 64 64" width="80" height="80" fill="none">
          <rect x="4" y="16" width="56" height="40" rx="8" fill="#EEF2FF" stroke="#1A3A8F" stroke-width="3"/>
          <path d="M4 26h56" stroke="#1A3A8F" stroke-width="3"/>
          <circle cx="44" cy="40" r="8" fill="#F5A623"/>
          <path d="M44 34v12M38 40h12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M10 34h16M10 40h10" stroke="#1A3A8F" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <div>
          <h2 style="font-size:1.35rem;font-weight:700;color:var(--n1);margin:0 0 8px">Wallet &mdash; Coming Soon</h2>
          <p style="color:var(--sub);max-width:280px;margin:0;line-height:1.55;font-size:0.95rem">Manage your PaMarket balance, send money to other users, and track every transaction.</p>
        </div>
        <div style="background:var(--n5);border-radius:14px;padding:18px 20px;max-width:300px;width:100%;text-align:left">
          <p style="font-size:0.82rem;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px">Features in development</p>
          <ul style="color:var(--n1);margin:0;padding-left:18px;line-height:2;font-size:0.92rem">
            <li>PaMarket Wallet balance</li>
            <li>Peer-to-peer payments</li>
            <li>Ecocash &amp; bank top-up</li>
            <li>Full transaction history</li>
          </ul>
        </div>
      </div>
    </div>`;
  };

  pages.Payments = function () {
    return `<div class="page active">
      ${H.innerTopbar('Payment History')}
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;gap:20px">
        <svg viewBox="0 0 64 64" width="80" height="80" fill="none">
          <rect x="4" y="12" width="56" height="44" rx="8" fill="#EEF2FF" stroke="#1A3A8F" stroke-width="3"/>
          <path d="M4 24h56" stroke="#1A3A8F" stroke-width="3"/>
          <rect x="10" y="32" width="18" height="12" rx="3" fill="#1A3A8F"/>
          <path d="M36 35h16M36 41h10" stroke="#1A3A8F" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <div>
          <h2 style="font-size:1.35rem;font-weight:700;color:var(--n1);margin:0 0 8px">Payments &mdash; Coming Soon</h2>
          <p style="color:var(--sub);max-width:280px;margin:0;line-height:1.55;font-size:0.95rem">Your full payment history and transaction records will appear here once the wallet is live.</p>
        </div>
      </div>
    </div>`;
  };

  pages.TopUp = function () {
    return `<div class="page active">
      ${H.innerTopbar('Top Up')}
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;gap:20px">
        <svg viewBox="0 0 64 64" width="80" height="80" fill="none">
          <circle cx="32" cy="32" r="28" fill="#EEF2FF" stroke="#1A3A8F" stroke-width="3"/>
          <path d="M32 20v24M20 32h24" stroke="#F5A623" stroke-width="5" stroke-linecap="round"/>
        </svg>
        <div>
          <h2 style="font-size:1.35rem;font-weight:700;color:var(--n1);margin:0 0 8px">Top Up &mdash; Coming Soon</h2>
          <p style="color:var(--sub);max-width:280px;margin:0;line-height:1.55;font-size:0.95rem">Add funds to your PaMarket Wallet via Ecocash, Zipit, or bank transfer.</p>
        </div>
        <div style="background:var(--n5);border-radius:14px;padding:18px 20px;max-width:300px;width:100%;text-align:left">
          <p style="font-size:0.82rem;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px">Payment methods planned</p>
          <ul style="color:var(--n1);margin:0;padding-left:18px;line-height:2;font-size:0.92rem">
            <li>Ecocash</li>
            <li>Zipit / RTGS</li>
            <li>Visa / Mastercard</li>
            <li>Bank transfer</li>
          </ul>
        </div>
      </div>
    </div>`;
  };

  // ─── Ad creation form (for category cards) ───────────────────────────────────
  pages.AdsCreate = function ({ category } = {}) {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Create Advertisement')}
        ${H.emptyState('Not signed in', 'Please sign in to continue', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const catId  = CAT_MAP[category] || category || '';
    const catObj = CATEGORIES.find(c => c.id === catId);
    const catIcon = ADS_CATS.find(c => CAT_MAP[c.id] === catId || c.id === category)?.icon || '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';

    _cs = { cat: catId, title:'', desc:'', price:'', currency:'USD', company:'',
            prov: PROVINCES[0], city:(CITIES_BY_PROV[PROVINCES[0]]||[])[0]||'',
            suburb:'', contact:'chat', photos:[] };

    return renderCreateShell(catIcon, catObj?.name || category || 'Other');
  };

  function renderCreateShell(catIcon, catName) {
    return `<div class="page active">${H.innerTopbar('Create Advertisement')}
      <div style="display:flex;align-items:center;gap:10px;padding:14px 16px 10px;background:var(--card);border-bottom:1px solid var(--border)">
        <span style="color:var(--text)">${catIcon}</span>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text)">${escHtml(catName)}</div>
          <div style="font-size:12px;color:var(--sub)">Fill in the details below</div>
        </div>
      </div>
      <div style="padding:16px 16px 100px" id="adsCreateBody">
        ${renderCreateForm()}
      </div>
    </div>`;
  }

  function renderCreateForm() {
    const s = _cs;
    const prov = s.prov || PROVINCES[0];
    const cities = CITIES_BY_PROV[prov] || [];

    const photoGrid = s.photos.map((p, i) =>
      `<div style="position:relative;width:80px;height:80px;flex-shrink:0">
        <img src="${p}" style="width:80px;height:80px;border-radius:10px;object-fit:cover">
        <button onclick="H._adsCreate.removePhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
      </div>`
    ).join('');

    const isJobs = s.cat === 'jobs';
    const maxPhotos = isJobs ? 2 : 8;

    return `
      ${isJobs ? `
      <div class="fg">
        <div class="fl">Company Name <span style="color:var(--red)">*</span></div>
        <input class="fi" id="acCompany" value="${escHtml(s.company)}" placeholder="e.g. ABC Holdings Zimbabwe" maxlength="80">
      </div>
      ` : ''}
      <div class="fg">
        <div class="fl">${isJobs ? 'Ad Headline' : 'Title'} <span style="color:var(--red)">*</span></div>
        <input class="fi" id="acTitle" value="${escHtml(s.title)}" placeholder="${isJobs ? 'e.g. Now Hiring: Sales Executives — Join Our Growing Team' : 'e.g. 3 Bedroom House in Avondale'}" maxlength="80">
      </div>
      <div class="fg">
        <div class="fl">Description <span style="color:var(--red)">*</span></div>
        <textarea class="fi" rows="4" id="acDesc" placeholder="${isJobs ? 'Describe the position(s), what you offer, and why candidates should apply. Include role, salary range, requirements, and how to apply.' : 'Describe what you\'re advertising — condition, features, why buyers should contact you...'}" maxlength="2000">${escHtml(s.desc)}</textarea>
      </div>

      <div class="fg">
        <div class="fl">${isJobs ? 'Company Logo / Ad Banner' : 'Photos <span style="color:var(--red)">*</span>'} <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub)">${isJobs ? '(optional, up to 2)' : '(min 1, up to 8)'}</span></div>
        ${isJobs ? `<div style="background:#1A3A8F0D;border:1px solid #1A3A8F22;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:12px;color:#1A3A8F;line-height:1.6">Upload your company logo and/or a "Now Hiring" banner. This appears alongside your ad to attract candidates.</div>` : ''}
        <label for="acPhotos" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:2px dashed var(--border);border-radius:14px;padding:20px;cursor:pointer;background:var(--bg);margin-bottom:10px">
          ${IC.photo}
          <div style="font-size:14px;font-weight:600;color:var(--sub)">${isJobs ? 'Tap to add logo / banner' : 'Tap to add photos'}</div>
          <div style="font-size:12px;color:var(--sub)">JPG, PNG · Max ${maxPhotos} image${maxPhotos > 1 ? 's' : ''}</div>
        </label>
        <input type="file" id="acPhotos" accept="image/*" multiple style="display:none" onchange="H._adsCreate.onPhotos(event)">
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="acPhotoGrid">${photoGrid}</div>
      </div>

      <input type="hidden" id="acPrice" value="0">

      <div class="fg">
        <div class="fl">Province</div>
        <select class="fi" id="acProv" onchange="H._adsCreate.onProv(this.value)">
          ${PROVINCES.map(p => `<option${p===prov?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <div class="fl">City / Town</div>
        <select class="fi" id="acCity">
          ${cities.map(c => `<option${c===s.city?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <div class="fl">Suburb / Area <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub)">(optional)</span></div>
        <input class="fi" id="acSuburb" value="${escHtml(s.suburb)}" placeholder="e.g. Avondale West">
      </div>

      <div class="fg">
        <div class="fl">Preferred Contact Method</div>
        <div style="display:flex;gap:8px">
          <button onclick="H._adsCreate.setContact('chat')" style="flex:1;padding:12px;border-radius:10px;border:2px solid ${s.contact==='chat'?'#1A3A8F':'var(--border)'};background:${s.contact==='chat'?'var(--blue-light)':'var(--card)'};color:${s.contact==='chat'?'#1A3A8F':'var(--text)'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            💬 In-App Chat
          </button>
          <button onclick="H._adsCreate.setContact('phone')" style="flex:1;padding:12px;border-radius:10px;border:2px solid ${s.contact==='phone'?'#1A3A8F':'var(--border)'};background:${s.contact==='phone'?'var(--blue-light)':'var(--card)'};color:${s.contact==='phone'?'#1A3A8F':'var(--text)'};font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            📞 Phone Call
          </button>
        </div>
      </div>

      <div id="acErr" style="background:var(--red-light);border-radius:10px;color:var(--red);font-size:13px;font-weight:600;padding:10px 12px;margin-bottom:12px;display:none"></div>

      <button id="acBtn" class="btn-submit" style="width:100%;font-size:15px" onclick="H._adsCreate.submit()">
        Submit Advertisement
      </button>
      <div style="text-align:center;font-size:12px;color:var(--sub);margin-top:8px">
        Your ad will go live after admin review (usually within 24 hours)
      </div>`;
  }

  H._adsCreate = {
    setCur(c) {
      _cs.currency = c;
      const body = document.getElementById('adsCreateBody');
      if (body) body.innerHTML = renderCreateForm();
    },
    onProv(p) {
      _cs.prov = p;
      _cs.city = (CITIES_BY_PROV[p] || [])[0] || '';
      const body = document.getElementById('adsCreateBody');
      if (body) body.innerHTML = renderCreateForm();
    },
    setContact(m) {
      _cs.contact = m;
      const body = document.getElementById('adsCreateBody');
      if (body) body.innerHTML = renderCreateForm();
    },
    onPhotos(e) {
      const files = Array.from(e.target.files || []);
      const maxPhotos = _cs.cat === 'jobs' ? 2 : 8;
      const remaining = maxPhotos - _cs.photos.length;
      files.slice(0, remaining).forEach(f => {
        if (!f.type.startsWith('image/')) return;
        (H.compressImage || _compressImage)(f, 1200, 0.78).then(d => {
          _cs.photos.push(d);
          const grid = document.getElementById('acPhotoGrid');
          if (grid) grid.innerHTML = _cs.photos.map((p, i) =>
            `<div style="position:relative;width:80px;height:80px;flex-shrink:0"><img src="${p}" style="width:80px;height:80px;border-radius:10px;object-fit:cover"><button onclick="H._adsCreate.removePhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button></div>`
          ).join('');
        });
      });
      e.target.value = '';
    },
    removePhoto(i) {
      _cs.photos.splice(i, 1);
      const grid = document.getElementById('acPhotoGrid');
      if (grid) grid.innerHTML = _cs.photos.map((p, idx) =>
        `<div style="position:relative;width:80px;height:80px;flex-shrink:0"><img src="${p}" style="width:80px;height:80px;border-radius:10px;object-fit:cover"><button onclick="H._adsCreate.removePhoto(${idx})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button></div>`
      ).join('');
    },
    async submit() {
      _cs.title   = (document.getElementById('acTitle')?.value   || '').trim();
      _cs.desc    = (document.getElementById('acDesc')?.value    || '').trim();
      _cs.price   = document.getElementById('acPrice')?.value    || '0';
      _cs.suburb  = (document.getElementById('acSuburb')?.value  || '').trim();
      _cs.company = (document.getElementById('acCompany')?.value || '').trim();

      const errEl = document.getElementById('acErr');
      const btn   = document.getElementById('acBtn');
      errEl.style.display = 'none';
      const err = m => { errEl.textContent = m; errEl.style.display = 'block'; errEl.scrollIntoView({behavior:'smooth',block:'nearest'}); };

      if (_cs.cat === 'jobs' && !_cs.company) { err('Company name is required'); return; }
      if (_cs.title.length < 5)  { err('Title needs at least 5 characters'); return; }
      if (_cs.desc.length < 10)  { err('Description needs at least 10 characters'); return; }
      if (_cs.cat !== 'jobs' && !_cs.photos.length) { err('Please add at least one photo'); return; }

      btn.disabled = true; btn.textContent = 'Submitting…';

      const u = H.currentUser();
      const needsApproval = !!(H.state.requireListingApproval && !(H.state.autoApproveVerified && u.verified));
      const listing = {
        id: H.uid(), sellerId: u.id, sellerName: u.name || '', sellerPhone: u.phone || '',
        title: _cs.title, desc: _cs.desc, price: _cs.price, currency: _cs.currency,
        cat: _cs.cat, prov: _cs.prov, city: _cs.city, suburb: _cs.suburb,
        company: _cs.company || '',
        photos: _cs.photos, createdAt: Date.now(),
        status: 'pending',
        contactMethod: _cs.contact, boost: null, views: 0,
      };

      if (!Array.isArray(H.state.listings)) H.state.listings = [];
      H.state.listings.unshift(listing);
      H.saveState();
      if (typeof H.saveListingToCloud === 'function') H.saveListingToCloud(listing);

      H.toast('Ad submitted! It will go live after admin review. ✅', 5000);
      H.goBack();
    },
  };

  // Fallback compressImage (in case post.js hasn't loaded yet)
  function _compressImage(file, maxDim, q) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = ev => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h > maxDim)     { w = Math.round(w * maxDim / h); h = maxDim; }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          res(c.toDataURL('image/jpeg', q || 0.78));
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  // ─── AdsBoost: select listing to promote ─────────────────────────────────────
  pages.AdsBoost = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Select a Listing')}
        ${H.emptyState('Not signed in', 'Please sign in to continue', 'Sign In', 'H.authPage()')}
      </div>`;
    }
    _myListings = (H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active');
    if (!_myListings.length) {
      return `<div class="page active">${H.innerTopbar('Select a Listing')}
        <div class="empty-state">
          <div class="empty-icon">${IC.ads}</div>
          <div class="empty-title">No active listings</div>
          <div class="empty-sub">Post a listing first, then come back to promote it.</div>
          <button class="btn-pri" style="max-width:240px;margin-top:12px" onclick="H.navTo('Post',null)">Post an Ad</button>
        </div>
      </div>`;
    }
    return `<div class="page active">${H.innerTopbar('Select a Listing')}
      <div style="padding:12px 16px 80px">
        <div style="font-size:13px;color:var(--sub);margin-bottom:14px">Select the listing you want to promote</div>
        ${_myListings.map((l, i) => {
          const thumb = (l.photos && l.photos[0])
            ? `<img src="${escHtml(l.photos[0])}" style="width:54px;height:54px;border-radius:10px;object-fit:cover;flex-shrink:0">`
            : `<div style="width:54px;height:54px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)">${IC.photo}</div>`;
          return `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
              ${thumb}
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
                <div style="font-size:12px;color:var(--sub);margin-top:3px">${escHtml(fmtPrice(l.price, l.currency))} · ${escHtml(l.city || '')}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <button onclick="H._adv.selectBoost(${i},'Sponsored Listing')"
                style="padding:10px 8px;background:var(--blue-light);border:1.5px solid var(--blue-soft);border-radius:10px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.3">
                ${IC.bolt} Sponsored<div style="font-size:10px;font-weight:500;margin-top:3px;opacity:.75">Every 5 listings</div>
              </button>
              <button onclick="H._adv.selectBoost(${i},'Featured Ad')"
                style="padding:10px 8px;background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;color:#B45309;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;line-height:1.3">
                ${IC.star} Featured<div style="font-size:10px;font-weight:500;margin-top:3px;opacity:.75">Top placement</div>
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  };

  // ─── AdsContact: contact sales ────────────────────────────────────────────────
  pages.AdsContact = function () {
    const listing = _myListings[_selIndex];
    const title   = listing ? listing.title : 'my listing';
    const type    = _selBoostType;
    const msg     = `Hello, I want to promote my ad: "${title}" (${type})`;
    const msgE    = encodeURIComponent(msg);
    const subE    = encodeURIComponent('Advertising Enquiry — ' + type);

    function btn(bg, border, color, icon, label, sub, action) {
      return `<button onclick="${action}"
        style="width:100%;display:flex;align-items:center;gap:14px;padding:16px;background:${bg};border:1.5px solid ${border};border-radius:14px;color:${color};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;text-align:left">
        <span style="flex-shrink:0">${icon}</span>
        <div><div>${label}</div><div style="font-size:12px;font-weight:400;opacity:.8;margin-top:2px">${sub}</div></div>
      </button>`;
    }

    return `<div class="page active">${H.innerTopbar('Contact Sales')}
      <div style="padding:20px 16px 80px">
        <div style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:4px">Promote Your Listing</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:20px">
          Contact our team to set up your <strong style="color:var(--text)">${escHtml(type)}</strong> package.
        </div>
        <div style="background:var(--blue-light);border:1px solid var(--blue-soft);border-radius:12px;padding:14px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pre-filled message</div>
          <div style="font-size:13px;color:var(--text);line-height:1.6;font-style:italic">"${escHtml(msg)}"</div>
        </div>
        ${btn('#25D366','#25D366','#fff', IC.wa,    'WhatsApp Us',  'Fastest response — usually within the hour', `window.open('https://wa.me/971589772645?text=${msgE}','_blank')`)}
        ${btn('var(--card)','var(--border)','var(--text)', IC.mail,'Email Us','info@pamarket.co.zw',`window.open('mailto:info@pamarket.co.zw?subject=${subE}&body=${msgE}','_blank')`)}
        ${btn('var(--card)','var(--border)','var(--text)', IC.phone,'Call Us','Mon–Sat, 8am–6pm CAT',`window.location.href='tel:+263787341565'`)}
        <div style="margin-top:20px;text-align:center;font-size:12px;color:var(--sub);line-height:1.7">
          No payment is taken through the app.
        </div>
      </div>
    </div>`;
  };

  // ─── My Advertisements ────────────────────────────────────────────────────────
  pages.MyAds = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('My Advertisements')}
        ${H.emptyState('Not signed in', 'Sign in to view your advertisements', 'Sign In', 'H.authPage()')}
      </div>`;
    }
    const all     = (H.state.listings || []).filter(l => l.sellerId === u.id);
    const active  = all.filter(l => l.status === 'active');
    const pending = all.filter(l => l.status === 'pending');
    const boosted = all.filter(l => l.boosted || l.featured);

    function row(l) {
      const thumb = (l.photos && l.photos[0])
        ? `<img src="${escHtml(l.photos[0])}" style="width:50px;height:50px;border-radius:10px;object-fit:cover;flex-shrink:0">`
        : `<div style="width:50px;height:50px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)">${IC.photo}</div>`;
      return `
        <div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            ${thumb}
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
              <div style="font-size:11px;color:var(--sub);margin-top:3px">${escHtml(fmtPrice(l.price, l.currency))} · ${escHtml(l.city || '')}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="H.openInner('EditListing',{listingId:'${escHtml(l.id)}'})"
              style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);font-size:11px;font-weight:700;padding:7px 8px;border-radius:8px;cursor:pointer;font-family:inherit">
              ✏️ Edit
            </button>
            <button onclick="H._adv.promoteFromDash('${escHtml(l.id)}')"
              style="flex:1;background:var(--blue-light);border:1px solid var(--blue-soft);color:var(--blue);font-size:11px;font-weight:700;padding:7px 8px;border-radius:8px;cursor:pointer;font-family:inherit">
              Promote
            </button>
            <button onclick="H._adv.deleteAd('${escHtml(l.id)}')"
              style="background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;font-size:13px;font-weight:700;padding:7px 10px;border-radius:8px;cursor:pointer;font-family:inherit;flex-shrink:0">
              🗑
            </button>
          </div>
        </div>`;
    }

    function section(title, items, emptyMsg) {
      return `
        <div style="margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;padding:0 16px;margin-bottom:8px">
            ${title} <span style="background:var(--blue);color:#fff;border-radius:8px;padding:1px 7px;font-size:10px;margin-left:4px">${items.length}</span>
          </div>
          <div style="background:var(--card);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:0 16px">
            ${items.length ? items.map(row).join('') : `<div style="padding:18px 0;text-align:center;font-size:13px;color:var(--sub)">${emptyMsg}</div>`}
          </div>
        </div>`;
    }

    return `<div class="page active">${H.innerTopbar('My Advertisements')}
      <div style="padding:16px 0 80px">
        <div style="padding:0 16px;margin-bottom:16px">
          <button onclick="H.openInner('Ads')"
            style="width:100%;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
            ${IC.ads} New Advertisement
          </button>
        </div>
        ${section('Active Ads',  active,  'No active ads yet')}
        ${section('Pending',     pending, 'No pending ads')}
        ${section('Boosted',     boosted, 'No boosted ads — tap Promote to get started')}
      </div>
    </div>`;
  };

  // ─── Learn More inner page ────────────────────────────────────────────────────
  pages.AdsLearnMore = function () {
    function section(emoji, title, color, features, desc) {
      return `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:50px;height:50px;background:${color}18;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">${emoji}</div>
            <div style="font-size:18px;font-weight:900;color:var(--text)">${title}</div>
          </div>
          <div style="font-size:13px;color:var(--text);line-height:1.75;margin-bottom:14px">${desc}</div>
          <div style="border-top:1px solid var(--border);padding-top:12px">
            ${features.map(f => `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px"><span style="color:${color};font-size:15px;flex-shrink:0">✓</span><span style="font-size:13px;color:var(--text);line-height:1.5">${f}</span></div>`).join('')}
          </div>
          <div style="margin-top:12px;padding:8px 12px;background:${color}12;border-radius:8px;font-size:11px;color:${color};font-weight:700;text-align:center">
            &copy; 2026 PaMarket. All rights reserved.
          </div>
        </div>`;
    }

    return `<div class="page active">${H.innerTopbar('Learn More')}
      <div style="padding:16px 16px 80px">

        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);border-radius:16px;padding:20px;margin-bottom:20px;text-align:center">
          <div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px">Advertising on Pa<span style="color:#F5A623">Market</span></div>
          <div style="font-size:13px;color:rgba(255,255,255,.85);line-height:1.6">Zimbabwe's free marketplace connecting buyers and sellers across all 10 provinces</div>
        </div>

        ${section('👔', 'Jobs & Hiring', '#1A3A8F',
          [
            'Post vacancies that reach thousands of job seekers across Zimbabwe',
            'Filter candidates by province, city or skill set',
            'Receive applications directly through in-app chat',
            'Free to post — no recruitment agency fees',
            'Admin-reviewed listings guarantee quality postings',
          ],
          'Reach the best local talent fast. Whether you need a driver in Harare, an accountant in Bulawayo, or a farmhand in Masvingo — PaMarket connects you with active job seekers across the country. Post your vacancy today and let candidates come to you.'
        )}

        ${section('🤝', 'Hire Candidates', '#059669',
          [
            'Browse verified candidate profiles and CVs',
            'View skills, experience and location at a glance',
            'Contact candidates directly — no middleman',
            'Candidates upload portfolios and reference letters',
            'Real-time availability status on each profile',
          ],
          'Don\'t wait for applications — go straight to the talent. Our Hire Candidates section lets you browse ready-to-work professionals who have already uploaded their CVs and skills. Ideal for urgent roles or specialised positions where you need the right person fast.'
        )}

        ${section('🏠', 'Properties', '#D97706',
          [
            'List residential homes, plots, farms and commercial spaces',
            'Rentals, sales and lease listings all in one place',
            'High-quality photo galleries for each property',
            'Location mapped to province, city and suburb',
            'Boosted listings appear at the top of search results',
          ],
          'Zimbabwe\'s property market moves fast. Whether you\'re selling a house in Borrowdale, renting a flat in Mutare, or listing commercial space in the CBD — PaMarket gives your property maximum visibility. Our platform reaches serious buyers and tenants who are actively searching.'
        )}

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px">How it works</div>
          ${[
            ['1', 'Choose a category and fill in your ad details'],
            ['2', 'Add clear photos — more photos get more views'],
            ['3', 'Our team reviews your listing (within 24 hours)'],
            ['4', 'Your ad goes live and buyers can contact you directly'],
          ].map(([n, t]) => `
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
              <div style="width:26px;height:26px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</div>
              <div style="font-size:13px;color:var(--text);line-height:1.5;padding-top:4px">${t}</div>
            </div>`).join('')}
        </div>

        <div style="text-align:center;padding:16px 0;border-top:1px solid var(--border)">
          <div style="font-size:12px;color:var(--sub);line-height:1.8">
            &copy; 2026 PaMarket Zimbabwe (Pvt) Ltd. All rights reserved.<br>
            Unauthorised reproduction of listings or content is prohibited.<br>
            <span style="font-weight:700;color:var(--text)">info@pamarket.co.zw</span>
          </div>
        </div>
      </div>
    </div>`;
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  H._adv = {
    pickCategory(cat) {
      if (cat === 'listing') {
        H.openInner('AdsBoost');
      } else {
        H.openInner('AdsCreate', { category: cat });
      }
    },
    selectBoost(idx, boostType) {
      _selIndex     = idx;
      _selBoostType = boostType;
      H.openInner('AdsContact');
    },
    learnMore() {
      H.openInner('AdsLearnMore');
    },
    promoteFromDash(listingId) {
      const u = H.currentUser();
      _myListings = (H.state.listings || []).filter(l => l.sellerId === (u || {}).id && l.status === 'active');
      const idx = _myListings.findIndex(l => l.id === listingId);
      _selIndex     = idx >= 0 ? idx : 0;
      _selBoostType = 'Sponsored Listing';
      H.openInner('AdsContact');
    },
    deleteAd(id) {
      if (!window.confirm('Delete this ad permanently?')) return;
      H.state.listings = (H.state.listings || []).filter(l => l.id !== id);
      H.saveState();
      if (typeof H.deleteListingFromCloud === 'function') H.deleteListingFromCloud(id);
      H.toast('Ad deleted');
      H.renderPage('MyAds');
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
