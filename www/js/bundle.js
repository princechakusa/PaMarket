/* PaMarket bundle — built 2026-05-28T14:12:33Z */

;/* === www/js/app.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
window.H = {
  KEY:          'pamarket.v2',
  STATE_VERSION: 1,

  PROVINCES: ['Harare','Bulawayo','Manicaland','Mashonaland West','Mashonaland East','Mashonaland Central','Midlands','Masvingo','Matabeleland North','Matabeleland South'],
  CITIES_BY_PROV: {
    'Harare':             ['Harare CBD','Borrowdale','Avondale','Mabelreign','Marlborough','Belvedere','Greendale','Hatfield','Highfield','Mbare','Glen View','Budiriro','Kuwadzana','Warren Park','Chitungwiza','Epworth','Norton','Ruwa'],
    'Bulawayo':           ['Bulawayo CBD','Hillside','Khumalo','Suburbs','Famona','Pumula','Cowdray Park','Nkulumane','Magwegwe','Plumtree'],
    'Manicaland':         ['Mutare','Chipinge','Chimanimani','Rusape','Nyanga','Birchenough Bridge'],
    'Mashonaland West':   ['Chinhoyi','Kadoma','Karoi','Kariba','Mhangura','Banket','Norton'],
    'Mashonaland East':   ['Marondera','Mutoko','Murehwa','Wedza','Hwedza'],
    'Mashonaland Central':['Bindura','Mt Darwin','Shamva','Concession','Mvurwi'],
    'Midlands':           ['Gweru','Kwekwe','Zvishavane','Shurugwi','Redcliff','Mberengwa'],
    'Masvingo':           ['Masvingo','Chiredzi','Bikita','Triangle','Mwenezi'],
    'Matabeleland North': ['Hwange','Victoria Falls','Lupane','Binga'],
    'Matabeleland South': ['Beitbridge','Gwanda','Plumtree','Filabusi']
  },

  ICONS: {
    search:   `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    user:     `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    doc:      `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    heart:    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    ads:      `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    help:     `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    logout:   `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    close:    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    location: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    boost:    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    eye:      `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    share:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  },

  CATEGORIES: [
    {id:'property',    name:'Property',    icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'},
    {id:'vehicles',    name:'Vehicles',    icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'},
    {id:'rooms',       name:'Rooms',       icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4h20v16H2z"/><path d="M2 12h20"/></svg>'},
    {id:'electronics', name:'Electronics', icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'},
    {id:'jobs',        name:'Jobs',        icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>'},
    {id:'furniture',   name:'Furniture',   icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="10" rx="2"/><path d="M4 12h16v8H4z"/><line x1="8" y1="20" x2="16" y2="20"/></svg>'},
    {id:'fashion',     name:'Fashion',     icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3l5 5 5-5"/><path d="M7 21l5-5 5 5"/><line x1="12" y1="8" x2="12" y2="16"/></svg>'},
    {id:'services',    name:'Services',    icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'},
    {id:'agriculture', name:'Agriculture', icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 10v4"/><path d="M4.93 10.93l3.54 3.54"/><path d="M15.07 10.93l-3.54 3.54"/></svg>'},
    {id:'pets',        name:'Pets',        icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c-2 0-3 2-3 4 0 2 2 4 4 5s2 2 2 4-1 4-3 4"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="6" r="2"/></svg>'},
    {id:'kids',        name:'Baby & Kids', icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a7 7 0 0 1 4-6.33"/><path d="M21 21v-2a7 7 0 0 0-4-6.33"/></svg>'},
    {id:'other',       name:'Other',       icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="15" y2="12"/></svg>'}
  ],

  BOOST_PLANS: [
    {id:'standard', name:'Standard Boost', price:2,  days:7,  desc:'Featured at the top of your category for 7 days.',  badgeText:''},
    {id:'premium',  name:'Premium Boost',  price:5,  days:14, desc:'Prime placement across category and search for 14 days.', badge:'hot', badgeText:'Most Popular'},
    {id:'mega',     name:'Mega Boost',     price:10, days:30, desc:'30 days of maximum visibility across all sections.', badgeText:'Best Value'}
  ],

  state:            {},
  pageStack:        [],
  currentPageName:  'Home',
  currentPageParams:{},
  _activeChat:      null,
  camStream:        null,
  livenessTimer:    null,
  pages:            {},

  defaultState: {
    users:[], listings:[], conversations:[], reports:[], txns:[],
    saves:{}, notifs:{}, currentUserId:null, cityFilter:'All Zimbabwe',
    _sortMode:'newest', _priceMin:'', _priceMax:'',
    adminLogs:[], supportTickets:[], topupRequests:[], paidAds:[]
  },

  loadState() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return JSON.parse(JSON.stringify(this.defaultState));
      const loaded = JSON.parse(raw);
      const base   = JSON.parse(JSON.stringify(this.defaultState));
      if (loaded._v !== this.STATE_VERSION) {
        console.warn(
          '[PaMarket] State schema mismatch (stored _v=' + loaded._v +
          ', expected ' + this.STATE_VERSION + '). Migrating — preserving listings, users, conversations.'
        );
        // Preserve critical user-generated data; reset ephemeral/structural fields.
        const migrated = Object.assign(base, {
          users:         Array.isArray(loaded.users)         ? loaded.users         : base.users,
          listings:      Array.isArray(loaded.listings)      ? loaded.listings      : base.listings,
          conversations: Array.isArray(loaded.conversations) ? loaded.conversations : base.conversations,
          saves:         loaded.saves  && typeof loaded.saves  === 'object' ? loaded.saves  : base.saves,
          notifs:        loaded.notifs && typeof loaded.notifs === 'object' ? loaded.notifs : base.notifs,
          currentUserId: loaded.currentUserId || base.currentUserId,
          cityFilter:    loaded.cityFilter    || base.cityFilter,
          txns:          Array.isArray(loaded.txns)          ? loaded.txns          : base.txns,
        });
        migrated._v = this.STATE_VERSION;
        return migrated;
      }
      return Object.assign(base, loaded);
    } catch { return JSON.parse(JSON.stringify(this.defaultState)); }
  },

  saveState() {
    const safe = JSON.parse(JSON.stringify(this.state));
    if (safe.users) safe.users.forEach(u => { delete u._localPassword; });
    safe._v = this.STATE_VERSION;
    const payload = JSON.stringify(safe);
    try {
      localStorage.setItem(this.KEY, payload);
    } catch(e) {
      if (e.name !== 'QuotaExceededError') return;
      this.toast('Storage full — clearing old data to free space');
      // Remove non-critical cached keys to reclaim space.
      const evictKeys = ['pamarket_rv', 'pamarket_search_cache', 'pamarket_img_cache'];
      evictKeys.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
      // Also evict any unknown keys that are not our primary state key.
      try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(k => {
          if (k !== this.KEY && k.startsWith('pamarket_')) {
            try { localStorage.removeItem(k); } catch(_) {}
          }
        });
      } catch(_) {}
      // Retry once after freeing space.
      try {
        localStorage.setItem(this.KEY, payload);
      } catch(e2) {
        this.toast('Could not save — please clear some browser storage');
      }
    }
  },

  uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
    });
  },
  currentUser() {
    const H = window.H || this;
    const id = H.state && H.state.currentUserId;
    if (!id) return null;
    H.state.users = H.state.users || [];
    let user = H.state.users.find(u=>u.id===id);
    if (!user) {
      user = { id, email:'', name:'User', phone:'', avatar:null, verified:false, language:'English', joinedAt:Date.now(), role:'user', status:'active', blocked:[] };
      H.state.users.push(user);
      if (typeof H.saveState === 'function') H.saveState();
      if (typeof H.loadProfile === 'function' && !H._loadingCurrentProfile) {
        H._loadingCurrentProfile = true;
        H.loadProfile(id).finally(()=>{ H._loadingCurrentProfile = false; });
      }
    }
    return user;
  },
  isAdmin() { const u=this.currentUser(); return !!(u&&u.role==='admin'); },
  escHtml(s) {
    return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },
  initials(n) { return (n||'?').split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(); },
  categoryIcon(cid) {
    const cat = this.CATEGORIES.find(c=>c.id===cid);
    return cat ? cat.icon : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>`;
  },
  timeAgo(t) {
    const s = Math.floor((Date.now()-t)/1000);
    if (s<60)     return 'just now';
    if (s<3600)   return Math.floor(s/60)+'m ago';
    if (s<86400)  return Math.floor(s/3600)+'h ago';
    if (s<604800) return Math.floor(s/86400)+'d ago';
    return new Date(t).toLocaleDateString();
  },
  fmtPrice(p,c) {
    if (!p && p!==0) return c==='USD'?'$0':'0 ZiG';
    const n = Number(p).toLocaleString();
    return c==='USD' ? '$'+n : n+' ZiG';
  },

  filterListings(list, q) {
    const _s   = window.H ? window.H.state : {};
    const qry  = (q!==undefined ? q : (document.getElementById('searchIn')?.value||'')).toLowerCase().trim();
    const pMin = parseFloat(_s._priceMin)||0;
    const pMax = parseFloat(_s._priceMax)||Infinity;
    const sort = _s._sortMode||'newest';
    return list.filter(l => {
      if (_s.cityFilter && _s.cityFilter!=='All Zimbabwe') {
        if (!(l.city+' '+l.prov).toLowerCase().includes(_s.cityFilter.toLowerCase())) return false;
      }
      if (qry && !(l.title+' '+(l.desc||'')+' '+l.city+' '+(l.suburb||'')).toLowerCase().includes(qry)) return false;
      if ((l.price||0)<pMin || (l.price||0)>pMax) return false;
      return true;
    }).sort((a,b) => {
      const ba = (a.boost&&a.boost.until>Date.now())?1:0;
      const bb = (b.boost&&b.boost.until>Date.now())?1:0;
      if (ba!==bb) return bb-ba;
      if (sort==='newest')     return b.createdAt-a.createdAt;
      if (sort==='oldest')     return a.createdAt-b.createdAt;
      if (sort==='price_asc')  return (a.price||0)-(b.price||0);
      if (sort==='price_desc') return (b.price||0)-(a.price||0);
      if (sort==='views')      return (b.views||0)-(a.views||0);
      return b.createdAt-a.createdAt;
    });
  },

  toast(msg, duration=4000, isError=false) {
    const el = document.getElementById('toastEl'); if(!el) return;
    el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    el.textContent=msg; el.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(()=>el.classList.remove('show'), duration);
  },

  shareListing(id) {
    const l = (this.state.listings||[]).find(x=>x.id===id); if(!l) return;
    const url = window.location.origin + window.location.pathname + '?listing=' + id;
    const title = l.title || 'PaMarket Listing';
    const text  = (l.title||'') + (l.price ? ' — $' + l.price : '') + ' on PaMarket Zimbabwe';
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(()=>{});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(()=>this.toast('Link copied!')).catch(()=>this.toast('Copy the URL from your address bar'));
    } else {
      this.toast('Share: ' + url, 6000);
    }
  },

  modal({ title, body, confirmText='OK', cancelText='Cancel', danger=false, onConfirm }) {
    const bg  = document.getElementById('modalBg');
    const box = document.getElementById('modalBox');
    box.classList.remove('login-modal');
    box.innerHTML = `
      <div class="modal-header">
        <h3>${this.escHtml(title)}</h3>
      </div>
      <div class="modal-body-scroll">
        <div style="font-size:14px;color:var(--sub);line-height:1.6;padding-top:8px">${body||''}</div>
      </div>
      <div class="modal-footer">
        <div class="modal-btns">
          ${cancelText?`<button class="modal-btn cancel" onclick="H.closeModal()">${cancelText}</button>`:''}
          <button class="modal-btn ${danger?'danger':'confirm'}" id="mConfirm">${confirmText}</button>
        </div>
      </div>`;
    bg.classList.add('open');
    document.getElementById('mConfirm').onclick = () => {
      if (onConfirm && onConfirm()===false) return;
      H.closeModal();
    };
    setTimeout(()=>document.getElementById('mConfirm')?.focus({preventScroll:true}), 50);
  },
  closeModal() { document.getElementById('modalBg').classList.remove('open'); },
  closeLoginModal() {
    const bg = document.getElementById('modalBg');
    if (!bg) return;
    bg.classList.remove('open');
    const box = document.getElementById('modalBox');
    if (box) box.classList.remove('login-modal');
  },
  closeSheet() {
    document.getElementById('actionSheet').classList.remove('open');
    document.getElementById('sheetBg').classList.remove('open');
  },

  innerTopbar(title, hasAction=false, isHtml=false) {
    return `<div class="inner-topbar">
      <button class="back" onclick="H.goBack()" aria-label="Go back">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="inner-topbar-title">${isHtml?title:this.escHtml(title)}</div>
      <div style="width:34px"></div>
    </div>`;
  },

  emptyState(title, sub, btn, onclick) {
    return `<div class="empty-state">
      <div class="empty-icon">${this.ICONS.search}</div>
      <div class="empty-title">${this.escHtml(title)}</div>
      <div class="empty-sub">${this.escHtml(sub)}</div>
      ${btn?`<button class="btn-pri" style="max-width:240px" onclick="${onclick}">${btn}</button>`:''}
    </div>`;
  },

  errorState(title, sub, retryFn) {
    const fn = retryFn ? `onclick="${retryFn}"` : '';
    return `<div class="error-state">
      <div class="error-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div class="error-title">${this.escHtml(title)}</div>
      <div class="error-sub">${this.escHtml(sub)}</div>
      ${retryFn ? `<button class="error-retry" ${fn}>Try Again</button>` : ''}
    </div>`;
  },

  skeletonCards(n) {
    const card = `<div class="skel-card">
      <div class="skel skel-thumb"></div>
      <div class="skel-body">
        <div class="skel skel-line w80"></div>
        <div class="skel skel-line w50"></div>
        <div class="skel skel-line w35"></div>
      </div>
    </div>`;
    return Array(n || 5).fill(card).join('');
  },

  renderListCard(l) {
    const H      = window.H;
    const seller = (H.state.users||[]).find(u=>u.id===l.sellerId);
    const photo  = (l.photos&&l.photos[0])
      ? `<img src="${l.photos[0]}" alt="${H.escHtml(l.title)}" loading="lazy">`
      : `<div class="ph">${H.categoryIcon(l.cat)}</div>`;
    const boosted = l.boost&&l.boost.until>Date.now();
    return `<div class="list-card-wrap" onclick="H.openListing('${l.id}')">
      <button class="share-card-btn" onclick="event.stopPropagation();H.shareListing&&H.shareListing('${l.id}')" title="Share">${H.ICONS.share}</button>
      <div class="list-card">
        <div class="list-thumb">${photo}</div>
        <div class="list-body">
          <div class="list-title">${H.escHtml(l.title)}</div>
          <div class="list-price">${H.escHtml(H.fmtPrice(l.price,l.currency))}</div>
          <div class="list-tags">
            <span class="tag">${H.ICONS.location} ${H.escHtml(l.city||l.prov||'')}</span>
            <span class="tag">&middot; ${H.timeAgo(l.createdAt)}</span>
            <span class="tag">&middot; ${H.ICONS.eye} ${l.views||0}</span>
            ${seller&&seller.verified?`<span class="blue-check" title="ID Verified"><svg viewBox="0 0 24 24" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg></span>`:''}
            ${boosted?`<span class="boost-pill">${H.ICONS.boost} Boosted</span>`:''}
          </div>
        </div>
      </div>
    </div>`;
  },

  renderFeatCard(l) {
    const H     = window.H;
    const photo = (l.photos&&l.photos[0])
      ? `<img src="${l.photos[0]}" alt="${H.escHtml(l.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="font-size:36px;display:flex;align-items:center;justify-content:center;height:100%">${H.categoryIcon(l.cat)}</div>`;
    return `<div class="feat-card" onclick="H.openListing('${l.id}')">
      <div class="feat-img">${photo}<div class="feat-badge">Featured</div></div>
      <div class="feat-body">
        <div class="feat-price">${H.escHtml(H.fmtPrice(l.price,l.currency))}</div>
        <div class="feat-title">${H.escHtml(l.title)}</div>
        <div class="feat-location">${H.ICONS.location} ${H.escHtml(l.city||l.prov||'')}</div>
      </div>
    </div>`;
  },

  stopCam() {
    if (this.camStream)     { this.camStream.getTracks().forEach(t=>t.stop()); this.camStream=null; }
    if (this.livenessTimer) { clearInterval(this.livenessTimer); this.livenessTimer=null; }
  },

  compressImage(file, maxDim=1200, q=0.8) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = ev => {
        const img = new Image();
        img.onload = () => {
          let w=img.width, h=img.height;
          if (w>h&&w>maxDim){h=Math.round(h*maxDim/w);w=maxDim;}
          else if(h>maxDim){w=Math.round(w*maxDim/h);h=maxDim;}
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          res(c.toDataURL('image/jpeg',q));
        };
        img.src=ev.target.result;
      };
      r.readAsDataURL(file);
    });
  },

  checkBan() {
    const u=this.currentUser();
    if(!u||u.role==='admin'){document.getElementById('banScreen').classList.remove('show');return false;}
    if(u.status==='banned_temp'&&u.banUntil&&Date.now()>u.banUntil){
      u.status='active';u.banReason=null;u.banUntil=null;this.saveState();
    }
    if(u.status==='banned_perm'||u.status==='banned_temp'){this._showBanScreen(u);return true;}
    document.getElementById('banScreen').classList.remove('show');
    return false;
  },

  _showBanScreen(u) {
    const isTemp = u.status==='banned_temp';
    let countdown='';
    if(isTemp&&u.banUntil){
      const ms=u.banUntil-Date.now();
      const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);
      countdown=`Lifted in ${d>0?d+'d ':''}${h>0?h+'h ':''}${m}m`;
    }
    document.getElementById('banScreen').innerHTML=`
      <div class="ic">${isTemp?'<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>':'<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'}</div>
      <h1>${isTemp?'Account Suspended':'Account Banned'}</h1>
      <p>${isTemp?'Your account has been temporarily suspended.':'Your account has been permanently banned.'} Contact support if you believe this is in error.</p>
      <div class="reason"><strong>Reason:</strong> ${this.escHtml(u.banReason||'Policy violation')}</div>
      ${countdown?`<div class="countdown">${countdown}</div>`:''}
      <button class="appeal" onclick="H.appealBan()">Submit Appeal</button>
      <button class="appeal" style="margin-top:8px;opacity:.7" onclick="H.logout()">Sign Out</button>`;
    document.getElementById('banScreen').classList.add('show');
    if(isTemp){clearTimeout(window._banTick);window._banTick=setTimeout(()=>this.checkBan(),60000);}
  },

  appealBan() {
    this.modal({
      title:'Submit Appeal',
      body:`<div class="fl">Your reason</div><textarea class="fi" id="appealText" rows="4" placeholder="Explain why this ban should be reviewed"></textarea>`,
      confirmText:'Submit',
      onConfirm:()=>{
        const txt=document.getElementById('appealText')?.value.trim();
        if(!txt){this.toast('Please describe your appeal');return false;}
        this.state.reports.push({id:this.uid(),reporterId:this.state.currentUserId,targetType:'appeal',targetId:this.state.currentUserId,reason:txt,t:Date.now(),status:'open'});
        this.saveState();this.toast('Appeal submitted. We will review within 24h.');
      }
    });
  },

  isAdminPage(name) { return ['Admin'].includes(name); },
  canAccessPage(name) {
    const H=window.H||this;
    if(H.isAdminPage(name)&&(!H.isAdmin()||!H.state.adminSession)) return false;
    return true;
  },
  adminLog(action,meta={}) {
    const u=this.currentUser(); if(!u) return;
    this.state.adminLogs.unshift({id:this.uid(),t:Date.now(),adminId:u.id,adminName:u.name||'Admin',action,meta});
    this.state.adminLogs=this.state.adminLogs.slice(0,300);
    this.saveState();
  },

  authLogoTap() { window.location.href='admin.html'; },

  async boot() {
    H.openInner  = H.openInner.bind(H);
    H.goBack     = H.goBack.bind(H);
    H.renderPage = H.renderPage.bind(H);
    H.navTo      = H.navTo.bind(H);
    this.applyTheme();
    this.applyLanguage();
    if(this.state.currentUserId&&this.checkBan()) return;
    const _nav = document.getElementById('bottomNav');
    _nav.style.display='flex';
    // Probe safe area bottom: use padding-bottom trick (more reliable than height), then iPhone X+ fallback
    (function() {
      var p = document.createElement('div');
      p.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:content-box;visibility:hidden;pointer-events:none';
      document.documentElement.appendChild(p);
      var sab = p.clientHeight; // synchronous — clientHeight = 0 + padding-bottom
      document.documentElement.removeChild(p);
      // Fallback: iOS iPhone X+ (screen.height in CSS px >= 780) when env() returns 0
      if (sab === 0 && /iPhone/.test(navigator.userAgent) && window.screen.height >= 780) sab = 34;
      if (sab > 0) {
        _nav.style.height = (64 + sab) + 'px';
        _nav.style.paddingBottom = sab + 'px';
        document.documentElement.style.setProperty('--sab', sab + 'px');
      }
    })();
    await this.navTo('Home');
    // Handle deep links: ?listing=ID  or  ?action=post|browse
    const _qs = new URLSearchParams(window.location.search);
    const _lid = _qs.get('listing'), _act = _qs.get('action');
    if (_lid) { setTimeout(()=>this.openListing(_lid), 200); }
    else if (_act === 'post')   { if(this.currentUser()) setTimeout(()=>this.navTo('Post',null), 200); }
    else if (_act === 'browse') { setTimeout(()=>this.navTo('Browse',null), 200); }
    else if (_act === 'topup')  { setTimeout(()=>{ if(this.currentUser()) this.openInner('Ads'); else this.requireAuth('Sign in to advertise'); }, 300); }
    try {
      await this.fetchListingsFromSupabase();
      H._checkEngagementAlerts();
      await Promise.all([this.fetchAdsFromSupabase(), this.fetchAppSettings()]);
      await this.renderPage(this.currentPageName, this.currentPageParams);
    } catch(e) { console.warn('Boot fetch failed:', e); }
    if(typeof H._setupRealtimeMessages==='function') H._setupRealtimeMessages();
    if(typeof H.syncReports==='function') H.syncReports();
    if(typeof H.syncConversations==='function') H.syncConversations();
    if(typeof H.syncApplications==='function') H.syncApplications();
    if(typeof H.syncNotifications==='function') H.syncNotifications();
    if(typeof H._setupRealtimeNotifs==='function') H._setupRealtimeNotifs();
    if(typeof H.startRealtime==='function') H.startRealtime();
    this._initPullToRefresh();
    if(typeof window._hideSplash==='function') window._hideSplash();
  },

  authPage() {
    this.requireAuth('Login to continue');
  },

  authPageFull() {
    document.getElementById('bottomNav').style.display='none';
    document.getElementById('mainArea').innerHTML=`
      <div class="auth-wrap">
        <div class="auth-logo">
          <img src="img/icon-192.png" alt="PaMarket" style="width:90px;height:90px;border-radius:22px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,.3)">
          <div>Pa<em>Market</em></div>
        </div>
        <div class="auth-tag">Zimbabwe&#39;s Free Marketplace</div>
        <div class="auth-card" id="authCard"></div>
        <div class="auth-foot">
          By continuing you accept our
          <a href="#" onclick="event.preventDefault();H.authShowDoc('terms')">Terms</a> &amp;
          <a href="#" onclick="event.preventDefault();H.authShowDoc('privacy')">Privacy Policy</a>
        </div>
      </div>`;
    if(typeof H.authStepEmail==='function') H.authStepEmail();
  },

  async navTo(name, btn) {
    const H=window.H;
    if(['Post'].includes(name)&&!H.currentUser()){H.requireAuth('Log in to post an ad');return;}
    if(['Messages'].includes(name)&&!H.currentUser()){H.requireAuth('Sign in to view messages');return;}
    if(H.isAdminPage(name)&&(!H.isAdmin()||!H.state.adminSession)){H.toast('Admin login required');return;}
    try {
      H.pageStack=[];
      document.getElementById('bottomNav').style.display='flex';
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      const target=btn||document.querySelector('[data-nav="'+name+'"]');
      if(target)target.classList.add('active');
      await H.renderPage(name);
    } catch(e) {
      console.warn('navTo error:', e);
      H.toast('Page not found');
      const area=document.getElementById('mainArea');
      if(area) area.innerHTML='<div class="page active" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#1A3A8F" stroke-width="1.5" style="opacity:.4;margin-bottom:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px">Page not found</div><div style="font-size:14px;color:var(--sub);margin-bottom:24px">This page doesn\'t exist or couldn\'t load.</div><button onclick="H.navTo(\'Home\')" style="background:#1A3A8F;color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Go Home</button></div>';
    }
  },

  async openInner(name, params) {
    const H=window.H;
    const gated=['Messages','Chat','MyListings','Favorites','Profile','EditProfile','Settings','Ads','AdsCreate','AdsBoost','AdsContact','MyAds','Boost','Security','SecuritySettings','DeleteAccount','JobSeekerProfile','CandidateProfile','AppliedJobs','JobApplications','PostJob'];
    if(gated.includes(name)&&!H.currentUser()){H.requireAuth('Sign in to continue');return;}
    if(H.isAdminPage(name)&&(!H.isAdmin()||!H.state.adminSession)){H.toast('Admin login required');return;}
    try {
      const area=document.getElementById('mainArea');
      this.pageStack.push({name:this.currentPageName,params:this.currentPageParams,scrollY:area?area.scrollTop:0});
      document.getElementById('bottomNav').style.display='none';
      await this.renderPage(name,params);
    } catch(e) {
      console.warn('openInner error:',e);
      document.getElementById('bottomNav').style.display='flex';
      H.toast('Page not found');
      const area=document.getElementById('mainArea');
      if(area) area.innerHTML='<div class="page active" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#1A3A8F" stroke-width="1.5" style="opacity:.4;margin-bottom:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px">Page not found</div><div style="font-size:14px;color:var(--sub);margin-bottom:24px">This page doesn\'t exist or couldn\'t load.</div><button onclick="H.navTo(\'Home\')" style="background:#1A3A8F;color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Go Home</button></div>';
    }
  },

  async goBack() {
    if(H.state._backToAccount){
      H.state._backToAccount=false;
      this.pageStack.pop();
      document.getElementById('bottomNav').style.display='flex';
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      const acctBtn=document.querySelector('[data-nav="Account"]'); if(acctBtn) acctBtn.classList.add('active');
      await this.renderPage('Account');
      H.showAccountMenu();
      return;
    }
    this.stopCam();
    if(this.pageStack.length){
      const p=this.pageStack.pop();
      const isRoot=['Home','Browse','Messages','Post','Account'].includes(p.name);
      if(isRoot){
        document.getElementById('bottomNav').style.display='flex';
        document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
        const m=document.querySelector(`[data-nav="${p.name}"]`); if(m) m.classList.add('active');
      }
      await this.renderPage(p.name,p.params,{scrollTo:p.scrollY||0});
    } else {
      document.getElementById('bottomNav').style.display='flex';
      await this.navTo('Home');
    }
  },

  async renderPage(name, params, opts) {
    const area=document.getElementById('mainArea');
    // Always restore mainArea scroll when navigating — Chat locks it to prevent topbar from scrolling off
    if(area) area.style.overflowY='auto';
    const scrollTo=(opts&&opts.scrollTo)||0;
    if(this.canAccessPage&&!this.canAccessPage(name)){this.toast('Access denied');await this.navTo('Home');return;}
    this.currentPageName=name; this.currentPageParams=params||{};
    if(!this.pages[name]) {
      H.toast('Page not found');
      if(area) area.innerHTML='<div class="page active" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#1A3A8F" stroke-width="1.5" style="opacity:.4;margin-bottom:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px">Page not found</div><div style="font-size:14px;color:var(--sub);margin-bottom:24px">This page doesn\'t exist or couldn\'t load.</div><button onclick="H.navTo(\'Home\')" style="background:#1A3A8F;color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Go Home</button></div>';
      return;
    }
    const fn=this.pages[name];
    if(!area) return;
    const res=fn(params||{});
    if(res instanceof Promise) {
      area.style.opacity='0';
      const html=await res;
      if(this.currentPageName!==name) return;
      area.innerHTML=html;
      area.scrollTop=scrollTo;
      requestAnimationFrame(()=>{ area.style.opacity='1'; });
    } else {
      area.innerHTML=res;
      area.scrollTop=scrollTo;
      if(area.style.opacity!=='1') area.style.opacity='1';
    }
    if(this.pages[name+'_after']) this.pages[name+'_after'](params||{});
    this._initPullToRefresh();
  },

  openListing(id) {
    const l=this.state.listings.find(x=>x.id===id); if(!l) return;
    l.views=(l.views||0)+1;
    const rv=JSON.parse(localStorage.getItem('pamarket_rv')||'[]');
    const filtered=[...new Set([id,...rv.filter(x=>x!==id)])].slice(0,10);
    localStorage.setItem('pamarket_rv',JSON.stringify(filtered));
    this.saveState();
    this.openInner('Detail',{id});
  },

  filterByCat(cid) {
    const map = {
      vehicles:    'Vehicles',
      property:    'Property',
      electronics: 'Electronics',
      fashion:     'Fashion',
      furniture:   'Furniture',
      services:    'Services',
      jobs:        'Jobs',
      rooms:       'Rooms'
    };
    const page = map[cid];
    if (page) { this.openInner(page, {cid}); }
    else { this.openInner('CategoryView', {cid}); }
  },

  toggleSort() {
    const sheet=document.getElementById('actionSheet');
    const bg=document.getElementById('sheetBg');
    const cur=H.state._sortMode||'newest';
    const opts=[
      {id:'newest',    label:'Newest First'},
      {id:'oldest',    label:'Oldest First'},
      {id:'price_asc', label:'Price: Low to High'},
      {id:'price_desc',label:'Price: High to Low'},
      {id:'views',     label:'Most Viewed'}
    ];
    let html='<div class="sheet-header">Sort By</div>';
    opts.forEach(o=>{
      const active=o.id===cur;
      html+=`<button class="sheet-item" style="${active?'color:#1A3A8F;font-weight:700':''}" onclick="H.setSort('${o.id}')">${active?'✓ ':''}${o.label}</button>`;
    });
    html+='<button class="sheet-close" onclick="H.closeSheet()">Cancel</button>';
    sheet.innerHTML=html; sheet.classList.add('open'); bg.classList.add('open');
  },
  setSort(mode){H.state._sortMode=mode;H.closeSheet();H.currentPageName==='Browse'?H.renderPage('Browse',H.currentPageParams):H.navTo('Home');},

  showPriceFilter() {
    const sheet=document.getElementById('actionSheet');
    const bg=document.getElementById('sheetBg');
    sheet.innerHTML='<div class="sheet-header">Filter by Price</div>'
      +'<div style="padding:0 16px 16px">'
      +'<label style="font-size:12px;color:var(--sub);display:block;margin-bottom:4px">Min Price (USD)</label>'
      +'<input id="priceMinIn" type="number" value="'+(H.state._priceMin||'')+'" placeholder="0" class="fi" style="margin-bottom:12px">'
      +'<label style="font-size:12px;color:var(--sub);display:block;margin-bottom:4px">Max Price (USD)</label>'
      +'<input id="priceMaxIn" type="number" value="'+(H.state._priceMax||'')+'" placeholder="Any" class="fi" style="margin-bottom:16px">'
      +'<button onclick="H.applyPriceFilter()" style="width:100%;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Apply</button>'
      +'<button onclick="H.clearPriceFilter()" style="width:100%;padding:13px;background:transparent;color:var(--sub);border:none;font-size:14px;cursor:pointer;margin-top:4px">Clear</button>'
      +'</div><button class="sheet-close" onclick="H.closeSheet()">Cancel</button>';
    sheet.classList.add('open'); bg.classList.add('open');
  },
  applyPriceFilter(){H.state._priceMin=document.getElementById('priceMinIn').value;H.state._priceMax=document.getElementById('priceMaxIn').value;H.closeSheet();H.currentPageName==='Browse'?H.renderPage('Browse',H.currentPageParams):H.navTo('Home');},
  clearPriceFilter(){H.state._priceMin='';H.state._priceMax='';H.closeSheet();H.currentPageName==='Browse'?H.renderPage('Browse',H.currentPageParams):H.navTo('Home');},

  setLocFilter(loc,btn){
    this.state.cityFilter=loc; this.saveState();
    document.querySelectorAll('.loc-filter-btn').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this.navTo('Home');
  },

  applyTheme() {
    const u=this.currentUser();
    const theme=(u&&u.settings&&u.settings.theme)||'light';
    document.documentElement.setAttribute('data-theme', theme);
  },
  applyLanguage() {
    const u=this.currentUser();
    const lang=(u&&u.language)||this.state.language||'English';
    document.querySelectorAll('.current-lang').forEach(el=>el.textContent=lang);
  },
  getLanguage() {
    const u=this.currentUser();
    return (u&&u.language)||this.state.language||'English';
  },
  setLanguage(lang) {
    const clean=lang||'English';
    const u=this.currentUser();
    if(u) u.language=clean;
    this.state.language=clean;
    this.saveState();
    this.applyLanguage();
    this.toast('Language saved');
    this.renderPage(this.currentPageName, this.currentPageParams);
  },

  _initPullToRefresh() {
    const el = document.getElementById('mainArea');
    if (!el) return;
    if (el._ptrCleanup) el._ptrCleanup();

    // Stop the native browser PTR from firing inside the WebView
    el.style.overscrollBehaviorY = 'contain';

    const THRESHOLD = 80;   // raw finger travel (px) that fires a refresh
    const MAX_VIS   = 110;  // max content travel — generous, like the browser
    const IND_SIZE  = 48;   // spinner disc diameter (px)

    // ── Clean up any old indicator from a previous init ────────────
    document.getElementById('ptr-ind')?.remove();
    document.getElementById('ptr-css')?.remove();

    // iOS-style starburst spinner: 12 spokes stepping like the native OS indicator
    const ind = document.createElement('div');
    ind.id = 'ptr-ind';
    ind.innerHTML =
      '<svg id="ptr-star" viewBox="0 0 30 30" width="30" height="30"'
      + ' stroke="#5a7fd4" stroke-width="2.2" style="display:block">'
      + '<line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.08" transform="rotate(0 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.17" transform="rotate(30 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.25" transform="rotate(60 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.33" transform="rotate(90 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.42" transform="rotate(120 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.5" transform="rotate(150 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.58" transform="rotate(180 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.67" transform="rotate(210 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.75" transform="rotate(240 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.83" transform="rotate(270 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="0.92" transform="rotate(300 15 15)"/><line x1="15" y1="4" x2="15" y2="8.5" stroke-linecap="round" opacity="1.0" transform="rotate(330 15 15)"/>'
      + '</svg>';
    ind.style.cssText =
      'position:fixed;top:env(safe-area-inset-top,0px);left:50%;' +
      'width:' + IND_SIZE + 'px;height:' + IND_SIZE + 'px;' +
      'transform:translateX(-50%) translateY(-' + IND_SIZE + 'px);' +
      'background:var(--card,#1a2540);border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;' +
      'z-index:9999;pointer-events:none;opacity:0;' +
      'box-shadow:0 3px 14px rgba(0,0,0,.4);';
    document.body.appendChild(ind);

    const styleEl = document.createElement('style');
    styleEl.id = 'ptr-css';
    // steps(12,end) gives the native iOS tick: each frame jumps exactly 30 degrees
    styleEl.textContent =
      '@keyframes ptr-spin{to{transform:rotate(360deg)}}' +
      '#ptr-star{animation:ptr-spin .9s steps(12,end) infinite;transform-origin:15px 15px;}';
    document.head.appendChild(styleEl);


    // ── Damping: near 1:1 for first 80 px (feels like the browser) ──
    function damp(dist) {
      if (dist <= 80) return dist * 0.9;        // 90% — almost 1:1
      return 72 + (dist - 80) * 0.28;           // soft cap toward MAX_VIS
    }

    // ── Content movement ───────────────────────────────────────────
    function moveContent(px) {
      const page = el.firstElementChild;
      if (!page) return;
      page.style.transition = 'none';
      page.style.transform  = 'translateY(' + px + 'px)';
      page.style.willChange = 'transform';
    }

    function snapBack() {
      const page = el.firstElementChild;
      if (!page) return;
      page.style.transition = 'transform .32s cubic-bezier(.4,0,.2,1)';
      page.style.transform  = 'translateY(0px)';
      setTimeout(function() {
        if (page) { page.style.transition = ''; page.style.transform = ''; page.style.willChange = ''; }
      }, 340);
    }

    // ── Indicator movement ─────────────────────────────────────────
    // Indicator slides down into the gap created by the content moving away.
    // It is centred in the gap: indY = visual/2 - IND_SIZE/2
    // Starts hidden (y < 0), becomes fully visible around visual = IND_SIZE.
    function moveIndicator(visual) {
      var y = (visual / 2) - (IND_SIZE / 2);
      ind.style.transition = 'none';
      ind.style.transform  = 'translateX(-50%) translateY(' + y + 'px)';
      ind.style.opacity    = Math.min(Math.max((visual - 20) / 24, 0), 1).toFixed(2);
    }

    // During refresh the content snaps back so the gap closes.
    // The indicator then floats at the very top edge of the content, overlaying it.
    function showRefreshing() {
      snapBack();
      ind.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1),opacity .2s';
      ind.style.transform  = 'translateX(-50%) translateY(6px)'; // hovers just inside content top
      ind.style.opacity    = '1';
    }

    function hideIndicator() {
      ind.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1),opacity .25s';
      ind.style.transform  = 'translateX(-50%) translateY(-' + IND_SIZE + 'px)';
      ind.style.opacity    = '0';
    }

    // ── Refresh ────────────────────────────────────────────────────
    var refreshing = false;

    async function doRefresh() {
      if (refreshing) return;
      refreshing = true;
      if (navigator.vibrate) navigator.vibrate(12);
      showRefreshing();
      try {
        var pageName = H.currentPageName;
        if (typeof H.fetchListingsFromSupabase === 'function') await H.fetchListingsFromSupabase();
        if (H.currentUser()) {
          if (typeof H.syncConversations === 'function') await H.syncConversations();
          if (typeof H.syncNotifications === 'function') await H.syncNotifications();
          if (typeof H.syncApplications  === 'function') H.syncApplications();
        }
        await H.renderPage(pageName, H.currentPageParams);
      } catch(e) { console.warn('PTR:', e); }
      setTimeout(function() { hideIndicator(); refreshing = false; }, 500);
    }

    // ── Touch handlers ─────────────────────────────────────────────
    var startY = 0, curY = 0, pulling = false;

    function onStart(e) {
      if (refreshing || el.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      curY   = startY;
      pulling = true;
    }

    function onMove(e) {
      if (!pulling) return;
      curY = e.touches[0].clientY;
      var dist = curY - startY;
      if (dist <= 0) { if (dist < -10) { pulling = false; snapBack(); hideIndicator(); } return; }
      e.preventDefault(); // block native overscroll while we handle the pull
      var visual = Math.min(damp(dist), MAX_VIS);
      moveContent(visual);
      moveIndicator(visual);
      // One-shot haptic exactly when the threshold is crossed
      if (dist >= THRESHOLD && dist < THRESHOLD + 5 && navigator.vibrate) navigator.vibrate(10);
    }

    function onEnd() {
      if (!pulling) return;
      pulling = false;
      var dist = curY - startY;
      if (dist >= THRESHOLD) { doRefresh(); }
      else { snapBack(); hideIndicator(); }
    }

    function onCancel() { pulling = false; snapBack(); hideIndicator(); }

    el.addEventListener('touchstart',  onStart,  { passive: true  });
    el.addEventListener('touchmove',   onMove,   { passive: false });
    el.addEventListener('touchend',    onEnd,    { passive: true  });
    el.addEventListener('touchcancel', onCancel, { passive: true  });

    el._ptrCleanup = function() {
      el.removeEventListener('touchstart',  onStart);
      el.removeEventListener('touchmove',   onMove);
      el.removeEventListener('touchend',    onEnd);
      el.removeEventListener('touchcancel', onCancel);
      el.style.overscrollBehaviorY = '';
    };
  },

  async saveListingToCloud(listing) {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      const {error}=await window.supabase.from('listings').upsert({
        id:listing.id, seller_id:listing.sellerId,
        seller_name:listing.sellerName||'', seller_phone:listing.sellerPhone||'',
        title:listing.title, description:listing.desc||'',
        price:listing.price||0, currency:listing.currency||'USD',
        category:listing.cat||'other', province:listing.prov||'',
        city:listing.city||'', suburb:listing.suburb||'',
        photos:listing.photos||[], status:listing.status||'active',
        boost:listing.boost||null, views:listing.views||0,
        created_at:listing.createdAt?new Date(listing.createdAt).toISOString():new Date().toISOString()
      });
      if(error) console.warn('Cloud save failed:',error.message);
    } catch(e){ console.warn('saveListingToCloud:',e.message); }
  },

  async deleteListingFromCloud(id) {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      await window.supabase.from('listings').delete().eq('id',id);
    } catch(e){ console.warn('deleteListingFromCloud:',e.message); }
  },

  async fetchAdsFromSupabase() {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      const {data,error} = await window.supabase
        .from('paid_ads')
        .select('id,type,business_name,headline,tagline,image_url,bg_color,link_url,target_cat,starts_at,ends_at,active,priority,impressions,clicks,listing_id')
        .eq('active',true)
        .order('priority',{ascending:false});
      if(error||!data) return;
      H.state.paidAds = data.map(r=>({
        id:r.id, type:r.type,
        businessName:r.business_name, headline:r.headline,
        tagline:r.tagline, imageUrl:r.image_url,
        bgColor:r.bg_color, linkUrl:r.link_url, targetCat:r.target_cat,
        startsAt:r.starts_at?new Date(r.starts_at).getTime():0,
        endsAt:r.ends_at?new Date(r.ends_at).getTime():9999999999999,
        active:r.active, priority:r.priority||0,
        impressions:r.impressions||0, clicks:r.clicks||0,
        listingId:r.listing_id||null
      }));
    } catch(e){ console.warn('fetchAdsFromSupabase:',e.message); }
  },

  async fetchAppSettings() {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      const {data,error} = await window.supabase
        .from('app_settings').select('settings').eq('id',1).single();
      if(error||!data) return;
      const s = data.settings||{};
      Object.assign(H.state, s);
      H.saveState();
    } catch(e){ console.warn('fetchAppSettings:',e.message); }
  },

  trackAdImpression(id) {
    if(!id||!window.supabase||typeof window.supabase.from!=='function') return;
    const a = (H.state.paidAds||[]).find(x=>x.id===id); if(!a) return;
    a.impressions = (a.impressions||0)+1;
    window.supabase.from('paid_ads').update({impressions:a.impressions}).eq('id',id).then(()=>{});
  },

  trackAdClick(id, url) {
    if(id&&window.supabase&&typeof window.supabase.from==='function'){
      const a = (H.state.paidAds||[]).find(x=>x.id===id);
      if(a){ a.clicks=(a.clicks||0)+1; window.supabase.from('paid_ads').update({clicks:a.clicks}).eq('id',id).then(()=>{}); }
    }
    const a = (H.state.paidAds||[]).find(x=>x.id===id);
    // Listing link takes priority over external URL
    if(a && a.listingId) { H.openListing(a.listingId); return; }
    if(url) { window.open(url,'_blank','noopener'); return; }
    if(a) H.toast((a.businessName||'Sponsored') + (a.tagline ? ' · ' + a.tagline : ''), 3000);
  },

  async fetchListingsFromSupabase() {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      const {data,error}=await window.supabase
        .from('listings').select('*')
        .eq('status','active')
        .order('created_at',{ascending:false})
        .limit(200);
      if(error) { if(!navigator.onLine) H.toast('No internet — showing saved listings', 4000, true); return; }
      const cloud=(data||[]).map(r=>({
        id:r.id, sellerId:r.seller_id, sellerName:r.seller_name||'',
        sellerPhone:r.seller_phone||'', title:r.title, desc:r.description,
        price:r.price, currency:r.currency, cat:r.category,
        prov:r.province, city:r.city, suburb:r.suburb,
        photos:Array.isArray(r.photos)?r.photos:(r.photos?[r.photos]:[]),
        status:r.status, boost:r.boost, views:r.views||0,
        createdAt:r.created_at?new Date(r.created_at).getTime():Date.now()
      }));
      // Replace active listings entirely from cloud so deleted ones disappear.
      // Keep local non-active listings (pending, draft) that haven't synced yet.
      const nonActive=(H.state.listings||[]).filter(l=>l.status!=='active');
      H.state.listings=[...cloud,...nonActive];
      H.saveState();
    } catch(e){ console.warn('fetchListingsFromSupabase:',e.message); }
  },

  _setupRealtimeMessages() {
    try {
      if(!window.supabase||typeof window.supabase.channel!=='function') return;
      if(window._msgChannel) window._msgChannel.unsubscribe();
      window._msgChannel=window.supabase.channel('messages-rt')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},payload=>{
          const msg=payload.new; if(!msg) return;
          if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
          const conv=H.state.conversations.find(c=>c.id===msg.conversation_id);
          if(conv){
            if (!Array.isArray(conv.messages)) conv.messages = [];
            const ex=conv.messages.find(m=>m.id===msg.id);
            if(!ex){
              const localMsg = {id:msg.id,from:msg.sender_id,senderName:msg.sender_name||'',text:msg.text,t:new Date(msg.created_at).getTime(),read:false};
              conv.messages.push(localMsg);
              H.saveState();
              if(H.currentPageName==='Chat'&&H.currentPageParams&&H.currentPageParams.id===msg.conversation_id&&typeof H._appendChatMessages==='function')
                H._appendChatMessages(msg.conversation_id,[localMsg]);
              else if(H.currentPageName==='Messages'&&typeof H._refreshMessagesPage==='function')
                H._refreshMessagesPage({ skipSync:true });
              H.pushNotif&&H.pushNotif(H.state.currentUserId,'New message',msg.text||'');
            }
          } else if (typeof H.syncConversations === 'function') {
            H.syncConversations().then(function(){
              if (H.currentPageName === 'Messages' && typeof H._refreshMessagesPage === 'function') H._refreshMessagesPage({ skipSync:true });
            });
          }
        }).subscribe();
    } catch(e){ console.warn('Realtime setup failed:',e.message); }
  },

  async syncApplications() {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return;
      const u = H.currentUser(); if (!u) return;
      const { data, error } = await sb.from('applications')
        .select('*')
        .or(`applicant_id.eq.${u.id},employer_id.eq.${u.id}`)
        .order('applied_at', { ascending: false });
      if (error || !data) return;
      const remote = data.map(r => ({
        id: r.id, jobId: r.job_id, jobTitle: r.job_title,
        company: r.company, applicantId: r.applicant_id,
        applicantName: r.applicant_name, applicantPhone: r.applicant_phone,
        applicantEmail: r.applicant_email, message: r.message,
        answers: r.answers || [],
        status: r.status, employerId: r.employer_id,
        appliedAt: r.applied_at ? new Date(r.applied_at).getTime() : Date.now()
      }));
      const ids = new Set((H.state.applications || []).map(a => a.id));
      remote.forEach(a => {
        if (!ids.has(a.id)) (H.state.applications = H.state.applications || []).push(a);
        else {
          const i = H.state.applications.findIndex(x => x.id === a.id);
          if (i !== -1) H.state.applications[i] = Object.assign(H.state.applications[i], a);
        }
      });
      H.saveState();
    } catch(e) { console.warn('syncApplications:', e.message); }
  },

  async syncReports() {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return;
      const { data, error } = await sb.from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error || !data) return;

      H.state.reports = H.state.reports || [];
      H.state.supportTickets = H.state.supportTickets || [];
      data.forEach(r => {
        const createdAt = r.created_at ? new Date(r.created_at).getTime() : Date.now();
        if (r.target_type === 'support') {
          const txt = (r.reason || '').replace(/^\[Support\]\s*/, '');
          const parts = txt.split('\n\n');
          const subject = (parts[0] || 'Support request').trim();
          const message = parts.slice(1).join('\n\n').trim() || txt;
          const ticket = {
            id: r.id, userId: r.reporter_id || null, subject, message,
            createdAt, status: r.status === 'resolved' ? 'closed' : 'open',
            reportId: r.id
          };
          const i = H.state.supportTickets.findIndex(t => t.id === ticket.id || t.reportId === ticket.reportId);
          if (i === -1) H.state.supportTickets.push(ticket);
          else H.state.supportTickets[i] = Object.assign(H.state.supportTickets[i], ticket);
        } else {
          const report = {
            id: r.id, reporterId: r.reporter_id || r.reported_by || null,
            targetType: r.target_type || 'listing', targetId: r.target_id,
            reason: r.reason || '', status: r.status || 'open',
            t: createdAt, createdAt
          };
          const i = H.state.reports.findIndex(x => x.id === report.id);
          if (i === -1) H.state.reports.push(report);
          else H.state.reports[i] = Object.assign(H.state.reports[i], report);
        }
      });
      H.saveState();
    } catch(e) { console.warn('syncReports:', e.message); }
  },

  async saveApplicationToCloud(app) {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return;
      const { error } = await sb.from('applications').upsert({
        id: app.id, job_id: app.jobId, job_title: app.jobTitle,
        company: app.company || '', applicant_id: app.applicantId,
        applicant_name: app.applicantName, applicant_phone: app.applicantPhone,
        applicant_email: app.applicantEmail, message: app.message,
        answers: app.answers || [],
        status: app.status || 'pending', employer_id: app.employerId,
        applied_at: app.appliedAt ? new Date(app.appliedAt).toISOString() : new Date().toISOString()
      });
      if (error) console.warn('saveApplicationToCloud:', error.message);
    } catch(e) { console.warn('saveApplicationToCloud:', e.message); }
  },

  async updateApplicationStatusCloud(appId, status) {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return;
      await sb.from('applications').update({ status }).eq('id', appId);
    } catch(e) { console.warn('updateApplicationStatusCloud:', e.message); }
  },

  async syncConversations() {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return false;
      const u = H.currentUser(); if (!u) return false;
      if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
      let changed = false;

      // Phase 1: discover from conversations table (may not exist — silent fail)
      const knownIds = new Set(H.state.conversations.map(c => c.id));
      try {
        const { data: convs, error } = await sb.from('conversations')
          .select('id, members, listing_id')
          .contains('members', [u.id])
          .limit(100);
        if (!error && convs) {
          for (const c of convs) {
            knownIds.add(c.id);
            let local = H.state.conversations.find(x => x.id === c.id);
            if (!local) {
              local = { id: c.id, members: c.members || [], listingId: c.listing_id || null, messages: [] };
              H.state.conversations.push(local);
              changed = true;
            } else {
              const m = Array.isArray(c.members) ? c.members : [];
              if (JSON.stringify(local.members||[]) !== JSON.stringify(m)) { local.members = m; changed = true; }
            }
          }
        }
      } catch(e) { /* conversations table may not exist */ }

      // Phase 2: discover from messages table — works without conversations table.
      // Conv IDs embed the last 6 chars of each member UUID, so LIKE finds them.
      try {
        const uidSuffix = u.id.slice(-6);
        const [sentRes, recvRes] = await Promise.all([
          sb.from('messages').select('conversation_id,sender_id,sender_name').eq('sender_id', u.id).order('created_at',{ascending:false}).limit(300),
          sb.from('messages').select('conversation_id,sender_id,sender_name').like('conversation_id',`%${uidSuffix}%`).neq('sender_id', u.id).order('created_at',{ascending:false}).limit(300)
        ]);
        for (const row of [...(sentRes.data||[]), ...(recvRes.data||[])]) {
          if (!row.conversation_id || knownIds.has(row.conversation_id)) continue;
          knownIds.add(row.conversation_id);
          const otherId = row.sender_id !== u.id ? row.sender_id : null;
          const members = otherId ? [u.id, otherId] : [u.id];
          H.state.conversations.push({ id: row.conversation_id, members, listingId: null, messages: [] });
          changed = true;
        }
      } catch(e) { /* messages table scan failed */ }

      // Phase 3: fetch profiles for all unknown or nameless conversation members (fixes "Unknown User")
      const allMemberIds = new Set();
      H.state.conversations.forEach(c => (c.members||[]).forEach(id => allMemberIds.add(id)));
      // Include IDs missing from state OR cached but with an empty name — so names are backfilled
      const profilesNeeded = Array.from(allMemberIds).filter(id => {
        if (id === u.id) return false;
        const cached = (H.state.users||[]).find(x => x.id === id);
        return !cached || !cached.name;
      });
      if (profilesNeeded.length) {
        try {
          const { data: profiles } = await sb.from('profiles')
            .select('id,name,phone,email,avatar,verified,role,status,created_at')
            .in('id', profilesNeeded);
          (profiles||[]).forEach(p => {
            const existing = (H.state.users||[]).find(x => x.id === p.id);
            if (existing) {
              // Update entry — especially fill in the name if we now have one
              if (p.name && !existing.name) { existing.name = p.name; changed = true; }
              if (p.avatar && !existing.avatar) { existing.avatar = p.avatar; changed = true; }
              if (p.verified && !existing.verified) { existing.verified = true; changed = true; }
            } else {
              (H.state.users = H.state.users||[]).push({
                id: p.id, name: p.name||'', phone: p.phone||'',
                email: p.email||'', avatar: p.avatar||null,
                verified: !!p.verified, role: p.role||'user',
                status: p.status||'active',
                joinedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now()
              });
              changed = true;
            }
          });
        } catch(e) {}
      }

      // Phase 4: sync messages for EVERY known conversation
      for (const local of H.state.conversations) {
        if (!Array.isArray(local.messages)) { local.messages = []; changed = true; }
        const { data: msgs, error: msgErr } = await sb.from('messages')
          .select('id, sender_id, sender_name, text, read, created_at')
          .eq('conversation_id', local.id)
          .order('created_at', { ascending: true })
          .limit(200);
        if (msgErr || !msgs) continue;
        const existing = new Map(local.messages.map(m => [m.id, m]));
        msgs.forEach(m => {
          const t = m.created_at ? new Date(m.created_at).getTime() : Date.now();
          const found = existing.get(m.id);
          const read = found && found.read ? true : !!m.read;
          if (!found) {
            local.messages.push({ id: m.id, from: m.sender_id, senderName: m.sender_name||'', text: m.text, t, read });
            changed = true;
          } else if (found.read !== read || found.from !== m.sender_id || found.senderName !== (m.sender_name||'')) {
            found.from = m.sender_id;
            found.senderName = m.sender_name || found.senderName || '';
            found.read = read;
            changed = true;
          }
        });
        local.messages.sort((a,b) => (a.t||0) - (b.t||0));
      }

      // Phase 4.5: backfill profile names from message sender_name where name is still empty
      // This covers cases where the profiles table is unavailable or the entry has no name
      H.state.conversations.forEach(function(conv) {
        (conv.members||[]).forEach(function(memberId) {
          if (memberId === u.id) return;
          const existingUser = (H.state.users||[]).find(function(x){ return x.id === memberId; });
          if (existingUser && existingUser.name) return; // already resolved
          // Find the first message from this member that carries a non-empty sender_name
          const nameFromMsg = ((conv.messages||[]).find(function(m){ return m.from === memberId && m.senderName; })||{}).senderName;
          if (!nameFromMsg) return;
          if (existingUser) {
            existingUser.name = nameFromMsg;
          } else {
            (H.state.users = H.state.users||[]).push({
              id: memberId, name: nameFromMsg, phone: '', email: '',
              avatar: null, verified: false, role: 'user', status: 'active',
              joinedAt: Date.now()
            });
          }
          if (!conv.otherName) { conv.otherName = nameFromMsg; }
          changed = true;
        });
      });

      if (changed) H.saveState();
      return changed;
    } catch(e) { console.warn('syncConversations:', e.message); }
    return false;
  },


  async saveMessageToCloud(convId, msg) {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return { ok:false, error:'Connection unavailable' };
      const { error } = await sb.from('messages').upsert({
        id: msg.id, conversation_id: convId,
        sender_id: msg.from, sender_name: msg.senderName || '',
        text: msg.text, read: msg.read || false,
        created_at: new Date(msg.t || Date.now()).toISOString()
      });
      if (error) { console.warn('saveMessageToCloud:', error.message); return { ok:false, error:error.message }; }
      return { ok:true };
    } catch(e) { console.warn('saveMessageToCloud:', e.message); return { ok:false, error:e.message }; }
  },

  async ensureConversationInCloud(conv) {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return { ok:false, error:'Connection unavailable' };
      const { error } = await sb.from('conversations').upsert({
        id: conv.id, members: conv.members,
        listing_id: conv.listingId || null
      });
      if (error) { console.warn('ensureConversationInCloud:', error.message); return { ok:false, error:error.message }; }
      return { ok:true };
    } catch(e) { console.warn('ensureConversationInCloud:', e.message); return { ok:false, error:e.message }; }
  },

  _registerCategoryView() {
    this.pages.CategoryView=function({cid}){
      const cat=H.CATEGORIES.find(c=>c.id===cid)||{name:'Category',icon:''};
      const list=(H.state.listings||[]).filter(l=>l.status==='active'&&l.cat===cid);
      return `<div class="page active">${H.innerTopbar(cat.name)}
        <div class="listing-list">
          ${list.length?list.map(H.renderListCard).join(''):H.emptyState('No '+cat.name+' listings yet','Be the first to post in this category!','Post an Ad',"H.navTo('Post',null)")}
        </div>
      </div>`;
    };
  },

  _registerExtraPages() {
    H.pages.About=function(){
      return '<div class="page active">'+H.innerTopbar('About PaMarket')
        +'<div class="about-wrap">'
        +'<div class="about-hero"><div class="about-brand">Pa<em>Market</em></div><div class="about-tag">Free Zimbabwean Online Marketplace</div></div>'
        +'<div class="about-card"><div class="about-sec-title">What is PaMarket?</div><div class="about-body">PaMarket is a free Zimbabwean online marketplace connecting buyers and sellers. Whether you are looking for goods, services, vehicles, property, or jobs, PaMarket makes it easy to post, browse, and connect with people in your province and across Zimbabwe.</div></div>'
        +'<div class="about-card"><div class="about-sec-title">Who is it for?</div><div class="about-body">PaMarket is for anyone in Zimbabwe — individuals selling personal items, small businesses promoting services, employers posting vacancies, and buyers searching for the best local deals. The app is free to download and free to use.</div></div>'
        +'<div class="about-card"><div class="about-sec-title">Key Features</div><div class="about-grid">'
        +['Free Listings','Secure Messaging','WhatsApp Connect','All Categories','Province Filters','Boost Your Ads','Job Board','Photo Uploads'].map(f=>'<div class="about-feat">'+f+'</div>').join('')
        +'</div></div>'
        +'<div class="about-card"><div class="about-sec-title">Legal &amp; Compliance</div><div class="about-body">PaMarket operates as a platform for user-generated listings. We do not own, sell, or warrant any items listed. Users are responsible for ensuring their listings comply with applicable Zimbabwean law. Prohibited content (counterfeit goods, illegal services, misleading listings) will be removed and accounts suspended. By using PaMarket you agree to our Terms of Service and Privacy Policy.</div></div>'
        +'<div class="about-card"><div class="about-sec-title">Contact Us</div>'
        +'<div class="about-contact-row" onclick="window.location.href=\'mailto:chakusaprince@gmail.com\'"><div class="about-contact-ic email-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div><div class="about-contact-label">Support Email</div><div class="about-contact-val">chakusaprince@gmail.com</div></div></div>'
        +'<div class="about-contact-row" onclick="window.open(\'https://wa.me/971589772645\')"><div class="about-contact-ic wa-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg></div><div><div class="about-contact-label">WhatsApp Support</div><div class="about-contact-val">+971 589 772 645</div></div></div>'
        +'</div>'
        +'<div class="about-ads-banner"><div class="about-ads-title">Advertise with PaMarket</div><div class="about-ads-sub">Reach active buyers across all provinces of Zimbabwe</div><button class="about-ads-btn" onclick="H.openInner(\'Ads\')">Get in Touch</button></div>'
        +'<div style="text-align:center;font-size:12px;color:var(--text-muted,#999);padding:16px 0 4px">PaMarket © 2026 · Made in Zimbabwe</div>'
        +'</div></div>';
    };

    H.pages.Ads=function(){
      return '<div class="page active">'+H.innerTopbar('Advertise with PaMarket')
        +'<div class="about-wrap">'
        +'<div class="ads-hero"><div class="ads-hero-title">Grow Your Business</div><div class="ads-hero-sub">Connect with active buyers across all provinces of Zimbabwe. Tell us about your goals and we\'ll find the right fit for you.</div></div>'
        +'<div class="about-card"><div class="about-sec-title">What We Offer</div>'
        +'<div class="about-body" style="margin-bottom:0">'
        +'<div style="display:flex;flex-direction:column;gap:10px">'
        +[['Listing Boost','Get your listing seen first in search results and category pages.'],['Banner Ad','Eye-catching banner placement on the home screen.'],['Category Spotlight','Pin your business to the top of a category of your choice.'],['Custom Campaign','Tailored multi-placement campaign for maximum reach.']]
          .map(([t,d])=>'<div style="background:var(--bg,#f5f7fb);border-radius:10px;padding:12px 14px"><div style="font-weight:700;font-size:14px;color:var(--text,#1a1a1a);margin-bottom:3px">'+t+'</div><div style="font-size:13px;color:var(--text-muted,#666)">'+d+'</div></div>')
          .join('')
        +'</div></div></div>'
        +'<div class="about-card"><div class="about-sec-title">Send an Enquiry</div>'
        +'<div class="fg"><div class="fl">Business Name</div><input class="fi" id="adsBiz" placeholder="Your business name"></div>'
        +'<div class="fg"><div class="fl">Contact Email</div><input class="fi" id="adsEmail" type="email" placeholder="your@email.com"></div>'
        +'<div class="fg"><div class="fl">Ad Type</div><select class="fi" id="adsType"><option value="Listing Boost">Listing Boost</option><option value="Banner Ad">Banner Ad</option><option value="Category Spotlight">Category Spotlight</option><option value="Custom Campaign">Custom Campaign</option></select></div>'
        +'<div class="fg"><div class="fl">Message</div><textarea class="fi" rows="4" id="adsMsg" placeholder="Tell us about your product or service and what you\'d like to achieve..."></textarea></div>'
        +'<button onclick="H._submitAdsEnquiry()" style="width:100%;padding:15px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">Send Enquiry</button>'
        +'</div>'
        +'<div class="about-card" style="text-align:center">'
        +'<div class="about-sec-title">Prefer WhatsApp?</div>'
        +'<div class="about-body" style="margin-bottom:12px">Chat with us directly on WhatsApp and we\'ll get back to you quickly.</div>'
        +'<button onclick="window.open(\'https://wa.me/971589772645?text=Hi%2C%20I\'m%20interested%20in%20advertising%20on%20PaMarket\')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#25D366;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>Chat on WhatsApp</button>'
        +'</div>'
        +'</div></div>';
    };
    H._submitAdsEnquiry=function(){
      const biz=(document.getElementById('adsBiz').value||'').trim();
      const email=(document.getElementById('adsEmail').value||'').trim();
      const type=(document.getElementById('adsType').value||'').trim();
      const msg=(document.getElementById('adsMsg').value||'').trim();
      if(!biz){H.toast('Please enter your business name');return;}
      if(!email){H.toast('Please enter your contact email');return;}
      if(!msg){H.toast('Please add a message');return;}
      const subject=encodeURIComponent('PaMarket Advertising Enquiry – '+type);
      const body=encodeURIComponent('Business: '+biz+'\nContact Email: '+email+'\nAd Type: '+type+'\n\nMessage:\n'+msg);
      window.location.href='mailto:chakusaprince@gmail.com?subject='+subject+'&body='+body;
    };
  },

  _registerJobPage() {
    H.pages.PostJob=function(){
      const u=H.currentUser();
      if(!u) return '<div class="page active">'+H.innerTopbar('Post a Job')+H.emptyState('Sign in required','Please sign in to post jobs',null,null)+'</div>';
      return '<div class="page active">'+H.innerTopbar('Post a Job')
        +'<div class="form-wrap" style="padding-bottom:40px">'
        +'<div style="background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:16px;padding:20px;margin-bottom:20px;color:#fff"><div style="font-size:18px;font-weight:800;margin-bottom:4px">Post a Job Opening</div><div style="font-size:13px;opacity:.85">Jobs are reviewed by admin within 24hrs before going live</div></div>'
        +'<div class="fg"><div class="fl">Company Name <span style="color:red">*</span></div><input class="fi" id="jCompany" placeholder="e.g. TechZim Solutions"></div>'
        +'<div class="fg"><div class="fl">Job Title <span style="color:red">*</span></div><input class="fi" id="jTitle" placeholder="e.g. Software Developer"></div>'
        +'<div class="fg"><div class="fl">Job Type <span style="color:red">*</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'
        +['Full Time','Part Time','Contract','Freelance','Internship','Volunteer'].map(t=>{
          const tid='jt_'+t.replace(' ','_');
          return '<button class="filter-opt" id="'+tid+'" onclick="H._selectJobType(this)" data-type="'+t+'" style="padding:10px;border-radius:10px;border:2px solid var(--border);background:var(--card);font-size:13px;font-weight:600;cursor:pointer">'+t+'</button>';
        }).join('')
        +'</div></div>'
        +'<div class="fg"><div class="fl">Industry <span style="color:red">*</span></div><select class="fi" id="jIndustry"><option value="">Select industry...</option>'
        +['IT & Technology','Finance & Banking','Healthcare','Education','Construction','Hospitality & Tourism','Sales & Marketing','Admin & Office','Agriculture','Transport & Logistics','Manufacturing','Media & Communications','Legal','NGO & Non-profit','Other'].map(i=>'<option>'+i+'</option>').join('')
        +'</select></div>'
        +'<div class="fg"><div class="fl">Location <span style="color:red">*</span></div><select class="fi" id="jProv">'+H.PROVINCES.map(p=>'<option>'+p+'</option>').join('')+'</select></div>'
        +'<div class="fg"><div class="fl">Salary</div><div style="display:flex;gap:8px"><input class="fi" id="jSalaryMin" type="number" placeholder="Min (USD)" style="flex:1"><input class="fi" id="jSalaryMax" type="number" placeholder="Max (USD)" style="flex:1"></div><label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px"><input type="checkbox" id="jNegotiable" onchange="H._toggleNegotiable(this)"> Negotiable</label></div>'
        +'<div class="fg"><div class="fl">Job Description <span style="color:red">*</span></div><textarea class="fi" rows="5" id="jDesc" placeholder="Describe the role..."></textarea></div>'
        +'<div class="fg"><div class="fl">Requirements <span style="color:red">*</span></div><textarea class="fi" rows="4" id="jReqs" placeholder="Qualifications required..."></textarea></div>'
        +'<div class="fg"><div class="fl">Deadline</div><input class="fi" id="jDeadline" type="date"></div>'
        +'<div class="fg"><div class="fl">How to Apply</div><select class="fi" id="jApplyType" onchange="H._toggleApplyFields()"><option value="email">Via Email</option><option value="whatsapp">Via WhatsApp</option><option value="both">Both</option></select></div>'
        +'<div class="fg" id="jEmailWrap"><div class="fl">Contact Email</div><input class="fi" id="jEmail" type="email" value="'+H.escHtml(u.email||'')+'"></div>'
        +'<div class="fg" id="jPhoneWrap" style="display:none"><div class="fl">WhatsApp Number</div><input class="fi" id="jPhone" type="tel" value="'+H.escHtml(u.phone||'')+'"></div>'
        +'<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:12px;padding:14px;margin:16px 0;font-size:13px;color:#856404;display:flex;align-items:center;gap:8px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Fraudulent job postings will result in a permanent ban.</div>'
        +'<button onclick="H._submitJob()" style="width:100%;padding:15px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer">Submit for Review</button>'
        +'</div></div>';
    };

    H._selectedJobType='';
    H._selectJobType=function(el){
      const type=el.dataset?el.dataset.type:el; H._selectedJobType=type;
      document.querySelectorAll('[id^="jt_"]').forEach(b=>{b.style.background='var(--card)';b.style.color='var(--text)';b.style.borderColor='var(--border)';});
      const btn=typeof el==='string'?document.getElementById('jt_'+type.replace(' ','_')):el;
      if(btn){btn.style.background='#1A3A8F';btn.style.color='#fff';btn.style.borderColor='#1A3A8F';}
    };
    H._toggleNegotiable=function(cb){document.getElementById('jSalaryMin').disabled=cb.checked;document.getElementById('jSalaryMax').disabled=cb.checked;};
    H._toggleApplyFields=function(){
      const t=document.getElementById('jApplyType').value;
      document.getElementById('jEmailWrap').style.display=t==='whatsapp'?'none':'';
      document.getElementById('jPhoneWrap').style.display=t==='email'?'none':'';
    };
    H._submitJob=function(){
      const u=H.currentUser(); if(!u){H.requireAuth('Sign in to post jobs');return;}
      const company=(document.getElementById('jCompany').value||'').trim();
      const title=(document.getElementById('jTitle').value||'').trim();
      const type=H._selectedJobType;
      const industry=(document.getElementById('jIndustry').value||'').trim();
      const prov=(document.getElementById('jProv').value||'').trim();
      const salMin=(document.getElementById('jSalaryMin').value||'').trim();
      const salMax=(document.getElementById('jSalaryMax').value||'').trim();
      const negotiable=document.getElementById('jNegotiable').checked;
      const desc=(document.getElementById('jDesc').value||'').trim();
      const reqs=(document.getElementById('jReqs').value||'').trim();
      const deadline=(document.getElementById('jDeadline').value||'').trim();
      const applyType=document.getElementById('jApplyType').value;
      const email=(document.getElementById('jEmail').value||'').trim();
      const phone=(document.getElementById('jPhone').value||'').trim();
      if(!company){H.toast('Company name required');return;}
      if(!title){H.toast('Job title required');return;}
      if(!type){H.toast('Select job type');return;}
      if(!industry){H.toast('Select an industry');return;}
      if(!desc){H.toast('Job description required');return;}
      if(!reqs){H.toast('Requirements required');return;}
      if(applyType!=='whatsapp'&&!email){H.toast('Contact email required');return;}
      if(applyType!=='email'&&!phone){H.toast('WhatsApp number required');return;}
      const salary=negotiable?'Negotiable':(salMin&&salMax?'USD '+salMin+' - '+salMax:salMin?'From USD '+salMin:'Not disclosed');
      const fullDesc='COMPANY: '+company+'\nJOB TYPE: '+type+'\nINDUSTRY: '+industry+'\nSALARY: '+salary+(deadline?'\nDEADLINE: '+deadline:'')+'\n\nDESCRIPTION:\n'+desc+'\n\nREQUIREMENTS:\n'+reqs+'\n\nHOW TO APPLY:'+(applyType!=='whatsapp'?'\nEmail: '+email:'')+(applyType!=='email'?'\nWhatsApp: '+phone:'');
      const job={id:H.uid(),sellerId:u.id,sellerName:company,sellerPhone:phone||u.phone||'',title,desc:fullDesc,price:negotiable?0:(parseInt(salMin)||0),currency:'USD',cat:'jobs',prov,city:prov,suburb:company,photos:[],createdAt:Date.now(),status:'pending',boost:null,views:0};
      H.state.listings.unshift(job);
      H.saveState();
      if(typeof H.saveListingToCloud==='function') H.saveListingToCloud(job);
      H.toast('Job submitted for review!');
      H.goBack();
    };
  },

  showAccountMenu(btn) {
    const u=this.currentUser();
    const sheet=document.getElementById('actionSheet');
    const bg=document.getElementById('sheetBg');
    const I=this.ICONS;
    const nav=(page)=>`H.closeSheet();H.state._backToAccount=true;setTimeout(()=>H.openInner('${page}'),50)`;
    const item=(label,icon,page,badge,extra)=>`<button class="sheet-item" onclick="${extra||nav(page)}"><span class="sheet-icon">${icon}</span><span class="sheet-label">${label}</span>${badge?`<span style="margin-left:auto;background:#F5A623;color:#1A3A8F;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:800">${badge}</span>`:''}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text-primary)" stroke-width="2" style="margin-left:auto;opacity:.7"><polyline points="9 18 15 12 9 6"/></svg></button>`;

    if(!u){
      const publicNav=(page)=>`H.closeSheet();setTimeout(()=>H.openInner('${page}'),50)`;
      const gated=msg=>`H.closeSheet();setTimeout(()=>H.requireAuth('${msg}'),50)`;
      sheet.innerHTML=`
        <div class="guest-account-head">
          <img src="img/icon-192.png" alt="PaMarket">
          <div class="guest-account-card">
            <div>Login to continue</div>
            <button onclick="H.closeSheet();setTimeout(()=>H.requireAuth('Login to continue'),50)">SIGN IN / SIGN UP</button>
          </div>
        </div>
        <div class="guest-account-activity" onclick="${gated('Login to continue')}">
          <span class="sheet-icon">${I.search}</span>
          <div><strong>My Activity</strong><small>View your recent searches and activities</small></div>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="guest-menu-title">More on PaMarket</div>
        ${item('Advertisements',I.ads,'', '', gated('Login to advertise'))}
        ${item('Sell My Property','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>','', '', gated('Login to continue'))}
        ${item('Find Jobs','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>','Jobs','',publicNav('Jobs'))}
        ${item('Favourites',I.heart,'', '', gated('Login to continue'))}
        ${item('Saved Searches',I.search,'', '', gated('Login to continue'))}
        ${item('Language','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>','LanguageSettings',this.getLanguage(),publicNav('LanguageSettings'))}
        ${item('Notification Center','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>','Notifications','',publicNav('Notifications'))}
        ${item('Help & Support',I.help,'Help','',publicNav('Help'))}
        ${item('About Us','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>','About','',publicNav('About'))}
        ${item('Privacy Policy','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>','HelpPrivacy','',publicNav('HelpPrivacy'))}
        <button class="sheet-close" onclick="H.closeSheet()">${I.close} Close</button>`;
      sheet.classList.add('open'); bg.classList.add('open');
      return;
    }

    const activeAds=(this.state.listings||[]).filter(l=>l.sellerId===u.id&&l.status==='active').length;
    const savedAds=((this.state.saves||{})[u.id]||[]).length;
    if (!Array.isArray(this.state.conversations)) this.state.conversations = [];
    const unread=this.state.conversations.reduce((n,c)=>Array.isArray(c.members)&&c.members.includes(u.id)?n+(c.messages||[]).filter(m=>m.from!==u.id&&!m.read).length:n,0);

    sheet.innerHTML=`
      <div onclick="${nav('Profile')}" style="display:flex;align-items:center;gap:14px;padding:16px 18px 14px;border-bottom:1px solid var(--border);cursor:pointer">
        <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;background:#1A3A8F14;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;font-weight:800;color:#1A3A8F;border:2px solid #1A3A8F22">
          ${u.avatar?`<img src="${this.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover">`:this.initials(u.name)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.escHtml(u.name||'User')}</div>
          <div style="font-size:12px;color:var(--sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.escHtml(u.email||'')}</div>
          <div style="font-size:11px;color:var(--sub);margin-top:1px">${this.escHtml(u.phone||'No phone')}</div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--border)">
        ${[['Ads',activeAds,'MyListings'],['Saved',savedAds,'Favorites'],['Inbox',unread,'Messages']].map(([l,v,p])=>`
          <div onclick="${p==='Messages'?'H.closeSheet();setTimeout(()=>H.navTo(\'Messages\'),50)':nav(p)}" style="padding:12px 4px;text-align:center;cursor:pointer;border-right:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:#1A3A8F">${v}</div>
            <div style="font-size:10px;color:var(--sub);font-weight:600">${l}</div>
          </div>`).join('')}
      </div>

      ${item('My Profile',I.user,'Profile','')}
      ${item('My Activity',I.search,'MyActivity','')}
      ${item('My Listings',I.doc,'MyListings',activeAds||'')}
      ${item('Saved & Favorites',I.heart,'Favorites',savedAds||'')}
      ${item('Advertisements',I.ads,'Ads','')}
      ${item('Settings',I.settings,'Settings','')}
      ${item('Security & Password','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>','SecuritySettings','')}
      ${item('Help & Support',I.help,'Help','')}
      ${item('About PaMarket','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>','About','')}
      <button class="sheet-item danger" onclick="H.closeSheet();setTimeout(()=>H.logout(),50)">
        <span class="sheet-icon">${I.logout}</span>
        <span class="sheet-label">Sign Out</span>
      </button>
      <button class="sheet-close" onclick="H.closeSheet()">${I.close} Close</button>`;
    sheet.classList.add('open'); bg.classList.add('open');
  },

  requireAuth(msg) {
    this.closeSheet();
    const bg=document.getElementById('modalBg');
    const box=document.getElementById('modalBox');
    if(!bg||!box) return;
    box.classList.add('login-modal');
    box.innerHTML=`
      <button class="login-modal-close" onclick="H.closeLoginModal()" aria-label="Close">&times;</button>
      <div class="login-modal-brand">
        <div>Pa<em>Market</em></div>
      </div>
      <div class="login-modal-illustration">
        <svg viewBox="0 0 120 90" fill="none" aria-hidden="true">
          <rect x="22" y="36" width="52" height="40" rx="8" fill="#EEF2FF" stroke="#1A3A8F" stroke-width="4.5"/>
          <path d="M35 36V28a13 13 0 0 1 26 0v8" stroke="#1A3A8F" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <circle cx="87" cy="27" r="16" fill="#F5A623"/>
          <path d="M87 19v16M79 27h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="auth-card" id="authCard"></div>
      <div class="login-modal-foot">
        By continuing you agree to our
        <span onclick="H.authShowDoc('terms')" style="color:var(--blue);cursor:pointer;text-decoration:underline">Terms &amp; Conditions</span>
        and
        <span onclick="H.authShowDoc('privacy')" style="color:var(--blue);cursor:pointer;text-decoration:underline">Privacy Policy</span>
      </div>`;
    bg.classList.add('open');
    bg.scrollTop = 0;
    if(typeof H.authStepEmail==='function') H.authStepEmail();
  },

  guestAccountPage() {
    const I=this.ICONS;
    const item=(label,icon,page,badge,restricted)=>`<button class="account-menu-row" onclick="${restricted?`H.requireAuth('Login to continue')`:`H.openInner('${page}')`}">
      <span class="sheet-icon">${icon}</span>
      <span class="sheet-label">${label}</span>
      ${badge?`<span class="account-row-badge">${badge}</span>`:''}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;
    return `<div class="page active account-page">
      <div class="guest-account-head">
        <div class="guest-account-mark">Pa<em>Market</em></div>
        <div class="guest-account-card">
          <div>Login to continue</div>
          <button onclick="H.requireAuth('Login to continue')">SIGN IN / SIGN UP</button>
        </div>
      </div>
      <div class="guest-account-body">
        <div class="guest-account-activity" onclick="H.requireAuth('Login to continue')">
          <span class="sheet-icon">${I.search}</span>
          <div><strong>My Activity</strong><small>View your recent searches and activities</small></div>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="guest-menu-title">More on PaMarket</div>
        <div class="account-menu-list">
          ${item('Advertisements',I.ads,'Ads','',true)}
          ${item('Favourites',I.heart,'Favorites','',true)}
          ${item('Saved Searches',I.search,'SavedSearches','',true)}
          ${item('Find Jobs','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>','Jobs')}
          ${item('Notification Center','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>','Notifications')}
          ${item('Language','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>','LanguageSettings',this.getLanguage())}
          ${item('Help & Support',I.help,'Help')}
          ${item('About Us','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>','About')}
          ${item('Privacy Policy','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>','HelpPrivacy')}
        </div>
      </div>
    </div>`;
  },

  _showOnboarding() {
    if(localStorage.getItem('pamarket_onboarded')) return;
    const slides=[
      {icon:'🏪',title:'Zimbabwe\'s Free Marketplace',sub:'Buy and sell anything across all provinces'},
      {icon:'📱',title:'Browse Without Signing Up',sub:'Explore listings freely. Sign in only when ready'},
      {icon:'💬',title:'Connect via WhatsApp',sub:'Chat directly with sellers via WhatsApp or in-app'},
      {icon:'🚀',title:'Post Your Ad Free',sub:'List your items in minutes and reach thousands of buyers'}
    ];
    let cur=0;
    const ov=document.createElement('div');
    ov.id='onboardOverlay';
    ov.style.cssText='position:fixed;inset:0;background:#1A3A8F;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;font-family:Inter,sans-serif';
    const render=()=>{
      const s=slides[cur];
      ov.innerHTML=`
        <div style="font-size:72px;margin-bottom:24px">${s.icon}</div>
        <div style="font-size:24px;font-weight:700;color:#fff;text-align:center;margin-bottom:12px">${s.title}</div>
        <div style="font-size:15px;color:rgba(255,255,255,.7);text-align:center;margin-bottom:48px;line-height:1.6">${s.sub}</div>
        <div style="display:flex;gap:8px;margin-bottom:40px">
          ${slides.map((_,i)=>`<div style="width:${i===cur?24:8}px;height:8px;border-radius:4px;background:${i===cur?'#F5A623':'rgba(255,255,255,.3)'}"></div>`).join('')}
        </div>
        ${cur<slides.length-1
          ?`<button onclick="window._onboardNext()" style="width:100%;padding:16px;background:#F5A623;color:#1A3A8F;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer">Next</button>
            <button onclick="window._onboardSkip()" style="margin-top:12px;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:14px;cursor:pointer">Skip</button>`
          :`<button onclick="window._onboardSkip()" style="width:100%;padding:16px;background:#F5A623;color:#1A3A8F;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer">Get Started</button>`
        }`;
    };
    window._onboardNext=()=>{cur++;render();};
    window._onboardSkip=()=>{localStorage.setItem('pamarket_onboarded','1');ov.remove();};
    document.body.appendChild(ov);
    render();
  },

  openPhotoViewer(photos,idx=0){
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:#000;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column';
    ov.id='pvOv';
    ov.innerHTML='<button onclick="document.getElementById(\'pvOv\').remove()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.2);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:22px;cursor:pointer">&times;</button>'
      +'<img id="pvImg" src="'+photos[idx]+'" style="max-width:100%;max-height:85vh;object-fit:contain">';
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  },

  init() {
    this.state=this.loadState();
    var hadDemo = (this.state.listings||[]).some(l=>String(l.id).startsWith('demo')) ||
                  (this.state.users||[]).some(u=>String(u.id).startsWith('demo'));
    this.state.listings=(this.state.listings||[]).filter(l=>!String(l.id).startsWith('demo'));
    this.state.users=(this.state.users||[]).filter(u=>!String(u.id).startsWith('demo'));
    if (hadDemo) this.saveState();
    window.onerror = function(msg, src, line, col, err) {
      try {
        var sb = window.supabase;
        if (sb && typeof sb.from === 'function') {
          sb.from('error_logs').insert({ message: String(msg), source: src+':'+line, stack: err ? String(err.stack||'').slice(0,500) : null, created_at: new Date().toISOString() }).then(function(){});
        }
      } catch(e) {}
    };
    this._registerCategoryView();
    this._registerJobPage();
    this._registerExtraPages();
    setTimeout(()=>this._showOnboarding(),800);

    document.addEventListener('DOMContentLoaded',()=>{
      const nav=document.getElementById('bottomNav');
      if(nav){
        nav.addEventListener('click',e=>{
          const btn=e.target.closest('[data-nav]'); if(!btn) return;
          const name=btn.dataset.nav;
          if(name==='Post')    {if(!H.currentUser()){H.requireAuth('Log in to post an ad');return;}H.navTo('Post',btn);}
          else if(name==='Account'){H.navTo('Account',btn);}
          else if(name==='Messages'){if(!H.currentUser()){H.requireAuth('Sign in to view messages');return;}H.navTo(name,btn);}
          else H.navTo(name,btn);
        });
      }
      window.addEventListener('popstate',()=>H.goBack());
      window.addEventListener('beforeunload',()=>H.stopCam());
      document.addEventListener('keydown',e=>{if(e.key==='Escape')H.closeModal();});
      H.boot();
    });
  }
};

['navTo','openInner','goBack','toast','closeModal','closeSheet'].forEach(fn=>{
  window[fn]=(...a)=>H[fn](...a);
});
window.pushNotif=(uid,title,body)=>H.pushNotif&&H.pushNotif(uid,title,body);
window.openListing=id=>H.openListing(id);

// Deep link router — called when user taps a push notification
H._handleDeepLink = function(route) {
  if (!route) return;
  if (route.startsWith('listing:')) {
    H.openListing(route.split(':')[1]);
  } else if (route.startsWith('chat:')) {
    H.openInner('Chat', { id: route.split(':')[1] });
  } else {
    // Named pages: Home, Jobs, Messages, Account, Ads, etc.
    H.navTo(route);
  }
};

H._checkEngagementAlerts = function () {
  try {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const u = H.currentUser();

    if (u) {
      // A. Auto-expire listings older than 30 days
      let changed = false;
      (H.state.listings || []).forEach(function (l) {
        if (l.sellerId === u.id && l.status === 'active' && (Date.now() - l.createdAt) > THIRTY_DAYS) {
          l.status = 'expired';
          changed = true;
        }
      });
      if (changed) {
        H.saveState();
        H.toast('Some of your listings have expired. Renew them in My Listings.');
      }

      // B. Price drop alerts
      const savedPrices = H.state.savedPrices || {};
      const saves = (H.state.saves || {})[u.id] || [];
      const priceDrops = [];
      saves.forEach(function (lid) {
        const listing = (H.state.listings || []).find(function (l) { return l.id === lid; });
        if (!listing || !savedPrices[lid]) return;
        if (listing.price < savedPrices[lid]) {
          priceDrops.push({ title: listing.title, oldPrice: savedPrices[lid], newPrice: listing.price, currency: listing.currency });
          savedPrices[lid] = listing.price;
        }
      });
      if (priceDrops.length > 0) {
        H.state.savedPrices = savedPrices;
        H.saveState();
        const first = priceDrops[0];
        H.toast('Price drop: ' + first.title + ' is now ' + H.fmtPrice(first.newPrice, first.currency) + ' (was ' + H.fmtPrice(first.oldPrice, first.currency) + ')');
      }
    }
  } catch (e) {
    console.warn('_checkEngagementAlerts:', e);
  }
};

H.init();

;/* === www/js/auth.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function(H) {
  let authBusy = false;

  // Rate limiting — max 5 failed attempts then 30s lockout
  var _failCount  = 0;
  var _lockUntil  = 0;

  function sb() { return (window.supabase && window.supabase.auth) ? window.supabase : null; }

  function setAuthBusy(v) {
    authBusy = v;
    const r = document.getElementById('authCard');
    if (r) r.querySelectorAll('button').forEach(function(b){ b.disabled = v; });
  }

  function isLocked() {
    if (Date.now() < _lockUntil) {
      var secs = Math.ceil((_lockUntil - Date.now()) / 1000);
      H.toast('Too many attempts. Try again in ' + secs + 's');
      return true;
    }
    return false;
  }

  function recordFailure() {
    _failCount++;
    if (_failCount >= 5) {
      _lockUntil  = Date.now() + 30000;
      _failCount  = 0;
      H.toast('Too many failed attempts. Locked for 30 seconds.');
    }
  }

  function recordSuccess() {
    _failCount = 0;
    _lockUntil = 0;
  }

  function validateEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  }

  function validatePhone(p) {
    if (!p) return true;
    return /^(\+263|0)[0-9]{9}$/.test(p.replace(/\s/g,''));
  }

  function passwordStrength(p) {
    var s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { label:'Weak',   color:'#ef4444', width:'25%'  };
    if (s <= 2) return { label:'Fair',   color:'#f97316', width:'50%'  };
    if (s <= 3) return { label:'Good',   color:'#eab308', width:'75%'  };
    return          { label:'Strong', color:'#22c55e', width:'100%' };
  }

  function updatePassStrength() {
    var p   = document.getElementById('newPass');
    var bar = document.getElementById('passStrengthBar');
    var lbl = document.getElementById('passStrengthLabel');
    if (!p || !bar || !lbl) return;
    if (!p.value) { bar.style.width='0'; lbl.textContent=''; return; }
    var s = passwordStrength(p.value);
    bar.style.width      = s.width;
    bar.style.background = s.color;
    lbl.textContent      = s.label;
    lbl.style.color      = s.color;
  }
  H._updatePassStrength = updatePassStrength;

  H.authLogoTap = function() {
    H.logoTap && H.logoTap();
  };

  H.authStepEmail = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    var ill = document.querySelector('.login-modal-illustration');
    if (ill) ill.style.display = '';
    card.innerHTML = ''
      + '<button class="social-auth-btn google" onclick="H.authGoogle()"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</button>'
      + '<div class="auth-divider"><span>or</span></div>'
      + '<button class="social-auth-btn email" onclick="H.authShowEmailForm()"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Login with email</button>'
      + '<div style="text-align:center;margin-top:16px;font-size:13px;color:var(--text-sub)">Don\'t have an account? <span onclick="H.authShowRegister()" style="color:#1A3A8F;font-weight:700;cursor:pointer">Create one</span></div>';
  };

  H.authShowEmailForm = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700;color:var(--text)">Sign In</div></div>'
      + '<div class="fg"><div class="fl">Email</div><input class="fi" id="emailIn" type="email" placeholder="you@example.com" autocomplete="email"></div>'
      + '<div class="fg"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="fl" style="margin-bottom:0">Password</span><span onclick="H.authForgotPassword()" style="font-size:12px;color:#F5A623;cursor:pointer;font-weight:500">Forgot password?</span></div><div style="position:relative"><input class="fi" id="passIn" type="password" placeholder="Password" onkeydown="if(event.key===\'Enter\')H.authSignIn()" autocomplete="current-password" style="padding-right:44px"><button type="button" onclick="H._togglePw(\'passIn\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px;line-height:1"><svg id="passIn_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>'
      + '<button class="auth-btn" onclick="H.authSignIn()">Sign In</button>'
      + '<button class="auth-btn secondary" onclick="H.authStepEmail()">&larr; Back</button>';
    setTimeout(function(){ var e=document.getElementById('emailIn'); if(e) e.focus(); }, 100);
  };

  H.authShowRegister = function() { H.authStepSignUp(); };

  H.authShow2FA = function(userId) {
    H._pendingTwoFactorUserId = userId;
    var card = document.getElementById('authCard');
    if (!card) {
      H.requireAuth && H.requireAuth('Two-factor authentication');
      card = document.getElementById('authCard');
    }
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:800;color:var(--text-primary)">Enter authentication code</div><div style="font-size:13px;color:var(--text-sub);margin-top:6px;line-height:1.5">Open your authenticator app and enter the 6-digit code for PaMarket.</div></div>'
      + '<div class="fg"><div class="fl">6-digit code</div><input class="fi" id="twoFactorLoginCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"></div>'
      + '<button class="auth-btn" onclick="H.authVerify2FA()">Verify & Continue</button>'
      + '<button class="auth-btn secondary" onclick="H.authCancel2FA()">Cancel</button>';
    setTimeout(function(){ var e=document.getElementById('twoFactorLoginCode'); if(e) e.focus(); }, 100);
  };

  H.authCancel2FA = async function() {
    H._pendingTwoFactorUserId = null;
    H.state.currentUserId = null;
    H.saveState();
    try { if (window.supabase && window.supabase.auth) await window.supabase.auth.signOut(); } catch(e) {}
    if (H.closeLoginModal) H.closeLoginModal();
  };

  H.authVerify2FA = async function() {
    var userId = H._pendingTwoFactorUserId;
    var u = (H.state.users || []).find(function(x){ return x.id === userId; });
    var code = ((document.getElementById('twoFactorLoginCode') || {}).value || '').trim();
    if (!u || !u.twoFactorEnabled || !u.twoFactorSecret) { H.toast('2FA setup not found'); return; }
    if (!H._twoFactorVerify || !await H._twoFactorVerify(u.twoFactorSecret, code)) {
      H.toast('Invalid authentication code');
      return;
    }
    H._pendingTwoFactorUserId = null;
    H.state.currentUserId = userId;
    H.saveState();
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.authStepSignUp = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    var ill = document.querySelector('.login-modal-illustration');
    if (ill) ill.style.display = 'none';
    card.innerHTML = ''
      + '<div class="fg"><div class="fl">Full Name</div><input class="fi" id="newName" placeholder="e.g. Tendai Moyo" autocomplete="name"></div>'
      + '<div class="fg"><div class="fl">Email</div><input class="fi" id="newEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>'
      + '<div class="fg"><div class="fl">Phone (optional)</div><input class="fi" id="newPhone" type="tel" placeholder="+263 77 123 4567" autocomplete="tel"></div>'
      + '<div class="fg"><div class="fl">Password</div><div style="position:relative"><input class="fi" id="newPass" type="password" placeholder="8+ chars, uppercase &amp; number" oninput="H._updatePassStrength()" autocomplete="new-password" style="padding-right:44px"><button type="button" onclick="H._togglePw(\'newPass\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px;line-height:1"><svg id="newPass_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div><div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px"><div id="passStrengthBar" style="height:100%;border-radius:2px;transition:all .3s;width:0"></div></div><div id="passStrengthLabel" style="font-size:11px;margin-top:3px;text-align:right;height:14px;color:var(--text-sub)"></div></div>'
      + '<div class="fg"><div class="fl">Confirm Password</div><div style="position:relative"><input class="fi" id="newPass2" type="password" placeholder="re-enter password" autocomplete="new-password" style="padding-right:44px"><button type="button" onclick="H._togglePw(\'newPass2\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px;line-height:1"><svg id="newPass2_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>'
      + '<label style="display:flex;gap:10px;align-items:flex-start;font-size:12px;color:#667085;margin-bottom:10px;cursor:pointer"><input id="ageConsent" type="checkbox" style="margin-top:2px"><span>I am 18+ and agree to <span onclick="event.stopPropagation();H.authShowDoc(\'terms\')" style="color:#1A3A8F;text-decoration:underline;cursor:pointer">Terms &amp; Conditions</span> and <span onclick="event.stopPropagation();H.authShowDoc(\'privacy\')" style="color:#1A3A8F;text-decoration:underline;cursor:pointer">Privacy Policy</span></span></label>'
      + '<button class="auth-btn" onclick="H.authSignUp()">Create Account</button>'
      + '<button class="auth-btn secondary" onclick="H.authStepEmail()">&larr; Back to Sign In</button>';
    setTimeout(function(){ var e=document.getElementById('newName'); if(e) e.focus(); }, 100);
  };

  H.authShowOtp = function(email) {
    var card = document.getElementById('authCard');
    if (!card) return;
    H._otpEmail = email;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:20px">'
      + '<div style="margin-bottom:10px;color:#1A3A8F"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>'
      + '<div style="font-size:20px;font-weight:700;color:var(--text)">Verify Your Email</div>'
      + '<div style="font-size:13px;color:var(--sub);margin-top:8px;line-height:1.6">We sent a 6-digit code to<br><strong style="color:var(--text)">' + H.escHtml(email) + '</strong></div>'
      + '</div>'
      + '<div class="fg"><div class="fl" style="text-align:center">Verification Code</div><input class="fi" id="otpIn" type="text" inputmode="numeric" maxlength="6" placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" style="letter-spacing:10px;text-align:center;font-size:24px;font-weight:700" onkeydown="if(event.key===\'Enter\')H.authVerifyOtp()"></div>'
      + '<button class="auth-btn" onclick="H.authVerifyOtp()">Verify &amp; Continue</button>'
      + '<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--sub)">Didn\'t get the code? <span onclick="H.authResendOtp()" style="color:#F5A623;font-weight:600;cursor:pointer">Resend</span></div>'
      + '<div style="text-align:center;margin-top:6px;font-size:12px;color:var(--sub)">Check spam if not received within 2 minutes</div>'
      + '<button class="auth-btn secondary" style="margin-top:16px" onclick="H.authStepEmail()">&larr; Back to Sign In</button>';
    setTimeout(function(){ var e=document.getElementById('otpIn'); if(e) e.focus(); }, 100);
  };

  H.authVerifyOtp = async function() {
    var otp = ((document.getElementById('otpIn')||{}).value||'').trim().replace(/\s/g,'');
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) { H.toast('Enter the 6-digit code from your email'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error — try again'); return; }
    setAuthBusy(true);
    var res = await c.auth.verifyOtp({ email: H._otpEmail, token: otp, type: 'signup' });
    if (res.error) { H.toast('Invalid or expired code. Try resending.'); setAuthBusy(false); return; }
    H.state.currentUserId = res.data.user.id;
    await H.loadProfile(res.data.user.id);
    H.saveState();
    setAuthBusy(false);
    H.toast('Email verified! Welcome to PaMarket');
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.authResendOtp = async function() {
    if (!H._otpEmail) return;
    var now = Date.now();
    H._otpResendTimes = (H._otpResendTimes || []).filter(function(t){ return now - t < 10 * 60 * 1000; });
    if (H._otpResendTimes.length >= 3) {
      var waitSec = Math.ceil((10 * 60 * 1000 - (now - H._otpResendTimes[0])) / 1000);
      H.toast('Too many resends — try again in ' + waitSec + 's', 4000, true);
      return;
    }
    H._otpResendTimes.push(now);
    var c = sb();
    if (!c) { H.toast('Connection error', 4000, true); return; }
    var res = await c.auth.resend({ type: 'signup', email: H._otpEmail });
    H.toast(res.error ? res.error.message : 'Code resent — check your inbox');
  };

  H.authForgotPassword = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700;color:var(--text)">Reset Password</div><div style="font-size:13px;color:var(--sub);margin-top:4px">Enter your email to receive a reset link</div></div>'
      + '<div class="fg"><div class="fl">Email</div><input class="fi" id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" onkeydown="if(event.key===\'Enter\')H.authSendReset()"></div>'
      + '<button class="auth-btn" onclick="H.authSendReset()">Send Reset Link</button>'
      + '<button class="auth-btn secondary" onclick="H.authShowEmailForm()">&larr; Back to Sign In</button>';
    setTimeout(function(){ var e=document.getElementById('resetEmail'); if(e) e.focus(); }, 100);
  };

  H.authSendReset = async function() {
    var email = ((document.getElementById('resetEmail')||{}).value||'').trim();
    if (!validateEmail(email)) { H.toast('Enter a valid email address'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error — try again'); return; }
    setAuthBusy(true);
    var res = await c.auth.resetPasswordForEmail(email);
    setAuthBusy(false);
    if (res.error) { H.toast(res.error.message); return; }
    var card = document.getElementById('authCard');
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;padding:24px 0">'
      + '<div style="font-size:42px;margin-bottom:12px">✉️</div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--text)">Check Your Email</div>'
      + '<div style="font-size:14px;color:var(--sub);margin-top:10px;line-height:1.6">A reset link was sent to<br><strong style="color:var(--text)">' + H.escHtml(email) + '</strong><br><br>Click the link in the email to set a new password. Check your spam folder if you don\'t see it.</div>'
      + '</div>'
      + '<button class="auth-btn secondary" onclick="H.authShowEmailForm()">&larr; Back to Sign In</button>';
  };

  H.authSignIn = async function() {
    if (authBusy) return;
    if (isLocked()) return;
    var email    = document.getElementById('emailIn').value.trim();
    var password = document.getElementById('passIn').value;
    if (!validateEmail(email)) { H.toast('Enter a valid email address'); return; }
    if (!password) { H.toast('Enter your password'); return; }
    setAuthBusy(true);
    var c = sb();
    if (c) {
      var res = await c.auth.signInWithPassword({email:email, password:password});
      if (res.error) {
        var msg = res.error.message;
        if (msg==='Invalid login credentials') msg = 'Wrong email or password';
        if (msg.includes('Email not confirmed')) msg = 'Please verify your email first';
        recordFailure();
        H.toast(msg); setAuthBusy(false); return;
      }
      H.state.currentUserId = res.data.user.id;
      await H.loadProfile(res.data.user.id);
      var su = H.currentUser();
      if (su && su.twoFactorEnabled && su.twoFactorSecret) {
        H._pendingTwoFactorUserId = res.data.user.id;
        H.state.currentUserId = null;
        H.saveState();
        setAuthBusy(false);
        H.authShow2FA(res.data.user.id);
        return;
      }
      recordSuccess();
      H.saveState();
      setAuthBusy(false);
      if (H.closeLoginModal) H.closeLoginModal();
      H.boot();
      return;
    }
    var user = (H.state.users||[]).find(function(u){ return (u.email||'').toLowerCase()===email.toLowerCase() && u._localPassword===password; });
    if (!user) { recordFailure(); H.toast('Wrong email or password'); setAuthBusy(false); return; }
    recordSuccess();
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      H._pendingTwoFactorUserId = user.id;
      H.state.currentUserId = null;
      H.saveState();
      setAuthBusy(false);
      H.authShow2FA(user.id);
      return;
    }
    H.state.currentUserId = user.id;
    H.saveState(); setAuthBusy(false); if (H.closeLoginModal) H.closeLoginModal(); H.boot();
  };

  H.authSignUp = async function() {
    if (authBusy) return;
    if (H.state && H.state.signupPaused) {
      H.toast('New sign-ups are temporarily paused. Please try again later.', 5000, true);
      return;
    }
    var name      = document.getElementById('newName').value.trim();
    var email     = document.getElementById('newEmail').value.trim();
    var phone     = document.getElementById('newPhone').value.trim();
    var password  = document.getElementById('newPass').value;
    var password2 = document.getElementById('newPass2').value;
    var consent   = document.getElementById('ageConsent').checked;

    if (name.length < 2)           { H.toast('Enter your full name'); return; }
    if (!validateEmail(email))     { H.toast('Enter a valid email address'); return; }
    if (!validatePhone(phone))     { H.toast('Enter a valid Zimbabwe phone number (+263 or 07X)'); return; }
    if (password.length < 8)       { H.toast('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password))   { H.toast('Password must include at least one uppercase letter'); return; }
    if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
      H.toast('Password must include a number or special character'); return;
    }
    if (password !== password2)    { H.toast('Passwords do not match'); return; }
    if (!consent)                  { H.toast('Please confirm you are 18+ and agree to our policies'); return; }

    setAuthBusy(true);
    var c = sb();
    if (c) {
      var res = await c.auth.signUp({email:email, password:password, options:{data:{full_name:name}}});
      if (res.error) {
        var msg = res.error.message;
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique constraint')) {
          msg = 'Email already registered. Sign in instead.';
        }
        H.toast(msg); setAuthBusy(false); return;
      }
      var userId = res.data.user.id;
      await c.from('profiles').upsert({id:userId, name:name, phone:phone||null, verified:false});
      var u = {id:userId,email:email,name:name,phone:phone||'',avatar:null,verified:false,walletUSD:0,language:'English',joinedAt:Date.now(),role:'user',status:'active',banReason:null,banUntil:null,blocked:[]};
      (H.state.users = H.state.users||[]).push(u);
      H.state.currentUserId = userId;
      H.saveState();
      setAuthBusy(false);
      if (res.data.session) {
        H.toast('Account created! Welcome to PaMarket');
        if (H.closeLoginModal) H.closeLoginModal();
        H.boot();
      } else {
        H.authShowOtp(email);
      }
      return;
    }
    var exists = (H.state.users||[]).some(function(u){ return (u.email||'').toLowerCase()===email.toLowerCase(); });
    if (exists) { H.toast('Email already registered. Sign in instead.'); setAuthBusy(false); return; }
    var uid2 = H.uid();
    (H.state.users = H.state.users||[]).push({id:uid2,email:email,name:name,phone:phone||'',avatar:null,verified:false,walletUSD:0,language:'English',joinedAt:Date.now(),role:'user',status:'active',banReason:null,banUntil:null,blocked:[],_localPassword:password});
    H.state.currentUserId = uid2;
    H.saveState(); setAuthBusy(false);
    H.toast('Account created! Welcome to PaMarket');
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.authAdminPage = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700;color:var(--text)">Admin Portal</div><div style="font-size:13px;color:var(--sub)">Restricted access</div></div>'
      + '<div class="fg"><div class="fl">Admin Email</div><input class="fi" id="admEmailPage" type="email" autocomplete="username"></div>'
      + '<div class="fg"><div class="fl">Password</div><input class="fi" id="admPassPage" type="password" placeholder="Password" onkeydown="if(event.key===\'Enter\')H.authAdminSignInPage()" autocomplete="current-password"></div>'
      + '<button class="auth-btn" onclick="H.authAdminSignInPage()">Admin Sign In</button>'
      + '<button class="auth-btn secondary" onclick="H.authStepEmail()">&larr; Back</button>';
    setTimeout(function(){ var p=document.getElementById('admEmailPage'); if(p) p.focus(); }, 100);
  };

  H.authAdminSignInPage = async function() {
    if (isLocked()) return;
    var email = ((document.getElementById('admEmailPage')||{}).value||'').trim();
    var pass  = ((document.getElementById('admPassPage')||{}).value||'').trim();
    if (!email||!pass) { H.toast('Enter credentials'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error - refresh page'); return; }
    H.toast('Signing in...');
    var res = await c.auth.signInWithPassword({email:email, password:pass});
    if (res.error) { recordFailure(); H.toast('Invalid credentials'); return; }
    H.state.currentUserId = res.data.user.id;
    await H.loadProfile(res.data.user.id);
    var cu = H.currentUser();
    if (!cu || cu.role !== 'admin') {
      if (c) { try { await c.auth.signOut(); } catch(e) {} }
      H.state.currentUserId = null;
      recordFailure();
      H.toast('Access denied. Not an admin account.');
      return;
    }
    recordSuccess();
    H.state.adminSession = {at:Date.now(),via:'supabase'};
    H.saveState();
    H.toast('Welcome Admin!');
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.loadProfile = async function(userId) {
    var c = sb(); if (!c) return;
    var res = await c.from('profiles').select('*').eq('id',userId).single();
    if (res.error||!res.data) {
      var u = (H.state.users||[]).find(function(x){return x.id===userId;});
      if (!u) { u={id:userId,email:'',name:'User',phone:'',avatar:null,verified:false,walletUSD:0,language:'English',joinedAt:Date.now(),role:'user',status:'active',banReason:null,banUntil:null,blocked:[]}; H.state.users.push(u); }
      return;
    }
    var profile = res.data;
    var u = (H.state.users||[]).find(function(x){return x.id===userId;});
    if (!u) {
      u = {id:userId,email:'',name:profile.name||'User',phone:profile.phone||'',avatar:profile.avatar||null,verified:profile.verified||false,walletUSD:profile.wallet_usd||0,language:profile.language||'English',joinedAt:new Date(profile.created_at||Date.now()).getTime(),role:profile.role||'user',status:'active',banReason:null,banUntil:null,blocked:[]};
      H.state.users.push(u);
    } else {
      u.name=profile.name||u.name; u.phone=profile.phone||u.phone; u.avatar=profile.avatar||u.avatar; u.verified=profile.verified||false; u.role=profile.role||u.role||'user';
      // Merge job profile fields from Supabase if they exist (after migrations are run)
      if (profile.job_title    != null) u.jobTitle       = profile.job_title;
      if (profile.job_types    != null) u.jobTypes        = profile.job_types;
      if (profile.sector       != null) u.sector          = profile.sector;
      if (profile.exp          != null) u.exp             = profile.exp;
      if (profile.city         != null) u.city            = profile.city;
      if (profile.bio          != null) u.bio             = profile.bio;
      if (profile.skills       != null) u.skills          = profile.skills;
      if (profile.open_to_work != null) u.openToWork      = profile.open_to_work;
      if (profile.expected_salary   != null) u.expectedSalary  = profile.expected_salary;
      if (profile.whatsapp_number   != null) u.whatsappFull    = profile.whatsapp_number;
      if (profile.phone_for_calls   != null) u.phoneForCalls   = profile.phone_for_calls;
      if (profile.contact_method    != null) u.contactMethod   = profile.contact_method;
      if (profile.contact_availability != null) u.contactAvail = profile.contact_availability;
      if (profile.linkedin_url  != null) u.linkedinUrl    = profile.linkedin_url;
      if (profile.github_url    != null) u.githubUrl      = profile.github_url;
      if (profile.website_url   != null) u.websiteUrl     = profile.website_url;
      if (profile.cv_file_url   != null) u.cvFileUrl      = profile.cv_file_url;
      if (profile.cv_file_name  != null) u.cvFileName     = profile.cv_file_name;
      if (profile.cv            != null) u.cv             = profile.cv;
    }
    H.saveState();
  };

  H.logout = function() {
    H.modal({
      title: 'Sign Out',
      body: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      danger: true,
      onConfirm: function() {
        H.state.currentUserId = null;
        H.state.adminSession = null;
        H.saveState();
        if (window._msgBadgeInterval) { clearInterval(window._msgBadgeInterval); window._msgBadgeInterval = null; }
        var reload = function() { window.location.reload(); };
        try {
          var sc = window.supabase;
          if (sc) {
            if (window._msgChannel) { sc.removeChannel(window._msgChannel); window._msgChannel = null; }
            if (H._notifChannel)    { sc.removeChannel(H._notifChannel);    H._notifChannel    = null; }
            if (sc.auth) {
              // Wait for signOut to clear Supabase session from localStorage before reloading
              sc.auth.signOut().then(reload).catch(reload);
              return;
            }
          }
        } catch(e) {}
        reload();
      }
    });
  };

  H.authGoogle = async function() {
    const c = sb();
    if (!c) { H.toast('Sign-in service unavailable'); return; }
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) H.toast(error.message || 'Google sign-in failed');
  };

  H.authApple = async function() {
    const c = sb();
    if (!c) { H.toast('Sign-in service unavailable'); return; }
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await c.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo }
    });
    if (error) H.toast(error.message || 'Apple sign-in failed');
  };

  H._togglePw = function(id) {
    var inp = document.getElementById(id);
    var eye = document.getElementById(id + '_eye');
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    if (eye) {
      eye.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  };

  H.authShowSetPassword = function() {
    // Called when user arrives via password reset email link
    var bg  = document.getElementById('modalBg');
    var box = document.getElementById('modalBox');
    if (!bg || !box) return;
    box.classList.remove('login-modal');
    box.innerHTML = '<div class="modal-header"><h3>Set New Password</h3></div>'
      + '<div class="modal-body-scroll">'
      + '<div class="fg" style="padding-top:8px"><div class="fl">New Password</div>'
      + '<div style="position:relative"><input class="fi" id="rpNewPass" type="password" placeholder="8+ chars, uppercase &amp; number" oninput="H._updatePassStrength()" style="padding-right:44px">'
      + '<button type="button" onclick="H._togglePw(\'rpNewPass\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px"><svg id="rpNewPass_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>'
      + '<div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px"><div id="passStrengthBar" style="height:100%;border-radius:2px;transition:all .3s;width:0"></div></div>'
      + '<div id="passStrengthLabel" style="font-size:11px;margin-top:3px;text-align:right;height:14px;color:var(--text-sub)"></div></div>'
      + '<div class="fg"><div class="fl">Confirm Password</div>'
      + '<div style="position:relative"><input class="fi" id="rpNewPass2" type="password" placeholder="re-enter password" style="padding-right:44px">'
      + '<button type="button" onclick="H._togglePw(\'rpNewPass2\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px"><svg id="rpNewPass2_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>'
      + '</div>'
      + '<div class="modal-footer"><div class="modal-btns">'
      + '<button class="modal-btn confirm" onclick="H.authDoSetPassword()">Save Password</button>'
      + '</div></div>';
    bg.classList.add('open');
    setTimeout(function(){ var e = document.getElementById('rpNewPass'); if(e) e.focus({preventScroll:true}); }, 100);
  };

  H.authDoSetPassword = async function() {
    var pass  = ((document.getElementById('rpNewPass')  || {}).value || '').trim();
    var pass2 = ((document.getElementById('rpNewPass2') || {}).value || '').trim();
    if (pass.length < 8)         { H.toast('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(pass))     { H.toast('Password must include an uppercase letter'); return; }
    if (!/[0-9]/.test(pass) && !/[^A-Za-z0-9]/.test(pass)) { H.toast('Password must include a number or special character'); return; }
    if (pass !== pass2)          { H.toast('Passwords do not match'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error'); return; }
    var btns = document.querySelectorAll('#modalBox button');
    btns.forEach(function(b){ b.disabled = true; });
    var res = await c.auth.updateUser({ password: pass });
    btns.forEach(function(b){ b.disabled = false; });
    if (res.error) { H.toast(res.error.message || 'Failed to update password'); return; }
    H.closeModal();
    H.toast('Password updated! Please sign in.');
    H.requireAuth('Sign in with your new password');
  };

  H.authShowDoc = function(which) {
    var sheet   = document.getElementById('docSheet');
    var titleEl = document.getElementById('docSheetTitle');
    var bodyEl  = document.getElementById('docSheetBody');
    if (!sheet || !titleEl || !bodyEl) return;
    titleEl.textContent = which === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
    bodyEl.innerHTML    = which === 'terms' ? H._termsText() : H._privacyText();
    bodyEl.scrollTop    = 0;
    sheet.classList.add('open');
  };

  H.closeDocSheet = function() {
    var sheet = document.getElementById('docSheet');
    if (sheet) sheet.classList.remove('open');
  };

  H._termsText = function() {
    return '<div class="doc-content">'
      + '<h2>Terms &amp; Conditions</h2>'
      + '<p><strong>Effective Date: 1 May 2026</strong></p>'
      + '<p>Welcome to PaMarket Zimbabwe. By downloading or using the PaMarket app you agree to be bound by these Terms and Conditions. Please read them carefully.</p>'
      + '<h3>1. Eligibility</h3>'
      + '<p>You must be at least 18 years old to create an account and use PaMarket. By registering you confirm that you meet this requirement. PaMarket reserves the right to terminate accounts of users found to be under 18.</p>'
      + '<h3>2. Account Responsibility</h3>'
      + '<p>You are responsible for keeping your login credentials secure. You are liable for all activity that occurs under your account. Notify us immediately at chakusaprince@gmail.com if you suspect unauthorised access.</p>'
      + '<h3>3. Listings</h3>'
      + '<p>You may only list items you own or have legal authority to sell. All listing information — including title, description, photos, and price — must be accurate and not misleading. PaMarket reserves the right to remove any listing without notice.</p>'
      + '<h3>4. Prohibited Content</h3>'
      + '<p>The following are strictly prohibited on PaMarket: stolen or counterfeit goods; illegal drugs, weapons, or firearms; adult or explicit content; hate speech or content that promotes discrimination; spam, pyramid schemes, or fraudulent offers; impersonation of any person or business.</p>'
      + '<h3>5. Transactions</h3>'
      + '<p>PaMarket is a listing and communication platform only. We do not process payments, hold funds, or guarantee the quality of any item. All transactions are solely between buyer and seller. PaMarket accepts no liability for disputes, losses, or damages arising from transactions.</p>'
      + '<h3>6. Wallet &amp; Top-Ups</h3>'
      + '<p>The in-app wallet is used exclusively for boosting listings. Top-up amounts that have not yet been used may be refunded upon written request to chakusaprince@gmail.com within 30 days of payment. Used credits are non-refundable. Wallet balances have no cash value and cannot be transferred.</p>'
      + '<h3>7. Intellectual Property</h3>'
      + '<p>All content you post on PaMarket (photos, descriptions, etc.) remains yours. By posting, you grant PaMarket a non-exclusive, royalty-free licence to display your content within the app. The PaMarket name, logo, and app design are our intellectual property and may not be copied or reused.</p>'
      + '<h3>8. Privacy</h3>'
      + '<p>Your use of the app is also governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>'
      + '<h3>9. Termination</h3>'
      + '<p>We may suspend or permanently ban any account that violates these Terms, with or without notice. You may delete your account at any time via Settings → Security → Delete Account.</p>'
      + '<h3>10. Limitation of Liability</h3>'
      + '<p>PaMarket is provided "as is" without warranties of any kind. To the maximum extent permitted by law, PaMarket shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.</p>'
      + '<h3>11. Changes to Terms</h3>'
      + '<p>We may update these Terms from time to time. Continued use of the app after changes are posted constitutes acceptance of the revised Terms.</p>'
      + '<h3>12. Governing Law</h3>'
      + '<p>These Terms are governed by the laws of Zimbabwe. Any disputes shall be resolved in the courts of Zimbabwe.</p>'
      + '<h3>13. Contact</h3>'
      + '<p>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

  H._privacyText = function() {
    return '<div class="doc-content">'
      + '<h2>Privacy Policy</h2>'
      + '<p><strong>Effective Date: 1 May 2026</strong></p>'
      + '<p>PaMarket Zimbabwe ("we", "us", or "our") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights.</p>'
      + '<h3>1. Information We Collect</h3>'
      + '<p><strong>Account data:</strong> name, email address, phone number, and profile photo when you register.</p>'
      + '<p><strong>Listing data:</strong> photos, descriptions, prices, and location you provide when posting an ad.</p>'
      + '<p><strong>Usage data:</strong> pages viewed, searches performed, listings saved, and messages sent within the app.</p>'
      + '<p><strong>Device data:</strong> device type, operating system, and app version for crash reporting and performance monitoring.</p>'
      + '<h3>2. How We Use Your Information</h3>'
      + '<p>To operate and improve the PaMarket platform; to authenticate your account and keep it secure; to display your listings to other users; to send you notifications about messages, offers, and account activity; to investigate reports of abuse or policy violations.</p>'
      + '<h3>3. Data Sharing</h3>'
      + '<p>We do not sell your personal data. We share data only with: <strong>Supabase</strong> (our database and authentication provider, data stored in EU data centres with encryption at rest and in transit); <strong>Google</strong> (if you choose Sign in with Google); and law enforcement when required by law.</p>'
      + '<h3>4. Photos &amp; Camera</h3>'
      + '<p>The app requests access to your camera and photo library only to let you upload listing photos and a profile picture. We do not access your camera or photos for any other purpose.</p>'
      + '<h3>5. Data Retention</h3>'
      + '<p>Your data is retained for as long as your account is active. When you delete your account, your personal data, listings, and messages are permanently deleted within 30 days.</p>'
      + '<h3>6. Security</h3>'
      + '<p>All data is transmitted over HTTPS. Passwords are never stored — authentication is managed by Supabase using industry-standard bcrypt hashing.</p>'
      + '<h3>7. Your Rights</h3>'
      + '<p>You may access, correct, or delete your personal data at any time via Settings → Edit Profile or Settings → Security → Delete Account. You may also contact us directly to request a copy of your data.</p>'
      + '<h3>8. Children\'s Privacy</h3>'
      + '<p>PaMarket is not intended for users under 18. We do not knowingly collect data from children. If we become aware that a child has registered, we will delete the account immediately.</p>'
      + '<h3>9. Changes to This Policy</h3>'
      + '<p>We may update this Privacy Policy from time to time. We will notify you of significant changes via in-app notification. Continued use of the app constitutes acceptance of the updated policy.</p>'
      + '<h3>10. Contact</h3>'
      + '<p>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

})(window.H);

;/* === www/js/home.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const { escHtml, timeAgo, filterListings, renderListCard, renderFeatCard, CATEGORIES, ICONS } = H;

  let searchTimer;
  function debounce(fn, delay) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fn, delay);
  }

  const CAT_COLORS = {
    vehicles:'#e53935',property:'#1E88E5',electronics:'#8E24AA',
    fashion:'#F06292',furniture:'#6D4C41',services:'#00897B',
    jobs:'#F5A623',rooms:'#00838F',other:'#546E7A',
    agriculture:'#558B2F',pets:'#FB8C00',kids:'#E91E63',
  };

  function renderHCard(l) {
    const photo = (l.photos && l.photos[0]) || '';
    const price = l.price ? ('$' + Number(l.price).toLocaleString()) : 'Free';
    const title = escHtml((l.title || '').slice(0, 36));
    const loc   = escHtml(l.suburb || l.city || l.prov || '');
    return `<div onclick="openListing('${l.id}')" style="background:var(--card);border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,0.07)">
      <div style="aspect-ratio:4/3;overflow:hidden;background:#f0f0f0;position:relative">
        ${photo
          ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.onerror=null;this.style.display='none'">`
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>'}
        ${l.boost && l.boost.until > Date.now() ? '<span style="position:absolute;top:6px;left:6px;background:#1A3A8F;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px">SPONSORED</span>' : ''}
        ${l.negotiable ? '<span style="position:absolute;top:6px;right:6px;background:#F5A623;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px">NEG</span>' : ''}
      </div>
      <div style="padding:8px 10px 11px">
        <div style="font-size:14px;font-weight:800;color:#1A3A8F;margin-bottom:2px">${price}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${title}</div>
        <div style="font-size:11px;color:var(--sub)">${loc}</div>
      </div>
    </div>`;
  }

  H.pages.Home = function () {
    const u = H.currentUser();
    const unreadNotifs = u ? (H.state.notifs[u.id] || []).filter(n => !n.read).length : 0;
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    const unreadMsgs   = u ? H.state.conversations.filter(cv =>
      Array.isArray(cv.members) && cv.members.includes(u.id) && (cv.messages || []).some(m => m.from !== u.id && !m.read)).length : 0;
    const activeListings = (H.state.listings || []).filter(l => l.status === 'active');
    const filtered       = filterListings(activeListings);
    const featured       = filtered.filter(l => l.boost && l.boost.until > Date.now()).slice(0, 6);

    const catSections = CATEGORIES.map(c => ({
      ...c, items: filtered.filter(l => l.cat === c.id).slice(0, 4)
    })).filter(s => s.items.length > 0);

    return `<div class="page active" style="background:var(--bg)">

      <!-- HEADER -->
      <div style="background:#1A3A8F;padding-bottom:16px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(26,58,143,0.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 0">
          <div onclick="H.logoTap()" style="cursor:pointer">
            <span style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;font-family:Inter,sans-serif">Pa<em style="font-style:normal;color:#F5A623">Market</em></span>
          </div>
          <div style="display:flex;gap:6px">
            <div onclick="H.openInner('Notifications')"
              style="position:relative;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span data-notif-badge style="position:absolute;top:4px;right:4px;background:#F5A623;color:#1A3A8F;border-radius:50%;min-width:16px;height:16px;font-size:9px;font-weight:900;display:${unreadNotifs ? 'flex' : 'none'};align-items:center;justify-content:center;padding:0 2px">${unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
            </div>
            <div onclick="H.currentUser()?H.openInner('Messages'):H.requireAuth('Sign in to view messages')"
              style="position:relative;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${unreadMsgs ? `<span style="position:absolute;top:4px;right:4px;background:#F5A623;color:#1A3A8F;border-radius:50%;min-width:16px;height:16px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 2px">${unreadMsgs > 9 ? '9+' : unreadMsgs}</span>` : ''}
            </div>
          </div>
        </div>

        <div onclick="H.toggleCityPicker()" style="display:inline-flex;align-items:center;gap:5px;padding:8px 16px 10px;cursor:pointer">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style="font-size:13px;color:rgba(255,255,255,0.9);font-weight:600">${escHtml(H.state.cityFilter)}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <div style="margin:0 16px;background:#fff;border-radius:14px;display:flex;align-items:center;padding:0 12px;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.18)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#999" stroke-width="2.5" style="flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="searchIn" placeholder="Search cars, houses, jobs..."
            oninput="H.onSearch()" autocomplete="off"
            style="flex:1;border:none;outline:none;padding:14px 0;font-size:15px;font-family:Inter,sans-serif;color:#222;background:transparent">
          <button onclick="document.getElementById('searchIn').value='';H.onSearch()"
            style="background:none;border:none;padding:6px;cursor:pointer;color:#ccc;display:flex;align-items:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- CITY PICKER -->
      <div class="city-picker" id="cityPicker" role="dialog">
        <div class="city-picker-title">Select your city</div>
        <div class="city-grid">
          <div class="city-opt ${H.state.cityFilter === 'All Zimbabwe' ? 'sel' : ''}" onclick="H.pickCity('All Zimbabwe')">All Zimbabwe</div>
          ${['Harare','Bulawayo','Mutare','Gweru','Masvingo','Chinhoyi','Kwekwe','Kadoma'].map(c =>
            `<div class="city-opt ${H.state.cityFilter === c ? 'sel' : ''}" onclick="H.pickCity('${c}')">${c}</div>`
          ).join('')}
        </div>
      </div>

      <div style="padding-bottom:88px">

        <!-- CATEGORIES GRID -->
        <div style="background:var(--card);padding:18px 16px 20px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <span style="font-size:15px;font-weight:800;color:var(--text)">Browse Categories</span>
            <span onclick="H.navTo('Browse',null)" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">See all</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
            ${CATEGORIES.map(c => {
              const color = CAT_COLORS[c.id] || '#546E7A';
              return `<div onclick="H.filterByCat('${c.id}')" style="display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer">
                <div style="width:56px;height:56px;border-radius:16px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:26px;border:1.5px solid ${color}22;transition:transform 0.15s"
                  onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.9)'" ontouchend="this.style.transform=''">${c.icon}</div>
                <span style="font-size:11px;font-weight:600;color:var(--text);text-align:center;line-height:1.2">${c.name}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- BANNER -->
        <div style="margin:0 12px 8px;background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);border-radius:18px;padding:20px;display:flex;align-items:center;justify-content:space-between;overflow:hidden;position:relative">
          <div style="position:absolute;right:-24px;top:-24px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.07)"></div>
          <div style="position:absolute;right:50px;bottom:-35px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
          <div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Zimbabwe's Free Marketplace</div>
            <div style="font-size:21px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:4px">Buy. Sell. Hire.</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.7)">Real people. Real deals.</div>
          </div>
          <div style="text-align:center;flex-shrink:0;margin-left:16px">
            <div style="font-size:30px;font-weight:900;color:#F5A623;line-height:1">${activeListings.length}</div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;margin-top:3px">Active Ads</div>
          </div>
        </div>

        <!-- HOT ON PAMARKET (paid ads horizontal scroll) -->
        ${(function(){
          var now = Date.now();
          var ads = (H.state.paidAds||[]).filter(function(a){ return a.active && a.endsAt > now; });
          if (!ads.length) return '';
          ads.forEach(function(a){ if(H.trackAdImpression) H.trackAdImpression(a.id); });
          return '<div style="padding:20px 0 0">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;margin-bottom:12px">'
            + '<div>'
            + '<div style="font-size:10px;font-weight:700;color:#1A3A8F;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px">Sponsored</div>'
            + '<span style="font-size:17px;font-weight:800;color:var(--text)">Hot on PaMarket</span>'
            + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:12px;padding:0 16px 8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none">'
            + ads.map(function(a){
                var clickFn = 'H.trackAdClick(' + JSON.stringify(a.id) + ',' + JSON.stringify(a.linkUrl||'') + ')';
                var title    = escHtml(a.headline || a.businessName || 'Sponsored');
                var sub      = escHtml(a.tagline || '');
                var bg       = escHtml(a.bgColor || '#1A3A8F');
                var initials = (a.businessName||'AD').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
                /* Image is positioned absolute over the initials fallback.
                   If it fails to load, onerror removes it and the initials show through. */
                return '<div onclick="' + escHtml(clickFn) + '" style="width:170px;flex-shrink:0;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.12);background:var(--card)">'
                  + '<div style="height:130px;background:' + bg + ';position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">'
                  /* initials always rendered as the base layer */
                  + '<span style="font-size:38px;font-weight:900;color:rgba(255,255,255,0.35);letter-spacing:-1px;position:relative;z-index:1">' + escHtml(initials) + '</span>'
                  /* image sits on top via absolute — removed on error so initials show */
                  + (a.imageUrl ? '<img src="' + escHtml(a.imageUrl) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2" loading="lazy" onerror="this.parentNode.removeChild(this)">' : '')
                  /* AD badge always on top */
                  + '<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.5);color:#fff;font-size:8px;font-weight:700;padding:2px 7px;border-radius:6px;letter-spacing:.5px;z-index:3">AD</span>'
                  /* gradient overlay at bottom for text legibility when image is shown */
                  + (a.imageUrl ? '<div style="position:absolute;bottom:0;left:0;right:0;height:56px;background:linear-gradient(to top,rgba(0,0,0,0.55),transparent);z-index:2"></div>' : '')
                  + '</div>'
                  + '<div style="padding:10px 12px 13px">'
                  + '<div style="font-size:13px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">' + title + '</div>'
                  + (sub ? '<div style="font-size:11px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sub + '</div>' : '')
                  + '</div>'
                  + '</div>';
              }).join('')
            + '</div>'
            + '</div>';
        })()}

        <!-- POST AD BUTTON -->
        <div style="padding:12px 12px 0">
          <button onclick="H.navTo('Post',null)"
            style="width:100%;padding:14px;background:#F5A623;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(245,166,35,0.35)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Post a Free Ad
          </button>
        </div>

        <!-- FEATURED -->
        ${featured.length ? `
        <div style="padding:20px 0 0">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:6px">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#F5A623" stroke="#F5A623" stroke-width="1"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span style="font-size:16px;font-weight:800;color:var(--text)">Featured Ads</span>
            </div>
            <span onclick="H.navTo('Browse',null)" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">See all</span>
          </div>
          <div style="display:flex;gap:12px;padding:0 16px 4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none">
            ${featured.map(l => `<div style="flex-shrink:0">${renderFeatCard(l)}</div>`).join('')}
          </div>
        </div>` : ''}

        <!-- SEARCH RESULTS (shown when typing) -->
        <div id="searchResults" style="display:none;padding:16px 12px 0">
          <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:12px;padding:0 4px">Search Results</div>
          <div id="searchResultsList" style="display:flex;flex-direction:column;gap:10px"></div>
        </div>

        <!-- CATEGORY SECTIONS (Dubizzle style, shown by default) -->
        <div id="catSections">
          ${catSections.length ? catSections.map(s => `
            <div style="padding:20px 0 0">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:20px">${s.icon}</span>
                  <span style="font-size:16px;font-weight:800;color:var(--text)">Latest in ${s.name}</span>
                </div>
                <span onclick="H.filterByCat('${s.id}')" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">See all</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px">
                ${s.items.map(l => renderHCard(l)).join('')}
              </div>
            </div>
          `).join('') : `<div style="padding:32px 16px">${H.emptyState('No listings yet', 'Be the first to post in your area!', 'Post your first ad', "H.navTo('Post',null)")}</div>`}
        </div>

      </div>
    </div>`;
  };

  H.onSearch = function () {
    debounce(() => {
      const q      = document.getElementById('searchIn')?.value || '';
      const catDiv = document.getElementById('catSections');
      const srDiv  = document.getElementById('searchResults');
      const srList = document.getElementById('searchResultsList');
      if (!catDiv || !srDiv || !srList) return;
      if (!q.trim()) {
        catDiv.style.display = '';
        srDiv.style.display  = 'none';
        return;
      }
      catDiv.style.display = 'none';
      srDiv.style.display  = '';
      const active   = (H.state.listings || []).filter(l => l.status === 'active');
      const results  = filterListings(active, q);
      srList.innerHTML = results.length
        ? results.map(l => `<div>${renderListCard(l)}</div>`).join('')
        : H.emptyState('No matches', 'Try different keywords or browse a category', null, null);
    }, 300);
  };

  H.pages.Home_after = function () {
    if (typeof H.fetchListingsFromSupabase !== 'function') return;
    const countBefore = (H.state.listings || []).filter(l => l.status === 'active').length;
    H.fetchListingsFromSupabase().then(() => {
      if (H.currentPageName !== 'Home') return;
      const countAfter = (H.state.listings || []).filter(l => l.status === 'active').length;
      if (countAfter > countBefore) H.toast('New listings loaded — pull down to refresh');
    }).catch(() => {});
  };

  H.toggleCityPicker = function () {
    const picker = document.getElementById('cityPicker');
    if (picker) picker.classList.toggle('open');
  };

  H.pickCity = function (c) {
    H.state.cityFilter = c;
    H.saveState();
    const picker = document.getElementById('cityPicker');
    if (picker) picker.classList.remove('open');
    H.renderPage('Home');
  };

  

})(window.H);

;/* === www/js/browse.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { escHtml, filterListings, renderListCard, CATEGORIES } = H;

  const I = (window.H && H.ICONS) || {};
  const S = {
    microphone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    filter: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
  };

  let browseState = {
    showFilters: false,
    priceMin: 0,
    priceMax: 1000000,
    selectedCategory: null,
    condition: 'all',
    sortBy: 'recent',
    currency: 'all',
    lastSearch: ''
  };

  function renderListingsWithSponsored(filteredList) {
    if (!filteredList.length) return '';
    const now = Date.now();
    const sponsored = (H.state.listings || []).filter(l =>
      l.status === 'active' && l.boost && l.boost.until > now
    );
    if (!sponsored.length) return filteredList.map(renderListCard).join('');
    const shownIds = new Set(filteredList.map(l => l.id));
    const pool = sponsored.filter(l => !shownIds.has(l.id));
    if (!pool.length) return filteredList.map(renderListCard).join('');
    const parts = [];
    let pi = 0;
    filteredList.forEach((l, i) => {
      parts.push(renderListCard(l));
      if ((i + 1) % 5 === 0) {
        const s = pool[pi % pool.length];
        pi++;
        parts.push(`<div style="position:relative">${renderListCard(s)}<span style="position:absolute;top:10px;left:10px;background:#1A3A8F;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:8px;pointer-events:none;z-index:1">SPONSORED</span></div>`);
      }
    });
    return parts.join('');
  }

  pages.Browse = function () {
    const activeListings = (state.listings || []).filter(l => l.status === 'active');
    const u = H.currentUser();
    const recentSearches = (u && u.recentSearches) || [];

    return `<div class="page active">
      <div class="app-header" style="padding-bottom:16px">
        <div class="app-header-row" style="margin-bottom:10px">
          <div class="logo">Browse <em>All</em></div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,.6);padding:4px 10px;background:rgba(255,255,255,.1);border-radius:20px">
            ${activeListings.length} ads
          </div>
        </div>
        <div class="search-box">
          <span aria-hidden="true">${S.search}</span>
          <input id="searchIn" placeholder="Search all listings…" oninput="H._browse.onSearch()">
          <button class="voice-btn" onclick="H._browse.voiceSearch()" title="Voice search">${S.microphone}</button>
        </div>
      </div>

      <div class="browse-controls">
        <button class="filter-btn" onclick="H._browse.toggleFilters()">
          ${S.filter} Filters
        </button>
        <select class="sort-sel" id="sortBy" onchange="H._browse.onSortChange()">
          <option value="recent">Latest</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="trending">Trending</option>
        </select>
      </div>

      ${recentSearches.length > 0 ? `
        <div class="recent-searches">
          <div class="section-title">Recent Searches</div>
          <div class="search-tags">
            ${recentSearches.slice(0, 5).map(s => `
              <button class="search-tag" onclick="H._browse.searchTag('${H.escHtml(s)}')">
                <span>${H.escHtml(s)}</span>
                <span onclick="H._browse.removeSearch('${H.escHtml(s)}'); event.stopPropagation()">${S.close}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="browse-filters-wrap" id="filterPanel">
        <div class="filter-section">
          <div class="filter-title">Categories</div>
          <div class="filter-options">
            ${CATEGORIES.map(c => `
              <label class="filter-checkbox">
                <input type="checkbox" value="${c.id}" onchange="H._browse.onFilterChange()">
                <span>${c.icon || ''} ${c.name}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">Price Range</div>
          <div class="price-inputs">
            <input type="number" class="price-input" id="priceMin" placeholder="Min" value="0">
            <span>to</span>
            <input type="number" class="price-input" id="priceMax" placeholder="Max" value="1000000">
          </div>
          <div class="currency-toggle">
            <button onclick="H._browse.setCurrency('all', event)" class="cur-opt ${browseState.currency === 'all' ? 'active' : ''}">All</button>
            <button onclick="H._browse.setCurrency('USD', event)" class="cur-opt ${browseState.currency === 'USD' ? 'active' : ''}">USD</button>
            <button onclick="H._browse.setCurrency('ZiG', event)" class="cur-opt ${browseState.currency === 'ZiG' ? 'active' : ''}">ZiG</button>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">Condition</div>
          <div class="filter-options">
            <label class="filter-radio"><input type="radio" name="condition" value="all" onchange="H._browse.onFilterChange()" checked><span>Any</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="new" onchange="H._browse.onFilterChange()"><span>New</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="like-new" onchange="H._browse.onFilterChange()"><span>Like New</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="used" onchange="H._browse.onFilterChange()"><span>Used</span></label>
            <label class="filter-radio"><input type="radio" name="condition" value="refurbished" onchange="H._browse.onFilterChange()"><span>Refurbished</span></label>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">Other</div>
          <label class="filter-checkbox"><input type="checkbox" id="verifiedOnly" onchange="H._browse.onFilterChange()"><span>Verified Sellers Only</span></label>
          <label class="filter-checkbox"><input type="checkbox" id="boostedOnly" onchange="H._browse.onFilterChange()"><span>Premium Ads Only</span></label>
        </div>

        <div class="filter-actions">
          <button class="btn-pri" onclick="H._browse.applyFilters()">Apply Filters</button>
          <button class="btn-sec" onclick="H._browse.resetFilters()">Reset</button>
        </div>
      </div>

      <div class="sec-head"><div class="sec-title">Results</div></div>
      <div class="listing-list" id="listingList">
        ${activeListings.length
          ? renderListingsWithSponsored(filterListings(activeListings, ''))
          : H.skeletonCards(6)}
      </div>
    </div>`;
  };

  pages.Browse_after = function () {
    if (typeof H.fetchListingsFromSupabase === 'function') {
      H.fetchListingsFromSupabase().then(() => {
        const el = document.getElementById('listingList');
        if (!el || H.currentPageName !== 'Browse') return;
        const q = document.getElementById('searchIn')?.value || '';
        const active = (state.listings || []).filter(l => l.status === 'active');
        el.innerHTML = active.length
          ? renderListingsWithSponsored(filterListings(active, q))
          : H.emptyState('No listings yet', 'Listings will appear here once people start posting', null, null);
      }).catch(() => {
        const el = document.getElementById('listingList');
        if (el && !el.querySelector('.list-card-wrap')) {
          el.innerHTML = H.errorState('Could not load listings', 'Check your connection and pull down to retry.', "H.renderPage('Browse')");
        }
      });
    }
    H._browse = {
      toggleFilters: () => {
        const panel = document.getElementById('filterPanel');
        if (panel) panel.classList.toggle('open');
      },
      _searchTimer: null,
      onSearch: () => {
        clearTimeout(H._browse._searchTimer);
        H._browse._searchTimer = setTimeout(() => {
          const q = document.getElementById('searchIn')?.value || '';
          browseState.lastSearch = q;
          const activeListings = (state.listings || []).filter(l => l.status === 'active');
          const filtered = filterListings(activeListings, q);
          const el = document.getElementById('listingList');
          if (el) el.innerHTML = filtered.length
            ? renderListingsWithSponsored(filtered)
            : H.emptyState('No matches', 'Try a different search term', null, null);
          if (q.trim()) {
            const u = H.currentUser();
            if (u) {
              if (!u.recentSearches) u.recentSearches = [];
              u.recentSearches = [q, ...u.recentSearches.filter(s => s !== q)].slice(0, 10);
              H.saveState();
            }
          }
        }, 250);
      },
      searchTag: (term) => {
        const inp = document.getElementById('searchIn');
        if (inp) { inp.value = term; H._browse.onSearch(); }
      },
      removeSearch: (term) => {
        const u = H.currentUser();
        if (u) {
          u.recentSearches = (u.recentSearches || []).filter(s => s !== term);
          H.saveState();
          H.renderPage('Browse');
        }
      },
      voiceSearch: () => { H.toast('Voice search is not available on this device'); },
      saveSearch: () => {
        const q = document.getElementById('searchIn')?.value?.trim() || '';
        const u = H.currentUser();
        if (!u) { H.requireAuth('Sign in to save searches'); return; }
        if (!q && !browseState.selectedCategory) { H.toast('Type something to save as a search'); return; }
        state.savedSearches = state.savedSearches || {};
        state.savedSearches[u.id] = state.savedSearches[u.id] || [];
        const already = state.savedSearches[u.id].some(s => s.query === q && s.cat === browseState.selectedCategory);
        if (already) { H.toast('Search already saved'); return; }
        const newId = H.uid();
        state.savedSearches[u.id].unshift({ id: newId, query: q, cat: browseState.selectedCategory, savedAt: Date.now() });
        state.savedSearches[u.id] = state.savedSearches[u.id].slice(0, 10);
        H.saveState();
        var _sb = window.supabase;
        if (_sb && typeof _sb.from === 'function') {
          _sb.from('saved_searches').insert({
            user_id: u.id, query: q || null,
            category: browseState.selectedCategory || null
          }).then(function(res) { if (res && res.error) console.warn('Saved search sync failed:', res.error.message); });
        }
        H.toast('Search saved — we\'ll notify you of new matches');
      },
      removeSavedSearch: (id) => {
        const u = H.currentUser(); if (!u) return;
        state.savedSearches = state.savedSearches || {};
        state.savedSearches[u.id] = (state.savedSearches[u.id] || []).filter(s => s.id !== id);
        H.saveState();
        H.renderPage('Browse');
      },
      onFilterChange: () => {},
      onSortChange: () => {
        const sortVal = document.getElementById('sortBy')?.value;
        browseState.sortBy = sortVal;
        H._browse.onSearch();
      },
      setCurrency: (cur, ev) => {
        browseState.currency = cur;
        if (ev && ev.target) {
          document.querySelectorAll('.cur-opt').forEach(b => b.classList.remove('active'));
          ev.target.classList.add('active');
        }
      },
      applyFilters: () => { H._browse.toggleFilters(); H._browse.onSearch(); },
      resetFilters: () => {
        browseState = { showFilters:false, priceMin:0, priceMax:1000000, selectedCategory:null, condition:'all', sortBy:'recent', currency:'all', lastSearch:'' };
        document.querySelectorAll('.filter-checkbox input, .filter-radio input').forEach(input => { input.checked = false; });
        document.querySelectorAll('input[name="condition"]').forEach(input => { if (input.value === 'all') input.checked = true; });
        document.querySelectorAll('.cur-opt').forEach(b => b.classList.remove('active'));
        const defaultCurBtn = document.querySelector('.cur-opt.all') || document.querySelector('[onclick*="\'all\'"]');
        if (defaultCurBtn) defaultCurBtn.classList.add('active');
        H._browse.onSearch();
      }
    };

    if (browseState.lastSearch) {
      const inp = document.getElementById('searchIn');
      if (inp) { inp.value = browseState.lastSearch; H._browse.onSearch(); }
    }
  };

})(window.H);

;/* === www/js/post.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  
  const { CATEGORIES, PROVINCES, CITIES_BY_PROV } = H;

  let postState = {};

  pages.Post = function () {
    if (!H.currentUser()) {
      return `<div class="page active">${H.innerTopbar('Post a Listing')}<div style="padding: 20px;">${H.emptyState('Sign In Required', 'Sign in to post listings and reach millions of buyers.', 'Sign In', "H.requireAuth('Sign in to post listings')")}</div></div>`;
    }
    postState = {
      step: 1, cat: null, title: '', desc: '', price: '',
      currency: 'USD', prov: PROVINCES[0],
      city: CITIES_BY_PROV[PROVINCES[0]][0], suburb: '', photos: []
    };
    return renderPostShell();
  };

  function renderPostShell() {
    return `<div class="page active">
      <div class="post-header">
        <div class="post-h">Post a Free Ad</div>
        <div class="post-sub-txt">Reach buyers across Zimbabwe in minutes</div>
      </div>
      <div class="steps-bar" id="stepsBar">
        ${[1, 2, 3, 4].map(n => `<div class="sdot ${n < postState.step ? 'done' : n === postState.step ? 'cur' : ''}"></div>`).join('')}
      </div>
      <div class="form-wrap" id="postBody">${renderPostStep()}</div>
    </div>`;
  }

  function renderPostStep() {
    const s = postState;
    if (s.step === 1) return `
      <div class="fg">
        <div class="fl">Category</div>
        <div class="cat-3">
          ${CATEGORIES.map(c => `
            <div class="cat-opt ${s.cat === c.id ? 'sel' : ''}" onclick="H._post.setCat('${c.id}')">
              <div style="font-size:22px">${c.icon}</div>
              <div class="cat-opt-label">${c.name}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="fg"><div class="fl">Title</div>
        <input class="fi" id="postTitle" value="${H.escHtml(s.title)}" placeholder="e.g. 3 Bedroom Flat in Avondale" maxlength="80">
      </div>
      <div class="fg"><div class="fl">Description</div>
        <textarea class="fi" rows="4" id="postDesc" placeholder="Describe what you're selling · condition, features, why you're selling..." maxlength="2000">${H.escHtml(s.desc)}</textarea>
      </div>
      <div class="step-btns"><button class="btn-next" onclick="H._post.next()">Continue →</button></div>`;

    if (s.step === 2) return `
      <div class="fg"><div class="fl">Price</div>
        ${H.state.freeOnly
          ? `<div class="fi" style="color:var(--sub);cursor:default;background:var(--bg2)">Free / Negotiable (set by platform)</div><input type="hidden" id="priceInput" value="0">`
          : `<div class="price-row">
              <input class="fi" style="flex:1" type="number" placeholder="0" id="priceInput" value="${H.escHtml(s.price)}" min="0">
              <div class="cur-toggle">
                <button class="cur ${s.currency === 'USD' ? 'on' : ''}" onclick="H._post.setCur('USD')">USD</button>
                <button class="cur ${s.currency === 'ZiG' ? 'on' : ''}" onclick="H._post.setCur('ZiG')">ZiG</button>
              </div>
            </div>`
        }
      </div>
      <div class="fg"><div class="fl">Province</div>
        <select class="fi" id="provinceSel" onchange="H._post.onProv(this.value)">
          ${PROVINCES.map(p => `<option ${s.prov === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><div class="fl">City / Town</div>
        <select class="fi" id="citySel">
          ${(CITIES_BY_PROV[s.prov] || []).map(c => `<option ${s.city === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><div class="fl">Suburb / Area (optional)</div>
        <input class="fi" id="suburbIn" value="${H.escHtml(s.suburb)}" placeholder="e.g. Avondale West">
      </div>
      <div class="step-btns">
        <button class="btn-prev" onclick="H._post.prev()">← Back</button>
        <button class="btn-next" onclick="H._post.next()">Continue →</button>
      </div>`;

    if (s.step === 3) return `
      <div class="fg">
        <div class="fl">Photos <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--sub2)">(up to 8 · first is the cover)</span></div>
        ${H.state.allowImageUploads === false
          ? `<div style="padding:18px;background:var(--bg2);border-radius:12px;text-align:center;color:var(--sub);font-size:13px;border:1px dashed var(--border)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Photo uploads are currently disabled by the admin.</div>`
          : `<label class="img-upload-zone" for="photoFile">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <div class="img-upload-title">Tap to add photos</div>
              <div class="img-upload-sub">JPG, PNG · Max 8 photos · auto-compressed</div>
            </label>
            <input type="file" id="photoFile" accept="image/*" multiple capture="environment" style="display:none" onchange="H._post.onPhotos(event)">
            <div class="photo-grid" id="photoGrid">${renderPhotoGrid()}</div>`
        }
      </div>
      <div class="tip-box">
        <div class="tip-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Photos sell 3× faster</div>
        <div class="tip-body">Listings with 5+ clear photos in good lighting get 3× more enquiries.</div>
      </div>
      <div class="step-btns">
        <button class="btn-prev" onclick="H._post.prev()">← Back</button>
        <button class="btn-next" onclick="H._post.next()">Preview →</button>
      </div>`;

    if (s.step === 4) return `
      <div class="preview-card">
        <div class="preview-label"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Ad Preview</div>
        <div class="preview-title">${H.escHtml(s.title || 'Untitled')}</div>
        <div class="preview-price">${H.escHtml(H.fmtPrice(s.price, s.currency))}</div>
        <div class="preview-meta"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${H.escHtml(s.suburb || s.city)}, ${H.escHtml(s.prov)} · ${(CATEGORIES.find(c => c.id === s.cat) || {}).name || 'Other'} · ${s.photos.length} photo${s.photos.length === 1 ? '' : 's'}</div>
      </div>
      <div class="tip-box">
        <div class="tip-title"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Listing Rules</div>
        <div class="tip-body">By posting you confirm this item is legal, you own it, and the photos are real. Scam listings result in account suspension.</div>
      </div>
      <div class="step-btns">
        <button class="btn-prev" onclick="H._post.prev()">← Back</button>
        <button class="btn-submit" onclick="H._post.submit()">Post Ad →</button>
      </div>`;
  }

  function renderPhotoGrid() {
    return postState.photos.map((p, i) =>
      `<div class="photo-thumb"><img src="${p}"><button class="rm" onclick="H._post.removePhoto(${i})">×</button></div>`
    ).join('');
  }

  function refreshBody() {
    document.getElementById('postBody').innerHTML = renderPostStep();
  }

  function refreshSteps() {
    const bar = document.getElementById('stepsBar');
    if (bar) bar.innerHTML = [1, 2, 3, 4].map(n =>
      `<div class="sdot ${n < postState.step ? 'done' : n === postState.step ? 'cur' : ''}"></div>`).join('');
  }

  // Namespace for onclick calls
  H._post = {
    setCat(c)    { if(c==='jobs'){H.openInner('PostJob');return;} postState.cat = c; refreshBody(); },
    setCur(c)    { postState.currency = c; refreshBody(); },
    onProv(p)    { postState.prov = p; postState.city = CITIES_BY_PROV[p][0]; refreshBody(); },
    removePhoto(i) { postState.photos.splice(i, 1); document.getElementById('photoGrid').innerHTML = renderPhotoGrid(); },
    onPhotos(e)  {
      if (H._post._compressing) return;
      const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp'];
      const MAX_BYTES = 5 * 1024 * 1024;
      const files = Array.from(e.target.files || []);
      const remaining = 8 - postState.photos.length;
      let rejected = 0;
      const valid = [];
      files.slice(0, remaining).forEach(f => {
        if (!ALLOWED.includes(f.type)) { rejected++; return; }
        if (f.size > MAX_BYTES) { rejected++; return; }
        valid.push(f);
      });
      if (rejected) H.toast(rejected + ' photo(s) skipped — use JPG/PNG under 5 MB', 4000, true);
      e.target.value = '';
      if (!valid.length) return;

      // Show loading state
      H._post._compressing = true;
      const zone = document.querySelector('.img-upload-zone');
      const zoneTitle = zone && zone.querySelector('.img-upload-title');
      const origTitle = zoneTitle ? zoneTitle.textContent : null;
      if (zone) zone.style.pointerEvents = 'none';
      if (zoneTitle) zoneTitle.textContent = 'Processing…';

      Promise.all(valid.map(f => H.compressImage(f, 1200, 0.78))).then(results => {
        results.forEach(d => postState.photos.push(d));
        document.getElementById('photoGrid').innerHTML = renderPhotoGrid();
      }).finally(() => {
        H._post._compressing = false;
        if (zone) zone.style.pointerEvents = '';
        if (zoneTitle && origTitle !== null) zoneTitle.textContent = origTitle;
      });
    },
    next() {
      const s = postState;
      if (s.step === 1) {
        s.title = document.getElementById('postTitle').value.trim();
        s.desc  = document.getElementById('postDesc').value.trim();
        if (!s.cat)               { H.toast('Pick a category'); return; }
        if (s.title.length < 5)   { H.toast('Title needs at least 5 characters'); return; }
        if (s.desc.length < 10)   { H.toast('Description needs at least 10 characters'); return; }
      } else if (s.step === 2) {
        s.price  = document.getElementById('priceInput').value;
        s.prov   = document.getElementById('provinceSel').value;
        s.city   = document.getElementById('citySel').value;
        s.suburb = document.getElementById('suburbIn').value.trim();
        if (!H.state.freeOnly && (!s.price || Number(s.price) <= 0)) { H.toast('Enter a valid price'); return; }
        if (H.state.freeOnly) s.price = '0';
      } else if (s.step === 3) {
        if (H.state.allowImageUploads !== false && !s.photos.length) { H.toast('Add at least one photo'); return; }
      }
      s.step++;
      refreshSteps();
      refreshBody();
    },
    prev() {
      if (postState.step > 1) { postState.step--; refreshSteps(); refreshBody(); }
    },
    submit() {
      if (H.checkBan && H.checkBan()) return;
      const s = postState;

      // Re-validate all required fields before posting
      if (!s.title || !s.title.trim()) { H.toast('Please add a title for your listing'); return; }
      if (!H.state.freeOnly && (s.price === '' || s.price === null || s.price === undefined || isNaN(Number(s.price)) || Number(s.price) < 0)) { H.toast('Please enter a valid price'); return; }
      if (!s.cat) { H.toast('Please select a category'); return; }
      if (!s.desc || !s.desc.trim()) { H.toast('Please add a description'); return; }
      if (H.state.allowImageUploads !== false && !s.photos.length) { H.toast('Please add at least one photo'); return; }

      const u = H.currentUser();
      const needsApproval = !!(H.state.requireListingApproval && !(H.state.autoApproveVerified && u.verified));
      const l = {
        id: H.uid(), sellerId: u.id, sellerName: u.name || '', sellerPhone: u.phone || '', title: s.title, desc: s.desc,
        price: s.price, currency: s.currency, cat: s.cat,
        prov: s.prov, city: s.city, suburb: s.suburb,
        photos: s.photos, createdAt: Date.now(),
        status: needsApproval ? 'pending' : 'active',
        boost: null, views: 0
      };
      H.state.listings.unshift(l);
      H.saveState();
      if (typeof H.saveListingToCloud === "function") H.saveListingToCloud(l);
      if (needsApproval) {
        H.toast('Ad submitted! It will go live after admin review.', 5000);
        H.openInner('MyListings');
      } else {
        H.toast('Your ad is live!');
        H.navTo('Home', document.querySelector('[data-nav="Home"]'));
      }
    }
  };

  H.compressImage = function compressImage(file, maxDim = 1200, q = 0.8) {
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
          res(c.toDataURL('image/jpeg', q));
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(file);
    });
  }

})(window.H);

;/* === www/js/detail.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  const S = {
    crossCircle: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    location:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    eye:         '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    boost:       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    message:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    phone:       '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    flag:        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    heart:       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    heartFill:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="#1A3A8F" stroke="#1A3A8F" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    user:        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    wa:          '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 0C5.364 0 0 5.372 0 11.994c0 2.116.554 4.1 1.524 5.822L.057 24l6.304-1.654A11.978 11.978 0 0 0 11.99 24C18.626 24 24 18.628 24 12.006 24 5.372 18.626 0 11.99 0zm.01 21.818a9.886 9.886 0 0 1-5.031-1.375l-.361-.214-3.741.981.999-3.648-.235-.374A9.82 9.82 0 0 1 2.18 12c0-5.418 4.412-9.824 9.82-9.824 5.418 0 9.824 4.406 9.824 9.824 0 5.418-4.406 9.818-9.824 9.818z"/></svg>',
  };

  function getSeller(l) {
    const found = (H.state.users||[]).find(u => u.id === l.sellerId);
    if (found) return found;
    return {
      id:       l.sellerId   || '',
      name:     l.sellerName || 'Seller',
      phone:    l.sellerPhone|| '',
      verified: false,
      joinedAt: l.createdAt  || Date.now(),
      avatar:   null
    };
  }

  pages.Detail = function ({ id }) {
    const l = (H.state.listings||[]).find(x => x.id === id);
    if (!l) return `<div class="page active">${H.innerTopbar('Listing')}<div class="empty-state"><div class="empty-icon">${S.crossCircle}</div><div class="empty-title">Listing not found</div></div></div>`;

    const seller      = getSeller(l);
    const u           = H.currentUser();
    const saved       = u ? (H.state.saves[u.id]||[]).includes(id) : false;
    const isMine      = u && u.id && seller.id && seller.id === u.id;
    const photos      = l.photos && l.photos.length ? l.photos : [];
    const boosted     = l.boost && l.boost.until > Date.now();
    const sellerPhone = seller.phone || l.sellerPhone || '';
    const sellerName  = seller.name  || l.sellerName  || 'Seller';

    // Increment view count once per render, but not for the seller's own listing
    if (!isMine) {
      l.views = (l.views || 0) + 1;
      H.saveState();
    }

    return `<div class="page active">
      <div class="det-topbar">
        <button class="back" onclick="H.goBack()">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="det-topbar-title">${H.escHtml(l.title)}</div>
        <button class="share-btn" onclick="H.shareListing('${l.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button class="fav-btn ${saved?'saved':''}" onclick="H.toggleSave('${l.id}')">
          ${saved ? S.heartFill : S.heart}
        </button>
      </div>

      <div class="det-photo" id="dPhoto">
        ${photos.length
          ? `<img src="${photos[0]}" id="dPhotoImg" data-photos="${H.escHtml(JSON.stringify(photos))}" onclick="H.openPhotoViewer(JSON.parse(this.dataset.photos),0)" style="cursor:zoom-in">`
          : `<div class="ph">${H.categoryIcon(l.cat)}</div>`}
        ${photos.length > 1 ? `
          <div class="photo-dots">${photos.map((_,i)=>`<div class="pdot ${i===0?'on':''}" onclick="H.setPhoto('${l.id}',${i})"></div>`).join('')}</div>
          <div style="position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,0.5);color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600" id="photoCount">1 / ${photos.length}</div>
        ` : ''}
        ${boosted ? `<div style="position:absolute;top:12px;left:12px;background:#F5A623;color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700">Featured</div>` : ''}
      </div>

      <div class="det-content">
        <div class="det-price-row">
          <div class="det-price">${H.escHtml(H.fmtPrice(l.price, l.currency))}</div>
          ${l.negotiable ? '<div class="nego-pill">Negotiable</div>' : ''}
        </div>
        <div class="det-listing-title">${H.escHtml(l.title)}</div>
        <div class="det-loc-row">${S.location} ${H.escHtml((l.suburb||l.city||'')+(l.prov?', '+l.prov:''))} · ${H.timeAgo(l.createdAt)} · ${S.eye} ${l.views||0} views</div>

        <div class="seller-card" onclick="H.openUserProfile('${seller.id}')">
          <div style="position:relative;flex-shrink:0">
            <div class="seller-av" style="background:#1A3A8F;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center">
              ${seller.avatar
                ? `<img src="${seller.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
                : H.initials(sellerName)}
            </div>
            ${(seller.privacySettings && seller.privacySettings.showActivity) ? `<div style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid var(--card,#fff)"></div>` : ''}
          </div>
          <div class="seller-info">
            <div class="seller-name-row">
              <div class="seller-name">${H.escHtml(sellerName)}</div>
              ${seller.verified ? `<div class="blue-check" style="width:16px;height:16px"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
            </div>
            <div class="seller-phone" style="color:var(--sub);font-size:13px">${H.escHtml(sellerPhone)||'No phone listed'}</div>
            <div class="seller-meta">Member since ${new Date(seller.joinedAt||Date.now()).toLocaleDateString()}${seller.verified?' · ID Verified':''}</div>
          </div>
          <div style="color:var(--sub);font-size:20px">›</div>
        </div>

        <div class="desc-text" style="white-space:pre-line">${H.escHtml(l.desc||'No description provided.')}</div>

        <div id="similarListingsPlaceholder" class="similar-loading" style="height:120px;background:var(--card);border-radius:14px;margin:16px 0;opacity:.5;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--sub)">Loading similar listings...</div>

        ${isMine ? `
          <button class="btn-pri" onclick="H.openBoostPage('${l.id}')" style="margin-bottom:8px">${S.boost} Boost this Listing</button>
          <button style="width:100%;padding:13px;background:#fee2e2;color:#dc2626;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif" onclick="if(!confirm('Are you sure you want to delete this listing?')) return; H.deleteListing('${l.id}')">Delete Listing</button>
        ` : (function(){
          const cm = l.contactMethod || 'chat';
          const waBtn   = `<button class="wa-btn" onclick="H.openWA('${l.id}')">${S.wa} Chat on WhatsApp</button>`;
          const sellerPrivacy = seller.privacySettings || {};
          const msgDisabled = sellerPrivacy.allowMessages === false;
          const chatBtn = msgDisabled
            ? `<button class="msg-btn" disabled style="opacity:0.5;cursor:not-allowed">${S.message} Messaging turned off</button>`
            : `<button class="msg-btn" onclick="H.startChatWith('${seller.id}','${l.id}')">${S.message} Message in App</button>`;
          const callBtn = sellerPhone ? `<button class="call-btn" onclick="H.callSeller('${sellerPhone}')">${S.phone} Call ${H.escHtml(sellerPhone)}</button>` : '';
          const rptBtn  = `<button class="report-btn" onclick="H.reportListing('${l.id}')">${S.flag} Report this Listing</button>`;

          const shareLink = 'https://princechakusa.github.io/PaMarket/?listing=' + encodeURIComponent(l.id);
          const shareText = encodeURIComponent('Check out this listing on PaMarket:\n*' + l.title + '*\n\u{1F4B0} ' + H.fmtPrice(l.price, l.currency) + '\n\n' + shareLink);
          const shareWaBtn = `<button onclick="window.open('https://wa.me/?text=${shareText}','_blank')" style="width:100%;padding:13px;background:transparent;color:var(--text);border:1.5px solid var(--border);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share via WhatsApp</button>`;

          const cu = H.currentUser();
          let rateSection = '';
          if (cu && cu.id !== seller.id) {
            const ratings = H.state.ratings && H.state.ratings[seller.id] ? H.state.ratings[seller.id] : [];
            const myRating = ratings.find(r => r.userId === cu.id);
            let avgLine = '';
            if (ratings.length) {
              const avg = (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1);
              avgLine = `<div style="font-size:12px;color:var(--sub);margin-bottom:8px">${avg} avg from ${ratings.length} rating${ratings.length===1?'':'s'}</div>`;
            }
            const stars = [1,2,3,4,5].map(n => {
              const filled = myRating && myRating.rating >= n;
              return `<span onclick="H._rateSeller('${seller.id}',${n},'${l.id}')" style="font-size:28px;cursor:pointer;color:${filled?'#F5A623':'var(--border)'};line-height:1">${filled?'&#9733;':'&#9734;'}</span>`;
            }).join('');
            rateSection = `<div style="margin-top:16px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px"><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">Rate this Seller</div>${avgLine}<div style="display:flex;gap:4px;align-items:center">${stars}</div>${myRating?`<div style="font-size:12px;color:var(--sub);margin-top:6px">Your rating: ${myRating.rating}/5</div>`:''}</div>`;
          }

          let buttons = '';
          if (cm === 'phone') buttons = callBtn + waBtn + chatBtn + rptBtn;
          else buttons = chatBtn + waBtn + callBtn + rptBtn;
          return buttons + shareWaBtn + rateSection;
        })()}
      </div>
    </div>`;
  };

  H.pages.Detail_after = function(params) {
    H._initSwipe();

    H._rateSeller = function(sellerId, rating, listingId) {
      const u = H.currentUser();
      if (!u) { H.toast('Sign in to rate sellers'); return; }
      if (!H.state.ratings) H.state.ratings = {};
      if (!H.state.ratings[sellerId]) H.state.ratings[sellerId] = [];
      H.state.ratings[sellerId] = H.state.ratings[sellerId].filter(r => r.userId !== u.id);
      H.state.ratings[sellerId].push({ userId: u.id, rating: rating, at: Date.now() });
      H.saveState();
      H.toast('Thanks for your rating!');
      H.openInner('Detail', { id: listingId || params.id });
    };

    const l = H.state.listings.find(x => x.id === params.id);
    const placeholder = document.getElementById('similarListingsPlaceholder');
    if (!l) { if (placeholder) placeholder.remove(); return; }
    const similar = (H.state.listings||[]).filter(x => x.id!==l.id && x.cat===l.cat && x.status==='active').slice(0,4);
    if (!similar.length) { if (placeholder) placeholder.remove(); return; }
    const sec = document.createElement('div');
    sec.innerHTML = '<div class="sec-head" style="margin-top:24px"><div class="sec-title">Similar Listings</div></div><div class="listing-list">'+similar.map(H.renderListCard).join('')+'</div>';
    if (placeholder) {
      placeholder.replaceWith(sec);
    } else {
      const det = document.querySelector('.det-content');
      if (det) det.appendChild(sec);
    }
  };

  H._initSwipe = function() {
    const el = document.getElementById('dPhoto'); if (!el) return;
    let sx = 0;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive:true});
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) < 40) return;
      const dots = document.querySelectorAll('.pdot');
      if (!dots.length) return;
      const cur  = Array.from(dots).findIndex(d => d.classList.contains('on'));
      const next = dx < 0 ? Math.min(cur+1, dots.length-1) : Math.max(cur-1, 0);
      const m = el.querySelector('[onclick*="setPhoto"]');
      if (m) { const match = m.getAttribute('onclick').match(/'([^']+)'/); if (match) H.setPhoto(match[1], next); }
    }, {passive:true});
  };

  H.setPhoto = function(id, i) {
    const l = H.state.listings.find(x => x.id === id);
    if (!l || !l.photos[i]) return;
    const img = document.getElementById('dPhotoImg');
    if (img) img.src = l.photos[i];
    document.querySelectorAll('.pdot').forEach((d,j) => d.classList.toggle('on', j===i));
    const cnt = document.getElementById('photoCount');
    if (cnt) cnt.textContent = (i+1)+' / '+l.photos.length;
  };

  H.shareListing = function(id) {
    const l = H.state.listings.find(x => x.id === id); if (!l) return;
    const text = l.title+' · '+H.fmtPrice(l.price, l.currency)+' on PaMarket Zimbabwe';
    if (navigator.share) navigator.share({title:l.title, text, url:location.href}).catch(()=>{});
    else { if (navigator.clipboard) navigator.clipboard.writeText(text+' '+location.href); H.toast('Link copied'); }
  };

  H.toggleSave = function(id) {
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to save listings'); return; }
    H.state.saves[u.id] = H.state.saves[u.id] || [];
    const i = H.state.saves[u.id].indexOf(id);
    const removing = i >= 0;
    if (removing) { H.state.saves[u.id].splice(i,1); H.toast('Removed from saved'); }
    else {
      H.state.saves[u.id].push(id);
      H.toast('Saved');
      // Track price at save time for price-drop alerts
      if (!H.state.savedPrices) H.state.savedPrices = {};
      var listing = (H.state.listings || []).find(function(l) { return l.id === id; });
      if (listing) H.state.savedPrices[id] = listing.price;
    }
    H.saveState();
    var _sb = window.supabase;
    if (_sb && typeof _sb.from === 'function') {
      if (removing) {
        _sb.from('user_saves').delete().eq('user_id', u.id).eq('listing_id', id)
          .then(function(res) { if (res && res.error) console.warn('Save sync failed:', res.error.message); });
      } else {
        _sb.from('user_saves').upsert({ user_id: u.id, listing_id: id, saved_at: new Date().toISOString() })
          .then(function(res) { if (res && res.error) console.warn('Save sync failed:', res.error.message); });
      }
    }
    H.renderPage('Detail', {id});
  };

  H.deleteListing = function(id) {
    H.modal({
      title:'Delete this listing?', body:'This cannot be undone.', confirmText:'Delete', danger:true,
      onConfirm: async () => {
        var sc = window.supabase;
        if (sc && typeof sc.from === 'function') {
          try {
            var res = await sc.from('listings').delete().eq('id', id).select();
            if (res && res.error) {
              H.toast('Could not delete: ' + (res.error.message || 'permission denied'));
              return;
            }
            if (!res.data || res.data.length === 0) {
              H.toast('Could not delete — please try again');
              return;
            }
          } catch (e) {
            H.toast('Network error — try again');
            return;
          }
        }
        H.state.listings = (H.state.listings || []).filter(l => l.id !== id);
        H.saveState();
        H.toast('Listing deleted');
        H.goBack();
      }
    });
  };

  H.openWA = function(id) {
    const l = H.state.listings.find(x => x.id === id); if (!l) return;
    const seller = getSeller(l);
    const phone  = (seller.phone||l.sellerPhone||'').replace(/[^\d+]/g,'');
    if (!phone) { H.toast('No WhatsApp number available'); return; }
    const txt = encodeURIComponent('Hi! I saw your "'+l.title+'" listing on PaMarket Zimbabwe. Is it still available?');
    window.open('https://wa.me/'+phone.replace('+','')+'?text='+txt, '_blank');
  };

  H.callSeller = function(phone) {
    if (!phone || phone.trim()==='') { H.toast('No phone number available'); return; }
    const clean = phone.replace(/\s+/g,'');
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      location.href = 'tel:'+clean;
    } else {
      if (navigator.clipboard) navigator.clipboard.writeText(clean);
      H.toast('Number copied: '+clean);
    }
  };

  H.startChatWith = function(sellerId, listingId) {
    if (!H.currentUser()) { H.requireAuth('Sign in to message sellers'); return; }
    const u = H.currentUser();
    if (!sellerId || sellerId === u.id) { H.toast('You cannot message yourself'); return; }
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    const ids = [u.id, sellerId].sort();
    const convId = 'conv_' + ids[0].slice(-6) + '_' + ids[1].slice(-6) + '_' + (listingId || '').slice(-6);
    let conv = H.state.conversations.find(c => c.id === convId);
    if (!conv) {
      conv = { id: convId, members: [u.id, sellerId], listingId: listingId || null, messages: [] };
      H.state.conversations.push(conv);
      H.saveState();
      if (typeof H.ensureConversationInCloud === 'function') H.ensureConversationInCloud(conv);
    }
    H.openInner('Chat', { id: convId });
  };

  H.reportListing = function(id) {
    if (!H.currentUser()) { H.requireAuth('Sign in to report'); return; }
    const reasons = ['Scam or fraud','Counterfeit or fake item','Wrong category','Prohibited item','Offensive content','Duplicate listing','Other'];
    H.modal({
      title:'Report this listing',
      body:`<select class="fi" id="reportReason" style="width:100%;margin-bottom:8px">${reasons.map(r=>`<option>${r}</option>`).join('')}</select>
            <textarea class="fi" id="reportNote" rows="3" placeholder="Tell us more (optional)" style="width:100%;margin-top:4px"></textarea>`,
      confirmText:'Submit Report',
      onConfirm:() => {
        const reason = document.getElementById('reportReason')?.value||'';
        const note   = document.getElementById('reportNote')?.value||'';
        H.state.reports = H.state.reports||[];
        H.state.reports.push({id:H.uid(), reporterId:H.currentUser().id, targetType:'listing', targetId:id, reason:reason+(note?' - '+note:''), t:Date.now(), status:'open'});
        H.saveState();
        var _sb = window.supabase;
        if (_sb) _sb.from('reports').insert({target_type:'listing', target_id:id, reason:reason+(note?' - '+note:''), reporter_id:String(H.currentUser().id), status:'open'}).then(function(r){ if(r&&r.error) console.warn('report save:',r.error.message); });
        H.toast('Report submitted. Thank you.');
      }
    });
  };

  H.reportUser = function(id) {
    if (!H.currentUser()) { H.requireAuth('Sign in to report'); return; }
    const reasons = ['Scammer or fraudster','Harassment','Spam','Fake account','Impersonation','Other'];
    H.modal({
      title:'Report this user',
      body:`<select class="fi" id="reportReason" style="width:100%;margin-bottom:8px">${reasons.map(r=>`<option>${r}</option>`).join('')}</select>
            <textarea class="fi" id="reportNote" rows="3" placeholder="More details (optional)" style="width:100%;margin-top:4px"></textarea>`,
      confirmText:'Submit Report',
      onConfirm:() => {
        const reason = document.getElementById('reportReason')?.value||'';
        const note   = document.getElementById('reportNote')?.value||'';
        H.state.reports = H.state.reports||[];
        H.state.reports.push({id:H.uid(), reporterId:H.currentUser().id, targetType:'user', targetId:id, reason:reason+(note?' - '+note:''), t:Date.now(), status:'open'});
        H.saveState();
        var _sb = window.supabase;
        if (_sb) _sb.from('reports').insert({target_type:'user', target_id:id, reason:reason+(note?' - '+note:''), reporter_id:String(H.currentUser().id), status:'open'}).then(function(r){ if(r&&r.error) console.warn('report save:',r.error.message); });
        H.toast('Report submitted');
      }
    });
  };

  H.openBoostPage = function(listingId) { H.openInner('Boost', {listingId}); };

  function pvHTML(photos, idx) {
    var dots = '';
    if (photos.length > 1) {
      dots = '<div style="position:absolute;bottom:calc(env(safe-area-inset-bottom,0px)+22px);left:0;right:0;display:flex;gap:8px;justify-content:center;z-index:2">';
      for (var di = 0; di < photos.length; di++) {
        dots += '<div data-dot="'+di+'" onclick="H._pvGoTo('+di+')" style="width:8px;height:8px;border-radius:50%;background:'+(di===idx?'#fff':'rgba(255,255,255,.35)')+';cursor:pointer;transition:background .2s"></div>';
      }
      dots += '</div>';
    }
    return '<div style="position:absolute;top:0;left:0;right:0;padding:calc(env(safe-area-inset-top,0px)+14px) 16px 14px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(rgba(0,0,0,.65),transparent);z-index:2">'
      + '<span id="pvCounter" style="color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.6)">'+(idx+1)+' / '+photos.length+'</span>'
      + '<button ontouchstart="event.stopPropagation()" ontouchend="event.stopPropagation();H.closePhotoViewer()" onclick="H.closePhotoViewer()" style="background:rgba(0,0,0,.45);border:none;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '</button></div>'
      + '<img id="pvImg" src="'+photos[idx]+'" style="position:absolute;top:50%;left:50%;max-width:100%;max-height:100%;object-fit:contain;will-change:transform;pointer-events:none;-webkit-user-drag:none;user-select:none" draggable="false">'
      + dots;
  }

  function pvApply() {
    var pv = H._pv; if (!pv) return;
    var img = document.getElementById('pvImg'); if (!img) return;
    img.style.transform = 'translate(calc(-50% + '+pv.tx+'px), calc(-50% + '+pv.ty+'px)) scale('+pv.scale+')';
  }

  function pvClamp() {
    var pv = H._pv; if (!pv) return;
    if (pv.scale <= 1) { pv.tx = 0; pv.ty = 0; return; }
    var img = document.getElementById('pvImg'); if (!img) return;
    var ox = Math.max(0, img.offsetWidth  * pv.scale - window.innerWidth);
    var oy = Math.max(0, img.offsetHeight * pv.scale - window.innerHeight);
    pv.tx = Math.min(ox/2, Math.max(-ox/2, pv.tx));
    pv.ty = Math.min(oy/2, Math.max(-oy/2, pv.ty));
  }

  function pvDist(a, b) {
    var dx = b.clientX-a.clientX, dy = b.clientY-a.clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }

  function pvTS(e) {
    e.preventDefault();
    var pv = H._pv; if (!pv) return;
    var ts = e.touches;
    pv.moved = false;
    if (ts.length === 1) {
      pv.x0 = ts[0].clientX; pv.y0 = ts[0].clientY;
      pv.txAtStart = pv.tx; pv.tyAtStart = pv.ty;
      pv.pinch = false;
      var now = Date.now();
      if (now - pv.lastTap < 300) { pvDoubleTap(ts[0].clientX, ts[0].clientY); pv.lastTap = 0; }
      else pv.lastTap = now;
    } else if (ts.length >= 2) {
      pv.pinch = true;
      pv.pinchDist0 = pvDist(ts[0], ts[1]);
      pv.scaleAtPinch = pv.scale;
      pv.x0 = (ts[0].clientX+ts[1].clientX)/2;
      pv.y0 = (ts[0].clientY+ts[1].clientY)/2;
      pv.txAtStart = pv.tx; pv.tyAtStart = pv.ty;
    }
  }

  function pvTM(e) {
    e.preventDefault();
    var pv = H._pv; if (!pv) return;
    var ts = e.touches;
    if (ts.length === 1 && !pv.pinch) {
      var dx = ts[0].clientX - pv.x0;
      var dy = ts[0].clientY - pv.y0;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) pv.moved = true;
      if (pv.scale > 1) {
        pv.tx = pv.txAtStart + dx;
        pv.ty = pv.tyAtStart + dy;
        pvClamp(); pvApply();
      }
    } else if (ts.length >= 2) {
      var dist = pvDist(ts[0], ts[1]);
      pv.scale = Math.min(4, Math.max(1, pv.scaleAtPinch * (dist / pv.pinchDist0)));
      var mx = (ts[0].clientX+ts[1].clientX)/2;
      var my = (ts[0].clientY+ts[1].clientY)/2;
      pv.tx = pv.txAtStart + (mx - pv.x0);
      pv.ty = pv.tyAtStart + (my - pv.y0);
      pv.moved = true;
      pvClamp(); pvApply();
    }
  }

  function pvTE(e) {
    var pv = H._pv; if (!pv) return;
    if (e.touches.length === 0) {
      if (!pv.pinch && pv.scale <= 1 && pv.moved) {
        var dx = e.changedTouches[0].clientX - pv.x0;
        var dy = e.changedTouches[0].clientY - pv.y0;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) pvNavDir(dx < 0 ? 1 : -1);
      }
      if (pv.scale < 1) { pv.scale = 1; pv.tx = 0; pv.ty = 0; pvApply(); }
      pv.pinch = false;
    } else if (e.touches.length === 1) {
      pv.pinch = false;
      pv.x0 = e.touches[0].clientX; pv.y0 = e.touches[0].clientY;
      pv.txAtStart = pv.tx; pv.tyAtStart = pv.ty;
    }
  }

  function pvDoubleTap(x, y) {
    var pv = H._pv; if (!pv) return;
    var img = document.getElementById('pvImg'); if (!img) return;
    img.style.transition = 'transform .25s ease';
    if (pv.scale > 1) {
      pv.scale = 1; pv.tx = 0; pv.ty = 0;
    } else {
      pv.scale = 2.5;
      pv.tx = (x - window.innerWidth/2)  * (1 - pv.scale);
      pv.ty = (y - window.innerHeight/2) * (1 - pv.scale);
      pvClamp();
    }
    pvApply();
    setTimeout(function(){ var i=document.getElementById('pvImg'); if(i) i.style.transition=''; }, 280);
  }

  function pvNavDir(dir) {
    var pv = H._pv; if (!pv) return;
    var ni = pv.idx + dir;
    if (ni < 0 || ni >= pv.photos.length) return;
    pv.idx = ni; pv.scale = 1; pv.tx = 0; pv.ty = 0;
    var img = document.getElementById('pvImg');
    if (img) {
      img.style.transition = 'opacity .1s';
      img.style.opacity = '0';
      setTimeout(function(){
        img.src = pv.photos[pv.idx];
        img.style.opacity = '1';
        setTimeout(function(){ img.style.transition = ''; }, 120);
      }, 80);
    }
    var cnt = document.getElementById('pvCounter');
    if (cnt) cnt.textContent = (pv.idx+1)+' / '+pv.photos.length;
    document.querySelectorAll('[data-dot]').forEach(function(d){
      d.style.background = parseInt(d.getAttribute('data-dot'))===pv.idx ? '#fff' : 'rgba(255,255,255,.35)';
    });
    pvApply();
  }

  H.openPhotoViewer = function(photos, startIdx) {
    if (!photos || !photos.length) return;
    var existing = document.getElementById('pvOverlay');
    if (existing) existing.remove();
    H._pv = { photos:photos, idx:startIdx||0, scale:1, tx:0, ty:0,
               pinch:false, x0:0, y0:0, txAtStart:0, tyAtStart:0,
               pinchDist0:0, scaleAtPinch:1, moved:false, lastTap:0 };
    var ov = document.createElement('div');
    ov.id = 'pvOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;overflow:hidden';
    ov.innerHTML = pvHTML(photos, H._pv.idx);
    document.body.appendChild(ov);
    ov.addEventListener('touchstart', pvTS, {passive:false});
    ov.addEventListener('touchmove',  pvTM, {passive:false});
    ov.addEventListener('touchend',   pvTE, {passive:false});
    H._pv.keyHandler = function(e) {
      if (!H._pv) return;
      if (e.key==='ArrowRight') pvNavDir(1);
      if (e.key==='ArrowLeft')  pvNavDir(-1);
      if (e.key==='Escape')     H.closePhotoViewer();
    };
    document.addEventListener('keydown', H._pv.keyHandler);
    pvApply();
  };

  H.closePhotoViewer = function() {
    var ov = document.getElementById('pvOverlay');
    if (ov) {
      ov.removeEventListener('touchstart', pvTS);
      ov.removeEventListener('touchmove',  pvTM);
      ov.removeEventListener('touchend',   pvTE);
      ov.remove();
    }
    if (H._pv && H._pv.keyHandler) document.removeEventListener('keydown', H._pv.keyHandler);
    H._pv = null;
  };

  H._pvNav   = pvNavDir;
  H._pvGoTo  = function(i) {
    var pv = H._pv; if (!pv) return;
    pv.idx = i; pv.scale = 1; pv.tx = 0; pv.ty = 0;
    var img = document.getElementById('pvImg');
    if (img) img.src = pv.photos[i];
    var cnt = document.getElementById('pvCounter');
    if (cnt) cnt.textContent = (i+1)+' / '+pv.photos.length;
    document.querySelectorAll('[data-dot]').forEach(function(d){
      d.style.background = parseInt(d.getAttribute('data-dot'))===i ? '#fff' : 'rgba(255,255,255,.35)';
    });
    pvApply();
  };

  H.openListing = window.openListing = function(id) {
    const l = (H.state.listings||[]).find(x => x.id === id); if (!l) return;
    if (l.cat === 'jobs') { l.views=(l.views||0)+1; H.saveState(); H.openInner('JobDetail',{id}); return; }
    H.openInner('Detail', {id});
  };

  H.openUserProfile = function(id) {
    if (!id) { H.toast('Profile not available'); return; }
    H.openInner('UserProfile', {id: String(id)});
  };

  H.pages.UserProfile = function(params) {
    const id = params && params.id ? String(params.id) : null;
    if (!id) return '<div class="page active">'+H.innerTopbar('User')+'<div class="empty-state"><div class="empty-title">User not found</div></div></div>';

    let u = (H.state.users||[]).find(x => String(x.id)===id);
    if (!u) {
      const listing = (H.state.listings||[]).find(l => String(l.sellerId)===id);
      if (listing) {
        u = {id, name:listing.sellerName||'Seller', phone:listing.sellerPhone||'', verified:false, joinedAt:listing.createdAt||Date.now(), avatar:null};
      } else {
        return '<div class="page active">'+H.innerTopbar('User')+'<div class="empty-state"><div class="empty-title">User not found</div></div></div>';
      }
    }

    const myListings = (H.state.listings||[]).filter(l => String(l.sellerId)===id && l.status==='active');
    const me   = H.currentUser();
    const isMe = !!(me && String(me.id)===id);

    // profilePublic check — only applies when viewing another user's profile
    const uPrivacy = u.privacySettings || {};
    if (!isMe && uPrivacy.profilePublic === false) {
      // Show a stripped-down private profile screen
      return `<div class="page active">
        <div class="det-topbar">
          <button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
          <div class="det-topbar-title">${H.escHtml(u.name)}</div>
          <div style="width:40px"></div>
        </div>
        <div class="prof-top" style="text-align:center;padding:32px 20px">
          <div class="prof-av" style="background:#1A3A8F;color:#fff;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : H.initials(u.name)}
          </div>
          <div class="prof-name">${H.escHtml(u.name)}</div>
          <div style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:7px 16px;background:rgba(255,255,255,0.12);border-radius:20px;border:1px solid rgba(255,255,255,0.25)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.85)">Private Profile</span>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:10px">This user has set their profile to private</div>
        </div>
      </div>`;
    }

    // showActivity dot for the profile avatar
    const showDot = uPrivacy.showActivity === true;

    return `<div class="page active">
      <div class="det-topbar">
        <button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="det-topbar-title">${H.escHtml(u.name)}</div>
        ${!isMe ? `<button class="share-btn" onclick="H.reportUser('${u.id}')" title="Report user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="4" y1="22" x2="4" y2="15"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg>
        </button>` : '<div style="width:40px"></div>'}
      </div>

      <div class="prof-top">
        <div style="position:relative;display:inline-block;margin-bottom:0">
          <div class="prof-av" style="background:#1A3A8F;color:#fff;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : H.initials(u.name)}
          </div>
          ${showDot ? `<div style="position:absolute;bottom:3px;right:3px;width:13px;height:13px;border-radius:50%;background:#22c55e;border:2.5px solid #1A3A8F"></div>` : ''}
        </div>
        <div class="prof-name">${H.escHtml(u.name)}</div>
        ${showDot ? `<div style="font-size:11px;color:#86efac;font-weight:600;display:flex;align-items:center;gap:4px;justify-content:center;margin-top:4px"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e"></span>Online</div>` : ''}
        ${u.phone ? `<div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">${H.escHtml(u.phone)}</div>` : ''}
        ${u.verified ? `<div class="prof-badges"><span class="pbadge pbadge-verified">ID Verified</span></div>` : ''}
        <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:8px">Member since ${new Date(u.joinedAt||Date.now()).toLocaleDateString()}</div>
        ${!isMe && me ? `<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          ${(uPrivacy.allowMessages === false)
            ? `<button disabled style="flex:1;min-width:90px;padding:10px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);border:1.5px solid rgba(255,255,255,0.15);border-radius:10px;font-size:13px;font-weight:700;cursor:not-allowed;font-family:Inter,sans-serif">Messaging turned off</button>`
            : `<button onclick="H.startChatWith('${u.id}','')" style="flex:1;min-width:90px;padding:10px;background:rgba(255,255,255,0.15);color:#fff;border:1.5px solid rgba(255,255,255,0.3);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Message</button>`}
          ${u.phone ? `<button onclick="H.callSeller('${H.escHtml(u.phone)}')" style="flex:1;min-width:80px;padding:10px;background:rgba(255,255,255,0.15);color:#fff;border:1.5px solid rgba(255,255,255,0.3);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Call</button>` : ''}
          <button onclick="H.leaveReview('${u.id}')" style="flex:1;min-width:100px;padding:10px;background:rgba(245,166,35,0.25);color:#F5A623;border:1.5px solid rgba(245,166,35,0.4);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">★ Review</button>
        </div>` : ''}
      </div>

      <div class="sec-head">
        <div class="sec-title">${myListings.length} active listing${myListings.length===1?'':'s'}</div>
        ${!isMe ? `<button onclick="H.openInner('Reviews',{id:'${u.id}'})" style="background:none;border:none;color:#1A3A8F;font-size:12px;font-weight:700;cursor:pointer;padding:0">See Reviews →</button>` : ''}
      </div>
      <div class="listing-list">
        ${myListings.length ? myListings.map(H.renderListCard).join('') : H.emptyState('No listings','This seller has no active listings',null,null)}
      </div>
    </div>`;
  };

  H.pages.SellerProfile = H.pages.UserProfile;

})(window.H);

;/* === www/js/messages.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { currentUser, escHtml, timeAgo, uid, toast, modal,
          innerTopbar, emptyState, openInner, goBack, renderPage,
          initials, pushNotif, fmtPrice, ICONS } = H;

  function conversations() {
    if (!Array.isArray(H.state.conversations)) {
      H.state.conversations = [];
      H.saveState();
    }
    const deleted = H.state.deletedConvIds || [];
    return deleted.length
      ? H.state.conversations.filter(function (c) { return !deleted.includes(c.id); })
      : H.state.conversations;
  }

  function users() {
    if (!Array.isArray(H.state.users)) H.state.users = [];
    return H.state.users;
  }

  // Fetch a single user profile from Supabase and cache it, then re-render the current page.
  // Prevents repeated network calls using a per-session pending map.
  H._pendingProfileFetch = H._pendingProfileFetch || {};
  H._resolveOtherName = function(otherId, conv) {
    if (!otherId || H._pendingProfileFetch[otherId]) return;
    H._pendingProfileFetch[otherId] = true;
    var sb = window.supabase;
    if (!sb || typeof sb.from !== 'function') return;
    sb.from('profiles')
      .select('id,name,phone,email,avatar,verified,role,status,created_at')
      .eq('id', otherId)
      .single()
      .then(function(res) {
        var p = res && res.data;
        var nameResolved = '';
        if (p) {
          var existing = (H.state.users||[]).find(function(x){ return x.id === p.id; });
          if (existing) {
            if (p.name && !existing.name) { existing.name = p.name; }
            if (p.avatar && !existing.avatar) { existing.avatar = p.avatar; }
            nameResolved = existing.name;
          } else {
            var entry = {
              id: p.id, name: p.name||'', phone: p.phone||'', email: p.email||'',
              avatar: p.avatar||null, verified: !!p.verified, role: p.role||'user',
              status: p.status||'active',
              joinedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now()
            };
            (H.state.users = H.state.users||[]).push(entry);
            nameResolved = entry.name;
          }
        }
        // If profiles table gave no name, fall back to message sender_name
        if (!nameResolved && conv && Array.isArray(conv.messages)) {
          var msgWithName = conv.messages.find(function(m){ return m.from === otherId && m.senderName; });
          if (msgWithName) { nameResolved = msgWithName.senderName; }
          var userEntry = (H.state.users||[]).find(function(x){ return x.id === otherId; });
          if (nameResolved) {
            if (userEntry) { userEntry.name = nameResolved; }
            else { (H.state.users = H.state.users||[]).push({ id: otherId, name: nameResolved, phone: '', email: '', avatar: null, verified: false, role: 'user', status: 'active', joinedAt: Date.now() }); }
          }
        }
        if (nameResolved && conv && !conv.otherName) { conv.otherName = nameResolved; }
        if (nameResolved) {
          H.saveState();
          var page = H.currentPageName;
          if (page === 'Messages' || page === 'Chat') { H.renderPage(page); }
        }
      })
      .catch(function() {});
  };

  function conversationSignature() {
    const u = currentUser();
    if (!u) return '';
    return conversations()
      .filter(c => Array.isArray(c.members) && c.members.includes(u.id))
      .map(c => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        const last = msgs[msgs.length - 1] || {};
        const unread = msgs.filter(m => m.from !== u.id && !m.read).length;
        const otherId = Array.isArray(c.members) ? c.members.find(m => m !== u.id) : '';
        const other = otherId ? users().find(x => x.id === otherId) : null;
        return [c.id, msgs.length, last.id || '', last.t || 0, unread, (other && other.name) || '', (other && other.avatar) || ''].join(':');
      })
      .sort()
      .join('|');
  }

  function otherAvatarFor(c, u) {
    const otherId = c && Array.isArray(c.members) ? c.members.find(m => m !== u.id) : null;
    const other = otherId ? users().find(x => x.id === otherId) : null;
    const ini = other ? initials(other.name || 'Deleted User') : '?';
    const initialsDiv = '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + ini + '</div>';
    return (other && other.avatar)
      ? '<img src="' + escHtml(other.avatar) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'flex\')">'
        + '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + ini + '</div>'
      : initialsDiv;
  }

  function appendThemMessage(thread, avatarHtml, m) {
    if (!thread || !m || thread.querySelector('[data-msg-id="' + escHtml(m.id) + '"]')) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('data-msg-id', m.id);
    wrap.style.cssText = 'display:flex;align-items:flex-end;gap:6px';
    const avaEl = document.createElement('div');
    avaEl.style.cssText = 'width:28px;height:28px;flex-shrink:0';
    avaEl.innerHTML = avatarHtml;
    const div = document.createElement('div');
    div.className = 'chat-bubble them';
    div.innerHTML = escHtml(m.text) + '<div style="font-size:10px;opacity:.6;margin-top:3px">' + timeAgo(m.t) + '</div>';
    wrap.appendChild(avaEl);
    wrap.appendChild(div);
    thread.appendChild(wrap);
  }

  // ---------------------------------------------------
  // MESSAGES LIST
  // ---------------------------------------------------
  pages.Messages = function () {
    const u = currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Messages')}
        <div style="padding:20px">${H.emptyState('Sign in required', 'Sign in to view and send messages.', 'Sign In', "H.requireAuth('Sign in to view messages')")}</div>
      </div>`;
    }
    const convos = conversations()
      .filter(c => Array.isArray(c.members) && c.members.includes(u.id) && Array.isArray(c.messages) && c.messages.length)
      .sort((a, b) => {
        const am = (a.messages || [])[( a.messages || []).length - 1] || {};
        const bm = (b.messages || [])[(b.messages || []).length - 1] || {};
        return (bm.t || 0) - (am.t || 0);
      });

    const totalUnread = convos.reduce((sum, c) => sum + (c.messages || []).filter(m => m.from !== u.id && !m.read).length, 0);
    return `<div class="page active">${H.innerTopbar('Messages')}
      <div style="padding:10px 14px;font-size:12px;color:var(--sub);display:flex;align-items:center;justify-content:space-between">${convos.length} conversation${convos.length === 1 ? '' : 's'}${totalUnread > 0 ? '<button onclick="H._markAllRead()" style="background:none;border:none;font-size:12px;font-weight:600;color:#1A3A8F;cursor:pointer;padding:4px 8px;font-family:Inter,sans-serif">Mark all read</button>' : ''}</div>
      <div>
        ${convos.length ? convos.map(c => {
          const otherId = c.members.find(m => m !== u.id);
          // Backfill c.otherName from any message senderName we have
          if (!c.otherName) {
            const sn = ((c.messages || []).find(function(m){ return m.from===otherId && m.senderName; })||{}).senderName;
            if (sn) { c.otherName = sn; H.saveState(); }
          }
          const other   = otherId ? users().find(x => x.id === otherId) : null;
          // If name is still blank, trigger async profile fetch which will re-render when resolved
          if (other && !other.name && otherId) { H._resolveOtherName(otherId, c); }
          else if (!other && otherId && !(c.otherName)) { H._resolveOtherName(otherId, c); }
          const otherDisplayName = (other && other.name) || c.otherName || 'Deleted User';
          const last    = (c.messages || [])[( c.messages || []).length - 1];
          const unread  = (c.messages || []).some(m => m.from !== u.id && !m.read);
          return `<div class="swipe-del-row" style="position:relative;overflow:hidden;background:#ef4444"><div style="position:absolute;right:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;pointer-events:none"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span style="font-size:10px;font-weight:700;color:#fff">Delete</span></div><div class="msg-item" data-cid="${escHtml(c.id)}" onclick="H.openChat('${c.id}')">
            <div class="msg-av">${initials(otherDisplayName)}</div>
            <div class="msg-body">
              <div class="msg-name-row">
                <div class="msg-name">${escHtml(otherDisplayName)}</div>
                <div class="msg-time">${timeAgo(last.t)}</div>
              </div>
              <div class="msg-preview">${last.from === u.id ? 'You: ' : ''}${escHtml(last.text)}</div>
            </div>
            ${unread ? '<div class="msg-unread-dot"></div>' : ''}
          </div></div>`;
        }).join('') : H.emptyState('No messages yet', 'When buyers message you about a listing, it will show up here.', null, null)}
      </div>
    </div>`;
  };

  
  pages.Chat = function ({ id }) {
    const c = conversations().find(x => x.id === id);
    if (!c) return '<div class="page active">' + H.innerTopbar('Chat') + '<div class="empty-state"><div class="empty-title">Conversation not found</div></div></div>';
    const u = currentUser();
    if (!u) {
      return `<div class="page active">${H.innerTopbar('Chat')}
        <div style="padding:20px">${H.emptyState('Sign in required', 'Sign in to view and send messages.', 'Sign In', "H.requireAuth('Sign in to view messages')")}</div>
      </div>`;
    }
    if (!Array.isArray(c.members)) c.members = [];
    if (!Array.isArray(c.messages)) c.messages = [];
    const otherId = c.members.find(m => m !== u.id);
    // Backfill c.otherName from any message senderName we have
    if (!c.otherName) {
      const sn = ((c.messages || []).find(function(msg){ return msg.from===otherId && msg.senderName; })||{}).senderName;
      if (sn) { c.otherName = sn; H.saveState(); }
    }
    const other = otherId ? (users().find(x => x.id === otherId) || null) : null;
    // If name is still blank, trigger async profile fetch — will re-render when resolved
    if (other && !other.name && otherId) { H._resolveOtherName(otherId, c); }
    else if (!other && otherId && !c.otherName) { H._resolveOtherName(otherId, c); }
    const otherDisplayName = (other && other.name) || c.otherName || 'Deleted User';
    const listing = (state.listings || []).find(l => l.id === c.listingId);
    c.messages.forEach(m => { if (m.from !== u.id) m.read = true; });
    H.saveState();
    if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    H._activeChat = id;

    const otherIni = initials(otherDisplayName);
    const otherAvatarUrl = other && other.avatar;
    const otherAvatar = otherAvatarUrl
      ? '<img src="' + escHtml(otherAvatarUrl) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'flex\')">'
        + '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + otherIni + '</div>'
      : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#2952cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">' + otherIni + '</div>';

    const msgs = c.messages.map(function(m) {
      const mine = m.from === u.id;
      if (mine) {
        return '<div class="chat-bubble me" data-msg-id="' + escHtml(m.id) + '">'
          + escHtml(m.text)
          + '<div style="font-size:10px;opacity:.6;margin-top:3px;text-align:right">' + timeAgo(m.t) + '</div>'
          + '</div>';
      }
      return '<div data-msg-id="' + escHtml(m.id) + '" style="display:flex;align-items:flex-end;gap:6px">'
        + '<div style="width:28px;height:28px;flex-shrink:0">' + otherAvatar + '</div>'
        + '<div class="chat-bubble them">'
        + escHtml(m.text)
        + '<div style="font-size:10px;opacity:.6;margin-top:3px">' + timeAgo(m.t) + '</div>'
        + '</div></div>';
    }).join('');

    const otherPhone = other.phone || '';
    const otherIdSafe = escHtml(otherId || '');
    return '<div class="page active" style="display:flex;flex-direction:column;overflow:hidden;height:100%">'
      + '<div class="det-topbar" style="flex-shrink:0"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer" onclick="H._chat.showProfile(\'' + otherIdSafe + '\')">'
      + '<div style="width:34px;height:34px;flex-shrink:0">' + otherAvatar + '</div>'
      + '<div style="min-width:0"><div class="det-topbar-title" style="margin:0;text-align:left">' + escHtml(otherDisplayName) + '</div>'
      + (other.verified ? '<div style="font-size:10px;color:#22c55e;font-weight:600;display:flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Verified</div>' : ((other.privacySettings && other.privacySettings.showActivity) ? '<div style="font-size:10px;color:#22c55e;font-weight:600;display:flex;align-items:center;gap:3px"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0"></span>Online</div>' : '<div style="font-size:10px;color:rgba(255,255,255,.5)">Tap to view profile</div>')) + '</div>'
      + '</div>'
      + '<button onclick="H._chat.openMenu(\'' + otherIdSafe + '\')" style="padding:8px;background:none;border:none;color:#fff;cursor:pointer;flex-shrink:0;margin-left:4px"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
      + '</div>'
      + (listing ? '<div style="flex-shrink:0;padding:8px 14px;background:var(--card);border-bottom:1px solid var(--border);font-size:13px;color:var(--sub)">Re: ' + escHtml(listing.title) + '</div>' : '')
      + '<div class="chat-thread" id="chatThread" style="flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px"><div style="flex:1;min-height:0"></div>' + (msgs || '<div style="text-align:center;color:var(--sub);padding:40px 20px;font-size:14px">No messages yet. Say hello!</div>') + '</div>'
      + '<div class="chat-input-bar" style="flex-shrink:0">'
      + '<input id="chatIn" placeholder="Type a message..." onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();H.sendChat();}" style="flex:1">'
      + '<button class="chat-send" onclick="H.sendChat()"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
      + '</div></div>';
  };

  pages.Chat_after = function () {
    if (window._messagesPoll) { clearInterval(window._messagesPoll); window._messagesPoll = null; }
    const t = document.getElementById('chatThread');
    if (t) t.scrollTop = t.scrollHeight;
    // Lock #mainArea so iOS can't scroll it when the keyboard appears.
    // The keyboard would otherwise push mainArea upward, hiding the topbar with the user's name.
    const ma = document.getElementById('mainArea');
    if (ma) { ma.style.overflowY = 'hidden'; ma.scrollTop = 0; }
    setTimeout(() => document.getElementById('chatIn')?.focus(), 200);
    if (H.currentPageParams && H.currentPageParams.id) H.startChatPolling(H.currentPageParams.id);
  };


  H.openChat = function (id) { H.openInner('Chat', { id }); };

  H.startChatWith = function (otherId, listingId) {
    const u = currentUser();
    if (!u) { H.requireAuth('Sign in to message sellers'); return; }
    if (!otherId) { H.toast('Seller profile is not available yet'); return; }
    if (otherId === u.id) { H.toast('You cannot message yourself'); return; }
    // Check if the target user has turned off direct messages
    const targetUser = (H.state.users || []).find(function(x) { return x.id === otherId; });
    if (targetUser && targetUser.privacySettings && targetUser.privacySettings.allowMessages === false) {
      H.toast('This seller has turned off direct messages');
      return;
    }
    // Use deterministic ID so both users get same conversation
    const ids = [u.id, otherId].sort();
    const convId = 'conv_' + ids[0].slice(-6) + '_' + ids[1].slice(-6) + '_' + (listingId||'').slice(-6);
    // If this conv was previously deleted, un-delete it so new messages from this person show
    if (Array.isArray(H.state.deletedConvIds) && H.state.deletedConvIds.includes(convId)) {
      H.state.deletedConvIds = H.state.deletedConvIds.filter(function(id){ return id !== convId; });
    }
    // Resolve the other user's name for display before they reply
    const otherUser = (H.state.users||[]).find(function(x){ return x.id === otherId; });
    const listingObj = listingId ? (H.state.listings||[]).find(function(x){ return x.id === listingId; }) : null;
    const otherName = (otherUser && otherUser.name) || (listingObj && listingObj.sellerName) || '';
    let c = conversations().find(x => x.id === convId);
    if (!c) {
      c = { id: convId, members: [u.id, otherId], listingId: listingId||null, messages: [], otherName: otherName };
      if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
      H.state.conversations.push(c);
      H.saveState();
      if (typeof H.ensureConversationInCloud === 'function') H.ensureConversationInCloud(c);
    } else if (!c.otherName && otherName) {
      c.otherName = otherName;
      H.saveState();
    }
    H.openInner('Chat', { id: convId });
  };

  pages.Messages_after = function () {
    // Mark all received messages as read when the inbox is opened
    const _u = H.currentUser();
    if (_u) {
      let _dirty = false;
      (H.state.conversations || []).forEach(function(c) {
        if (!Array.isArray(c.members) || !c.members.includes(_u.id)) return;
        (c.messages || []).forEach(function(m) {
          if (m.from !== _u.id && !m.read) { m.read = true; _dirty = true; }
        });
      });
      if (_dirty) H.saveState();
      if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    }
    if (window._chatPoll) { clearInterval(window._chatPoll); window._chatPoll = null; }
    if (window._messagesPoll) clearInterval(window._messagesPoll);
    H._refreshMessagesPage();
    window._messagesPoll = setInterval(function () {
      if (H.currentPageName !== 'Messages') {
        clearInterval(window._messagesPoll);
        window._messagesPoll = null;
        return;
      }
      H._refreshMessagesPage();
    }, 5000);
    H._setupMsgSwipe();
  };

  H._refreshMessagesPage = function (opts) {
    opts = opts || {};
    if (H._syncingMessagesPage || !H.currentUser()) return Promise.resolve(false);
    if (opts.skipSync) {
      if (H.currentPageName === 'Messages') H.renderPage('Messages');
      return Promise.resolve(true);
    }
    if (typeof H.syncConversations !== 'function') return Promise.resolve(false);
    H._syncingMessagesPage = true;
    const before = conversationSignature();
    return H.syncConversations().then(function () {
      const after = conversationSignature();
      if (H.currentPageName === 'Messages' && after !== before) H.renderPage('Messages');
      return after !== before;
    }).finally(function () {
      H._syncingMessagesPage = false;
    });
  };

  H.startChatPolling = function(convId) {
    if (window._chatPoll) clearInterval(window._chatPoll);
    window._chatPoll = setInterval(async function() {
      if (H.currentPageName !== 'Chat' || H._activeChat !== convId) {
        clearInterval(window._chatPoll);
        return;
      }
      const conv = conversations().find(c => c.id === convId);
      const idsBefore = new Set(((conv && conv.messages) || []).map(m => m.id));
      if (typeof H.syncConversations === 'function') {
        await H.syncConversations();
      }
      const convAfter = conversations().find(c => c.id === convId);
      if (!convAfter) return;
      // Append only the new messages without a full page re-render
      const thread = document.getElementById('chatThread');
      if (!thread) return;
      const u = H.currentUser();
      if (!u) return;
      const ava2 = otherAvatarFor(convAfter, u);
      const newMsgs = (convAfter.messages || []).filter(m => !idsBefore.has(m.id));
      newMsgs.forEach(function(m) {
        if (m.from === u.id) return;
        m.read = true;
        appendThemMessage(thread, ava2, m);
      });
      thread.scrollTop = thread.scrollHeight;
      H.saveState();
      if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
    }, 4000);
  };

  H._appendChatMessages = function (convId, msgs) {
    if (H.currentPageName !== 'Chat' || !H.currentPageParams || H.currentPageParams.id !== convId) return false;
    const thread = document.getElementById('chatThread');
    const u = H.currentUser();
    const conv = conversations().find(c => c.id === convId);
    if (!thread || !u || !conv) return false;
    const ava = otherAvatarFor(conv, u);
    let appended = false;
    (msgs || []).forEach(function(m) {
      if (!m || m.from === u.id) return;
      m.read = true;
      appendThemMessage(thread, ava, m);
      appended = true;
    });
    if (appended) {
      thread.scrollTop = thread.scrollHeight;
      H.saveState();
    }
    return appended;
  };


  // syncConversations is defined in app.js (cloud-aware version)


  H.sendChat = async function () {
    if (H.checkBan && H.checkBan()) return;
    const inp = document.getElementById('chatIn');
    const text = inp ? inp.value.trim() : '';
    if (!text) return;
    const c = conversations().find(function(x){ return x.id === H._activeChat; });
    if (!c) return;
    const u = H.currentUser();
    var msgId = H.uid();
    var msgT = Date.now();
    c.messages.push({ id: msgId, from: u.id, senderName: u.name||'', text: text, t: msgT, read: false });
    H.saveState();
    inp.value = '';
    // Append to DOM directly — no full page re-render to avoid flicker
    const thread = document.getElementById('chatThread');
    if (thread) {
      const div = document.createElement('div');
      div.className = 'chat-bubble me';
      div.setAttribute('data-msg-id', msgId);
      div.innerHTML = escHtml(text) + '<div style="font-size:10px;opacity:.6;margin-top:3px">just now</div>';
      thread.appendChild(div);
      thread.scrollTop = thread.scrollHeight;
    }
    try {
      // Try to persist the conversation entry (non-fatal if table doesn't exist yet)
      if (typeof H.ensureConversationInCloud === 'function') {
        H.ensureConversationInCloud(c).catch(function(e){ console.warn('conv sync (non-fatal):', e.message); });
      }
      // Save the message — this is what matters
      var msgSaved = false;
      if (typeof H.saveMessageToCloud === 'function') {
        var cloudResult = await H.saveMessageToCloud(c.id, c.messages[c.messages.length - 1]);
        if (cloudResult && cloudResult.ok === false) throw new Error(cloudResult.error || 'Message sync failed');
        msgSaved = true;
      }
      if (!msgSaved && window.supabase && typeof window.supabase.from === 'function') {
        var r = await window.supabase.from('messages').insert({
          id: msgId, conversation_id: c.id,
          sender_id: u.id, sender_name: u.name || '',
          text: text, created_at: new Date(msgT).toISOString(), read: false
        });
        if (r && r.error) throw new Error(r.error.message);
      }
      var otherId = c.members.find(function(m){ return m !== u.id; });
      if (otherId && typeof H.pushNotif === 'function') H.pushNotif(otherId, 'New Message', (u.name || 'Someone') + ': ' + text.slice(0, 80), 'message');
    } catch(e) {
      console.warn('Msg cloud error:', e.message);
      H.toast('Message could not be sent. Check your connection and try again.', 5000, true);
    }
  };


  H._setupMsgSwipe = function () {
    document.querySelectorAll('.swipe-del-row').forEach(function (row) {
      var inner = row.querySelector('.msg-item');
      if (!inner) return;
      var convId = inner.dataset.cid;
      var startX = 0, startY = 0, dx = 0, hor = false, swiped = false;
      var THRESHOLD = 72;

      row.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        dx = 0; hor = false; swiped = false;
        inner.style.transition = 'none';
      }, { passive: true });

      row.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        var dxNow = t.clientX - startX;
        var dyNow = t.clientY - startY;
        if (!hor) {
          if (Math.abs(dxNow) > 8 && Math.abs(dxNow) > Math.abs(dyNow)) hor = true;
          else if (Math.abs(dyNow) > 8) return;
          else return;
        }
        dx = Math.min(0, dxNow);
        inner.style.transform = 'translateX(' + dx + 'px)';
        swiped = Math.abs(dx) > 10;
      }, { passive: true });

      row.addEventListener('touchend', function () {
        if (!hor) return;
        inner.style.transition = 'transform .22s ease';
        if (dx <= -THRESHOLD) {
          inner.style.transform = 'translateX(-110%)';
          setTimeout(function () { H._deleteConversation(convId); }, 240);
        } else {
          inner.style.transform = 'translateX(0)';
        }
        hor = false;
      });

      inner.addEventListener('click', function (e) {
        if (swiped) { e.preventDefault(); e.stopImmediatePropagation(); swiped = false; }
      }, true);
    });
  };

  H._deleteConversation = function (convId) {
    // Mark as deleted locally — do NOT delete from Supabase so the other party keeps their messages
    if (!Array.isArray(H.state.deletedConvIds)) H.state.deletedConvIds = [];
    if (!H.state.deletedConvIds.includes(convId)) H.state.deletedConvIds.push(convId);
    H.state.conversations = (H.state.conversations || []).filter(function (c) { return c.id !== convId; });
    H.saveState();
    if (H.currentPageName === 'Messages') H.renderPage('Messages');
  };

  // ── Chat menu: block, view profile, report ───────────────
  H._chat = {
    openMenu(userId) {
      const u = H.currentUser();
      const other = (H.state.users || []).find(x => x.id === userId);
      const name = other ? escHtml(other.name || 'User') : 'User';
      const isBlocked = ((H.currentUser() || {}).blockedUsers || []).includes(userId);
      H.modal({
        title: name,
        body: `<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">
          <button onclick="H.closeModal();setTimeout(()=>H._chat.showProfile('${escHtml(userId)}'),80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>View Profile &amp; Listings
          </button>
          <button onclick="H.closeModal();setTimeout(()=>H._chat.blockUser('${escHtml(userId)}'),80)" style="width:100%;padding:13px;background:${isBlocked?'var(--bg)':'#FEF2F2'};border:1px solid ${isBlocked?'var(--border)':'#FECACA'};border-radius:12px;font-size:15px;font-weight:600;color:${isBlocked?'var(--text)':'#DC2626'};cursor:pointer;font-family:inherit;text-align:left">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>${isBlocked ? 'Unblock User' : 'Block User'}
          </button>
          <button onclick="H.closeModal();setTimeout(()=>H._chat.reportUser('${escHtml(userId)}'),80)" style="width:100%;padding:13px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit;text-align:left">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:7px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Report
          </button>
        </div>`,
        confirmText: null,
        cancelText: 'Close',
      });
    },

    showProfile(userId) {
      const other = (H.state.users || []).find(x => x.id === userId);
      if (!other) { H.toast('Profile not available'); return; }
      const listings = (H.state.listings || []).filter(l => l.sellerId === userId && l.status === 'active');
      const ini = H.initials(other.name || 'U');
      const avatar = other.avatar
        ? `<img src="${escHtml(other.avatar)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:none;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${ini}</div>`
        : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${ini}</div>`;
      const listingCards = listings.slice(0, 4).map(l => {
        const ph = (l.photos && l.photos[0])
          ? `<img src="${escHtml(l.photos[0])}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0">`
          : `<div style="width:56px;height:56px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sub)"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>`;
        return `<div onclick="H.closeModal();setTimeout(()=>H.openListing('${l.id}'),80)" style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--bg);border-radius:10px;cursor:pointer">
          ${ph}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
            <div style="font-size:12px;color:var(--blue);font-weight:700">${escHtml(H.fmtPrice(l.price, l.currency))}</div>
          </div>
        </div>`;
      }).join('');
      H.modal({
        title: 'Profile',
        body: `<div style="text-align:center;padding:8px 0 16px">
          ${avatar}
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-top:10px">${escHtml(other.name || 'User')}</div>
          ${other.verified ? '<div style="font-size:12px;color:#22c55e;font-weight:600;margin-top:4px;display:flex;align-items:center;gap:4px;justify-content:center"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>ID Verified</div>' : ''}
          ${other.phone ? `<div style="font-size:13px;color:var(--sub);margin-top:4px;display:flex;align-items:center;gap:4px;justify-content:center"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.91-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${escHtml(other.phone)}</div>` : ''}
          ${other.joinedAt ? `<div style="font-size:12px;color:var(--sub);margin-top:3px">Member since ${new Date(other.joinedAt).toLocaleDateString()}</div>` : ''}
        </div>
        ${listings.length ? `<div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Active Listings (${listings.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px">${listingCards}</div>` : '<div style="text-align:center;color:var(--sub);font-size:13px;padding:12px 0">No active listings</div>'}
        ${other.phone ? `<div style="display:flex;gap:8px;margin-top:16px">
          <a href="tel:${escHtml(other.phone)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;background:#1A3A8F;color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.29 6.29l.91-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Call</a>
          <a href="https://wa.me/${escHtml(other.phone.replace(/\D/g,''))}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;background:#25D366;color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700">WhatsApp</a>
        </div>` : ''}`,
        confirmText: null,
        cancelText: 'Close',
      });
    },

    blockUser(userId) {
      const u = H.currentUser();
      if (!u) return;
      if (!Array.isArray(u.blockedUsers)) u.blockedUsers = [];
      const already = u.blockedUsers.includes(userId);
      if (already) {
        u.blockedUsers = u.blockedUsers.filter(id => id !== userId);
        H.saveState();
        H.toast('User unblocked');
      } else {
        u.blockedUsers.push(userId);
        H.saveState();
        H.toast('User blocked — you will no longer receive messages from them');
        H.goBack();
      }
    },

    reportUser(userId) {
      const other = (H.state.users || []).find(x => x.id === userId);
      if (!Array.isArray(H.state.reports)) H.state.reports = [];
      const u = H.currentUser();
      const rep = { id: H.uid(), reporterId: u.id, targetType: 'user', targetId: userId,
        reason: 'Reported from chat', t: Date.now(), status: 'open' };
      H.state.reports.push(rep);
      H.saveState();
      H.toast('Report submitted — our team will review within 24 hours');
      if (window.supabase && typeof window.supabase.from === 'function') {
        window.supabase.from('reports').insert({ id: rep.id, reporter_id: rep.reporterId,
          target_type: 'user', target_id: userId, reason: rep.reason,
          created_at: new Date(rep.t).toISOString(), status: 'open' }).catch(() => {});
      }
    },
  };

  H._markAllRead = function() {
    const u = H.currentUser();
    if (!u) return;
    (H.state.conversations || []).forEach(c => {
      if (Array.isArray(c.messages)) {
        c.messages.forEach(m => {
          if (m.from !== u.id) m.read = true;
        });
      }
    });
    H.saveState();
    H.updateMsgBadge && H.updateMsgBadge();
    H.openInner('Messages');
  };

})(window.H);

;/* === www/js/notifications.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const { escHtml, timeAgo, uid, toast } = H;
  const saveState = () => H.saveState();
  const pages = H.pages;

  function sb() {
    return (window.supabase && typeof window.supabase.from === 'function') ? window.supabase : null;
  }

  // ── Push helper (called from anywhere) ────────────────────
  H.pushNotif = function (uid_, title, body, type, imageUrl, deepLink) {
    H.state.notifs = H.state.notifs || {};
    H.state.notifs[uid_] = H.state.notifs[uid_] || [];
    const n = {
      id: uid(), t: Date.now(), read: false,
      title, body, type: type || _inferType(title),
      imageUrl: imageUrl || null,
      deepLink: deepLink || null
    };
    H.state.notifs[uid_].unshift(n);
    if (H.state.notifs[uid_].length > 100) H.state.notifs[uid_].length = 100;
    saveState();
    H._updateNotifBadge();

    // Persist to Supabase so the user gets it on other devices
    const c = sb();
    if (c) {
      c.from('notifications').insert({
        id: n.id, user_id: uid_, title: n.title, body: n.body,
        type: n.type, read: false, created_at: n.t,
        meta: { deepLink: deepLink || null, imageUrl: imageUrl || null }
      }).then(r => { if (r && r.error) console.warn('notif insert failed:', r.error.message); });
    }
  };

  H._updateNotifBadge = function () {
    const u = H.currentUser(); if (!u) return;
    const count = (H.state.notifs[u.id] || []).filter(n => !n.read).length;
    // Update the home header bell badge (rendered as span inside the bell div)
    document.querySelectorAll('[data-notif-badge]').forEach(b => {
      b.textContent = count > 9 ? '9+' : count;
      b.style.display = count ? '' : 'none';
    });
    // Legacy selectors
    const legacy = document.querySelector('[data-nav="Notifications"] .badge') || document.querySelector('.hdr-ic .badge');
    if (legacy) {
      legacy.textContent = count > 9 ? '9+' : count;
      legacy.style.display = count ? '' : 'none';
    }
  };

  // ── Hash-based change detection helpers ──────────────────
  function _notifHash(userId) {
    const list = (H.state.notifs && H.state.notifs[userId]) || [];
    return list.map(n => n.id + (n.read ? '1' : '0')).join(',');
  }

  let _notifRenderTimer = null;
  function _maybeRenderNotifs(userId) {
    if (H.currentPageName !== 'Notifications') return;
    const newHash = _notifHash(userId);
    if (newHash === H._lastNotifHash) return;
    H._lastNotifHash = newHash;
    if (_notifRenderTimer) clearTimeout(_notifRenderTimer);
    _notifRenderTimer = setTimeout(function () {
      _notifRenderTimer = null;
      if (H.currentPageName === 'Notifications') H.renderPage('Notifications');
    }, 300);
  }

  // ── Sync from Supabase ────────────────────────────────────
  H.syncNotifications = async function () {
    const c = sb(); if (!c) return;
    const u = H.currentUser(); if (!u) return;
    try {
      const res = await c.from('notifications')
        .select('*').eq('user_id', u.id)
        .order('created_at', { ascending: false }).limit(100);
      if (res.error || !res.data) return;
      H.state.notifs = H.state.notifs || {};
      const local = H.state.notifs[u.id] || [];
      const localIds = new Set(local.map(n => n.id));
      res.data.forEach(r => {
        const t = new Date(r.created_at).getTime();
        const existing = local.find(n => n.id === r.id);
        if (existing) {
          if (r.read && !existing.read) existing.read = true;
        } else if (!localIds.has(r.id)) {
          local.unshift({
            id: r.id, t, read: !!r.read,
            title: r.title || '', body: r.body || '',
            type: r.type || _inferType(r.title),
            imageUrl: (r.meta && r.meta.imageUrl) || r.image_url || null,
            deepLink: (r.meta && r.meta.deepLink) || r.deep_link || null
          });
        }
      });
      // Remove items deleted on server (or another device)
      const serverIds = new Set(res.data.map(r => r.id));
      const pruned = local.filter(n => serverIds.has(n.id));
      pruned.sort((a, b) => b.t - a.t);
      if (pruned.length > 100) pruned.length = 100;
      H.state.notifs[u.id] = pruned;
      saveState();
      H._updateNotifBadge();
      _maybeRenderNotifs(u.id);
    } catch (e) {
      console.warn('syncNotifications error:', e.message);
    }
  };

  // ── Real-time subscription ────────────────────────────────
  H._setupRealtimeNotifs = function () {
    const c = sb(); if (!c || typeof c.channel !== 'function') return;
    const u = H.currentUser(); if (!u) return;
    if (H._notifChannel) {
      try { c.removeChannel(H._notifChannel); } catch (e) {}
      H._notifChannel = null;
    }
    H._notifChannel = c.channel('notifications:' + u.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.' + u.id
      }, payload => {
        const r = payload.new; if (!r) return;
        H.state.notifs = H.state.notifs || {};
        const list = H.state.notifs[u.id] = H.state.notifs[u.id] || [];
        if (!list.some(n => n.id === r.id)) {
          list.unshift({
            id: r.id, t: new Date(r.created_at).getTime(),
            read: !!r.read, title: r.title || '', body: r.body || '',
            type: r.type || _inferType(r.title),
            imageUrl: (r.meta && r.meta.imageUrl) || r.image_url || null,
            deepLink: (r.meta && r.meta.deepLink) || r.deep_link || null
          });
          if (list.length > 100) list.length = 100;
          saveState();
          H._updateNotifBadge();
          _maybeRenderNotifs(u.id);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.' + u.id
      }, payload => {
        const oldId = payload.old && payload.old.id; if (!oldId) return;
        H.state.notifs = H.state.notifs || {};
        const list = H.state.notifs[u.id] = H.state.notifs[u.id] || [];
        const idx = list.findIndex(n => n.id === oldId);
        if (idx !== -1) {
          list.splice(idx, 1);
          saveState();
          H._updateNotifBadge();
          _maybeRenderNotifs(u.id);
        }
      })
      .subscribe();
  };

  // ── Mark single notification as read (cloud-aware) ────────
  H.markNotifRead = async function (notifId) {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    const n = list.find(x => x.id === notifId);
    if (!n || n.read) return;
    n.read = true;
    saveState();
    H._updateNotifBadge();
    const c = sb();
    if (c) {
      c.from('notifications').update({ read: true }).eq('id', notifId)
        .then(r => { if (r && r.error) console.warn('notif read update failed:', r.error.message); });
    }
  };

  // ── Mark all as read ──────────────────────────────────────
  H.markAllNotifsRead = async function () {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    const unreadIds = list.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) { toast('No unread notifications'); return; }
    list.forEach(n => { n.read = true; });
    saveState();
    H._updateNotifBadge();
    H.renderPage('Notifications');
    toast('Marked all as read');
    const c = sb();
    if (c) {
      c.from('notifications').update({ read: true }).eq('user_id', u.id).eq('read', false)
        .then(r => { if (r && r.error) console.warn('mark-all update failed:', r.error.message); });
    }
  };

  // ── Delete single notification ────────────────────────────
  H.deleteNotif = async function (notifId) {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    const idx = list.findIndex(n => n.id === notifId);
    if (idx === -1) return;
    list.splice(idx, 1);
    saveState();
    H._updateNotifBadge();
    H.renderPage('Notifications');
    const c = sb();
    if (c) {
      c.from('notifications').delete().eq('id', notifId)
        .then(r => { if (r && r.error) console.warn('notif delete failed:', r.error.message); });
    }
  };

  // ── Clear all notifications ───────────────────────────────
  H.clearAllNotifs = async function () {
    const u = H.currentUser(); if (!u) return;
    const list = H.state.notifs[u.id] || [];
    if (!list.length) { toast('No notifications to clear'); return; }
    const ids = list.map(n => n.id);
    H.state.notifs[u.id] = [];
    saveState();
    H._updateNotifBadge();
    H.renderPage('Notifications');
    toast('Cleared all notifications');
    const c = sb();
    if (c) {
      c.from('notifications').delete().eq('user_id', u.id).in('id', ids)
        .then(r => { if (r && r.error) console.warn('notif clear failed:', r.error.message); });
    }
  };

  // ── Pull-to-refresh handler hook ──────────────────────────
  H._refreshNotifications = async function () {
    // Force a re-render after pull-to-refresh by clearing the cached hash
    H._lastNotifHash = null;
    await H.syncNotifications();
    // If syncNotifications didn't trigger a re-render (no changes), force one
    if (H.currentPageName === 'Notifications') H.renderPage('Notifications');
  };

  // ── Type inference & visual mapping ───────────────────────
  function _inferType(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('boost') || t.includes('featured')) return 'boost';
    if (t.includes('verif')) return 'verify';
    if (t.includes('message') || t.includes('reply')) return 'message';
    if (t.includes('ban') || t.includes('suspend')) return 'ban';
    if (t.includes('report')) return 'report';
    if (t.includes('sold') || t.includes('paid') || t.includes('payment')) return 'sale';
    if (t.includes('review') || t.includes('appeal')) return 'review';
    return 'info';
  }

  function _notifIcon(type) {
    const s = 'width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round';
    const map = {
      boost:   `<svg viewBox="0 0 24 24" style="${s}"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      verify:  `<svg viewBox="0 0 24 24" style="${s}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
      message: `<svg viewBox="0 0 24 24" style="${s}"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      ban:     `<svg viewBox="0 0 24 24" style="${s}"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
      report:  `<svg viewBox="0 0 24 24" style="${s}"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
      sale:    `<svg viewBox="0 0 24 24" style="${s}"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      review:  `<svg viewBox="0 0 24 24" style="${s}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      info:    `<svg viewBox="0 0 24 24" style="${s}"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
    };
    return map[type] || map.info;
  }

  function _notifBg(type) {
    const map = {
      boost: 'rgba(245,166,35,.12)', verify: 'rgba(29,155,240,.12)',
      message: 'rgba(34,197,94,.12)', ban: 'rgba(255,59,48,.12)',
      report: 'rgba(255,149,0,.12)', sale: 'rgba(0,122,255,.12)',
      review: 'rgba(139,92,246,.12)', info: 'var(--bg2)'
    };
    return map[type] || 'var(--bg2)';
  }

  function _notifColor(type) {
    const map = {
      boost: '#F5A623', verify: '#1D9BF0', message: '#22C55E',
      ban: '#FF3B30', report: '#FF9500', sale: '#007AFF',
      review: '#8B5CF6', info: '#1A3A8F'
    };
    return map[type] || '#1A3A8F';
  }

  // ── Notification tap navigation ───────────────────────────
  H._notifNavigate = function (link, type) {
    // If there's a deep link, follow it
    if (link) {
      // In-app listing detail: URL contains ?id=xxx or &id=xxx
      const listingMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (listingMatch) {
        H.openInner('Detail', { id: listingMatch[1] });
        return;
      }
      // External URL — open in system browser
      if (link.startsWith('http')) {
        try {
          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
            window.Capacitor.Plugins.Browser.open({ url: link });
          } else {
            window.open(link, '_blank', 'noopener,noreferrer');
          }
        } catch (e) { window.open(link, '_blank', 'noopener,noreferrer'); }
        return;
      }
      // In-app named route like "Messages" or "detail?id=xxx"
      const routeMatch = link.match(/^(\w+)(?:\?(.*))?$/);
      if (routeMatch) {
        const page = routeMatch[1];
        const params = {};
        if (routeMatch[2]) new URLSearchParams(routeMatch[2]).forEach((v, k) => { params[k] = v; });
        if (Object.keys(params).length) H.openInner(page, params);
        else H.navTo(page);
        return;
      }
    }
    // No deep link — navigate based on notification type
    const t = type || '';
    if (t === 'message')                    { H.navTo('Messages'); return; }
    if (t === 'sale')                        { H.navTo('Account'); return; }
    if (t === 'boost' || t === 'verify' || t === 'review' || t === 'ban' || t === 'report') {
      H.navTo('Account'); return;
    }
    // info / system / unknown — go to Home so something always happens
    H.navTo('Home');
  };

  // ── Notifications page ────────────────────────────────────
  pages.Notifications = function () {
    const u = H.currentUser();
    if (!u) {
      return '<div class="page active">' + H.innerTopbar('Notifications')
        + H.emptyState('No notifications yet', 'Important updates and app notices will appear here. Log in to see account alerts.', 'Login to continue', "H.requireAuth('Login to continue')")
        + '</div>';
    }
    const list = (H.state.notifs[u.id] || []).slice().sort((a, b) => b.t - a.t);
    const unreadCount = list.filter(n => !n.read).length;

    const headerBar = `<div class="inner-topbar">
      <button class="back" onclick="H.goBack()" aria-label="Go back">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="inner-topbar-title">Notifications${unreadCount ? ` <span style="background:#F5A623;color:#1A3A8F;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:800;margin-left:6px">${unreadCount}</span>` : ''}</div>
      ${unreadCount ? '<button onclick="H.markAllNotifsRead()" style="background:none;border:none;color:#1A3A8F;font-size:13px;font-weight:600;cursor:pointer;padding:6px 10px">Mark all read</button>' : '<div style="width:34px"></div>'}
    </div>
    ${list.length ? `<div style="display:flex;justify-content:flex-end;padding:8px 16px;border-bottom:1px solid var(--border)">
      <button onclick="H.clearAllNotifs()" style="background:none;border:none;color:var(--sub);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;padding:4px 6px">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Clear all
      </button>
    </div>` : ''}`;

    return `<div class="page active">${headerBar}
      <div id="notifList" style="padding-bottom:90px">
        ${list.length ? list.map(n => {
          const type = n.type || _inferType(n.title);
          const color = _notifColor(type);
          const safeLink = n.deepLink ? escHtml(n.deepLink) : '';
          const tapAction = `H.markNotifRead('${n.id}');this.querySelector('[data-unread-dot]')?.remove();this.style.background='var(--card)';H._notifNavigate(${safeLink ? `'${safeLink}'` : 'null'},'${type}');`;
          const navHint = type === 'message' ? 'Open Messages ›'
            : type === 'sale' ? 'Open Account ›'
            : n.deepLink ? 'Tap to open ›'
            : type === 'info' || type === 'system' ? 'Tap to view ›'
            : 'Open ›';
          return `<div onclick="${tapAction}"
              style="background:${n.read ? 'var(--card)' : 'rgba(26,58,143,.04)'};border-bottom:1px solid var(--border);padding:14px 40px 14px 16px;display:flex;gap:12px;align-items:flex-start;cursor:pointer;position:relative">
            ${n.imageUrl
              ? `<img src="${escHtml(n.imageUrl)}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`
              : `<div style="width:38px;height:38px;border-radius:50%;background:${_notifBg(type)};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${color}">${_notifIcon(type)}</div>`
            }
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:${n.read ? '600' : '800'};color:var(--text);margin-bottom:3px;line-height:1.3">${escHtml(n.title || '')}</div>
              <div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:4px">${escHtml(n.body || '')}</div>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="font-size:11px;color:var(--sub2);font-weight:500">${timeAgo(n.t)}</div>
                <div style="font-size:11px;color:${color};font-weight:600">${navHint}</div>
              </div>
            </div>
            ${n.read ? '' : `<span data-unread-dot style="width:9px;height:9px;border-radius:50%;background:${color};margin-top:6px;flex-shrink:0"></span>`}
            <button onclick="event.stopPropagation();H.deleteNotif('${n.id}')" aria-label="Delete notification"
              style="position:absolute;top:50%;right:10px;transform:translateY(-50%);background:none;border:none;padding:6px;cursor:pointer;color:var(--sub);border-radius:6px;display:flex;align-items:center;justify-content:center;opacity:0.55">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>`;
        }).join('') : `<div style="text-align:center;padding:60px 20px">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--sub)" stroke-width="1.5" style="opacity:.4;margin-bottom:16px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">No notifications yet</div>
          <div style="font-size:13px;color:var(--sub)">You'll be notified about messages, saves, and activity on your listings.</div>
        </div>`}
      </div>

      <div class="menu-group-label">Notification Settings</div>
      <div class="menu-items" style="padding-bottom:90px">
        <div class="mi" onclick="H.openInner('NotifSettings')">
          <div class="mi-icon blue-ic">
            <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <div class="mi-label">Notification Preferences</div>
          <div class="mi-arrow">›</div>
        </div>
      </div>
    </div>`;
  };

  pages.Notifications_after = function () {
    if (!H.currentUser()) return;
    // Fix 1 & 3 — Mark all notifications as read when the page opens and clear the badge
    const u = H.currentUser();
    const list = (H.state.notifs && H.state.notifs[u.id]) || [];
    const hadUnread = list.some(n => !n.read);
    if (hadUnread) {
      list.forEach(n => { n.read = true; });
      saveState();
      H._updateNotifBadge();
      if (H.updateNotifBadge) H.updateNotifBadge();
    }
    // Sync from Supabase whenever the page is opened
    if (typeof H.syncNotifications === 'function') H.syncNotifications();
    // Make sure real-time subscription is alive
    if (typeof H._setupRealtimeNotifs === 'function') H._setupRealtimeNotifs();
  };

  // ── Notification settings ─────────────────────────────────
  pages.NotifSettings = function () {
    const u = H.currentUser();
    if (!u) {
      return '<div class="page active">' + H.innerTopbar('Notification Preferences')
        + H.emptyState('Sign in required', 'Sign in to manage notification preferences.', null, null)
        + '</div>';
    }
    u.settings = u.settings || {};

    const rows = [
      ['newEnq',    'New Enquiries',          'When someone messages you about a listing',         'message'],
      ['priceDrop', 'Price Drops',            'When a saved ad drops in price',                    'dollar'],
      ['boostExp',  'Boost Expiry Reminders', '2 days before your boost ends',                     'clock'],
      ['sec',       'Security Alerts',        'New sign-in or suspicious account activity',        'shield'],
      ['promo',     'Tips & Promotions',      'Selling tips, platform updates, discounts',         'star'],
      ['sms',       'SMS Alerts',             'Critical alerts via SMS (carrier rates may apply)', 'smartphone']
    ];

    const settingsIcon = (iconKey) => {
      const style = 'width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle;margin-right:4px';
      const icons = {
        message:    `<svg viewBox="0 0 24 24" style="${style}"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        dollar:     `<svg viewBox="0 0 24 24" style="${style}"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        clock:      `<svg viewBox="0 0 24 24" style="${style}"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        shield:     `<svg viewBox="0 0 24 24" style="${style}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        star:       `<svg viewBox="0 0 24 24" style="${style}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        smartphone: `<svg viewBox="0 0 24 24" style="${style}"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
      };
      return icons[iconKey] || '';
    };

    return `<div class="page active">${H.innerTopbar('Notification Preferences')}
      <div style="padding:12px 12px 100px">
        <div style="font-size:13px;color:var(--sub);padding:4px 2px 12px;line-height:1.5">
          Choose which notifications you receive. Push notifications require app permissions.
        </div>
        <div class="section-card">
          ${rows.map(([k, t, s, iconName]) => {
            const on = u.settings[k] !== false;
            const trackBg = on ? '#34C759' : 'rgba(120,120,128,0.3)';
            const knobLeft = on ? '22px' : '3px';
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--border)">
              <div style="flex:1;min-width:0;padding-right:12px">
                <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:2px">${settingsIcon(iconName)} ${t}</div>
                <div style="font-size:12px;color:var(--sub);line-height:1.4">${s}</div>
              </div>
              <button
                onclick="H.toggleSetting('${k}',this)"
                role="switch"
                aria-checked="${on ? 'true' : 'false'}"
                aria-label="${t}"
                style="position:relative;display:inline-block;width:46px;height:26px;border-radius:13px;background:${trackBg};border:none;cursor:pointer;flex-shrink:0;padding:0;transition:background 0.2s;outline:none;-webkit-tap-highlight-color:transparent">
                <span style="position:absolute;top:3px;left:${knobLeft};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:left 0.2s"></span>
              </button>
            </div>`;
          }).join('')}
        </div>

        <div style="background:var(--n4);border-radius:14px;padding:14px;margin-top:14px;border:1px solid var(--n5)">
          <div style="font-size:13px;font-weight:700;color:var(--n2);margin-bottom:4px">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;vertical-align:middle;margin-right:6px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Privacy Note
          </div>
          <div style="font-size:12px;color:var(--sub);line-height:1.6">
            PaMarket never sells your notification preferences or contact details to third parties.
            You can turn off all notifications at any time from your device settings.
          </div>
        </div>
      </div>
    </div>`;
  };

  H.toggleSetting = function (k, btn) {
    const u = H.currentUser(); if (!u) return;
    u.settings = u.settings || {};
    u.settings[k] = !(u.settings[k] !== false);
    const on = u.settings[k];
    // Update track background
    btn.style.background = on ? '#34C759' : 'rgba(120,120,128,0.3)';
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    // Slide the knob
    const knob = btn.querySelector('span');
    if (knob) knob.style.left = on ? '22px' : '3px';
    saveState();
    toast(on ? 'Enabled' : 'Disabled');
  };

})(window.H);

;/* === www/js/saved.js === */
'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { currentUser, escHtml, timeAgo, uid, toast, modal,
          innerTopbar, emptyState, openInner, goBack, renderPage,
          saveState, fmtPrice, initials, renderListCard, navTo,
          pushNotif, CATEGORIES } = H;

  pages.Saved = function () {
    const u    = currentUser();
    const ids  = state.saves[u.id] || [];

    // Map each saved ID to either the listing object or null (deleted/not found)
    const resolved = ids.map(id => ({ id, listing: state.listings.find(l => l.id === id) || null }));

    // Helper: render a status pill for non-active listings
    function statusPillFor(listing) {
      if (!listing || listing.status === 'active') return '';
      if (listing.status === 'sold')
        return `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#ef4444;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle">Sold</span>`;
      if (listing.status === 'expired')
        return `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#f59e0b;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle">Expired</span>`;
      // inactive or any other status
      return `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#6b7280;border-radius:20px;padding:2px 8px;margin-left:6px;vertical-align:middle">Unavailable</span>`;
    }

    // Render a single saved entry
    function renderEntry({ id, listing }) {
      // Deleted listing — ghost card
      if (!listing) {
        return `<div style="padding:14px 16px;background:var(--card);border-radius:14px;margin:8px 16px;opacity:.5;border:1px dashed var(--border)">
  <div style="font-size:13px;color:var(--sub)">This listing is no longer available</div>
</div>`;
      }
      // Unavailable listing — greyed-out card with status pill injected
      const isUnavailable = listing.status !== 'active';
      const card = renderListCard(listing);
      if (!isUnavailable) return card;
      // Wrap with opacity and inject the status pill right after the card opens
      const pill = statusPillFor(listing);
      // Insert pill into the rendered card by appending it into the title line if possible,
      // otherwise wrap the whole card with a relative-positioned overlay container
      return `<div style="opacity:0.65;position:relative">${card}${
        pill ? `<div style="position:absolute;top:10px;left:10px;pointer-events:none">${pill}</div>` : ''
      }</div>`;
    }

    const hasAny = resolved.length > 0;

    return `<div class="page active">
      <div class="app-header" style="padding-bottom:16px">
        <div class="app-header-row">
          <div class="logo">Saved <em>Ads</em></div>
          <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,.6);padding:4px 10px;background:rgba(255,255,255,.1);border-radius:20px">
            ${ids.length} saved
          </div>
        </div>
      </div>
      <div class="listing-list">
        ${hasAny
          ? resolved.map(renderEntry).join('')
          : emptyState('Nothing saved yet', 'Tap the ♡ on any listing to save it for later', 'Browse Listings', "H.navTo('Browse',document.querySelector('[data-nav=Browse]'))")}
      </div>
    </div>`;
  };

  pages.Profile = function () {
    const u         = currentUser();
    const myListings = (state.listings || []).filter(l => l.sellerId === u.id);
    const active    = myListings.filter(l => l.status === 'active').length;
    const saves     = (state.saves[u.id] || []).length;
    const txns      = (state.txns || []).filter(t => t.userId === u.id);

    return `<div class="page active">
      <div class="prof-top">
        <div class="prof-av">${u.avatar ? `<img src="${u.avatar}">` : initials(u.name)}</div>
        <div class="prof-name">${escHtml(u.name)}</div>
        <div class="prof-phone-display">${escHtml(u.phone)}</div>
        <div class="prof-badges">
          ${u.verified ? `<span class="pbadge pbadge-verified">
            <span class="blue-check" style="width:12px;height:12px;margin-right:2px">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </span>ID Verified</span>` : ''}
          ${u.role === 'admin' ? '<span class="pbadge pbadge-admin">Admin</span>' : ''}
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="stat-n">${active}</div><div class="stat-l">Active Ads</div></div>
        <div class="stat"><div class="stat-n">${saves}</div><div class="stat-l">Saved</div></div>
      </div>

      <div class="menu-group-label">My Account</div>
      <div class="menu-items">
        <div class="mi" onclick="H.openInner('MyListings')">
          <div class="mi-icon blue-ic"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg></div>
          <div class="mi-label">My Listings</div>
          <span class="mi-badge-green">${active}</span>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('Ads')">
          <div class="mi-icon blue-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg></div>
          <div class="mi-label">Advertisements</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('Verify')">
          <div class="mi-icon ${u.verified ? 'blue-ic' : 'green-ic'}">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="mi-label">${u.verified ? 'Verified ✓' : 'Get Verified'}</div>
          ${!u.verified ? '<span style="font-size:11px;color:var(--o);font-weight:700">Boost trust</span>' : ''}
          <div class="mi-arrow">›</div>
        </div>
      </div>

      <div class="menu-group-label">Preferences</div>
      <div class="menu-items">
        <div class="mi" onclick="H.openInner('NotifSettings')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div class="mi-label">Notifications</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('LanguageSettings')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div class="mi-label">Language</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('PrivacySettings')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="mi-label">Privacy Policy</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('HelpTerms')">
          <div class="mi-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div class="mi-label">Terms of Service</div>
          <div class="mi-arrow">›</div>
        </div>
        <div class="mi" onclick="H.openInner('About')">
          <div class="mi-icon green-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div class="mi-label">About PaMarket</div>
          <div class="mi-arrow">›</div>
        </div>
        ${u.role === 'admin' ? `
        <div class="mi" onclick="H.navTo('Admin',null)">
          <div class="mi-icon amber-ic"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
          <div class="mi-label">Admin Panel</div>
          <div class="mi-arrow">›</div>
        </div>` : ''}
      </div>

      <div class="menu-group-label">Danger Zone</div>
      <div class="menu-items" style="padding-bottom:90px">
        <div class="mi" onclick="H.logOut()">
          <div class="mi-icon red-ic"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
          <div class="mi-label red-lbl">Sign Out</div>
        </div>
        <div class="mi" onclick="H.openInner('DeleteAccount')">
          <div class="mi-icon red-ic"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></div>
          <div class="mi-label red-lbl">Delete Account</div>
        </div>
      </div>
    </div>`;
  };

  pages.MyListings = function () {
    const u    = currentUser();
    const list = (state.listings || []).filter(l => l.sellerId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    const now  = Date.now();
    const TWENTY_FIVE_DAYS = 25 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS      = 30 * 24 * 60 * 60 * 1000;

    return `<div class="page active">${innerTopbar('My Listings')}
      <div style="padding-bottom:90px">
        ${list.length ? list.map(l => {
          const age = now - (l.createdAt || now);
          const isExpired     = age > THIRTY_DAYS;
          const isExpiringSoon = !isExpired && age > TWENTY_FIVE_DAYS;

          // Saves count: number of userIds who have this listing in their saves array
          const savesCount = Object.values(state.saves || {}).filter(arr => Array.isArray(arr) && arr.includes(l.id)).length;

          // Enquiries count: conversations referencing this listing
          const enquiriesCount = (state.conversations || []).filter(conv => conv.listingId === l.id).length;

          // Status pill / expiry logic
          let statusPill;
          if (isExpired) {
            statusPill = `<span class="status-pill status-banned">Expired</span>`;
          } else {
            const statusClass = l.status === 'active' ? 'status-active' : l.status === 'banned' ? 'status-banned' : 'status-pending';
            statusPill = `<span class="status-pill ${statusClass}">${l.status}</span>`;
          }

          const expiryWarning = isExpiringSoon
            ? `<span style="font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:8px;padding:1px 7px;margin-left:4px">Expiring soon</span>`
            : '';

          const renewBtn = (isExpired || isExpiringSoon)
            ? `<button class="ml-act-btn" onclick="(function(){var l=H.state.listings.find(function(x){return x.id==='${l.id}';});if(l){l.createdAt=Date.now();if(l.status==='expired')l.status='active';H.saveState();H.openInner('MyListings');}})()">Renew</button>`
            : '';

          return `<div class="my-listing-card">
            <div class="ml-thumb">
              ${l.photos && l.photos[0] ? `<img src="${l.photos[0]}">` : ((CATEGORIES.find(c => c.id === l.cat) || {}).icon || '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#ccc"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>')}
            </div>
            <div class="ml-body">
              <div class="ml-title">${escHtml(l.title)}</div>
              <div class="ml-price">${escHtml(fmtPrice(l.price, l.currency))}</div>
              <div class="ml-meta">
                ${statusPill}${expiryWarning}
                <span style="color:var(--sub)"> · ${l.views || 0} views · ${timeAgo(l.createdAt)}</span>
              </div>
              <div style="display:inline-flex;gap:10px;align-items:center;font-size:11px;color:var(--sub);margin-top:4px;flex-wrap:wrap">
                <span>&#128065; ${l.views || 0} views</span>
                <span>&#9825; ${savesCount} saves</span>
                <span>&#128172; ${enquiriesCount} enquiries</span>
              </div>
              <div class="ml-actions">
                <button class="ml-act-btn" onclick="H.openListing('${l.id}')">View</button>
                <button class="ml-act-btn" onclick="H.openInner('Boost',{listingId:'${l.id}'})">&#9889; Boost</button>
                ${renewBtn}
                ${!isExpired && l.status === 'active'
                  ? `<button class="ml-act-btn red" onclick="H.deleteListing('${l.id}')">Delete</button>`
                  : ''}
              </div>
            </div>
          </div>`;
        }).join('') : emptyState('No listings yet', 'Your posted ads will appear here.', 'Post an Ad', "H.navTo('Post',null)")}
      </div>
    </div>`;
  };

  H.logOut = function () {
    H.logout();
  };

})(window.H);

;/* === www/js/admin.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const getState = () => H.state || {};
  const { escHtml, timeAgo, uid, toast, modal, fmtPrice, initials, pushNotif } = H;
  // Methods that use `this` must go through H so binding is correct
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const emptyState  = (...a) => H.emptyState(...a);
  const saveState   = () => H.saveState();
  const renderPage  = (...a) => H.renderPage(...a);

  const S = {
    deny:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    eye:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    ban:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    unban:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    verify:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    approve:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    reject:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    delete:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    suspend:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 12 16 12"/></svg>',
    restore:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    edit:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    trash:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    reload:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    lock:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    support:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    broadcast:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>',
    admin:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
  };

  if (!H.state.adminLogs) H.state.adminLogs = [];

  function adminGuard() {
    const u = currentUser();
    if (!u || u.role !== 'admin') { toast('Unauthorized'); return false; }
    return true;
  }

  let _adminTab = 'overview';

  // ── ADMIN LOG HELPER ──────────────────────────────────────
  function alog(action) {
    H.state.adminLogs.unshift({ action, adminName: currentUser().name, t: Date.now() });
  }

  // ── MAIN PAGE ─────────────────────────────────────────────
  pages.Admin = function () {
    const u = currentUser();
    if (u.role !== 'admin') return `<div class="page active">${innerTopbar('Admin')}
      <div class="empty-state"><div class="empty-icon">${S.deny}</div><div class="empty-title">Access Denied</div></div>
    </div>`;

    const tabs = [
      ['overview',      'Overview'],
      ['users',         `Users (${(H.state.users||[]).length})`],
      ['listings',      `Listings (${(H.state.listings||[]).length})`],
      ['reports',       `Reports (${(H.state.reports||[]).filter(r=>r.status==='open').length})`],
      ['payments',      'Payments'],
      ['analytics',     'Analytics'],
      ['verifications',  `Verify (${(H.state.users||[]).filter(u=>u.verificationPending&&!u.verified).length})`],
      ['settings',      'Settings'],
      ['ads',           `Ads (${((H.state.paidAds||[]).filter(a=>a.active&&a.endsAt>Date.now())).length} live)`],
      ['notifications', 'Notify'],
      ['support',       `Support (${(H.state.supportTickets||[]).filter(t=>t.status!=='closed').length})`],
      ['logs',          `Logs (${(H.state.adminLogs||[]).length})`],
      ['messages',      `Messages (${(H.state.conversations||[]).length})`]
    ];

    return `<div class="page active">${innerTopbar('Admin Panel')}
      <div style="display:flex;gap:6px;padding:12px 12px 10px;overflow-x:auto;scrollbar-width:none">
        ${tabs.map(([k,l]) => `<button class="admin-tab ${_adminTab===k?'on':''}" data-tab="${k}" onclick="H._admin.setTab('${k}')">${l}</button>`).join('')}
      </div>
      <div class="inner-content" style="padding-top:0" id="adminBody">${renderBody()}</div>
    </div>`;
  };

  pages.Admin_after = function () {
    const body = document.getElementById('adminBody');
    const reRender = function () { if (body) body.innerHTML = renderBody(); };
    const syncs = [syncVerificationsFromSupabase()];
    if (typeof H.syncReports === 'function') syncs.push(H.syncReports());
    if (typeof H.syncConversations === 'function') syncs.push(H.syncConversations());
    Promise.all(syncs).then(reRender);
  };

  function syncVerificationsFromSupabase() {
    const sb = window.supabase;
    if (!sb || typeof sb.from !== 'function') return Promise.resolve();

    const p1 = sb.from('profiles')
      .select('id,name,email,phone,verification_pending,id_type,verified,verified_at,avatar_url,role')
      .or('verification_pending.eq.true,verified.eq.true')
      .then(function (res) {
        const data = res && res.data;
        if (!data || !data.length) return;
        if (!H.state.users) H.state.users = [];
        data.forEach(function (p) {
          let u = H.state.users.find(function (x) { return x.id === p.id; });
          if (u) {
            if (p.verification_pending !== undefined) u.verificationPending = p.verification_pending;
            if (p.id_type) u.verificationIdType = p.id_type;
            if (p.verified !== undefined) u.verified = p.verified;
            if (p.verified_at) u.verifiedAt = new Date(p.verified_at).getTime();
            if (p.name)  u.name  = p.name;
            if (p.email) u.email = p.email;
            if (p.phone) u.phone = p.phone;
          } else {
            H.state.users.push({
              id: p.id,
              name:  p.name  || 'Unknown',
              email: p.email || '',
              phone: p.phone || '',
              avatar: p.avatar_url || '',
              role:  p.role  || 'user',
              verificationPending: p.verification_pending || false,
              verificationIdType:  p.id_type || '',
              verified:   p.verified   || false,
              verifiedAt: p.verified_at ? new Date(p.verified_at).getTime() : null,
              joinedAt:   Date.now()
            });
          }
        });
      })
      .catch(function () {});

    const p2 = sb.from('verifications')
      .select('user_id,id_doc,selfie,status,submitted_at')
      .then(function (res) {
        const data = res && res.data;
        if (!data) return;
        H.state._verifications = {};
        data.forEach(function (v) { H.state._verifications[v.user_id] = v; });
      })
      .catch(function () {});

    return Promise.all([p1, p2]);
  }

  function renderBody() {
    switch (_adminTab) {
      case 'overview':       return renderOverview();
      case 'users':          return renderUsers();
      case 'listings':       return renderListings();
      case 'reports':        return renderReports();
      case 'payments':       return renderPayments();
      case 'analytics':      return renderAnalytics();
      case 'verifications':  return renderVerifications();
      case 'settings':       return renderSettings();
      case 'ads':            return renderAds();
      case 'notifications':  return renderNotifications();
      case 'support':        return renderSupport();
      case 'logs':           return renderLogs();
      case 'messages':       return renderMessages();
      default: return '';
    }
  }

  function renderVerifications() {
    const pending = (H.state.users||[]).filter(u=>u.verificationPending && !u.verified);
    const verified = (H.state.users||[]).filter(u=>u.verified);
    const vdocs = H.state._verifications || {};
    return `
      <div class="stats" style="margin:0 0 14px">
        <div class="stat"><div class="stat-n">${pending.length}</div><div class="stat-l">Pending</div></div>
        <div class="stat"><div class="stat-n">${verified.length}</div><div class="stat-l">Verified</div></div>
        <div class="stat"><div class="stat-n">${(H.state.users||[]).length}</div><div class="stat-l">Total Users</div></div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Pending Verification Requests</div>
      ${pending.length ? `
      <div class="section-card" style="margin-bottom:16px">
        ${pending.map(u => {
          const vd = vdocs[u.id];
          const idDocHtml  = vd && vd.id_doc  ? `<div><div style="font-size:11px;color:var(--sub);margin-bottom:4px">ID Document</div><img src="${vd.id_doc}" style="width:140px;border-radius:8px;border:1px solid var(--n3);display:block"></div>` : '';
          const selfieHtml = vd && vd.selfie   ? `<div><div style="font-size:11px;color:var(--sub);margin-bottom:4px">Selfie</div><img src="${vd.selfie}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:2px solid var(--n3);display:block"></div>` : '';
          const noPhotos   = !vd ? `<div style="font-size:12px;color:#ef4444;margin:8px 0">No photos received — verifications table may be missing</div>` : (!vd.id_doc && !vd.selfie) ? `<div style="font-size:12px;color:#ef4444;margin:8px 0">No photos in submission</div>` : '';
          return `
          <div class="admin-row" style="padding:14px">
            <div class="admin-row-head">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:40px;height:40px;border-radius:50%;background:#1A3A8F20;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#1A3A8F;flex-shrink:0">${H.initials(u.name||'U')}</div>
                <div>
                  <div class="admin-row-name" style="font-size:14px;font-weight:700">${escHtml(u.name||'Unknown')}</div>
                  <div class="admin-row-meta">${escHtml(u.email||'')} · ${escHtml(u.phone||'No phone')}</div>
                  ${u.cv && u.cv.headline ? `<div style="font-size:12px;color:#1A3A8F;font-weight:600;margin-top:2px">${escHtml(u.cv.headline)}</div>` : ''}
                </div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--sub);margin:8px 0">${u.verificationIdType ? `ID Type: ${escHtml(u.verificationIdType)}` : 'Standard verification request'}</div>
            ${noPhotos}
            ${(idDocHtml || selfieHtml) ? `<div style="display:flex;gap:12px;margin:10px 0;flex-wrap:wrap;align-items:flex-start">${idDocHtml}${selfieHtml}</div>` : ''}
            <div class="admin-actions">
              <button class="ml-act-btn" onclick="H._admin.approveVerification('${u.id}')">${S.verify} Approve &amp; Verify</button>
              <button class="ml-act-btn red" onclick="H._admin.rejectVerification('${u.id}')">${S.reject} Reject</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div style="text-align:center;padding:32px 20px;color:var(--sub);font-size:14px">No pending verification requests</div>`}
      <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Verified Users</div>
      <div class="section-card">
        ${verified.length ? verified.slice(0,20).map(u => `
          <div class="admin-row">
            <div class="admin-row-head">
              <div class="admin-row-name">${escHtml(u.name||'Unknown')} <span style="color:#059669;font-size:11px">✓ Verified</span></div>
              <span style="font-size:11px;color:var(--sub)">${new Date(u.verifiedAt||u.joinedAt||Date.now()).toLocaleDateString()}</span>
            </div>
            <div class="admin-row-meta">${escHtml(u.email||u.phone||'')}</div>
            <div class="admin-actions">
              <button class="ml-act-btn red" onclick="H._admin.revokeVerification('${u.id}')">Revoke</button>
            </div>
          </div>`).join('') : '<div style="padding:16px;text-align:center;color:var(--sub)">No verified users yet</div>'}
      </div>`;
  }

  // ── OVERVIEW ──────────────────────────────────────────────
  function renderOverview() {
    const users    = H.state.users || [];
    const listings = H.state.listings || [];
    const reports  = H.state.reports || [];
    const txns     = H.state.txns || [];
    const revenue  = txns.filter(t=>t.type==='boost').reduce((s,t)=>s+Math.abs(t.amt),0);
    const today    = Date.now() - 86400000;
    const newToday = listings.filter(l=>l.createdAt>today).length;
    const usersToday = users.filter(u=>(u.joinedAt||u.createdAt||0)>today).length;
    const openReports = reports.filter(r=>r.status==='open').length;
    const pending  = listings.filter(l=>l.status==='pending').length;
    const expiring = listings.filter(l=>l.expiresAt&&l.expiresAt-Date.now()<7*86400000&&l.expiresAt>Date.now()).length;
    const openTickets = (H.state.supportTickets||[]).filter(t=>t.status!=='closed').length;
    const topupQueue = (H.state.topupRequests||[]).filter(r=>r.status==='pending').length;
    const convos = H.state.conversations || [];
    let msgUnread = 0;
    convos.forEach(function (c) { (c.messages||[]).forEach(function (m) { if (!m.read) msgUnread++; }); });

    return `
      <div class="stats" style="margin:0 0 10px">
        <div class="stat"><div class="stat-n">${users.length}</div><div class="stat-l">Users</div></div>
        <div class="stat"><div class="stat-n">+${usersToday}</div><div class="stat-l">New Today</div></div>
        <div class="stat"><div class="stat-n">${users.filter(u=>u.verified).length}</div><div class="stat-l">Verified</div></div>
      </div>
      <div class="stats" style="margin:0 0 10px">
        <div class="stat"><div class="stat-n">${listings.filter(l=>l.status==='active').length}</div><div class="stat-l">Active Ads</div></div>
        <div class="stat"><div class="stat-n">+${newToday}</div><div class="stat-l">New Today</div></div>
        <div class="stat"><div class="stat-n">$${revenue.toFixed(0)}</div><div class="stat-l">Revenue</div></div>
      </div>
      ${(pending||openReports||expiring||openTickets||topupQueue) ? `
      <div style="padding:12px 0 4px;font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px">Needs Attention</div>
      <div class="section-card" style="padding:0">
        ${pending ? `<div class="admin-alert-row" onclick="H._admin.setTab('listings');H._admin.filterListingsByStatus('pending')">
          <span style="color:#f59e0b;font-weight:700">${pending} pending listing${pending>1?'s':''}</span> awaiting review
          <span style="color:#1A3A8F;font-weight:700;margin-left:auto">Review →</span>
        </div>` : ''}
        ${openReports ? `<div class="admin-alert-row" onclick="H._admin.setTab('reports')">
          <span style="color:#dc2626;font-weight:700">${openReports} open report${openReports>1?'s':''}</span> need action
          <span style="color:#1A3A8F;font-weight:700;margin-left:auto">View →</span>
        </div>` : ''}
        ${expiring ? `<div class="admin-alert-row" onclick="H._admin.setTab('listings');H._admin.filterListingsByStatus('active')">
          <span style="color:#f59e0b;font-weight:700">${expiring} listing${expiring>1?'s':''}</span> expiring within 7 days
          <span style="color:#1A3A8F;font-weight:700;margin-left:auto">View →</span>
        </div>` : ''}
        ${openTickets ? `<div class="admin-alert-row" onclick="H._admin.setTab('support')">
          <span style="color:#7c3aed;font-weight:700">${openTickets} support ticket${openTickets>1?'s':''}</span> open
          <span style="color:#1A3A8F;font-weight:700;margin-left:auto">View →</span>
        </div>` : ''}
        ${topupQueue ? `<div class="admin-alert-row" onclick="H._admin.setTab('payments')">
          <span style="color:#059669;font-weight:700">${topupQueue} top-up request${topupQueue>1?'s':''}</span> pending
          <span style="color:#1A3A8F;font-weight:700;margin-left:auto">View →</span>
        </div>` : ''}
      </div>` : ''}
      <div class="stats" style="margin:10px 0 0">
        <div class="stat"><div class="stat-n">${txns.length}</div><div class="stat-l">Transactions</div></div>
        <div class="stat"><div class="stat-n">${users.filter(u=>u.status!=='active').length}</div><div class="stat-l">Banned</div></div>
        <div class="stat"><div class="stat-n">${listings.filter(l=>l.status==='pending').length}</div><div class="stat-l">Pending</div></div>
      </div>
      <div class="stats" style="margin:10px 0 0" onclick="H._admin.setTab('messages')" style="cursor:pointer">
        <div class="stat" style="cursor:pointer" onclick="H._admin.setTab('messages')"><div class="stat-n">${convos.length}</div><div class="stat-l">Conversations</div></div>
        <div class="stat" style="cursor:pointer" onclick="H._admin.setTab('messages')"><div class="stat-n">${msgUnread}</div><div class="stat-l">Unread Msgs</div></div>
        <div class="stat" style="cursor:pointer" onclick="H._admin.setTab('messages')"><div class="stat-n">${(H.state.users||[]).filter(u=>u.verificationPending&&!u.verified).length}</div><div class="stat-l">Verify Queue</div></div>
      </div>`;
  }

  // ── ANALYTICS ─────────────────────────────────────────────
  function renderAnalytics() {
    const listings = H.state.listings || [];
    const users    = H.state.users || [];
    const txns     = H.state.txns || [];

    // Listings by category
    const catCounts = {};
    listings.forEach(l => { catCounts[l.cat] = (catCounts[l.cat]||0)+1; });
    const catEntries = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
    const maxCat = catEntries[0]?.[1] || 1;

    // Revenue by type
    const boostRev = txns.filter(t=>t.type==='boost').reduce((s,t)=>s+Math.abs(t.amt),0);
    const topupRev = txns.filter(t=>t.type==='topup').reduce((s,t)=>s+Math.abs(t.amt),0);

    // New users by week (last 4 weeks)
    const now = Date.now();
    const weeks = [0,1,2,3].map(w => {
      const start = now - (w+1)*7*86400000;
      const end   = now - w*7*86400000;
      return { label: `${w===0?'This':w===1?'Last':w+'w ago'} week`, count: users.filter(u=>(u.joinedAt||u.createdAt||0)>start&&(u.joinedAt||u.createdAt||0)<=end).length };
    }).reverse();
    const maxWeek = Math.max(1, ...weeks.map(w=>w.count));

    // Listing status breakdown
    const active  = listings.filter(l=>l.status==='active').length;
    const pending = listings.filter(l=>l.status==='pending').length;
    const banned  = listings.filter(l=>l.status==='banned').length;
    const total   = listings.length || 1;

    return `
      <div style="padding:4px 0 10px;font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px">Listings by Category</div>
      <div class="section-card" style="padding:14px">
        ${catEntries.length ? catEntries.map(([cat, count]) => {
          const pct = Math.round(count/maxCat*100);
          const catObj = (H.CATEGORIES||[]).find(c=>c.id===cat)||{name:cat,icon:''};
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:var(--text-mid);margin-bottom:4px">
              <span>${catObj.icon||''} ${escHtml(catObj.name)}</span><span>${count}</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:#1A3A8F;border-radius:3px;transition:width .3s"></div>
            </div>
          </div>`;
        }).join('') : '<div style="color:var(--text-sub);font-size:13px">No listings yet</div>'}
      </div>

      <div style="padding:14px 0 10px;font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px">Listing Status</div>
      <div class="section-card" style="padding:14px">
        <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-bottom:10px">
          <div style="width:${Math.round(active/total*100)}%;background:#059669" title="Active"></div>
          <div style="width:${Math.round(pending/total*100)}%;background:#f59e0b" title="Pending"></div>
          <div style="width:${Math.round(banned/total*100)}%;background:#dc2626" title="Banned"></div>
        </div>
        <div style="display:flex;gap:16px;font-size:12px">
          <span style="color:#059669;font-weight:600">● Active: ${active}</span>
          <span style="color:#f59e0b;font-weight:600">● Pending: ${pending}</span>
          <span style="color:#dc2626;font-weight:600">● Removed: ${banned}</span>
        </div>
      </div>

      <div style="padding:14px 0 10px;font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px">New Users (weekly)</div>
      <div class="section-card" style="padding:14px">
        <div style="display:flex;align-items:flex-end;gap:8px;height:64px">
          ${weeks.map(w=>`<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
            <div style="width:100%;background:#1A3A8F;border-radius:4px 4px 0 0;height:${Math.max(4,Math.round(w.count/maxWeek*52))}px"></div>
            <div style="font-size:10px;color:var(--text-sub);white-space:nowrap">${w.count}</div>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          ${weeks.map(w=>`<div style="flex:1;font-size:10px;color:var(--text-hint);text-align:center">${w.label}</div>`).join('')}
        </div>
      </div>

      <div style="padding:14px 0 10px;font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px">Revenue</div>
      <div class="stats" style="margin:0">
        <div class="stat"><div class="stat-n">$${boostRev.toFixed(0)}</div><div class="stat-l">Boost Revenue</div></div>
        <div class="stat"><div class="stat-n">$${topupRev.toFixed(0)}</div><div class="stat-l">Top-ups</div></div>
        <div class="stat"><div class="stat-n">$${(boostRev+topupRev).toFixed(0)}</div><div class="stat-l">Total</div></div>
      </div>`;
  }

  // ── USERS ─────────────────────────────────────────────────
  function userRow(u) {
    const listings = (H.state.listings||[]).filter(l=>l.sellerId===u.id);
    const status = u.status==='active'
      ? `<span class="status-pill status-active">Active</span>`
      : u.status==='banned_temp'
        ? `<span class="status-pill status-pending">Suspended</span>`
        : `<span class="status-pill status-banned">Banned</span>`;
    return `<div class="admin-row">
      <div class="admin-row-head">
        <div class="admin-row-name">${escHtml(u.name)} ${u.role==='admin'?'👑':''} ${u.verified?'✓':''}</div>
        ${status}
      </div>
      <div class="admin-row-meta">${escHtml(u.email||'no email')} · ${escHtml(u.phone||'no phone')} · ${listings.length} listings · Joined ${new Date(u.joinedAt||u.createdAt||Date.now()).toLocaleDateString()}</div>
      <div class="admin-actions">
        <button class="ml-act-btn" onclick="H._admin.setTab('listings');H._admin.filterListings('${escHtml(u.name)}')">${S.eye} Listings</button>
        ${u.status==='active' ? `
          <button class="ml-act-btn" onclick="H._admin.banUser('${u.id}','temp')">${S.suspend} Suspend</button>
          <button class="ml-act-btn red" onclick="H._admin.banUser('${u.id}','perm')">${S.ban} Ban</button>
        ` : `<button class="ml-act-btn" onclick="H._admin.unban('${u.id}')">${S.unban} Unban</button>`}
        ${!u.verified?`<button class="ml-act-btn" onclick="H._admin.verifyUser('${u.id}')">${S.verify} Verify</button>`:''}
        ${!u.companyVerified?`<button class="ml-act-btn" onclick="H._admin.verifyCompany('${u.id}')">🏢 Company ✓</button>`:`<button class="ml-act-btn" onclick="H._admin.revokeCompany('${u.id}')">🏢 Revoke Co.</button>`}
        ${u.role!=='admin'?`<button class="ml-act-btn" onclick="H._admin.makeAdmin('${u.id}')">${S.admin} Make Admin</button>`:''}
        ${u.id!==currentUser().id?`<button class="ml-act-btn red" onclick="H._admin.deleteUser('${u.id}')">${S.delete} Delete</button>`:''}
      </div>
    </div>`;
  }

  function renderUsers() {
    return `<input class="fi" placeholder="Search users..." oninput="H._admin.filterUsers(this.value)" style="margin-bottom:10px">
      <div id="adminUsersList">${(H.state.users||[]).map(userRow).join('')}</div>`;
  }

  // ── LISTINGS ──────────────────────────────────────────────
  function listingRow(l) {
    const seller = (H.state.users||[]).find(u=>u.id===l.sellerId)||{name:'?'};
    const statusClass = l.status==='active'?'status-active':l.status==='pending'?'status-pending':'status-banned';
    return `<div class="admin-row">
      <div class="admin-row-head">
        <div class="admin-row-name">${escHtml(l.title)}</div>
        <span class="status-pill ${statusClass}">${l.status}</span>
      </div>
      <div class="admin-row-meta">${escHtml(fmtPrice(l.price,l.currency))} · ${escHtml(l.city||'')} · by ${escHtml(seller.name)} · ${new Date(l.createdAt).toLocaleDateString()}</div>
      <div class="admin-actions">
        <button class="ml-act-btn" onclick="H.openListing('${l.id}')">${S.eye} View</button>
        ${l.status==='pending'?`
          <button class="ml-act-btn" onclick="H._admin.approveListing('${l.id}')">${S.approve} Approve</button>
          <button class="ml-act-btn red" onclick="H._admin.rejectListing('${l.id}')">${S.reject} Reject</button>
        `:''}
        ${l.status==='active'?`<button class="ml-act-btn red" onclick="H._admin.banListing('${l.id}')">${S.ban} Remove</button>`:''}
        ${l.status!=='active'&&l.status!=='pending'?`<button class="ml-act-btn" onclick="H._admin.restoreListing('${l.id}')">${S.restore} Restore</button>`:''}
      </div>
    </div>`;
  }

  function renderListings() {
    const all      = H.state.listings||[];
    const pending  = all.filter(l=>l.status==='pending').length;
    const active   = all.filter(l=>l.status==='active').length;
    const rejected = all.filter(l=>l.status==='rejected').length;
    const banned   = all.filter(l=>l.status==='banned').length;
    return `
      <input class="fi" placeholder="Search listings..." oninput="H._admin.filterListings(this.value)" style="margin-bottom:10px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <button class="admin-tab on" data-lstatus="all" onclick="H._admin.filterListingsByStatus('all')">All (${all.length})</button>
        <button class="admin-tab" data-lstatus="pending" onclick="H._admin.filterListingsByStatus('pending')">Pending (${pending})</button>
        <button class="admin-tab" data-lstatus="active" onclick="H._admin.filterListingsByStatus('active')">Active (${active})</button>
        <button class="admin-tab" data-lstatus="rejected" onclick="H._admin.filterListingsByStatus('rejected')">Rejected (${rejected})</button>
        <button class="admin-tab" data-lstatus="banned" onclick="H._admin.filterListingsByStatus('banned')">Removed (${banned})</button>
      </div>
      <div id="adminLList">${all.slice().sort((a,b)=>b.createdAt-a.createdAt).map(listingRow).join('')}</div>`;
  }

  // ── REPORTS ───────────────────────────────────────────────
  let _reportFilter = 'all';
  function renderReports(filter) {
    if (filter !== undefined) _reportFilter = filter;
    const all  = [...(H.state.reports||[])].sort((a,b)=>(b.t||b.createdAt||0)-(a.t||a.createdAt||0));
    const open = all.filter(r=>r.status==='open');
    const list = _reportFilter==='open' ? open
               : _reportFilter==='listing' ? all.filter(r=>r.targetType==='listing')
               : _reportFilter==='user' ? all.filter(r=>r.targetType==='user')
               : all;
    if (!all.length) return emptyState('No reports','All clear!',null,null);
    const filterBar = `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button class="admin-tab ${_reportFilter==='all'?'on':''}" onclick="H._admin.filterReports('all')">All (${all.length})</button>
      <button class="admin-tab ${_reportFilter==='open'?'on':''}" onclick="H._admin.filterReports('open')">Open (${open.length})</button>
      <button class="admin-tab ${_reportFilter==='listing'?'on':''}" onclick="H._admin.filterReports('listing')">Listings</button>
      <button class="admin-tab ${_reportFilter==='user'?'on':''}" onclick="H._admin.filterReports('user')">Users</button>
    </div>`;
    if (!list.length) return filterBar + emptyState('No reports','Nothing here',null,null);
    return filterBar + list.map(r => {
      let target = '', actions = '';
      if (r.targetType==='listing') {
        const l = (H.state.listings||[]).find(x=>x.id===r.targetId);
        target = l ? `Listing: ${escHtml(l.title)}` : '(deleted listing)';
        if (l) actions = `
          <button class="ml-act-btn" onclick="H.openListing('${l.id}')">${S.eye} View</button>
          <button class="ml-act-btn red" onclick="H._admin.banListing('${l.id}','${r.id}')">${S.ban} Remove</button>`;
      } else {
        const u = (H.state.users||[]).find(x=>x.id===r.targetId);
        target = u ? `User: ${escHtml(u.name)}` : '(deleted user)';
        if (u) actions = `
          <button class="ml-act-btn" onclick="H._admin.banUser('${u.id}','temp','${r.id}')">${S.suspend} Suspend</button>
          <button class="ml-act-btn red" onclick="H._admin.banUser('${u.id}','perm','${r.id}')">${S.ban} Ban</button>
          ${u.status!=='active'?`<button class="ml-act-btn" onclick="H._admin.unban('${u.id}','${r.id}')">${S.unban} Unban</button>`:''}`;
      }
      return `<div class="admin-row" style="${r.status==='resolved'?'opacity:.55':''}">
        <div class="admin-row-head">
          <div class="admin-row-name">${target}</div>
          <span class="status-pill ${r.status==='open'?'status-pending':'status-active'}">${r.status}</span>
        </div>
        <div class="admin-row-meta">${escHtml(r.reason||r.description||'No reason given')} · ${new Date(r.t||r.createdAt||Date.now()).toLocaleDateString()}</div>
        <div class="admin-actions">
          ${actions}
          ${r.status==='open'?`<button class="ml-act-btn" onclick="H._admin.resolveReport('${r.id}')">${S.approve} Resolve</button>`:''}
        </div>
      </div>`;
    }).join('');
  }

  // ── PAYMENTS ──────────────────────────────────────────────
  function renderPayments() {
    const txns    = [...(H.state.txns||[])].sort((a,b)=>b.t-a.t).slice(0,50);
    const revenue = txns.filter(t=>t.type==='boost').reduce((s,t)=>s+Math.abs(t.amt),0);
    const topups  = txns.filter(t=>t.type==='topup').reduce((s,t)=>s+Math.abs(t.amt),0);
    return `
      <div class="stats" style="margin:0 0 14px">
        <div class="stat"><div class="stat-n">$${revenue.toFixed(2)}</div><div class="stat-l">Boost Revenue</div></div>
        <div class="stat"><div class="stat-n">$${topups.toFixed(2)}</div><div class="stat-l">Top-ups</div></div>
        <div class="stat"><div class="stat-n">${txns.length}</div><div class="stat-l">Transactions</div></div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text-sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Transaction History</div>
      <div class="section-card">
        ${txns.length ? txns.map(t => `
          <div class="tx-item">
            <div class="tx-icon ${t.type==='topup'?'green':t.type==='boost'?'amber':'red'}">${t.type==='topup'?'↓':t.type==='boost'?'⚡':'↑'}</div>
            <div class="tx-body">
              <div class="tx-title">${escHtml(t.note||t.type)}</div>
              <div class="tx-date">${new Date(t.t).toLocaleString()}</div>
            </div>
            <div class="tx-amount ${t.amt>=0?'plus':'minus'}">${t.amt>=0?'+':''}$${Math.abs(t.amt).toFixed(2)}</div>
          </div>`).join('')
        : '<div style="padding:24px;text-align:center;color:var(--text-sub)">No transactions yet</div>'}
      </div>`;
  }

  // ── SETTINGS ──────────────────────────────────────────────
  function renderSettings() {
    const tog = (key, label, sub) => `
      <div class="notif-toggle-row">
        <div class="notif-toggle-info">
          <div class="notif-toggle-title">${label}</div>
          <div class="notif-toggle-sub">${sub}</div>
        </div>
        <button class="toggle-sw ${H.state[key]?'on':''}" onclick="H._admin.toggleSetting('${key}')"></button>
      </div>`;
    return `<div class="section-card" style="padding:14px">
      <div class="menu-group-label" style="padding:0 0 10px">Listing Moderation</div>
      ${tog('requireListingApproval','Require listing approval','New ads start as pending before going live')}
      ${tog('autoApproveVerified','Auto-approve verified sellers','Skip moderation for verified users')}
      ${tog('allowImageUploads','Allow image uploads','Users can upload photos with listings')}
      <div class="menu-group-label" style="padding:16px 0 10px">Security & Access</div>
      ${tog('signupPaused','Pause new registrations','Temporarily disable new account signup')}
      ${tog('requirePhoneVerification','Require phone verification','Users must verify phone to post')}
      <div class="menu-group-label" style="padding:16px 0 10px">Monetization</div>
      ${tog('enablePremiumListings','Enable premium listings','Allow users to boost their listings')}
      ${tog('freeOnly','Free listings only','Disable all paid features')}
      <div class="menu-group-label" style="padding:16px 0 10px">System</div>
      <button class="btn-pri" style="margin-bottom:8px" onclick="H._admin.exportData()">${S.download} Export All Data</button>
      <button class="btn-sec" style="margin-bottom:8px" onclick="H._admin.clearOldData()">${S.trash} Clear Old Data (30+ days)</button>
      <button class="btn-sec" style="background:var(--red-light);color:var(--red);border-color:rgba(192,57,43,.2)" onclick="H._admin.resetApp()">${S.reload} Reset App (Dangerous)</button>
    </div>`;
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────
  function renderNotifications() {
    return `<div class="section-card" style="padding:14px">
      <div class="menu-group-label" style="padding:0 0 14px">Send Broadcast</div>
      <div class="fg">
        <div class="fl">Target Audience</div>
        <select class="fi" id="bcastTarget">
          <option value="all">All Users</option>
          <option value="verified">Verified Users Only</option>
          <option value="unverified">Unverified Users Only</option>
          <option value="sellers">Users with Listings</option>
          <option value="inactive">Users with No Listings</option>
        </select>
      </div>
      <div class="fg">
        <div class="fl">Notification Title</div>
        <input class="fi" id="bcastTitle" placeholder="e.g. New feature available">
      </div>
      <div class="fg">
        <div class="fl">Message</div>
        <textarea class="fi" rows="4" id="bcastMsg" placeholder="Write your message to all selected users..."></textarea>
      </div>
      <button class="btn-pri" id="bcastSendBtn" onclick="H._admin.broadcast()">${S.broadcast} Send Broadcast</button>
    </div>`;
  }

  // ── SUPPORT ───────────────────────────────────────────────
  function renderSupport(filter) {
    const tickets = (H.state.supportTickets||[]);
    const f = filter || 'all';
    const filtered = f==='open' ? tickets.filter(t=>t.status!=='closed')
                   : f==='closed' ? tickets.filter(t=>t.status==='closed') : tickets;
    return `
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button class="admin-tab ${f==='all'?'on':''}" onclick="H._admin.filterTickets('all')">All (${tickets.length})</button>
        <button class="admin-tab ${f==='open'?'on':''}" onclick="H._admin.filterTickets('open')">Open (${tickets.filter(t=>t.status!=='closed').length})</button>
        <button class="admin-tab ${f==='closed'?'on':''}" onclick="H._admin.filterTickets('closed')">Closed (${tickets.filter(t=>t.status==='closed').length})</button>
      </div>
      <div id="ticketsList">
        ${filtered.length ? filtered.map(t => {
          const u = (H.state.users||[]).find(x=>x.id===t.userId)||{name:'Unknown'};
          return `<div class="admin-row" style="${t.status==='closed'?'opacity:.6':''}">
            <div class="admin-row-head">
              <div class="admin-row-name">${escHtml(t.subject||'Support ticket')}</div>
              <span class="status-pill ${t.status==='open'?'status-pending':t.status==='in-progress'?'status-active':'status-active'}">${t.status}</span>
            </div>
            <div class="admin-row-meta">${escHtml(u.name)} · ${new Date(t.createdAt||Date.now()).toLocaleDateString()}</div>
            ${t.message?`<div style="font-size:13px;color:var(--text-sub);padding:8px 0;border-top:1px solid var(--border);margin-top:6px">${escHtml(t.message)}</div>`:''}
            ${(t.replies||[]).map(r=>`<div style="background:var(--n5);border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px"><strong>Admin:</strong> ${escHtml(r.text)}</div>`).join('')}
            <div class="admin-actions" style="margin-top:8px">
              ${t.status!=='closed'?`
                <button class="ml-act-btn" onclick="H._admin.respondToTicket('${t.id}')">${S.support} Respond</button>
                <button class="ml-act-btn" onclick="H._admin.updateTicketStatus('${t.id}','in-progress')">In Progress</button>
                <button class="ml-act-btn" onclick="H._admin.updateTicketStatus('${t.id}','closed')">${S.approve} Close</button>
              `:`<button class="ml-act-btn" onclick="H._admin.reopenTicket('${t.id}')">${S.reload} Reopen</button>`}
            </div>
          </div>`;
        }).join('') : '<div style="padding:24px;text-align:center;color:var(--text-hint)">No tickets</div>'}
      </div>`;
  }

  // ── LOGS ──────────────────────────────────────────────────
  function renderLogs() {
    const logs = (H.state.adminLogs||[]).slice(0,50);
    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="ml-act-btn red" onclick="H._admin.clearLogs()">${S.trash} Clear Logs</button>
      </div>
      <div class="section-card">
        ${logs.length ? logs.map(l=>`
          <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
            <div style="font-size:13px;font-weight:500;color:var(--text-mid)">${escHtml(l.action)}</div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:2px">${escHtml(l.adminName||'Admin')} · ${new Date(l.t).toLocaleString()}</div>
          </div>`).join('')
        : '<div style="padding:24px;text-align:center;color:var(--text-hint)">No logs yet</div>'}
      </div>`;
  }

  // ── MESSAGES ──────────────────────────────────────────────
  function renderMessages() {
    const convos = H.state.conversations || [];
    const users  = H.state.users || [];

    // Count totals
    let totalMessages = 0;
    let unreadCount   = 0;
    convos.forEach(function (c) {
      const msgs = c.messages || [];
      totalMessages += msgs.length;
      msgs.forEach(function (m) { if (!m.read) unreadCount++; });
    });

    function getUserName(id) {
      const u = users.find(function (x) { return x.id === id; });
      return u ? (u.name || u.email || u.phone || 'Unknown') : 'Unknown';
    }

    const rows = convos.length ? convos.map(function (c) {
      const msgs     = c.messages || [];
      const last     = msgs[msgs.length - 1];
      const lastText = last ? escHtml((last.text || last.body || '').slice(0, 80)) : '<em>No messages</em>';
      const lastTime = last ? timeAgo(last.createdAt || last.t || 0) : '';
      const unread   = msgs.filter(function (m) { return !m.read; }).length;

      // Build participant display
      const participants = (c.participants || c.participantIds || []);
      const names = participants.length
        ? participants.map(function (id) { return escHtml(getUserName(id)); }).join(', ')
        : (c.buyerId && c.sellerId
            ? escHtml(getUserName(c.buyerId)) + ' &amp; ' + escHtml(getUserName(c.sellerId))
            : 'Unknown participants');

      const convId = escHtml(c.id || '');

      // Expandable messages block
      const msgsHtml = msgs.length ? msgs.map(function (m) {
        const senderName = escHtml(getUserName(m.senderId || m.from || ''));
        const msgTime    = new Date(m.createdAt || m.t || Date.now()).toLocaleString();
        const isAdmin    = (users.find(function (x) { return x.id === (m.senderId || m.from); }) || {}).role === 'admin';
        return `<div style="padding:6px 10px;border-left:3px solid ${isAdmin?'#1A3A8F':'#e5e7eb'};margin-bottom:6px;background:${isAdmin?'#eff6ff':'var(--n5)'};border-radius:0 6px 6px 0">
          <div style="font-size:11px;font-weight:700;color:${isAdmin?'#1A3A8F':'var(--text-mid)'};margin-bottom:2px">${senderName}</div>
          <div style="font-size:13px;color:var(--text-mid)">${escHtml((m.text||m.body||'').slice(0,300))}</div>
          <div style="font-size:10px;color:var(--text-hint);margin-top:3px">${msgTime}</div>
        </div>`;
      }).join('') : '<div style="font-size:12px;color:var(--text-hint);padding:6px">No messages in this conversation</div>';

      return `<div class="admin-row" style="padding:12px 14px">
        <div class="admin-row-head" style="cursor:pointer" onclick="(function(el){el.style.display=el.style.display==='none'?'block':'none'})(document.getElementById('conv-msgs-${convId}'))">
          <div>
            <div class="admin-row-name" style="font-size:13px;font-weight:700">${names}</div>
            <div class="admin-row-meta" style="margin-top:3px">${lastText} &middot; ${lastTime}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${unread ? `<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">${unread} unread</span>` : ''}
            <span style="font-size:11px;color:var(--sub);white-space:nowrap">${msgs.length} msg${msgs.length!==1?'s':''}</span>
            <span style="color:var(--sub)">&#9660;</span>
          </div>
        </div>
        <div id="conv-msgs-${convId}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          ${msgsHtml}
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;padding:40px 20px;color:var(--sub);font-size:14px">No conversations found.<br>Sync from Cloud to load messages.</div>';

    return `
      <div class="stats" style="margin:0 0 14px">
        <div class="stat"><div class="stat-n">${convos.length}</div><div class="stat-l">Conversations</div></div>
        <div class="stat"><div class="stat-n">${totalMessages}</div><div class="stat-l">Total Messages</div></div>
        <div class="stat"><div class="stat-n">${unreadCount}</div><div class="stat-l">Unread</div></div>
      </div>
      <button class="btn-pri" style="width:100%;margin-bottom:14px" onclick="H._admin.syncAllMessages()">${S.reload} Sync from Cloud</button>
      <div class="section-card" style="padding:0">${rows}</div>`;
  }

  // ── ADS MANAGEMENT ───────────────────────────────────────
  const CATS = ['property','vehicles','electronics','furniture','fashion','services','agriculture','pets','kids','other','rooms','jobs'];

  function renderAds() {
    var now = Date.now();
    var ads = H.state.paidAds || [];
    var live = ads.filter(function(a){ return a.active && a.endsAt > now; });
    return `
      <div class="stats" style="margin:0 0 14px">
        <div class="stat"><div class="stat-n">${live.length}</div><div class="stat-l">Live</div></div>
        <div class="stat"><div class="stat-n">${ads.filter(function(a){return a.type==='banner';}).length}</div><div class="stat-l">Banners</div></div>
        <div class="stat"><div class="stat-n">${ads.filter(function(a){return a.type==='spotlight';}).length}</div><div class="stat-l">Spotlights</div></div>
      </div>
      <div style="padding:0 4px">
        <button class="btn-submit" onclick="H._admin.showAdForm()" style="width:100%;margin-bottom:14px">+ Create New Ad</button>
        ${ads.length ? ads.map(function(a){ return renderAdRow(a, now); }).join('') : '<div style="text-align:center;padding:30px 16px;color:var(--sub)">No paid ads yet.<br>Create one to start showing businesses on the app.</div>'}
      </div>`;
  }

  function renderAdRow(a, now) {
    var isLive = a.active && a.endsAt > now;
    var endDate = new Date(a.endsAt).toLocaleDateString('en-ZW', {day:'numeric',month:'short',year:'numeric'});
    var typeLabel = a.type === 'banner' ? '🖼 Banner' : ('⭐ Spotlight · ' + (a.targetCat || ''));
    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        ${a.imageUrl ? '<img src="'+escHtml(a.imageUrl)+'" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0">' : '<div style="width:44px;height:44px;border-radius:10px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'+(a.type==='banner'?'🖼':'⭐')+'</div>'}
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.businessName)}</div>
          <div style="font-size:11px;color:var(--sub);margin-top:2px">${typeLabel} · ends ${endDate}</div>
        </div>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;flex-shrink:0;${isLive?'background:#F0FDF4;color:#00A651':'background:var(--border);color:var(--sub)'}">${isLive?'LIVE':'OFF'}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="ml-act-btn" onclick="H._admin.toggleAd('${a.id}')">${isLive ? 'Pause' : 'Activate'}</button>
        <button class="ml-act-btn" onclick="H._admin.showAdForm('${a.id}')">Edit</button>
        <button class="ml-act-btn red" onclick="H._admin.deleteAd('${a.id}')">Delete</button>
      </div>
    </div>`;
  }

  // ── ADMIN ACTIONS ─────────────────────────────────────────
  H._admin = {
    setTab(t) {
      _adminTab = t;
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab===t));
      const body = document.getElementById('adminBody');
      if (body) body.innerHTML = renderBody();
      if (t === 'verifications') {
        syncVerificationsFromSupabase().then(function () { if (body) body.innerHTML = renderBody(); });
      } else if (t === 'reports' && typeof H.syncReports === 'function') {
        H.syncReports().then(function () { if (body) body.innerHTML = renderBody(); });
      } else if (t === 'messages' && typeof H.syncConversations === 'function') {
        H.syncConversations().then(function () { if (body) body.innerHTML = renderBody(); });
      }
    },

    filterUsers(q) {
      const ql = q.toLowerCase();
      const el = document.getElementById('adminUsersList');
      if (el) el.innerHTML = (H.state.users||[]).filter(u=>(u.name+u.email+u.phone).toLowerCase().includes(ql)).map(userRow).join('');
    },

    filterListings(q) {
      const ql = q.toLowerCase();
      const el = document.getElementById('adminLList');
      if (el) el.innerHTML = (H.state.listings||[]).filter(l=>(l.title+l.city).toLowerCase().includes(ql)).sort((a,b)=>b.createdAt-a.createdAt).map(listingRow).join('');
    },

    filterListingsByStatus(status) {
      const el = document.getElementById('adminLList');
      if (!el) return;
      const list = (H.state.listings||[]).filter(l=>status==='all'?true:l.status===status);
      el.innerHTML = list.sort((a,b)=>b.createdAt-a.createdAt).map(listingRow).join('');
      document.querySelectorAll('[data-lstatus]').forEach(b=>b.classList.toggle('on',b.dataset.lstatus===status));
    },

    filterTickets(f) {
      const body = document.getElementById('adminBody');
      if (body) body.innerHTML = renderSupport(f);
    },

    filterReports(f) {
      const body = document.getElementById('adminBody');
      if (body) body.innerHTML = renderReports(f);
    },

    approveTopup(rid) {
      if (!adminGuard()) return;
      const r = (H.state.topupRequests||[]).find(x=>x.id===rid); if (!r) return;
      const u = (H.state.users||[]).find(x=>x.id===r.userId); if (!u) return;
      r.status = 'approved';
      const amount = Number(r.amount);
      H.state.txns = H.state.txns||[];
      H.state.txns.unshift({id:uid(),userId:u.id,type:'topup',amt:amount,note:`Top-up via ${r.method||'EcoCash'} (ref: ${r.reference||r.ref||'—'})`,t:Date.now()});
      alog(`Approved top-up $${amount} for ${u.name}`);
      // Sync to Supabase
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('topup_requests').update({ status: 'approved' }).eq('id', rid);
      }
      saveState(); toast(`$${amount.toFixed(2)} credited to ${u.name}`); this.setTab('payments');
    },

    rejectTopup(rid) {
      if (!adminGuard()) return;
      const r = (H.state.topupRequests||[]).find(x=>x.id===rid); if (!r) return;
      const u = (H.state.users||[]).find(x=>x.id===r.userId);
      r.status = 'rejected';
      if (u) pushNotif(u.id,'Top-up Rejected','Your top-up could not be verified. Contact support if this is an error.');
      alog(`Rejected top-up ${rid}`);
      saveState(); toast('Top-up rejected'); this.setTab('payments');
    },

    banUser(uid_, type, reportId) {
      if (!adminGuard()) return;
      modal({
        title: type==='perm' ? 'Permanently Ban User' : 'Suspend User 7 Days',
        body: '<div class="fl">Reason</div><input class="fi" id="banReason" placeholder="Enter reason for action">',
        confirmText: type==='perm' ? 'Ban Permanently' : 'Suspend 7 Days',
        onConfirm: () => {
          const reason = document.getElementById('banReason')?.value || 'Policy violation';
          const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
          u.status = type==='perm' ? 'banned' : 'banned_temp';
          u.banReason = reason;
          if (type==='temp') u.banUntil = Date.now() + 7*86400000;
          const sb = window.supabase;
          if (sb && typeof sb.from === 'function') {
            sb.from('profiles').update({ status: u.status, ban_reason: reason }).eq('id', uid_).catch(()=>{});
          }
          if (reportId) { const r=(H.state.reports||[]).find(x=>x.id===reportId); if(r) r.status='resolved'; }
          alog(`${type==='perm'?'Banned':'Suspended'}: ${u.name} — ${reason}`);
          saveState(); toast(`User ${type==='perm'?'banned':'suspended'}`);
          this.setTab('users');
        }
      });
    },

    unban(uid_, reportId) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.status='active'; u.banReason=null; u.banUntil=null;
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('profiles').update({ status: 'active', ban_reason: null }).eq('id', uid_).catch(()=>{});
      }
      if (reportId) { const r=(H.state.reports||[]).find(x=>x.id===reportId); if(r) r.status='resolved'; }
      alog(`Unbanned: ${u.name}`);
      saveState(); toast('User unbanned'); this.setTab('users');
    },

    deleteUser(uid_) {
      if (!adminGuard()) return;
      modal({
        title: 'Delete User',
        body: 'This permanently deletes this user and all their listings. Cannot be undone.',
        confirmText: 'Delete User',
        onConfirm: () => {
          const u = (H.state.users||[]).find(x=>x.id===uid_);
          alog(`Deleted user: ${u?u.name:uid_}`);
          H.state.users = (H.state.users||[]).filter(x=>x.id!==uid_);
          H.state.listings = (H.state.listings||[]).filter(x=>x.sellerId!==uid_);
          saveState(); toast('User deleted'); this.setTab('users');
        }
      });
    },

    makeAdmin(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      modal({
        title: 'Make Admin',
        body: `Give admin access to ${escHtml(u.name)}? They will have full control of the platform.`,
        confirmText: 'Make Admin',
        onConfirm: () => {
          u.role='admin';
          const sb = window.supabase;
          if (sb && typeof sb.from === 'function') {
            sb.from('profiles').update({ role: 'admin' }).eq('id', uid_).catch(()=>{});
          }
          alog(`Made admin: ${u.name}`);
          saveState(); toast(`${u.name} is now an admin`); this.setTab('users');
        }
      });
    },

    verifyUser(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.verified=true; u.verifiedAt=Date.now();
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('profiles').update({ verified: true }).eq('id', uid_).catch(()=>{});
      }
      alog(`Verified: ${u.name}`);
      saveState(); toast(`${u.name} verified`); this.setTab('users');
    },

    approveVerification(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.verified=true; u.verifiedAt=Date.now(); u.verificationPending=false;
      alog(`Verification approved: ${u.name}`);
      pushNotif(uid_,'Identity Verified ✓','Congratulations! Your identity has been verified on PaMarket.','verify');
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('profiles').update({ verified: true, updated_at: new Date().toISOString() }).eq('id', uid_);
      }
      saveState(); toast(`${u.name} verified ✓`); this.setTab('verifications');
    },

    rejectVerification(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.verificationPending=false;
      alog(`Verification rejected: ${u.name}`);
      pushNotif(uid_,'Verification Unsuccessful','Your ID verification could not be approved. Contact support for help.','warn');
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('profiles').update({ verification_pending: false }).eq('id', uid_);
        sb.from('verifications').delete().eq('user_id', uid_);
      }
      saveState(); toast(`Verification rejected for ${u.name}`); this.setTab('verifications');
    },

    revokeVerification(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.verified=false; u.verifiedAt=null;
      alog(`Verification revoked: ${u.name}`);
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('profiles').update({ verified: false }).eq('id', uid_);
      }
      saveState(); toast(`Verification revoked for ${u.name}`); this.setTab('verifications');
    },

    verifyCompany(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.companyVerified = true; u.companyVerifiedAt = Date.now();
      alog(`Company verified: ${u.name}`);
      pushNotif(uid_,'Company Verified ✓','Your company account has been verified on PaMarket.','verify');
      saveState(); toast(`${u.name} company verified`); this.setTab('users');
    },

    revokeCompany(uid_) {
      if (!adminGuard()) return;
      const u = (H.state.users||[]).find(x=>x.id===uid_); if (!u) return;
      u.companyVerified = false;
      alog(`Company verification revoked: ${u.name}`);
      saveState(); toast(`Company verification revoked`); this.setTab('users');
    },

    approveListing(lid) {
      if (!adminGuard()) return;
      const l = (H.state.listings||[]).find(x=>x.id===lid); if (!l) return;
      l.status='active';
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('listings').update({ status: 'active' }).eq('id', lid).catch(()=>{});
      }
      pushNotif(l.sellerId,'Listing Approved',`Your listing "${l.title}" is now live!`);
      alog(`Approved listing: ${l.title}`);
      saveState(); toast('Listing approved and live'); this.setTab('listings');
    },

    rejectListing(lid) {
      if (!adminGuard()) return;
      const l = (H.state.listings||[]).find(x=>x.id===lid); if (!l) return;
      modal({
        title: 'Reject Listing',
        body: '<div class="fl">Reason for rejection</div><input class="fi" id="rejectReason" placeholder="e.g. Misleading content, prohibited item">',
        confirmText: 'Reject Listing',
        onConfirm: () => {
          const reason = document.getElementById('rejectReason')?.value || 'Policy violation';
          l.status='rejected'; l.rejectReason=reason;
          const sb = window.supabase;
          if (sb && typeof sb.from === 'function') {
            sb.from('listings').update({ status: 'rejected', reject_reason: reason }).eq('id', lid).catch(()=>{});
          }
          pushNotif(l.sellerId,'Listing Rejected',`Your listing "${l.title}" was rejected: ${reason}`);
          alog(`Rejected listing: ${l.title} — ${reason}`);
          saveState(); toast('Listing rejected'); this.setTab('listings');
        }
      });
    },

    banListing(lid, reportId) {
      if (!adminGuard()) return;
      const l = (H.state.listings||[]).find(x=>x.id===lid); if (!l) return;
      modal({
        title: 'Remove Listing',
        body: `Remove "${escHtml(l.title)}" from the marketplace? The seller will be notified.`,
        confirmText: 'Remove Listing',
        onConfirm: () => {
          l.status='banned';
          const sb = window.supabase;
          if (sb && typeof sb.from === 'function') {
            sb.from('listings').update({ status: 'banned' }).eq('id', lid).catch(()=>{});
          }
          if (reportId) { const r=(H.state.reports||[]).find(x=>x.id===reportId); if(r) r.status='resolved'; }
          pushNotif(l.sellerId,'Listing Removed',`Your listing "${l.title}" was removed for policy violation.`);
          alog(`Removed listing: ${l.title}`);
          saveState(); toast('Listing removed'); this.setTab('listings');
        }
      });
    },

    restoreListing(lid) {
      if (!adminGuard()) return;
      const l = (H.state.listings||[]).find(x=>x.id===lid); if (!l) return;
      l.status='active';
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('listings').update({ status: 'active' }).eq('id', lid).catch(()=>{});
      }
      alog(`Restored listing: ${l.title}`);
      saveState(); toast('Listing restored'); this.setTab('listings');
    },

    resolveReport(rid) {
      if (!adminGuard()) return;
      const r = (H.state.reports||[]).find(x=>x.id===rid); if (!r) return;
      r.status='resolved';
      alog(`Resolved report: ${rid}`);
      saveState(); toast('Report resolved'); this.setTab('reports');
    },

    toggleSetting(k) {
      if (!adminGuard()) return;
      H.state[k] = !H.state[k];
      alog(`Toggled setting: ${k} = ${H.state[k]}`);
      saveState(); toast('Setting updated');
      // Persist to Supabase so settings survive page reloads
      const sb = window.supabase;
      if (sb && typeof sb.from === 'function') {
        const KEYS = ['requireListingApproval','autoApproveVerified','allowImageUploads',
                      'signupPaused','requirePhoneVerification','enablePremiumListings','freeOnly'];
        const settingsObj = {};
        KEYS.forEach(key => { settingsObj[key] = !!H.state[key]; });
        sb.from('app_settings').upsert({ id: 1, settings: settingsObj, updated_at: new Date().toISOString() })
          .then(r => { if (r && r.error) console.warn('settings save:', r.error.message); });
      }
      this.setTab('settings');
    },

    async broadcast() {
      if (!adminGuard()) return;
      const title  = (document.getElementById('bcastTitle')?.value  || '').trim();
      const msg    = (document.getElementById('bcastMsg')?.value    || '').trim();
      const target = document.getElementById('bcastTarget')?.value  || 'all';
      if (!title || !msg) { toast('Enter title and message'); return; }

      const btn = document.getElementById('bcastSendBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      const c = window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
      let userIds = [];
      try {
        if (c && target !== 'sellers' && target !== 'inactive') {
          let q = c.from('profiles').select('id');
          if (target === 'verified')   q = q.eq('verified', true);
          if (target === 'unverified') q = q.eq('verified', false);
          const res = await q.limit(5000);
          if (res.data) userIds = res.data.map(p => p.id).filter(Boolean);
        } else if (c) {
          const [uRes, lRes] = await Promise.all([
            c.from('profiles').select('id').limit(5000),
            c.from('listings').select('seller_id').neq('status','banned').limit(10000)
          ]);
          const sellerSet = new Set((lRes.data||[]).map(l => l.seller_id).filter(Boolean));
          const allIds    = (uRes.data||[]).map(p => p.id).filter(Boolean);
          userIds = allIds.filter(id => target === 'sellers' ? sellerSet.has(id) : !sellerSet.has(id));
        } else {
          // Fallback to local state when Supabase unavailable
          const localUsers = H.state.users || [];
          const localSellers = new Set((H.state.listings||[]).map(l=>l.sellerId));
          userIds = localUsers.filter(u => {
            if (target==='verified')   return u.verified;
            if (target==='unverified') return !u.verified;
            if (target==='sellers')    return localSellers.has(u.id);
            if (target==='inactive')   return !localSellers.has(u.id);
            return true;
          }).map(u => u.id);
        }
      } catch(e) {
        console.warn('broadcast fetch error:', e);
        toast('Failed to fetch users. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Send Broadcast'; }
        return;
      }

      if (!userIds.length) {
        toast('No users found for this filter');
        if (btn) { btn.disabled = false; btn.textContent = 'Send Broadcast'; }
        return;
      }

      userIds.forEach(id => H.pushNotif(id, title, msg, 'system'));
      alog(`Broadcast (${target}) to ${userIds.length} users: ${msg.slice(0,50)}`);
      saveState();
      toast(`✓ Broadcast sent to ${userIds.length} user${userIds.length!==1?'s':''}`);
      document.getElementById('bcastTitle').value = '';
      document.getElementById('bcastMsg').value = '';
      if (btn) { btn.disabled = false; btn.textContent = 'Send Broadcast'; }
    },

    respondToTicket(tid) {
      const t = (H.state.supportTickets||[]).find(x=>x.id===tid); if (!t) return;
      const u = (H.state.users||[]).find(x=>x.id===t.userId)||{name:'User'};
      modal({
        title: `Reply to ${escHtml(u.name)}`,
        body: `<div class="fl">Ticket: ${escHtml(t.subject||'')}</div>
               <div class="fl" style="margin-top:10px">Your Response</div>
               <textarea class="fi" rows="4" id="ticketReply" placeholder="Type your response to the user..."></textarea>`,
        confirmText: 'Send Response',
        onConfirm: () => {
          const reply = document.getElementById('ticketReply')?.value?.trim();
          if (!reply) { toast('Enter a response'); return false; }
          if (!t.replies) t.replies = [];
          t.replies.push({ text: reply, from: 'admin', t: Date.now() });
          t.status = 'in-progress';
          pushNotif(t.userId, 'Support Reply', `Admin replied to: ${t.subject}`);
          alog(`Replied to ticket: ${t.subject}`);
          saveState(); toast('Response sent'); this.filterTickets('all');
        }
      });
    },

    updateTicketStatus(tid, status) {
      const t = (H.state.supportTickets||[]).find(x=>x.id===tid); if (!t) return;
      t.status = status;
      alog(`Ticket ${status}: ${t.subject||tid}`);
      saveState(); toast(`Ticket marked as ${status}`); this.filterTickets('all');
    },

    reopenTicket(tid) {
      const t = (H.state.supportTickets||[]).find(x=>x.id===tid); if (!t) return;
      t.status = 'open';
      alog(`Reopened ticket: ${t.subject||tid}`);
      saveState(); toast('Ticket reopened'); this.filterTickets('all');
    },

    exportData() {
      if (!adminGuard()) return;
      const data = JSON.stringify(H.state, null, 2);
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pamarket-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alog('Exported all data');
      saveState(); toast('Data exported');
    },

    clearOldData() {
      if (!adminGuard()) return;
      modal({
        title: 'Clear Old Data',
        body: 'Delete listings, transactions, and logs older than 30 days. Active listings are kept. Cannot be undone.',
        confirmText: 'Clear Old Data',
        onConfirm: () => {
          const cutoff = Date.now() - 30*86400000;
          const before = (H.state.listings||[]).length;
          H.state.listings  = (H.state.listings||[]).filter(l=>l.createdAt>cutoff||l.status==='active');
          H.state.txns      = (H.state.txns||[]).filter(t=>t.t>cutoff);
          H.state.adminLogs = (H.state.adminLogs||[]).filter(l=>l.t>cutoff);
          H.state.reports   = (H.state.reports||[]).filter(r=>r.t>cutoff||r.status==='open');
          alog(`Cleared old data: ${before-(H.state.listings||[]).length} listings removed`);
          saveState(); toast('Old data cleared'); this.setTab('settings');
        }
      });
    },

    resetApp() {
      if (!adminGuard()) return;
      modal({
        title: 'Reset App',
        body: '<p style="color:var(--red);font-weight:700;margin-bottom:10px">WARNING: Deletes ALL data including users, listings, and messages. Irreversible.</p><div class="fl">Type RESET to confirm</div><input class="fi" id="resetConfirm" placeholder="Type RESET">',
        confirmText: 'Reset Everything',
        onConfirm: () => {
          if (document.getElementById('resetConfirm')?.value?.trim()!=='RESET') {
            toast('Type RESET to confirm'); return false;
          }
          const admin = currentUser();
          H.state.users = [admin];
          H.state.listings = [];
          H.state.conversations = [];
          H.state.reports = [];
          H.state.txns = [];
          H.state.saves = {};
          H.state.notifs = {};
          H.state.supportTickets = [];
          H.state.adminLogs = [{action:'App reset by admin',adminName:admin.name,t:Date.now()}];
          saveState(); toast('App reset complete'); this.setTab('overview');
        }
      });
    },

    clearLogs() {
      if (!adminGuard()) return;
      modal({
        title: 'Clear Logs',
        body: 'This will delete all admin logs. Cannot be undone.',
        confirmText: 'Clear Logs',
        onConfirm: () => {
          H.state.adminLogs = [];
          saveState(); toast('Logs cleared'); this.setTab('logs');
        }
      });
    },

    showAdForm(id) {
      if (!adminGuard()) return;
      const ad = id ? (H.state.paidAds||[]).find(a=>a.id===id) : null;
      const today = new Date().toISOString().slice(0,10);
      const inAMonth = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
      const catOptions = CATS.map(c=>`<option value="${c}" ${ad&&ad.targetCat===c?'selected':''}>${c}</option>`).join('');
      H.modal({
        title: ad ? 'Edit Ad' : 'Create Paid Ad',
        body: `
          <div class="fg" style="margin-top:8px"><div class="fl">Ad Type</div>
            <select class="fi" id="_adType" onchange="document.getElementById('_spotlightRow').style.display=this.value==='spotlight'?'':'none'">
              <option value="banner" ${!ad||ad.type==='banner'?'selected':''}>🖼 Home Banner</option>
              <option value="spotlight" ${ad&&ad.type==='spotlight'?'selected':''}>⭐ Category Spotlight</option>
            </select></div>
          <div class="fg"><div class="fl">Business Name</div><input class="fi" id="_adBiz" value="${escHtml(ad?ad.businessName:'')}" placeholder="e.g. Mega Furniture Harare"></div>
          <div class="fg"><div class="fl">Headline / Tagline</div><input class="fi" id="_adHead" value="${escHtml(ad?ad.headline||'':'')}" placeholder="e.g. Best prices in Harare!"></div>
          <div class="fg"><div class="fl">Sub-tagline (optional)</div><input class="fi" id="_adTag" value="${escHtml(ad?ad.tagline||'':'')}" placeholder="e.g. Free delivery on orders over $50"></div>
          <div class="fg"><div class="fl">Image URL (optional)</div><input class="fi" id="_adImg" value="${escHtml(ad?ad.imageUrl||'':'')}" placeholder="https://... or leave blank for colour card"></div>
          <div class="fg"><div class="fl">Background Colour</div><div style="display:flex;align-items:center;gap:8px"><input type="color" id="_adColor" value="${ad?ad.bgColor||'#1A3A8F':'#1A3A8F'}" style="width:44px;height:36px;border:1px solid var(--border);border-radius:8px;cursor:pointer"><span id="_adColorHex" style="font-size:13px;color:var(--sub)">${ad?ad.bgColor||'#1A3A8F':'#1A3A8F'}</span></div></div>
          <div class="fg"><div class="fl">Tap Destination URL (optional)</div><input class="fi" id="_adLink" value="${escHtml(ad?ad.linkUrl||'':'')}" placeholder="https://wa.me/2637... or leave blank"></div>
          <div class="fg" id="_spotlightRow" style="display:${ad&&ad.type==='spotlight'?'':'none'}"><div class="fl">Target Category</div><select class="fi" id="_adCat">${catOptions}</select></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="fg"><div class="fl">Start Date</div><input class="fi" type="date" id="_adStart" value="${ad?new Date(ad.startsAt).toISOString().slice(0,10):today}"></div>
            <div class="fg"><div class="fl">End Date</div><input class="fi" type="date" id="_adEnd" value="${ad?new Date(ad.endsAt).toISOString().slice(0,10):inAMonth}"></div>
          </div>`,
        confirmText: ad ? 'Save Changes' : 'Create Ad',
        onConfirm: () => H._admin.saveAd(id)
      });
      setTimeout(()=>{
        const colorInput = document.getElementById('_adColor');
        if (colorInput) colorInput.oninput = function(){ const hex=document.getElementById('_adColorHex'); if(hex) hex.textContent=this.value; };
      }, 100);
    },

    saveAd(id) {
      const type  = (document.getElementById('_adType')||{}).value || 'banner';
      const biz   = ((document.getElementById('_adBiz')||{}).value||'').trim();
      const head  = ((document.getElementById('_adHead')||{}).value||'').trim();
      const tag   = ((document.getElementById('_adTag')||{}).value||'').trim();
      const img   = ((document.getElementById('_adImg')||{}).value||'').trim();
      const color = ((document.getElementById('_adColor')||{}).value||'#1A3A8F');
      const link  = ((document.getElementById('_adLink')||{}).value||'').trim();
      const cat   = ((document.getElementById('_adCat')||{}).value)||'';
      const start = new Date(((document.getElementById('_adStart')||{}).value)||new Date().toISOString().slice(0,10)).getTime();
      const end   = new Date(((document.getElementById('_adEnd')||{}).value)||new Date(Date.now()+30*86400000).toISOString().slice(0,10)).getTime();
      if (!biz) { toast('Enter business name', 4000, true); return false; }
      if (end <= start) { toast('End date must be after start date', 4000, true); return false; }
      H.state.paidAds = H.state.paidAds || [];
      if (id) {
        const ad = H.state.paidAds.find(a=>a.id===id);
        if (ad) Object.assign(ad, {type,businessName:biz,headline:head,tagline:tag,imageUrl:img,bgColor:color,linkUrl:link,targetCat:cat,startsAt:start,endsAt:end});
        alog(`Updated ad: ${biz}`);
      } else {
        H.state.paidAds.unshift({id:uid(),type,businessName:biz,headline:head,tagline:tag,imageUrl:img,bgColor:color,linkUrl:link,targetCat:cat,startsAt:start,endsAt:end,active:true,createdAt:Date.now()});
        alog(`Created ad: ${biz} (${type})`);
      }
      saveState(); toast('Ad saved!'); this.setTab('ads');
    },

    toggleAd(id) {
      const ad = (H.state.paidAds||[]).find(a=>a.id===id); if (!ad) return;
      ad.active = !ad.active;
      alog(`${ad.active?'Activated':'Paused'} ad: ${ad.businessName}`);
      saveState(); this.setTab('ads');
    },

    async syncAllMessages() {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') {
        toast('Supabase not available'); return;
      }
      const body = document.getElementById('adminBody');
      try {
        // Fetch messages and conversations in parallel
        const [msgsRes, convosRes] = await Promise.all([
          sb.from('messages').select('*').order('created_at', { ascending: false }).limit(500),
          sb.from('conversations').select('*').limit(200)
        ]);

        const msgs   = (msgsRes  && msgsRes.data)  || [];
        const convos = (convosRes && convosRes.data) || [];

        // Build conversations map from DB rows
        if (!H.state.conversations) H.state.conversations = [];
        const convoMap = {};
        H.state.conversations.forEach(function (c) { convoMap[c.id] = c; });

        convos.forEach(function (c) {
          const cid = c.id;
          if (!convoMap[cid]) {
            convoMap[cid] = {
              id: cid,
              participants: c.participant_ids || c.participants || [c.buyer_id, c.seller_id].filter(Boolean),
              buyerId:  c.buyer_id  || null,
              sellerId: c.seller_id || null,
              listingId: c.listing_id || null,
              createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
              messages: []
            };
          } else {
            // Merge fields
            const existing = convoMap[cid];
            if (!existing.participants || !existing.participants.length) {
              existing.participants = c.participant_ids || c.participants || [c.buyer_id, c.seller_id].filter(Boolean);
            }
          }
        });

        // Attach messages to conversations
        msgs.forEach(function (m) {
          const cid = m.conversation_id;
          if (!cid) return;
          if (!convoMap[cid]) {
            convoMap[cid] = { id: cid, participants: [], messages: [], createdAt: Date.now() };
          }
          const c = convoMap[cid];
          if (!c.messages) c.messages = [];
          const exists = c.messages.some(function (x) { return x.id === m.id; });
          if (!exists) {
            c.messages.push({
              id:        m.id,
              senderId:  m.sender_id  || m.senderId  || null,
              text:      m.content    || m.text       || m.body || '',
              createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
              read:      m.is_read    || m.read       || false
            });
          }
        });

        // Sort messages within each conversation
        Object.values(convoMap).forEach(function (c) {
          (c.messages || []).sort(function (a, b) { return a.createdAt - b.createdAt; });
        });

        H.state.conversations = Object.values(convoMap);

        // Collect all participant IDs and fetch missing profiles
        const knownIds = new Set((H.state.users || []).map(function (u) { return u.id; }));
        const missingIds = [];
        H.state.conversations.forEach(function (c) {
          (c.participants || []).forEach(function (id) { if (id && !knownIds.has(id)) missingIds.push(id); });
          if (c.buyerId  && !knownIds.has(c.buyerId))  missingIds.push(c.buyerId);
          if (c.sellerId && !knownIds.has(c.sellerId)) missingIds.push(c.sellerId);
        });
        const uniqueMissing = [...new Set(missingIds)];
        if (uniqueMissing.length) {
          const profilesRes = await sb.from('profiles').select('id,name,phone,email').in('id', uniqueMissing);
          const profiles = (profilesRes && profilesRes.data) || [];
          if (!H.state.users) H.state.users = [];
          profiles.forEach(function (p) {
            if (!H.state.users.find(function (u) { return u.id === p.id; })) {
              H.state.users.push({
                id: p.id, name: p.name || 'Unknown',
                email: p.email || '', phone: p.phone || '',
                role: 'user', status: 'active', joinedAt: Date.now()
              });
            }
          });
        }

        H.saveState();
        alog('Synced messages from cloud');
        if (body) body.innerHTML = renderBody();
        toast('Messages synced');
      } catch (e) {
        console.error('syncAllMessages error:', e);
        toast('Failed to sync messages');
      }
    },

    deleteAd(id) {
      const ad = (H.state.paidAds||[]).find(a=>a.id===id); if (!ad) return;
      modal({
        title: 'Delete Ad',
        body: `Remove the ad for <strong>${escHtml(ad.businessName)}</strong>? This cannot be undone.`,
        confirmText: 'Delete', danger: true,
        onConfirm: () => {
          H.state.paidAds = (H.state.paidAds||[]).filter(a=>a.id!==id);
          alog(`Deleted ad: ${ad.businessName}`);
          saveState(); toast('Ad deleted'); this.setTab('ads');
        }
      });
    }
  };

})(window.H = window.H || {});



;/* === www/js/verify.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const state = H.state;
  const { escHtml, uid, toast, pushNotif } = H;
  // Methods that use `this` must go through H so binding is correct
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState   = () => H.saveState();
  const goBack      = () => H.goBack();
  const renderPage  = (...a) => H.renderPage(...a);

  // Fallback SVG icons in case H.ICONS is not ready
  const icons = {
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    cross: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    lock:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    id:    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M10 14h4"/><circle cx="10" cy="17" r="1"/></svg>',
    camera:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
  };

  // Prefer H.ICONS if available, else fall back
  const I = window.H && H.ICONS ? { ...icons, ...H.ICONS } : icons;

  let camStream   = null;
  let livenessTimer = null;

  function stopCam() {
    if (livenessTimer) { clearInterval(livenessTimer); livenessTimer = null; }
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  }

  // ---------------------------------------------------
  // VERIFY PAGE
  // ---------------------------------------------------
  pages.Verify = function () {
    const u         = currentUser();
    const hasId     = !!u.idDocs;
    const hasSelfie = !!u.selfie;
    const isPending = !!u.verification_pending;

    if (u.verified) {
      return `<div class="page active">${innerTopbar('Identity Verified')}
        <div class="inner-content">
          <div class="verify-badge-preview">
            <div class="vbp-icon" style="color:#22c55e">${I.check}</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:#22c55e">You are verified <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#22c55e" stroke-width="3" style="vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg></div>
              <div style="font-size:12px;color:var(--sub);margin-top:2px">Buyers trust verified sellers more.</div>
            </div>
          </div>
          <div class="tip-box"><div class="tip-title">${I.lock} Blue badge active</div>
            <div class="tip-body">Your blue verified badge is now showing on all your listings and profile.</div>
          </div>
        </div>
      </div>`;
    }

    if (isPending) {
      return `<div class="page active">${innerTopbar('Verify Identity')}
        <div class="inner-content">
          <div style="background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.4);border-radius:16px;padding:20px;text-align:center;margin-bottom:18px">
            <div style="margin-bottom:8px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <div style="font-size:15px;font-weight:700;color:#fbbf24">Verification Pending</div>
            <div style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.5">
              Your ID and selfie have been submitted.<br>An admin will review your documents and approve your badge — usually within 24 hours.
            </div>
          </div>
          <div class="tip-box">
            <div class="tip-title">${I.lock} What happens next?</div>
            <div class="tip-body">Once approved you will get a notification and your blue <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> badge will appear on all your listings automatically.</div>
          </div>
          <button class="ml-act-btn" style="width:100%;padding:12px;margin-top:12px" onclick="H._verify.cancelPending()">Cancel request</button>
        </div>
      </div>`;
    }

    return `<div class="page active">${innerTopbar('Verify Identity')}
      <div class="inner-content">
        <div class="verify-badge-preview">
          <div class="vbp-icon">${I.shield || I.check}</div>
          <div>
            <div style="font-size:14px;font-weight:700">Get your Blue Verified Badge</div>
            <div style="font-size:12px;color:var(--sub);margin-top:1px">Verified sellers get 4× more enquiries</div>
          </div>
        </div>

        <div class="verify-step">
          <div class="verify-num done">${I.check}</div>
          <div>
            <div class="verify-step-title">Phone verified</div>
            <div class="verify-step-sub">${escHtml(u.phone)}</div>
          </div>
        </div>

        <div class="verify-step">
          <div class="verify-num ${hasId ? 'done' : ''}">${hasId ? I.check : `<span style="font-size:15px;font-weight:600">2</span>`}</div>
          <div style="flex:1">
            <div class="verify-step-title">Upload ID document</div>
            <div class="verify-step-sub">National ID, passport or driver's licence. Both sides if applicable.</div>
            <input type="file" id="idFile" accept="image/*" capture="environment" style="display:none" onchange="H._verify.onIdUpload(event)">
            <button class="verify-step-btn" onclick="document.getElementById('idFile').click()">
              ${I.camera} ${hasId ? 'Replace ID' : 'Upload ID'}
            </button>
            ${hasId ? `<img src="${u.idDocs}" style="width:100%;max-width:240px;border-radius:12px;margin-top:10px">` : ''}
          </div>
        </div>

        <div class="verify-step">
          <div class="verify-num ${hasSelfie ? 'done' : ''}">${hasSelfie ? I.check : `<span style="font-size:15px;font-weight:600">3</span>`}</div>
          <div style="flex:1">
            <div class="verify-step-title">Face Selfie</div>
            <div class="verify-step-sub">Take a clear photo of your face. An admin will review it alongside your ID.</div>
            <button class="verify-step-btn" onclick="H.openInner('SelfieCam')">
              ${I.camera} ${hasSelfie ? 'Re-take Selfie' : 'Take Selfie'}
            </button>
            ${hasSelfie ? `<img src="${u.selfie}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;margin-top:10px;border:3px solid var(--n4)">` : ''}
          </div>
        </div>

        ${hasId && hasSelfie ? `
          <button class="btn-pri" id="submitVerifyBtn" onclick="H._verify.submitForReview()">Submit for Admin Review</button>
          <div style="font-size:12px;color:var(--sub);text-align:center;margin-top:8px">Reviewed by our team within 24 hours.</div>
        ` : ''}

        <div class="tip-box" style="margin-top:14px">
          <div class="tip-title">${I.lock} Your data is secure</div>
          <div class="tip-body">Your ID and selfie are sent securely and used solely for identity verification. Never sold or shared.</div>
        </div>
      </div>
    </div>`;
  };

  // ---------------------------------------------------
  // SELFIE CAM
  // ---------------------------------------------------
  pages.SelfieCam = function () {
    return `<div class="page active">${innerTopbar('Take Selfie')}
      <div class="inner-content">
        <div style="font-size:13px;color:var(--sub);text-align:center;margin-bottom:12px;line-height:1.5">
          Position your face clearly in the oval.<br>An admin will manually review your photo.
        </div>
        <div class="cam-wrap" id="camWrap">
          <video id="camVideo" playsinline autoplay muted></video>
          <div class="face-guide"></div>
          <div class="cam-state" id="camState">Initializing camera…</div>
          <div class="cam-instr" id="camInstr">Position your face inside the oval</div>
        </div>
        <canvas id="camCanvas" style="display:none"></canvas>
        <button class="btn-pri" id="capBtn" onclick="H._verify.captureSelfie()" disabled>Take Photo</button>
        <button class="ml-act-btn" style="width:100%;padding:12px;margin-top:8px" onclick="H._verify.cancel()">Cancel</button>
      </div>
    </div>`;
  };

  pages.SelfieCam_after = async function () {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 }, audio: false });
      const v = document.getElementById('camVideo');
      v.srcObject = camStream;
      v.onloadedmetadata = () => {
        v.play();
        document.getElementById('camState').textContent = 'Ready';
        document.getElementById('capBtn').disabled = false;
        detectFace();
      };
    } catch (e) {
      document.getElementById('camState').textContent = 'Camera blocked';
      document.getElementById('camInstr').textContent = 'Please allow camera access in settings';
      toast('Camera permission denied');
    }
  };

  function detectFace() {
    const v = document.getElementById('camVideo');
    const c = document.getElementById('camCanvas');
    const ctx = c.getContext('2d');
    c.width = 160; c.height = 160;
    livenessTimer = setInterval(() => {
      if (!v.videoWidth) return;
      const sx = (v.videoWidth - Math.min(v.videoWidth, v.videoHeight)) / 2;
      const sy = (v.videoHeight - Math.min(v.videoWidth, v.videoHeight)) / 2;
      const sz = Math.min(v.videoWidth, v.videoHeight);
      ctx.drawImage(v, sx, sy, sz, sz, 0, 0, 160, 160);
      // Sample center-face region only (not edges — reduces hand false positives)
      const d = ctx.getImageData(50, 25, 60, 80).data;
      let skinPx = 0, total = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // Strict skin tone — requires reddish cast, not just warm
        if (r > 100 && g > 50 && b > 30 && r > g + 15 && r > b + 20 && Math.abs(r-g) > 15) skinPx++;
        total++;
      }
      const faceDetected = (skinPx / total) > 0.30; // 30% skin coverage required
      const el = document.getElementById('camState');
      if (el) el.textContent = faceDetected ? 'Face detected — tap Take Photo' : 'Position your face in the oval';
    }, 400);
  }

  // Namespace for onclick calls
  H._verify = {
    cancel() { stopCam(); goBack(); },

    onIdUpload(e) {
      const f = e.target.files[0]; if (!f) return;
      compressImage(f, 1400, 0.82).then(d => {
        const u = currentUser(); u.idDocs = d; saveState(); renderPage('Verify'); toast('ID uploaded');
      });
    },

    async cancelPending() {
      const u = currentUser();
      u.verification_pending = false;
      saveState();
      if (window.supabase) {
        await window.supabase.from('profiles').update({ verification_pending: false }).eq('id', u.id);
      }
      toast('Verification request cancelled');
      renderPage('Verify');
    },

    async submitForReview() {
      const u = currentUser();
      if (!u.idDocs || !u.selfie) { toast('Complete both steps first'); return; }
      const btn = document.getElementById('submitVerifyBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      try {
        if (!window.supabase) throw new Error('Not connected');
        // Save verification record with photos for admin review
        const { error: vErr } = await window.supabase.from('verifications').upsert({
          user_id: u.id,
          id_doc: u.idDocs,
          selfie: u.selfie,
          status: 'pending',
          submitted_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (vErr) throw vErr;
        // Mark profile as pending
        const { error: pErr } = await window.supabase.from('profiles')
          .update({ verification_pending: true })
          .eq('id', u.id);
        if (pErr) throw pErr;
        u.verification_pending = true;
        saveState();
        toast('Documents submitted! Admin will review within 24 hours.', 5000);
        renderPage('Verify');
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Admin Review'; }
        toast('Failed to submit: ' + (e.message || 'Check your connection'), 4000, true);
      }
    },

    async captureSelfie() {
      const btn = document.getElementById('capBtn');
      btn.disabled = true;
      btn.textContent = 'Capturing…';
      const v = document.getElementById('camVideo');
      const c = document.getElementById('camCanvas');
      const ctx = c.getContext('2d');
      // Short countdown then snap
      document.getElementById('camInstr').textContent = 'Hold still — capturing…';
      document.getElementById('camState').textContent = '3…';
      await new Promise(r => setTimeout(r, 800));
      document.getElementById('camState').textContent = '2…';
      await new Promise(r => setTimeout(r, 800));
      document.getElementById('camState').textContent = '1…';
      await new Promise(r => setTimeout(r, 800));

      const sz = Math.min(v.videoWidth, v.videoHeight);
      c.width = 480; c.height = 480;
      ctx.drawImage(v, (v.videoWidth - sz) / 2, (v.videoHeight - sz) / 2, sz, sz, 0, 0, 480, 480);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);

      document.getElementById('camState').textContent = 'Photo taken';
      document.getElementById('camInstr').textContent = 'Saving selfie…';
      await new Promise(r => setTimeout(r, 600));

      const u = currentUser(); u.selfie = dataUrl; saveState();
      toast('Selfie saved');
      stopCam();
      renderPage('Verify');
    }
  };

  function compressImage(file, maxDim = 1200, q = 0.8) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = ev => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = h * maxDim / w; w = maxDim; }
          else if (h > maxDim)     { w = w * maxDim / h; h = maxDim; }
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          res(c.toDataURL('image/jpeg', q));
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(file);
    });
  }

})(window.H);
;/* === www/js/jobs.js === */
'use strict';
(function (H) {

  var JOB_CATS = ['Accounting & Finance', 'Sales & Marketing', 'IT & Technology', 'Construction', 'Healthcare', 'Education', 'Hospitality', 'Administration', 'Engineering', 'Driving & Logistics'];

  function parseLine(lines, key) {
    var found = lines.find(function (ln) { return ln.startsWith(key + ':'); });
    return found ? found.slice(key.length + 1).trim() : '';
  }

  function jobCard(l) {
    var lines = (l.desc || '').split('\n');
    var company  = l.company || l.sellerName || parseLine(lines, 'COMPANY') || 'Company';
    var jobType  = parseLine(lines, 'JOB TYPE') || '';
    var salary   = parseLine(lines, 'SALARY') || 'Negotiable';
    var industry = parseLine(lines, 'INDUSTRY') || '';
    var seller   = (H.state.users || []).find(function(u){ return u.id === l.sellerId; });
    var coVerified = seller && (seller.companyVerified || seller.verified);
    var verBadge = coVerified ? '<span style="background:#059669;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;margin-left:4px"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></span>' : '';
    var logoHtml = (l.photos && l.photos[0])
      ? '<img src="' + l.photos[0] + '" style="width:46px;height:46px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid var(--border)">'
      : '<div style="width:46px;height:46px;border-radius:12px;background:#1A3A8F14;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px;font-weight:800;color:#1A3A8F">' + (company.slice(0,2).toUpperCase()) + '</div>';

    return '<div onclick="H.openInner(\'JobDetail\',{id:\'' + l.id + '\'})" style="background:var(--card);border-radius:16px;padding:16px;margin-bottom:10px;border:1px solid var(--border);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.05)">'
      + '<div style="display:flex;align-items:flex-start;gap:12px">'
      + logoHtml
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:13px;font-weight:600;color:#1A3A8F;margin-bottom:6px;display:flex;align-items:center">' + H.escHtml(company) + verBadge + (industry ? '<span style="color:var(--sub);font-weight:400;margin-left:4px">· ' + H.escHtml(industry) + '</span>' : '') + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:5px">'
      + (jobType ? '<span style="background:#1A3A8F14;color:#1A3A8F;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px">' + H.escHtml(jobType) + '</span>' : '')
      + (salary ? '<span style="background:#F5A62314;color:#c07800;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' + H.escHtml(salary) + '</span>' : '')
      + (l.city ? '<span style="background:var(--bg);color:var(--sub);font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:3px">' + H.ICONS.location + H.escHtml(l.city) + '</span>' : '')
      + '<span style="color:var(--sub);font-size:11px;padding:3px 0">' + H.timeAgo(l.createdAt) + '</span>'
      + '</div></div></div></div>';
  }

  H.pages.Jobs = function () {
    var jobs = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'jobs'; });
    var candidates = (H.state.users || []).filter(function (u) { return u.openToWork; });
    var recent = jobs.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 5);

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#F5A623">'
      + '<button class="back" onclick="H.goBack()" style="color:#1A3A8F"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#1A3A8F">Jobs in Zimbabwe</div>'
      + '<button onclick="H.openInner(\'PostJob\')" style="background:#1A3A8F;border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px">+ Post Job</button>'
      + '</div>'
      + '<div style="background:linear-gradient(135deg,#F5A623,#f07b00);padding:20px 16px 24px">'
      + '<div style="font-size:22px;font-weight:900;color:#1A3A8F;margin-bottom:4px">Find Your Dream Job</div>'
      + '<div style="font-size:13px;color:rgba(26,58,143,.75);margin-bottom:16px">' + jobs.length + ' opening' + (jobs.length !== 1 ? 's' : '') + ' across Zimbabwe</div>'
      + '<div style="background:rgba(255,255,255,.95);border-radius:14px;display:flex;align-items:center;padding:0 14px;gap:8px">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#999" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input placeholder="Search job title, company, skills…" autocomplete="off" oninput="H.openInner(\'FindJobs\',{q:this.value})" style="flex:1;border:none;outline:none;padding:14px 0;font-size:14px;background:transparent;color:#1A3A8F;font-family:Inter,sans-serif"></div>'
      + '</div>'
      + '<div style="padding:16px 14px;display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + '<div onclick="H.openInner(\'FindJobs\')" style="background:#1A3A8F;border-radius:16px;padding:20px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(26,58,143,.25)">'
      + '<div style="margin-bottom:8px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg></div>'
      + '<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:4px">Find Jobs</div>'
      + '<div style="font-size:12px;color:rgba(255,255,255,.7)">' + jobs.length + ' openings</div></div>'
      + '<div onclick="H.openInner(\'HireTalent\')" style="background:#fff;border-radius:16px;padding:20px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.08);border:2px solid #F5A623">'
      + '<div style="margin-bottom:8px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#1A3A8F" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>'
      + '<div style="font-size:16px;font-weight:800;color:#1A3A8F;margin-bottom:4px">Hire Talent</div>'
      + '<div style="font-size:12px;color:var(--sub)">' + candidates.length + ' candidate' + (candidates.length !== 1 ? 's' : '') + '</div></div>'
      + '</div>'
      + '<div onclick="H.openInner(\'JobSeekerProfile\')" style="margin:0 14px 12px;background:linear-gradient(135deg,#22c55e,#15803d);border-radius:16px;padding:16px 20px;cursor:pointer;display:flex;align-items:center;justify-content:space-between">'
      + '<div><div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:2px">Looking for Work?</div><div style="font-size:12px;color:rgba(255,255,255,.8)">Build your CV profile and let employers find you</div></div>'
      + '<div style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div></div>'
      + '<div style="padding:0 14px 12px">'
      + '<div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:10px">Browse by Category</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">'
      + JOB_CATS.map(function (cat) {
        var cnt = jobs.filter(function (j) { return (j.title + ' ' + (j.desc || '')).toLowerCase().includes(cat.split(' ')[0].toLowerCase()); }).length;
        return '<div onclick="H.openInner(\'FindJobs\',{cat:\'' + cat + '\'})" style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text)">' + H.escHtml(cat) + '<span style="color:var(--sub);margin-left:4px">(' + cnt + ')</span></div>';
      }).join('')
      + '</div></div>'
      + (recent.length ? '<div style="padding:0 14px 16px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
        + '<div style="font-size:15px;font-weight:800;color:var(--text)">Recent Openings</div>'
        + '<button onclick="H.openInner(\'FindJobs\')" style="background:none;border:none;color:#1A3A8F;font-size:12px;font-weight:700;cursor:pointer;padding:0">View All →</button>'
        + '</div>' + recent.map(jobCard).join('') + '</div>' : '')
      + '<div style="margin:0 14px 88px;background:linear-gradient(135deg,#1A3A8F,#0f2460);border-radius:16px;padding:20px">'
      + '<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:6px">Hiring? Post a Job Free</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.7);margin-bottom:14px">Reach thousands of qualified candidates across Zimbabwe</div>'
      + '<button onclick="H.openInner(\'PostJob\')" style="background:#F5A623;border:none;color:#1A3A8F;font-size:14px;font-weight:800;padding:12px 24px;border-radius:10px;cursor:pointer">Post a Job →</button>'
      + '</div></div>';
  };

  H.pages.FindJobs = function (params) {
    params = params || {};
    var jobs = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'jobs'; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });

    var filterHtml = H._sel('findjobs', 'subcat', 'Job Category', [['all', 'All Categories']].concat(JOB_CATS.map(function (c) { return [c, c]; })).concat([['Other', 'Other']]))
      + H._sel('findjobs', 'fuelType', 'Job Type', [['all', 'All'], ['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contract', 'Contract'], ['freelance', 'Freelance'], ['internship', 'Internship']])
      + H._sel('findjobs', 'propType', 'Qualification', [['all', 'All'], ['none', 'No formal qualification'], ['certificate', 'Certificate / Diploma'], ['degree', 'Degree'], ['postgrad', 'Postgraduate']])
      + H._citysel('findjobs') + H._priceRange('findjobs') + H._sortsel('findjobs');

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#F5A623">'
      + '<button class="back" onclick="H.goBack()" style="color:#1A3A8F"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#1A3A8F">Find Jobs</div>'
      + '<button onclick="H.openInner(\'PostJob\')" style="background:#1A3A8F;border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px">+ Post</button>'
      + '</div>'
      + '<div style="background:#F5A623;padding:0 12px 12px">'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<div style="background:rgba(255,255,255,.9);border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px;flex:1">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#999" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="cs_findjobs" placeholder="Search jobs…" autocomplete="off" value="' + H.escHtml(params.q || '') + '" oninput="H._applyJobFilters()" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:#1A3A8F;font-family:Inter,sans-serif"></div>'
      + '<button onclick="H._toggleFilters(\'findjobs\')" style="background:rgba(255,255,255,.25);border:none;color:#1A3A8F;padding:10px 12px;border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>Filter'
      + '<span id="fb_findjobs" style="display:none;background:#1A3A8F;color:#fff;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px"></span></button>'
      + '</div>'
      + '<div style="color:rgba(26,58,143,.75);font-size:12px;font-weight:600;margin-top:8px"><span id="cc_findjobs">' + jobs.length + ' jobs</span></div>'
      + '</div>'
      + '<div id="fp_findjobs" style="display:none;background:var(--card);border-bottom:2px solid #F5A623;padding:16px 14px">'
      + filterHtml
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button onclick="H._clearFilters(\'findjobs\')" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer">Clear</button>'
      + '<button onclick="H._toggleFilters(\'findjobs\')" style="flex:2;padding:10px;background:#F5A623;border:none;border-radius:10px;font-size:13px;font-weight:700;color:#1A3A8F;cursor:pointer">Apply Filters</button>'
      + '</div></div>'
      + '<div id="cl_findjobs" style="padding:12px 12px 88px">'
      + (jobs.length ? jobs.map(jobCard).join('') : H.emptyState('No jobs yet', 'Check back soon!', 'Post a Job', "H.openInner('PostJob')"))
      + '</div></div>';
  };

  H.pages.FindJobs_after = function (params) {
    params = params || {};
    H._filters['findjobs'] = {};
    if (params.cat) H._filters['findjobs'].subcat = params.cat;
    H._applyJobFilters();
  };

  H._applyJobFilters = function () {
    var el = document.getElementById('cl_findjobs');
    if (!el) return;
    var f = H._filters['findjobs'] || {};
    var jobs = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'jobs'; });
    var q = ((document.getElementById('cs_findjobs') || {}).value || '').toLowerCase().trim();
    if (q) jobs = jobs.filter(function (l) { return (l.title + ' ' + (l.desc || '') + ' ' + (l.city || '') + ' ' + (l.sellerName || '')).toLowerCase().includes(q); });
    if (f.city && f.city !== 'all') jobs = jobs.filter(function (l) { return (l.city + ' ' + (l.prov || '')).toLowerCase().includes(f.city.toLowerCase()); });
    if (f.subcat && f.subcat !== 'all') jobs = jobs.filter(function (l) { return (l.title + ' ' + (l.desc || '')).toLowerCase().includes(f.subcat.split(' ')[0].toLowerCase()); });
    if (f.fuelType && f.fuelType !== 'all') jobs = jobs.filter(function (l) { return (l.desc || '').toLowerCase().includes(f.fuelType.replace('-', ' ')); });
    if (f.priceMin) jobs = jobs.filter(function (l) { return (l.price || 0) >= +f.priceMin; });
    if (f.priceMax) jobs = jobs.filter(function (l) { return (l.price || 0) <= +f.priceMax; });
    jobs.sort(function (a, b) { return b.createdAt - a.createdAt; });
    el.innerHTML = jobs.length ? jobs.map(jobCard).join('') : H.emptyState('No jobs match', 'Try adjusting your filters', null, null);
    var cnt = document.getElementById('cc_findjobs');
    if (cnt) cnt.textContent = jobs.length + ' job' + (jobs.length !== 1 ? 's' : '');
    var n = Object.keys(f).filter(function (k) { return f[k] && f[k] !== 'all' && f[k] !== '' && f[k] !== 'newest'; }).length;
    var badge = document.getElementById('fb_findjobs');
    if (badge) { badge.textContent = n || ''; badge.style.display = n ? 'flex' : 'none'; }
  };

  H.pages.HireTalent = function () {
    var candidates = (H.state.users || []).filter(function (u) {
      return u.openToWork || (u.cv && u.cv.visible !== false && (u.cv.headline || u.cv.summary || (u.cv.experience && u.cv.experience.length)));
    });
    var sectors = ['All'].concat(JOB_CATS);
    var ZW = H._ZW_CITIES || [];

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#1A3A8F"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="det-topbar-title">Hire Talent</div></div>'
      + '<div style="background:#1A3A8F;padding:0 12px 14px">'
      + '<div style="background:rgba(255,255,255,.13);border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="talentQ" placeholder="Search by name, skill, title…" autocomplete="off" oninput="H._filterTalent()" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:#fff;font-family:Inter,sans-serif"></div>'
      + '<div style="color:rgba(255,255,255,.65);font-size:12px;font-weight:600;margin-top:8px"><span id="talentCount">' + candidates.length + ' candidate' + (candidates.length !== 1 ? 's' : '') + '</span></div>'
      + '</div>'
      + '<div id="sectorTabs" style="background:var(--card);border-bottom:1px solid var(--border);overflow-x:auto;white-space:nowrap;padding:10px 14px;display:flex;gap:8px">'
      + sectors.map(function (s, i) {
        return '<button onclick="H._talentSector(\'' + s + '\')" style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:1.5px solid ' + (i === 0 ? '#1A3A8F' : 'var(--border)') + ';background:' + (i === 0 ? '#1A3A8F' : 'var(--bg)') + ';color:' + (i === 0 ? '#fff' : 'var(--text)') + ';font-size:12px;font-weight:700;cursor:pointer">' + H.escHtml(s) + '</button>';
      }).join('')
      + '</div>'
      + '<div style="padding:10px 14px;display:flex;gap:8px;overflow-x:auto;border-bottom:1px solid var(--border)">'
      + '<div style="flex-shrink:0"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">City</div>'
      + '<select onchange="H._setFilter(\'talent\',\'city\',this.value);H._filterTalent()" style="padding:8px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none">'
      + '<option value="all">All Cities</option>' + ZW.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') + '</select></div>'
      + '<div style="flex-shrink:0;margin-left:8px"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Experience</div>'
      + '<select onchange="H._setFilter(\'talent\',\'exp\',this.value);H._filterTalent()" style="padding:8px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none">'
      + '<option value="all">Any</option><option value="entry">Entry Level</option><option value="mid">3-5 Years</option><option value="senior">5+ Years</option><option value="expert">10+ Years</option></select></div>'
      + '</div>'
      + '<div id="talentList" style="padding:12px 14px 88px">'
      + (candidates.length ? candidates.map(_candidateCard).join('') : _emptyTalent())
      + '</div></div>';
  };

  H.pages.HireTalent_after = function () {
    H._currentTalentSector = 'All';
    var _sb = window.supabase;
    if (!_sb || typeof _sb.from !== 'function') return;
    // Load profiles that are open to work OR have a CV set to visible
    _sb.from('profiles')
      .select('id,name,phone,email,avatar,verified,job_title,skills,sector,exp,city,open_to_work,cv')
      .or('open_to_work.eq.true,cv->visible.eq.true')
      .limit(200)
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return;
        res.data.forEach(function (p) {
          var ex = (H.state.users || []).find(function (u) { return u.id === p.id; });
          var cvData = typeof p.cv === 'string' ? JSON.parse(p.cv || '{}') : (p.cv || null);
          if (!ex) {
            (H.state.users = H.state.users || []).push({
              id: p.id, name: p.name || 'User', phone: p.phone || '',
              email: p.email || '', avatar: p.avatar || null,
              verified: p.verified || false, openToWork: p.open_to_work || false,
              jobTitle: p.job_title || '', skills: p.skills || '',
              sector: p.sector || '', exp: p.exp || '', city: p.city || '',
              cv: cvData || null
            });
          } else {
            ex.openToWork = p.open_to_work || ex.openToWork;
            ex.jobTitle   = p.job_title   || ex.jobTitle   || '';
            ex.skills     = p.skills      || ex.skills     || '';
            ex.sector     = p.sector      || ex.sector     || '';
            ex.exp        = p.exp         || ex.exp        || '';
            ex.city       = p.city        || ex.city       || '';
            if (cvData) ex.cv = cvData;
          }
        });
        H.saveState();
        H._filterTalent();
      });
  };

  H._talentSector = function (sector) {
    H._currentTalentSector = sector;
    document.querySelectorAll('#sectorTabs button').forEach(function (btn) {
      var active = btn.textContent.trim() === sector;
      btn.style.background = active ? '#1A3A8F' : 'var(--bg)';
      btn.style.color = active ? '#fff' : 'var(--text)';
      btn.style.borderColor = active ? '#1A3A8F' : 'var(--border)';
    });
    H._filterTalent();
  };

  H._filterTalent = function () {
    var el = document.getElementById('talentList');
    var cnt = document.getElementById('talentCount');
    if (!el) return;
    var q = ((document.getElementById('talentQ') || {}).value || '').toLowerCase();
    var sector = H._currentTalentSector || 'All';
    var f = H._filters['talent'] || {};
    var list = (H.state.users || []).filter(function (u) {
      return u.openToWork || (u.cv && u.cv.visible !== false && (u.cv.headline || u.cv.summary || (u.cv.experience && u.cv.experience.length)));
    });
    if (q) list = list.filter(function (u) {
      var cv = u.cv || {};
      var searchText = [u.name||'', u.jobTitle||'', cv.headline||'', cv.summary||'',
        (cv.skills||[]).join(' '), (cv.experience||[]).map(function(e){return (e.title||'')+(e.company||'');}).join(' '),
        u.city||'', cv.location||''].join(' ').toLowerCase();
      return searchText.includes(q);
    });
    if (sector && sector !== 'All') list = list.filter(function (u) {
      var cv = u.cv || {};
      var text = [(u.sector||''), (u.jobTitle||''), (cv.headline||''), (cv.skills||[]).join(' ')].join(' ').toLowerCase();
      return text.includes(sector.split(' ')[0].toLowerCase());
    });
    if (f.city && f.city !== 'all') list = list.filter(function (u) {
      return ((u.cv && u.cv.location || u.city) || '').toLowerCase().includes(f.city.toLowerCase());
    });
    if (cnt) cnt.textContent = list.length + ' candidate' + (list.length !== 1 ? 's' : '');
    el.innerHTML = list.length ? list.map(_candidateCard).join('') : _emptyTalent();
  };

  function _candidateCard(u) {
    var ini = H.initials(u.name || 'U');
    var cv  = u.cv || {};
    var verBadge = u.verified
      ? '<span style="background:#059669;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;margin-left:6px;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>'
      : '';
    var headline = cv.headline || u.jobTitle || 'Open to Work';
    var location = cv.location || u.city || '';
    var expCount = (cv.experience || []).length;
    var rawSkills = cv.skills && cv.skills.length ? cv.skills : (u.skills || '').split(',').filter(Boolean);
    var skills = rawSkills.slice(0, 4).map(function(s){ return s.trim(); }).filter(Boolean);
    var latestExp = cv.experience && cv.experience[0];
    var expectedSal = u.expectedSalary || (cv.expectedSalary ? '$' + cv.expectedSalary + '/mo' : '');

    // Contact logic
    var waFull  = u.whatsappFull || '';
    var callNum = u.phoneForCalls || waFull;
    var canWa   = !!waFull   && (u.contactMethod !== 'call');
    var canCall = !!callNum  && (u.contactMethod !== 'whatsapp');
    var waUrl   = 'https://wa.me/' + waFull + '?text=' + encodeURIComponent('Hi ' + (u.name || '') + ', I saw your profile on PaMarket and I have a job opportunity for you.');
    var hasDirectContact = canWa || canCall;
    var msgStyle = hasDirectContact
      ? 'flex:1;padding:9px;background:var(--bg);color:#1A3A8F;border:1.5px solid #1A3A8F;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit'
      : 'flex:1;padding:9px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit';

    return '<div style="background:var(--card);border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.05)">'
      + '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">'
      + '<div style="width:50px;height:50px;border-radius:50%;overflow:hidden;flex-shrink:0">'
      + (u.avatar ? '<img src="' + u.avatar + '" style="width:100%;height:100%;object-fit:cover">' : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#3a6fd8);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff">' + ini + '</div>')
      + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:2px"><div style="font-size:15px;font-weight:700;color:var(--text)">' + H.escHtml(u.name || 'Anonymous') + '</div>' + verBadge + '</div>'
      + '<div style="font-size:13px;color:#1A3A8F;font-weight:600;margin-bottom:2px">' + H.escHtml(headline) + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--sub)">'
      + (location ? '<span style="display:inline-flex;align-items:center;gap:3px">' + H.ICONS.location + H.escHtml(location) + '</span>' : '')
      + (expCount ? '<span style="display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>' + expCount + ' position' + (expCount!==1?'s':'') + '</span>' : '')
      + (expectedSal ? '<span style="display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' + H.escHtml(expectedSal) + '</span>' : '')
      + '</div></div></div>'
      + (latestExp ? '<div style="background:var(--bg);border-radius:10px;padding:8px 10px;margin-bottom:8px;border-left:3px solid #1A3A8F">'
          + '<div style="font-size:12px;font-weight:700;color:var(--text)">' + H.escHtml(latestExp.title) + '</div>'
          + '<div style="font-size:11px;color:var(--sub);margin-top:1px">' + H.escHtml(latestExp.company) + (latestExp.duration ? ' · ' + H.escHtml(latestExp.duration) : '') + '</div>'
          + '</div>' : '')
      + (skills.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">' + skills.map(function (s) { return '<span style="background:#1A3A8F12;border:1px solid #1A3A8F22;font-size:11px;padding:2px 8px;border-radius:6px;color:#1A3A8F;font-weight:600">' + H.escHtml(s) + '</span>'; }).join('') + '</div>' : '')
      + (cv.summary ? '<div style="font-size:12px;color:var(--sub);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + H.escHtml(cv.summary) + '</div>' : '')
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button onclick="H.startChatWith(\'' + u.id + '\')" style="' + msgStyle + ';display:inline-flex;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Message</button>'
      + (canWa ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" style="flex:1;padding:9px;background:#25D366;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp</a>' : '')
      + (canCall ? '<a href="tel:+' + H.escHtml(callNum) + '" style="flex:1;padding:9px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call</a>' : '')
      + '<button onclick="H.openInner(\'ViewCandidateCV\',{id:\'' + u.id + '\'})" style="flex:1;padding:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">' + (hasDirectContact ? 'CV' : 'View CV') + '</button>'
      + '</div></div>';
  }

  function _cvSection(title, body) {
    return '<div style="margin-bottom:20px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;display:flex;align-items:center;gap:8px">'
      + '<span style="flex:1;height:1px;background:var(--border)"></span>' + H.escHtml(title) + '<span style="flex:1;height:1px;background:var(--border)"></span></div>'
      + body + '</div>';
  }

  H.pages.ViewCandidateCV = function (params) {
    var uid = params && params.id;
    var u = uid ? (H.state.users || []).find(function (x) { return x.id === uid; }) : null;
    if (!u) return '<div class="page active">' + H.innerTopbar('Candidate CV') + H.emptyState('Not found', 'Candidate profile unavailable', null, null) + '</div>';
    var me = H.currentUser();
    var isMine = !!(me && me.id === uid);
    var cv  = u.cv || {};
    var ini = H.initials(u.name || 'U');
    var verBadge = u.verified ? '<span style="background:#059669;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>' : '';
    var expLvl = { entry: 'Entry Level (0–2 yrs)', mid: '3–5 Years', senior: '5–10 Years', expert: '10+ Years' }[u.exp || ''] || '';
    var skills = cv.skills && cv.skills.length ? cv.skills : (u.skills || '').split(',').filter(Boolean).map(function (s) { return s.trim(); }).filter(Boolean);
    var exp   = cv.experience     || [];
    var edu   = cv.education      || [];
    var certs = cv.certifications || [];
    var headline    = cv.headline || u.jobTitle || 'Open to Work';
    var location    = cv.location || u.city || '';
    var summary     = cv.summary  || '';
    var expectedSal = cv.expectedSalary ? '$' + cv.expectedSalary + '/mo' : (u.expectedSalary || '');
    var waFull  = u.whatsappFull || '';
    var callNum = u.phoneForCalls || waFull;
    var canWa   = !!waFull   && (u.contactMethod !== 'call');
    var canCall = !!callNum  && (u.contactMethod !== 'whatsapp');
    var waUrl   = 'https://wa.me/' + waFull + '?text=' + encodeURIComponent('Hi ' + (u.name || '') + ', I saw your profile on PaMarket and I have a job opportunity for you.');
    var jobTypes = (u.jobTypes || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);

    return '<div class="page active">'
      + H.innerTopbar('Candidate CV')
      + '<div style="padding-bottom:100px">'
      // ── header ──
      + '<div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952c8 100%);padding:22px 18px 20px">'
      + '<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">'
      + '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:3px solid rgba(255,255,255,.3)">'
      + (u.avatar ? '<img src="' + u.avatar + '" style="width:100%;height:100%;object-fit:cover">' : '<div style="width:100%;height:100%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">' + ini + '</div>')
      + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px"><div style="font-size:19px;font-weight:800;color:#fff">' + H.escHtml(u.name || 'Anonymous') + '</div>' + verBadge + '</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.9);font-weight:600;margin-bottom:5px">' + H.escHtml(headline) + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:rgba(255,255,255,.72)">'
      + (location ? '<span style="display:inline-flex;align-items:center;gap:3px">' + H.ICONS.location + H.escHtml(location) + '</span>' : '')
      + (expLvl   ? '<span style="display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>' + H.escHtml(expLvl) + '</span>' : '')
      + (expectedSal ? '<span style="display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' + H.escHtml(expectedSal) + '</span>' : '')
      + '</div>'
      + (jobTypes.length ? '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">' + jobTypes.map(function(t){ return '<span style="background:rgba(255,255,255,.2);color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px">' + H.escHtml(t) + '</span>'; }).join('') + '</div>' : '')
      + ((u.linkedinUrl || u.githubUrl || u.websiteUrl) ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:11px">'
          + (u.linkedinUrl ? '<a href="' + H.escHtml(u.linkedinUrl) + '" target="_blank" style="color:rgba(255,255,255,.85);text-decoration:none;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> LinkedIn</a>' : '')
          + (u.githubUrl   ? '<a href="' + H.escHtml(u.githubUrl)   + '" target="_blank" style="color:rgba(255,255,255,.85);text-decoration:none;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg> GitHub</a>' : '')
          + (u.websiteUrl  ? '<a href="' + H.escHtml(u.websiteUrl)  + '" target="_blank" style="color:rgba(255,255,255,.85);text-decoration:none;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg> Portfolio</a>' : '')
          + '</div>' : '')
      + '</div></div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + (canWa ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" style="display:flex;align-items:center;gap:5px;background:#25D366;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;color:#fff;text-decoration:none"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat on WhatsApp</a>' : '')
      + (canCall ? '<a href="tel:+' + H.escHtml(callNum) + '" style="display:flex;align-items:center;gap:5px;background:#1A3A8F;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;color:#fff;text-decoration:none"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call Candidate</a>' : '')
      + '<div onclick="H.startChatWith(\'' + H.escHtml(u.id) + '\')" style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;color:#fff;cursor:pointer"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Message</div>'
      + '</div></div>'
      // ── body ──
      + '<div style="padding:16px 16px 0">'
      + (summary ? _cvSection('Professional Summary', '<p style="font-size:13px;color:var(--text);line-height:1.75;margin:0">' + H.escHtml(summary) + '</p>')
          : (u.bio ? _cvSection('Professional Summary', '<p style="font-size:13px;color:var(--text);line-height:1.75;margin:0">' + H.escHtml(u.bio) + '</p>') : ''))
      + (exp.length ? _cvSection('Work Experience', exp.map(function (e) {
          return '<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:3px">'
            + '<div style="font-size:14px;font-weight:700;color:var(--text)">' + H.escHtml(e.title || '') + '</div>'
            + (e.duration ? '<div style="font-size:11px;color:var(--sub);white-space:nowrap;flex-shrink:0">' + H.escHtml(e.duration) + '</div>' : '')
            + '</div>'
            + '<div style="font-size:12px;color:#1A3A8F;font-weight:600;margin-bottom:4px">' + H.escHtml(e.company || '') + '</div>'
            + (e.description ? '<div style="font-size:12px;color:var(--sub);line-height:1.65">' + H.escHtml(e.description) + '</div>' : '')
            + '</div>';
        }).join('')) : '')
      + (edu.length ? _cvSection('Education', edu.map(function (e) {
          return '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
            + '<div style="font-size:14px;font-weight:700;color:var(--text)">' + H.escHtml(e.degree || e.qualification || '') + '</div>'
            + '<div style="font-size:12px;color:#1A3A8F;font-weight:600">' + H.escHtml(e.school || e.institution || '') + '</div>'
            + (e.year ? '<div style="font-size:11px;color:var(--sub);margin-top:2px">' + H.escHtml(e.year) + '</div>' : '')
            + '</div>';
        }).join('')) : '')
      + (skills.length ? _cvSection('Skills', '<div style="display:flex;flex-wrap:wrap;gap:6px">' + skills.map(function (s) {
          return '<span style="background:#1A3A8F14;border:1px solid #1A3A8F30;color:#1A3A8F;font-size:12px;font-weight:600;padding:4px 10px;border-radius:8px">' + H.escHtml(s) + '</span>';
        }).join('') + '</div>') : '')
      + (certs.length ? _cvSection('Certifications', certs.map(function (c) {
          var name = typeof c === 'string' ? c : (c.name || '');
          return '<div style="margin-bottom:8px"><div style="font-size:13px;font-weight:700;color:var(--text)">' + H.escHtml(name) + '</div>'
            + (c.issuer ? '<div style="font-size:12px;color:var(--sub)">' + H.escHtml(c.issuer) + (c.year ? ' · ' + H.escHtml(c.year) : '') + '</div>' : '') + '</div>';
        }).join('')) : '')
      + '</div></div>'
      // ── fixed bottom ──
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 14px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200;display:flex;gap:8px">'
      + (isMine
        ? '<button onclick="H.openInner(\'CandidateProfile\')" style="flex:1;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Profile</button>'
          + '<button onclick="H._deleteJobProfile()" style="flex:1;padding:13px;background:var(--bg);color:#ef4444;border:1.5px solid #fecaca;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete Profile</button>'
        : (canWa ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" style="flex:1;padding:13px;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp</a>' : '')
          + (canCall ? '<a href="tel:+' + H.escHtml(callNum) + '" style="flex:1;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call</a>' : '')
          + '<button onclick="H.startChatWith(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:13px;' + (canWa || canCall ? 'background:var(--bg);color:#1A3A8F;border:1.5px solid #1A3A8F;' : 'background:#1A3A8F;color:#fff;border:none;') + 'border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Message</button>'
          + '<button onclick="H._cvDownload(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:13px;background:linear-gradient(135deg,#1A3A8F,#2952c8);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CV</button>'
      )
      + '</div></div>';
  };

  H._cvDownload = function (userId) {
    var u = (H.state.users || []).find(function (x) { return x.id === userId; });
    if (!u) return;
    var cv = u.cv || {};
    // Open the uploaded file directly if available
    var fileUrl = cv.cvFileUrl || u.cvFileUrl || '';
    if (fileUrl) { window.open(fileUrl, '_blank'); return; }
    var skills = cv.skills && cv.skills.length ? cv.skills : (u.skills || '').split(',').filter(Boolean).map(function (s) { return s.trim(); }).filter(Boolean);
    var exp   = cv.experience     || [];
    var edu   = cv.education      || [];
    var certs = cv.certifications || [];
    var line  = '─────────────────────────────────────────────────────';
    var thick = '═════════════════════════════════════════════════════';
    var lines = [];
    lines.push(thick);
    lines.push('  CURRICULUM VITAE');
    lines.push(thick);
    lines.push('');
    lines.push('NAME:      ' + (u.name || ''));
    if (cv.headline || u.jobTitle) lines.push('TITLE:     ' + (cv.headline || u.jobTitle));
    if (cv.location || u.city)    lines.push('LOCATION:  ' + (cv.location || u.city));
    if (u.email)           lines.push('EMAIL:     ' + u.email);
    if (cv.expectedSalary) lines.push('EXPECTED:  $' + cv.expectedSalary + '/month');
    lines.push('');
    if (cv.summary) {
      lines.push(line); lines.push('PROFESSIONAL SUMMARY'); lines.push(line);
      lines.push(cv.summary); lines.push('');
    }
    if (exp.length) {
      lines.push(line); lines.push('WORK EXPERIENCE'); lines.push(line);
      exp.forEach(function (e, i) {
        if (i) lines.push('');
        lines.push((e.title || '') + (e.duration ? '  [' + e.duration + ']' : ''));
        if (e.company) lines.push(e.company);
        if (e.description) lines.push(e.description);
      });
      lines.push('');
    }
    if (edu.length) {
      lines.push(line); lines.push('EDUCATION'); lines.push(line);
      edu.forEach(function (e) {
        lines.push((e.degree || e.qualification || '') + (e.year ? '  [' + e.year + ']' : ''));
        if (e.school || e.institution) lines.push(e.school || e.institution);
      });
      lines.push('');
    }
    if (skills.length) {
      lines.push(line); lines.push('SKILLS'); lines.push(line);
      lines.push(skills.join(', ')); lines.push('');
    }
    if (certs.length) {
      lines.push(line); lines.push('CERTIFICATIONS'); lines.push(line);
      certs.forEach(function (c) {
        var name = typeof c === 'string' ? c : (c.name || '');
        lines.push(name + (c.issuer ? ' — ' + c.issuer : '') + (c.year ? ' (' + c.year + ')' : ''));
      });
      lines.push('');
    }
    lines.push(thick);
    lines.push('Generated by PaMarket — Zimbabwe\'s Free Marketplace');
    var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = ((u.name || 'cv').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'cv') + '_CV.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    H.toast('CV downloaded');
  };

  H._deleteJobProfile = function () {
    var u = H.currentUser(); if (!u) return;
    H.modal({
      title: 'Delete Job Profile',
      body: '<div style="font-size:13px;color:var(--sub);line-height:1.6">This will remove you from Hire Talent and hide your CV from employers. Your PaMarket account is kept.</div>',
      confirmText: 'Delete Profile',
      danger: true,
      onConfirm: function () {
        u.openToWork = false;
        u.cv = null;
        u.jobTitle = '';
        u.cvFileName = '';
        u.cvFileUrl = '';
        H.saveState();
        var _sb = window.supabase;
        if (_sb && typeof _sb.from === 'function') {
          _sb.from('profiles').update({ open_to_work: false, cv: null, job_title: null, cv_file_name: null, cv_file_url: null })
            .eq('id', u.id).then(function(r){ if(r&&r.error) console.warn('profile delete cv:', r.error.message); });
        }
        H.toast('Job profile removed');
        H.goBack();
      }
    });
  };

  function _emptyTalent() {
    return '<div style="text-align:center;padding:40px 20px">'
      + '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>'
      + '<div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">No candidates yet</div>'
      + '<div style="font-size:13px;color:var(--sub);margin-bottom:20px">Job seekers who mark themselves open to work will appear here.</div>'
      + '<button onclick="H.toast(\'Share PaMarket with job seekers!\')" style="padding:12px 24px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Invite Job Seekers</button>'
      + '</div>';
  }

  // ── Screening question builder (shared by PostJob + EditJob) ────
  var _jqInStyle = 'width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;font-family:inherit;margin-top:4px';

  function _jqSectionHtml() {
    return '<div style="margin-top:6px;margin-bottom:20px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.8px;display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      + '<span style="flex:1;height:1px;background:var(--border)"></span>Screening Questions<span style="flex:1;height:1px;background:var(--border)"></span></div>'
      + '<div style="font-size:12px;color:var(--sub);margin-bottom:12px;line-height:1.5">Candidates must answer these when applying. Answers appear in your applications inbox.</div>'
      + '<div id="jqList" style="margin-bottom:10px"></div>'
      + '<button onclick="H._jqAddModal()" type="button" style="width:100%;padding:12px;border:2px dashed var(--border);border-radius:12px;background:transparent;color:#1A3A8F;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Screening Question</button>'
      + '</div>';
  }

  H._jqRender = function () {
    var el = document.getElementById('jqList'); if (!el) return;
    var arr = H._jobQuestionsArr || [];
    if (!arr.length) { el.innerHTML = ''; return; }
    var typeLabels = { text: 'Short text', yesno: 'Yes / No', select: 'Multiple choice' };
    el.innerHTML = arr.map(function (q, i) {
      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;line-height:1.4">' + H.escHtml(q.question) + '</div>'
        + '<div style="font-size:11px;color:var(--sub);display:flex;flex-wrap:wrap;gap:5px;align-items:center">'
        + '<span style="background:var(--bg);padding:1px 7px;border-radius:5px">' + (typeLabels[q.type] || q.type) + '</span>'
        + (q.required ? '<span style="color:#ef4444;font-weight:700">Required</span>' : '<span>Optional</span>')
        + (q.type === 'select' && q.options && q.options.length ? '<span style="color:var(--sub2)">· ' + H.escHtml(q.options.join(', ')) + '</span>' : '')
        + '</div></div>'
        + '<button onclick="H._jqRemove(' + i + ')" type="button" style="background:none;border:none;color:var(--sub);cursor:pointer;padding:2px;flex-shrink:0">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>'
        + '</button></div>';
    }).join('');
  };

  H._jqRemove = function (idx) {
    if (!H._jobQuestionsArr) return;
    H._jobQuestionsArr.splice(idx, 1);
    H._jqRender();
  };

  H._jqAddModal = function () {
    H.modal({
      title: 'Add Screening Question',
      body: '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;color:var(--text)">Question *</label>'
        + '<input id="jqQText" placeholder="e.g. Do you have a valid driver\'s licence?" style="' + _jqInStyle + '"></div>'
        + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">Answer Type</label>'
        + '<div style="display:flex;flex-direction:column;gap:8px">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="jqType" value="text" checked style="accent-color:#1A3A8F" onchange="document.getElementById(\'jqOptsWrap\').style.display=\'none\'"> Short text answer</label>'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="jqType" value="yesno" style="accent-color:#1A3A8F" onchange="document.getElementById(\'jqOptsWrap\').style.display=\'none\'"> Yes or No</label>'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="jqType" value="select" style="accent-color:#1A3A8F" onchange="document.getElementById(\'jqOptsWrap\').style.display=\'\'"> Multiple choice</label>'
        + '</div></div>'
        + '<div id="jqOptsWrap" style="display:none;margin-bottom:12px"><label style="font-size:12px;font-weight:700;color:var(--text)">Choices (comma-separated) *</label>'
        + '<input id="jqOpts" placeholder="e.g. 0-1 years, 2-5 years, 5+ years" style="' + _jqInStyle + '"></div>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<input type="checkbox" id="jqReq" style="width:16px;height:16px;accent-color:#1A3A8F;cursor:pointer">'
        + '<label for="jqReq" style="font-size:13px;font-weight:600;color:var(--text);cursor:pointer">Required</label></div>',
      confirmText: 'Add Question',
      onConfirm: function () {
        var q = ((document.getElementById('jqQText') || {}).value || '').trim();
        if (!q) { H.toast('Please enter a question'); return false; }
        var type = 'text';
        document.querySelectorAll('input[name="jqType"]').forEach(function (r) { if (r.checked) type = r.value; });
        var opts = [];
        if (type === 'select') {
          opts = ((document.getElementById('jqOpts') || {}).value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          if (!opts.length) { H.toast('Please add at least one choice'); return false; }
        }
        var required = !!((document.getElementById('jqReq') || {}).checked);
        H._jobQuestionsArr = H._jobQuestionsArr || [];
        H._jobQuestionsArr.push({ id: H.uid(), question: q, type: type, options: opts, required: required });
        H._jqRender();
      }
    });
  };

  H.pages.PostJob = function () {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Post a Job') + H.emptyState('Sign in required', 'You must sign in to post a job', 'Sign In', "H.requireAuth('Post a job')") + '</div>';

    if (!u.verified) {
      var pendingBanner = u.verification_pending
        ? '<div style="background:#F5A62318;border:1px solid #F5A62340;border-radius:12px;padding:14px 16px;margin-bottom:20px"><div style="font-size:14px;font-weight:700;color:#c07800">Verification Pending</div><div style="font-size:13px;color:var(--sub);margin-top:4px">Your request is under review. We\'ll notify you once approved.</div></div>'
        : '<button onclick="H.openInner(\'Verify\')" style="padding:14px 32px;background:linear-gradient(135deg,#1A3A8F,#0f2460);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;display:inline-block">Verify My Company →</button>';
      return '<div class="page active">'
        + '<div class="det-topbar"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="det-topbar-title">Post a Job</div></div>'
        + '<div style="padding:48px 24px;text-align:center">'
        + '<div style="margin-bottom:16px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>'
        + '<div style="font-size:19px;font-weight:800;color:var(--text);margin-bottom:8px">Company Verification Required</div>'
        + '<div style="font-size:14px;color:var(--sub);line-height:1.7;margin-bottom:24px">To post a job, your company must be verified by PaMarket. This protects job seekers from fraudulent listings.</div>'
        + pendingBanner
        + '</div></div>';
    }

    var ZW = H._ZW_CITIES || [];
    // Build city → province map for correct prov storage
    var CITY_PROV = {};
    Object.keys(H.CITIES_BY_PROV || {}).forEach(function (prov) {
      (H.CITIES_BY_PROV[prov] || []).forEach(function (city) { CITY_PROV[city] = prov; });
    });
    // Also map main cities to their province (Harare→Harare, Bulawayo→Bulawayo, etc.)
    (H.PROVINCES || []).forEach(function (p) { if (!CITY_PROV[p]) CITY_PROV[p] = p; });

    return '<div class="page active">'
      + '<div class="det-topbar"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="det-topbar-title">Post a Job</div></div>'
      + '<div style="margin:12px 14px;background:#1A3A8F18;border-radius:12px;padding:12px 14px;display:flex;gap:10px">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      + '<div style="font-size:12px;color:#1A3A8F;font-weight:600;line-height:1.6">Jobs go live immediately. Company name is always visible. Posting is free.</div>'
      + '</div>'
      + '<div style="padding:0 14px 100px">'
      + _field('jCompany', 'Company Name *', 'text', 'Your company or organisation name', H.escHtml(u.company || u.name || ''))
      + '<div style="margin-bottom:14px;background:var(--card);border-radius:12px;padding:14px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<div><div style="font-size:14px;font-weight:600;color:var(--text)">Post Anonymously</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Company name visible. Your identity hidden.</div></div>'
      + '<div id="anonTog" onclick="this.dataset.on=this.dataset.on===\'1\'?\'0\':\'1\';this.style.background=this.dataset.on===\'1\'?\'#1A3A8F\':\'var(--border)\';this.querySelector(\'div\').style.left=this.dataset.on===\'1\'?\'23px\':\'3px\';document.getElementById(\'jAnon\').value=this.dataset.on" data-on="0" style="width:46px;height:26px;border-radius:13px;background:var(--border);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0"><div style="position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div></div>'
      + '<input type="hidden" id="jAnon" value="0">'
      + '</div>'
      + _field('jTitle', 'Job Title *', 'text', 'e.g. Accountant, Driver, Sales Representative', '')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Job Category *</label>'
      + '<select id="jCat" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none"><option value="">Select category…</option>'
      + JOB_CATS.map(function (c) { return '<option>' + H.escHtml(c) + '</option>'; }).join('') + '<option>Other</option></select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Province *</label>'
      + '<select id="jProv" onchange="H._jobProvChange(this.value)" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none"><option value="">Select province…</option>'
      + (H.PROVINCES || []).map(function (p) { return '<option>' + H.escHtml(p) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">City / Town *</label>'
      + '<select id="jLocation" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none"><option value="">Select province first…</option>'
      + '<option>Remote</option><option>Multiple Locations</option></select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Job Type</label>'
      + '<div style="display:flex;flex-wrap:wrap;gap:10px">' + ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'].map(function (t, i) { return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="jType" value="' + t + '"' + (i === 0 ? ' checked' : '') + ' style="accent-color:#1A3A8F"><span style="font-size:13px;font-weight:600;color:var(--text)">' + t + '</span></label>'; }).join('') + '</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Salary (USD)</label>'
      + '<input id="jSalary" type="text" inputmode="numeric" placeholder="e.g. 500, 500-1000, or Negotiable" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + _textarea('jDesc', 'Job Description *', 'Describe the role, responsibilities, company culture…', 6)
      + _textarea('jReqs', 'Requirements & Qualifications', 'List qualifications, experience, skills required…', 4)
      + _textarea('jResp', 'Key Responsibilities', 'List the main duties and responsibilities…', 4)
      + _field('jEmail', 'Application Email', 'email', 'Email to receive applications', H.escHtml(u.email || ''))
      + _field('jPhone', 'WhatsApp Number', 'tel', 'e.g. +263771234567', H.escHtml(u.phone || ''))
      + _jqSectionHtml()
      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button onclick="H._submitJob()" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#0f2460);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer">Post Job Now →</button>'
      + '</div></div>';
  };

  H.pages.PostJob_after = function () {
    H._jobQuestionsArr = [];
    H._jqRender();
  };

  function _field(id, label, type, placeholder, value) {
    return '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">' + label + '</label>'
      + '<input id="' + id + '" type="' + type + '" placeholder="' + H.escHtml(placeholder) + '" value="' + (value || '') + '" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box"></div>';
  }

  function _textarea(id, label, placeholder, rows) {
    return '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">' + label + '</label>'
      + '<textarea id="' + id + '" placeholder="' + H.escHtml(placeholder) + '" rows="' + rows + '" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:Inter,sans-serif"></textarea></div>';
  }

  H._submitJob = function () {
    var company = (document.getElementById('jCompany') || {}).value || '';
    var title = (document.getElementById('jTitle') || {}).value || '';
    var cat = (document.getElementById('jCat') || {}).value || '';
    var prov = (document.getElementById('jProv') || {}).value || '';
    var location = (document.getElementById('jLocation') || {}).value || '';
    var desc = (document.getElementById('jDesc') || {}).value || '';
    if (!company.trim()) { H.toast('Company name is required'); return; }
    if (!title.trim()) { H.toast('Job title is required'); return; }
    if (!cat) { H.toast('Please select a job category'); return; }
    if (!prov && location !== 'Remote' && location !== 'Multiple Locations') { H.toast('Please select a province'); return; }
    if (!location) { H.toast('Please select a city / town'); return; }
    if (desc.trim().length < 30) { H.toast('Please write a job description (min 30 chars)'); return; }
    var u = H.currentUser();
    if (!u) { H.toast('Please sign in first'); return; }
    if (!u.verified) { H.toast('Company must be verified to post jobs. Go to Profile → Verify Identity.', 4000); return; }
    var jobType = 'Full-time';
    document.querySelectorAll('input[name="jType"]').forEach(function (r) { if (r.checked) jobType = r.value; });
    var salaryRaw = ((document.getElementById('jSalary') || {}).value || '').trim();
    if (salaryRaw && !/^(\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?|negotiable|competitive|tbd)$/i.test(salaryRaw)) {
      H.toast('Please enter a valid salary amount or "Negotiable"'); return;
    }
    var salary = salaryRaw || 'Negotiable';
    var reqs = (document.getElementById('jReqs') || {}).value || '';
    var resp = (document.getElementById('jResp') || {}).value || '';
    var email = (document.getElementById('jEmail') || {}).value || '';
    var phone = (document.getElementById('jPhone') || {}).value || '';
    var anon = (document.getElementById('jAnon') || {}).value === '1';
    var fullDesc = 'COMPANY: ' + company + '\nJOB TYPE: ' + jobType + '\nINDUSTRY: ' + cat + '\nSALARY: ' + salary
      + '\n\nDESCRIPTION:\n' + desc
      + (resp ? '\n\nRESPONSIBILITIES:\n' + resp : '')
      + (reqs ? '\n\nREQUIREMENTS:\n' + reqs : '')
      + ((email || phone) ? '\n\nHOW TO APPLY:\n' + (email ? 'Email: ' + email + '\n' : '') + (phone ? 'WhatsApp: ' + phone : '') : '');
    var listing = {
      id: H.uid(), cat: 'jobs', title: title.trim(), desc: fullDesc,
      price: (parseFloat(salary) || 0), currency: 'USD', city: location, prov: prov || location,
      sellerId: u.id, sellerName: anon ? company : (u.name || company),
      sellerPhone: u.phone || '', company: company,
      createdAt: Date.now(), status: 'active', photos: [],
      custom_questions: H._jobQuestionsArr && H._jobQuestionsArr.length ? H._jobQuestionsArr.slice() : []
    };
    H.state.listings = H.state.listings || [];
    H.state.listings.push(listing);
    H.saveState();
    if (typeof H.saveListingToCloud === 'function') H.saveListingToCloud(listing);
    H.toast('Job posted! Candidates can now apply.');
    H.goBack();
  };

  H._jobProvChange = function (prov) {
    var sel = document.getElementById('jLocation');
    var existingCity = sel && sel.dataset.prefill ? sel.dataset.prefill : '';
    if (!sel) return;
    var cities = (H.CITIES_BY_PROV[prov] || []);
    sel.innerHTML = '<option value="">Select city / town…</option>'
      + cities.map(function (c) { return '<option' + (c === existingCity ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '<option' + (existingCity === 'Remote' ? ' selected' : '') + '>Remote</option>'
      + '<option' + (existingCity === 'Multiple Locations' ? ' selected' : '') + '>Multiple Locations</option>';
    sel.dataset.prefill = '';
  };

  function _textareaVal(id, label, placeholder, rows, val) {
    return '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">' + label + '</label>'
      + '<textarea id="' + id + '" placeholder="' + H.escHtml(placeholder) + '" rows="' + rows + '" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:Inter,sans-serif">' + H.escHtml(val || '') + '</textarea></div>';
  }

  H.pages.EditJob = function (params) {
    var id = params && params.listingId;
    var l = id ? (H.state.listings || []).find(function (x) { return x.id === id; }) : null;
    if (!l) return '<div class="page active">' + H.innerTopbar('Edit Job') + H.emptyState('Not found', '', null, null) + '</div>';

    var lines = (l.desc || '').split('\n');
    var company  = l.company || parseLine(lines, 'COMPANY') || l.sellerName || '';
    var jobType  = parseLine(lines, 'JOB TYPE') || 'Full-time';
    var category = parseLine(lines, 'INDUSTRY') || l.subcat || '';
    var salaryStr = parseLine(lines, 'SALARY') || '';
    var prov = l.prov || '';
    var city = l.city || '';
    var selStyle = 'width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none';

    var salMin = '', salMax = '';
    var salMatch = salaryStr.match(/\$(\d+)\s*-\s*\$(\d+)/);
    if (salMatch) { salMin = salMatch[1]; salMax = salMatch[2]; }
    else { var fromMatch = salaryStr.match(/From\s*\$(\d+)/i); if (fromMatch) salMin = fromMatch[1]; }

    var d = l.desc || '';
    function _nextAfter(pos) {
      return [d.indexOf('\nRESPONSIBILITIES:\n'), d.indexOf('\nREQUIREMENTS:\n'), d.indexOf('\nHOW TO APPLY:'), d.length]
        .filter(function(x){ return x > pos; }).sort(function(a,b){ return a-b; })[0];
    }
    var descS = d.indexOf('\nDESCRIPTION:\n');
    var respS = d.indexOf('\nRESPONSIBILITIES:\n');
    var reqS  = d.indexOf('\nREQUIREMENTS:\n');
    var applyS = d.indexOf('\nHOW TO APPLY:');
    var description      = descS  > -1 ? d.slice(descS + 14, _nextAfter(descS)).trim()  : '';
    var responsibilities = respS  > -1 ? d.slice(respS + 19, [reqS, applyS, d.length].filter(function(x){ return x > respS; }).sort(function(a,b){return a-b;})[0]).trim() : '';
    var requirements     = reqS   > -1 ? d.slice(reqS  + 15, [applyS, d.length].filter(function(x){ return x > reqS; }).sort(function(a,b){return a-b;})[0]).trim()  : '';
    var applySection     = applyS > -1 ? d.slice(applyS + 14).trim() : '';
    var em = applySection.match(/Email:\s*(.+)/);
    var ph = applySection.match(/WhatsApp:\s*(.+)/);
    var applyEmail = em ? em[1].trim() : '';
    var applyPhone = ph ? ph[1].trim() : '';

    var citiesForProv = prov && H.CITIES_BY_PROV ? (H.CITIES_BY_PROV[prov] || []) : [];
    var cityOptions = '<option value="">Select city / town…</option>'
      + (prov ? citiesForProv.map(function(c){ return '<option' + (c === city ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('') : '')
      + '<option' + (city === 'Remote' ? ' selected' : '') + '>Remote</option>'
      + '<option' + (city === 'Multiple Locations' ? ' selected' : '') + '>Multiple Locations</option>';

    return '<div class="page active">'
      + '<div class="det-topbar"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="det-topbar-title">Edit Job</div></div>'
      + '<div style="padding:0 14px 100px">'
      + _field('jCompany', 'Company Name *', 'text', 'Your company or organisation name', H.escHtml(company))
      + _field('jTitle', 'Job Title *', 'text', 'e.g. Accountant, Driver, Sales Representative', H.escHtml(l.title || ''))
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Job Category *</label>'
      + '<select id="jCat" style="' + selStyle + '"><option value="">Select category…</option>'
      + JOB_CATS.map(function(c){ return '<option' + (c === category ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '<option' + (category === 'Other' ? ' selected' : '') + '>Other</option></select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Province *</label>'
      + '<select id="jProv" onchange="H._jobProvChange(this.value)" style="' + selStyle + '"><option value="">Select province…</option>'
      + (H.PROVINCES || []).map(function(p){ return '<option' + (p === prov ? ' selected' : '') + '>' + H.escHtml(p) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">City / Town *</label>'
      + '<select id="jLocation" data-prefill="' + H.escHtml(city) + '" style="' + selStyle + '">' + cityOptions + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Job Type</label>'
      + '<div style="display:flex;flex-wrap:wrap;gap:10px">'
      + ['Full-time','Part-time','Contract','Freelance','Internship'].map(function(t){ return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="jType" value="' + t + '"' + (t === jobType ? ' checked' : '') + ' style="accent-color:#1A3A8F"><span style="font-size:13px;font-weight:600;color:var(--text)">' + t + '</span></label>'; }).join('')
      + '</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Salary (USD)</label>'
      + '<input id="jSalary" type="text" inputmode="numeric" placeholder="e.g. 500, 500-1000, or Negotiable" value="' + H.escHtml(salaryStr || '') + '" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + _textareaVal('jDesc', 'Job Description *', 'Describe the role, responsibilities, company culture…', 6, description)
      + _textareaVal('jReqs', 'Requirements & Qualifications', 'List qualifications, experience, skills required…', 4, requirements)
      + _textareaVal('jResp', 'Key Responsibilities', 'List the main duties and responsibilities…', 4, responsibilities)
      + _field('jEmail', 'Application Email', 'email', 'Email to receive applications', H.escHtml(applyEmail))
      + _field('jPhone', 'WhatsApp Number', 'tel', 'e.g. +263771234567', H.escHtml(applyPhone))
      + _jqSectionHtml()
      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button id="ejSaveBtn" onclick="H._updateJob(\'' + H.escHtml(id) + '\')" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#0f2460);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer">Save Changes →</button>'
      + '</div></div>';
  };

  H.pages.EditJob_after = function (params) {
    var id = params && params.listingId;
    var l = id ? (H.state.listings || []).find(function (x) { return x.id === id; }) : null;
    H._jobQuestionsArr = (l && l.custom_questions) ? l.custom_questions.slice() : [];
    H._jqRender();
  };

  H._updateJob = function (id) {
    var company  = ((document.getElementById('jCompany')  || {}).value || '').trim();
    var title    = ((document.getElementById('jTitle')    || {}).value || '').trim();
    var cat      = (document.getElementById('jCat')       || {}).value || '';
    var prov     = (document.getElementById('jProv')      || {}).value || '';
    var location = (document.getElementById('jLocation')  || {}).value || '';
    var desc     = ((document.getElementById('jDesc')     || {}).value || '').trim();
    if (!company)               { H.toast('Company name is required'); return; }
    if (!title)                 { H.toast('Job title is required'); return; }
    if (!cat)                   { H.toast('Please select a job category'); return; }
    if (!location)              { H.toast('Please select a city / town'); return; }
    if (desc.length < 30)       { H.toast('Please write a job description (min 30 chars)'); return; }

    var jobType = 'Full-time';
    document.querySelectorAll('input[name="jType"]').forEach(function(r){ if (r.checked) jobType = r.value; });
    var salaryRaw = ((document.getElementById('jSalary') || {}).value || '').trim();
    if (salaryRaw && !/^(\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?|negotiable|competitive|tbd)$/i.test(salaryRaw)) {
      H.toast('Please enter a valid salary amount or "Negotiable"'); return;
    }
    var salary = salaryRaw || 'Negotiable';
    var reqs  = (document.getElementById('jReqs')  || {}).value || '';
    var resp  = (document.getElementById('jResp')  || {}).value || '';
    var email = ((document.getElementById('jEmail') || {}).value || '').trim();
    var phone = ((document.getElementById('jPhone') || {}).value || '').trim();

    var fullDesc = 'COMPANY: ' + company + '\nJOB TYPE: ' + jobType + '\nINDUSTRY: ' + cat + '\nSALARY: ' + salary
      + '\n\nDESCRIPTION:\n' + desc
      + (resp  ? '\n\nRESPONSIBILITIES:\n' + resp  : '')
      + (reqs  ? '\n\nREQUIREMENTS:\n'      + reqs  : '')
      + ((email || phone) ? '\n\nHOW TO APPLY:\n' + (email ? 'Email: ' + email + '\n' : '') + (phone ? 'WhatsApp: ' + phone : '') : '');

    var l = (H.state.listings || []).find(function (x) { return x.id === id; });
    if (!l) { H.toast('Job not found'); return; }

    var btn = document.getElementById('ejSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    l.title = title; l.company = company; l.desc = fullDesc;
    l.price = (parseFloat(salary) || 0); l.city = location; l.prov = prov || location;
    l.custom_questions = H._jobQuestionsArr ? H._jobQuestionsArr.slice() : [];
    l.updatedAt = Date.now();
    H.saveState();

    var _sb = window.supabase;
    if (_sb && typeof _sb.from === 'function') {
      _sb.from('listings').update({
        title: l.title, company: l.company, desc: fullDesc, description: fullDesc,
        price: l.price, city: l.city, prov: l.prov,
        custom_questions: l.custom_questions, updated_at: l.updatedAt
      }).eq('id', id).then(function(r){ if(r&&r.error) console.warn('Job update error:', r.error.message); });
    }
    H.toast('Job updated!');
    H.goBack();
  };

  H.pages.JobDetail = function (params) {
    var id = params && params.id;
    var l = (H.state.listings || []).find(function (x) { return x.id === id; });
    if (!l) return '<div class="page active">' + H.innerTopbar('Job') + H.emptyState('Job not found', 'This posting may have been removed.', 'Browse Jobs', "H.filterByCat('jobs')") + '</div>';

    var lines = (l.desc || '').split('\n');
    var company  = l.company || l.sellerName || parseLine(lines, 'COMPANY') || 'Company';
    var jobType  = parseLine(lines, 'JOB TYPE') || '';
    var industry = parseLine(lines, 'INDUSTRY') || '';
    var salary   = parseLine(lines, 'SALARY')   || 'Not disclosed';
    var deadline = parseLine(lines, 'DEADLINE') || '';
    var d = l.desc || '';
    var descS  = d.indexOf('\nDESCRIPTION:\n');
    var respS  = d.indexOf('\nRESPONSIBILITIES:\n');
    var reqS   = d.indexOf('\nREQUIREMENTS:\n');
    var applyS = d.indexOf('\nHOW TO APPLY:');
    function _next(from) { return [respS,reqS,applyS,d.length].filter(function(x){return x>from;}).sort(function(a,b){return a-b;})[0]; }
    var description      = descS  > -1 ? d.slice(descS  + 14, _next(descS)).trim()  : (d.split('\n').filter(function(ln){return !ln.includes(':');}).slice(0,4).join('\n') || '');
    var responsibilities = respS  > -1 ? d.slice(respS  + 19, _next(respS)).trim()  : '';
    var requirements     = reqS   > -1 ? d.slice(reqS   + 15, _next(reqS)).trim()   : '';
    var applySection     = applyS > -1 ? d.slice(applyS + 14).trim()                : '';
    var em = applySection.match(/Email:\s*(.+)/), ph = applySection.match(/WhatsApp:\s*(.+)/);
    var applyEmail = em ? em[1].trim() : '';
    var applyPhone = ph ? ph[1].trim().replace(/[^\d+]/g, '') : '';

    var u      = H.currentUser();
    var isMine = u && l.sellerId && l.sellerId === u.id;
    var apps   = (H.state.applications || []);
    var myApp  = u ? apps.find(function(a){ return a.jobId === id && a.applicantId === u.id; }) : null;
    var appCount = apps.filter(function(a){ return a.jobId === id; }).length;

    var companyInitials = (company || 'C').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    var companyLogoHtml = (l.photos && l.photos[0])
      ? '<img src="' + l.photos[0] + '" style="width:56px;height:56px;border-radius:14px;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.3)">'
      : '<div style="width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,.2)">' + companyInitials + '</div>';

    var chipStyle = 'display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;margin-right:6px;margin-bottom:6px';

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#0a2558"><button class="back" onclick="H.goBack()" style="color:#fff"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#fff;font-size:14px">' + H.escHtml(l.title) + '</div>'
      + (isMine ? '<button onclick="H.openInner(\'JobApplications\',{jobId:\'' + id + '\'})" style="background:rgba(255,255,255,.18);border:none;color:#fff;font-size:11px;font-weight:700;cursor:pointer;padding:5px 10px;border-radius:8px">' + appCount + ' App' + (appCount===1?'':'s') + '</button>' : '<div style="width:40px"></div>')
      + '</div>'

      + '<div style="background:linear-gradient(160deg,#0a2558 0%,#1A3A8F 60%,#2952cc 100%);padding:20px 16px 24px">'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'
      + companyLogoHtml
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:19px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:4px">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.8);font-weight:600">' + H.escHtml(company) + '</div>'
      + '</div></div>'
      + '<div style="display:flex;flex-wrap:wrap;margin-bottom:4px">'
      + (jobType  ? '<span style="' + chipStyle + ';background:rgba(255,255,255,.18);color:#fff">' + H.escHtml(jobType)  + '</span>' : '')
      + (industry ? '<span style="' + chipStyle + ';background:#F5A62330;color:#F5A623">'         + H.escHtml(industry) + '</span>' : '')
      + '<span style="' + chipStyle + ';background:rgba(255,255,255,.12);color:rgba(255,255,255,.8)">'
      + '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
      + H.escHtml(l.city || 'Zimbabwe') + '</span>'
      + '<span style="' + chipStyle + ';background:rgba(255,255,255,.12);color:rgba(255,255,255,.8)">'
      + '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      + H.timeAgo(l.createdAt) + '</span>'
      + '</div></div>'

      + '<div style="padding:0 12px">'
      + '<div style="background:var(--card);border-radius:16px;margin-top:-14px;padding:16px;border:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">'
      + _ji('Salary', salary) + _ji('Location', l.city || 'Zimbabwe')
      + (deadline ? _ji('Deadline', deadline) : _ji('Status', l.status === 'active' ? 'Open' : 'Closed'))
      + _ji('Posted', H.timeAgo(l.createdAt))
      + '</div>'

      + (description      ? _jb('About the Role',       description)      : '')
      + (responsibilities ? _jb('Key Responsibilities', responsibilities) : '')
      + (requirements     ? _jb('Requirements',         requirements)     : '')

      + '<div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--border)">'
        + '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">How to Apply</div>'
        + '<div style="font-size:13px;color:var(--sub);margin-bottom:10px">Use Easy Apply to submit your application securely through PaMarket. The employer will review your profile and message you here.</div>'
        + (applyEmail ? '<a href="mailto:' + H.escHtml(applyEmail) + '?subject=' + encodeURIComponent('Application: ' + l.title) + '" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:#1A3A8F15;border-radius:10px;margin-bottom:8px;text-decoration:none"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span style="font-size:13px;font-weight:600;color:#1A3A8F">' + H.escHtml(applyEmail) + '</span></a>' : '')
        + '</div>'

      + '<div style="height:90px"></div></div>'

      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + (isMine
        ? '<button onclick="H.openInner(\'JobApplications\',{jobId:\'' + id + '\'})" style="width:100%;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:800;cursor:pointer">View Applications (' + appCount + ')</button>'
        : myApp
          ? '<div style="padding:14px;background:#dcfce7;border-radius:13px;text-align:center;font-size:14px;font-weight:700;color:#15803d;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Application Submitted · ' + H.timeAgo(myApp.appliedAt) + '</div>'
          : '<button onclick="H._applyToJob(\'' + id + '\')" style="width:100%;padding:14px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>Easy Apply in App</button>'
      )
      + '</div></div>';
  };

  H._applyToJob = function (jobId) {
    if (!H.currentUser()) { H.requireAuth('Sign in to apply for jobs'); return; }
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; });
    if (!l) { H.toast('Job not found'); return; }
    H.openInner('ApplyJob', { jobId: jobId });
  };

  H.pages.ApplyJob = function (params) {
    var jobId = params && params.jobId;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; });
    if (!l) return '<div class="page active">' + H.innerTopbar('Apply') + H.emptyState('Job not found', '', null, null) + '</div>';
    var company = l.company || l.sellerName || 'Company';
    var questions = l.custom_questions || [];
    var inS = 'width:100%;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;font-family:inherit';

    var questionsHtml = questions.map(function (q, i) {
      var lbl = '<label style="font-size:13px;font-weight:700;color:var(--text);display:block;margin-bottom:8px;line-height:1.5">'
        + (q.required ? '<span style="color:#ef4444;margin-right:2px">*</span>' : '')
        + H.escHtml(q.question) + '</label>';
      var inp = '';
      if (q.type === 'yesno') {
        inp = '<div id="applyQ_' + i + '" data-value="" style="display:flex;gap:8px">'
          + '<button type="button" onclick="var p=this.parentElement;p.dataset.value=\'Yes\';this.style.background=\'#1A3A8F\';this.style.color=\'#fff\';this.style.borderColor=\'#1A3A8F\';this.nextElementSibling.style.background=\'var(--card)\';this.nextElementSibling.style.color=\'var(--text)\';this.nextElementSibling.style.borderColor=\'var(--border)\'" style="flex:1;padding:11px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;background:var(--card);color:var(--text);font-family:inherit">Yes</button>'
          + '<button type="button" onclick="var p=this.parentElement;p.dataset.value=\'No\';this.style.background=\'#1A3A8F\';this.style.color=\'#fff\';this.style.borderColor=\'#1A3A8F\';this.previousElementSibling.style.background=\'var(--card)\';this.previousElementSibling.style.color=\'var(--text)\';this.previousElementSibling.style.borderColor=\'var(--border)\'" style="flex:1;padding:11px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;background:var(--card);color:var(--text);font-family:inherit">No</button>'
          + '</div>';
      } else if (q.type === 'select') {
        inp = '<select id="applyQ_' + i + '" style="' + inS + '">'
          + '<option value="">Select an option…</option>'
          + (q.options || []).map(function(o){ return '<option>' + H.escHtml(o) + '</option>'; }).join('')
          + '</select>';
      } else {
        inp = '<textarea id="applyQ_' + i + '" rows="2" placeholder="Your answer…" style="' + inS + ';resize:vertical"></textarea>';
      }
      return '<div style="margin-bottom:16px">' + lbl + inp + '</div>';
    }).join('');

    return '<div class="page active">'
      + H.innerTopbar('Apply for ' + H.escHtml(l.title))
      + '<div style="padding:14px 14px 100px">'
      + '<div style="background:#1A3A8F14;border-radius:12px;padding:12px 14px;margin-bottom:16px;display:flex;gap:12px;align-items:center">'
      + '<div style="width:42px;height:42px;border-radius:10px;background:#1A3A8F;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0">' + H.escHtml(company.slice(0, 2).toUpperCase()) + '</div>'
      + '<div><div style="font-size:14px;font-weight:700;color:var(--text)">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:12px;color:var(--sub)">' + H.escHtml(company) + ' · ' + H.escHtml(l.city || 'Zimbabwe') + '</div></div>'
      + '</div>'
      + '<div style="margin-bottom:16px">'
      + '<label style="font-size:13px;font-weight:700;color:var(--text);display:block;margin-bottom:8px">Cover Message</label>'
      + '<textarea id="applyMsg" rows="4" placeholder="Introduce yourself — your experience, why you\'re a great fit…" style="' + inS + ';resize:vertical"></textarea>'
      + '<div style="font-size:11px;color:var(--sub);margin-top:5px">Your profile is shared with the employer. They may message you through PaMarket.</div>'
      + '</div>'
      + (questions.length
        ? '<div style="font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;display:flex;align-items:center;gap:8px"><span style="flex:1;height:1px;background:var(--border)"></span>Application Questions<span style="flex:1;height:1px;background:var(--border)"></span></div>'
          + questionsHtml
        : '')
      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button onclick="H._submitApplyJob(\'' + H.escHtml(jobId) + '\')" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Application</button>'
      + '</div></div>';
  };

  H._submitApplyJob = function (jobId) {
    var u = H.currentUser(); if (!u) return;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; }); if (!l) return;
    var msg = ((document.getElementById('applyMsg') || {}).value || '').trim();
    var questions = l.custom_questions || [];
    var answers = [];
    var valid = true;
    questions.forEach(function (q, i) {
      var el = document.getElementById('applyQ_' + i);
      var val = '';
      if (q.type === 'yesno') {
        val = el ? (el.dataset.value || '') : '';
      } else {
        val = el ? ((el.value || '').trim()) : '';
      }
      if (q.required && !val) {
        H.toast('Please answer: ' + q.question.slice(0, 60));
        valid = false;
      }
      answers.push({ questionId: q.id, question: q.question, answer: val });
    });
    if (!valid) return;
    H._submitJobApplication(jobId, msg, answers);
  };

  H._submitJobApplication = function (jobId, message, answers) {
    var u = H.currentUser(); if (!u) return;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; }); if (!l) return;
    var company = l.company || l.sellerName || 'Company';
    H.state.applications = H.state.applications || [];
    var existing = H.state.applications.find(function(a){ return a.jobId === jobId && a.applicantId === u.id; });
    if (existing) { H.toast('You already applied for this job'); return; }
    var app = {
      id: H.uid(), jobId: jobId, jobTitle: l.title, company: company,
      applicantId: u.id, applicantName: u.name || 'Applicant',
      message: message, answers: answers || [], status: 'pending', appliedAt: Date.now(),
      employerId: l.sellerId
    };
    H.state.applications.push(app);
    H.saveState();
    if (typeof H.saveApplicationToCloud === 'function') H.saveApplicationToCloud(app);
    if (l.sellerId) H.pushNotif(l.sellerId, 'New Application', u.name + ' applied for ' + l.title, 'message');
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    var ids = [u.id, l.sellerId].sort();
    var convId = 'job_' + jobId.slice(-8) + '_' + ids[0].slice(-6) + '_' + ids[1].slice(-6);
    if (!H.state.conversations.find(function(c){ return c.id === convId; })) {
      var conv = {
        id: convId, members: [u.id, l.sellerId], listingId: jobId,
        appId: app.id, isJobThread: true,
        messages: message ? [{id: H.uid(), from: u.id, senderName: u.name||'', text: message, t: Date.now(), read: false}] : []
      };
      H.state.conversations.push(conv);
      H.saveState();
      if (typeof H.ensureConversationInCloud === 'function') {
        H.ensureConversationInCloud(conv).then(function(){
          if (message && typeof H.saveMessageToCloud === 'function') H.saveMessageToCloud(convId, conv.messages[0]);
        });
      } else if (message && typeof H.saveMessageToCloud === 'function') H.saveMessageToCloud(convId, conv.messages[0]);
    }
    H.toast('Application submitted! The employer will be in touch.');
    H.goBack();
  };

  H.pages.JobApplications = function (params) {
    var jobId = params && params.jobId;
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Applications') + H.emptyState('Sign in required', '', null, null) + '</div>';
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; });
    var title = l ? l.title : 'Job';
    var apps = (H.state.applications || []).filter(function(a){ return a.jobId === jobId; })
      .sort(function(a,b){ return b.appliedAt - a.appliedAt; });

    var statusColors = { pending:'#F5A623', reviewed:'#1A3A8F', shortlisted:'#22c55e', rejected:'#ef4444' };
    var statusLabels = { pending:'New', reviewed:'Reviewed', shortlisted:'Shortlisted', rejected:'Rejected' };

    return '<div class="page active">'
      + H.innerTopbar('Applications for ' + H.escHtml(title))
      + '<div style="padding:12px 14px 16px;background:var(--card);border-bottom:1px solid var(--border)">'
      + '<div style="font-size:22px;font-weight:800;color:var(--text)">' + apps.length + ' Application' + (apps.length===1?'':'s') + '</div>'
      + '<div style="font-size:13px;color:var(--sub);margin-top:2px">' + H.escHtml(title) + '</div>'
      + '</div>'
      + '<div style="padding:12px 14px 88px">'
      + (apps.length ? apps.map(function(app) {
          var statusC = statusColors[app.status] || '#999';
          var statusL = statusLabels[app.status] || app.status;
          var ini = (app.applicantName||'A').split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
          return '<div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border)">'
            + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">'
            + '<div style="width:44px;height:44px;border-radius:50%;background:#1A3A8F;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0">' + ini + '</div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
            + '<div style="font-size:15px;font-weight:700;color:var(--text)">' + H.escHtml(app.applicantName || 'Applicant') + '</div>'
            + '<span style="background:' + statusC + '20;color:' + statusC + ';font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px">' + statusL + '</span>'
            + '</div>'
            + '<div style="font-size:12px;color:var(--sub);margin-top:2px">' + H.timeAgo(app.appliedAt) + '</div>'
            + '</div></div>'
            + (app.message ? '<div style="font-size:13px;color:var(--text);line-height:1.6;padding:10px 12px;background:var(--bg);border-radius:10px;margin-bottom:10px">' + H.escHtml(app.message.slice(0,200)) + (app.message.length>200?'…':'') + '</div>' : '')
            + (app.answers && app.answers.length
              ? '<div style="margin-bottom:12px">'
                + '<div style="font-size:10px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Screening Answers</div>'
                + app.answers.map(function(a) {
                    return '<div style="border-left:3px solid #1A3A8F30;padding:5px 8px;margin-bottom:5px">'
                      + '<div style="font-size:11px;font-weight:700;color:var(--sub);margin-bottom:1px">' + H.escHtml(a.question || '') + '</div>'
                      + '<div style="font-size:13px;font-weight:600;color:' + (a.answer ? 'var(--text)' : 'var(--sub2)') + '">' + H.escHtml(a.answer || 'No answer') + '</div>'
                      + '</div>';
                  }).join('')
                + '</div>'
              : '')
            + '<div style="display:flex;gap:8px">'
            + '<button onclick="H._setAppStatus(\'' + app.id + '\',\'shortlisted\')" style="flex:1;padding:8px;background:#22c55e15;color:#15803d;border:1.5px solid #22c55e40;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer">Shortlist</button>'
            + '<button onclick="H._setAppStatus(\'' + app.id + '\',\'rejected\')" style="flex:1;padding:8px;background:#ef444415;color:#dc2626;border:1.5px solid #ef444440;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer">Decline</button>'
            + '<button onclick="H._openApplicationChat(\'' + app.id + '\')" style="flex:1;padding:8px;background:#1A3A8F15;color:#1A3A8F;border:1.5px solid #1A3A8F40;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer">Message</button>'
            + '</div></div>';
        }).join('')
        : H.emptyState('No applications yet', 'Share your job posting to attract candidates.', null, null))
      + '</div></div>';
  };

  H._setAppStatus = function (appId, status) {
    var app = (H.state.applications || []).find(function(a){ return a.id === appId; });
    if (!app) return;
    app.status = status;
    H.saveState();
    if (typeof H.updateApplicationStatusCloud === 'function') H.updateApplicationStatusCloud(appId, status);
    var u = H.currentUser();
    var jobId = app.jobId;
    H.toast(status === 'shortlisted' ? 'Shortlisted!' : 'Declined');
    if (app.applicantId) {
      H.pushNotif(app.applicantId,
        status === 'shortlisted' ? 'Application Update' : 'Application Update',
        status === 'shortlisted'
          ? 'Congratulations! Your application for ' + app.jobTitle + ' has been shortlisted.'
          : 'Your application for ' + app.jobTitle + ' was not selected at this time.',
        status === 'shortlisted' ? 'verify' : 'info'
      );
    }
    H.renderPage('JobApplications', {jobId: jobId});
  };

  H.pages.JobApplications_after = function(params) {
    if (typeof H.syncApplications === 'function' && !H._syncingJobApplications) {
      H._syncingJobApplications = true;
      H.syncApplications().then(function(){
        if (H.currentPageName === 'JobApplications') H.renderPage('JobApplications', params || H.currentPageParams);
      }).finally(function(){
        H._syncingJobApplications = false;
      });
    }
  };

  H._openApplicationChat = function(appId) {
    var app = (H.state.applications || []).find(function(a){ return a.id === appId; });
    if (!app) return;
    var ids = [app.applicantId, app.employerId].sort();
    var convId = 'job_' + app.jobId.slice(-8) + '_' + ids[0].slice(-6) + '_' + ids[1].slice(-6);
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    var conv = H.state.conversations.find(function(c){ return c.id === convId; });
    if (!conv) {
      conv = {
        id: convId, members: [app.applicantId, app.employerId], listingId: app.jobId,
        appId: app.id, isJobThread: true,
        messages: app.message ? [{ id: H.uid(), from: app.applicantId, senderName: app.applicantName || '', text: app.message, t: app.appliedAt || Date.now(), read: false }] : []
      };
      if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
      H.state.conversations.push(conv);
      H.saveState();
    }
    if (typeof H.ensureConversationInCloud === 'function') {
      H.ensureConversationInCloud(conv).then(function(){
        if (conv.messages && conv.messages.length && typeof H.saveMessageToCloud === 'function') H.saveMessageToCloud(conv.id, conv.messages[0]);
      });
    } else if (conv.messages && conv.messages.length && typeof H.saveMessageToCloud === 'function') H.saveMessageToCloud(conv.id, conv.messages[0]);
    H.openInner('Chat', { id: conv.id });
  };

  H.pages.AppliedJobs = function () {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('My Applications') + H.emptyState('Sign in required', '', null, null) + '</div>';
    var apps = (H.state.applications || []).filter(function(a){ return a.applicantId === u.id; })
      .sort(function(a,b){ return b.appliedAt - a.appliedAt; });
    var statusColors = { pending:'#F5A623', reviewed:'#1A3A8F', shortlisted:'#22c55e', rejected:'#ef4444' };
    var statusLabels = { pending:'Pending', reviewed:'Reviewed', shortlisted:'Shortlisted', rejected:'Not selected' };

    return '<div class="page active">'
      + H.innerTopbar('My Applications')
      + '<div style="padding:12px 14px 88px">'
      + (apps.length ? apps.map(function(app) {
          var statusC = statusColors[app.status] || '#999';
          var statusL = statusLabels[app.status] || app.status;
          return '<div onclick="H.openInner(\'JobDetail\',{id:\'' + app.jobId + '\'})" style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border);cursor:pointer">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'
            + '<div style="font-size:15px;font-weight:700;color:var(--text);flex:1;margin-right:10px">' + H.escHtml(app.jobTitle || 'Job') + '</div>'
            + '<span style="background:' + statusC + '20;color:' + statusC + ';font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0">' + statusL + '</span>'
            + '</div>'
            + '<div style="font-size:13px;color:var(--sub);margin-bottom:4px">' + H.escHtml(app.company || '') + '</div>'
            + '<div style="font-size:12px;color:var(--sub2)">Applied ' + H.timeAgo(app.appliedAt) + '</div>'
            + '</div>';
        }).join('')
        : H.emptyState('No applications yet', 'Browse jobs and apply directly in the app.', 'Browse Jobs', "H.openInner('FindJobs')"))
      + '</div></div>';
  };

  var inStyle = 'width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;font-family:inherit';

  function _cpSectionHead(icon, title) {
    return '<div style="display:flex;align-items:center;gap:10px;margin:20px 0 10px">'
      + '<span style="display:inline-flex;align-items:center;color:var(--sub)">' + icon + '</span>'
      + '<span style="font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.8px">' + title + '</span>'
      + '<span style="flex:1;height:1px;background:var(--border)"></span>'
      + '</div>';
  }

  function _cpRenderSkillChips(skills) {
    return skills.map(function(s, i) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:#1A3A8F;color:#fff;font-size:12px;font-weight:600;padding:4px 8px;border-radius:8px">'
        + H.escHtml(s.trim())
        + '<button onclick="H._cpRemoveSkill(' + i + ')" style="background:none;border:none;color:#fff;font-size:13px;cursor:pointer;padding:0;line-height:1;font-family:inherit">×</button>'
        + '</span>';
    }).join('');
  }

  function _cpRenderResumeZone(fileName, uploading) {
    if (uploading) {
      return '<div style="display:flex;align-items:center;gap:8px;background:#1A3A8F14;border-radius:10px;padding:10px 12px;border:1.5px solid #1A3A8F30">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1A3A8F" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>'
        + '<span style="font-size:13px;font-weight:600;color:#1A3A8F">Uploading…</span>'
        + '</div>';
    }
    if (fileName) {
      return '<div style="display:flex;align-items:center;gap:8px;background:#22c55e18;border-radius:10px;padding:10px 12px;border:1.5px solid #22c55e40">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#15803d" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        + '<span style="flex:1;font-size:13px;font-weight:600;color:#15803d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(fileName) + '</span>'
        + '<button onclick="event.stopPropagation();H._cpClearResume()" style="background:none;border:none;color:#15803d;font-size:16px;cursor:pointer;padding:0;font-family:inherit">×</button>'
        + '</div>';
    }
    return '<div onclick="document.getElementById(\'cpResumeFile\').click()" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--border);border-radius:10px;padding:20px;cursor:pointer;text-align:center">'
      + '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      + '<span style="font-size:13px;font-weight:600;color:var(--sub)">Tap to upload Resume / CV</span>'
      + '<span style="font-size:11px;color:var(--sub2)">PDF, DOC, DOCX · Max 3 MB</span>'
      + '</div>';
  }

  // ── Global toggle helpers — defined at script load, never depend on _after ──
  window._cpJT = function(btn) {
    var on = btn.getAttribute('data-sel') !== '1';
    btn.setAttribute('data-sel', on ? '1' : '0');
    btn.style.background  = on ? '#1A3A8F' : '#fff';
    btn.style.color       = on ? '#fff'    : '#667085';
    btn.style.border      = on ? '1.5px solid #1A3A8F' : '1.5px solid #E4E8F0';
  };

  window._cpCM = function(btn) {
    var wrap = document.getElementById('cpCMWrap');
    if (!wrap) return;
    [].forEach.call(wrap.querySelectorAll('button[data-cm]'), function(b) {
      b.setAttribute('data-sel', '0');
      b.style.background = '#fff';
      b.style.color      = '#667085';
      b.style.border     = '1.5px solid #E4E8F0';
    });
    btn.setAttribute('data-sel', '1');
    btn.style.background = '#1A3A8F';
    btn.style.color      = '#fff';
    btn.style.border     = '1.5px solid #1A3A8F';
  };

  window._cpOpenFile = function() {
    var fi = document.getElementById('cpResumeFile');
    if (fi) { try { fi.click(); } catch(e) {} }
  };

  window._cpSamePhone = function(el) {
    var row = document.getElementById('cpPhoneRow');
    if (row) row.style.display = el.checked ? 'none' : '';
  };

  H.pages.CandidateProfile = function () {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Job Seeker Profile') + H.emptyState('Sign in required', 'Sign in to set up your job seeker profile', 'Sign In', "H.requireAuth('Job seeker profile')") + '</div>';
    var ZW = H._ZW_CITIES || [];
    var expLevels = [['entry','Entry Level (0-2 yrs)'],['mid','3-5 Years'],['senior','5-10 Years'],['expert','10+ Years']];
    var on = u.openToWork ? '1' : '0';
    var togBg   = u.openToWork ? '#22c55e' : '#E4E8F0';
    var togLeft = u.openToWork ? '23px' : '3px';
    var existingSkills = (u.skills || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var jobTypesList = ['Full-Time','Part-Time','Contract','Casual / Day Labor','Remote'];
    var selectedJobTypes = (u.jobTypes || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var waCC = u.whatsappCC || '263';
    var waNum = u.whatsappNum || '';
    var samePhone = u.samePhone ? true : false;
    var phoneForCalls = u.phoneForCalls || '';
    var contactMethod = u.contactMethod || '';
    var waCCOptions = [['263','ZW +263'],['27','ZA +27'],['267','BW +267'],['260','ZM +260'],['255','TZ +255'],['254','KE +254'],['234','NG +234'],['44','GB +44'],['1','US +1']];
    var cvFileName = H._cpResumeFileName || u.cvFileName || '';

    var jt_off = '1.5px solid #E4E8F0';
    var jt_on  = '1.5px solid #1A3A8F';

    return '<div class="page active">'
      + H.innerTopbar('Job Seeker Profile')
      + '<div style="margin:12px 14px;background:#22c55e18;border-radius:12px;padding:12px 14px;display:flex;gap:10px">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#15803d" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      + '<div style="font-size:12px;color:#15803d;font-weight:600;line-height:1.6">Employers in Hire Talent can find and contact you when you turn on Open to Work.</div>'
      + '</div>'
      + '<div style="padding:0 14px 100px">'

      // ── Open to Work toggle ──
      + '<div style="margin-bottom:16px;background:#fff;border-radius:12px;padding:16px;border:1px solid #E4E8F0;display:flex;align-items:center;justify-content:space-between">'
      + '<div><div style="font-size:15px;font-weight:700;color:var(--text)">Open to Work</div><div style="font-size:12px;color:#667085;margin-top:2px">Appear in employer searches</div></div>'
      + '<div id="otwTog" onclick="var o=this.dataset.on===\'1\'?\'0\':\'1\';this.dataset.on=o;this.style.background=o===\'1\'?\'#22c55e\':\'#E4E8F0\';this.querySelector(\'div\').style.left=o===\'1\'?\'23px\':\'3px\'" data-on="' + on + '" style="width:46px;height:26px;border-radius:13px;background:' + togBg + ';position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">'
      + '<div style="position:absolute;top:3px;left:' + togLeft + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div></div>'
      + '</div>'

      // ── Basic Details ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>', 'Basic Details')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Current / Desired Job Title</label>'
      + '<input id="cpTitle" placeholder="e.g. Accountant, Driver, Teacher" value="' + H.escHtml(u.jobTitle || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Industry / Sector</label>'
      + '<select id="cpSector" style="' + inStyle + '"><option value="">Select sector…</option>'
      + JOB_CATS.map(function(c){ return '<option value="' + H.escHtml(c) + '"' + (u.sector === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Experience Level</label>'
      + '<select id="cpExp" style="' + inStyle + '"><option value="">Select level…</option>'
      + expLevels.map(function(e){ return '<option value="' + e[0] + '"' + (u.exp === e[0] ? ' selected' : '') + '>' + H.escHtml(e[1]) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">City</label>'
      + '<select id="cpCity" style="' + inStyle + '"><option value="">Select city…</option>'
      + ZW.map(function(c){ return '<option value="' + H.escHtml(c) + '"' + (u.city === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '<option value="Remote"' + (u.city === 'Remote' ? ' selected' : '') + '>Remote / Any</option>'
      + '</select></div>'

      // ── Professional Background ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>', 'Professional Background')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Bio / About Me</label>'
      + '<textarea id="cpBio" maxlength="300" placeholder="Tell employers a bit about yourself…" style="' + inStyle + 'height:90px;resize:vertical">' + H.escHtml(u.bio || '') + '</textarea>'
      + '<div style="text-align:right;font-size:11px;color:#667085;margin-top:3px"><span id="cpBioCount">' + (u.bio || '').length + '</span>/300</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Skills</label>'
      + '<div id="cpSkillsChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + _cpRenderSkillChips(existingSkills) + '</div>'
      + '<input id="cpSkillsInput" placeholder="Type a skill and press comma or Enter…" style="' + inStyle + '">'
      + '<input type="hidden" id="cpSkillsVal" value="' + H.escHtml(existingSkills.join(',')) + '">'
      + '</div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Expected Salary / Rate <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpSalary" placeholder="e.g. $500/mo, $20/hr or Negotiable" value="' + H.escHtml(u.expectedSalary || '') + '" style="' + inStyle + '"></div>'

      // ── Job Preferences ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>', 'Job Preferences')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Job Type / Availability</label>'
      + '<div id="cpJTWrap" style="display:flex;flex-wrap:wrap;gap:8px">'
      + jobTypesList.map(function(t) {
          var sel = selectedJobTypes.indexOf(t) !== -1;
          return '<button type="button" onclick="_cpJT(this)" data-jt="' + H.escHtml(t) + '" data-sel="' + (sel ? '1' : '0') + '" style="padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:' + (sel ? '#1A3A8F' : '#fff') + ';color:' + (sel ? '#fff' : '#667085') + ';border:1.5px solid ' + (sel ? '#1A3A8F' : '#E4E8F0') + '">' + H.escHtml(t) + '</button>';
        }).join('')
      + '</div></div>'

      // ── Contact & Reach ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg>', 'Contact & Reach')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">WhatsApp Number</label>'
      + '<div style="display:flex;gap:8px">'
      + '<select id="cpWaCC" style="padding:13px;border:1.5px solid #E4E8F0;border-radius:12px;font-size:14px;background:#fff;color:var(--text);outline:none;flex-shrink:0;font-family:inherit">'
      + waCCOptions.map(function(o){ return '<option value="' + o[0] + '"' + (waCC === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
      + '</select>'
      + '<input id="cpWaNum" type="tel" placeholder="712 345 678" value="' + H.escHtml(waNum) + '" style="' + inStyle + '">'
      + '</div>'
      + '<div style="font-size:11px;color:#667085;margin-top:5px">Employers can message you directly on WhatsApp</div>'
      + '</div>'
      + '<div style="margin-bottom:14px;display:flex;align-items:center;gap:8px">'
      + '<input type="checkbox" id="cpSamePhone"' + (samePhone ? ' checked' : '') + ' onchange="_cpSamePhone(this)" style="width:16px;height:16px;cursor:pointer">'
      + '<label for="cpSamePhone" style="font-size:13px;font-weight:600;color:var(--text);cursor:pointer">Same number for calls as WhatsApp</label>'
      + '</div>'
      + '<div id="cpPhoneRow" style="margin-bottom:14px;' + (samePhone ? 'display:none' : '') + '"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Phone for Calls</label>'
      + '<input id="cpPhone" type="tel" placeholder="e.g. 0712 345 678" value="' + H.escHtml(samePhone ? '' : phoneForCalls) + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Preferred Contact Method</label>'
      + '<div id="cpCMWrap" style="display:flex;gap:8px">'
      + [
          ['<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp', 'whatsapp'],
          ['<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call', 'call'],
          ['<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Both', 'both']
        ].map(function(cm) {
          var sel = contactMethod === cm[1];
          return '<button type="button" onclick="_cpCM(this)" data-cm="' + cm[1] + '" data-sel="' + (sel ? '1' : '0') + '" style="flex:1;padding:10px 6px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px;background:' + (sel ? '#1A3A8F' : '#fff') + ';color:' + (sel ? '#fff' : '#667085') + ';border:1.5px solid ' + (sel ? '#1A3A8F' : '#E4E8F0') + '">' + cm[0] + '</button>';
        }).join('')
      + '</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Best Time to Contact</label>'
      + '<select id="cpAvail" style="' + inStyle + '">'
      + ['Anytime','Morning (8am–12pm)','Afternoon (12pm–5pm)','Evening (5pm–8pm)'].map(function(t){ return '<option value="' + H.escHtml(t) + '"' + ((u.contactAvail || 'Anytime') === t ? ' selected' : '') + '>' + H.escHtml(t) + '</option>'; }).join('')
      + '</select></div>'

      // ── Professional Links ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>', 'Professional Links')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">LinkedIn <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpLinkedin" type="url" placeholder="linkedin.com/in/your-name" value="' + H.escHtml(u.linkedinUrl || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">GitHub <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpGithub" type="url" placeholder="github.com/username" value="' + H.escHtml(u.githubUrl || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Portfolio / Website <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpWebsite" type="url" placeholder="yourportfolio.com" value="' + H.escHtml(u.websiteUrl || '') + '" style="' + inStyle + '"></div>'

      // ── Resume / CV ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', 'Resume / CV')
      + '<div id="cpResumeZone" style="margin-bottom:20px">' + _cpRenderResumeZone(cvFileName) + '</div>'
      + '<input type="file" id="cpResumeFile" accept=".pdf,.doc,.docx" style="position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px">'

      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid #E4E8F0;z-index:200">'
      + '<button id="cpSaveBtn" onclick="H._saveCandidateProfile()" style="width:100%;padding:15px;background:linear-gradient(135deg,#22c55e,#15803d);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Save Profile</button>'
      + '</div></div>';
  };

  H.pages.CandidateProfile_after = function () {
    // Bio counter
    var bioEl = document.getElementById('cpBio');
    if (bioEl) {
      bioEl.addEventListener('input', function() {
        var cnt = document.getElementById('cpBioCount');
        if (cnt) cnt.textContent = this.value.length;
      });
    }

    // Skills chip logic
    H._cpSkillsArr = (document.getElementById('cpSkillsVal') || {value:''}).value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);

    function _cpSyncSkills() {
      var chipsEl = document.getElementById('cpSkillsChips');
      var valEl   = document.getElementById('cpSkillsVal');
      if (chipsEl) chipsEl.innerHTML = _cpRenderSkillChips(H._cpSkillsArr);
      if (valEl)   valEl.value = H._cpSkillsArr.join(',');
    }

    H._cpRemoveSkill = function(i) {
      H._cpSkillsArr.splice(i, 1);
      _cpSyncSkills();
    };

    var skillInput = document.getElementById('cpSkillsInput');
    if (skillInput) {
      skillInput.addEventListener('keydown', function(e) {
        if (e.key === ',' || e.key === 'Enter') {
          e.preventDefault();
          var val = this.value.replace(/,/g,'').trim();
          if (val && H._cpSkillsArr.indexOf(val) === -1) { H._cpSkillsArr.push(val); _cpSyncSkills(); }
          this.value = '';
        }
      });
      skillInput.addEventListener('blur', function() {
        var parts = this.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        parts.forEach(function(p){ if (p && H._cpSkillsArr.indexOf(p) === -1) H._cpSkillsArr.push(p); });
        if (parts.length) { _cpSyncSkills(); skillInput.value = ''; }
      });
    }

    // Resume upload
    H._cpResumeData     = H._cpResumeData     || null;
    H._cpResumeFileName = H._cpResumeFileName || null;

    var fileInput = document.getElementById('cpResumeFile');
    if (fileInput) {
      fileInput.addEventListener('change', function() {
        var file = this.files && this.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { H.toast('File too large — max 3 MB'); this.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function(ev) {
          H._cpResumeData     = ev.target.result;
          H._cpResumeFileName = file.name;
          var zone = document.getElementById('cpResumeZone');
          if (zone) zone.innerHTML = _cpRenderResumeZone(file.name);
        };
        reader.readAsDataURL(file);
      });
    }

    H._cpClearResume = function() {
      H._cpResumeData = null; H._cpResumeFileName = null;
      var fi = document.getElementById('cpResumeFile'); if (fi) fi.value = '';
      var z  = document.getElementById('cpResumeZone');  if (z)  z.innerHTML = _cpRenderResumeZone('');
    };
  };

  H._saveCandidateProfile = function () {
    var u = H.currentUser(); if (!u) return;
    var saveBtn = document.getElementById('cpSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    // Collect all form values
    u.openToWork     = !!(document.getElementById('otwTog') && document.getElementById('otwTog').dataset.on === '1');
    u.jobTitle       = ((document.getElementById('cpTitle')   || {}).value || '').trim();
    u.sector         = (document.getElementById('cpSector')   || {}).value || '';
    u.exp            = (document.getElementById('cpExp')      || {}).value || '';
    u.city           = (document.getElementById('cpCity')     || {}).value || '';
    u.bio            = ((document.getElementById('cpBio')     || {}).value || '').trim();
    u.expectedSalary = ((document.getElementById('cpSalary')  || {}).value || '').trim();
    u.skills         = (H._cpSkillsArr || []).join(',');

    // Job types — read data-sel attribute
    var jtArr = [];
    var jtWrap = document.getElementById('cpJTWrap');
    if (jtWrap) {
      [].forEach.call(jtWrap.querySelectorAll('button[data-jt]'), function(b) {
        if (b.getAttribute('data-sel') === '1') jtArr.push(b.getAttribute('data-jt'));
      });
    }
    u.jobTypes = jtArr.join(',');

    // Contact method — read data-sel attribute
    var contactMethod = '';
    var cmWrap = document.getElementById('cpCMWrap');
    if (cmWrap) {
      [].forEach.call(cmWrap.querySelectorAll('button[data-cm]'), function(b) {
        if (b.getAttribute('data-sel') === '1') contactMethod = b.getAttribute('data-cm') || '';
      });
    }
    u.contactMethod = contactMethod;

    // WhatsApp / phone
    var waCC  = (document.getElementById('cpWaCC')  || {}).value || '263';
    var waNum = ((document.getElementById('cpWaNum') || {}).value || '').trim();
    var samePh = !!(document.getElementById('cpSamePhone') && document.getElementById('cpSamePhone').checked);
    var phCalls = samePh ? waNum : ((document.getElementById('cpPhone') || {}).value || '').trim();
    u.whatsappCC   = waCC;
    u.whatsappNum  = waNum;
    u.samePhone    = samePh;
    u.phoneForCalls = phCalls;
    u.whatsappFull  = waCC + waNum.replace(/^0/, '').replace(/\s/g, '');
    u.contactAvail  = (document.getElementById('cpAvail') || {}).value || 'Anytime';

    // Professional links
    u.linkedinUrl = ((document.getElementById('cpLinkedin') || {}).value || '').trim();
    u.githubUrl   = ((document.getElementById('cpGithub')   || {}).value || '').trim();
    u.websiteUrl  = ((document.getElementById('cpWebsite')  || {}).value || '').trim();

    // Resume filename
    if (H._cpResumeFileName) u.cvFileName = H._cpResumeFileName;

    // Bridge flat fields → structured cv object
    var prevCv = u.cv || {};
    u.cv = {
      headline:       u.jobTitle       || prevCv.headline       || '',
      location:       u.city           || prevCv.location       || '',
      summary:        u.bio            || prevCv.summary        || '',
      skills:         (u.skills || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
      expectedSalary: u.expectedSalary || prevCv.expectedSalary || '',
      visible:        !!u.openToWork,
      experience:     prevCv.experience     || [],
      education:      prevCv.education      || [],
      certifications: prevCv.certifications || [],
      cvFileUrl:      prevCv.cvFileUrl      || u.cvFileUrl      || ''
    };

    H.saveState();

    // Navigate to profile VIEW (not goBack) so user sees their saved profile
    H.toast(u.openToWork ? 'Profile saved — employers can now find you!' : 'Profile saved');
    H.state._backToAccount = false;
    try { H.renderPage('JobSeekerProfile'); } catch(e) { try { H.navTo('Account'); } catch(e2) {} }

    // Background Supabase sync
    var _syncToCloud = function(cvFileUrl) {
      var _sb = window.supabase;
      if (!_sb || typeof _sb.from !== 'function') return;
      var d = {
        id: u.id,
        open_to_work: u.openToWork,
        job_title: u.jobTitle       || null,
        skills:    u.skills         || null,
        sector:    u.sector         || null,
        exp:       u.exp            || null,
        city:      u.city           || null,
        bio:       u.bio            || null,
        job_types:            u.jobTypes      || null,
        expected_salary:      u.expectedSalary|| null,
        whatsapp_number:      u.whatsappFull  || null,
        phone_for_calls:      u.phoneForCalls || null,
        contact_method:       u.contactMethod || null,
        contact_availability: u.contactAvail  || null,
        linkedin_url:         u.linkedinUrl   || null,
        github_url:           u.githubUrl     || null,
        website_url:          u.websiteUrl    || null,
        cv_file_name:         u.cvFileName    || null,
        cv:                   u.cv            || null
      };
      if (cvFileUrl) { d.cv_file_url = cvFileUrl; u.cv.cvFileUrl = cvFileUrl; u.cvFileUrl = cvFileUrl; H.saveState(); }
      _sb.from('profiles').upsert(d).then(function(r){ if (r && r.error) console.warn('cp sync:', r.error.message); });
    };

    if (H._cpResumeData && H._cpResumeFileName && window.supabase) {
      try {
        var b64    = H._cpResumeData.split(',')[1] || '';
        var mmatch = H._cpResumeData.match(/data:([^;]+);/);
        var mime   = mmatch ? mmatch[1] : 'application/octet-stream';
        var bytes  = atob(b64);
        var arr    = new Uint8Array(bytes.length);
        for (var k = 0; k < bytes.length; k++) arr[k] = bytes.charCodeAt(k);
        var blob   = new Blob([arr], { type: mime });
        var path   = u.id + '/' + Date.now() + '_' + H._cpResumeFileName;
        window.supabase.storage.from('cv-files').upload(path, blob, { upsert: true })
          .then(function(res) {
            var url = '';
            if (!res.error) {
              var pr = window.supabase.storage.from('cv-files').getPublicUrl(path);
              url = pr.data && pr.data.publicUrl ? pr.data.publicUrl : '';
            }
            _syncToCloud(url);
          }).catch(function() { _syncToCloud(''); });
      } catch(e) { _syncToCloud(''); }
    } else {
      _syncToCloud('');
    }
  };

  function _ji(label, value) {
    return '<div><div style="font-size:10px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">' + label + '</div><div style="font-size:13px;font-weight:700;color:var(--text)">' + H.escHtml(String(value)) + '</div></div>';
  }

  function _jb(sectionTitle, text) {
    return '<div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border)">'
      + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:8px">'
      + '<div style="width:3px;height:16px;background:#1A3A8F;border-radius:2px"></div>' + sectionTitle + '</div>'
      + '<div style="font-size:13px;color:var(--sub);line-height:1.8;white-space:pre-line">' + H.escHtml(text) + '</div></div>';
  }

})(window.H);

;/* === www/js/vehicles.js === */
'use strict';
(function (H) {

  H.pages.Vehicles = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'vehicles'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('vehicles', 'subcat', 'Vehicle Type', [['all', 'All Types'], ['car', 'Car'], ['suv', 'SUV / 4x4'], ['truck', 'Truck / Pickup'], ['van', 'Van / Minibus'], ['motorcycle', 'Motorcycle'], ['bus', 'Bus'], ['tractor', 'Tractor'], ['boat', 'Boat']])
      + H._sel('vehicles', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['used', 'Used'], ['accident-free', 'Accident Free']])
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
      + '<div><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Year From</div>'
      + '<input type="number" min="1960" max="2026" placeholder="e.g. 2015" oninput="H._setFilter(\'vehicles\',\'yearMin\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + '<div><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Year To</div>'
      + '<input type="number" min="1960" max="2026" placeholder="e.g. 2024" oninput="H._setFilter(\'vehicles\',\'yearMax\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + '</div>'
      + H._sel('vehicles', 'fuelType', 'Fuel Type', [['all', 'All'], ['petrol', 'Petrol'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['lpg', 'LPG']])
      + H._txtInput('vehicles', 'brand', 'Make / Brand', 'e.g. Toyota, Honda, BMW')
      + H._citysel('vehicles') + H._priceRange('vehicles') + H._sortsel('vehicles');

    return '<div class="page active">'
      + H._catTopbar('Vehicles', '#e53935')
      + H._catHeader('vehicles', 'Vehicles', '#e53935', f)
      + '<div id="cl_vehicles" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No vehicles listed', 'Be the first to sell!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Vehicles_after = function () { H._applyFilters('vehicles'); };

})(window.H);

;/* === www/js/property.js === */
'use strict';
(function (H) {

  H.pages.Property = function () {
    var all = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'property'; });
    var sale = all.filter(function (l) { return !l.rentalType; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var rent = all.filter(function (l) { return !!l.rentalType; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var fSale = H._sel('property_sale', 'propType', 'Property Type', [['all', 'All Types'], ['residential', 'Residential'], ['commercial', 'Commercial'], ['land', 'Land / Stand'], ['units', 'Units / Flats']])
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + H._sel('property_sale', 'beds', 'Bedrooms', [['any', 'Any'], ['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+'], ['5', '5+']])
      + H._sel('property_sale', 'baths', 'Bathrooms', [['any', 'Any'], ['1', '1+'], ['2', '2+'], ['3', '3+']])
      + '</div>'
      + H._sel('property_sale', 'furnishing', 'Furnishing', [['all', 'All'], ['furnished', 'Furnished'], ['unfurnished', 'Unfurnished'], ['semi-furnished', 'Semi-Furnished']])
      + H._citysel('property_sale') + H._priceRange('property_sale') + H._sortsel('property_sale');

    var fRent = H._sel('property_rent', 'propType', 'Category', [['all', 'All'], ['residential', 'Residential'], ['rooms', 'Rooms'], ['commercial', 'Commercial']])
      + H._sel('property_rent', 'rentalType', 'Rental Type', [['all', 'All'], ['monthly', 'Monthly'], ['daily', 'Daily'], ['nightly', 'Nightly']])
      + H._sel('property_rent', 'furnishing', 'Furnishing', [['all', 'All'], ['furnished', 'Furnished'], ['unfurnished', 'Unfurnished'], ['semi-furnished', 'Semi-Furnished']])
      + H._citysel('property_rent') + H._priceRange('property_rent') + H._sortsel('property_rent');

    return '<div class="page active">'
      + H._catTopbar('Property', '#1A3A8F')
      + '<div style="background:#1A3A8F;padding:0 14px">'
      + '<div style="display:flex;border-bottom:2px solid rgba(255,255,255,.15)">'
      + '<button id="ptab_sale" onclick="H._propTab(\'sale\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:3px solid #F5A623;margin-bottom:-2px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">For Sale</button>'
      + '<button id="ptab_rent" onclick="H._propTab(\'rent\')" style="flex:1;padding:12px 0;background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;color:rgba(255,255,255,.6);font-size:14px;font-weight:600;cursor:pointer">For Rent</button>'
      + '</div></div>'
      + '<div id="pp_sale">'
      + H._catHeader('property_sale', 'Property for Sale', '#1A3A8F', fSale)
      + '<div id="cl_property_sale" style="padding-bottom:88px">'
      + (sale.length ? '<div class="listing-list">' + sale.map(H.renderListCard).join('') + '</div>' : H.emptyState('No properties for sale', 'Be the first to list one!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>'
      + '<div id="pp_rent" style="display:none">'
      + H._catHeader('property_rent', 'Property for Rent', '#1A3A8F', fRent)
      + '<div id="cl_property_rent" style="padding-bottom:88px">'
      + (rent.length ? '<div class="listing-list">' + rent.map(H.renderListCard).join('') + '</div>' : H.emptyState('No rental properties', 'Be the first to list one!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>'
      + '</div>';
  };

  H.pages.Property_after = function () { H._propTab('sale'); };

  H._propTab = function (tab) {
    var ps = document.getElementById('pp_sale'), pr = document.getElementById('pp_rent');
    var ts = document.getElementById('ptab_sale'), tr = document.getElementById('ptab_rent');
    if (!ps) return;
    var isSale = tab === 'sale';
    ps.style.display = isSale ? '' : 'none';
    pr.style.display = isSale ? 'none' : '';
    ts.style.color = isSale ? '#fff' : 'rgba(255,255,255,.6)';
    ts.style.fontWeight = isSale ? '700' : '600';
    ts.style.borderBottomColor = isSale ? '#F5A623' : 'transparent';
    tr.style.color = isSale ? 'rgba(255,255,255,.6)' : '#fff';
    tr.style.fontWeight = isSale ? '600' : '700';
    tr.style.borderBottomColor = isSale ? 'transparent' : '#F5A623';
    H._applyFilters(isSale ? 'property_sale' : 'property_rent');
  };

})(window.H);

;/* === www/js/electronics.js === */
'use strict';
(function (H) {

  H.pages.Electronics = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'electronics'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('electronics', 'subcat', 'Category', [['all', 'All'], ['phones', 'Phones & Tablets'], ['computers', 'Computers & Laptops'], ['tvs', 'TVs & Screens'], ['audio', 'Audio & Speakers'], ['cameras', 'Cameras'], ['gaming', 'Gaming'], ['appliances', 'Appliances'], ['accessories', 'Accessories']])
      + H._txtInput('electronics', 'brand', 'Brand', 'e.g. Samsung, Apple, Dell')
      + H._sel('electronics', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('electronics') + H._priceRange('electronics') + H._sortsel('electronics');

    return '<div class="page active">'
      + H._catTopbar('Electronics', '#8E24AA')
      + H._catHeader('electronics', 'Electronics', '#8E24AA', f)
      + '<div id="cl_electronics" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No electronics listed', 'Buy & sell gadgets!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Electronics_after = function () { H._applyFilters('electronics'); };

})(window.H);

;/* === www/js/fashion.js === */
'use strict';
(function (H) {

  H.pages.Fashion = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'fashion'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('fashion', 'gender', 'Category', [['all', 'All'], ['women', 'Women'], ['men', 'Men'], ['kids', 'Kids'], ['unisex', 'Unisex']])
      + H._sel('fashion', 'subcat', 'Type', [['all', 'All'], ['clothes', 'Clothes'], ['shoes', 'Shoes'], ['bags', 'Bags & Purses'], ['accessories', 'Accessories'], ['watches', 'Watches & Jewellery'], ['sportswear', 'Sportswear'], ['traditional', 'Traditional Wear']])
      + H._sel('fashion', 'size', 'Size', [['all', 'Any Size'], ['xs', 'XS'], ['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL'], ['xxl', '2XL'], ['xxxl', '3XL+']])
      + H._txtInput('fashion', 'brand', 'Brand', 'e.g. Nike, Zara, H&M')
      + H._sel('fashion', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('fashion') + H._priceRange('fashion') + H._sortsel('fashion');

    return '<div class="page active">'
      + H._catTopbar('Fashion', '#F06292')
      + H._catHeader('fashion', 'Fashion', '#F06292', f)
      + '<div id="cl_fashion" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No fashion items listed', 'Style up Zimbabwe!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Fashion_after = function () { H._applyFilters('fashion'); };

})(window.H);

;/* === www/js/furniture.js === */
'use strict';
(function (H) {

  H.pages.Furniture = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'furniture'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('furniture', 'subcat', 'Furniture Type', [['all', 'All'], ['sofas', 'Sofas & Lounge'], ['bedroom', 'Bedroom Sets'], ['dining', 'Dining Room'], ['office', 'Office Furniture'], ['outdoor', 'Outdoor'], ['kitchen', 'Kitchen'], ['wardrobes', 'Wardrobes'], ['decor', 'Home Décor']])
      + H._sel('furniture', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._txtInput('furniture', 'brand', 'Material', 'e.g. Wood, Leather, Fabric')
      + H._citysel('furniture') + H._priceRange('furniture') + H._sortsel('furniture');

    return '<div class="page active">'
      + H._catTopbar('Furniture', '#6D4C41')
      + H._catHeader('furniture', 'Furniture', '#6D4C41', f)
      + '<div id="cl_furniture" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No furniture listed', 'Furnish your home!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Furniture_after = function () { H._applyFilters('furniture'); };

})(window.H);

;/* === www/js/services.js === */
'use strict';
(function (H) {

  H.pages.Services = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'services'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('services', 'subcat', 'Service Type', [['all', 'All Services'], ['cleaning', 'Cleaning'], ['construction', 'Construction & Building'], ['plumbing', 'Plumbing'], ['electrical', 'Electrical'], ['painting', 'Painting'], ['gardening', 'Gardening & Landscaping'], ['transport', 'Transport & Delivery'], ['photography', 'Photography & Video'], ['catering', 'Catering & Events'], ['it', 'IT & Tech Support'], ['tutoring', 'Tutoring & Education'], ['beauty', 'Beauty & Wellness'], ['security', 'Security'], ['legal', 'Legal & Finance']])
      + H._citysel('services') + H._priceRange('services') + H._sortsel('services');

    return '<div class="page active">'
      + H._catTopbar('Services', '#00897B')
      + H._catHeader('services', 'Services', '#00897B', f)
      + '<div id="cl_services" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No services listed', 'Offer your skills in Zimbabwe!', 'Post a Service', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Services_after = function () { H._applyFilters('services'); };

})(window.H);

;/* === www/js/rooms.js === */
'use strict';
(function (H) {

  H.pages.Rooms = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'rooms'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('rooms', 'subcat', 'Room Type', [['all', 'All'], ['single', 'Single Room'], ['double', 'Double Room'], ['self-contained', 'Self-Contained'], ['shared', 'Shared'], ['bachelor', 'Bachelor Flat'], ['cottage', 'Cottage']])
      + H._sel('rooms', 'furnishing', 'Furnishing', [['all', 'All'], ['furnished', 'Furnished'], ['unfurnished', 'Unfurnished'], ['semi-furnished', 'Semi-Furnished']])
      + H._sel('rooms', 'rentalType', 'Rental Type', [['all', 'All'], ['monthly', 'Monthly'], ['daily', 'Daily'], ['nightly', 'Nightly']])
      + H._citysel('rooms') + H._priceRange('rooms') + H._sortsel('rooms');

    return '<div class="page active">'
      + H._catTopbar('Rooms for Rent', '#00838F')
      + H._catHeader('rooms', 'Rooms', '#00838F', f)
      + '<div id="cl_rooms" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No rooms listed', 'Find the perfect room!', 'Post a Room', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Rooms_after = function () { H._applyFilters('rooms'); };

})(window.H);

;/* === www/js/account.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  pages.Account = function () {
    const u = H.currentUser();
    if (!u) return H.guestAccountPage();
    return pages.AccountHub();
  };

  // ── Account Hub ───────────────────────────────────────────
  // A full-screen version of the account centre, reachable via
  // H.openInner('AccountHub') if needed; the bottom-nav tab still
  // opens the compact sheet via H.showAccountMenu().
  pages.AccountHub = function () {
    const u = H.currentUser();
    if (!u) {
      return `<div class="page active">
        ${H.innerTopbar('Account')}
        ${H.emptyState('Not signed in', 'Sign in to manage your account.', 'Sign In', 'H.authPage()')}
      </div>`;
    }

    const activeAds = (H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active').length;
    const savedAds  = ((H.state.saves || {})[u.id] || []).length;
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    const unread    = H.state.conversations.reduce((n, c) =>
      Array.isArray(c.members) && c.members.includes(u.id) ? n + (c.messages || []).filter(m => m.from !== u.id && !m.read).length : n, 0);

    const row = (icon, label, page, badge) => `
      <div onclick="H.openInner('${page}')"
          style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--card);border-bottom:1px solid var(--border);cursor:pointer;-webkit-tap-highlight-color:transparent">
        <div style="width:38px;height:38px;border-radius:12px;background:#1A3A8F14;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F">${icon}</div>
        <div style="flex:1;font-size:15px;font-weight:600;color:var(--text)">${label}</div>
        ${badge ? `<span style="background:#F5A623;color:#1A3A8F;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:800">${badge}</span>` : ''}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('Account')}

      <!-- Profile Hero -->
      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:24px 20px 28px;display:flex;align-items:center;gap:16px">
        <div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px;font-weight:800;color:#fff;border:2.5px solid rgba(255,255,255,.4)">
          ${u.avatar ? `<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.innerHTML=H.initials('${H.escHtml(u.name||'')}')">` : H.initials(u.name)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${H.escHtml(u.name || 'User')}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.8);margin-bottom:3px">${H.escHtml(u.email || '')}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.65)">${H.escHtml(u.phone || 'No phone number')}</div>
        </div>
        ${u.verified ? '<span style="background:#22C55E;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Verified</span>' : ''}
      </div>

      <!-- Quick Stats -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);background:var(--card);border-bottom:1px solid var(--border)">
        ${[['Active Ads', activeAds, "H.openInner('MyListings')"], ['Saved', savedAds, "H.openInner('Favorites')"], ['Messages', unread || 0, "H.navTo('Messages')"]].map(([l, v, fn]) => `
          <div onclick="${fn}" style="padding:16px 8px;text-align:center;cursor:pointer;border-right:1px solid var(--border)">
            <div style="font-size:22px;font-weight:800;color:#1A3A8F">${v}</div>
            <div style="font-size:11px;color:var(--sub);font-weight:500;margin-top:2px">${l}</div>
          </div>`).join('')}
      </div>

      <!-- Menu Rows -->
      <div style="margin-top:12px">
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', 'My Profile', 'Profile', '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', 'My Activity', 'MyActivity', '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>', 'Edit Profile', 'EditProfile', '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', 'My Listings', 'MyListings', activeAds || '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', 'Saved & Favorites', 'Favorites', savedAds || '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>', 'My Job Applications', 'AppliedJobs', ((H.state.applications||[]).filter(a=>a.applicantId===u.id).length || ''))}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>', 'My Job Profile / CV', 'JobSeekerProfile', u.cv && u.cv.headline ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>', 'Advertisements', 'Ads', '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', 'My Advertisements', 'MyAds', '')}
      </div>

      <div style="margin-top:12px">
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', 'Settings', 'Settings', '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', 'Security & Password', 'SecuritySettings', '')}
        ${row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', 'Help & Support', 'Help', '')}
      </div>

      <div style="padding:20px 16px 36px">
        <button onclick="H.logout()" style="width:100%;padding:14px;background:#FFF1F0;color:#EF4444;border:1.5px solid #FECACA;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">
          Sign Out
        </button>
        <div style="text-align:center;margin-top:20px;font-size:11px;color:var(--sub);line-height:1.8">
          © ${new Date().getFullYear()} PaMarket · Made in Zimbabwe 🇿🇼<br>
          <span style="font-size:10px;color:var(--sub2,#bbb)">All rights reserved · <span onclick="H.openInner('HelpTerms')" style="cursor:pointer;text-decoration:underline">Terms</span> · <span onclick="H.openInner('HelpPrivacy')" style="cursor:pointer;text-decoration:underline">Privacy</span></span>
        </div>
      </div>
    </div>`;
  };

})(window.H = window.H || {});

;/* === www/js/profile.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  const activeCount = uid => (H.state.listings || []).filter(l => l.sellerId === uid && l.status === 'active').length;
  const soldCount   = uid => (H.state.listings || []).filter(l => l.sellerId === uid && l.status === 'sold').length;

  const IC = {
    pencil: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><line x1="15" y1="5" x2="19" y2="9"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    star:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    phone:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    idCard: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M10 14h4"/><circle cx="10" cy="17" r="1"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    alert:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  const starFill  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const starEmpty = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const stars = n => Array.from({length:5}, (_,i) => i < Math.round(n) ? starFill : starEmpty).join('');

  pages.Profile = function (params) {
    const viewId = params && params.id;
    const u = viewId
      ? (H.state.users || []).find(x => x.id === viewId)
      : H.currentUser();

    if (!u) return H.emptyState('Not logged in', 'Please sign in to continue', 'Sign In', "H.authPage()");

    const isOwn      = !viewId || (H.currentUser() && viewId === H.currentUser().id);
    const uPrivacy   = u.privacySettings || {};
    const verified   = u.verified
      ? `<span class="verified">${IC.check} Verified</span>`
      : `<span class="unverified">${IC.alert} Not Verified</span>`;
    const avgRating  = (u.ratings && u.ratings.length)
      ? (u.ratings.reduce((a,b) => a+b, 0) / u.ratings.length).toFixed(1) : '0';
    const ratingCount = u.ratings ? u.ratings.length : 0;
    const showActivityDot = uPrivacy.showActivity === true;

    return `<div class="page active">
      ${H.innerTopbar(isOwn ? 'My Profile' : H.escHtml(u.name))}
      <div class="profile-hero">
        <div class="profile-pic" style="position:relative">
          ${u.avatar
            ? `<img src="${u.avatar}" alt="${H.escHtml(u.name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';this.parentElement.innerHTML=H.initials(H.escHtml('${u.name.replace(/'/g, "\\'")}'))">`
            : `<div class="profile-initials">${H.initials(u.name)}</div>`}
          ${showActivityDot ? `<div style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid var(--card,#fff)"></div>` : ''}
        </div>
        <div class="profile-info">
          <div class="profile-name">${H.escHtml(u.name || 'User')}</div>
          <div class="profile-phone">${IC.phone} ${H.escHtml(u.phone || 'No phone')}</div>
          <div class="profile-status">${verified}</div>
          ${isOwn && uPrivacy.profilePublic === false ? `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:20px;font-size:11px;font-weight:700;color:#92400e"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Your profile is set to private</div>` : ''}
        </div>
      </div>

      <div class="profile-stats">
        <div class="stat-box"><div class="stat-val">${activeCount(u.id)}</div><div class="stat-label">Active Ads</div></div>
        <div class="stat-box"><div class="stat-val">${avgRating}</div><div class="stat-label">Rating (${ratingCount})</div></div>
        <div class="stat-box"><div class="stat-val">${soldCount(u.id)}</div><div class="stat-label">Sold</div></div>
      </div>

      ${isOwn ? `
      <div class="form-wrap">
        <button class="btn-pri" onclick="H.openInner('EditProfile')">${IC.pencil} Edit Profile</button>
        <button class="btn-sec" onclick="H.openInner('ProfileVerify')">${IC.shield} Verify Identity</button>
        <button class="btn-sec" onclick="H.openInner('Reviews')">${IC.star} Reviews & Ratings</button>
      </div>` : `
      <div class="form-wrap">
        ${uPrivacy.allowMessages === false
          ? `<button class="btn-pri" disabled style="opacity:0.5;cursor:not-allowed">Messaging turned off</button>`
          : `<button class="btn-pri" onclick="H.startChatWith('${u.id}', null)">Message ${H.escHtml(u.name)}</button>`}
        <button class="btn-sec" onclick="H.reportUser('${u.id}')">Report User</button>
      </div>`}

      <div class="section-box">
        <div class="section-title">Account Info</div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-val">${H.escHtml(u.email || 'N/A')}</span></div>
        <div class="info-row"><span class="info-label">Joined</span><span class="info-val">${new Date(u.joinedAt || u.createdAt || Date.now()).toLocaleDateString()}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-val">${H.escHtml(u.status || 'Active')}</span></div>
        ${u.bio ? `<div class="info-row"><span class="info-label">Bio</span><span class="info-val">${H.escHtml(u.bio)}</span></div>` : ''}
      </div>

      <div class="section-box">
        <div class="section-title">Active Listings</div>
        <div class="listing-list">
          ${(H.state.listings || []).filter(l => l.sellerId === u.id && l.status === 'active').slice(0,6).map(H.renderListCard).join('')
            || '<div style="color:var(--sub);padding:16px;font-size:13px">No active listings</div>'}
        </div>
      </div>
      <div style="height:24px"></div>
    </div>`;
  };

  pages.EditProfile = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');

    return `<div class="page active">
      ${H.innerTopbar('Edit Profile')}
      <div class="form-wrap">
        <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0 16px">
          <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:#1A3A8F14;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#1A3A8F;margin-bottom:10px;border:2.5px solid #1A3A8F22">
            ${u.avatar ? `<img id="avatarPreview" src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';this.parentElement.innerHTML=H.initials(H.escHtml('${u.name.replace(/'/g, "\\'")}'))">` : `<span id="avatarPreview">${H.initials(u.name)}</span>`}
          </div>
          <label for="profilePicFile" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer;background:#1A3A8F14;padding:7px 16px;border-radius:20px">Change Photo</label>
          <input type="file" id="profilePicFile" accept="image/*" capture="user" style="display:none" onchange="H._editProfile.onPicChange(event)">
        </div>
        <div class="fg"><div class="fl">Full Name <span style="color:#EF4444">*</span></div>
          <input class="fi" id="editName" value="${H.escHtml(u.name || '')}" placeholder="Your full name" maxlength="60">
        </div>
        <div class="fg"><div class="fl">Phone Number</div>
          <input class="fi" id="editPhone" value="${H.escHtml(u.phone || '')}" placeholder="+263 77 123 4567" type="tel" maxlength="16">
          <div style="font-size:11px;color:var(--sub);margin-top:4px">International format, e.g. +263 77 123 4567</div>
        </div>
        <div class="fg"><div class="fl">Email</div>
          <input class="fi" value="${H.escHtml(u.email || '')}" disabled style="opacity:.6;cursor:not-allowed">
          <div style="font-size:11px;color:var(--sub);margin-top:4px">Email cannot be changed here</div>
        </div>
        <div class="fg"><div class="fl">Bio</div>
          <textarea class="fi" rows="3" id="editBio" placeholder="Tell buyers about yourself..." maxlength="200">${H.escHtml(u.bio || '')}</textarea>
        </div>
        <div id="editSaveMsg" style="display:none;font-size:13px;color:#16A34A;text-align:center;padding:8px 0;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#16A34A" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Saved!</div>
        <div id="editErrMsg"  style="display:none;font-size:13px;color:#EF4444;text-align:center;padding:8px 0"></div>
        <div class="btn-group">
          <button id="editSaveBtn" class="btn-pri" onclick="H._editProfile.save()">Save Changes</button>
          <button class="btn-sec" onclick="H.openInner('ChangePassword')">Change Password</button>
          <button class="btn-sec" onclick="H.goBack()">Cancel</button>
        </div>
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Danger Zone</div>
          <button onclick="H._editProfile.deleteCV()" style="width:100%;padding:13px;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;color:#DC2626;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px">Delete My CV / Candidate Profile</button>
          <button onclick="H._editProfile.deleteAccount()" style="width:100%;padding:13px;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;color:#DC2626;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#DC2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Delete Account</button>
        </div>
      </div>
    </div>`;
  };

  pages.EditProfile_after = function () {
    H._editProfile = {
      onPicChange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { H.toast('Photo must be under 3 MB'); return; }
        const compressed = await H.compressImage(file, 400, 0.82);
        const u = H.currentUser();
        u.avatar = compressed;
        H.saveState();
        const prev = document.getElementById('avatarPreview');
        if (prev) { prev.outerHTML = `<img id="avatarPreview" src="${compressed}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';this.parentElement.innerHTML=H.initials(H.escHtml('${(u.name||'').replace(/'/g,"\\'")}'))">`; }
      },
      save: async () => {
        const u = H.currentUser();
        const name  = (document.getElementById('editName')?.value || '').trim();
        const phone = (document.getElementById('editPhone')?.value || '').trim();
        const bio   = (document.getElementById('editBio')?.value || '').trim();
        const btn   = document.getElementById('editSaveBtn');
        const errEl = document.getElementById('editErrMsg');
        const okEl  = document.getElementById('editSaveMsg');
        const showErr = (msg) => { if(errEl){errEl.textContent=msg;errEl.style.display='';} H.toast(msg); };
        if (!name || name.length < 2) { showErr('Please enter your full name (min 2 characters)'); return; }
        if (phone && !/^\+?[0-9\s\-]{7,16}$/.test(phone)) { showErr('Phone number looks invalid. Use format: +263 77 123 4567'); return; }
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        if (errEl) errEl.style.display = 'none';
        u.name  = name;
        if (phone) u.phone = phone;
        u.bio   = bio;
        H.saveState();
        const c = window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
        if (c) {
          const res = await c.from('profiles').upsert({ id: u.id, name: u.name, phone: u.phone || null, bio: u.bio || null, avatar: u.avatar || null, updated_at: new Date().toISOString() });
          if (res && res.error) console.warn('Profile sync failed:', res.error.message);
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        if (okEl) { okEl.style.display = ''; setTimeout(() => { if(okEl) okEl.style.display='none'; }, 2500); }
        H.toast('Profile updated!');
      },
      deleteCV() {
        H.modal({
          title: 'Delete CV / Candidate Profile?',
          body: 'This will permanently remove your professional profile and CV from PaMarket. Your listings will not be affected.',
          confirmText: 'Delete CV',
          cancelText: 'Cancel',
          danger: true,
          onConfirm() {
            const u = H.currentUser();
            if (!u) return;
            delete u.cv;
            delete u.jobTitle;
            delete u.skills;
            H.saveState();
            if (window.supabase && typeof window.supabase.from === 'function') {
              window.supabase.from('profiles').update({ cv: null, job_title: null, skills: null }, { returning: 'minimal' }).eq('id', u.id).catch(() => {});
            }
            H.toast('CV deleted');
            H.renderPage('EditProfile');
          },
        });
      },
      deleteAccount() {
        H.modal({
          title: 'Delete Account?',
          body: `<div style="font-size:14px;color:var(--text);line-height:1.7">
            <p style="margin:0 0 10px;color:#DC2626;font-weight:700;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#DC2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> This cannot be undone.</p>
            <p style="margin:0 0 8px">All your listings, messages, and profile data will be permanently removed.</p>
            <p style="margin:0">Type <strong>DELETE</strong> below to confirm:</p>
            <input id="deleteConfirmInput" class="fi" style="margin-top:10px" placeholder="Type DELETE">
          </div>`,
          confirmText: 'Delete My Account',
          cancelText: 'Cancel',
          danger: true,
          onConfirm() {
            const inp = document.getElementById('deleteConfirmInput');
            if (!inp || inp.value.trim() !== 'DELETE') { H.toast('Type DELETE to confirm'); return; }
            const u = H.currentUser();
            if (!u) return;
            H.state.listings = (H.state.listings || []).filter(l => l.sellerId !== u.id);
            H.state.conversations = (H.state.conversations || []).filter(c => !(c.members || []).includes(u.id));
            H.state.users = (H.state.users || []).filter(x => x.id !== u.id);
            H.state.currentUserId = null;
            H.saveState();
            if (window.supabase && window.supabase.auth) {
              window.supabase.auth.signOut().catch(() => {}).finally(() => window.location.reload());
            } else {
              window.location.reload();
            }
          },
        });
      },
    };
  };

  pages.MyListings = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');
    const all      = (H.state.listings || []).filter(l => l.sellerId === u.id);
    const active   = all.filter(l => l.status === 'active');
    const pending  = all.filter(l => l.status === 'pending');
    const sold     = all.filter(l => l.status === 'sold');
    const rejected = all.filter(l => l.status === 'rejected');
    const btn = (label, fn, c, bg, bo) =>
      `<button onclick="${fn}" style="flex:1;padding:8px 2px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;background:${bg};color:${c};border:1.5px solid ${bo};font-family:inherit;white-space:nowrap">${label}</button>`;
    const actionBars = {
      active:   (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); const isJob=l&&l.cat==='jobs'; return btn('Edit',`H._myListings.edit('${id}')`,'#1A3A8F','#EFF6FF','#BFDBFE')+btn(isJob?'Mark Filled':'Mark Sold',`H._myListings.markSold('${id}')`,'#16a34a','#dcfce7','#bbf7d0')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'); },
      pending:  (id) => btn('Edit',`H._myListings.edit('${id}')`,'#1A3A8F','#EFF6FF','#BFDBFE')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'),
      sold:     (id) => btn('Post Again',`H._myListings.reactivate('${id}')`,'#1A3A8F','#EFF6FF','#BFDBFE')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'),
      rejected: (id) => btn('Edit & Resubmit',`H._myListings.edit('${id}')`,'#D97706','#FFFBEB','#FDE68A')+btn('Delete',`H._myListings.del('${id}')`,'#ef4444','#fef2f2','#fecaca'),
    };
    const myCard = (l, status) => `<div style="margin-bottom:14px">${H.renderListCard(l)}<div style="display:flex;gap:6px;margin-top:6px">${(actionBars[status]||actionBars.active)(l.id)}</div></div>`;
    const section = (list, label, status) => list.length
      ? `<div style="padding:12px">${list.map(l => myCard(l, status)).join('')}</div>`
      : `<div style="color:var(--sub);padding:32px 20px;text-align:center;font-size:13px">No ${label.toLowerCase()} listings</div>`;
    return `<div class="page active">
      ${H.innerTopbar('My Listings')}
      <div class="listing-tabs">
        <button class="tab active" data-tab="active">Active (${active.length})</button>
        <button class="tab" data-tab="pending">Pending (${pending.length})</button>
        <button class="tab" data-tab="sold">Sold / Filled (${sold.length})</button>
        <button class="tab" data-tab="rejected">Rejected (${rejected.length})</button>
      </div>
      <div class="tabs-content">
        <div class="tab-content active" data-tab="active">${section(active,'Active','active')}</div>
        <div class="tab-content" data-tab="pending">${section(pending,'Pending','pending')}</div>
        <div class="tab-content" data-tab="sold">${section(sold,'Sold / Filled','sold')}</div>
        <div class="tab-content" data-tab="rejected">${section(rejected,'Rejected','rejected')}</div>
      </div>
      <div style="height:24px"></div>
    </div>`;
  };

  pages.MyListings_after = function () {
    document.querySelectorAll('.listing-tabs .tab').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.listing-tabs .tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const el = document.querySelector(`.tab-content[data-tab="${e.target.dataset.tab}"]`);
        if (el) el.classList.add('active');
      });
    });
    H._myListings = {
      edit: (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); H.openInner(l&&l.cat==='jobs'?'EditJob':'EditListing',{listingId:id}); },
      markSold: (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); if(!l)return; l.status='sold'; l.soldAt=Date.now(); H.saveState(); if(window.supabase&&typeof window.supabase.from==='function') window.supabase.from('listings').update({status:'sold'}).eq('id',id); H.toast(l.cat==='jobs' ? 'Job marked as filled' : 'Listing marked as sold'); H.renderPage('MyListings'); },
      del: (id) => { if(!window.confirm('Delete this listing permanently?'))return; H.state.listings=(H.state.listings||[]).filter(x=>x.id!==id); H.saveState(); H.toast('Listing deleted'); H.renderPage('MyListings'); },
      reactivate: (id) => { const l=(H.state.listings||[]).find(x=>x.id===id); if(!l)return; l.status='active'; delete l.soldAt; l.renewedAt=Date.now(); H.saveState(); if(window.supabase&&typeof window.supabase.from==='function') window.supabase.from('listings').update({status:'active'}).eq('id',id); H.toast(l.cat==='jobs' ? 'Job reopened!' : 'Listing reactivated!'); H.renderPage('MyListings'); },
    };
  };

  pages.EditListing = function (params) {
    const id = params && params.listingId;
    const l  = id ? (H.state.listings || []).find(x => x.id === id) : null;
    if (!l) return `<div class="page active">${H.innerTopbar('Edit Listing')}${H.emptyState('Listing not found','')}</div>`;
    return `<div class="page active">
      ${H.innerTopbar('Edit Listing')}
      <div class="form-wrap">
        <div class="fg"><div class="fl">Title</div><input class="fi" id="elTitle" value="${H.escHtml(l.title || '')}" placeholder="Listing title" maxlength="80"></div>
        <div class="fg"><div class="fl">Price (USD)</div><input class="fi" id="elPrice" type="number" min="0" value="${H.escHtml(String(l.price || ''))}" placeholder="0"></div>
        <div class="fg"><div class="fl">Description</div><textarea class="fi" id="elDesc" rows="5" placeholder="Describe your item...">${H.escHtml(l.description || '')}</textarea></div>
        <div id="elErr" style="display:none;color:#ef4444;font-size:13px;font-weight:600;padding:6px 0"></div>
        <button id="elSaveBtn" class="btn-pri" onclick="H._editListing.save('${id}')">Save Changes</button>
        <button class="btn-sec" onclick="H.goBack()">Cancel</button>
      </div>
    </div>`;
  };

  pages.EditListing_after = function () {
    H._editListing = {
      save: (id) => {
        const title = document.getElementById('elTitle')?.value.trim();
        const price = parseFloat(document.getElementById('elPrice')?.value);
        const desc  = document.getElementById('elDesc')?.value.trim();
        const errEl = document.getElementById('elErr');
        const btn   = document.getElementById('elSaveBtn');
        const showErr = (m) => { if(errEl){errEl.textContent=m;errEl.style.display='';} };
        if (!title) { showErr('Title is required'); return; }
        if (isNaN(price) || price < 0) { showErr('Enter a valid price'); return; }
        if (!desc) { showErr('Description is required'); return; }
        const l = (H.state.listings || []).find(x => x.id === id);
        if (!l) { showErr('Listing not found'); return; }
        l.title=title; l.price=price; l.description=desc; l.updatedAt=Date.now();
        if (l.status === 'rejected') l.status = 'pending';
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        H.saveState();
        H.toast('Listing updated!');
        H.goBack();
      }
    };
  };

  pages.Favorites = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');
    const saved = (H.state.saves && H.state.saves[u.id]) || [];
    const list  = (H.state.listings || []).filter(l => saved.includes(l.id) && l.status === 'active');
    const savedCard = (l) =>
      `<div style="margin-bottom:14px">
        ${H.renderListCard(l)}
        <div style="display:flex;gap:6px;margin-top:6px">
          <button onclick="H._favorites.unsave('${l.id}')" style="flex:1;padding:9px 4px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:#fef2f2;color:#ef4444;border:1.5px solid #fecaca;font-family:inherit">Remove</button>
          <button onclick="H.openListing('${l.id}')" style="flex:2;padding:9px 4px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:#EFF6FF;color:#1A3A8F;border:1.5px solid #BFDBFE;font-family:inherit">View Listing</button>
        </div>
      </div>`;
    return `<div class="page active">
      ${H.innerTopbar(list.length ? `Saved & Favorites (${list.length})` : 'Saved & Favorites')}
      <div style="padding:14px">
        ${list.length ? list.map(savedCard).join('') : H.emptyState('No saved listings', 'Tap the heart on any listing to save it', 'Browse', "H.navTo('Browse')")}
      </div>
      <div style="height:24px"></div>
    </div>`;
  };

  pages.Favorites_after = function () {
    H._favorites = {
      unsave: (id) => {
        const u = H.currentUser(); if (!u) return;
        H.state.saves = H.state.saves || {};
        H.state.saves[u.id] = (H.state.saves[u.id] || []).filter(sid => sid !== id);
        H.saveState();
        H.toast('Removed from saved');
        H.renderPage('Favorites');
      }
    };
  };

  pages.ProfileVerify = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');
    if (u.verified) return `<div class="page active">${H.innerTopbar('Identity Verification')}<div class="section-box" style="text-align:center;padding:32px 20px"><div style="margin-bottom:12px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Identity Verified</div><div style="font-size:14px;color:var(--sub)">You have a verified badge on all your listings.</div><div style="font-size:12px;color:var(--sub);margin-top:8px">Verified on ${new Date(u.verifiedAt || Date.now()).toLocaleDateString()}</div></div></div>`;
    if (u.verificationPending) return `<div class="page active">${H.innerTopbar('Identity Verification')}<div class="section-box" style="text-align:center;padding:32px 20px"><div style="margin-bottom:12px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Verification Pending</div><div style="font-size:14px;color:var(--sub)">Your request is under review. We will notify you within 24 hours.</div><button onclick="H._profileVerify.cancelPending()" style="margin-top:18px;padding:10px 28px;background:var(--bg);color:var(--sub);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel request</button></div></div>`;
    return `<div class="page active">
      ${H.innerTopbar('Verify Identity')}
      <div class="section-box" style="text-align:center;padding:20px 20px 14px">
        <div style="margin-bottom:10px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">Identity Verification</div>
        <div style="font-size:13px;color:var(--sub)">Submit your ID and a selfie. Review takes up to 24 hours.</div>
      </div>
      <div class="form-wrap">
        <div class="fg"><div class="fl">ID Type</div><select class="fi" id="idType"><option>National ID</option><option>Passport</option><option>Driver&#39;s License</option></select></div>
        <div class="fg"><div class="fl">ID Number</div><input class="fi" id="idNum" placeholder="Enter your ID number"></div>
        <div class="fg">
          <div class="fl">Selfie Photo <span style="font-weight:400;color:var(--sub);font-size:11px">(center your face in the oval)</span></div>
          <div style="position:relative;width:220px;height:280px;margin:0 auto 10px;border-radius:14px;overflow:hidden;background:#111">
            <div id="selfiePH" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a2e;gap:8px">
              <div style="display:flex;justify-content:center"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
              <div style="font-size:12px;color:rgba(255,255,255,.65);text-align:center;padding:0 16px">Tap Camera or Upload to add your selfie</div>
            </div>
            <video id="selfieVid" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;transform:scaleX(-1)"></video>
            <canvas id="selfieCanvas" style="display:none"></canvas>
            <div id="selfiePrev" style="display:none;position:absolute;inset:0"><img id="selfieImg" style="width:100%;height:100%;object-fit:cover"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
              <div style="width:130px;height:170px;border-radius:50%;border:3px solid rgba(255,255,255,.88);box-shadow:0 0 0 9999px rgba(0,0,0,.48)"></div>
            </div>
          </div>
          <div style="display:flex;gap:8px;max-width:220px;margin:0 auto">
            <button id="selfieStartBtn" onclick="H._profileVerify.startCamera()" style="flex:1;padding:10px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> Camera</button>
            <button id="selfieCapBtn" onclick="H._profileVerify.captureSelfie()" style="display:none;flex:1;padding:10px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Capture</button>
            <button id="selfieRetakeBtn" onclick="H._profileVerify.retakeSelfie()" style="display:none;flex:1;padding:10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;align-items:center;justify-content:center;gap:4px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Retake</button>
            <label for="selfieFile" style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer">Upload</label>
            <input type="file" id="selfieFile" accept="image/*" capture="user" style="display:none" onchange="H._profileVerify.handleSelfieFile(this)">
          </div>
        </div>
        <div class="fg"><div class="fl">ID Photo (Front)</div>
          <label class="img-upload-zone" for="idPhotoFront"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div class="img-upload-title" id="idPhotoLabel">Upload front of ID</div><div class="img-upload-sub">National ID, Passport or Driver&#39;s License</div></label>
          <input type="file" id="idPhotoFront" accept="image/*" capture="environment" style="display:none" onchange="H._profileVerify.previewIdPhoto(this)">
        </div>
        <button class="btn-pri" onclick="H._profileVerify.submit()">Submit for Verification</button>
      </div>
    </div>`;
  };

  pages.ProfileVerify_after = function () {
    H._profileVerify = {
      _stream: null,
      _selfieData: null,

      startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          H.toast('Camera not available — please upload a selfie photo.');
          return;
        }
        const btn = document.getElementById('selfieStartBtn');
        if (btn) btn.style.display = 'none';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } } })
          .then(stream => {
            this._stream = stream;
            const vid = document.getElementById('selfieVid');
            const ph  = document.getElementById('selfiePH');
            const cap = document.getElementById('selfieCapBtn');
            if (vid) { vid.srcObject = stream; vid.style.display = 'block'; }
            if (ph)  ph.style.display = 'none';
            if (cap) cap.style.display = 'flex';
          })
          .catch(() => {
            H.toast('Camera permission denied — use Upload instead.');
            const btn2 = document.getElementById('selfieStartBtn');
            if (btn2) btn2.style.display = 'flex';
          });
      },

      captureSelfie() {
        const vid    = document.getElementById('selfieVid');
        const canvas = document.getElementById('selfieCanvas');
        if (!vid || !canvas) return;
        canvas.width  = vid.videoWidth  || 480;
        canvas.height = vid.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(vid, 0, 0);
        this._selfieData = canvas.toDataURL('image/jpeg', 0.85);
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
        vid.style.display = 'none';
        const prev    = document.getElementById('selfiePrev');
        const img     = document.getElementById('selfieImg');
        const capBtn  = document.getElementById('selfieCapBtn');
        const retake  = document.getElementById('selfieRetakeBtn');
        if (prev)   prev.style.display = 'block';
        if (img)    img.src = this._selfieData;
        if (capBtn) capBtn.style.display = 'none';
        if (retake) retake.style.display = 'flex';
        H.toast('Selfie captured');
      },

      retakeSelfie() {
        this._selfieData = null;
        const prev   = document.getElementById('selfiePrev');
        const retake = document.getElementById('selfieRetakeBtn');
        if (prev)   prev.style.display = 'none';
        if (retake) retake.style.display = 'none';
        this.startCamera();
      },

      handleSelfieFile(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          this._selfieData = e.target.result;
          const ph      = document.getElementById('selfiePH');
          const vid     = document.getElementById('selfieVid');
          const prev    = document.getElementById('selfiePrev');
          const img     = document.getElementById('selfieImg');
          const startBtn = document.getElementById('selfieStartBtn');
          const capBtn  = document.getElementById('selfieCapBtn');
          const retake  = document.getElementById('selfieRetakeBtn');
          if (ph)       ph.style.display = 'none';
          if (vid)      vid.style.display = 'none';
          if (prev)     prev.style.display = 'block';
          if (img)      img.src = this._selfieData;
          if (startBtn) startBtn.style.display = 'none';
          if (capBtn)   capBtn.style.display = 'none';
          if (retake)   retake.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      },

      previewIdPhoto(input) {
        const label = document.getElementById('idPhotoLabel');
        if (input.files && input.files[0] && label) label.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg> ID photo selected';
      },

      async submit() {
        const idType = document.getElementById('idType')?.value || 'National ID';
        const idNum  = (document.getElementById('idNum')?.value || '').trim();
        if (!idNum) { H.toast('Please enter your ID number'); return; }
        if (!this._selfieData) { H.toast('Please take or upload a selfie photo'); return; }
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
        const btn = document.querySelector('.btn-pri[onclick="H._profileVerify.submit()"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
        const u = H.currentUser();
        const sb = window.supabase;

        const doSubmit = async (idDocData) => {
          try {
            if (!sb) throw new Error('Not connected to server');
            const { error: vErr } = await sb.from('verifications').upsert({
              user_id: u.id,
              id_doc: idDocData || null,
              selfie: this._selfieData,
              status: 'pending',
              submitted_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            if (vErr) throw vErr;
            const { error: pErr } = await sb.from('profiles').update({
              verification_pending: true,
              updated_at: new Date().toISOString()
            }).eq('id', u.id);
            if (pErr) throw pErr;
            u.verificationPending    = true;
            u.verification_pending   = true;
            u.verificationIdType     = idType;
            u.verificationIdNum      = idNum;
            H.saveState();
            H.toast('Verification submitted! Admin will review within 24 hours.');
            H.goBack();
          } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
            H.toast('Failed to submit: ' + (e.message || 'Check your connection'));
          }
        };

        const idFile = document.getElementById('idPhotoFront');
        if (idFile && idFile.files && idFile.files[0]) {
          const reader = new FileReader();
          reader.onload = e => doSubmit(e.target.result);
          reader.readAsDataURL(idFile.files[0]);
        } else {
          doSubmit(null);
        }
      },

      async cancelPending() {
        const u = H.currentUser();
        u.verificationPending  = false;
        u.verification_pending = false;
        H.saveState();
        const sb = window.supabase;
        if (sb) {
          await sb.from('profiles').update({ verification_pending: false }).eq('id', u.id);
          await sb.from('verifications').delete().eq('user_id', u.id);
        }
        H.toast('Verification request cancelled');
        H.renderPage('ProfileVerify');
      }
    };
  };

  pages.Reviews = function (params) {
    const viewId = params && params.id;
    const me = H.currentUser();
    const u  = viewId ? (H.state.users || []).find(x => x.id === viewId) : me;
    if (!u) return '<div class="page active">' + H.innerTopbar('Reviews') + H.emptyState('User not found', '', null, null) + '</div>';
    const isOwn = !viewId || (me && viewId === me.id);
    const reviews = u.reviews || [];
    const avg = reviews.length ? (reviews.reduce((a,r) => a + (r.rating||0), 0) / reviews.length).toFixed(1) : null;
    const dist = [5,4,3,2,1].map(n => ({ n, count: reviews.filter(r => Math.round(r.rating||0)===n).length }));
    const maxDist = Math.max(1, ...dist.map(d => d.count));
    const alreadyReviewed = me && reviews.some(r => r.reviewerId === me.id);
    return `<div class="page active">
      ${H.innerTopbar(isOwn ? 'My Reviews' : H.escHtml(u.name) + '\'s Reviews')}
      <div style="background:var(--card);padding:20px 16px;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:20px;align-items:center">
          <div style="text-align:center">
            <div style="font-size:52px;font-weight:900;color:var(--text);line-height:1">${avg || '–'}</div>
            <div style="display:flex;justify-content:center;gap:2px;margin:6px 0">${avg ? stars(parseFloat(avg)) : stars(0)}</div>
            <div style="font-size:12px;color:var(--sub)">${reviews.length} review${reviews.length===1?'':'s'}</div>
          </div>
          <div style="flex:1">
            ${dist.map(d => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><div style="font-size:11px;color:var(--sub);width:8px">${d.n}</div><div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;background:#f59e0b;width:${Math.round((d.count/maxDist)*100)}%;border-radius:3px;transition:width .3s"></div></div><div style="font-size:11px;color:var(--sub);width:14px;text-align:right">${d.count}</div></div>`).join('')}
          </div>
        </div>
        ${!isOwn && me && !alreadyReviewed ? `<button onclick="H.leaveReview('${u.id}')" style="width:100%;margin-top:16px;padding:12px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Leave a Review</button>` : ''}
        ${!isOwn && me && alreadyReviewed ? `<div style="text-align:center;margin-top:14px;font-size:13px;color:var(--sub)">You have already reviewed this seller</div>` : ''}
      </div>
      <div style="padding:12px 14px 88px">
        ${reviews.length ? reviews.slice().sort((a,b) => b.date - a.date).slice(0,20).map(r => `
          <div style="background:var(--card);border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div><div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(r.reviewerName || 'Anonymous')}</div><div style="display:flex;gap:2px;margin-top:3px">${stars(r.rating||0)}</div></div>
              <div style="font-size:12px;color:var(--sub)">${H.timeAgo(r.date)}</div>
            </div>
            ${r.text ? `<div style="font-size:13px;color:var(--text);line-height:1.6;margin-top:8px">${H.escHtml(r.text)}</div>` : ''}
          </div>`).join('') : `<div style="text-align:center;padding:48px 20px"><div style="display:flex;justify-content:center;margin-bottom:12px"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">No reviews yet</div><div style="font-size:13px;color:var(--sub)">Reviews from buyers will appear here after transactions</div></div>`}
      </div>
    </div>`;
  };

  H.leaveReview = function (sellerId) {
    const me = H.currentUser();
    if (!me) { H.requireAuth('Sign in to leave a review'); return; }
    if (sellerId === me.id) { H.toast('You cannot review yourself'); return; }
    H.modal({
      title: 'Leave a Review',
      body: `<div style="text-align:center;margin-bottom:14px"><div style="font-size:13px;color:var(--sub);margin-bottom:10px">Tap to rate your experience</div><div id="starPicker" style="display:flex;justify-content:center;gap:8px">${[1,2,3,4,5].map(n => `<button data-star="${n}" onclick="H._pickStar(${n})" style="background:none;border:none;cursor:pointer;padding:4px;line-height:1"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--sub)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`).join('')}</div></div><textarea id="reviewText" rows="3" placeholder="Share your experience with this seller…" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-size:13px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:Inter,sans-serif"></textarea>`,
      confirmText: 'Submit Review',
      onConfirm: () => {
        const rating = H._selectedStar || 0;
        const text   = (document.getElementById('reviewText') || {}).value || '';
        if (!rating) { H.toast('Please select a star rating'); return false; }
        H._submitReview(sellerId, rating, text);
      }
    });
  };

  H._selectedStar = 0;
  H._pickStar = function (n) {
    H._selectedStar = n;
    const btns = document.querySelectorAll('#starPicker button');
    btns.forEach(function(b) {
      const v = parseInt(b.getAttribute('data-star'));
      const filled = v <= n;
      b.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="${filled ? '#f59e0b' : 'none'}" stroke="${filled ? '#f59e0b' : 'currentColor'}" stroke-width="2" style="color:${filled ? '#f59e0b' : 'var(--sub)'}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    });
  };

  H._submitReview = function (sellerId, rating, text) {
    const me = H.currentUser(); if (!me) return;
    const seller = (H.state.users || []).find(x => x.id === sellerId); if (!seller) return;
    seller.reviews  = seller.reviews  || [];
    seller.ratings  = seller.ratings  || [];
    const dup = seller.reviews.find(r => r.reviewerId === me.id);
    if (dup) { H.toast('You have already reviewed this seller'); return; }
    const review = { id: H.uid(), reviewerId: me.id, reviewerName: me.name || 'User', rating, text, date: Date.now() };
    seller.reviews.unshift(review);
    seller.ratings.push(rating);
    H.saveState();
    var _sb = window.supabase;
    if (_sb && typeof _sb.from === 'function') {
      _sb.from('reviews').insert({
        seller_id: sellerId, reviewer_id: me.id,
        reviewer_name: me.name || 'User', rating: rating,
        body: text || null, created_at: new Date().toISOString()
      }).then(function(res) {
        if (res && res.error) console.warn('Review sync failed:', res.error.message);
      });
    }
    H.pushNotif(sellerId, 'New Review', me.name + ' left you a ' + rating + '-star review', 'review');
    H.toast('Review submitted. Thank you!');
    H.renderPage('Reviews', {id: sellerId});
  };

  H._openAppliedJobs = function () { H.openInner('AppliedJobs'); };

  // ── JOB SEEKER PROFILE — READ-ONLY VIEW (LinkedIn-style) ──
  pages.JobSeekerProfile = function () {
    const u = H.currentUser();
    if (!u) return H.emptyState('Not logged in', 'Please sign in');

    const cv       = u.cv || {};
    const exp      = cv.experience || [];
    const edu      = cv.education  || [];
    const skills   = (u.skills || (cv.skills || []).join(',') || '').split(',').map(s => s.trim()).filter(Boolean);
    const headline = u.jobTitle || cv.headline || '';
    const bio      = u.bio || cv.summary || '';
    const location = u.city || cv.location || '';
    const jobTypes = (u.jobTypes || '').split(',').map(s => s.trim()).filter(Boolean);
    const salary   = u.expectedSalary || cv.expectedSalary || '';
    const hasProfile = !!(headline || bio || skills.length || exp.length || edu.length);

    const sec = (title, icon, content) => `
      <div style="background:#fff;border-radius:16px;margin-bottom:12px;border:1px solid #E4E8F0;overflow:hidden">
        <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F0F4FF">
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#1A3A8F;text-transform:uppercase;letter-spacing:.5px">${icon}${title}</div>
          ${title==='Experience'?`<button onclick="H._cvProfile.addExp()" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#1A3A8F;color:#fff;border:none;cursor:pointer">+ Add</button>`:''}
          ${title==='Education'?`<button onclick="H._cvProfile.addEdu()" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#1A3A8F;color:#fff;border:none;cursor:pointer">+ Add</button>`:''}
        </div>
        <div style="padding:14px 16px">${content}</div>
      </div>`;

    const expHtml = exp.length ? exp.map((e, i) => `
      <div style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #F0F4FF">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(e.title||'')}</div>
        <div style="font-size:13px;color:#1A3A8F;font-weight:600;margin-top:2px">${H.escHtml(e.company||'')}</div>
        <div style="font-size:12px;color:#667085;margin-top:2px">${H.escHtml(e.duration||'')}${e.current?' · Current':''}</div>
        ${e.desc?`<div style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.55">${H.escHtml(e.desc)}</div>`:''}
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="H._cvProfile.editExp(${i})" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;cursor:pointer">Edit</button>
          <button onclick="H._cvProfile.delExp(${i})"  style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;cursor:pointer">Remove</button>
        </div>
      </div>`).join('')
      : '<div style="color:#667085;font-size:13px">No experience added yet</div>';

    const eduHtml = edu.length ? edu.map((e, i) => `
      <div style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #F0F4FF">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(e.degree||'')}</div>
        <div style="font-size:13px;color:#1A3A8F;font-weight:600;margin-top:2px">${H.escHtml(e.school||'')}</div>
        <div style="font-size:12px;color:#667085;margin-top:2px">${H.escHtml(e.year||'')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="H._cvProfile.editEdu(${i})" style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;cursor:pointer">Edit</button>
          <button onclick="H._cvProfile.delEdu(${i})"  style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:7px;background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;cursor:pointer">Remove</button>
        </div>
      </div>`).join('')
      : '<div style="color:#667085;font-size:13px">No education added yet</div>';

    const skillsHtml = skills.length
      ? skills.map(s => `<span style="display:inline-block;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin:0 4px 6px 0">${H.escHtml(s)}</span>`).join('')
      : '<div style="color:#667085;font-size:13px">No skills added yet</div>';

    const jtHtml = jobTypes.length
      ? jobTypes.map(t => `<span style="display:inline-block;background:#F0FDF4;color:#15803d;border:1px solid #BBF7D0;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin:0 4px 6px 0">${H.escHtml(t)}</span>`).join('')
      : '<div style="color:#667085;font-size:13px">Not set</div>';

    const contactHtml = (() => {
      const rows = [];
      if (u.whatsappFull || u.whatsappNum) rows.push(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#25D366" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span style="font-size:13px;color:var(--text)">+${H.escHtml(u.whatsappFull||u.whatsappNum||'')}</span></div>`);
      if (u.contactMethod) rows.push(`<div style="font-size:13px;color:#667085">Preferred: <strong style="color:var(--text)">${H.escHtml(u.contactMethod)}</strong></div>`);
      if (u.linkedinUrl)   rows.push(`<div style="margin-top:6px;font-size:13px"><a href="${H.escHtml(u.linkedinUrl)}" target="_blank" style="color:#1A3A8F;font-weight:600">LinkedIn Profile</a></div>`);
      if (u.websiteUrl)    rows.push(`<div style="margin-top:4px;font-size:13px"><a href="${H.escHtml(u.websiteUrl)}" target="_blank" style="color:#1A3A8F;font-weight:600">Portfolio / Website</a></div>`);
      return rows.length ? rows.join('') : '<div style="color:#667085;font-size:13px">No contact info added yet</div>';
    })();

    const resumeHtml = (u.cvFileUrl || u.cvFileName)
      ? `<div style="display:flex;align-items:center;gap:10px;background:#F8FAFF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 14px">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H.escHtml(u.cvFileName||'Resume')}</div></div>
          ${u.cvFileUrl?`<a href="${H.escHtml(u.cvFileUrl)}" target="_blank" style="font-size:12px;font-weight:700;color:#1A3A8F;text-decoration:none;flex-shrink:0">View</a>`:''}
        </div>`
      : '<div style="color:#667085;font-size:13px">No resume uploaded yet</div>';

    if (!hasProfile) {
      return `<div class="page active">
        ${H.innerTopbar('My Job Profile')}
        <div style="padding:40px 24px;text-align:center">
          <div style="width:72px;height:72px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#1A3A8F" stroke-width="1.5"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          </div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px">You don't have a job profile yet</div>
          <div style="font-size:13px;color:#667085;line-height:1.6;margin-bottom:24px">Create your profile so employers in Hire Talent can find and contact you.</div>
          <button onclick="H.openInner('CandidateProfile')" style="width:100%;max-width:280px;padding:14px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Create Job Profile</button>
        </div>
      </div>`;
    }

    return `<div class="page active">
      ${H.innerTopbar('My Job Profile')}
      <div style="padding:0 14px 100px">

        <!-- Profile Header Card -->
        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);border-radius:20px;padding:20px;margin:14px 0;display:flex;gap:14px;align-items:flex-start">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;font-weight:800;color:#fff;border:2.5px solid rgba(255,255,255,.4)">
            ${u.avatar?`<img src="${H.escHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';this.parentElement.innerHTML=H.initials(H.escHtml('${u.name.replace(/'/g, "\\'")}'))">`:H.initials(u.name)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:17px;font-weight:800;color:#fff">${H.escHtml(u.name||'')}</div>
            ${headline?`<div style="font-size:13px;color:rgba(255,255,255,.9);font-weight:600;margin-top:3px">${H.escHtml(headline)}</div>`:''}
            ${location?`<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${H.escHtml(location)}</div>`:''}
            ${u.openToWork?`<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.25);border:1px solid rgba(34,197,94,.5);border-radius:20px;padding:3px 10px;margin-top:6px"><svg viewBox="0 0 24 24" width="10" height="10" fill="#22c55e" stroke="none"><circle cx="12" cy="12" r="12"/></svg><span style="font-size:11px;font-weight:700;color:#86efac">Open to Work</span></div>`:''}
          </div>
        </div>

        ${u.verified?`<div style="display:flex;align-items:center;gap:6px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;padding:10px 14px;margin-bottom:12px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:13px;font-weight:700;color:#059669">Identity Verified</span></div>`:''}

        ${bio?sec('About','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/></svg> ',`<div style="font-size:13px;color:var(--text);line-height:1.65">${H.escHtml(bio)}</div>`):''}

        ${sec('Skills','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ', skillsHtml)}
        ${jobTypes.length?sec('Job Type / Availability','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg> ', jtHtml):''}
        ${salary?sec('Expected Salary','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> ',`<div style="font-size:14px;font-weight:700;color:var(--text)">${H.escHtml(String(salary))}</div>`):''}
        ${sec('Work Experience','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg> ', expHtml)}
        ${sec('Education','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> ', eduHtml)}
        ${sec('Contact & Links','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> ', contactHtml)}
        ${sec('Resume / CV','<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ', resumeHtml)}

      </div>

      <!-- Fixed bottom Edit button -->
      <div style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid #E4E8F0;z-index:200">
        <button onclick="H.openInner('CandidateProfile')" style="width:100%;padding:14px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Profile
        </button>
      </div>
    </div>`;
  };

  pages.JobSeekerProfile_after = function () {
    function captureDraft() {
      const u = H.currentUser();
      if (!u) return;
      u.cv = u.cv || {};
      const headlineEl = document.getElementById('cvHeadline');
      const summaryEl = document.getElementById('cvSummary');
      const skillsEl = document.getElementById('cvSkills');
      const certsEl = document.getElementById('cvCerts');
      const salaryEl = document.getElementById('cvSalary');
      const locationEl = document.getElementById('cvLocation');
      const visibleEl = document.getElementById('cvVisible');
      if (headlineEl) u.cv.headline = headlineEl.value.trim();
      if (summaryEl) u.cv.summary = summaryEl.value.trim();
      if (skillsEl) u.cv.skills = skillsEl.value.split(',').map(s => s.trim()).filter(Boolean);
      if (certsEl) u.cv.certs = certsEl.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (salaryEl) u.cv.expectedSalary = parseFloat(salaryEl.value) || null;
      if (locationEl) u.cv.location = locationEl.value.trim();
      if (visibleEl) u.cv.visible = visibleEl.checked;
    }
    H._cvProfile = {
      save() {
        const u = H.currentUser();
        if (!u) return;
        captureDraft();
        // Make visible in HireTalent if they have a headline or experience
        if (u.cv.visible && (u.cv.headline || u.cv.summary || (u.cv.experience && u.cv.experience.length))) {
          u.openToWork = true;
        }
        u.jobTitle = u.cv.headline || u.jobTitle || '';
        u.skills = (u.cv.skills || []).join(', ');
        H.saveState();
        const sb = window.supabase;
        if (sb && typeof sb.from === 'function') {
          sb.from('profiles').upsert({
            id: u.id, cv: u.cv,
            job_title: u.jobTitle || null,
            skills: u.skills || null,
            city: u.cv.location || null,
            open_to_work: u.openToWork || false,
            updated_at: new Date().toISOString()
          }).then(r => { if (r && r.error) console.warn('CV sync:', r.error.message); });
        }
        H.toast('Job profile saved!');
        H.goBack();
      },
      addExp() {
        captureDraft();
        H.modal({
          title: 'Add Work Experience',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="expTitle" class="fi" placeholder="Job Title *">
            <input id="expCompany" class="fi" placeholder="Company Name *">
            <input id="expDuration" class="fi" placeholder="Duration e.g. Jan 2020 – Dec 2022">
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="expCurrent">Still working here</label>
            <textarea id="expDesc" class="fi" rows="3" placeholder="Role description / responsibilities..."></textarea>
          </div>`,
          confirmText: 'Add',
          onConfirm: () => {
            const title   = (document.getElementById('expTitle')?.value || '').trim();
            const company = (document.getElementById('expCompany')?.value || '').trim();
            if (!title || !company) { H.toast('Title and company are required'); return false; }
            const u = H.currentUser();
            u.cv = u.cv || {};
            u.cv.experience = u.cv.experience || [];
            u.cv.experience.push({
              title, company,
              duration: (document.getElementById('expDuration')?.value || '').trim(),
              current:  document.getElementById('expCurrent')?.checked || false,
              desc:     (document.getElementById('expDesc')?.value || '').trim()
            });
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      addEdu() {
        captureDraft();
        H.modal({
          title: 'Add Education',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="eduDegree" class="fi" placeholder="Degree / Certificate *">
            <input id="eduSchool" class="fi" placeholder="School / University *">
            <input id="eduYear" class="fi" placeholder="Year e.g. 2018">
          </div>`,
          confirmText: 'Add',
          onConfirm: () => {
            const degree = (document.getElementById('eduDegree')?.value || '').trim();
            const school = (document.getElementById('eduSchool')?.value || '').trim();
            if (!degree || !school) { H.toast('Degree and school are required'); return false; }
            const u = H.currentUser();
            u.cv = u.cv || {};
            u.cv.education = u.cv.education || [];
            u.cv.education.push({
              degree, school,
              year: (document.getElementById('eduYear')?.value || '').trim()
            });
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      editExp(i) {
        captureDraft();
        const u = H.currentUser();
        const e = (u.cv && u.cv.experience && u.cv.experience[i]) || {};
        H.modal({
          title: 'Edit Work Experience',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="expTitle" class="fi" value="${H.escHtml(e.title||'')}" placeholder="Job Title *">
            <input id="expCompany" class="fi" value="${H.escHtml(e.company||'')}" placeholder="Company Name *">
            <input id="expDuration" class="fi" value="${H.escHtml(e.duration||'')}" placeholder="Duration">
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="expCurrent" ${e.current?'checked':''}>Still working here</label>
            <textarea id="expDesc" class="fi" rows="3" placeholder="Description...">${H.escHtml(e.desc||'')}</textarea>
          </div>`,
          confirmText: 'Save',
          onConfirm: () => {
            const title   = (document.getElementById('expTitle')?.value || '').trim();
            const company = (document.getElementById('expCompany')?.value || '').trim();
            if (!title || !company) { H.toast('Title and company are required'); return false; }
            u.cv.experience[i] = {
              title, company,
              duration: (document.getElementById('expDuration')?.value || '').trim(),
              current:  document.getElementById('expCurrent')?.checked || false,
              desc:     (document.getElementById('expDesc')?.value || '').trim()
            };
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      editEdu(i) {
        captureDraft();
        const u = H.currentUser();
        const e = (u.cv && u.cv.education && u.cv.education[i]) || {};
        H.modal({
          title: 'Edit Education',
          body: `<div style="display:flex;flex-direction:column;gap:8px">
            <input id="eduDegree" class="fi" value="${H.escHtml(e.degree||'')}" placeholder="Degree *">
            <input id="eduSchool" class="fi" value="${H.escHtml(e.school||'')}" placeholder="School *">
            <input id="eduYear" class="fi" value="${H.escHtml(e.year||'')}" placeholder="Year">
          </div>`,
          confirmText: 'Save',
          onConfirm: () => {
            const degree = (document.getElementById('eduDegree')?.value || '').trim();
            const school = (document.getElementById('eduSchool')?.value || '').trim();
            if (!degree || !school) { H.toast('Required fields missing'); return false; }
            u.cv.education[i] = { degree, school, year: (document.getElementById('eduYear')?.value || '').trim() };
            H.saveState();
            H.renderPage('JobSeekerProfile');
          }
        });
      },
      delExp(i) {
        const u = H.currentUser();
        if (!u.cv || !u.cv.experience) return;
        u.cv.experience.splice(i, 1);
        H.saveState();
        H.renderPage('JobSeekerProfile');
      },
      delEdu(i) {
        const u = H.currentUser();
        if (!u.cv || !u.cv.education) return;
        u.cv.education.splice(i, 1);
        H.saveState();
        H.renderPage('JobSeekerProfile');
      }
    };
  };

})(window.H = window.H || {});

;/* === www/js/settings.js === */
'use strict';
(function (H) {
  const pages = H.pages;
  const I = {
    palette: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    bell:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    globe:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none"/></svg>',
    ban:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    sun:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    settings:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    phone:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    key:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    eye:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    message:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    heart:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    clock:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    star:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    alert:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    list:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    smartphone:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    trash:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
  };

  // --- Settings Page ----------------------------------------
  pages.Settings = function () {
    const u = H.currentUser();

    return `<div class="page active">
      ${H.innerTopbar('Settings')}
      
      <div class="settings-section">
        <div class="section-title">Appearance</div>
        <button class="settings-item" onclick="H.openInner('ThemeSettings')">
          <span class="item-icon">${I.palette}</span>
          <span class="item-label">Theme</span>
          <span class="item-value">${u.settings && u.settings.theme ? u.settings.theme.charAt(0).toUpperCase() + u.settings.theme.slice(1) : 'Light'}</span>
        </button>
      </div>

      <div class="settings-section">
        <div class="section-title">Notifications</div>
        <button class="settings-item" onclick="H.openInner('NotificationSettings')">
          <span class="item-icon">${I.bell}</span>
          <span class="item-label">Notification Preferences</span>
          <span class="item-arrow">›</span>
        </button>
      </div>

      <div class="settings-section">
        <div class="section-title">Account & Privacy</div>
        <button class="settings-item" onclick="H.openInner('PrivacySettings')">
          <span class="item-icon">${I.lock}</span>
          <span class="item-label">Privacy Settings</span>
          <span class="item-arrow">›</span>
        </button>
        <button class="settings-item" onclick="H.openInner('SecuritySettings')">
          <span class="item-icon">${I.shield}</span>
          <span class="item-label">Security</span>
          <span class="item-arrow">›</span>
        </button>
        <button class="settings-item" onclick="H.openInner('LanguageSettings')">
          <span class="item-icon">${I.globe}</span>
          <span class="item-label">Language</span>
          <span class="item-value">${u.language || 'English'}</span>
        </button>
      </div>

      <div class="settings-section">
        <div class="section-title">Actions</div>
        <button class="settings-item" onclick="H.openInner('BlockedUsers')">
          <span class="item-icon">${I.ban}</span>
          <span class="item-label">Blocked Users</span>
          <span class="item-arrow">›</span>
        </button>
      </div>

      <div style="height:20px"></div>
    </div>`;
  };

  // --- Theme Settings ---------------------------------------
  pages.ThemeSettings = function () {
    const u = H.currentUser();
    const currentTheme = (u.settings && u.settings.theme) || 'light';

    return `<div class="page active">
      ${H.innerTopbar('Theme Settings')}
      <div class="form-wrap">
        <div class="theme-selector">
          <label class="theme-option ${currentTheme === 'light' ? 'selected' : ''}">
            <input type="radio" name="theme" value="light" ${currentTheme === 'light' ? 'checked' : ''} onchange="H._themeSettings.setTheme('light')">
            <span class="theme-preview" style="background:#F4F1EA">${I.sun}</span>
            <span>Light Mode</span>
          </label>

          <label class="theme-option ${currentTheme === 'dark' ? 'selected' : ''}">
            <input type="radio" name="theme" value="dark" ${currentTheme === 'dark' ? 'checked' : ''} onchange="H._themeSettings.setTheme('dark')">
            <span class="theme-preview" style="background:#111315">${I.moon}</span>
            <span>Dark Mode</span>
          </label>

          <label class="theme-option ${currentTheme === 'system' ? 'selected' : ''}">
            <input type="radio" name="theme" value="system" ${currentTheme === 'system' ? 'checked' : ''} onchange="H._themeSettings.setTheme('system')">
            <span class="theme-preview">${I.settings}</span>
            <span>System Default</span>
          </label>
        </div>
      </div>
    </div>`;
  };

  pages.ThemeSettings_after = function () {
    H._themeSettings = {
      setTheme: (theme) => {
        const u = H.currentUser();
        if (!u.settings) u.settings = {};
        u.settings.theme = theme;
        H.applyTheme();
        H.saveState();
        H.toast('Theme updated');
      }
    };
  };

  // --- Notification Settings --------------------------------
  pages.NotificationSettings = function () {
    const u = H.currentUser();
    const prefs = u.notificationPrefs || {
      messages: true,
      listings: true,
      approvals: true,
      promotions: true,
      favorites: true,
      priceDrops: true,
      security: true
    };

    return `<div class="page active">
      ${H.innerTopbar('Notification Preferences')}
      <div class="form-wrap">
        <div class="notif-section">
          <div class="section-title">Alerts</div>
          
          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.message}</span>
              <span>Messages</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.messages ? 'checked' : ''} onchange="H._notifSettings.toggle('messages')">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.list}</span>
              <span>Listing Updates</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.listings ? 'checked' : ''} onchange="H._notifSettings.toggle('listings')">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.check}</span>
              <span>Approval Status</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.approvals ? 'checked' : ''} onchange="H._notifSettings.toggle('approvals')">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.star}</span>
              <span>Promotions</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.promotions ? 'checked' : ''} onchange="H._notifSettings.toggle('promotions')">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.heart}</span>
              <span>Saves on My Listings</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.favorites ? 'checked' : ''} onchange="H._notifSettings.toggle('favorites')">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.alert}</span>
              <span>Price Drop Alerts</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.priceDrops !== false ? 'checked' : ''} onchange="H._notifSettings.toggle('priceDrops')">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.lock}</span>
              <span>Security Alerts</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${prefs.security ? 'checked' : ''} onchange="H._notifSettings.toggle('security')">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>`;
  };

  pages.NotificationSettings_after = function () {
    const DEFAULTS = { messages: true, listings: true, approvals: true, promotions: true, favorites: true, priceDrops: true, security: true };
    H._notifSettings = {
      toggle: (key) => {
        const u = H.currentUser();
        if (!u.notificationPrefs) u.notificationPrefs = Object.assign({}, DEFAULTS);
        // Seed with default if key was never explicitly set
        if (!(key in u.notificationPrefs)) u.notificationPrefs[key] = DEFAULTS[key] !== false;
        u.notificationPrefs[key] = !u.notificationPrefs[key];
        H.saveState();
        H.toast(u.notificationPrefs[key] ? 'Enabled' : 'Disabled');
      }
    };
  };

  // --- Privacy Settings --------------------------------------
  pages.PrivacySettings = function () {
    const u = H.currentUser();
    // Merge stored settings over defaults so missing keys always have a value
    const defaults = { profilePublic: true, showPhoneInListings: false, allowMessages: true, showActivity: false };
    const privacy = Object.assign({}, defaults, u.privacySettings || {});

    return `<div class="page active">
      ${H.innerTopbar('Privacy Settings')}
      <div class="form-wrap">
        <div class="privacy-section">
          <div class="section-title">Profile Visibility</div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.eye}</span>
              <div class="toggle-text">
                <span class="toggle-name">Public Profile</span>
                <span class="toggle-desc">Others can view your profile</span>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${privacy.profilePublic ? 'checked' : ''} onchange="H._privacySettings.toggle('profilePublic', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.phone}</span>
              <div class="toggle-text">
                <span class="toggle-name">Show Phone in Listings</span>
                <span class="toggle-desc">Sellers can see your phone number</span>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${privacy.showPhoneInListings ? 'checked' : ''} onchange="H._privacySettings.toggle('showPhoneInListings', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.message}</span>
              <div class="toggle-text">
                <span class="toggle-name">Allow Direct Messages</span>
                <span class="toggle-desc">Others can message you directly</span>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${privacy.allowMessages ? 'checked' : ''} onchange="H._privacySettings.toggle('allowMessages', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-label">
              <span class="toggle-icon">${I.clock}</span>
              <div class="toggle-text">
                <span class="toggle-name">Show Activity Status</span>
                <span class="toggle-desc">Others can see when you are online</span>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${privacy.showActivity ? 'checked' : ''} onchange="H._privacySettings.toggle('showActivity', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>`;
  };

  pages.PrivacySettings_after = function () {
    const DEFAULTS = { profilePublic: true, showPhoneInListings: false, allowMessages: true, showActivity: false };
    const LABELS = {
      profilePublic:       { on: 'Profile is now public',              off: 'Profile is now private' },
      showPhoneInListings: { on: 'Phone number visible in listings',    off: 'Phone number hidden from listings' },
      allowMessages:       { on: 'Direct messages allowed',            off: 'Direct messages are blocked' },
      showActivity:        { on: 'Activity status is visible',         off: 'Activity status is hidden' }
    };

    H._privacySettings = {
      toggle: function(key, newValue) {
        const u = H.currentUser();
        if (!u) return;
        // Always initialise with full defaults so no key goes missing
        if (!u.privacySettings) u.privacySettings = Object.assign({}, DEFAULTS);
        // Use the checkbox's actual checked state — avoids !undefined mismatch on first toggle
        u.privacySettings[key] = !!newValue;
        H.saveState();

        // Feedback
        const label = LABELS[key];
        if (label) H.toast(newValue ? label.on : label.off);

        // Apply visible effects immediately
        if (key === 'showPhoneInListings') {
          // Update own listings in state so detail pages reflect the change
          const uid = u.id;
          (H.state.listings || []).forEach(function(l) {
            if (l.sellerId === uid) {
              l._hidePhone = !newValue;
            }
          });
          H.saveState();
        }

        // Persist to Supabase profiles table so other devices pick it up
        if (window.supabase && typeof window.supabase.from === 'function') {
          window.supabase.from('profiles')
            .update({ privacy: u.privacySettings })
            .eq('id', u.id)
            .then(function() {})
            .catch(function() {});
        }
      }
    };
  };

  // --- Security Settings ------------------------------------
  pages.SecuritySettings = function () {
    return `<div class="page active">
      ${H.innerTopbar('Security Settings')}
      <div class="form-wrap">
        <div class="security-section">
          <div class="section-title">Account Security</div>
          
          <button class="settings-item" onclick="H.openInner('ChangePassword')">
            <span class="item-icon">${I.key}</span>
            <span class="item-label">Change Password</span>
            <span class="item-arrow">›</span>
          </button>

          <button class="settings-item" onclick="H.openInner('TwoFactor')">
            <span class="item-icon">${I.lock}</span>
            <span class="item-label">Two-Factor Authentication</span>
            <span class="item-arrow">›</span>
          </button>

          <button class="settings-item" onclick="H.openInner('ActiveSessions')">
            <span class="item-icon">${I.smartphone}</span>
            <span class="item-label">Active Sessions</span>
            <span class="item-arrow">›</span>
          </button>

          <button class="settings-item danger" onclick="H.openInner('DeleteAccount')">
            <span class="item-icon">${I.alert}</span>
            <span class="item-label">Delete Account</span>
            <span class="item-arrow">›</span>
          </button>
        </div>
      </div>
    </div>`;
  };

  // --- Language Settings ------------------------------------
  pages.LanguageSettings = function () {
    const current = H.getLanguage ? H.getLanguage() : ((H.currentUser() && H.currentUser().language) || H.state.language || 'English');
    return `<div class="page active">
      ${H.innerTopbar('Language')}
      <div class="form-wrap">
        <div class="section-box" style="padding:0">
          <button onclick="H.setLanguage('English')" style="display:flex;align-items:center;gap:12px;width:100%;padding:16px;background:var(--card);border:none;text-align:left;cursor:pointer">
            <span style="width:22px;height:22px;border-radius:50%;border:2px solid #1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${current === 'English' ? '<span style="width:10px;height:10px;border-radius:50%;background:#1A3A8F"></span>' : ''}
            </span>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:700;color:var(--text-primary)">English</div>
              <div style="font-size:12px;color:var(--text-sub);margin-top:2px">App display language</div>
            </div>
            ${current === 'English' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#1A3A8F" stroke-width="2.5" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </button>
        </div>
        <div class="section-box" style="margin-top:12px">
          <div style="font-size:13px;line-height:1.55;color:var(--text-sub)">PaMarket uses English for app screens and account communication.</div>
        </div>
      </div>
    </div>`;
  };

  pages.LanguageSettings_after = function () {};

  // --- Blocked Users ----------------------------------------
  pages.BlockedUsers = function () {
    const u = H.currentUser();
    // Migrate legacy blocks stored at H.state.blockedUsers (top-level) into the user object
    if (Array.isArray(H.state.blockedUsers) && H.state.blockedUsers.length) {
      if (!Array.isArray(u.blockedUsers)) u.blockedUsers = [];
      H.state.blockedUsers.forEach(id => { if (!u.blockedUsers.includes(id)) u.blockedUsers.push(id); });
      delete H.state.blockedUsers;
      H.saveState();
    }
    const blocked = u.blockedUsers || [];

    return `<div class="page active">
      ${H.innerTopbar('Blocked Users')}
      <div class="form-wrap">
        ${blocked.length
          ? blocked.map(userId => {
              const user = H.state.users.find(us => us.id === userId);
              return `
                <div class="blocked-user-item">
                  <div class="user-info">
                    <div class="user-name">${user ? H.escHtml(user.name) : 'Unknown User'}</div>
                    <div class="user-detail">${user ? H.escHtml(user.phone) : 'N/A'}</div>
                  </div>
                  <button class="btn-unblock" onclick="H._blockedUsers.unblock('${userId}')">Unblock</button>
                </div>
              `;
            }).join('')
          : H.emptyState('No blocked users', 'Users you block won\'t be able to contact you')}
      </div>
    </div>`;
  };

  pages.BlockedUsers_after = function () {
    H._blockedUsers = {
      unblock: (userId) => {
        const u = H.currentUser();
        if (!u.blockedUsers) u.blockedUsers = [];
        u.blockedUsers = u.blockedUsers.filter(id => id !== userId);
        H.saveState();
        H.toast('User unblocked');
        H.openInner('BlockedUsers');
      }
    };
  };

  pages.MyActivity = function () {
    const u = H.currentUser();
    if (!u) return H.requireAuth('Login to view your activity');

    const searches = (u.recentSearches || []);
    const rvIds    = JSON.parse(localStorage.getItem('pamarket_rv') || '[]');
    const viewed   = rvIds.map(id => (H.state.listings || []).find(l => l.id === id)).filter(Boolean);

    const sectionLabel = (text) =>
      `<div style="padding:16px 16px 8px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em">${text}</div>`;

    const emptyCard = (msg) =>
      `<div style="margin:0 16px 8px;background:var(--card);border-radius:14px;padding:32px 16px;text-align:center">
         <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--sub)" stroke-width="1.5" style="opacity:.5;margin-bottom:10px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
         <div style="font-size:14px;color:var(--sub)">${msg}</div>
       </div>`;

    const searchSection = searches.length
      ? `${sectionLabel('Recent Searches')}
         <div style="margin:0 16px 4px;background:var(--card);border-radius:14px;overflow:hidden">
           ${searches.map((q, i) => `
             <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;${i ? 'border-top:1px solid var(--border)' : ''};cursor:pointer"
                  onclick="H.navTo('Browse');setTimeout(()=>{var el=document.getElementById('searchInput');if(el){el.value=${JSON.stringify(q)};el.dispatchEvent(new Event('input'));}},220)">
               <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2" style="flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
               <span style="flex:1;font-size:14px;color:var(--text)">${H.escHtml(q)}</span>
               <button onclick="event.stopPropagation();var u=H.currentUser();u.recentSearches=(u.recentSearches||[]).filter(s=>s!==${JSON.stringify(q)});H.saveState();H.openInner('MyActivity')"
                       style="background:none;border:none;color:var(--sub);font-size:20px;padding:0 2px;line-height:1;cursor:pointer">&times;</button>
             </div>`).join('')}
         </div>
         <div style="padding:4px 16px 8px;text-align:right">
           <button onclick="var u=H.currentUser();u.recentSearches=[];H.saveState();H.openInner('MyActivity')"
                   style="background:none;border:none;font-size:12px;color:#EF4444;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;padding:4px 0">
             Clear all
           </button>
         </div>`
      : `${sectionLabel('Recent Searches')}${emptyCard('No recent searches yet')}`;

    const viewedSection = viewed.length
      ? `${sectionLabel('Recently Viewed')}
         <div style="padding:0 16px 8px;display:flex;flex-direction:column;gap:10px">
           ${viewed.map(l => H.renderListCard(l)).join('')}
         </div>`
      : `${sectionLabel('Recently Viewed')}${emptyCard('No recently viewed listings')}`;

    return `<div class="page active">
      ${H.innerTopbar('My Activity')}
      <div style="padding-top:8px;padding-bottom:32px">
        ${searchSection}
        <div style="margin-top:12px"></div>
        ${viewedSection}
      </div>
    </div>`;
  };

})(window.H = window.H || {});

;/* === www/js/security_pages.js === */
'use strict';
(function (H) {
  const pages = H.pages;
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  H._twoFactorCreateSecret = function () {
    const bytes = new Uint8Array(10);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    let bits = '', out = '';
    bytes.forEach(b => { bits += b.toString(2).padStart(8, '0'); });
    for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
    return out.replace(/(.{4})/g, '$1 ').trim();
  };

  function base32Bytes(secret) {
    let bits = '';
    String(secret || '').replace(/\s+/g, '').toUpperCase().split('').forEach(ch => {
      const v = B32.indexOf(ch);
      if (v >= 0) bits += v.toString(2).padStart(5, '0');
    });
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return bytes;
  }

  async function hotp(secret, counter) {
    const keyData = new Uint8Array(base32Bytes(secret));
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    const high = Math.floor(counter / 0x100000000);
    const low = counter >>> 0;
    view.setUint32(0, high);
    view.setUint32(4, low);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const off = sig[sig.length - 1] & 15;
    const bin = ((sig[off] & 127) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
    return String(bin % 1000000).padStart(6, '0');
  }

  H._twoFactorCode = function (secret, offset) {
    return hotp(secret, Math.floor(Date.now() / 30000) + (offset || 0));
  };

  H._twoFactorVerify = async function (secret, code) {
    const c = String(code || '').replace(/\D/g, '');
    if (!secret || c.length !== 6) return false;
    for (const o of [-1, 0, 1]) {
      if (await H._twoFactorCode(secret, o) === c) return true;
    }
    return false;
  };

  // -- CHANGE PASSWORD ---------------------------------------
  pages.ChangePassword = function () {
    return `<div class="page active">
      ${H.innerTopbar('Change Password')}
      <div class="form-wrap">
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:#1E40AF;line-height:1.5">
          Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.
        </div>
        <div class="fg">
          <div class="fl">New Password</div>
          <div style="position:relative">
            <input class="fi" type="password" id="newPass" placeholder="Enter new password" style="padding-right:44px"
              oninput="H._changePassword.checkStrength(this.value)">
            <button type="button" onclick="H._changePassword.toggleVis('newPass',this)"
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--sub);cursor:pointer;padding:4px">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div id="passStrength" style="margin-top:6px;font-size:12px;font-weight:600"></div>
        </div>
        <div class="fg">
          <div class="fl">Confirm New Password</div>
          <input class="fi" type="password" id="confPass" placeholder="Re-enter new password"
            onkeydown="if(event.key==='Enter')H._changePassword.save()">
        </div>
        <div id="cpErrMsg" style="display:none;font-size:13px;color:#EF4444;padding:6px 0;font-weight:600"></div>
        <button id="cpSaveBtn" class="btn-pri" onclick="H._changePassword.save()">Update Password</button>
        <button class="btn-sec" onclick="H.goBack()">Cancel</button>
      </div>
    </div>`;
  };

  pages.ChangePassword_after = function () {
    H._changePassword = {
      toggleVis: (id, btn) => {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
      },
      checkStrength: (val) => {
        const el = document.getElementById('passStrength');
        if (!el) return;
        if (!val) { el.textContent = ''; return; }
        const checks = [val.length >= 8, /[A-Z]/.test(val), /[a-z]/.test(val), /[0-9]/.test(val), /[^A-Za-z0-9]/.test(val)];
        const score = checks.filter(Boolean).length;
        const labels = ['','Very weak','Weak','Fair','Strong','Very strong'];
        const colors = ['','#EF4444','#F59E0B','#EAB308','#22C55E','#16A34A'];
        el.textContent = labels[score] || '';
        el.style.color = colors[score] || '';
      },
      save: async () => {
        const nw   = (document.getElementById('newPass')?.value || '').trim();
        const conf = (document.getElementById('confPass')?.value || '').trim();
        const btn  = document.getElementById('cpSaveBtn');
        const errEl = document.getElementById('cpErrMsg');
        const showErr = (msg) => { if(errEl){errEl.textContent=msg;errEl.style.display='';} };

        if (!nw || !conf) { showErr('Please fill in both password fields'); return; }
        if (nw.length < 8) { showErr('Password must be at least 8 characters'); return; }
        if (!/[A-Z]/.test(nw)) { showErr('Password must include at least one uppercase letter'); return; }
        if (!/[a-z]/.test(nw)) { showErr('Password must include at least one lowercase letter'); return; }
        if (!/[0-9]/.test(nw)) { showErr('Password must include at least one number'); return; }
        if (!/[^A-Za-z0-9]/.test(nw)) { showErr('Password must include at least one symbol (e.g. !@#$)'); return; }
        if (nw !== conf) { showErr('Passwords do not match'); return; }

        if (errEl) errEl.style.display = 'none';
        if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }

        const c = window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
        if (c && c.auth) {
          const res = await c.auth.updateUser({ password: nw });
          if (res && res.error) {
            if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
            showErr(res.error.message || 'Password update failed. Try again.');
            return;
          }
        } else {
          // Fallback for local-only mode
          const u = H.currentUser();
          if (u) { u._localPassword = nw; H.saveState(); }
        }

        if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
        H.toast('Password updated successfully!');
        H.goBack();
      }
    };
  };

  pages.TwoFactor = function () {
    const u = H.currentUser();
    const enabled = !!(u && u.twoFactorEnabled && u.twoFactorSecret);
    const setup = u._pendingTwoFactorSecret || H._twoFactorCreateSecret();
    if (!enabled && !u._pendingTwoFactorSecret) {
      u._pendingTwoFactorSecret = setup;
      H.saveState();
    }
    const email       = H.escHtml(u ? (u.email || u.name || 'user') : 'user');
    const secretClean = setup.replace(/\s/g, '');
    const totpUri     = 'otpauth://totp/PaMarket:' + encodeURIComponent(email) + '?secret=' + secretClean + '&issuer=PaMarket';
    const qrUrl       = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(totpUri);

    return `<div class="page active">
      ${H.innerTopbar('Two-Factor Authentication')}
      <div class="form-wrap">
        ${enabled ? `
          <div class="section-box" style="text-align:center;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border:1.5px solid #86efac">
            <div style="font-size:32px;margin-bottom:8px">🔐</div>
            <div style="font-size:17px;font-weight:800;color:#15803d;margin-bottom:4px">2FA is Active</div>
            <div style="font-size:13px;color:#166534;line-height:1.5">Your account is protected with two-factor authentication. You'll need your authenticator app every time you log in.</div>
          </div>
          <div class="section-box">
            <div class="section-title">Disable Two-Factor Authentication</div>
            <div style="font-size:13px;color:var(--text-sub);margin-bottom:12px;line-height:1.5">Open your authenticator app and enter the 6-digit code to confirm you want to disable 2FA.</div>
            <div class="fg">
              <div class="fl">Authenticator code</div>
              <input class="fi" id="twoFactorCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" onkeydown="if(event.key==='Enter')H._twoFactor.disable()">
            </div>
            <button class="btn-pri" style="background:#dc2626" onclick="H._twoFactor.disable()">Disable 2FA</button>
          </div>
        ` : `
          <div class="section-box" style="text-align:center">
            <div style="font-size:32px;margin-bottom:8px">🔒</div>
            <div style="font-size:17px;font-weight:800;color:var(--text-primary);margin-bottom:4px">Set Up Two-Factor Authentication</div>
            <div style="font-size:13px;color:var(--text-sub);line-height:1.5">Add an extra layer of security. After setup, every login will require a 6-digit code from your authenticator app.</div>
          </div>

          <div class="section-box">
            <div class="section-title">Step 1 — Install an Authenticator App</div>
            <div style="font-size:13px;color:var(--text-sub);line-height:1.6">Download one of these free apps on your phone:<br>
              <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Authy</strong>
            </div>
          </div>

          <div class="section-box">
            <div class="section-title">Step 2 — Scan the QR Code</div>
            <div style="font-size:13px;color:var(--text-sub);margin-bottom:14px;line-height:1.5">Open your authenticator app, tap <strong>+</strong> or <strong>Add account</strong>, then scan this code:</div>
            <div style="display:flex;justify-content:center;margin-bottom:12px">
              <img src="${H.escHtml(qrUrl)}" width="180" height="180" alt="2FA QR Code" style="border-radius:12px;border:2px solid var(--border);padding:8px;background:#fff">
            </div>
            <div style="font-size:12px;color:var(--text-sub);text-align:center;margin-bottom:8px">Can't scan? Use this manual key instead:</div>
            <div style="font-family:monospace;font-size:15px;font-weight:800;letter-spacing:2px;color:var(--blue);background:var(--blue-light,#EFF6FF);border:1.5px solid rgba(26,58,143,.2);border-radius:10px;padding:12px;text-align:center;word-break:break-all;cursor:pointer" onclick="
              navigator.clipboard && navigator.clipboard.writeText('${H.escHtml(secretClean)}').then(()=>H.toast('Key copied!')).catch(()=>{});
            ">${H.escHtml(setup)} <span style="font-size:11px;opacity:.6">(tap to copy)</span></div>
          </div>

          <div class="section-box">
            <div class="section-title">Step 3 — Enter the 6-Digit Code</div>
            <div style="font-size:13px;color:var(--text-sub);margin-bottom:12px;line-height:1.5">After scanning, your app will show a 6-digit code. Enter it below to confirm the setup.</div>
            <div class="fg">
              <div class="fl">Authenticator code</div>
              <input class="fi" id="twoFactorCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" onkeydown="if(event.key==='Enter')H._twoFactor.enable()">
            </div>
            <button class="btn-pri" onclick="H._twoFactor.enable()">Enable 2FA</button>
          </div>
        `}
        <button class="btn-sec" onclick="H.goBack()">Back</button>
      </div>
    </div>`;
  };

  pages.TwoFactor_after = function () {
    H._twoFactor = {
      enable: async () => {
        const u = H.currentUser();
        const code = (document.getElementById('twoFactorCode')?.value || '').trim();
        if (!await H._twoFactorVerify(u._pendingTwoFactorSecret, code)) {
          H.toast('Invalid authenticator code');
          return;
        }
        u.twoFactorSecret = u._pendingTwoFactorSecret;
        u.twoFactorEnabled = true;
        delete u._pendingTwoFactorSecret;
        H.saveState();
        H.toast('2FA enabled');
        H.renderPage('TwoFactor');
      },
      disable: async () => {
        const u = H.currentUser();
        const code = (document.getElementById('twoFactorCode')?.value || '').trim();
        if (!await H._twoFactorVerify(u.twoFactorSecret, code)) {
          H.toast('Invalid authenticator code');
          return;
        }
        u.twoFactorEnabled = false;
        u.twoFactorSecret = null;
        delete u._pendingTwoFactorSecret;
        H.saveState();
        H.toast('2FA disabled');
        H.renderPage('TwoFactor');
      }
    };
  };

  pages.ActiveSessions = function () {
    const u = H.currentUser();
    const sessions = u.sessions || [{ id: 'current', device: 'This device', location: 'Zimbabwe', time: Date.now(), current: true }];
    return `<div class="page active">
      ${H.innerTopbar('Active Sessions')}
      <div class="form-wrap">
        <div class="section-box">
          <div class="section-title">Logged-in Devices</div>
          ${sessions.map(s => `
            <div class="info-row">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--charcoal)">${H.escHtml(s.device)}</div>
                <div style="font-size:11px;color:var(--ash);margin-top:2px">${H.escHtml(s.location)} · ${new Date(s.time).toLocaleDateString()}</div>
              </div>
              ${s.current ? '<span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:3px 10px;border-radius:20px">Current</span>'
                : `<button class="btn-unblock" onclick="H._sessions.revoke('${s.id}')">Revoke</button>`}
            </div>`).join('')}
        </div>
        <button class="btn-sec" style="background:var(--red2);color:var(--red)" onclick="H._sessions.revokeAll()">Sign Out All Other Devices</button>
        <button class="btn-sec" onclick="H.goBack()">Back</button>
      </div>
    </div>`;
  };

  pages.ActiveSessions_after = function () {
    H._sessions = {
      revoke: (id) => {
        const u = H.currentUser();
        u.sessions = (u.sessions || []).filter(s => s.id !== id);
        H.saveState(); H.toast('Session revoked'); H.renderPage('ActiveSessions');
      },
      revokeAll: () => {
        const u = H.currentUser();
        u.sessions = (u.sessions || []).filter(s => s.current);
        H.saveState(); H.toast('All other sessions signed out'); H.renderPage('ActiveSessions');
      }
    };
  };

  pages.DeleteAccount = function () {
    return `<div class="page active">
      ${H.innerTopbar('Delete Account')}
      <div class="form-wrap">
        <div class="section-box" style="border:1.5px solid rgba(192,57,43,.2);text-align:center;padding:24px">
          <div class="verify-title" style="color:var(--red)">Delete Account</div>
          <div class="verify-sub">This permanently deletes your account, listings, messages and wallet. Cannot be undone.</div>
        </div>
        <div class="section-box">
          <div class="section-title">What will be deleted</div>
          <div class="info-row"><span class="info-label">Profile</span><span class="info-val" style="color:var(--red)">Permanently removed</span></div>
          <div class="info-row"><span class="info-label">Listings</span><span class="info-val" style="color:var(--red)">All deleted</span></div>
          <div class="info-row"><span class="info-label">Messages</span><span class="info-val" style="color:var(--red)">All deleted</span></div>
          <div class="info-row"><span class="info-label">Wallet</span><span class="info-val" style="color:var(--red)">Balance forfeited</span></div>
        </div>
        <div class="fg">
          <div class="fl">Type DELETE to confirm</div>
          <input class="fi" id="deleteConfirm" placeholder="Type DELETE">
        </div>
        <button class="btn-pri" style="background:var(--red)" onclick="H._deleteAccount.confirm()">Permanently Delete Account</button>
        <button class="btn-sec" onclick="H.goBack()">Cancel · Keep Account</button>
      </div>
    </div>`;
  };

  pages.DeleteAccount_after = function () {
    H._deleteAccount = {
      confirm: async () => {
        const val = document.getElementById('deleteConfirm')?.value?.trim();
        if (val !== 'DELETE') { H.toast('Type DELETE to confirm'); return; }
        const btn = document.querySelector('.btn-pri[onclick*="confirm"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
        try {
          const c = H.supabaseClient || (typeof sb === 'function' ? sb() : null);
          if (c) {
            await c.rpc('delete_my_account');
            await c.auth.signOut();
          }
        } catch(e) { console.warn('delete_my_account rpc:', e); }
        H.state.currentUserId = null;
        H.saveState();
        H.toast('Account deleted');
        setTimeout(() => H.navTo('Home', null), 800);
      }
    };
  };

})(window.H = window.H || {});

;/* === www/js/help.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  // Icons (prefer H.ICONS, fallback set)
  const I = (window.H && H.ICONS) || {};
  const S = {
    help:       '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    doc:        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    lock:       '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    users:      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    mail:       '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    bug:        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l1.88 1.88"/><path d="M14.12 3.88L16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4c0 3.3-2.7 6-6 6z"/><path d="M3 7h2"/><path d="M19 7h2"/><path d="M3 13h2"/><path d="M19 13h2"/><line x1="6" y1="7" x2="6" y2="12"/><line x1="18" y1="7" x2="18" y2="12"/></svg>',
    message:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    phone:      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    chevron:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    chevronDown:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  };

  // --- Help Center ------------------------------------------
  pages.Help = function () {
    return `<div class="page active">
      ${H.innerTopbar('Help & Support')}
      <div class="form-wrap">
        <div class="help-section">
          <div class="section-title">Common Questions</div>
          <button class="help-item" onclick="H.openInner('FAQs')">
            <span class="help-icon">${S.help}</span>
            <span class="help-label">FAQs</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div class="help-section">
          <div class="section-title">Documentation</div>
          <button class="help-item" onclick="H.openInner('HelpTerms')">
            <span class="help-icon">${S.doc}</span>
            <span class="help-label">Terms & Conditions</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
          <button class="help-item" onclick="H.openInner('HelpPrivacy')">
            <span class="help-icon">${S.lock}</span>
            <span class="help-label">Privacy Policy</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
          <button class="help-item" onclick="H.openInner('HelpCommunity')">
            <span class="help-icon">${S.users}</span>
            <span class="help-label">Community Guidelines</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div class="help-section">
          <div class="section-title">Support</div>
          <button class="help-item" onclick="H.openInner('ContactSupport')">
            <span class="help-icon">${S.mail}</span>
            <span class="help-label">Contact Support</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
          <button class="help-item" onclick="H.openInner('ReportProblem')">
            <span class="help-icon">${S.bug}</span>
            <span class="help-label">Report a Problem</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">Quick Contact</div>
          <a href="mailto:chakusaprince@gmail.com" style="display:flex;align-items:center;gap:10px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--border)">
            <span style="color:#1A3A8F">${S.mail}</span>
            <span style="font-size:13px;font-weight:600;color:#1A3A8F">chakusaprince@gmail.com</span>
          </a>
          <a href="tel:+971589772645" style="display:flex;align-items:center;gap:10px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--border)">
            <span style="color:#16a34a">${S.phone}</span>
            <span style="font-size:13px;font-weight:600;color:#16a34a">+971 589 772 645</span>
          </a>
          <a href="https://wa.me/971589772645" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:10px 0;text-decoration:none">
            <span style="color:#25D366"><svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg></span>
            <span style="font-size:13px;font-weight:600;color:#25D366">Chat on WhatsApp</span>
          </a>
        </div>

        <div style="height:20px"></div>
      </div>
    </div>`;
  };

  // --- FAQs -------------------------------------------------
  pages.FAQs = function () {
    const faqs = [
      {
        q: 'How do I post an ad?',
        a: 'Tap the Post Ad button at the bottom of the screen. Follow the steps to add photos, title, description, price, and location. Your ad will be reviewed before going live.'
      },
      {
        q: 'How much does it cost to post?',
        a: 'Posting an ad is completely free! We only charge for optional premium features like boosting your listing or featured placement.'
      },
      {
        q: 'How long do listings stay active?',
        a: 'Listings remain active for 30 days. You can renew your listing anytime by tapping "Renew" on My Listings.'
      },
      {
        q: 'How do I get verified?',
        a: 'Go to your Profile > Verify Identity. Upload a valid ID and we\'ll verify it within 24 hours. Verified sellers get a blue badge!'
      },
      {
        q: 'Can I edit my listing?',
        a: 'Yes! Go to My Listings, tap the listing, then tap Edit. You can change photos, price, description, and other details.'
      },
      {
        q: 'Is my information safe?',
        a: 'We use industry-standard encryption to protect your data. Your phone number and email are never shared without your permission.'
      },
      {
        q: 'How do I report inappropriate content?',
        a: 'Tap the listing, scroll to the bottom, and tap "Report". Select the reason and submit. We review all reports within 24h.'
      },
      {
        q: 'How do I block a user?',
        a: 'Tap their profile > Block User. They won\'t be able to see your listings or contact you. Manage blocked users in Settings.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept mobile money (EcoCash, OneMoney), bank transfers, and card payments. All payments are secure and verified.'
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings > Security > Delete Account. Your account and all listings will be permanently removed after 30 days.'
      }
    ];

    return `<div class="page active">
      ${H.innerTopbar('FAQs')}
      <div class="faq-list">
        ${faqs.map((item, idx) => `
          <div class="faq-item" id="faq-${idx}">
            <button class="faq-question" onclick="H._faqs.toggleFaq(${idx})">
              <span>${H.escHtml(item.q)}</span>
              <span class="faq-toggle">${S.chevronDown}</span>
            </button>
            <div class="faq-answer">
              <div class="faq-text">${H.escHtml(item.a)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="height:20px"></div>
    </div>`;
  };

  pages.FAQs_after = function () {
    H._faqs = {
      toggleFaq: (idx) => {
        const item = document.getElementById('faq-' + idx);
        if (!item) return;
        item.classList.toggle('open');
      }
    };
  };

  // --- Contact Support --------------------------------------
  pages.ContactSupport = function () {
    return `<div class="page active">
      ${H.innerTopbar('Contact Support')}
      <div class="form-wrap">

        <a href="mailto:chakusaprince@gmail.com" style="display:flex;align-items:center;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;text-decoration:none;-webkit-tap-highlight-color:transparent">
          <div style="width:42px;height:42px;border-radius:12px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F">${S.mail}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--sub);font-weight:500;margin-bottom:2px">Email Support</div>
            <div style="font-size:14px;font-weight:700;color:#1A3A8F">chakusaprince@gmail.com</div>
          </div>
          <div style="color:var(--sub)">${S.chevron}</div>
        </a>

        <a href="tel:+971589772645" style="display:flex;align-items:center;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;text-decoration:none;-webkit-tap-highlight-color:transparent">
          <div style="width:42px;height:42px;border-radius:12px;background:#F0FDF4;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#16a34a">${S.phone}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--sub);font-weight:500;margin-bottom:2px">Call / WhatsApp</div>
            <div style="font-size:14px;font-weight:700;color:#16a34a">+971 589 772 645</div>
          </div>
          <div style="color:var(--sub)">${S.chevron}</div>
        </a>

        <a href="https://wa.me/971589772645" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px;text-decoration:none;-webkit-tap-highlight-color:transparent">
          <div style="width:42px;height:42px;border-radius:12px;background:#F0FDF4;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--sub);font-weight:500;margin-bottom:2px">WhatsApp</div>
            <div style="font-size:14px;font-weight:700;color:#25D366">Chat on WhatsApp</div>
          </div>
          <div style="color:var(--sub)">${S.chevron}</div>
        </a>

      </div>
    </div>`;
  };

  // --- Support Bot (Report a Problem) ----------------------
  pages.ReportProblem = function () {
    return `<div class="page active" style="display:flex;flex-direction:column;overflow:hidden;height:100%">
      ${H.innerTopbar('Support Chat')}
      <div id="botChat" style="flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:12px;min-height:0"></div>
      <div id="botChips" style="padding:8px 14px 4px;min-height:46px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:var(--bg);border-top:1px solid var(--border)"></div>
      <div style="padding:8px 14px 20px;background:var(--bg);display:flex;gap:8px;align-items:center">
        <input id="botInput" class="fi" style="flex:1;margin:0;font-size:14px" placeholder="Type your question..." onkeydown="if(event.key==='Enter')H._bot.send()">
        <button onclick="H._bot.send()" style="background:#1A3A8F;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0">Send</button>
      </div>
    </div>`;
  };

  pages.ReportProblem_after = function () {
    /* ── inject animation styles once ── */
    if (!document.getElementById('bot-css')) {
      var st = document.createElement('style');
      st.id = 'bot-css';
      st.textContent =
        '@keyframes botIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes dotP{0%,80%,100%{transform:scale(.45);opacity:.3}40%{transform:scale(1);opacity:1}}' +
        '.bot-bbl{animation:botIn .22s ease}' +
        '.bot-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#9ca3af;margin:0 2px;animation:dotP 1.3s ease-in-out infinite}' +
        '.bot-dot:nth-child(2){animation-delay:.22s}.bot-dot:nth-child(3){animation-delay:.44s}' +
        '.bot-chip:hover{background:#1A3A8F!important;color:#fff!important;border-color:#1A3A8F!important}';
      document.head.appendChild(st);
    }

    var HKEY = 'pm_bot_h2';
    var WA   = 'https://wa.me/971589772645';
    var ML   = 'mailto:chakusaprince@gmail.com';
    var PH   = 'tel:+971589772645';
    var WASVG= '<svg viewBox="0 0 24 24" width="17" height="17" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';

    /* ── knowledge base — 26 topics ── */
    var KB = [
      {
        tags:['sign in','login','log in','signin','forgot password','reset password','locked out','wrong password','account access','cant sign','cannot sign','email not found','not signing'],
        answer:'To sign in, tap "Sign In" on the home screen and enter your email and password.\n\nForgot your password?\n• Tap "Forgot Password" below the sign-in form\n• Check your inbox AND spam folder for the reset link\n\nIf your email isn\'t recognised, you may have registered with a different address.',
        chips:['Change Password','Delete Account','Contact Support']
      },
      {
        tags:['post','create listing','add listing','sell','post ad','how to post','new listing','list item','publish listing','upload item','add item'],
        answer:'To post a listing:\n1. Tap the orange ✚ Post button at the bottom of the screen\n2. Choose the right category (Electronics, Jobs, Rentals, etc.)\n3. Add 3–5 clear photos, a descriptive title, honest description, and price\n4. Set your location and tap Publish\n\nListings are reviewed and go live within minutes. Clear photos and honest descriptions get up to 3× more responses!',
        chips:['Edit a Listing','Boost a Listing','Mark as Sold']
      },
      {
        tags:['verify','verification','id','identity','badge','blue badge','verified seller','document','selfie','id document','get verified'],
        answer:'To earn your verified ✓ badge:\n1. Go to Profile (bottom nav)\n2. Tap "Verify Identity"\n3. Upload a clear photo of your national ID or passport\n4. Take a selfie — your face must match the ID\n5. Submit and wait up to 24 hours\n\nVerified sellers rank higher in search results and buyers trust them significantly more.',
        chips:['Edit Profile','Post a Listing','Contact Support']
      },
      {
        tags:['boost','promote','advertise','spotlight','feature','credits','ad credit','visibility','top of results','top listing','sponsored'],
        answer:'Boost puts your listing at the very top of search results and category pages!\n\nHow to boost:\n1. Open any of your active listings\n2. Tap "Boost Listing"\n3. Choose a package (duration/reach)\n4. Pay via EcoCash, OneMoney, or bank transfer\n\nNote: Credits are non-refundable once applied to a listing. Unused credits can be refunded within 7 days — contact us to request this.',
        chips:['Payment Methods','Post a Listing','Contact Support']
      },
      {
        tags:['message','chat','messaging','inbox','not receiving','send message','conversation','message seller','not syncing','not delivered','no reply','messages disappear'],
        answer:'Troubleshooting messages:\n\n• Make sure you\'re signed in\n• Check your internet connection\n• Close the app fully and reopen it — messages sync on reload\n• Wait 10–15 seconds after sending for delivery\n\nTo start a new chat:\n→ Open any listing → tap "Message Seller"\n\nIf the other person can\'t see your message, ask them to close and reopen the app.',
        chips:['Notification Issue','Block a User','Contact Support']
      },
      {
        tags:['scam','fraud','fake','suspicious','stolen','illegal','inappropriate','cheat','deceive','fake listing','advance fee','deposit scam','fake job','fake rental'],
        answer:'To report a scam or suspicious listing:\n1. Open the listing or user profile\n2. Tap the ⋯ menu → tap "Report"\n3. Select "Fraud / Scam" and describe what happened\n4. Submit — we review within 24 hours\n\n🛡 Safety rules:\n• NEVER pay any deposit before physically viewing an item\n• NEVER share your OTP, PIN, or bank password\n• Meet in a safe, busy public place\n• If it feels wrong, walk away immediately',
        chips:['Block a User','Report a User','Contact Support']
      },
      {
        tags:['report user','bad user','bad seller','bad buyer','harass','abusive','threatening','rude'],
        answer:'To report a user:\n1. Tap their name or profile picture to open their profile\n2. Scroll to the bottom\n3. Tap "Report User"\n4. Select the reason (Harassment, Fraud, Spam, etc.) and submit\n\nTo block them immediately:\n• On their profile, tap "Block User"\n• They can no longer message you, see your phone number, or view your listings\n• Manage all blocked users in Settings',
        chips:['Report a Scam','Contact Support','Ask Another Question']
      },
      {
        tags:['payment','pay','ecocash','onemoney','bank transfer','mobile money','zipit','rtgs','how to pay','transaction'],
        answer:'PaMarket uses direct peer-to-peer payments between buyers and sellers.\n\nAccepted methods:\n• EcoCash — send to seller\'s registered number\n• OneMoney — same process\n• Bank transfer (ZIPIT / RTGS)\n• Cash on delivery (meet in person)\n\n⚠️ PaMarket does NOT hold or process payments. Deal directly with sellers. Always inspect items before paying — never pay sight-unseen.',
        chips:['Boost a Listing','Report a Scam','Ask Another Question']
      },
      {
        tags:['job','apply','application','vacancy','hire','employer','employee','applied','apply for job','job not showing','job listing'],
        answer:'To apply for a job:\n1. Open the job listing\n2. Tap "Apply Now"\n3. Fill in your name, phone, email, and a short cover message\n4. Submit — the employer receives your application and contacts you directly\n\nFor employers:\n• Post in the "Jobs" category\n• Tap "Mark as Filled" once the position is taken\n\nTip: Complete your profile and upload your CV for one-tap applications!',
        chips:['Upload My CV','Post a Listing','Contact Support']
      },
      {
        tags:['cv','resume','upload cv','build cv','my cv','curriculum','work experience','open to work','job seeker'],
        answer:'To build and upload your CV:\n1. Go to Profile (bottom nav)\n2. Tap "Edit Profile"\n3. Scroll to the CV / Work Experience section\n4. Add your job history, skills, education, and sector\n5. Toggle "Open to Work" ON so employers can find you\n\nYour CV is shared automatically when you apply for any job listing.',
        chips:['Apply for a Job','Get Verified','Ask Another Question']
      },
      {
        tags:['delete account','remove account','close account','deactivate','leave pamarket','cancel account','erase account'],
        answer:'To permanently delete your account:\n1. Go to Settings (tap your profile icon → Settings)\n2. Scroll down to the Security section\n3. Tap "Delete Account"\n4. Enter your password to confirm\n\n⚠️ This cannot be undone. All your listings, messages, CV, and personal data are permanently deleted within 30 days.',
        chips:['Sign In Issue','Contact Support','Ask Another Question']
      },
      {
        tags:['crash','not loading','slow','freeze','stuck','error','blank screen','app not working','force close','bug','broken','won\'t open','not opening','keeps crashing','white screen'],
        answer:'Step-by-step fix for app issues:\n\n1. Close the app fully and reopen it\n2. Check your internet (try switching between WiFi and mobile data)\n3. Restart your phone\n4. Clear the app cache:\n   Android: Settings → Apps → PaMarket → Storage → Clear Cache\n   iPhone: Offload the app in Settings → General → iPhone Storage\n5. Uninstall and reinstall the latest version\n\nStill broken? Tell us your phone model and exactly what happens — we\'ll fix it quickly!',
        chips:['Contact Support','Ask Another Question']
      },
      {
        tags:['edit','update listing','change price','modify listing','update ad','change description','change photo','edit my listing'],
        answer:'To edit a listing:\n1. Tap the Profile icon (bottom nav) → My Listings\n2. Tap the listing you want to change\n3. Tap "Edit"\n4. Update the title, price, photos, description, or location\n5. Tap Save — changes appear live within seconds',
        chips:['Mark as Sold','Boost a Listing','Delete a Listing']
      },
      {
        tags:['delete listing','remove listing','take down','delete ad','remove ad'],
        answer:'To delete a listing:\n1. Go to My Listings (Profile icon)\n2. Tap the listing\n3. Tap "Delete" (or the trash icon)\n4. Confirm deletion\n\nThe listing is permanently removed from the marketplace.\n\nIf you just sold the item, use "Mark as Sold" instead — it hides the listing while keeping your record.',
        chips:['Post a Listing','Edit a Listing','Ask Another Question']
      },
      {
        tags:['sold','mark sold','mark filled','filled','listing sold','close listing','item sold','job filled','position filled'],
        answer:'To mark a listing as sold or filled:\n1. Go to My Listings\n2. Tap the listing\n3. Tap "Mark as Sold" (items / rentals) or "Mark as Filled" (job vacancies)\n\nThe listing is hidden from public search but kept in your account records. Tap "Delete" if you want it fully removed.',
        chips:['Post a Listing','Edit a Listing','Ask Another Question']
      },
      {
        tags:['notification','alert','push notification','not getting notification','no notification','enable notification','not notified'],
        answer:'To fix notifications:\n\nAndroid:\n  Settings → Apps → PaMarket → Notifications → Turn ON\n\niPhone:\n  Settings → PaMarket → Notifications → Allow Notifications\n\nAlso make sure you\'re signed in — notifications only work when logged in.\n\nYou\'ll receive alerts for: new messages, job applications on your listings, listing status changes, and admin updates.',
        chips:['Messages Issue','Contact Support','Ask Another Question']
      },
      {
        tags:['block','block user','blocked','unwanted messages','spam user'],
        answer:'To block a user:\n1. Tap their name or profile photo to open their profile\n2. Scroll to the bottom of their profile\n3. Tap "Block User"\n\nBlocked users cannot message you, call you, or see your contact details. You can view and manage all blocked users in Settings.',
        chips:['Report a User','Messages Issue','Ask Another Question']
      },
      {
        tags:['free','cost','price','fee','how much','charges','paid feature','subscription','pricing'],
        answer:'PaMarket is 100% free for buyers and sellers!\n\nAlways free:\n✓ Post unlimited listings\n✓ Message any seller or buyer\n✓ Apply for jobs\n✓ Browse all categories\n✓ Create your profile and CV\n✓ Get verified\n\nOptional paid upgrades:\n• Boost — pushes your listing to the top of search results\n• Spotlight Ad — featured placement on the home page\n\nNo subscription. No hidden fees. No commission on sales.',
        chips:['Boost a Listing','Post a Listing','Ask Another Question']
      },
      {
        tags:['profile','update profile','edit profile','change name','change photo','profile picture','bio','city','avatar'],
        answer:'To update your profile:\n1. Tap the Profile icon at the bottom\n2. Tap "Edit Profile"\n3. Change your name, profile photo, bio, city, phone number, or skills\n4. Tap Save\n\nA complete profile with a clear, friendly photo gets 3× more responses from buyers and employers.',
        chips:['Get Verified','Upload My CV','Ask Another Question']
      },
      {
        tags:['rental','rent','house','room','property','accommodation','commercial space','apartment','flat','lodge','bedsit'],
        answer:'To find a rental:\n• Select "Rentals" on the home screen or search by city\n• Filter by price range and province\n• Tap any listing to see full details and contact the landlord directly\n\nTo post a rental:\n• Tap ✚ Post → choose "Rentals"\n• Add real photos of the actual property, monthly rent, and exact location\n\n⚠️ NEVER pay a deposit before physically viewing a property.',
        chips:['Post a Listing','Report a Scam','Payment Methods']
      },
      {
        tags:['category','what can i sell','electronics','cars','vehicles','furniture','clothes','services','animals','farm','what can be sold'],
        answer:'PaMarket supports all legal categories:\n\n🛒 Buy & Sell\n   Electronics · Clothing · Furniture · Vehicles · Appliances · Farming equipment\n\n💼 Jobs\n   All sectors · Full-time · Part-time · Freelance · Domestic\n\n🏠 Rentals\n   Houses · Rooms · Commercial spaces · Farmland\n\n🔧 Services\n   Plumbing · Construction · Cleaning · Delivery · Tutoring\n\nAlways choose the most specific category — it gets your listing found faster.',
        chips:['Post a Listing','Get Verified','Ask Another Question']
      },
      {
        tags:['photo','image upload','add photo','photo not uploading','picture not loading','image not showing','photo failed'],
        answer:'Tips for uploading photos:\n• Use JPG or PNG files under 5 MB each\n• Make sure your internet connection is stable when uploading\n• Try a different photo if one specific image keeps failing\n• Clear app cache if photos won\'t display (Settings → Apps → PaMarket → Clear Cache)\n\nYou can add up to 5 photos per listing. The FIRST photo becomes your thumbnail — make it the best, clearest shot!',
        chips:['Post a Listing','Edit a Listing','Contact Support']
      },
      {
        tags:['renew','expired listing','30 days','listing expired','listing removed','disappeared','no longer showing','listing gone'],
        answer:'Listings stay active for 30 days, then automatically archive.\n\nTo renew an expired listing:\n1. Go to My Listings\n2. Find the expired listing (marked "Expired")\n3. Tap "Renew"\n\nThis re-publishes it free for another 30 days.\n\nIf your listing disappeared before 30 days, it may have been reported and removed. Check your notification inbox or contact us for details.',
        chips:['Edit a Listing','Boost a Listing','Contact Support']
      },
      {
        tags:['search','find listing','browse','can\'t find','not showing up','listing not found','search not working','search results'],
        answer:'How to find listings:\n• Use the search bar at the top — try specific keywords like "iPhone 13 Harare" or "2 bedroom Bulawayo"\n• Browse by category on the home screen\n• Filter by province, price range, or category\n\nIf YOUR listing isn\'t showing in search:\n• It may still be under review (allow a few minutes after posting)\n• Check it hasn\'t expired (30-day limit)\n• Try searching for the exact title you used',
        chips:['Post a Listing','Renew a Listing','Contact Support']
      },
      {
        tags:['banned','suspended','account suspended','account banned','why banned','appeal ban','unban','account disabled'],
        answer:'If your account has been suspended:\n\n1. Check your registered email — we send a notification explaining the reason\n2. Common reasons: policy violation, reported content, suspicious login activity\n\nTo appeal:\n• Email chakusaprince@gmail.com with:\n  — Your account email address\n  — Why you believe the suspension was an error\n  — Any supporting evidence\n• We review all appeals within 7 days\n\n⚠️ Creating a second account to bypass a ban results in permanent removal.',
        chips:['Contact Support','Ask Another Question']
      },
      {
        tags:['change phone','phone number','update phone','new number','change number'],
        answer:'To update your phone number:\n1. Go to Profile (bottom nav)\n2. Tap "Edit Profile"\n3. Update your phone number field\n4. Save changes\n\nYour phone number is visible to other users when they view your listings — make sure it\'s a number you actively use.',
        chips:['Edit Profile','Get Verified','Ask Another Question']
      },
    ];

    var chat     = document.getElementById('botChat');
    var chipsEl  = document.getElementById('botChips');
    var input    = document.getElementById('botInput');
    var history  = [];
    var msgCount = 0;

    var INIT_CHIPS = ['Sign In Issue','Post a Listing','Get Verified','Messaging Issue','Report a Scam','Boost a Listing','Job / CV Help','App Not Working','Pricing Info','Account Banned'];
    var CHIP_MAP   = {
      'Sign In Issue':    'sign in login forgot password',
      'Post a Listing':   'post create listing sell publish',
      'Get Verified':     'verify verification badge identity',
      'Messaging Issue':  'message chat not working inbox',
      'Report a Scam':    'scam fraud fake suspicious',
      'Boost a Listing':  'boost promote advertise credits',
      'Job / CV Help':    'job apply cv resume vacancy',
      'App Not Working':  'crash not loading freeze error bug',
      'Pricing Info':     'free cost price fee subscription',
      'Account Banned':   'banned suspended appeal account',
      'Edit a Listing':   'edit update listing change price',
      'Delete a Listing': 'delete remove listing',
      'Mark as Sold':     'sold filled close listing',
      'Upload My CV':     'cv resume upload build',
      'Apply for a Job':  'job apply application vacancy',
      'Payment Methods':  'payment pay ecocash onemoney bank transfer',
      'Block a User':     'block user blocked harass',
      'Report a User':    'report user bad seller harass',
      'Notification Issue':'notification alert push not getting',
      'Edit Profile':     'profile photo bio city update',
      'Renew a Listing':  'renew expired listing 30 days',
      'Change Password':  'sign in forgot password reset',
    };

    function timeStr() {
      return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }

    function nl2br(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }

    function scrollDown() {
      setTimeout(function(){ if (chat) chat.scrollTop = chat.scrollHeight; }, 70);
    }

    function saveHistory() {
      try { localStorage.setItem(HKEY, JSON.stringify(history.slice(-60))); } catch(e) {}
    }

    function loadHistory() {
      try { var s = localStorage.getItem(HKEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
    }

    function avatar() {
      var d = document.createElement('div');
      d.style.cssText = 'width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 1px 4px rgba(26,58,143,.3)';
      d.textContent = 'P';
      return d;
    }

    function addMsg(text, isUser, restored) {
      if (!restored) { history.push({t:text, u:isUser, ts:timeStr()}); saveHistory(); }

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px;' + (isUser ? 'justify-content:flex-end' : 'justify-content:flex-start');

      if (!isUser) row.appendChild(avatar());

      var col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;align-items:' + (isUser ? 'flex-end' : 'flex-start') + ';max-width:80%;gap:3px';

      var bbl = document.createElement('div');
      if (!restored) bbl.className = 'bot-bbl';
      bbl.style.cssText = 'padding:10px 14px;border-radius:' + (isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px') + ';font-size:14px;line-height:1.55;word-break:break-word;' + (isUser ? 'background:#1A3A8F;color:#fff' : 'background:var(--card);color:var(--text);border:1.5px solid var(--border)');
      bbl.innerHTML = nl2br(text);
      col.appendChild(bbl);

      var ts = document.createElement('div');
      ts.style.cssText = 'font-size:10px;color:var(--sub);padding:0 4px';
      ts.textContent = restored && restored.ts ? restored.ts : timeStr();
      col.appendChild(ts);

      if (!isUser && !restored) {
        var fb = document.createElement('div');
        fb.style.cssText = 'display:flex;gap:6px;padding:0 2px;margin-top:1px';
        fb.innerHTML =
          '<button onclick="H._bot.helpful(this)" style="background:none;border:1.5px solid var(--border);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:var(--sub);cursor:pointer">👍 Helpful</button>' +
          '<button onclick="H._bot.notHelpful(this)" style="background:none;border:1.5px solid var(--border);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:var(--sub);cursor:pointer">👎 Not quite</button>';
        col.appendChild(fb);
      }

      row.appendChild(col);
      chat.appendChild(row);
      scrollDown();
    }

    function showTyping() {
      hideTyping();
      var row = document.createElement('div');
      row.id = 'bot-typing';
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px';
      row.appendChild(avatar());
      var bbl = document.createElement('div');
      bbl.style.cssText = 'background:var(--card);border:1.5px solid var(--border);border-radius:18px 18px 18px 4px;padding:12px 16px';
      bbl.innerHTML = '<span class="bot-dot"></span><span class="bot-dot"></span><span class="bot-dot"></span>';
      row.appendChild(bbl);
      chat.appendChild(row);
      scrollDown();
    }

    function hideTyping() {
      var el = document.getElementById('bot-typing');
      if (el) el.remove();
    }

    function addContactCard() {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px';
      row.appendChild(avatar());
      var card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-width:86%';
      card.innerHTML =
        '<div style="font-size:12px;color:var(--sub);padding:0 2px">Reach our team directly:</div>' +
        '<a href="'+WA+'" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;background:#F0FDF4;border:1.5px solid #bbf7d0;border-radius:14px;padding:11px 14px;text-decoration:none">'+WASVG+'<div><div style="font-size:13px;font-weight:700;color:#16a34a">WhatsApp Chat</div><div style="font-size:11px;color:var(--sub)">+971 589 772 645 · Fastest reply</div></div></a>' +
        '<a href="'+ML+'" style="display:flex;align-items:center;gap:10px;background:#EFF6FF;border:1.5px solid #bfdbfe;border-radius:14px;padding:11px 14px;text-decoration:none"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><div><div style="font-size:13px;font-weight:700;color:#1A3A8F">Email Support</div><div style="font-size:11px;color:var(--sub)">chakusaprince@gmail.com</div></div></a>' +
        '<a href="'+PH+'" style="display:flex;align-items:center;gap:10px;background:#F0FDF4;border:1.5px solid #bbf7d0;border-radius:14px;padding:11px 14px;text-decoration:none"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg><div><div style="font-size:13px;font-weight:700;color:#16a34a">Call Us</div><div style="font-size:11px;color:var(--sub)">+971 589 772 645</div></div></a>';
      row.appendChild(card);
      chat.appendChild(row);
      scrollDown();
    }

    function showChips(list) {
      if (!chipsEl) return;
      chipsEl.innerHTML = '';
      list.forEach(function(label) {
        var btn = document.createElement('button');
        btn.className = 'bot-chip';
        btn.style.cssText = 'background:var(--card);border:1.5px solid var(--border);border-radius:20px;padding:6px 13px;font-size:12px;font-weight:600;color:var(--text);cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s';
        btn.textContent = label;
        btn.onclick = function(){ handleInput(label); };
        chipsEl.appendChild(btn);
      });
    }

    function bestMatch(text) {
      var lower = text.toLowerCase();
      var best = null, top = 0;
      KB.forEach(function(entry) {
        var hits = 0;
        entry.tags.forEach(function(tag){ if (lower.indexOf(tag) !== -1) hits++; });
        if (hits > top) { top = hits; best = entry; }
      });
      return top > 0 ? best : null;
    }

    function respond(query) {
      hideTyping();
      var match = bestMatch(query);
      if (match) {
        addMsg(match.answer, false);
        showChips((match.chips || []).concat(['Ask Another Question']));
      } else {
        addMsg("I couldn't find a specific answer for that. Let me connect you with our support team directly:", false);
        addContactCard();
        showChips(['Ask Another Question']);
      }
    }

    function handleInput(text) {
      if (!text || !text.trim()) return;
      if (input) input.value = '';

      if (text === 'Ask Another Question') {
        addMsg(text, true);
        addMsg('Of course! What can I help you with? 😊', false);
        showChips(INIT_CHIPS);
        return;
      }
      if (text === 'Contact Support') {
        addMsg(text, true);
        addMsg('Here are all the ways to reach us:', false);
        addContactCard();
        showChips(['Ask Another Question']);
        return;
      }

      addMsg(text, true);
      var query = CHIP_MAP[text] || text;
      showTyping();
      setTimeout(function(){ respond(query); }, 680);
    }

    H._bot = {
      send: function() {
        var val = input ? input.value.trim() : '';
        if (val) handleInput(val);
      },
      helpful: function(btn) {
        if (btn.parentElement) btn.parentElement.innerHTML = '<span style="font-size:11px;color:#16a34a;font-weight:700">✓ Great, glad that helped!</span>';
        showChips(INIT_CHIPS);
      },
      notHelpful: function(btn) {
        if (btn.parentElement) btn.parentElement.innerHTML = '<span style="font-size:11px;color:var(--sub)">Let me get our team to help...</span>';
        setTimeout(function(){ addContactCard(); showChips(['Ask Another Question']); }, 350);
      }
    };

    /* ── init: restore history or show greeting ── */
    var saved = loadHistory();
    if (saved && saved.length > 0) {
      history = saved;
      saved.forEach(function(m) { addMsg(m.t, m.u, m); });
      addMsg('Welcome back! How can I help you today?', false, true); // true = don't save greeting to history
      showChips(INIT_CHIPS);
    } else {
      addMsg('Hi! I\'m the PaMarket Support Bot.\n\nI can answer your questions instantly — 26 topics covered. Tap a topic below or type anything.', false, true);
      showChips(INIT_CHIPS);
    }
  };

  // --- Terms & Conditions ----------------------------------
  pages.HelpTerms = function () {
    return `<div class="page active">
      ${H.innerTopbar('Terms of Service')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Terms of Service</h2>
          <p style="color:var(--ash);font-size:12px">Last updated: May 2026 · Effective immediately</p>

          <h2>1. Agreement to Terms</h2>
          <p>By downloading, installing, or using the PaMarket application ("App"), you agree to be legally bound by these Terms of Service. If you do not agree to these terms, you must not use the App. These terms govern all users: buyers, sellers, job seekers, employers, and visitors.</p>

          <h2>2. Who Can Use PaMarket</h2>
          <p>You must be at least 18 years old to create an account or use PaMarket. By registering, you confirm that you meet this age requirement and are legally competent to enter into contracts under Zimbabwean law. We reserve the right to terminate accounts where the minimum age requirement is not met.</p>

          <h2>3. Account Responsibility</h2>
          <p>You are responsible for keeping your account credentials confidential. All activity that occurs under your account is your responsibility. You must provide accurate and truthful information when registering. If you suspect unauthorized access to your account, contact us immediately at chakusaprince@gmail.com or WhatsApp +971 589 772 645.</p>

          <h2>4. What PaMarket Is</h2>
          <p>PaMarket is an online classifieds marketplace that connects buyers and sellers in Zimbabwe. We provide the platform — we are not a party to any transaction between users. We do not hold payments, guarantee delivery, or verify the condition of items unless stated. All transactions are conducted directly between users at their own risk.</p>

          <h2>5. Listing Rules</h2>
          <p>All listings must be honest, legal, and comply with Zimbabwean law. You must own or have explicit authority to sell any item listed. The following content is strictly prohibited and will result in immediate removal and account termination:</p>
          <ul>
            <li>Stolen, counterfeit, or fraudulent goods of any kind</li>
            <li>Weapons, firearms, ammunition, or explosive devices</li>
            <li>Illegal drugs, controlled substances, or drug paraphernalia</li>
            <li>Adult, sexually explicit, or pornographic content</li>
            <li>Protected wildlife, animal products, or endangered species</li>
            <li>Pyramid schemes, multi-level marketing, or investment fraud</li>
            <li>Fake, misleading, or non-existent job listings</li>
            <li>Fraudulent rental listings or advance deposit scams</li>
            <li>Human trafficking, exploitation, or domestic workers without consent</li>
          </ul>

          <h2>6. Advertising Credits (Boost Feature)</h2>
          <p>PaMarket offers optional paid advertising credits ("Boost") to increase the visibility of your listings. These credits are purchased as a business service via external payment methods (EcoCash, OneMoney, or bank transfer). Advertising credits are not processed by Google Play or the Apple App Store. Credits are non-refundable once applied to a listing. Unused credits may be refunded at our discretion within 7 days of purchase — contact us to request a refund.</p>

          <h2>7. User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Harass, threaten, abuse, or discriminate against other users</li>
            <li>Post false, misleading, or deceptive information or images</li>
            <li>Send unsolicited messages (spam) to other users</li>
            <li>Attempt to circumvent our moderation, security, or verification systems</li>
            <li>Create multiple accounts to evade a suspension or ban</li>
            <li>Impersonate another person, business, or official entity</li>
            <li>Use automated tools to scrape or access the platform</li>
          </ul>

          <h2>8. User Content License</h2>
          <p>By posting photos, text, or any content on PaMarket, you grant us a non-exclusive, worldwide, royalty-free license to display, reproduce, and distribute that content within the App and for promotional purposes. You confirm that you own or have the rights to all content you post and that it does not infringe any third-party rights.</p>

          <h2>9. Intellectual Property</h2>
          <p>All design, branding, logos, code, and content created by PaMarket are protected by copyright and intellectual property law. You may not copy, reproduce, reverse-engineer, or redistribute any part of the App without our written consent.</p>

          <h2>10. Moderation and Enforcement</h2>
          <p>We reserve the right to remove any listing, suspend, or permanently ban any account that violates these Terms at any time, with or without notice. Serious violations including fraud, scams, or illegal activity may be reported to relevant Zimbabwean authorities. Banned users may appeal by contacting chakusaprince@gmail.com within 14 days of the ban.</p>

          <h2>11. Disclaimer of Warranties</h2>
          <p>PaMarket is provided "as is" and "as available" without any warranties, express or implied. We do not guarantee that the App will be uninterrupted, error-free, or that listings are accurate. We are not responsible for the quality, safety, legality, or availability of listed items.</p>

          <h2>12. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, PaMarket and its operators shall not be liable for any indirect, incidental, punitive, or consequential damages arising from your use of the App, including loss of money, data, or business opportunity resulting from transactions between users.</p>

          <h2>13. Governing Law</h2>
          <p>These Terms are governed exclusively by the laws of the Republic of Zimbabwe. Any legal disputes shall be subject to the jurisdiction of the courts of Zimbabwe.</p>

          <h2>14. Changes to These Terms</h2>
          <p>We may update these Terms from time to time. We will notify users of significant changes through the App. Continued use of the App after any update constitutes your acceptance of the revised Terms. You may stop using the App at any time if you disagree with the updated Terms.</p>

          <h2>15. Contact Us</h2>
          <p>For questions about these Terms, contact us at:</p>
          <ul>
            <li>Email: chakusaprince@gmail.com</li>
            <li>WhatsApp: +971 589 772 645</li>
          </ul>
        </div>
      </div>
    </div>`;
  };
pages.HelpPrivacy = function () {
    return `<div class="page active">
      ${H.innerTopbar('Privacy Policy')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Privacy Policy</h2>
          <p style="color:var(--ash);font-size:12px">Last updated: May 2026</p>

          <h2>1. Who We Are</h2>
          <p>PaMarket is a Zimbabwean marketplace application. We are committed to protecting your privacy and handling your data responsibly. This policy explains what data we collect, why we collect it, and how we protect it.</p>

          <h2>2. Data We Collect</h2>
          <ul>
            <li><strong>Account data:</strong> Name, email address, phone number, encrypted password</li>
            <li><strong>Profile data:</strong> Profile photo, bio, city/province location</li>
            <li><strong>Listing data:</strong> Photos, descriptions, prices, and location of items you post</li>
            <li><strong>Messages:</strong> In-app conversations between buyers and sellers</li>
            <li><strong>Transaction data:</strong> Advertising credit balance and top-up reference history</li>
            <li><strong>Device data:</strong> Device type, operating system version, app version</li>
            <li><strong>Usage data:</strong> Pages viewed, search queries, and listing interactions</li>
          </ul>

          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To create and manage your user account</li>
            <li>To display your listings to other users across Zimbabwe</li>
            <li>To facilitate secure in-app messaging between buyers and sellers</li>
            <li>To verify advertising credit purchases and apply boosts to listings</li>
            <li>To detect, investigate, and prevent fraud and policy violations</li>
            <li>To improve the App, fix bugs, and enhance user experience</li>
            <li>To send you important notifications about your account and listings</li>
          </ul>

          <h2>4. Data We Do Not Collect</h2>
          <ul>
            <li>We do not collect your precise GPS or real-time location</li>
            <li>We do not collect payment card numbers or banking credentials</li>
            <li>We do not access your camera or photo library without your explicit action</li>
            <li>We do not collect contacts, call logs, or SMS messages</li>
          </ul>

          <h2>5. Data Sharing</h2>
          <p>We do not sell your personal data to third parties. We may share data with:</p>
          <ul>
            <li><strong>Other users:</strong> Your public profile name, phone number (if provided), and listings are visible to all users</li>
            <li><strong>Supabase:</strong> Our secure database and authentication infrastructure provider</li>
            <li><strong>Legal authorities:</strong> When required by Zimbabwean law, court order, or to protect public safety</li>
          </ul>

          <h2>6. Data Security</h2>
          <p>We implement industry-standard security: HTTPS encryption for all data in transit, encrypted password storage (never stored in plain text), row-level security on our database, and access controls. While we take all reasonable precautions, no internet system is 100% secure and we cannot guarantee absolute security of your data.</p>

          <h2>7. Camera and Photo Permissions</h2>
          <p>We request camera and photo library access only when you choose to upload a photo for a listing or your profile. The App never accesses your camera or photos passively. You may deny this permission and still use the App without photo uploads.</p>

          <h2>8. Notifications Permission</h2>
          <p>We request permission to send push notifications to alert you about new messages, listing activity, and account updates. You may disable notifications at any time in your device settings. Turning off notifications will not affect your ability to use the App.</p>

          <h2>9. Data Retention</h2>
          <p>We retain your data for as long as your account is active. When you delete your account, all personal data, listings, messages, and transaction records are permanently deleted within 30 days. Backup copies are purged within 90 days of account deletion.</p>

          <h2>10. Your Rights</h2>
          <ul>
            <li>Access and review your personal data at any time via your Profile page</li>
            <li>Correct inaccurate information through your Profile Settings</li>
            <li>Delete your account and all associated data via Settings → Delete Account</li>
            <li>Opt out of promotional notifications via Settings → Notification Preferences</li>
            <li>Request a copy of all data we hold about you by emailing chakusaprince@gmail.com</li>
          </ul>

          <h2>11. Children's Privacy</h2>
          <p>PaMarket is strictly for users aged 18 and over. We do not knowingly collect personal data from anyone under 18. If we discover that a minor has created an account, we will immediately delete their account and all associated data. If you believe a minor is using the App, please contact us.</p>

          <h2>12. Third-Party Links</h2>
          <p>Listings may include links to WhatsApp or external websites. We are not responsible for the privacy practices or content of any third-party services. We encourage you to review their privacy policies before sharing personal information.</p>

          <h2>13. Changes to This Policy</h2>
          <p>We will notify you of material changes to this Privacy Policy through the App at least 7 days before they take effect. Continued use of the App after changes constitute your acceptance of the updated policy.</p>

          <h2>14. Contact Us</h2>
          <p>For privacy concerns, data requests, or complaints, contact us at:</p>
          <ul>
            <li>Email: chakusaprince@gmail.com</li>
            <li>WhatsApp: +971 589 772 645</li>
          </ul>
        </div>
      </div>
    </div>`;
  };
pages.HelpCommunity = function () {
    return `<div class="page active">
      ${H.innerTopbar('Community Guidelines')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Community Guidelines</h2>
          <p style="color:var(--ash);font-size:12px">Last updated: May 2026</p>
          <p>PaMarket is built on trust. These guidelines exist to keep our marketplace safe, fair, and beneficial for every Zimbabwean. Violations result in warnings, listing removal, suspension, or permanent bans.</p>

          <h2>1. Be Honest</h2>
          <p>Accuracy is everything in a marketplace. You must:</p>
          <ul>
            <li>Post accurate titles, descriptions, and photos of your actual item</li>
            <li>Disclose any defects, damage, or issues with items</li>
            <li>Only post items you genuinely have available for sale</li>
            <li>Set fair prices and honor agreed prices</li>
            <li>Never use misleading photos or stolen images</li>
          </ul>

          <h2>2. Be Safe</h2>
          <ul>
            <li>Meet buyers and sellers in safe, public locations</li>
            <li>Never send money before inspecting an item in person</li>
            <li>Be cautious of buyers who pressure you to accept unusual payment methods</li>
            <li>Never share your OTP, PIN, or banking passwords with anyone</li>
            <li>Trust your instincts — if something feels wrong, walk away</li>
          </ul>

          <h2>3. Be Respectful</h2>
          <ul>
            <li>Treat all users with dignity and respect</li>
            <li>No harassment, threats, bullying, or abusive language</li>
            <li>No discrimination based on race, gender, religion, tribe, or disability</li>
            <li>No unsolicited messages or spam to other users</li>
            <li>Respect others privacy — never share personal information without consent</li>
          </ul>

          <h2>4. No Fraud or Scams</h2>
          <p>Zero tolerance for fraud. The following will result in immediate permanent ban:</p>
          <ul>
            <li>Advance fee fraud ("send deposit first")</li>
            <li>Fake job listings designed to collect personal information</li>
            <li>Fake rental listings with non-existent properties</li>
            <li>Selling items you do not own or have no right to sell</li>
            <li>Creating multiple accounts to evade bans</li>
            <li>Any form of identity theft or impersonation</li>
          </ul>

          <h2>5. Prohibited Items</h2>
          <p>The following may never be listed on PaMarket:</p>
          <ul>
            <li>Stolen goods of any kind</li>
            <li>Counterfeit or fake branded products</li>
            <li>Weapons, ammunition, or explosives</li>
            <li>Illegal drugs or controlled substances</li>
            <li>Adult or sexually explicit content</li>
            <li>Protected wildlife or animal products</li>
            <li>Pyramid schemes or investment fraud</li>
            <li>Human trafficking or exploitation</li>
          </ul>

          <h2>6. Jobs & Rentals</h2>
          <p>High-risk categories require extra responsibility:</p>
          <ul>
            <li>Job listings must be genuine with real contact details</li>
            <li>Never charge job seekers an application or registration fee</li>
            <li>Rental listings must describe real, available properties</li>
            <li>Never request rental deposits before viewing a property</li>
            <li>Salary and rent amounts must be realistic and accurate</li>
          </ul>

          <h2>7. Reporting Violations</h2>
          <p>If you see something suspicious:</p>
          <ul>
            <li>Use the Report button on any listing or user profile</li>
            <li>Email us at chakusaprince@gmail.com for urgent matters</li>
            <li>All reports are reviewed within 24 hours</li>
            <li>3 or more reports on a listing triggers automatic review</li>
            <li>False reports made in bad faith will result in action against the reporter</li>
          </ul>

          <h2>8. Enforcement</h2>
          <ul>
            <li><strong>Warning:</strong> First minor violation</li>
            <li><strong>Listing removal:</strong> Content that violates guidelines</li>
            <li><strong>Temporary suspension (24-72 hours):</strong> Repeated minor violations</li>
            <li><strong>7-day suspension:</strong> Serious violations</li>
            <li><strong>Permanent ban:</strong> Fraud, scams, or 3+ serious violations</li>
          </ul>
          <p>Banned users may appeal by emailing chakusaprince@gmail.com with evidence. We review all appeals within 7 days.</p>

          <h2>9. Our Commitment</h2>
          <p>We are committed to making PaMarket Zimbabwe's most trusted marketplace. We review all reports, take action on violations, and continuously improve our safety systems. Together we can build a marketplace that works for everyone.</p>

          <h2>Contact Safety Team</h2>
          <p>chakusaprince@gmail.com</p>
        </div>
      </div>
    </div>`;
  };

  // --- About PaMarket -----------------------------------------
  pages.About = function () {
    const year = new Date().getFullYear();

    const sec = (title) => `<p style="font-size:16px;font-weight:800;color:var(--text);margin:28px 0 10px;letter-spacing:-.2px">${title}</p>`;

    const featureCard = ([icon, title, desc]) => `
      <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:26px;margin-bottom:7px">${icon}</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${title}</div>
        <div style="font-size:11px;color:var(--sub);line-height:1.55">${desc}</div>
      </div>`;

    const valueCard = ([icon, title, body]) => `
      <div style="display:flex;align-items:flex-start;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:22px;flex-shrink:0;margin-top:1px">${icon}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div>
          <div style="font-size:12px;color:var(--sub);line-height:1.6">${body}</div>
        </div>
      </div>`;

    const stepCard = (num, title, body) => `
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">
        <div style="width:32px;height:32px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${num}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div>
          <div style="font-size:12px;color:var(--sub);line-height:1.6">${body}</div>
        </div>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('About PaMarket')}

      <!-- Hero -->
      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:36px 20px 32px;text-align:center">
        <div style="width:72px;height:72px;background:rgba(255,255,255,.15);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-1px">Pa</div>
        <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px">Pa<span style="color:#F5A623">Market</span></div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:6px">Zimbabwe's Free Marketplace</div>
        <div style="display:flex;justify-content:center;gap:16px;margin-top:18px">
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:900;color:#F5A623">2026</div>
            <div style="font-size:10px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Founded</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.2)"></div>
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:900;color:#F5A623">10+</div>
            <div style="font-size:10px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Categories</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.2)"></div>
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:900;color:#F5A623">Free</div>
            <div style="font-size:10px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Always</div>
          </div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:18px;font-weight:600">Version 2.0.0</div>
      </div>

      <div class="doc-content" style="padding-top:4px">

        ${sec('Our Story')}
        <p style="font-size:13px;color:var(--sub);line-height:1.75">PaMarket was born in 2026 out of a simple observation: Zimbabweans needed a modern, free, and reliable place to buy, sell, and connect online. Existing platforms were either too expensive, too complicated, or not built for the Zimbabwean context.</p>
        <p style="font-size:13px;color:var(--sub);line-height:1.75;margin-top:10px">We set out to build something different. PaMarket is designed from the ground up for Zimbabwe, covering all 10 provinces, supporting local pricing in USD and ZiG, and making it as easy as possible to post an ad, browse listings, and get in touch with buyers and sellers.</p>

        ${sec('Our Mission')}
        <p style="font-size:13px;color:var(--sub);line-height:1.75">To make commerce accessible to every Zimbabwean, regardless of location or budget. Buying, selling, renting, and finding work should be free and simple for everyone.</p>

        ${sec('What We Offer')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
          ${[
            ['🛒','Buy and Sell','Post ads and find deals on goods across all categories'],
            ['💼','Jobs Board','Post vacancies and find work across all industries'],
            ['🏠','Property and Rooms','Houses, flats, rooms, and commercial spaces for rent or sale'],
            ['🚗','Vehicles','Cars, trucks, motorbikes, and farming equipment'],
            ['👗','Fashion','Clothes, shoes, and accessories at local prices'],
            ['📱','Electronics','Phones, laptops, appliances, and gadgets'],
            ['🛋️','Furniture','Home furniture, office furniture, and decor'],
            ['🐾','Pets and Agriculture','Animals, livestock, seeds, and farming supplies'],
            ['🔧','Services','Plumbers, electricians, drivers, and skilled tradespeople'],
            ['👶','Baby and Kids','Baby gear, toys, and children\'s items']
          ].map(featureCard).join('')}
        </div>

        ${sec('How It Works')}
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px 16px 4px">
          ${stepCard(1, 'Create a free account', 'Sign up in seconds using your email, Google, or Apple account. No subscription fees, no hidden charges.')}
          ${stepCard(2, 'Post your listing', 'Add photos, a description, and your price. Your ad goes live instantly and reaches buyers across Zimbabwe.')}
          ${stepCard(3, 'Connect and close the deal', 'Buyers reach out via in-app messaging or WhatsApp. Arrange a viewing, negotiate, and complete the sale safely.')}
        </div>

        ${sec('Who Is PaMarket For?')}
        ${[
          ['👤', 'Individuals', 'Sell items you no longer need, find second-hand bargains, or rent out a spare room.'],
          ['🏢', 'Small Businesses', 'Promote your products and services to active buyers in your city and province.'],
          ['👔', 'Employers', 'Post job vacancies and find qualified candidates from across Zimbabwe.'],
          ['🔍', 'Job Seekers', 'Browse real job listings and apply directly through the app.'],
          ['🏗️', 'Property Owners', 'List properties and rooms for rent or sale and manage enquiries in one place.'],
          ['🚜', 'Farmers and Traders', 'Buy and sell agricultural produce, livestock, and equipment.']
        ].map(valueCard).join('')}

        ${sec('Our Values')}
        ${[
          ['🇿🇼', 'Made for Zimbabwe', 'Every feature is designed with Zimbabwean users in mind, from province-based filtering to ZiG and USD pricing support.'],
          ['🆓', 'Free to Use', 'Posting and browsing are always free. We believe access to a marketplace should not cost money.'],
          ['🔒', 'Safety First', 'We verify seller identities, moderate listings, and give users tools to report and block bad actors.'],
          ['⚡', 'Simple and Fast', 'The app is lightweight and designed to work well on any smartphone and connection speed.'],
          ['🤝', 'Community Driven', 'PaMarket grows through the trust of its community. We listen to feedback and improve constantly.']
        ].map(valueCard).join('')}

        ${sec('Legal')}
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;overflow:hidden">
          <div onclick="H.openInner('HelpPrivacy')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:var(--text)">Privacy Policy</span>
            <span style="color:var(--sub)">›</span>
          </div>
          <div onclick="H.openInner('HelpTerms')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:var(--text)">Terms of Service</span>
            <span style="color:var(--sub)">›</span>
          </div>
          <div onclick="H.openInner('HelpCommunity')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:var(--text)">Community Guidelines</span>
            <span style="color:var(--sub)">›</span>
          </div>
        </div>
        <p style="font-size:12px;color:var(--sub);line-height:1.7;margin-top:12px">PaMarket operates as a platform for user-generated listings. We do not own, sell, or warrant any items listed. Users are responsible for ensuring their listings comply with applicable Zimbabwean law. Prohibited content will be removed and accounts suspended.</p>

        ${sec('Contact Us')}
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;overflow:hidden">
          <a href="mailto:chakusaprince@gmail.com" style="display:flex;align-items:center;gap:14px;padding:14px 16px;text-decoration:none;border-bottom:1px solid var(--border)">
            <div style="width:36px;height:36px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div>
              <div style="font-size:11px;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Support Email</div>
              <div style="font-size:13px;font-weight:700;color:#1A3A8F;margin-top:2px">chakusaprince@gmail.com</div>
            </div>
          </a>
          <a href="https://wa.me/971589772645" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:14px;padding:14px 16px;text-decoration:none">
            <div style="width:36px;height:36px;border-radius:10px;background:#E8FFF2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            </div>
            <div>
              <div style="font-size:11px;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.5px">WhatsApp Support</div>
              <div style="font-size:13px;font-weight:700;color:#25D366;margin-top:2px">+971 589 772 645</div>
            </div>
          </a>
        </div>

        <div style="text-align:center;padding:32px 0 8px">
          <div style="font-size:12px;color:var(--sub)">© ${year} PaMarket · Made in Zimbabwe 🇿🇼</div>
          <div style="font-size:11px;color:var(--text-hint,#bbb);margin-top:4px">Version 2.0.0 · Built with care for Zimbabwe</div>
        </div>
      </div>
    </div>`;
  };

})(window.H = window.H || {});

H.pages.LegalHub = function() {
  var sections = [
    { title: 'Terms', items: ['Terms of Use','Acceptable Use Policy','Seller Terms','Buyer Protection','Boost Terms'] },
    { title: 'Privacy', items: ['Privacy Policy','Cookie Policy','Data Deletion','GDPR Compliance'] },
    { title: 'Platform Policies', items: ['Community Guidelines','Prohibited Items','Anti-Fraud Policy','Dispute Resolution'] }
  ];
  var emailLink = 'mailto:chakusaprince@gmail.com';
  var waLink = 'https://wa.me/971589772645';
  var html = '<div class="page active">' + H.innerTopbar('Legal Hub');
  html += '<div class="legal-hero"><div class="legal-hero-title">Welcome to<br><strong>PaMarket Legal Hub</strong></div><div class="legal-hero-sub">Legal information for PaMarket products and services</div></div>';
  sections.forEach(function(sec) {
    html += '<div class="legal-section-title">' + sec.title + '</div><div class="legal-list">';
    sec.items.forEach(function(item) { html += '<div class="legal-item"><div class="legal-item-title">' + item + '</div><div class="legal-item-arrow">&rsaquo;</div></div>'; });
    html += '</div>';
  });
  html += '<div class="legal-contact"><div class="legal-contact-title">Need to contact us?</div>';
  html += '<div class="legal-contact-body">Email: <span onclick="window.open(emailLink)" style="color:#1A3A8F;font-weight:600;cursor:pointer">chakusaprince@gmail.com</span></div>';
  html += '<div class="legal-contact-body" style="margin-top:6px">WhatsApp: <span onclick="window.open(waLink)" style="color:#25D366;font-weight:600;cursor:pointer">+971 589 772 645</span></div>';
  html += '</div>';
  html += '<div class="legal-footer"><div class="legal-footer-links">';
  ['About Us','Advertise','Terms of Use','Privacy Policy'].forEach(function(l) { html += '<span class="legal-footer-link" onclick="H.openInner(\x27About\x27)">' + l + '</span>'; });
  html += '</div><div class="legal-footer-copy">PaMarket &copy; 2026 &middot; Zimbabwe\'s #1 Free Marketplace</div></div>';
  html += '</div></div>';
  return html;
};
;/* === www/js/moderation.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {

  // -- BANNED WORDS -------------------------------------------
  const BANNED = [
    'crypto','bitcoin','investment scheme','send money first',
    'western union','moneygram','wire transfer','advance fee',
    'nude','xxx','escort','adult only','whatsapp only no calls',
    'guaranteed returns','double your money','mlm','pyramid'
  ];

  // -- CATEGORY RISK ------------------------------------------
  const RISK = {
    jobs: 'high', rentals: 'high', property: 'high',
    vehicles: 'medium', services: 'medium',
    electronics: 'low', furniture: 'low',
    fashion: 'low', agriculture: 'low',
    pets: 'low', other: 'low'
  };

  // -- TRUST SCORE --------------------------------------------
  H.getTrustScore = function (user) {
    let score = 50;
    if (user.verified)                    score += 20;
    if (user.email)                       score += 10;
    const reports = (H.state.reports || []).filter(r => r.targetId === user.id).length;
    const rejected = (H.state.listings || []).filter(l => l.sellerId === user.id && l.status === 'rejected').length;
    score -= reports * 10;
    score -= rejected * 5;
    const approved = (H.state.listings || []).filter(l => l.sellerId === user.id && l.status === 'active').length;
    score += Math.min(approved * 3, 20);
    return Math.max(0, Math.min(100, score));
  };

  // -- MODERATION ENGINE --------------------------------------
  H.moderateListing = function (listing, user) {
    const text = (listing.title + ' ' + listing.desc).toLowerCase();

    // 1. Banned word check
    for (const w of BANNED) {
      if (text.includes(w)) {
        return { status: 'rejected', reason: 'Content violates community guidelines: banned terms detected.' };
      }
    }

    // 2. Duplicate check
    const duplicate = (H.state.listings || []).find(l =>
      l.sellerId === user.id &&
      l.title.toLowerCase() === listing.title.toLowerCase() &&
      l.status !== 'rejected' && l.id !== listing.id
    );
    if (duplicate) {
      return { status: 'rejected', reason: 'Duplicate listing detected. Please edit your existing ad instead.' };
    }

    // 3. Spam check — more than 5 posts in last 24h
    const last24h = Date.now() - 86400000;
    const recentPosts = (H.state.listings || []).filter(l =>
      l.sellerId === user.id && l.createdAt > last24h
    ).length;
    if (recentPosts >= 5) {
      return { status: 'rejected', reason: 'Too many listings posted today. Please wait 24 hours.' };
    }

    // 4. Risk scoring
    const risk = RISK[listing.cat] || 'low';
    const trust = H.getTrustScore(user);

    // High trust users skip review
    if (trust >= 70) {
      return { status: 'active', reason: null };
    }

    if (risk === 'high') {
      return { status: 'pending', reason: 'This category requires admin review before going live.' };
    }
    if (risk === 'medium') {
      listing.flaggedForReview = true;
      return { status: 'active', reason: null };
    }

    // low risk — publish immediately
    return { status: 'active', reason: null };
  };

  // -- REPORT THRESHOLD ---------------------------------------
  H.checkReportThreshold = function (listingId) {
    const count = (H.state.reports || []).filter(
      r => r.targetId === listingId && r.targetType === 'listing' && r.status === 'open'
    ).length;
    if (count >= 3) {
      const l = (H.state.listings || []).find(x => x.id === listingId);
      if (l && l.status === 'active') {
        l.status = 'flagged';
        H.saveState();
        return true;
      }
    }
    return false;
  };

  // -- CHAT SPAM DETECTION ------------------------------------
  H.isChatSpam = function (convoId, userId) {
    const c = (H.state.conversations || []).find(x => x.id === convoId);
    if (!c) return false;
    const last10s = Date.now() - 10000;
    const recent = c.messages.filter(m => m.from === userId && m.t > last10s).length;
    return recent >= 5;
  };

  H.containsLink = function (text) {
    return /https?:\/\/|www\.|\.com|\.net|\.org|bit\.ly|wa\.me/i.test(text);
  };

  // -- DAILY HEALTH CHECK -------------------------------------
  H.runDailyHealthCheck = function () {
    const listings = H.state.listings || [];

    // Auto-hide listings with 3+ reports
    listings.forEach(l => {
      if (l.status === 'active') H.checkReportThreshold(l.id);
    });

    // Remove expired boosts
    listings.forEach(l => {
      if (l.boost && l.boost.until < Date.now()) l.boost = null;
    });

    H.saveState();
  };

  // Run health check once on load
  window.addEventListener("load", () => setTimeout(() => { if (H.state) H.runDailyHealthCheck(); }, 3000));

})(window.H = window.H || {});



;/* === www/js/categories.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
// ── Shared filter infrastructure for all category pages ────
(function (H) {

  H._filters = {};
  H._currentTalentSector = 'All';

  function getF(id) { return H._filters[id] || (H._filters[id] = {}); }

  H._setFilter = function (catId, key, val) {
    getF(catId)[key] = val;
    H._applyFilters(catId);
  };

  H._toggleFilters = function (catId) {
    var fp = document.getElementById('fp_' + catId);
    if (fp) fp.style.display = fp.style.display === 'none' ? 'block' : 'none';
  };

  H._clearFilters = function (catId) {
    H._filters[catId] = {};
    var fp = document.getElementById('fp_' + catId);
    if (fp) {
      fp.querySelectorAll('select').forEach(function (s) { s.value = ''; });
      fp.querySelectorAll('input[type=number],input[type=text]').forEach(function (i) { i.value = ''; });
    }
    H._applyFilters(catId);
  };

  H._applyFilters = function (catId) {
    var el = document.getElementById('cl_' + catId);
    if (!el) return;
    var f = getF(catId);
    var baseCat = catId.replace('_sale', '').replace('_rent', '');
    var all = (H.state.listings || []).filter(function (l) {
      return l.status === 'active' && l.cat === baseCat;
    });
    if (catId === 'property_sale') all = all.filter(function (l) { return !l.rentalType; });
    if (catId === 'property_rent') all = all.filter(function (l) { return !!l.rentalType; });

    var inp = document.getElementById('cs_' + catId);
    var q = inp ? inp.value.toLowerCase().trim() : '';
    if (q) all = all.filter(function (l) {
      return (l.title + ' ' + (l.desc || '') + ' ' + (l.city || '') + ' ' + (l.suburb || '')).toLowerCase().includes(q);
    });

    if (f.priceMin) all = all.filter(function (l) { return (l.price || 0) >= +f.priceMin; });
    if (f.priceMax) all = all.filter(function (l) { return (l.price || 0) <= +f.priceMax; });
    if (f.city && f.city !== 'all') all = all.filter(function (l) { return (l.city + ' ' + (l.prov || '')).toLowerCase().includes(f.city.toLowerCase()); });
    if (f.condition && f.condition !== 'all') all = all.filter(function (l) { return (l.condition || '').toLowerCase() === f.condition; });
    if (f.furnishing && f.furnishing !== 'all') all = all.filter(function (l) { return (l.furnishing || '').toLowerCase() === f.furnishing; });
    if (f.propType && f.propType !== 'all') all = all.filter(function (l) { return (l.propType || '').toLowerCase() === f.propType; });
    if (f.rentalType && f.rentalType !== 'all') all = all.filter(function (l) { return (l.rentalType || '').toLowerCase() === f.rentalType; });
    if (f.beds && f.beds !== 'any') all = all.filter(function (l) { return +(l.beds || 0) >= +f.beds; });
    if (f.baths && f.baths !== 'any') all = all.filter(function (l) { return +(l.baths || 0) >= +f.baths; });
    if (f.subcat && f.subcat !== 'all') all = all.filter(function (l) { return (l.subcat || l.type || '').toLowerCase() === f.subcat; });
    if (f.brand) all = all.filter(function (l) { return (l.brand || l.make || '').toLowerCase().includes(f.brand.toLowerCase()); });
    if (f.gender && f.gender !== 'all') all = all.filter(function (l) { return (l.gender || '').toLowerCase() === f.gender; });
    if (f.size && f.size !== 'all') all = all.filter(function (l) { return (l.size || '').toLowerCase() === f.size; });
    if (f.fuelType && f.fuelType !== 'all') all = all.filter(function (l) { return (l.fuelType || '').toLowerCase() === f.fuelType; });
    if (f.yearMin) all = all.filter(function (l) { return +(l.year || 0) >= +f.yearMin; });
    if (f.yearMax) all = all.filter(function (l) { return +(l.year || 9999) <= +f.yearMax; });

    var sort = f.sort || 'newest';
    all.sort(function (a, b) {
      var ba = (a.boost && a.boost.until > Date.now()) ? 1 : 0;
      var bb = (b.boost && b.boost.until > Date.now()) ? 1 : 0;
      if (ba !== bb) return bb - ba;
      if (sort === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sort === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sort === 'oldest') return a.createdAt - b.createdAt;
      return b.createdAt - a.createdAt;
    });

    var spotlightHtml = (function(){
      var now = Date.now();
      var spot = (H.state.paidAds||[]).find(function(a){
        return a.type==='spotlight' && a.active && a.endsAt > now && (a.targetCat===catId || a.targetCat===baseCat);
      });
      if (!spot) return '';
      if(H.trackAdImpression) H.trackAdImpression(spot.id);
      var tap = spot.linkUrl ? 'onclick="H.trackAdClick(' + JSON.stringify(spot.id) + ',' + JSON.stringify(spot.linkUrl) + ')"' : '';
      return '<div ' + tap + ' style="display:flex;align-items:center;gap:14px;background:' + H.escHtml(spot.bgColor||'#EFF6FF') + ';border:1.5px solid ' + H.escHtml(spot.borderColor||'rgba(26,58,143,0.2)') + ';border-radius:14px;padding:14px 16px;margin-bottom:12px;cursor:' + (spot.linkUrl?'pointer':'default') + ';position:relative">'
        + (spot.imageUrl ? '<img src="' + H.escHtml(spot.imageUrl) + '" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0" onerror="this.onerror=null;this.style.display=\'none\'">' : '')
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:800;color:#1A3A8F;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(spot.businessName) + '</div>'
        + (spot.tagline ? '<div style="font-size:12px;color:var(--sub);margin-top:2px">' + H.escHtml(spot.tagline) + '</div>' : '')
        + '</div>'
        + '<span style="font-size:9px;font-weight:700;color:#1A3A8F;background:rgba(26,58,143,0.1);padding:2px 6px;border-radius:6px;flex-shrink:0">SPONSORED</span>'
        + '</div>';
    })();

    el.innerHTML = all.length
      ? spotlightHtml + '<div class="listing-list">' + all.map(H.renderListCard).join('') + '</div>'
      : spotlightHtml + H.emptyState('No listings match', 'Try adjusting your filters', null, null);

    var cnt = document.getElementById('cc_' + catId);
    if (cnt) cnt.textContent = all.length + ' listing' + (all.length !== 1 ? 's' : '');

    // update filter badge
    var n = Object.keys(getF(catId)).filter(function (k) {
      var v = getF(catId)[k]; return v && v !== '' && v !== 'all' && v !== 'any' && v !== 'newest';
    }).length;
    var b = document.getElementById('fb_' + catId);
    if (b) { b.textContent = n || ''; b.style.display = n ? 'flex' : 'none'; }
  };

  // ── UI builder helpers (attached to H so separate files can use them) ──
  var ZW_CITIES = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Kwekwe', 'Kadoma', 'Masvingo', 'Chinhoyi', 'Bindura', 'Marondera', 'Hwange', 'Victoria Falls', 'Zvishavane'];
  H._ZW_CITIES = ZW_CITIES;

  H._sel = function (id, key, label, opts) {
    var html = '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">' + label + '</div>';
    html += '<select onchange="H._setFilter(\'' + id + '\',\'' + key + '\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none">';
    opts.forEach(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      html += '<option value="' + H.escHtml(v) + '">' + H.escHtml(t) + '</option>';
    });
    return html + '</select></div>';
  };

  H._priceRange = function (id) {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
      + '<div><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Min Price ($)</div>'
      + '<input type="number" min="0" placeholder="0" oninput="H._setFilter(\'' + id + '\',\'priceMin\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + '<div><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Max Price ($)</div>'
      + '<input type="number" min="0" placeholder="Any" oninput="H._setFilter(\'' + id + '\',\'priceMax\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>'
      + '</div>';
  };

  H._citysel = function (id) {
    return H._sel(id, 'city', 'Location', [['all', 'All Zimbabwe']].concat(ZW_CITIES.map(function (c) { return [c, c]; })));
  };

  H._sortsel = function (id) {
    return H._sel(id, 'sort', 'Sort By', [['newest', 'Newest First'], ['oldest', 'Oldest First'], ['price_asc', 'Price: Low → High'], ['price_desc', 'Price: High → Low']]);
  };

  H._txtInput = function (id, key, label, placeholder) {
    return '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">' + label + '</div>'
      + '<input type="text" placeholder="' + H.escHtml(placeholder) + '" oninput="H._setFilter(\'' + id + '\',\'' + key + '\',this.value)" style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box"></div>';
  };

  H._catHeader = function (id, name, color, filterHtml) {
    var dark = ['#1A3A8F','#e53935','#8E24AA','#00838F','#388E3C','#6D4C41','#FB8C00','#E91E63','#546E7A','#00897B','#F06292'].indexOf(color) > -1;
    var tc = dark ? '#fff' : '#1A3A8F', sc = dark ? 'rgba(255,255,255,.65)' : 'rgba(26,58,143,.7)';
    var sbg = dark ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.9)', sclr = dark ? '#fff' : '#1A3A8F';
    return '<div style="background:' + color + ';padding:0 12px 12px">'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<div style="background:' + sbg + ';border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px;flex:1">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + (dark ? 'rgba(255,255,255,.7)' : '#999') + '" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="cs_' + id + '" placeholder="Search ' + H.escHtml(name) + '…" autocomplete="off" oninput="H._applyFilters(\'' + id + '\')" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:' + sclr + ';font-family:Inter,sans-serif;caret-color:#F5A623"></div>'
      + '<button onclick="H._toggleFilters(\'' + id + '\')" style="background:rgba(255,255,255,.2);border:none;color:' + tc + ';padding:10px 12px;border-radius:12px;cursor:pointer;position:relative;display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>Filter'
      + '<span id="fb_' + id + '" style="display:none;background:#F5A623;color:#1A3A8F;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px"></span></button>'
      + '</div>'
      + '<div style="color:' + sc + ';font-size:12px;font-weight:600;margin-top:8px;padding:0 2px"><span id="cc_' + id + '">…</span></div>'
      + '</div>'
      + '<div id="fp_' + id + '" style="display:none;background:var(--card);border-bottom:2px solid ' + color + ';padding:16px 14px">'
      + filterHtml
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button onclick="H._clearFilters(\'' + id + '\')" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer">Clear</button>'
      + '<button onclick="H._toggleFilters(\'' + id + '\')" style="flex:2;padding:10px;background:' + color + ';border:none;border-radius:10px;font-size:13px;font-weight:700;color:' + tc + ';cursor:pointer">Apply Filters</button>'
      + '</div></div>';
  };

  H._catTopbar = function (title, color) {
    return '<div class="det-topbar" style="background:' + (color || '#1A3A8F') + '">'
      + '<button class="back" onclick="H.goBack()" style="color:#fff"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#fff">' + H.escHtml(title) + '</div>'
      + '<button onclick="H.navTo(\'Post\')" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px;white-space:nowrap">+ Post</button>'
      + '</div>';
  };

  // ── Override filterByCat for all 12 categories ────────────
  H.filterByCat = function (cid) {
    var map = {
      property: 'Property', vehicles: 'Vehicles', rooms: 'Rooms',
      electronics: 'Electronics', furniture: 'Furniture', fashion: 'Fashion',
      services: 'Services', jobs: 'Jobs', agriculture: 'Agriculture',
      pets: 'Pets', kids: 'Kids', other: 'Other'
    };
    var page = map[cid];
    if (page) { H.openInner(page, { cid: cid }); }
    else { H.openInner('CategoryView', { cid: cid }); }
  };

  // legacy compat
  H._catSearch = function (q, catId) { H._applyFilters(catId); };

})(window.H);

;/* === www/js/agriculture.js === */
'use strict';
(function (H) {

  H.pages.Agriculture = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'agriculture'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('agriculture', 'subcat', 'Category', [['all', 'All'], ['livestock', 'Livestock & Animals'], ['crops', 'Crops & Produce'], ['equipment', 'Farm Equipment & Tools'], ['seeds', 'Seeds & Seedlings'], ['land', 'Agricultural Land'], ['inputs', 'Fertilisers & Chemicals'], ['irrigation', 'Irrigation Systems'], ['poultry', 'Poultry'], ['dairy', 'Dairy Products'], ['other', 'Other']])
      + H._sel('agriculture', 'condition', 'Condition', [['all', 'All'], ['new', 'New'], ['used', 'Used'], ['good', 'Good Condition']])
      + H._citysel('agriculture') + H._priceRange('agriculture') + H._sortsel('agriculture');

    return '<div class="page active">'
      + H._catTopbar('Agriculture', '#388E3C')
      + H._catHeader('agriculture', 'Agriculture', '#388E3C', f)
      + '<div id="cl_agriculture" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No agriculture listings', 'Buy & sell farm products!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Agriculture_after = function () { H._applyFilters('agriculture'); };

})(window.H);

;/* === www/js/kids.js === */
'use strict';
(function (H) {

  H.pages.Kids = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'kids'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('kids', 'subcat', 'Category', [['all', 'All'], ['clothing', 'Clothing & Shoes'], ['toys', 'Toys & Games'], ['furniture', 'Baby Furniture & Gear'], ['feeding', 'Feeding & Nursing'], ['education', 'Books & Education'], ['strollers', 'Strollers & Car Seats'], ['electronics', 'Kids Electronics'], ['other', 'Other']])
      + H._sel('kids', 'gender', 'For', [['all', 'All'], ['boys', 'Boys'], ['girls', 'Girls'], ['unisex', 'Unisex'], ['baby', 'Baby (0-2yr)']])
      + H._sel('kids', 'condition', 'Condition', [['all', 'All'], ['new', 'Brand New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('kids') + H._priceRange('kids') + H._sortsel('kids');

    return '<div class="page active">'
      + H._catTopbar('Baby & Kids', '#E91E63')
      + H._catHeader('kids', 'Baby & Kids', '#E91E63', f)
      + '<div id="cl_kids" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No kids items listed', 'Great deals for little ones!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Kids_after = function () { H._applyFilters('kids'); };

})(window.H);

;/* === www/js/pets.js === */
'use strict';
(function (H) {

  H.pages.Pets = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'pets'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('pets', 'subcat', 'Pet Type', [['all', 'All'], ['dogs', 'Dogs'], ['cats', 'Cats'], ['birds', 'Birds'], ['fish', 'Fish & Aquatic'], ['rabbits', 'Rabbits & Small Animals'], ['reptiles', 'Reptiles'], ['livestock', 'Livestock'], ['other', 'Other']])
      + H._txtInput('pets', 'brand', 'Breed', 'e.g. German Shepherd, Persian Cat')
      + H._citysel('pets') + H._priceRange('pets') + H._sortsel('pets');

    return '<div class="page active">'
      + H._catTopbar('Pets', '#FB8C00')
      + H._catHeader('pets', 'Pets', '#FB8C00', f)
      + '<div id="cl_pets" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No pets listed', 'Find your perfect companion!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Pets_after = function () { H._applyFilters('pets'); };

})(window.H);

;/* === www/js/other.js === */
'use strict';
(function (H) {

  H.pages.Other = function () {
    var ls = (H.state.listings || []).filter(function (l) { return l.status === 'active' && l.cat === 'other'; }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    var f = H._sel('other', 'subcat', 'Category', [['all', 'All'], ['antiques', 'Antiques & Collectibles'], ['sports', 'Sports & Fitness'], ['music', 'Musical Instruments'], ['books', 'Books & Magazines'], ['art', 'Art & Crafts'], ['tools', 'Tools & DIY'], ['health', 'Health & Beauty'], ['office', 'Office Supplies'], ['food', 'Food & Beverages'], ['other', 'Miscellaneous']])
      + H._sel('other', 'condition', 'Condition', [['all', 'All'], ['new', 'New'], ['like-new', 'Like New'], ['good', 'Good'], ['fair', 'Fair']])
      + H._citysel('other') + H._priceRange('other') + H._sortsel('other');

    return '<div class="page active">'
      + H._catTopbar('Other', '#546E7A')
      + H._catHeader('other', 'Other', '#546E7A', f)
      + '<div id="cl_other" style="padding-bottom:88px">'
      + (ls.length ? '<div class="listing-list">' + ls.map(H.renderListCard).join('') + '</div>' : H.emptyState('No listings yet', 'Post anything for sale!', 'Post an Ad', "H.navTo('Post')"))
      + '</div></div>';
  };

  H.pages.Other_after = function () { H._applyFilters('other'); };

})(window.H);

;/* === www/js/supabase.js === */
/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
// supabase.js "” safe Supabase client initialisation
(function () {
  // Make sure the CDN loaded
  if (!window.supabase) {
    console.warn('Supabase CDN not loaded · using mock client.');
    window.supabase = {
      createClient: function () {
        const noop = () => mockClient;
        const mockClient = {
          from: () => {
            console.warn('Supabase mock: operation skipped.');
            return mockClient;
          },
          select: noop,
          insert: noop,
          update: noop,
          delete: noop,
          eq: noop,
          order: noop,
          limit: noop,
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not loaded') }),
          then: (fn) => fn({ data: null, error: new Error('Supabase not loaded') })
        };
        return mockClient;
      }
    };
  }

  const supabaseUrl = window.SUPABASE_URL;
  const supabaseAnonKey = window.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials from supabase-config.js');
  }

  window.supabase = window.supabase.createClient(supabaseUrl || '', supabaseAnonKey || '');

  // Only handle OAuth callbacks — NOT regular page loads with stored sessions.
  // The app restores login state from H.loadState() (localStorage), not from here.
  var _isOAuthCallback = window.location.search.includes('code=') || window.location.hash.includes('access_token=');
  var _isPasswordReset = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
  var _oauthHandled = false;

  async function handleOAuthSession(session) {
    if (_oauthHandled) return;
    _oauthHandled = true;
    var user   = session.user;
    var userId = user.id;
    var meta   = user.user_metadata || {};
    var name   = meta.full_name || meta.name || user.email || 'User';
    var avatar = meta.avatar_url || meta.picture || null;
    var email  = user.email || '';
    try {
      var pr = await window.supabase.from('profiles').select('*').eq('id', userId).single();
      var profile = pr.data;
      if (!profile) {
        await window.supabase.from('profiles').upsert({ id: userId, name: name, avatar: avatar });
        profile = { id: userId, name: name, avatar: avatar, role: 'user', status: 'active', wallet_usd: 0, verified: false };
      }
      var attempts = 0;
      var trySetup = function() {
        if (!window.H || !window.H.state || typeof window.H.navTo !== 'function') {
          if (++attempts < 40) { setTimeout(trySetup, 200); return; }
          return;
        }
        var users = window.H.state.users = window.H.state.users || [];
        var existing = users.find(function(u){ return u.id === userId; });
        if (!existing) {
          users.push({ id: userId, email: email, name: profile.name || name, phone: profile.phone || '', avatar: profile.avatar || avatar, verified: !!profile.verified, walletUSD: parseFloat(profile.wallet_usd) || 0, language: 'English', joinedAt: new Date(profile.created_at || Date.now()).getTime(), role: profile.role || 'user', status: profile.status || 'active', banReason: null, banUntil: null, blocked: [] });
        } else {
          existing.name = profile.name || existing.name;
          existing.avatar = profile.avatar || existing.avatar;
          existing.role = profile.role || existing.role;
          existing.verified = !!profile.verified;
          existing.walletUSD = parseFloat(profile.wallet_usd) || existing.walletUSD || 0;
        }
        window.H.state.currentUserId = userId;
        if (typeof window.H.saveState === 'function') window.H.saveState();
        if (typeof window.H.closeLoginModal === 'function') window.H.closeLoginModal();
        var nav = document.getElementById('bottomNav');
        if (nav) nav.style.display = 'flex';
        window.H.navTo('Home');
        window.H.toast('Welcome, ' + (profile.name || name) + '!');
        if (typeof window.H.startRealtime === 'function') window.H.startRealtime();
      };
      trySetup();
    } catch(e) { console.warn('OAuth login handler:', e); }
  }

  window.supabase.auth.onAuthStateChange(async function(event, session) {
    // Password reset link clicked — show the set-new-password form
    if (event === 'PASSWORD_RECOVERY') {
      var waitH = function(attempts) {
        if (!window.H || typeof window.H.authShowSetPassword !== 'function') {
          if (attempts < 40) setTimeout(function(){ waitH(attempts + 1); }, 200);
          return;
        }
        window.H.authShowSetPassword();
      };
      waitH(0);
      return;
    }
    if (event !== 'SIGNED_IN' || !session || !session.user) return;
    if (!_isOAuthCallback) return;
    handleOAuthSession(session);
  });

  // Fallback getSession() only on actual OAuth callback pages
  if (_isOAuthCallback) {
    window.supabase.auth.getSession().then(function(result) {
      var session = result && result.data && result.data.session;
      if (session && session.user) handleOAuthSession(session);
    });
  }

  // Real-time sync — subscribes to live database changes
  window.H = window.H || {};
  window.H.startRealtime = function() {
    var sb = window.supabase;
    if (!sb || !sb.channel) return;
    if (window._realtimeStarted) return;
    window._realtimeStarted = true;

    // Listings channel
    sb.channel('rt-listings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' }, function(payload) {
        var row = payload.new;
        if (!row || !window.H || !window.H.state) return;
        var existing = (window.H.state.listings || []).find(function(l){ return l.id === row.id; });
        if (!existing) {
          window.H.state.listings = window.H.state.listings || [];
          window.H.state.listings.unshift({
            id: row.id, title: row.title || '', desc: row.description || '',
            price: row.price || 0, currency: row.currency || 'USD',
            cat: row.category || '', photos: row.photos || [],
            sellerId: row.seller_id || '', sellerName: row.seller_name || '',
            province: row.province || '', status: row.status || 'active',
            createdAt: new Date(row.created_at || Date.now()).getTime(),
            views: 0, company: row.company || null
          });
          if (typeof window.H.saveState === 'function') window.H.saveState();
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'listings' }, function(payload) {
        var id = payload.old && payload.old.id;
        if (!id || !window.H || !window.H.state) return;
        window.H.state.listings = (window.H.state.listings || []).filter(function(l){ return l.id !== id; });
        if (typeof window.H.saveState === 'function') window.H.saveState();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings' }, function(payload) {
        var row = payload.new;
        if (!row || !window.H || !window.H.state) return;
        var l = (window.H.state.listings || []).find(function(x){ return x.id === row.id; });
        if (l) {
          l.status = row.status || l.status;
          l.title  = row.title  || l.title;
          l.price  = row.price  != null ? row.price : l.price;
          if (typeof window.H.saveState === 'function') window.H.saveState();
        }
      })
      .subscribe();

    // Wallet top-up approvals channel
    sb.channel('rt-topup')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'topup_requests' }, function(payload) {
        var row = payload.new;
        if (!row || !window.H || !window.H.state) return;
        var req = (window.H.state.topupRequests || []).find(function(r){ return r.reference === row.reference; });
        if (req && row.status === 'approved') {
          req.status = 'approved';
          var u = window.H.currentUser && window.H.currentUser();
          if (u && u.id === req.userId) {
            u.walletUSD = +((u.walletUSD || 0) + (req.amount || 0)).toFixed(2);
            window.H.state.txns = window.H.state.txns || [];
            window.H.state.txns.unshift({ id: window.H.uid(), userId: u.id, type: 'topup', amt: req.amount, t: Date.now(), note: 'Wallet Top Up · ' + req.method });
            if (typeof window.H.saveState === 'function') window.H.saveState();
            if (typeof window.H.toast === 'function') window.H.toast('Wallet credited $' + req.amount.toFixed(2) + '!');
          }
        }
      })
      .subscribe();

    // Profile verification approvals
    sb.channel('rt-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, function(payload) {
        var row = payload.new;
        if (!row || !window.H || !window.H.state) return;
        var u = (window.H.state.users || []).find(function(x){ return x.id === row.id; });
        if (u) {
          var wasUnverified = !u.verified;
          u.verified = !!row.verified;
          u.role     = row.role || u.role;
          u.walletUSD = row.wallet_usd != null ? parseFloat(row.wallet_usd) : u.walletUSD;
          if (typeof window.H.saveState === 'function') window.H.saveState();
          if (wasUnverified && u.verified && u.id === (window.H.state.currentUserId)) {
            if (typeof window.H.toast === 'function') window.H.toast('Your identity has been verified!');
          }
        }
      })
      .subscribe();
  };
})();
