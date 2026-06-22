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
    'Harare': [
      'Harare CBD','The Avenues','Kopje','Graniteside','Workington','Southerton','Ardbennie','Willowvale',
      'Alexandra Park','Arcadia','Arundel','Ashdown Park','Athlone',
      'Avondale','Avondale West','Avonlea',
      'Ballantyne Park','Belgravia','Belvedere','Beverley','Bloomingdale','Bluff Hill','Borrowdale','Borrowdale Brooke','Borrowdale West','Braeside',
      'Budiriro','Budiriro 2','Budiriro 4','Budiriro 5',
      'Chadcombe','Chisipite','Churchill','Cold Comfort','Colne Valley','Cranborne','Crowborough',
      'Dawn Hill','Donnybrook','Dzivarasekwa','Dzivarasekwa Extension',
      'Eastlea','Eastlea South','Emerald Hill','Epworth',
      'Forestvale',
      'Glen Lorne','Glen Norah','Glen View','Glenora','Graniteside','Greencroft','Greendale','Greenspan','Greystone Park','Gun Hill',
      'Handsworth','Harare North','Hatcliffe','Hatfield','Helensvale','Highfield','Highlands','Homefield','Hopley','Houghton Park',
      'Kambuzuma','Kopje','Kuwadzana','Kuwadzana Extension','Kuwadzana 3','Kuwadzana 4','Kuwadzana 5',
      'Lakeside','Lochinvar',
      'Mabelreign','Mabvuku','Mandara','Marimba Park','Marlborough','Mbare','Meyrick Park','Milton Park','Monovale','Mount Hampden','Mount Pleasant','Msasa','Msasa Park','Mufakose',
      'New Marlborough','Norton',
      'Pomona','Prospect','Queensdale',
      'Rhodesville','Rolf Valley','Rugare','Ruwa',
      'Southerton','Strathaven','Sunningdale',
      'Tafara','Tynwald','Tynwald South',
      'Vainona',
      'Warren Park','Warren Park D','Warren Park North','Waterfalls','Waterford','Waterlea','Willowvale','Workington',
      'Zimre Park',
      'Chitungwiza - Unit A','Chitungwiza - Unit B','Chitungwiza - Unit C','Chitungwiza - Unit D',
      'Chitungwiza - Unit E','Chitungwiza - Unit F','Chitungwiza - Unit G','Chitungwiza - Unit H',
      'Chitungwiza - Unit J','Chitungwiza - Unit K',
      'Chitungwiza - St Marys','Chitungwiza - Zengeza 1','Chitungwiza - Zengeza 2',
      'Chitungwiza - Zengeza 3','Chitungwiza - Zengeza 4','Chitungwiza - Makoni','Chitungwiza - Seke'
    ],
    'Bulawayo': [
      'Bulawayo CBD','Civic Centre','North End',
      'Ascot','Bellevue','Belmont','Belmont East','Burnside',
      'Cowdray Park','Donnington',
      'Emakhandeni','Emganwini','Enqameni','Entumbane',
      'Famona',
      'Gwabalanda',
      'Hillcrest','Hillside','Hillside East','Hillside South','Hyde Park',
      'Ilanda','Iminyela','Induna',
      'Kelvin','Kelvin East','Kelvin North','Khumalo','Killarney','Kumalo','Kumalo North',
      'Lobengula','Lobenvale','Luveve',
      'Mabutweni','Magwegwe','Makokoba','Malindela','Malvern','Manningdale','Matsheumhlope','Matshobana','Montrose','Mpopoma','Mzilikazi',
      'Newlands','Newton','Newton West','Nketa','Njube','Nkulumane',
      'Orange Grove',
      'Paddonhurst','Parklands','Parktown','Parkview','Pelandaba','Pumula','Pumula South',
      'Queenspark',
      'Raylton','Richmond','Riverside','Runnivale',
      'Sauerstown','Selborne','Sizinda','Southdale','Southwold','Steeldale','Suburbs','Sunninghill','Sunnyside',
      'Thorngrove','Trenance','Tshabalala',
      'Umguza','Umwinsidale',
      'Westwood','Woodville',
      'Plumtree'
    ],
    'Manicaland': [
      'Mutare CBD','Dangamvura','Sakubva','Chikanga','Hobhouse','Yeovil',
      'Chipinge','Chimanimani',
      'Rusape','Odzi','Nyazura',
      'Nyanga','Juliasdale',
      'Birchenough Bridge','Headlands','Penhalonga',
      'Mutasa','Buhera','Hauna','Manica','Mutambara'
    ],
    'Mashonaland West': [
      'Chinhoyi','Chegutu','Chakari',
      'Kadoma','Ngezi',
      'Karoi','Kariba',
      'Norton','Banket','Glendale',
      'Mhangura','Murombedzi','Makonde','Zvimba','Raffingora','Sanyati'
    ],
    'Mashonaland East': [
      'Marondera','Murewa','Mutoko',
      'Wedza','Hwedza','Chivhu',
      'Goromonzi','Chikomba',
      'Ruwa','Macheke','Seke','Mudzi','Sadza'
    ],
    'Mashonaland Central': [
      'Bindura','Concession','Shamva','Glendale',
      'Mt Darwin','Dotito',
      'Mvurwi','Guruve','Centenary','Rushinga','Mazowe'
    ],
    'Midlands': [
      'Gweru CBD','Gweru Mkoba','Gweru Mambo','Gweru Ascot',
      'Kwekwe','Redcliff',
      'Zvishavane','Shurugwi',
      'Gokwe','Gokwe South',
      'Lalapanzi','Mvuma','Shangani','Mberengwa','Silobela','Chirumanzu'
    ],
    'Masvingo': [
      'Masvingo CBD','Rujeko','Mucheke',
      'Chiredzi','Triangle',
      'Gutu','Bikita','Zaka',
      'Mwenezi','Ngundu',
      'Mashava','Buchwa'
    ],
    'Matabeleland North': [
      'Hwange CBD','Hwange Colliery','Chinotimba',
      'Victoria Falls',
      'Lupane','Nkayi',
      'Binga','Dete','Kamativi',
      'Tsholotsho','Umguza','Inyati'
    ],
    'Matabeleland South': [
      'Gwanda','Filabusi',
      'Beitbridge',
      'Plumtree','Insiza',
      'Matobo','Kezi',
      'Esigodini','West Nicholson','Colleen Bawn',
      'Umzingwane'
    ]
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
    {id:'property',    name:'Property',    icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>'},
    {id:'vehicles',    name:'Vehicles',    icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 11l1.5-4A2 2 0 0 1 8.4 6h7.2a2 2 0 0 1 1.9 1.3L19 11h.5a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H20a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H3.5a1 1 0 0 1-1-1v-3a2 2 0 0 1 2-2z"/><circle cx="6.5" cy="16.5" r="1.6" fill="#fff"/><circle cx="17.5" cy="16.5" r="1.6" fill="#fff"/></svg>'},
    {id:'rooms',       name:'Rooms',       icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2 16h20v3h-1.6v-1.4H3.6V19H2z"/><path d="M3 15v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3z"/><rect x="4.6" y="11" width="5.2" height="3" rx="1.3" fill="#fff" opacity=".75"/></svg>'},
    {id:'electronics', name:'Electronics', icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><rect x="5" y="6.3" width="14" height="7.9" rx="1" fill="#fff" opacity=".9"/><path d="M8 20h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'},
    {id:'jobs',        name:'Jobs',        icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="3" y="7.5" width="18" height="12" rx="2.2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="3" y="11" width="18" height="2.4" fill="#fff" opacity=".55"/></svg>'},
    {id:'furniture',   name:'Furniture',   icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 10a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3H4z"/><path d="M3 12h18a1 1 0 0 1 1 1v4h-2v-2H4v2H2v-4a1 1 0 0 1 1-1z"/></svg>'},
    {id:'fashion',     name:'Fashion',     icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 3l3 2.5L15 3l5 3.5-2.5 3.5L16 9v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l-1.5.999L4 6.5z"/></svg>'},
    {id:'services',    name:'Services',    icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14.7 6.3a4 4 0 0 0-5.2 5.2l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.2-5.2l-2.3 2.3-2-2z"/></svg>'},
    {id:'agriculture', name:'Agriculture', icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 22c0-5 0-8 0-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 13c0-3-2-5-5-5-1 0-2 0-2 0s0 4 2.5 5.5S12 13 12 13z"/><path d="M12 11c0-3 2-5 5-5 1 0 2 0 2 0s0 4-2.5 5.5S12 11 12 11z"/></svg>'},
    {id:'pets',        name:'Pets',        icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="6" cy="9" r="2"/><circle cx="10.5" cy="6" r="2"/><circle cx="13.5" cy="6" r="2"/><circle cx="18" cy="9" r="2"/><path d="M12 11c-2.5 0-4.5 2-5 4-.4 1.6.8 3 2.4 3 .9 0 1.7-.4 2.6-.4s1.7.4 2.6.4c1.6 0 2.8-1.4 2.4-3-.5-2-2.5-4-5-4z"/></svg>'},
    {id:'kids',        name:'Baby & Kids', icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="7" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0 1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>'},
    {id:'other',       name:'Other',       icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="6" cy="6" r="2.4"/><circle cx="12" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="12" cy="12" r="2.4"/><circle cx="18" cy="12" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="12" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/></svg>'}
  ],

  state:            {},
  APP_VERSION:      '1.8.0',
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
    adminLogs:[], supportTickets:[], paidAds:[], deletedConvIds:[],
    deletedConvMeta:{},
    applications:[], contactRequests:[], savedCandidates:[], savedSearches:[],
    businesses:[], followedBusinesses:[]
  },

  loadState() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return JSON.parse(JSON.stringify(this.defaultState));
      const loaded = JSON.parse(raw);
      const base   = JSON.parse(JSON.stringify(this.defaultState));
      // Merge loaded fields onto defaults. Fields absent from the lean snapshot
      // (listings from other sellers, paidAds, etc.) fall back to empty arrays
      // from base and will be populated by the first cloud fetch.
      const merged = Object.assign(base, {
        currentUserId:   loaded.currentUserId || base.currentUserId,
        cityFilter:      loaded.cityFilter    || base.cityFilter,
        _sortMode:       loaded._sortMode     || base._sortMode,
        _priceMin:       loaded._priceMin     !== undefined ? loaded._priceMin : base._priceMin,
        _priceMax:       loaded._priceMax     !== undefined ? loaded._priceMax : base._priceMax,
        users:           Array.isArray(loaded.users)           ? loaded.users           : base.users,
        listings:        Array.isArray(loaded.listings)        ? loaded.listings        : base.listings,
        conversations:   Array.isArray(loaded.conversations)   ? loaded.conversations   : base.conversations,
        saves:           loaded.saves  && typeof loaded.saves  === 'object' ? loaded.saves  : base.saves,
        notifs:          loaded.notifs && typeof loaded.notifs === 'object' ? loaded.notifs : base.notifs,
        deletedConvIds:  Array.isArray(loaded.deletedConvIds)  ? loaded.deletedConvIds  : base.deletedConvIds,
        deletedConvMeta: loaded.deletedConvMeta && typeof loaded.deletedConvMeta === 'object' ? loaded.deletedConvMeta : {},
        applications:    Array.isArray(loaded.applications)    ? loaded.applications    : base.applications,
        contactRequests: Array.isArray(loaded.contactRequests) ? loaded.contactRequests : base.contactRequests,
        savedCandidates: Array.isArray(loaded.savedCandidates) ? loaded.savedCandidates : base.savedCandidates,
        savedSearches:   Array.isArray(loaded.savedSearches)   ? loaded.savedSearches   : base.savedSearches,
        followedBusinesses: Array.isArray(loaded.followedBusinesses) ? loaded.followedBusinesses : base.followedBusinesses,
        businesses:      Array.isArray(loaded.businesses)      ? loaded.businesses      : base.businesses,
      });
      merged._v = this.STATE_VERSION;
      return merged;
    } catch(e) { return JSON.parse(JSON.stringify(this.defaultState)); }
  },

  saveState() {
    try {
      const uid = this.state.currentUserId || null;

      // ── Lean snapshot: only what cannot be re-fetched from Supabase on boot ──
      // Excluded (always re-fetched): users (except self), listings (except own),
      // paidAds, adminLogs, supportTickets, reports, txns.
      const snap = {
        _v: this.STATE_VERSION,
        currentUserId: uid,
        cityFilter:  this.state.cityFilter  || 'All Zimbabwe',
        _sortMode:   this.state._sortMode   || 'newest',
        _priceMin:   this.state._priceMin   || '',
        _priceMax:   this.state._priceMax   || '',
        saves:              this.state.saves              || {},
        businesses:         this.state.businesses         || [],
        applications:       this.state.applications       || [],
        contactRequests:    this.state.contactRequests    || [],
        savedCandidates:    this.state.savedCandidates    || [],
        savedSearches:      this.state.savedSearches      || [],
        followedBusinesses: this.state.followedBusinesses || [],
        deletedConvIds:    (this.state.deletedConvIds    || []).slice(0, 300),
        deletedConvMeta:    this.state.deletedConvMeta   || {},
      };

      // Current user's profile only (needed for instant Account page render).
      const selfProfile = uid && (this.state.users || []).find(u => u.id === uid);
      if (selfProfile) {
        const su = Object.assign({}, selfProfile);
        delete su._localPassword;
        snap.users = [su];
      } else {
        snap.users = [];
      }

      // Current user's own listings only (all statuses: active, pending, sold, rejected).
      // Other users' listings are always re-fetched from Supabase on boot.
      if (uid && Array.isArray(this.state.listings)) {
        snap.listings = this.state.listings
          .filter(l => l.sellerId === uid)
          .map(l => {
            const lc = Object.assign({}, l);
            if (Array.isArray(lc.photos)) lc.photos = lc.photos.filter(p => typeof p === 'string' && !p.startsWith('data:'));
            return lc;
          });
      } else {
        snap.listings = [];
      }

      // Conversations: 50 most-recent, 30 messages each, no base64 images.
      if (Array.isArray(this.state.conversations)) {
        const sorted = this.state.conversations.slice().sort((a, b) => {
          const at = ((a.messages || []).slice(-1)[0] || {}).t || 0;
          const bt = ((b.messages || []).slice(-1)[0] || {}).t || 0;
          return bt - at;
        });
        snap.conversations = sorted.slice(0, 50).map(c => {
          const msgs = (c.messages || []).slice(-30).map(m => {
            if (m.image && typeof m.image === 'string' && m.image.startsWith('data:')) {
              const mc = Object.assign({}, m); delete mc.image; return mc;
            }
            return m;
          });
          return Object.assign({}, c, { messages: msgs });
        });
      } else {
        snap.conversations = [];
      }

      // Notifications: current user's only, latest 30.
      snap.notifs = {};
      if (uid && this.state.notifs && Array.isArray(this.state.notifs[uid])) {
        snap.notifs[uid] = this.state.notifs[uid].slice(0, 30);
      }

      // ── Write ──
      const _write = (obj) => localStorage.setItem(this.KEY, JSON.stringify(obj));
      try {
        _write(snap);
      } catch (e) {
        if (e.name !== 'QuotaExceededError') return;
        // Drop conversations and retry — they are fully re-synced from cloud.
        snap.conversations = [];
        snap.notifs = {};
        try { _write(snap); return; } catch(e2) { /* fall through */ }
        // Nuclear: bare preferences only.
        try { _write({ _v: this.STATE_VERSION, currentUserId: uid, cityFilter: snap.cityFilter, saves: snap.saves, users: snap.users }); } catch(e3) {}
      }
    } catch(e) { /* saveState must never propagate */ }
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
  // Scalloped azure verified seal with a bold white check (Instagram/Meta style)
  verifiedBadge(size) {
    const s = size || 14;
    return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" style="vertical-align:middle;flex-shrink:0" aria-label="Verified"><path fill="#00A0E9" d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.78-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z"/><path d="M9.6 12.3l1.9 1.9 4.1-5.1" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  },
  timeAgo(t) {
    const s = Math.floor((Date.now()-t)/1000);
    if (s<60)     return 'just now';
    if (s<3600)   return Math.floor(s/60)+'m ago';
    if (s<86400)  return Math.floor(s/3600)+'h ago';
    if (s<604800) return Math.floor(s/86400)+'d ago';
    return new Date(t).toLocaleDateString();
  },
  // Canonical USD rate (admin-set, loaded from app_settings into state.fxRate).
  fxRate() { const r = Number((this.state && this.state.fxRate) || 36); return r > 0 ? r : 36; },

  // Convert any stored amount to its canonical USD value. USD is the source of
  // truth; a ZiG amount is divided by the central rate. Legacy listings stored in
  // ZiG therefore display/compare correctly without a destructive migration.
  toUSD(p, c) {
    const n = Number(p) || 0;
    if (c === 'ZiG' || c === 'ZIG' || c === 'ZWG' || c === 'zig') return n / this.fxRate();
    return n; // USD (or unspecified) is already canonical
  },

  fmtPrice(p,c) {
    if (!p && p!==0) return '$0';
    const usd  = this.toUSD(p, c);
    const base = '$' + usd.toLocaleString(undefined, { maximumFractionDigits: 2 });
    // Optionally show the approximate ZiG value alongside (user preference).
    try {
      const u  = this.currentUser && this.currentUser();
      const ps = u && u.privacySettings;
      if (ps && ps.showZig && usd > 0) {
        return base + ' ≈ ' + Math.round(usd * this.fxRate()).toLocaleString() + ' ZiG';
      }
    } catch(e){}
    return base;
  },
  // Data-light mode: load category-icon placeholders instead of photos to save data.
  dataLight() {
    try { const u = this.currentUser && this.currentUser(); return !!(u && u.privacySettings && u.privacySettings.dataLight); } catch(e){ return false; }
  },

  filterListings(list, q) {
    const _H   = window.H;
    const _s   = _H ? _H.state : {};
    const qry  = (q!==undefined ? q : (document.getElementById('searchIn')?.value||'')).toLowerCase().trim();
    const pMin = parseFloat(_s._priceMin)||0;
    const pMax = parseFloat(_s._priceMax)||Infinity;
    const sort = _s._sortMode||'newest';
    const cats = (_H && _H.CATEGORIES) || [];
    const catName = (id) => { const c = cats.find(c => c.id === id); return c ? (c.name||'') : ''; };
    // Split the query into words so "hilux toyota" matches "Toyota Hilux" (each word
    // must appear somewhere), and search across title, description, location AND category.
    const tokens = qry ? qry.split(/\s+/).filter(Boolean) : [];
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const scored = [];
    for (const l of list) {
      if (_s.cityFilter && _s.cityFilter!=='All Zimbabwe') {
        if (!((l.city||'')+' '+(l.prov||'')).toLowerCase().includes(_s.cityFilter.toLowerCase())) continue;
      }
      if ((l.price||0)<pMin || (l.price||0)>pMax) continue;

      let score = 0;
      if (tokens.length) {
        const title = (l.title||'').toLowerCase();
        const hay = (title + ' ' + (l.desc||'') + ' ' + (l.city||'') + ' ' + (l.suburb||'') + ' '
                     + (l.prov||'') + ' ' + catName(l.cat) + ' ' + (l.condition||'')).toLowerCase();
        let ok = true;
        for (const t of tokens) {
          if (hay.indexOf(t) === -1) { ok = false; break; }       // every word must appear (AND)
          score += (title.indexOf(t) !== -1) ? 10 : 3;            // title hit > body hit
          if (new RegExp('\\b' + esc(t) + '\\b').test(title)) score += 5; // whole-word bonus
        }
        if (!ok) continue;
        if (title.indexOf(qry) !== -1) score += 25;               // exact phrase in title ranks top
      }
      scored.push({ l, score });
    }

    scored.sort((a, b) => {
      if (tokens.length && b.score !== a.score) return b.score - a.score; // relevance first when searching
      const x = a.l, y = b.l;
      if (sort==='oldest')     return x.createdAt-y.createdAt;
      if (sort==='price_asc')  return (x.price||0)-(y.price||0);
      if (sort==='price_desc') return (y.price||0)-(x.price||0);
      if (sort==='views')      return (y.views||0)-(x.views||0);
      return y.createdAt-x.createdAt;
    });
    return scored.map(s => s.l);
  },

  toast(msg, duration=4000, isError=false) {
    const el = document.getElementById('toastEl'); if(!el) return;
    el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    el.classList.toggle('toast-err', !!isError);
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
          ${confirmText?`<button class="modal-btn ${danger?'danger':'confirm'}" id="mConfirm">${confirmText}</button>`:''}
        </div>
      </div>`;
    bg.classList.add('open');
    const mConfirmBtn = document.getElementById('mConfirm');
    if (mConfirmBtn) {
      mConfirmBtn.onclick = () => {
        if (onConfirm && onConfirm()===false) return;
        H.closeModal();
      };
      setTimeout(()=>mConfirmBtn.focus({preventScroll:true}), 50);
    }
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
    var H = window.H;
    return `<div class="empty-state">
      <div class="empty-icon">${H.ICONS.search}</div>
      <div class="empty-title">${H.escHtml(title)}</div>
      <div class="empty-sub">${H.escHtml(sub)}</div>
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
    const photo  = (l.photos&&l.photos[0] && !H.dataLight())
      ? `<img src="${l.photos[0]}" alt="${H.escHtml(l.title)}" loading="lazy">`
      : `<div class="ph">${H.categoryIcon(l.cat)}</div>`;
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
            ${seller&&seller.verified?`<span class="blue-check" title="ID Verified">${H.verifiedBadge(15)}</span>`:''}
          </div>
        </div>
      </div>
    </div>`;
  },

  renderFeatCard(l) {
    const H     = window.H;
    const photo = (l.photos&&l.photos[0] && !H.dataLight())
      ? `<img src="${l.photos[0]}" alt="${H.escHtml(l.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="color:var(--blue);display:flex;align-items:center;justify-content:center;height:100%">${H.categoryIcon(l.cat)}</div>`;
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
    if(!Array.isArray(this.state.adminLogs)) this.state.adminLogs=[];
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
    // Android hardware back button / gesture: close whatever overlay is open
    // (photo viewer, modal, sheet), then walk back through the page stack, so a
    // user is never trapped — e.g. inside the fullscreen listing photo viewer.
    try {
      const _AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (_AppPlugin && _AppPlugin.addListener && !H._backBtnBound) {
        H._backBtnBound = true;
        _AppPlugin.addListener('backButton', function () {
          if (typeof H._imgViewerClose === 'function') { try { H._imgViewerClose(); } catch (e) {} return; }
          if (document.getElementById('notifDetailModal')) { try { H._closeNotifDetail(); } catch (e) {} return; }
          if (document.getElementById('bizSwitcher')) { try { H._closeBizSwitcher(); } catch (e) {} return; }
          if (document.getElementById('rateAppModal')) { try { H._dismissRating(); } catch (e) {} return; }
          if (document.getElementById('pvOverlay')) { try { H.closePhotoViewer(); } catch (e) {} return; }
          var _mb = document.getElementById('modalBg');
          if (_mb && _mb.classList.contains('open')) { H.closeModal(); return; }
          var _sb = document.getElementById('sheetBg');
          if (_sb && _sb.classList.contains('open')) { H.closeSheet(); return; }
          // Post page: back button must follow the step-aware logic, not bypass it.
          if (H.currentPageName === 'Post' && H._post && typeof H._post.headerBack === 'function') {
            H._post.headerBack(); return;
          }
          if (H.pageStack && H.pageStack.length) { H.goBack(); return; }
          if (H.currentPageName && H.currentPageName !== 'Home') { H.navTo('Home'); return; }
          if (_AppPlugin.minimizeApp) _AppPlugin.minimizeApp();
          else if (_AppPlugin.exitApp) _AppPlugin.exitApp();
        });
      }
    } catch (e) {}
    // Handle OAuth deep-link callback (com.pamarket.app://login-callback?code=xxx).
    // Check via App.getLaunchUrl() for cold-start and via appUrlOpen for warm-start.
    try {
      const _Cap = window.Capacitor;
      const _App = _Cap && _Cap.Plugins && _Cap.Plugins.App;
      const _sb  = window.supabase;
      const _handleOAuthUrl = async function(url) {
        if (!url || !url.includes('login-callback')) return false;
        try {
          const code = new URL(url).searchParams.get('code');
          if (code && _sb) {
            const { data: sessData, error } = await _sb.auth.exchangeCodeForSession(code);
            if (!error && sessData && sessData.session && sessData.session.user) {
              const user   = sessData.session.user;
              const userId = user.id;
              const meta   = user.user_metadata || {};
              // Upsert Supabase profile row for first-time Google/Apple sign-ins
              try {
                const { data: existing } = await _sb.from('profiles').select('id').eq('id', userId).single();
                if (!existing) {
                  const name   = meta.full_name || meta.name || user.email || 'User';
                  const avatar = meta.avatar_url || meta.picture || null;
                  await _sb.from('profiles').upsert({ id: userId, name: name, avatar: avatar });
                }
              } catch(pe) {}
              if (window.H && window.H.state) {
                if (typeof window.H.loadProfile === 'function') {
                  try { await window.H.loadProfile(userId); } catch(pe) {}
                }
                window.H.state.currentUserId = userId;
                if (typeof window.H.saveState === 'function') window.H.saveState();
              }
            }
          }
        } catch(e) {}
        return false;
      };
      if (_App) {
        // Cold start only: check if app was launched directly from the deep link.
        // Warm-start (app in background) is handled exclusively by auth.js _oauthInCap
        // to avoid a double-exchange race condition (PKCE codes are single-use).
        const launchData = await _App.getLaunchUrl().catch(function(){return null;});
        if (launchData && launchData.url) {
          const handled = await _handleOAuthUrl(launchData.url);
          if (handled) return;
        }
      }
    } catch(e) {}
    // Reconcile the cached user id with the live Supabase session so every read and
    // write targets the SAME profile. getSession() USUALLY reads the locally stored
    // session, but supabase-js refreshes over the network when the stored token has
    // expired — and on a flaky/offline cold start that refresh can hang with no
    // timeout, blocking startup (and the splash) forever. Race it against a short
    // timeout: if it doesn't answer fast, treat it as "no live session" and carry on.
    // The local login is preserved by the else-branch below (silent background
    // refresh), so a slow network never traps the user on the splash screen.
    try {
      const _sb = window.supabase;
      if (_sb && _sb.auth && typeof _sb.auth.getSession === 'function') {
        const _sr = await Promise.race([
          _sb.auth.getSession(),
          new Promise(res => setTimeout(() => res({ data: { session: null }, _timedOut: true }), 4000))
        ]);
        if (_sr && _sr._timedOut) console.warn('[PaMarket] getSession() timed out on boot — continuing with local session.');
        const _sid = _sr && _sr.data && _sr.data.session && _sr.data.session.user && _sr.data.session.user.id;
        if (_sid) {
          if (this.state.currentUserId !== _sid) { this.state.currentUserId = _sid; this.saveState(); }
          // Backfill the login email from the auth session (Google sign-ins
          // never wrote it to the profile, so the Edit Profile email was blank).
          try {
            const _semail = (_sr.data.session.user && _sr.data.session.user.email) || '';
            const _cu = (typeof H.currentUser === 'function') ? H.currentUser() : (this.state.users || []).find(x => x.id === _sid);
            if (_cu && _semail && _cu.email !== _semail) {
              _cu.email = _semail;
              this.saveState();
              _sb.from('profiles').update({ email: _semail }).eq('id', _sid).then(function(){}, function(){});
            }
          } catch (e) {}
          if (typeof H.loadProfile === 'function') {
            H.loadProfile(_sid).then(() => {
              if (this.state.currentUserId && this.checkBan()) return;
              // Re-render only the Account page (which actually shows profile
              // name/avatar). Home is listings-driven, so re-rendering it here
              // just causes a startup flicker for no visible change.
              if (this.currentPageName === 'Account' && !this.pageStack.length && !H._userIsTyping()) {
                try { this.renderPage(this.currentPageName, this.currentPageParams); } catch(e) {}
              }
            }).catch(()=>{});
          }
        } else if (this.state.currentUserId) {
          // No live Supabase session but we hold a local login. DON'T force a
          // logout here — getSession() can momentarily return empty (storage
          // hiccup, token still rehydrating, brief offline), and wiping the
          // login on boot logged people out unexpectedly. Try a silent refresh;
          // keep them signed in locally either way. A genuinely revoked session
          // simply means cloud writes will fail until they re-auth.
          try { if (_sb.auth.refreshSession) _sb.auth.refreshSession().catch(function(){}); } catch(e) {}
        }
      }
    } catch(e) {}
    if(this.state.currentUserId&&this.checkBan()) return;
    const _nav = document.getElementById('bottomNav');
    if (_nav) _nav.style.display='flex';
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
    // First paint is done — drop the splash now. Home renders instantly from the
    // cached state, and the cloud fetches below re-render when they land, so a slow
    // connection never holds the whole app hostage on the splash screen.
    if (typeof window._hideSplash === 'function') window._hideSplash();
    // Handle deep links: ?listing=ID  or  ?action=post|browse  or  ?deeplink=route
    const _qs = new URLSearchParams(window.location.search);
    const _lid = _qs.get('listing'), _act = _qs.get('action'), _dl = _qs.get('deeplink'), _cat = _qs.get('cat');
    if (_dl) { setTimeout(()=>H._handleDeepLink(decodeURIComponent(_dl)), 300); }
    else if (_lid) { setTimeout(()=>this.openListing(_lid), 200); }
    else if (_cat) { setTimeout(()=>{ try { this.filterByCat(_cat); } catch(e){} }, 250); }
    else if (_act === 'post')   { if(this.currentUser()) setTimeout(()=>this.navTo('Post',null), 200); }
    else if (_act === 'browse') { setTimeout(()=>this.navTo('Browse',null), 200); }
    try {
      const _hasCachedListings = (this.state.listings || []).filter(l => l.status === 'active').length > 0;
      if (_hasCachedListings) {
        // Warm start: Home already shows cached data. Fetch fresh data in the
        // background and re-render the feed the MOMENT it lands — don't wait for
        // the next poll cycle or a realtime event. On slow Zimbabwe connections
        // this is the difference between an instant Twitter-style refresh on open
        // and the feed sitting stale for tens of seconds.
        const _self = this;
        const _sigBefore = (this.state.listings || []).filter(l => l.status === 'active').map(l => l.id).join(',');
        _self.fetchListingsFromSupabase().then(function() {
          if (typeof H._checkEngagementAlerts === 'function') H._checkEngagementAlerts();
          const _sigAfter = (H.state.listings || []).filter(l => l.status === 'active').map(l => l.id).join(',');
          const pg = H.currentPageName;
          const FEED = { Home:1, Browse:1, Property:1, Vehicles:1, Electronics:1, Fashion:1,
            Furniture:1, Services:1, Agriculture:1, Pets:1, Kids:1, Other:1, Jobs:1, Rooms:1 };
          if (_sigBefore !== _sigAfter && FEED[pg] && !H._userIsTyping()) {
            if (typeof H._scheduleRender === 'function') {
              H._scheduleRender();
            } else if (H.RM && typeof H.RM._renderPreserved === 'function' && !H.RM._inBgRender) {
              H.RM._renderPreserved(pg, H.currentPageParams);
            } else {
              H.renderPage(pg, H.currentPageParams);
            }
          }
        }).catch(function(){});
        _self.fetchAdsFromSupabase().catch(function(){});
        _self.fetchAppSettings().catch(function(){});
      } else {
        // Cold start (first install or cleared cache): await so Home fills immediately.
        const _sigBefore = (this.state.listings || []).filter(l => l.status === 'active').map(l => l.id).join(',');
        await this.fetchListingsFromSupabase();
        H._checkEngagementAlerts();
        await Promise.all([this.fetchAdsFromSupabase(), this.fetchAppSettings()]);
        const _sigAfter = (this.state.listings || []).filter(l => l.status === 'active').map(l => l.id).join(',');
        if (_sigBefore !== _sigAfter && this.currentPageName === 'Home' && !this.pageStack.length && !H._userIsTyping()) {
          await this.renderPage('Home', this.currentPageParams);
        }
      }
    } catch(e) { console.warn('Boot fetch failed:', e); }
    if(typeof H._setupRealtimeMessages==='function') H._setupRealtimeMessages();
    if(typeof H._setupRealtimeListings==='function') H._setupRealtimeListings();
    if(typeof H._setupRealtimeBusinesses==='function') H._setupRealtimeBusinesses();
    if(typeof H.syncReports==='function') H.syncReports();
    if(typeof H.syncConversations==='function') H.syncConversations();
    if(typeof H.syncApplications==='function') H.syncApplications();
    if(typeof H.fetchMyBusinesses==='function') H.fetchMyBusinesses();
    if(typeof H.processSubscriptionExpiry==='function') H.processSubscriptionExpiry();
    if(typeof H.processFeaturedExpiry==='function') H.processFeaturedExpiry();
    if(typeof H.syncNotifications==='function') H.syncNotifications();
    if(typeof H._setupRealtimeNotifs==='function') H._setupRealtimeNotifs();
    if(typeof H.startRealtime==='function') H.startRealtime();
    if(typeof H.setupPush==='function') H.setupPush();
    this._initPullToRefresh();
    if(typeof window._hideSplash==='function') window._hideSplash();
  },

  // True while the user has a text field focused — background refreshes must
  // never re-render the page out from under someone who is typing.
  _userIsTyping() {
    var ae = document.activeElement;
    return !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
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
    const gated=['Messages','Chat','MyListings','Favorites','Profile','EditProfile','Settings','Ads','AdsCreate','AdsContact','MyAds','Security','SecuritySettings','DeleteAccount','JobSeekerProfile','CandidateProfile','AppliedJobs','JobApplications','PostJob','MyContactRequests','BusinessOnboarding','BusinessActivated','BusinessView','BusinessEditProfile','BusinessStaff','BusinessSubscription','BusinessVerify','BusinessListings','BusinessAssignListing','BusinessAddProduct','BusinessLeads','BusinessQuickReplies','BusinessFeatured','BusinessAnalytics','BusinessBilling','BusinessAdmin'];
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
    // Close any open modal/sheet so overlays don't block the new page
    const _mb = document.getElementById('modalBg');
    if (_mb && _mb.classList.contains('open')) _mb.classList.remove('open');
    this.closeSheet();
    // Tear down Hire Talent floating UI when navigating to any page (re-created by HireTalent_after)
    ['talentFloatBar','talentFilterPanel','sheet_tsort'].forEach(function(id){ var e=document.getElementById(id); if(e) e.remove(); });
    // Remove chat keyboard listeners when navigating away from Chat
    if (window._chatKBShow) { try { window._chatKBShow.remove(); } catch(e){} window._chatKBShow = null; }
    if (window._chatKBHide) { try { window._chatKBHide.remove(); } catch(e){} window._chatKBHide = null; }
    if (window._chatScrollLock) {
      if (area) area.removeEventListener('scroll', window._chatScrollLock);
      window._chatScrollLock = null;
    }
    if (window._chatKBResizeHandler) {
      window.removeEventListener('resize', window._chatKBResizeHandler);
      window._chatKBResizeHandler = null;
    }
    if (window._chatVPHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', window._chatVPHandler);
      window.visualViewport.removeEventListener('scroll', window._chatVPHandler);
      window._chatVPHandler = null;
    }
    // Leave the per-conversation typing/broadcast channel when exiting Chat
    if (typeof this.leaveChatChannel === 'function') this.leaveChatChannel();
    // Restore mainArea styles that Chat overrides
    if(area) { area.style.overflowY='auto'; area.style.position=''; }
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
      // Do NOT blank the page while awaiting — keep the current page visible
      // until the new HTML is ready, then swap instantly. Blanking via opacity:0
      // here caused a full-screen white flash on every async navigation.
      const html=await res;
      if(this.currentPageName!==name) return;
      area.innerHTML=html;
      area.scrollTop=scrollTo;
    } else {
      area.innerHTML=res;
      area.scrollTop=scrollTo;
    }
    if(area.style.opacity!=='1') area.style.opacity='1';
    if(this.pages[name+'_after']) { try { this.pages[name+'_after'](params||{}); } catch(e){ console.warn(name+'_after error:',e); } }
    this._initPullToRefresh();
  },

  openListing(id) {
    const l=(this.state.listings||[]).find(x=>x.id===id); if(!l) return;
    l.views=(l.views||0)+1;
    const rv=JSON.parse(localStorage.getItem('pamarket_rv')||'[]');
    const filtered=[...new Set([id,...rv.filter(x=>x!==id)])].slice(0,10);
    try{localStorage.setItem('pamarket_rv',JSON.stringify(filtered));}catch(_){}
    this.saveState();
    // Business listings open the shop/store page, not a plain listing detail.
    if(l.businessId){this.openInner('BusinessProfile',{id:l.businessId,highlightListing:id});return;}
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
    // Only set up once — #mainArea persists for the app lifetime so listeners
    // don't need to be re-registered on every renderPage call.
    if (el._ptrReady) return;
    el._ptrReady = true;
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
        if ((pageName === 'Messages' || pageName === 'Chat') && H.currentUser()) {
          // Messages must be live before rendering — await is intentional here.
          if (typeof H.syncConversations === 'function') await H.syncConversations();
          await H.renderPage(pageName, H.currentPageParams);
          if (typeof H.syncNotifications === 'function') H.syncNotifications();
        } else {
          // Render immediately from cache so the UI responds in milliseconds, then
          // fetch fresh data in the background and silently update again when done.
          await H.renderPage(pageName, H.currentPageParams);
          if (typeof H.fetchListingsFromSupabase === 'function') {
            H.fetchListingsFromSupabase().then(function() {
              if (H.currentPageName === pageName) {
                H.renderPage(pageName, H.currentPageParams).catch(function(){});
              }
            }).catch(function(){});
          }
          if (H.currentUser()) {
            if (typeof H.syncConversations === 'function') H.syncConversations({ skipMessageFetch: true }).catch(function(){});
            if (typeof H.syncNotifications === 'function') H.syncNotifications();
            if (typeof H.syncApplications  === 'function') H.syncApplications();
          }
        }
        if (typeof H.toast === 'function') H.toast('Refreshed', 1500, true);
      } catch(e) {
        console.warn('PTR:', e);
        if (typeof H.toast === 'function') H.toast('Could not refresh - check your connection', 3000, true);
      }
      setTimeout(function() { hideIndicator(); refreshing = false; }, 300);
    }

    // ── Touch handlers ─────────────────────────────────────────────
    var startY = 0, curY = 0, pulling = false, committed = false;

    // True if any scrollable ancestor of the touch target is scrolled down —
    // in that case the user is scrolling content, not pulling to refresh.
    function innerScrolled(node) {
      while (node && node !== el && node.nodeType === 1) {
        if (node.scrollHeight > node.clientHeight + 1) {
          var oy = (getComputedStyle(node).overflowY || '');
          if ((oy === 'auto' || oy === 'scroll') && node.scrollTop > 0) return true;
        }
        node = node.parentNode;
      }
      return false;
    }

    function onStart(e) {
      if (refreshing || el.scrollTop > 0) return;
      if (H.currentPageName === 'ReportProblem') return;
      // Never start PTR from the bottom input/control area
      if (e.target && e.target.closest && e.target.closest('.chat-input-bar, .chat-attach-btn, .chat-send, input, button, textarea')) return;
      // Don't hijack a gesture that's scrolling an inner scroller (chat thread,
      // bot chat, any overflow container) that isn't at its top.
      if (innerScrolled(e.target)) return;
      if (H.currentPageName === 'Chat') {
        const thread = document.getElementById('chatThread');
        if (thread && thread.scrollTop > 0) return;
      }
      startY = e.touches[0].clientY;
      curY   = startY;
      pulling = true;
      committed = false;
    }

    function onMove(e) {
      if (!pulling) return;
      curY = e.touches[0].clientY;
      var dist = curY - startY;
      // Decide phase: don't touch the gesture until it's clearly a downward pull
      // past a small deadzone. An upward/short move releases it to native scroll.
      if (!committed) {
        if (dist > 12) { committed = true; }
        else if (dist < 0) { pulling = false; return; }
        else return;
      }
      if (dist <= 0) { pulling = false; committed = false; snapBack(); hideIndicator(); return; }
      e.preventDefault(); // block native overscroll only once we own the pull
      var visual = Math.min(damp(dist), MAX_VIS);
      moveContent(visual);
      moveIndicator(visual);
      // One-shot haptic exactly when the threshold is crossed
      if (dist >= THRESHOLD && dist < THRESHOLD + 5 && navigator.vibrate) navigator.vibrate(10);
    }

    function onEnd() {
      if (!pulling) return;
      pulling = false;
      var wasCommitted = committed; committed = false;
      var dist = curY - startY;
      if (wasCommitted && dist >= THRESHOLD) { doRefresh(); }
      else if (wasCommitted) { snapBack(); hideIndicator(); }
      // Simple tap (never committed to a pull) — skip animations to avoid GPU flash
    }

    function onCancel() {
      var wasCommitted = committed;
      pulling = false; committed = false;
      if (wasCommitted) { snapBack(); hideIndicator(); }
    }

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
      const base = {
        id:listing.id, seller_id:listing.sellerId,
        seller_name:listing.sellerName||'', seller_phone:listing.sellerPhone||'',
        title:listing.title, description:listing.desc||'',
        price:listing.price||0, currency:listing.currency||'USD',
        category:listing.cat||'other', province:listing.prov||'',
        city:listing.city||'', suburb:listing.suburb||'',
        photos:listing.photos||[], status:listing.status||'active',
        boost:listing.boost||null, views:listing.views||0,
        business_id:listing.businessId||null,
        created_at:listing.createdAt?new Date(listing.createdAt).toISOString():new Date().toISOString()
      };
      const attrs = (typeof H.collectAttrs==='function') ? H.collectAttrs(listing) : (listing.attrs||{});
      const {error}=await window.supabase.from('listings').upsert(Object.assign({attributes:attrs}, base));
      // If the attributes column hasn't been added yet, retry without it so
      // posting never breaks before the migration is run.
      if(error){
        if(/attributes|column|schema cache|PGRST204/i.test(error.message||'')){
          const {error:e2}=await window.supabase.from('listings').upsert(base);
          if(e2) console.warn('Cloud save failed:',e2.message);
        } else console.warn('Cloud save failed:',error.message);
      }
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
      // Select * (not an explicit column list): the paid_ads table may or may not
      // have the richer ad columns (headline, business_name, bg_color, ...). An
      // explicit list that names a missing column 400s and returns ZERO ads, so
      // ads "exist but never appear". With * we take whatever exists and fall
      // back to the minimal columns (title/image_url/link_url) that always exist.
      const {data,error} = await window.supabase
        .from('paid_ads')
        .select('*')
        .eq('active',true)
        .limit(20);
      if(error||!data) return;
      H.state.paidAds = data.map(r=>({
        id:r.id, type:r.type||'banner',
        businessName:r.business_name || r.title || 'Sponsored',
        headline:r.headline || r.title || '',
        tagline:r.tagline || '', imageUrl:r.image_url,
        bgColor:r.bg_color || '#1A3A8F', linkUrl:r.link_url, targetCat:r.target_cat || null,
        startsAt:r.starts_at?new Date(r.starts_at).getTime():0,
        endsAt:r.ends_at?new Date(r.ends_at).getTime():9999999999999,
        active:r.active, priority:r.priority||0,
        impressions:r.impressions||0, clicks:r.clicks||0,
        listingId:r.listing_id||null
      })).sort(function(a,b){ return (b.priority||0)-(a.priority||0); });
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
    const a = (H.state.paidAds||[]).find(x=>String(x.id)===String(id)); if(!a) return;
    a.impressions = (a.impressions||0)+1;
    window.supabase.from('paid_ads').update({impressions:a.impressions}).eq('id',id).then(()=>{});
  },

  trackAdClick(id) {
    // Use String comparison — DB ids may be numeric but onclick passes a string.
    const a = (H.state.paidAds||[]).find(x=>String(x.id)===String(id));
    if(a&&window.supabase&&typeof window.supabase.from==='function'){
      a.clicks=(a.clicks||0)+1;
      window.supabase.from('paid_ads').update({clicks:a.clicks}).eq('id',id).then(()=>{});
    }
    // Listing link takes priority over external URL; open Detail directly (not business routing)
    if(a && a.listingId) { H.openInner('Detail', {id: a.listingId}); return; }
    const url = a && a.linkUrl;
    if(url) {
      try {
        var _native=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
        window.open(url,_native?'_system':'_blank',_native?'':' noopener');
      } catch(e){ try{window.open(url,'_blank');}catch(e2){} }
      return;
    }
    if(a) H.toast((a.businessName||'Sponsored') + (a.tagline ? ' · ' + a.tagline : ''), 3000);
  },

  // Map a raw cloud `listings` row to the app's local listing shape.
  _mapCloudListing(r) {
    const o={
      id:r.id, sellerId:r.seller_id, sellerName:r.seller_name||'',
      sellerPhone:r.seller_phone||'', title:r.title, desc:r.description,
      price:r.price, currency:r.currency, cat:r.category,
      prov:r.province, city:r.city, suburb:r.suburb,
      photos:Array.isArray(r.photos)?r.photos:(r.photos?[r.photos]:[]),
      status:r.status, boost:r.boost, views:r.views||0,
      businessId:r.business_id||null,
      createdAt:r.created_at?new Date(r.created_at).getTime():Date.now(),
      updatedAt:r.updated_at?new Date(r.updated_at).getTime():0
    };
    if(r.attributes && typeof r.attributes==='object'){
      if(typeof H.applyAttrs==='function') H.applyAttrs(o, r.attributes);
      else o.attrs=r.attributes;
    }
    return o;
  },

  // Fetch a single listing by id when it isn't in the local cache (e.g. after the
  // app has been idle and the cache was refreshed/pruned, or the listing is older
  // than the cached set). Returns the listing, or null if genuinely unavailable.
  async _fetchListingById(id) {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return null;
      const { data, error } = await window.supabase.from('listings').select('id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,views,business_id,created_at,updated_at,attributes').eq('id', id).maybeSingle();
      if (error || !data) return null;
      const o = H._mapCloudListing(data);
      H.state.listings = H.state.listings || [];
      if (!H.state.listings.find(x => x.id === o.id)) { H.state.listings.push(o); H.saveState(); }
      return o;
    } catch(e) { return null; }
  },

  async fetchListingsFromSupabase() {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      const {data,error}=await window.supabase
        .from('listings').select('id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,views,business_id,created_at,updated_at,attributes')
        .eq('status','active')
        .order('created_at',{ascending:false})
        .limit(50);
      if(error) { if(!navigator.onLine) H.toast('No internet — showing saved listings', 4000, true); return; }
      const cloud=(data||[]).map(r=>H._mapCloudListing(r));
      // Reset pagination cursor — this is always a fresh fetch from newest
      H._listingsCursor    = (data.length === 50) ? data[data.length - 1].created_at : null;
      H._listingsAllLoaded = data.length < 50;
      if (typeof H.applyFeedUpdate === 'function') {
        H.applyFeedUpdate({ type: 'listings_full', data: cloud }, 'poll');
      } else {
        const nonActive=(H.state.listings||[]).filter(l=>l.status!=='active');
        H.state.listings=[...cloud,...nonActive];
        H.saveState();
      }
      if (typeof H._checkSavedSearchAlerts === 'function') { try { H._checkSavedSearchAlerts(); } catch(e){} }

      // Seller verified-badge backfill runs in the background so it never
      // delays the main fetch return. The UI already has fresh listings above;
      // badge updates arrive a moment later and only trigger a re-render when
      // something actually changed (prevents an infinite re-render loop).
      const sellerIds = [...new Set(cloud.map(l => l.sellerId).filter(Boolean))];
      if (sellerIds.length) {
        window.supabase.from('profiles').select('id,name,avatar,verified').in('id', sellerIds)
          .then(function(res) {
            if (!Array.isArray(res.data) || !res.data.length) return;
            H.state.users = H.state.users || [];
            let verifiedChanged = false;
            res.data.forEach(function(p) {
              const su = H.state.users.find(function(x) { return x.id === p.id; });
              if (su) {
                if (su.verified !== !!p.verified) { su.verified = !!p.verified; verifiedChanged = true; }
                if (p.name && !su.name)     su.name   = p.name;
                if (p.avatar && !su.avatar) su.avatar = p.avatar;
              } else {
                H.state.users.push({ id: p.id, name: p.name || '', phone: '', email: '',
                  avatar: p.avatar || null, verified: !!p.verified, role: 'user',
                  status: 'active', joinedAt: Date.now() });
                if (p.verified) verifiedChanged = true;
              }
            });
            if (verifiedChanged) {
              H.saveState();
              const pg = H.currentPageName;
              if (pg === 'Home' || pg === 'Browse' || pg === 'Detail' || pg === 'CategoryView') {
                try { H.renderPage(pg, H.currentPageParams); } catch(e) {}
              }
            }
          }).catch(function() {});
      }
    } catch(e){ console.warn('fetchListingsFromSupabase:',e.message); }
  },

  async loadMoreListings() {
    if (H._listingsAllLoaded || H._loadingMoreListings) return;
    if (!window.supabase || typeof window.supabase.from !== 'function') return;
    if (!H._listingsCursor) return;
    H._loadingMoreListings = true;
    var sentinel = document.getElementById('homeLoadMore');
    if (sentinel) sentinel.textContent = 'Loading more listings...';
    try {
      var res = await window.supabase.from('listings').select('id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,views,business_id,created_at,updated_at,attributes')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .lt('created_at', H._listingsCursor)
        .limit(50);
      if (res.error || !Array.isArray(res.data)) return;
      var batch = res.data;
      var cloud = batch.map(function(r) { return H._mapCloudListing(r); });
      if (batch.length < 50) H._listingsAllLoaded = true;
      if (batch.length === 50) H._listingsCursor = batch[batch.length - 1].created_at;
      if (cloud.length > 0) {
        var existing = new Set((H.state.listings || []).map(function(l) { return l.id; }));
        var toAdd = cloud.filter(function(l) { return !existing.has(l.id); });
        if (toAdd.length) {
          var nonActive = (H.state.listings || []).filter(function(l) { return l.status !== 'active'; });
          var active    = (H.state.listings || []).filter(function(l) { return l.status === 'active'; });
          H.state.listings = active.concat(toAdd).concat(nonActive);
          H.saveState();
          if (typeof H._renderHomeCatSections === 'function' && H.currentPageName === 'Home') {
            H._renderHomeCatSections();
          }
        }
      }
    } catch(e) { console.warn('loadMoreListings:', e.message); }
    finally {
      H._loadingMoreListings = false;
      var _s = document.getElementById('homeLoadMore');
      if (_s) _s.textContent = H._listingsAllLoaded ? 'All listings loaded' : '';
    }
  },

  // Admin-only: pull EVERY listing (all statuses) so the moderation queue is
  // complete across devices. The normal feed fetch (fetchListingsFromSupabase)
  // only pulls status='active', so pending/banned ads posted on OTHER devices
  // would never reach the admin to be approved. Merges cloud rows by id into
  // local state — cloud wins for known ids; local-only unsynced listings are
  // preserved so nothing the admin posted locally disappears.
  async fetchAllListingsForAdmin() {
    try {
      if(!window.supabase||typeof window.supabase.from!=='function') return;
      const {data,error}=await window.supabase
        .from('listings').select('id,seller_id,seller_name,seller_phone,title,description,price,currency,category,province,city,suburb,photos,status,boost,views,business_id,created_at,updated_at,attributes')
        .order('created_at',{ascending:false})
        .limit(20);
      if(error||!Array.isArray(data)) return;
      const cloud=data.map(r=>H._mapCloudListing(r));
      const cloudIds=new Set(cloud.map(l=>l.id));
      const localOnly=(H.state.listings||[]).filter(l=>!cloudIds.has(l.id));
      H.state.listings=[...cloud,...localOnly];
      H.saveState();
    } catch(e){ console.warn('fetchAllListingsForAdmin:',e.message); }
  },

  _setupRealtimeMessages() {
    try {
      if(!window.supabase||typeof window.supabase.channel!=='function') return;
      // removeChannel (not unsubscribe) so the old channel is dropped from the
      // client's registry too — prevents a slow channel leak on every reconnect.
      if(window._msgChannel){ try{ window.supabase.removeChannel(window._msgChannel); }catch(e){} window._msgChannel=null; }
      window._msgChannel=window.supabase.channel('messages-rt')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},payload=>{
          const msg=payload.new; if(!msg) return;
          if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
          const conv=H.state.conversations.find(c=>c.id===msg.conversation_id);
          if(conv){
            if (!Array.isArray(conv.messages)) conv.messages = [];
            const ex=conv.messages.find(m=>m.id===msg.id);
            if(!ex){
              const localMsg = {id:msg.id,from:msg.sender_id,senderName:msg.sender_name||'',text:msg.text,image:msg.image||null,t:new Date(msg.created_at).getTime(),read:false};
              // Keep membership accurate so the chat resolves the correct "other"
              // user: a real incoming sender that isn't us must be a member.
              if (!Array.isArray(conv.members)) conv.members = [];
              if (msg.sender_id && msg.sender_id !== H.state.currentUserId && conv.members.indexOf(msg.sender_id) === -1) {
                conv.members.push(msg.sender_id);
              }
              // A biz_ conversation must carry its businessId so it stays in the
              // Business tab and never leaks into personal chats.
              if (!conv.businessId && typeof conv.id === 'string' && conv.id.indexOf('biz_') === 0) {
                const _bs = conv.id.slice(4, 12);
                const _bm = (H.state.businesses || []).find(function(b){ return b.id && String(b.id).slice(-8) === _bs; });
                if (_bm) conv.businessId = _bm.id;
              }
              conv.messages.push(localMsg);
              H.saveState();
              // Update bottom nav badge immediately without waiting for the 5 s interval
              if (typeof H.updateMsgBadge === 'function') H.updateMsgBadge();
              if(H.currentPageName==='Chat'&&H.currentPageParams&&H.currentPageParams.id===msg.conversation_id&&typeof H._appendChatMessages==='function')
                H._appendChatMessages(msg.conversation_id,[localMsg]);
              else if(H.currentPageName==='Messages'&&typeof H._refreshMessagesPage==='function')
                H._refreshMessagesPage({ skipSync:true });
            }
          } else {
            // Message for a conversation we don't hold — possibly one the user
            // deleted. An incoming reply revives it so messages are never lost
            // behind a "conversation/profile not found" dead end.
            if (msg.sender_id !== H.state.currentUserId &&
                Array.isArray(H.state.deletedConvIds) && H.state.deletedConvIds.includes(msg.conversation_id)) {
              H.state.deletedConvIds = H.state.deletedConvIds.filter(id => id !== msg.conversation_id);
              if (H.state.deletedConvMeta) delete H.state.deletedConvMeta[msg.conversation_id];
              H.saveState();
              const _du = H.currentUser();
              if (_du) window.supabase.from('conversation_deletions').delete().eq('user_id', _du.id).eq('conversation_id', msg.conversation_id).then(()=>{});
            }
            if (typeof H.syncConversations === 'function') {
              // skipMessageFetch: realtime already delivered this message via appendChatMessages;
              // we only need conversation discovery here, not a full per-conv message re-fetch.
              H.syncConversations({ skipMessageFetch: true }).then(function(){
                if (H.currentPageName === 'Messages' && typeof H._refreshMessagesPage === 'function') H._refreshMessagesPage({ skipSync:true });
              });
            }
          }
        }).subscribe(function(status){
          if (H.RT && typeof H.RT._onChannelStatus === 'function') H.RT._onChannelStatus('messages', status);
        });
    } catch(e){ console.warn('Realtime setup failed:',e.message); }
  },

  // Supabase Realtime for the listings feed — INSERT/UPDATE/DELETE arrive
  // instantly and update the UI without waiting for the next poll cycle.
  // Requires 'listings' to be in the Supabase realtime publication.
  // Falls back to RM polling silently if the channel errors.
  // State mutations go through H.applyFeedUpdate (conflict rules + dedup).
  // Renders are batched via H._scheduleRender (350 ms debounce, scroll-safe).
  _setupRealtimeListings() {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.channel !== 'function') return;
      if (window._listingsChannel) { try { sb.removeChannel(window._listingsChannel); } catch(e){} }
      const FEED_PAGES = { Home:1, Browse:1, Property:1, Vehicles:1, Electronics:1,
        Fashion:1, Furniture:1, Services:1, Agriculture:1, Pets:1, Kids:1,
        Other:1, Jobs:1, Rooms:1, Detail:1, MyListings:1, Favorites:1, BusinessShop:1 };
      window._listingsChannel = sb.channel('listings-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, function(payload) {
          try {
            if (typeof H.applyFeedUpdate === 'function') {
              H.applyFeedUpdate({
                type: 'listing_event',
                evt:  payload.eventType,
                data: payload.new ? H._mapCloudListing(payload.new) : null,
                id:   payload.old && payload.old.id
              }, 'realtime');
            }
            const pg = H.currentPageName;
            if (FEED_PAGES[pg] && typeof H._scheduleRender === 'function') H._scheduleRender();
          } catch(e) { console.warn('listings RT handler:', e); }
        })
        .subscribe(function(status) {
          if (H.RT && typeof H.RT._onChannelStatus === 'function') H.RT._onChannelStatus('listings', status);
        });
    } catch(e) { console.warn('_setupRealtimeListings:', e.message); }
  },

  // Supabase Realtime for businesses — same pattern as listings.
  // Requires 'businesses' to be in the Supabase realtime publication.
  // State mutations go through H.applyFeedUpdate; renders via H._scheduleRender.
  _setupRealtimeBusinesses() {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.channel !== 'function') return;
      if (window._bizRtChannel) { try { sb.removeChannel(window._bizRtChannel); } catch(e){} }
      const BIZ_PAGES = { Home:1, BusinessSearch:1, BusinessShop:1, BusinessProfile:1, BusinessView:1, Account:1 };
      window._bizRtChannel = sb.channel('businesses-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, function(payload) {
          try {
            var bmapped = null;
            const row = payload.new;
            if (row) {
              const _cats = (row.category || '').split('|').filter(Boolean);
              bmapped = { id: row.id, ownerUserId: row.owner_user_id, name: row.name || '',
                logo: row.logo, cover: row.cover, description: row.description,
                bizType: row.biz_type || 'individual', category: _cats[0] || null, categories: _cats,
                phone: row.phone, whatsapp: row.whatsapp, email: row.email,
                province: row.province, city: row.city, suburb: row.suburb,
                status: row.status, verificationLevel: row.verification_level || 0,
                featuredListingIds: Array.isArray(row.featured_listing_ids) ? row.featured_listing_ids : [],
                updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0 };
            }
            if (typeof H.applyFeedUpdate === 'function') {
              H.applyFeedUpdate({
                type: 'business_event',
                evt:  payload.eventType,
                data: bmapped,
                id:   payload.old && payload.old.id
              }, 'realtime');
            }
            const pg = H.currentPageName;
            if (BIZ_PAGES[pg] && typeof H._scheduleRender === 'function') H._scheduleRender();
          } catch(e) { console.warn('businesses RT handler:', e); }
        })
        .subscribe(function(status) {
          if (H.RT && typeof H.RT._onChannelStatus === 'function') H.RT._onChannelStatus('businesses', status);
        });
    } catch(e) { console.warn('_setupRealtimeBusinesses:', e.message); }
  },

  async syncApplications() {
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return;
      const u = H.currentUser(); if (!u) return;
      const { data, error } = await sb.from('applications')
        .select('id, job_id, job_title, company, applicant_id, applicant_name, applicant_phone, applicant_email, message, answers, status, employer_id, applied_at')
        .or(`applicant_id.eq.${u.id},employer_id.eq.${u.id}`)
        .order('applied_at', { ascending: false })
        .limit(50);
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
        .select('id, reporter_id, reported_by, target_type, target_id, reason, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
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

  async syncConversations(opts) {
    opts = opts || {};
    try {
      const sb = window.supabase;
      if (!sb || typeof sb.from !== 'function') return false;
      const u = H.currentUser(); if (!u) return false;
      if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
      let changed = false;

      // Load server-persisted conversation deletions so they stay hidden across logins.
      try {
        const { data: dels } = await sb.from('conversation_deletions').select('conversation_id').eq('user_id', u.id);
        if (dels && dels.length) {
          if (!Array.isArray(H.state.deletedConvIds)) H.state.deletedConvIds = [];
          for (const d of dels) {
            if (!H.state.deletedConvIds.includes(d.conversation_id)) { H.state.deletedConvIds.push(d.conversation_id); changed = true; }
          }
        }
      } catch (e) { /* conversation_deletions table may not exist yet */ }

      // Deletion timestamps let a LATER reply revive the thread. Deletions made
      // before this app version lack one — start their clock now so only messages
      // arriving from here on bring those threads back.
      if (!H.state.deletedConvMeta || typeof H.state.deletedConvMeta !== 'object') H.state.deletedConvMeta = {};
      for (const _did of (H.state.deletedConvIds || [])) {
        if (!H.state.deletedConvMeta[_did]) { H.state.deletedConvMeta[_did] = Date.now(); changed = true; }
      }

      // Phase 1: discover from conversations table (may not exist — silent fail)
      const deletedIds = new Set(Array.isArray(H.state.deletedConvIds) ? H.state.deletedConvIds : []);
      // Drop any already-loaded conversations the user has deleted.
      const _before = H.state.conversations.length;
      H.state.conversations = H.state.conversations.filter(c => !deletedIds.has(c.id));
      if (H.state.conversations.length !== _before) changed = true;
      const knownIds = new Set(H.state.conversations.map(c => c.id));
      try {
        const { data: convs, error } = await sb.from('conversations')
          .select('id, members, listing_id')
          .contains('members', [u.id])
          .limit(20);
        if (!error && convs) {
          for (const c of convs) {
            // Deleted convs stay OUT of knownIds so Phase 2 can still revive them
            // when it finds a reply newer than the deletion.
            if (deletedIds.has(c.id)) continue;
            knownIds.add(c.id);
            let local = H.state.conversations.find(x => x.id === c.id);
            if (!local) {
              local = { id: c.id, members: c.members || [], listingId: c.listing_id || null, messages: [] };
              // biz_ conv IDs encode the business ID suffix — restore businessId so the
              // owner sees these threads in the Business tab, not the Personal tab.
              if (typeof c.id === 'string' && c.id.indexOf('biz_') === 0) {
                const _bs = c.id.slice(4, 12);
                const _bm = (H.state.businesses || []).find(function(b) { return b.id && String(b.id).slice(-8) === _bs; });
                if (_bm) local.businessId = _bm.id;
              }
              H.state.conversations.push(local);
              changed = true;
            } else {
              const m = Array.isArray(c.members) ? c.members : [];
              if (JSON.stringify(local.members||[]) !== JSON.stringify(m)) { local.members = m; changed = true; }
              // Backfill businessId for existing convs synced before this fix
              if (!local.businessId && typeof local.id === 'string' && local.id.indexOf('biz_') === 0) {
                const _bs = local.id.slice(4, 12);
                const _bm = (H.state.businesses || []).find(function(b) { return b.id && String(b.id).slice(-8) === _bs; });
                if (_bm) { local.businessId = _bm.id; changed = true; }
              }
            }
          }
        }
      } catch(e) { /* conversations table may not exist */ }

      // Phase 2: discover from messages table — works without conversations table.
      // Conv IDs embed the last 6 chars of each member UUID, so LIKE finds them.
      // We collect ALL rows first so we can pair sent+received for the same conv to
      // extract the other member's ID even when only sent-side rows are found.
      try {
        const uidSuffix = u.id.slice(-6);
        const [sentRes, recvRes] = await Promise.all([
          sb.from('messages').select('conversation_id,sender_id,sender_name,created_at').eq('sender_id', u.id).order('created_at',{ascending:false}).limit(20),
          sb.from('messages').select('conversation_id,sender_id,sender_name,created_at').like('conversation_id',`%${uidSuffix}%`).neq('sender_id', u.id).order('created_at',{ascending:false}).limit(20)
        ]);
        // Build a map: convId -> first other-user sender_id found across both result sets
        const convOtherMap = {};
        for (const row of [...(recvRes.data||[]), ...(sentRes.data||[])]) {
          if (!row.conversation_id) continue;
          if (row.sender_id !== u.id && !convOtherMap[row.conversation_id]) {
            convOtherMap[row.conversation_id] = row.sender_id;
          }
        }
        const allRows = [...(sentRes.data||[]), ...(recvRes.data||[])];
        for (const row of allRows) {
          if (!row.conversation_id || knownIds.has(row.conversation_id)) continue;
          if (deletedIds.has(row.conversation_id)) {
            // Deleting a chat hides it, but it isn't a black hole: a reply from
            // the OTHER person sent AFTER the deletion revives the thread.
            const _rowT = row.created_at ? new Date(row.created_at).getTime() : 0;
            const _delT = (H.state.deletedConvMeta || {})[row.conversation_id] || Infinity;
            if (row.sender_id === u.id || _rowT <= _delT) continue;
            deletedIds.delete(row.conversation_id);
            H.state.deletedConvIds = (H.state.deletedConvIds || []).filter(id => id !== row.conversation_id);
            delete H.state.deletedConvMeta[row.conversation_id];
            changed = true;
            sb.from('conversation_deletions').delete().eq('user_id', u.id).eq('conversation_id', row.conversation_id).then(()=>{});
          }
          knownIds.add(row.conversation_id);
          const otherId = convOtherMap[row.conversation_id] || null;
          const members = otherId ? [u.id, otherId] : [u.id];
          H.state.conversations.push({ id: row.conversation_id, members, listingId: null, messages: [] });
          changed = true;
        }
      } catch(e) { /* messages table scan failed */ }

      // Phase 2b: discover biz_ conversations for businesses this user OWNS.
      // biz_ conv IDs embed the business ID suffix, NOT the owner's user ID suffix,
      // so the uidSuffix LIKE query above never finds them for the shop owner.
      // Phase 1 (conversations table) is the primary path; this is the fallback when
      // ensureConversationInCloud failed or the conversations table is unavailable.
      try {
        const myBizSuffixes = (H.state.businesses || [])
          .filter(function(b) { return b.ownerUserId === u.id; })
          .map(function(b) { return String(b.id).slice(-8); });
        if (myBizSuffixes.length) {
          const bizResults = await Promise.all(myBizSuffixes.map(function(suffix) {
            return sb.from('messages')
              .select('conversation_id,sender_id,sender_name,created_at')
              .like('conversation_id', 'biz_' + suffix + '_%')
              .neq('sender_id', u.id)
              .order('created_at', {ascending: false})
              .limit(20)
              .catch(function() { return { data: [] }; });
          }));
          for (const res of bizResults) {
            for (const row of (res.data || [])) {
              if (!row.conversation_id || knownIds.has(row.conversation_id)) continue;
              if (deletedIds.has(row.conversation_id)) continue;
              knownIds.add(row.conversation_id);
              const _bs = row.conversation_id.slice(4, 12);
              const _bm = (H.state.businesses || []).find(function(b) { return b.id && String(b.id).slice(-8) === _bs; });
              H.state.conversations.push({
                id: row.conversation_id,
                members: [row.sender_id, u.id],
                listingId: null,
                messages: [],
                businessId: _bm ? _bm.id : undefined
              });
              changed = true;
            }
          }
        }
      } catch(e) { /* biz_ owner scan failed */ }

      // Phase 3 (profile fetch) runs AFTER Phase 4 (message sync) so that messages
      // are loaded first — this ensures we have all sender_id values needed to populate
      // members arrays and collect the full set of other-user IDs for the profile fetch.

      // Phase 4: sync messages. Background polls (skipMessageFetch) skip this entirely
      // to avoid N parallel queries per poll cycle — the realtime subscription delivers
      // new messages in real-time; this is only needed on explicit open or first load.
      // When convId is provided (Chat open), only fetch that one conversation.
      if (!opts.skipMessageFetch) {
        const _convId = opts.convId || null;
        const toSync = _convId
          ? H.state.conversations.filter(function(c){ return c.id === _convId; })
          : H.state.conversations.slice().sort(function(a,b){
              // Most recently active first; cap at 10 to bound egress on boot
              const ta = a.messages && a.messages.length ? a.messages[a.messages.length-1].t||0 : 0;
              const tb = b.messages && b.messages.length ? b.messages[b.messages.length-1].t||0 : 0;
              return tb - ta;
            }).slice(0, 10);
        await Promise.all(toSync.map(async (local) => {
          if (!Array.isArray(local.messages)) { local.messages = []; changed = true; }
          const { data: msgs, error: msgErr } = await sb.from('messages')
            .select('id, sender_id, sender_name, text, image, read, created_at')
            .eq('conversation_id', local.id)
            .order('created_at', { ascending: false })
            .limit(20);
          if (msgErr || !msgs) return;
          const existing = new Map(local.messages.map(m => [m.id, m]));
          msgs.forEach(m => {
            const t = m.created_at ? new Date(m.created_at).getTime() : Date.now();
            const found = existing.get(m.id);
            const read = found && found.read ? true : !!m.read;
            if (!found) {
              local.messages.push({ id: m.id, from: m.sender_id, senderName: m.sender_name||'', text: m.text, image: m.image||null, t, read });
              changed = true;
            } else if (found.read !== read || found.from !== m.sender_id || found.senderName !== (m.sender_name||'') || (m.image && !found.image)) {
              found.from = m.sender_id;
              found.senderName = m.sender_name || found.senderName || '';
              if (m.image && !found.image) found.image = m.image;
              found.read = read;
              changed = true;
            }
          });
          local.messages.sort((a,b) => (a.t||0) - (b.t||0));
          if (!Array.isArray(local.members)) local.members = [u.id];
          if (!local.members.includes(u.id)) local.members.unshift(u.id);
          (msgs||[]).forEach(function(m) {
            if (m.sender_id && m.sender_id !== u.id && !local.members.includes(m.sender_id)) {
              local.members.push(m.sender_id);
              changed = true;
            }
          });
        }));
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

      // Phase 5 (was Phase 3): fetch profiles for all unknown or nameless conversation members.
      // This runs AFTER message sync so members arrays are fully populated and sender_name
      // fallbacks have already been applied — we only hit the network for IDs still nameless.
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
              if (existing.verified !== !!p.verified) { existing.verified = !!p.verified; changed = true; }
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
          // After profile fetch, also update conv.otherName for any conversation still missing it
          H.state.conversations.forEach(function(conv) {
            if (conv.otherName) return;
            const otherId = (conv.members||[]).find(function(id){ return id !== u.id; });
            if (!otherId) return;
            const otherUser = (H.state.users||[]).find(function(x){ return x.id === otherId; });
            if (otherUser && otherUser.name) { conv.otherName = otherUser.name; changed = true; }
          });
        } catch(e) {}
      }

      // Collapse any duplicate per-person threads the sync just pulled (legacy
      // listing-keyed + new per-person ids for the same pair) into one.
      if (typeof H._mergeDuplicateConversations === 'function' && H._mergeDuplicateConversations()) changed = true;

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
        text: msg.text, image: msg.image || null, read: msg.read || false,
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
        +'<div class="about-hero"><div class="about-brand">Pa<em>Market</em></div><div class="about-tag">Zimbabwe\'s Free Marketplace</div><div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:6px">Version 1.8.0</div></div>'
        +'<div class="about-card"><div class="about-sec-title">What is PaMarket?</div><div class="about-body">PaMarket is a free Zimbabwean marketplace connecting buyers, sellers, businesses, and job seekers across all ten provinces. Post a listing in minutes, browse thousands of ads, or open your own verified shop - all completely free.</div></div>'
        +'<div class="about-card"><div class="about-sec-title">What\'s Inside</div><div class="about-grid">'
        +['Marketplace','Business Shops','Hire Talent','Direct Messaging','Verified Sellers','Province Filters','12 Categories','Always Free'].map(f=>'<div class="about-feat">'+f+'</div>').join('')
        +'</div></div>'
        +'<div class="about-card"><div class="about-sec-title">Legal</div>'
        +'<div class="about-body" style="margin-bottom:12px">PaMarket is a platform only. We do not own or warrant any listed item. Users must ensure listings comply with Zimbabwean law.</div>'
        +'<div style="display:flex;flex-direction:column;gap:10px">'
        +'<button onclick="H.authShowDoc(\'terms\')" style="width:100%;padding:12px;background:var(--bg,#f5f7fb);border:1px solid var(--border,#e5e7eb);border-radius:10px;font-size:14px;font-weight:600;color:var(--text,#1a1a1a);cursor:pointer;text-align:left">Terms &amp; Conditions</button>'
        +'<button onclick="H.authShowDoc(\'privacy\')" style="width:100%;padding:12px;background:var(--bg,#f5f7fb);border:1px solid var(--border,#e5e7eb);border-radius:10px;font-size:14px;font-weight:600;color:var(--text,#1a1a1a);cursor:pointer;text-align:left">Privacy Policy</button>'
        +'<button onclick="H.authShowDoc(\'guidelines\')" style="width:100%;padding:12px;background:var(--bg,#f5f7fb);border:1px solid var(--border,#e5e7eb);border-radius:10px;font-size:14px;font-weight:600;color:var(--text,#1a1a1a);cursor:pointer;text-align:left">Community Guidelines</button>'
        +'</div></div>'
        +'<div class="about-card"><div class="about-sec-title">Contact Us</div>'
        +'<div class="about-contact-row" onclick="window.location.href=\'mailto:chakusaprince@gmail.com\'"><div class="about-contact-ic email-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div><div class="about-contact-label">Support Email</div><div class="about-contact-val">chakusaprince@gmail.com</div></div></div>'
        +'<div class="about-contact-row" onclick="window.open(\'https://wa.me/971589772645\')"><div class="about-contact-ic wa-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg></div><div><div class="about-contact-label">WhatsApp Support</div><div class="about-contact-val">+971 589 772 645</div></div></div>'
        +'</div>'
        +'<div class="about-ads-banner"><div class="about-ads-title">Advertise with PaMarket</div><div class="about-ads-sub">Reach active buyers across all provinces of Zimbabwe</div><button class="about-ads-btn" onclick="H.openInner(\'Ads\')">Get in Touch</button></div>'
        +'<div style="text-align:center;font-size:12px;color:var(--text-muted,#999);padding:16px 0 4px">PaMarket v1.8.0 &copy; 2026 · Made in Zimbabwe</div>'
        +'</div></div>';
    };

    H.pages.Ads=function(){
      return '<div class="page active">'+H.innerTopbar('Advertise with PaMarket')
        +'<div class="about-wrap">'
        +'<div class="ads-hero"><div class="ads-hero-title">Grow Your Business</div><div class="ads-hero-sub">Connect with active buyers across all provinces of Zimbabwe. Tell us about your goals and we\'ll find the right fit for you.</div></div>'
        +'<div class="about-card"><div class="about-sec-title">What We Offer</div>'
        +'<div class="about-body" style="margin-bottom:0">'
        +'<div style="display:flex;flex-direction:column;gap:10px">'
        +[['Banner Ad','Eye-catching banner placement on the home screen.'],['Category Spotlight','Pin your business to the top of a category of your choice.'],['Custom Campaign','Tailored multi-placement campaign for maximum reach.']]
          .map(([t,d])=>'<div style="background:var(--bg,#f5f7fb);border-radius:10px;padding:12px 14px"><div style="font-weight:700;font-size:14px;color:var(--text,#1a1a1a);margin-bottom:3px">'+t+'</div><div style="font-size:13px;color:var(--text-muted,#666)">'+d+'</div></div>')
          .join('')
        +'</div></div></div>'
        +'<div class="about-card"><div class="about-sec-title">Send an Enquiry</div>'
        +'<div class="fg"><div class="fl">Business Name</div><input class="fi" id="adsBiz" placeholder="Your business name"></div>'
        +'<div class="fg"><div class="fl">Contact Email</div><input class="fi" id="adsEmail" type="email" placeholder="your@email.com"></div>'
        +'<div class="fg"><div class="fl">Ad Type</div><select class="fi" id="adsType"><option value="Banner Ad">Banner Ad</option><option value="Category Spotlight">Category Spotlight</option><option value="Custom Campaign">Custom Campaign</option></select></div>'
        +'<div class="fg"><div class="fl">Message</div><textarea class="fi" rows="4" id="adsMsg" placeholder="Tell us about your product or service and what you\'d like to achieve..."></textarea></div>'
        +'<button onclick="H._submitAdsEnquiry()" style="width:100%;padding:15px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">Send Enquiry</button>'
        +'</div>'
        +'<div class="about-card" style="text-align:center">'
        +'<div class="about-sec-title">Prefer WhatsApp?</div>'
        +'<div class="about-body" style="margin-bottom:12px">Chat with us directly on WhatsApp and we\'ll get back to you quickly.</div>'
        +'<button onclick="window.open(\'https://wa.me/971589772645?text=Hi%2C%20I%27m%20interested%20in%20advertising%20on%20PaMarket\',\'_blank\')" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#25D366;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>Chat on WhatsApp</button>'
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

    const activeAds=(this.state.listings||[]).filter(l=>l.sellerId===u.id&&l.status==='active'&&!l.businessId).length;
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
      ${item('About PaMarket','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>','About','')}
      ${item('Settings',I.settings,'Settings','')}
      ${item('Security & Password','<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>','SecuritySettings','')}
      ${item('Help & Support',I.help,'Help','')}
      <button class="sheet-item danger" onclick="H.closeSheet();setTimeout(()=>H.logout(),50)">
        <span class="sheet-icon">${I.logout}</span>
        <span class="sheet-label">Sign Out</span>
      </button>
      <div style="text-align:center;font-size:11px;color:var(--sub);padding:6px 0 2px">PaMarket v${H.APP_VERSION}</div>
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
        <span onclick="H.authShowDoc('terms')" style="color:var(--blue);cursor:pointer;text-decoration:underline">Terms &amp; Conditions</span>,
        <span onclick="H.authShowDoc('privacy')" style="color:var(--blue);cursor:pointer;text-decoration:underline">Privacy Policy</span>
        and
        <span onclick="H.authShowDoc('guidelines')" style="color:var(--blue);cursor:pointer;text-decoration:underline">Community Guidelines</span>
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
    // One-time cleanup: evict other localStorage keys that may hold stale large data
    // from previous app versions (search cache, image cache, etc.).
    try {
      ['pamarket_search_cache','pamarket_img_cache'].forEach(function(k){
        try { localStorage.removeItem(k); } catch(_){}
      });
    } catch(_) {}
    // Reusable error logger — console + error_logs table. Use H.logError(context, err)
    // in catch blocks instead of swallowing failures silently.
    window.H.logError = function(context, err, code) {
      try {
        console.warn('[PaMarket]', code ? '['+code+']' : '', context, err || '');
        var stack = (err && err.stack) ? String(err.stack).slice(0,600) : (err ? String(err).slice(0,600) : '');
        var sb = window.supabase;
        if (sb && typeof sb.from === 'function') {
          sb.from('error_logs').insert({ type: 'app', message: (code ? code+' — ' : '') + String(context).slice(0,300), source: 'pamarket', stack: stack, user_agent: (navigator && navigator.userAgent) ? String(navigator.userAgent).slice(0,300) : '', created_at: new Date().toISOString() }).then(function(){}, function(){});
        }
      } catch(e) {}
    };

    // Generate a short, shareable error code (e.g. PM-K3F9). The same code is
    // shown to the user AND written to error_logs, so a reported code can be
    // traced back to the exact failure.
    window.H.errCode = function() {
      var c = '';
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (var i=0;i<4;i++) c += chars[Math.floor(Math.random()*chars.length)];
      return 'PM-' + c;
    };

    // Surface a failure to the user with a traceable code, and log it.
    // Throttled so a burst of errors shows just one banner. Pass userMsg=null
    // for the default "Something didn't respond" wording.
    window.H.showError = function(userMsg, err, context) {
      var code = window.H.errCode();
      window.H.logError(context || userMsg || 'showError', err, code);
      var now = Date.now();
      if (window.H._lastErrAt && (now - window.H._lastErrAt) < 4000) return code; // throttle visible banners
      window.H._lastErrAt = now;
      var msg = (userMsg || 'Something didn’t respond. Please try again.') + ' (Code: ' + code + ')';
      try { window.H.toast(msg, 6000, true); } catch(e) {}
      return code;
    };

    // Wrap a promise with a timeout so a request that never responds surfaces a
    // visible error code instead of spinning forever.
    window.H.withTimeout = function(promise, ms, label) {
      return new Promise(function(resolve, reject) {
        var done = false;
        var t = setTimeout(function() {
          if (done) return; done = true;
          var e = new Error('Timed out: ' + (label || 'request'));
          e._timeout = true;
          reject(e);
        }, ms || 20000);
        Promise.resolve(promise).then(function(v){ if(done) return; done=true; clearTimeout(t); resolve(v); },
          function(err){ if(done) return; done=true; clearTimeout(t); reject(err); });
      });
    };

    // Benign rejections we never want to nag the user about. These are still
    // logged to error_logs (for diagnosis) — we just don't slam a red toast over
    // an unrelated screen. They're background noise the user can't act on:
    // network flaps on mobile, realtime reconnects, image loads, browser quirks,
    // and the conversations.id uuid mismatch we resolve at the DB layer.
    function isBenignError(err) {
      if (!err) return true;
      var name = err.name || '';
      var msg  = String(err.message || err);
      if (name === 'AbortError') return true;
      // Network blips — on mobile the radio drops constantly; navigator.onLine
      // is unreliable, so treat these as benign regardless of its value.
      if (/Load failed|NetworkError|Failed to fetch|network ?error|ERR_NETWORK|ERR_INTERNET|fetch failed/i.test(msg)) return true;
      // Supabase/Postgres transient sync errors (e.g. the conversations.id
      // uuid↔text mismatch) — fixed at the DB, never actionable by the user.
      if (/invalid input syntax for type uuid|JWT expired|PGRST|supabase|realtime/i.test(msg)) return true;
      // Browser/runtime noise that never reflects a real app failure.
      if (/ResizeObserver loop|Script error\.?$|^Object$|^undefined$|^null$/i.test(msg)) return true;
      return false;
    }

    window.onerror = function(msg, src, line, col, err) {
      var code = window.H && window.H.errCode ? window.H.errCode() : '';
      if (window.H && window.H.logError) window.H.logError('onerror ' + (src ? src + ':' + line : '') + ' — ' + msg, err, code);
      if (window.H && window.H.showError && err && !isBenignError(err)) {
        var now = Date.now();
        if (!(window.H._lastErrAt && (now - window.H._lastErrAt) < 4000)) {
          window.H._lastErrAt = now;
          try { window.H.toast('Something went wrong. Please try again. (Code: ' + code + ')', 6000, true); } catch(e) {}
        }
      }
    };
    // Catch unhandled promise rejections (most async failures land here).
    window.addEventListener('unhandledrejection', function(ev) {
      var err = ev && ev.reason;
      var code = window.H && window.H.errCode ? window.H.errCode() : '';
      if (window.H && window.H.logError) window.H.logError('unhandledrejection', err, code);
      if (window.H && window.H.showError && !isBenignError(err)) {
        var now = Date.now();
        if (!(window.H._lastErrAt && (now - window.H._lastErrAt) < 4000)) {
          window.H._lastErrAt = now;
          var note = (err && err._timeout) ? 'Something didn’t respond. Please try again.' : 'Something went wrong. Please try again.';
          try { window.H.toast(note + ' (Code: ' + code + ')', 6000, true); } catch(e) {}
        }
      }
    });

    // Hide the bottom tab bar while a text field is focused, so the on-screen
    // keyboard doesn't shove the nav up into the middle of the screen.
    (function() {
      var TEXTY = { text:1, search:1, email:1, tel:1, url:1, number:1, password:1, '':1 };
      function isTextField(el) {
        if (!el) return false;
        if (el.tagName === 'TEXTAREA') return true;
        if (el.tagName === 'INPUT') return !!TEXTY[(el.getAttribute('type') || 'text').toLowerCase()];
        return false;
      }
      document.addEventListener('focusin', function(e) {
        if (isTextField(e.target)) document.body.classList.add('kb-open');
      });
      document.addEventListener('focusout', function() {
        setTimeout(function() {
          if (!isTextField(document.activeElement)) document.body.classList.remove('kb-open');
        }, 120);
      });
    })();
    this._registerCategoryView();
    this._registerExtraPages();
    setTimeout(()=>{},800);

    document.addEventListener('DOMContentLoaded',()=>{
      window._hideSplash = function() {
        // Hold the PaMarket brand on screen for a brief, deliberate moment, then
        // fade out — even though the app is ready almost instantly. Gives the
        // polished "show brand, then glide in" feel instead of a jarring flash.
        var MIN_SPLASH_MS = 1000;
        var elapsed = Date.now() - (window._splashStart || Date.now());
        var wait = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(function() {
          var splash = document.getElementById('pamarketSplash');
          if (splash && !splash.classList.contains('hiding')) {
            splash.classList.add('hiding');
            setTimeout(function() { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 450);
          }
          var SS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen;
          if (SS) { try { SS.hide({ fadeOutDuration: 300 }); } catch(e){} }
        }, wait);
      };
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

// God-mode unlock — rapid-tap the PaMarket logo 7 times to open the admin panel
(function(){
  var _count = 0;
  var _timer = null;
  H.logoTap = function() {
    _count++;
    clearTimeout(_timer);
    _timer = setTimeout(function(){ _count = 0; }, 2000);
    if (_count >= 7) {
      _count = 0;
      var u = typeof H.currentUser === 'function' ? H.currentUser() : null;
      if (u && u.role === 'admin') {
        H.state.adminSession = true;
        H.navTo('Admin', null);
      } else {
        H.toast('Access denied');
      }
    }
  };
})();

// Deep link router — called when user taps a push notification
// Route a deep link, but wait until the app is booted (cold start from a
// notification tap can fire before navTo/state exist).
H._routeDeepLinkWhenReady = function(route, attempts) {
  attempts = attempts || 0;
  if (route && typeof H.navTo === 'function' && H.state && typeof H.openInner === 'function') {
    H._handleDeepLink(route);
  } else if (attempts < 40) {
    setTimeout(function(){ H._routeDeepLinkWhenReady(route, attempts + 1); }, 250);
  }
};

// Route a notification-tray tap from the full push payload. Waits for the app to
// boot (cold start) before acting.
H._routeNotifTapWhenReady = function(data, attempts) {
  attempts = attempts || 0;
  if (typeof H.navTo === 'function' && H.state && typeof H.openInner === 'function') {
    H._handleNotifTap(data || {});
  } else if (attempts < 40) {
    setTimeout(function(){ H._routeNotifTapWhenReady(data, attempts + 1); }, 250);
  }
};

H._handleNotifTap = function(data) {
  data = data || {};
  var type = data.type || '';
  var link = data.deepLink || data.deep_link || '';
  var NAV  = { message:1, sale:1, boost:1, verify:1, review:1, ban:1, report:1 };
  // Broadcast / info / announcement → open the detail (full message + image)
  // straight from the payload. Land on Notifications so Close returns there.
  if (type && !NAV[type] && (data.title || data.body || data.image || data.imageUrl)) {
    if (typeof H._openNotifDetailFromData === 'function') {
      H.navTo('Notifications');
      setTimeout(function(){ H._openNotifDetailFromData(data); }, 220);
      return;
    }
  }
  // Otherwise use the deep link (chat/listing/named page), or fall back to the list.
  H._handleDeepLink(link || 'Notifications');
};

H._handleDeepLink = function(route) {
  if (!route) return;
  if (route.startsWith('listing:')) {
    H.openListing(route.split(':')[1]);
  } else if (route.startsWith('chat:')) {
    H.openInner('Chat', { id: route.split(':')[1] });
  } else {
    // Named pages: whitelist to prevent arbitrary navigation via deep links
    var allowed = ['Home','Browse','Post','Account','Messages','Notifications'];
    if (allowed.indexOf(route) !== -1) H.navTo(route);
  }
};

// ── In-app "Rate Our App" prompt ──────────────────────────
// Shown to users who haven't rated yet, after they've used the app a few times.
// "Rate Now" opens the Play Store listing (rating). "Later" snoozes ~5 days.
// State is kept in localStorage (survives logout / state resets).
H.maybeShowRatingPrompt = function() {
  try {
    if (H._rateChecked) return;            // once per app session
    H._rateChecked = true;
    var LS = window.localStorage; if (!LS) return;
    if (LS.getItem('pm_rate_done') === '1') return;     // already rated
    var opens = (parseInt(LS.getItem('pm_rate_opens') || '0', 10) || 0) + 1;
    LS.setItem('pm_rate_opens', String(opens));
    if (opens < 3) return;                  // let them use the app a bit first
    var snooze = parseInt(LS.getItem('pm_rate_snooze') || '0', 10) || 0;
    if (snooze && Date.now() - snooze < 5 * 86400000) return;   // "Later" = wait 5 days
    setTimeout(function(){ H._showRatingPrompt(); }, 1800);     // let the screen settle
  } catch(e) {}
};

H._showRatingPrompt = function() {
  if (document.getElementById('rateAppModal')) return;
  // Don't stack on top of another sheet/modal.
  if (document.querySelector('.action-sheet.open') || document.querySelector('.sheet-bg.open')) return;
  var ov = document.createElement('div');
  ov.id = 'rateAppModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(16,24,40,.5);z-index:9600;display:flex;align-items:center;justify-content:center;padding:24px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)';
  ov.innerHTML =
    '<div style="background:var(--card);border-radius:20px;max-width:340px;width:100%;padding:26px 22px 18px;text-align:center;box-shadow:0 20px 60px rgba(16,24,40,.32);font-family:Inter,sans-serif">'
    + '<div style="font-size:36px;line-height:1;margin-bottom:8px">⭐</div>'
    + '<div style="font-size:19px;font-weight:800;color:var(--text);margin-bottom:8px">Rate Our App</div>'
    + '<div style="font-size:14px;color:var(--sub);line-height:1.55;margin-bottom:22px">Enjoying the app? Your rating helps us improve and reach more users.</div>'
    + '<button onclick="H.openAppRating()" style="width:100%;padding:13px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:8px">Rate Now</button>'
    + '<button onclick="H._dismissRating()" style="width:100%;padding:11px;background:transparent;color:var(--sub);border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Later</button>'
    + '</div>';
  ov.addEventListener('click', function(e){ if (e.target === ov) H._dismissRating(); });
  document.body.appendChild(ov);
};

H._dismissRating = function() {
  var ov = document.getElementById('rateAppModal'); if (ov) ov.remove();
  try { window.localStorage.setItem('pm_rate_snooze', String(Date.now())); } catch(e) {}
};

H.openAppRating = function() {
  try { window.localStorage.setItem('pm_rate_done', '1'); } catch(e) {}
  var ov = document.getElementById('rateAppModal'); if (ov) ov.remove();
  var url = 'https://play.google.com/store/apps/details?id=com.pamarket.app';
  try {
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    // On Android the https Play link opens the Play Store app straight on the
    // listing (where the rating stars are). '_system' routes it out of the WebView.
    window.open(url, native ? '_system' : '_blank');
  } catch(e) { try { window.open(url, '_blank'); } catch(e2){} }
};

// ── Web Push subscription ─────────────────────────────────
(function() {
  function _b64ToUint8(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  var VAPID_PUBLIC = 'BLvNYB1n3GhDxaVExMavxUemiy58qfz9u-L5cRjsLja-k2uPCF6SU-nYdfbC-XpMmyU1kALGPqbN0d6j9piU0F0';

  function _isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }

  // Native (installed app): register for FCM and save push_token.
  // The Android WebView does not support the Web Push API, so the app
  // must use the Capacitor PushNotifications plugin (FCM under the hood).
  async function _setupNativePush(c, u) {
    var PN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if (!PN) return;

    var perm = await PN.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PN.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    if (!H._nativePushListeners) {
      H._nativePushListeners = true;

      PN.addListener('registration', function(token) {
        if (!token || !token.value) return;
        c.from('profiles').update({ push_token: token.value }).eq('id', u.id)
          .then(function(r) { if (r && r.error) console.warn('push_token save:', r.error.message); });
      });

      PN.addListener('registrationError', function(err) {
        console.warn('FCM registration error:', err && err.error);
      });

      // Android 8+ only shows pushes on a registered channel. Create the one
      // the server targets (channel_id: 'pamarket_default') so message
      // notifications reliably appear on the lock screen / tray.
      if (typeof PN.createChannel === 'function') {
        PN.createChannel({
          id: 'pamarket_default',
          name: 'Messages & Alerts',
          description: 'New messages and account activity',
          importance: 5,   // HIGH — heads-up banner + sound
          visibility: 1,   // show on lock screen
          sound: 'default',
          vibration: true,
          lights: true
        }).catch(function(){ /* best-effort */ });
      }

      // User tapped a notification — open broadcasts straight to their detail
      // (full message + image) from the payload, else follow the deep link, else
      // open the Notifications list. Wrapped so a cold start waits until ready.
      PN.addListener('pushNotificationActionPerformed', function(action) {
        var data = (action && action.notification && action.notification.data) || {};
        H._routeNotifTapWhenReady(data);
      });
    }

    await PN.register();
  }

  // Web / PWA: use Web Push (VAPID) and save push_subscription.
  async function _setupWebPush(c, u) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();

    if (!sub) {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _b64ToUint8(VAPID_PUBLIC)
      });
    }

    var subJson = JSON.stringify(sub.toJSON());
    c.from('profiles').update({ push_subscription: subJson }).eq('id', u.id)
      .then(function(r) { if (r && r.error) console.warn('push_sub save:', r.error.message); });
  }

  H.setupPush = async function() {
    try {
      var u = H.currentUser(); if (!u) return;
      var c = window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
      if (!c) return;

      if (_isNative()) {
        await _setupNativePush(c, u);
      } else {
        await _setupWebPush(c, u);
      }
    } catch(e) {
      console.warn('Push setup:', e.message);
    }
  };

  // Current notification permission: 'granted' | 'denied' | 'prompt' | 'unsupported'
  H.notifStatus = async function() {
    try {
      if (_isNative()) {
        var PN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
        if (!PN) return 'unsupported';
        var p = await PN.checkPermissions();
        var r = p && p.receive;
        return (r === 'prompt-with-rationale') ? 'prompt' : (r || 'prompt');
      }
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    } catch (e) { return 'unsupported'; }
  };

  // Ask the user to enable notifications (from the in-app banner / button).
  H.promptEnableNotifications = async function() {
    var status = await H.notifStatus();
    if (status === 'granted') { H.toast('Notifications are already on'); H._refreshNotifBanner(); return; }
    if (status === 'unsupported') { H.toast('Notifications are not supported on this device'); return; }
    if (status === 'denied') {
      // Permanently blocked — the OS won't show the prompt again; guide to settings.
      if (typeof H.modal === 'function') {
        H.modal({
          title: 'Turn on notifications',
          body: '<div style="font-size:13.5px;color:var(--sub);line-height:1.7">Notifications are turned off for PaMarket. To get message alerts:<br><br><b style="color:var(--text)">Phone Settings → Apps → PaMarket → Notifications → Allow</b></div>',
          confirmText: 'Got it', cancelText: null
        });
      } else {
        H.toast('Enable notifications in Settings → Apps → PaMarket', 4000);
      }
      return;
    }
    // 'prompt' → trigger the system permission request + token registration
    await H.setupPush();
    var after = await H.notifStatus();
    if (after === 'granted') H.toast('Notifications enabled');
    H._refreshNotifBanner();
  };

  // Fill #notifEnableBanner with a nudge card when notifications aren't on.
  H.maybeShowNotifBanner = async function() {
    var el = document.getElementById('notifEnableBanner');
    if (!el) return;
    if (H._notifBannerDismissed) { el.innerHTML = ''; return; }
    if (!H.currentUser()) { el.innerHTML = ''; return; }
    var status = await H.notifStatus();
    if (status === 'granted' || status === 'unsupported') { el.innerHTML = ''; return; }
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;background:var(--blue-light);border:1px solid rgba(26,58,143,.18);border-radius:14px;padding:13px 14px;margin:12px 14px">'
      + '<div style="width:38px;height:38px;border-radius:11px;background:rgba(26,58,143,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">'
      + '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#1A3A8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--text)">Turn on notifications</div>'
      + '<div style="font-size:12px;color:var(--sub);line-height:1.4;margin-top:1px">Get alerted the moment someone messages you.</div></div>'
      + '<button onclick="H.promptEnableNotifications()" style="flex-shrink:0;background:#1A3A8F;color:#fff;border:none;border-radius:10px;padding:9px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">Enable</button>'
      + '<button onclick="H._dismissNotifBanner()" aria-label="Dismiss" style="flex-shrink:0;background:none;border:none;color:var(--sub);cursor:pointer;padding:4px;display:flex"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
      + '</div>';
  };
  H._dismissNotifBanner = function() { H._notifBannerDismissed = true; var el = document.getElementById('notifEnableBanner'); if (el) el.innerHTML = ''; };
  H._refreshNotifBanner = function() { try { H.maybeShowNotifBanner(); } catch (e) {} };

  // Handle deeplink sent from the service worker when user taps a notification
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (!event.data) return;
      if (event.data.type === 'notif-tap') {
        H._routeNotifTapWhenReady(event.data.data || {});
      } else if (event.data.type === 'deeplink' && event.data.route) {
        H._handleDeepLink(event.data.route);
      }
    });
  }
})();

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
