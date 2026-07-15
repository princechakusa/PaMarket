'use strict';
(function (H) {

  // Coerce a CV field to an array. Profile data can arrive as a string (older
  // shapes, partial cloud rows, manual edits); calling .map on a string would
  // throw and crash the whole Hire Talent page to "Page not found". This keeps
  // every candidate render defensive.
  function _arr(v) { return Array.isArray(v) ? v : []; }

  var JOB_CATS = ['Accounting & Finance', 'Sales & Marketing', 'IT & Technology', 'Construction', 'Healthcare', 'Education', 'Hospitality', 'Administration', 'Engineering', 'Driving & Logistics'];

  // Granular profession list (Zim-flavoured) used by the Get Hired wizard.
  var JOB_PROFESSIONS = [
    'Accounting / Finance', 'Administration / Office', 'Agriculture / Farming',
    'Automobile / Mechanic', 'Beauty / Salon / Spa', 'Cleaning / Housekeeping',
    'Construction / Building', 'Cook / Chef / Catering', 'Customer Service / Call Centre',
    'Data / IT / Software', 'Design / Creative', 'Driver / Delivery',
    'Education / Teaching', 'Engineering', 'Events / Hospitality',
    'General Worker / Labour', 'Healthcare / Medical', 'Human Resources',
    'Legal', 'Logistics / Warehouse', 'Marketing / Sales', 'Media / Journalism',
    'NGO / Development', 'Retail / Shop Assistant', 'Security / Guard',
    'Tailoring / Textiles', 'Tourism / Travel', 'Trades (Plumber, Electrician, Welder)',
    'Other'
  ];
  H.JOB_PROFESSIONS = JOB_PROFESSIONS;

  function parseLine(lines, key) {
    var found = lines.find(function (ln) { return ln.startsWith(key + ':'); });
    return found ? found.slice(key.length + 1).trim() : '';
  }

  function _jobLogo(logoSrc, initials, size) {
    var s = size || 44;
    return '<div style="width:' + s + 'px;height:' + s + 'px;min-width:' + s + 'px;border-radius:10px;flex-shrink:0;background:#EEF2FB;display:flex;align-items:center;justify-content:center;font-size:' + Math.round(s * 0.34) + 'px;font-weight:800;color:#1A3A8F;border:1px solid #E8ECF4;overflow:hidden">'
      + (logoSrc ? '<img src="' + logoSrc + '" style="width:' + s + 'px;height:' + s + 'px;max-width:' + s + 'px;max-height:' + s + 'px;object-fit:cover;display:block" onerror="this.parentNode.innerHTML=\'' + H.escHtml(initials) + '\'">' : H.escHtml(initials))
      + '</div>';
  }

  function jobCard(l) {
    var lines    = (l.desc || '').split('\n');
    var company  = l.company || l.sellerName || parseLine(lines, 'COMPANY') || 'Company';
    var jobType  = parseLine(lines, 'JOB TYPE') || '';
    var salary   = parseLine(lines, 'SALARY') || '';
    var seller   = (H.state.users || []).find(function(u){ return u.id === l.sellerId; });
    var sellerBiz = (H.state.businesses || []).find(function(b){ return b.ownerUserId === l.sellerId && b.status === 'active'; });
    var logoSrc  = (sellerBiz && sellerBiz.logo) || (seller && seller.avatar) || '';
    var initials = company.split(' ').slice(0,2).map(function(w){ return w[0] || ''; }).join('').toUpperCase() || 'JB';
    var u        = H.currentUser();
    var apps     = (H.state.applications || []).filter(function(a){ return a.jobId === l.id; });
    var applied  = u && apps.some(function(a){ return a.applicantId === u.id; });

    var icoClock = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    var icoMoney = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
    var icoPin   = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

    return '<div onclick="H.openInner(\'JobDetail\',{id:\'' + l.id + '\'})" style="background:var(--card,#fff);border-radius:14px;border:1px solid var(--border,#e8ecf4);margin-bottom:10px;cursor:pointer;padding:14px 16px">'
      + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">'
      + _jobLogo(logoSrc, initials, 58)
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:15.5px;font-weight:700;color:var(--text,#111827);line-height:1.3;margin-bottom:3px">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:13px;font-weight:600;color:#1A3A8F;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(company) + '</div>'
      + (applied ? '<span style="display:inline-block;margin-top:5px;font-size:11px;font-weight:700;color:#15803d;background:#f0fdf4;padding:2px 8px;border-radius:20px">&#10003; Applied</span>' : '')
      + '</div>'
      + '</div>'
      + (jobType ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' + icoClock + '<span style="font-size:13.5px;color:#6b7280">' + H.escHtml(jobType) + '</span></div>' : '')
      + (salary  ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' + icoMoney + '<span style="font-size:13.5px;color:#6b7280">' + H.escHtml(salary) + '</span></div>' : '')
      + (l.city  ? '<div style="display:flex;align-items:center;gap:8px">' + icoPin + '<span style="font-size:13.5px;color:#6b7280">' + H.escHtml(l.city) + '</span></div>' : '')
      + '</div>';
  }

  // Entry chooser shown when you tap "Jobs" — two doors, each with its own
  // sub-actions (matches the Get Hired / I'm Hiring tree).
  H.pages.JobIntent = function () {
    var icSeeker = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    var icBriefcase = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1A3A8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
    var chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9CA3AF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    var icJob = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
    var icPerson = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    var icPeople = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1A3A8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    var icSend = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1A3A8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    function gchip(icon, label, onclick) {
      return '<button onclick="event.stopPropagation();' + onclick + '" style="display:inline-flex;align-items:center;gap:5px;background:#fff;border:1.5px solid #bbf7d0;color:#16a34a;font-size:12px;font-weight:600;padding:7px 13px;border-radius:20px;cursor:pointer;font-family:inherit">' + icon + label + '</button>';
    }
    function nchip(icon, label, onclick) {
      return '<button onclick="event.stopPropagation();' + onclick + '" style="display:inline-flex;align-items:center;gap:5px;background:#fff;border:1.5px solid #c7d2fe;color:#1A3A8F;font-size:12px;font-weight:600;padding:7px 13px;border-radius:20px;cursor:pointer;font-family:inherit">' + icon + label + '</button>';
    }
    var card = 'background:#fff;border:1px solid #E8EBF2;border-radius:18px;padding:20px;margin-bottom:14px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.06)';
    return '<div class="page active" style="background:#F5F7FC">'
      + '<div class="det-topbar" style="background:#F5A623">'
      + '<button class="back" onclick="H.goBack()" style="color:#1A3A8F"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title" style="color:#1A3A8F">Jobs</div>'
      + '<div style="width:40px"></div></div>'
      + '<div style="padding:22px 16px 32px">'
      + '<div style="font-size:23px;font-weight:900;color:var(--text);margin-bottom:4px;letter-spacing:-.4px">What brings you here?</div>'
      + '<div style="font-size:13.5px;color:var(--sub);margin-bottom:20px">Choose how you want to use PaMarket Jobs.</div>'

      // ── Get Hired ──
      + '<div onclick="H.openInner(\'FindJobs\')" style="' + card + '">'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'
      + '<div style="width:50px;height:50px;border-radius:14px;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icSeeker + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800;color:#111827">Get Hired</div><div style="font-size:12.5px;color:#6B7280;line-height:1.45;margin-top:2px">Browse jobs across Zimbabwe and apply in seconds.</div></div>'
      + '<div>' + chev + '</div></div>'
      + '<div style="height:1px;background:#F3F4F6;margin-bottom:14px"></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">'
      + gchip(icJob, 'Browse Jobs', "H.openInner('FindJobs')")
      + gchip(icPerson, 'My Applications', "H.openInner('AppliedJobs')")
      + gchip(icPerson, 'My Profile', "H._getHired()")
      + '</div></div>'

      // ── I'm Hiring ──
      + '<div onclick="H.openInner(\'HireTalent\')" style="' + card + 'margin-bottom:0">'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'
      + '<div style="width:50px;height:50px;border-radius:14px;background:#e0e7ff;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icBriefcase + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800;color:#111827">I\'m Hiring</div><div style="font-size:12.5px;color:#6B7280;line-height:1.45;margin-top:2px">Browse available candidates and find the right person.</div></div>'
      + '<div>' + chev + '</div></div>'
      + '<div style="height:1px;background:#F3F4F6;margin-bottom:14px"></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">'
      + nchip(icPeople, 'Browse Candidates', "H.openInner('HireTalent')")
      + nchip(icPeople, 'My Requests', "H.openInner('MyContactRequests')")
      + nchip(icSend, 'Post a Job', "H.openInner('PostJob')")
      + nchip(icBriefcase, 'Recruiter Plan', "H.openInner('RecruiterSubscription')")
      + '</div></div>'
      + '</div></div>';
  };

  // Entry for the Get Hired wizard.
  H._getHired = function () {
    if (!H.currentUser()) { H.requireAuth('Sign in to create your job profile'); return; }
    H.openInner('JobSeekerLocation');
  };

  // Get Hired step 1 — where do you want to work / be found?
  H.pages.JobSeekerLocation = function () {
    var ZW = H._ZW_CITIES || ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Kwekwe', 'Masvingo', 'Chinhoyi', 'Marondera'];
    var u = H.currentUser();
    var cur = (u && u.city) || '';
    var chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    var check = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#15803d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var opts = ['Anywhere in Zimbabwe'].concat(ZW).concat(['Remote / Online']);
    var rows = opts.map(function (c) {
      var val = c === 'Anywhere in Zimbabwe' ? 'Any' : c;
      var on = cur === val || (c === 'Anywhere in Zimbabwe' && !cur);
      return '<button class="subcat-row" onclick="H.openInner(\'JobSeekerProfession\',{city:\'' + H.escHtml(val) + '\'})">'
        + '<span>' + H.escHtml(c) + '</span>' + (on ? check : chev) + '</button>';
    }).join('');
    return '<div class="page active">'
      + H.innerTopbar('Get Hired')
      + '<div class="picker-intro"><div class="picker-step">Step 1 of 2</div><div class="picker-title">Where do you want to work?</div><div class="picker-sub">Pick the location where you want employers to find you.</div></div>'
      + '<div class="subcat-list">' + rows + '</div></div>';
  };

  // Get Hired step 2 — choose your profession.
  H.pages.JobSeekerProfession = function (params) {
    var city = (params && params.city) || 'Any';
    var cityLabel = city === 'Any' ? 'Anywhere in Zimbabwe' : city;
    var u = H.currentUser();
    var cur = (u && u.sector) || '';
    var chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    var check = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#15803d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var rows = JOB_PROFESSIONS.map(function (p) {
      var on = cur === p;
      return '<button class="subcat-row" onclick="H.openInner(\'CandidateProfile\',{city:\'' + H.escHtml(city) + '\',sector:\'' + H.escHtml(p).replace(/'/g, "\\'") + '\'})">'
        + '<span>' + H.escHtml(p) + '</span>' + (on ? check : chev) + '</button>';
    }).join('');
    return '<div class="page active">'
      + H.innerTopbar('Get Hired')
      + '<div class="picker-intro"><div class="picker-step">Step 2 of 2</div><div class="picker-title">Choose your profession</div>'
      + '<div class="picker-crumb"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + H.escHtml(cityLabel) + '</div></div>'
      + '<div class="subcat-list">' + rows + '</div></div>';
  };

  H.pages.Jobs = function () {
    var jobs = (H.state.listings || []).filter(function (l) { return l.status === 'active' && (l.cat||'').toLowerCase() === 'jobs'; });
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
      + '<input placeholder="Search job title, company, skills…" autocomplete="off" oninput="H.openInner(\'JobResults\',{q:this.value})" style="flex:1;border:none;outline:none;padding:14px 0;font-size:14px;background:transparent;color:#1A3A8F;font-family:Inter,sans-serif"></div>'
      + '</div>'
      + (H.adCarousel && H.activeAds ? H.adCarousel(H.activeAds('jobs')) : '')
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
        var cnt = _catCount(jobs, cat);
        return '<div onclick="H.openInner(\'JobResults\',{cat:\'' + cat + '\'})" style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text)">' + H.escHtml(cat) + '<span style="color:var(--sub);margin-left:4px">(' + cnt + ')</span></div>';
      }).join('')
      + '</div></div>'
      + (recent.length ? '<div style="padding:0 14px 16px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
        + '<div style="font-size:15px;font-weight:800;color:var(--text)">Recent Openings</div>'
        + '<button onclick="H.openInner(\'JobResults\')" style="background:none;border:none;color:#1A3A8F;font-size:12px;font-weight:700;cursor:pointer;padding:0">View All →</button>'
        + '</div>' + recent.map(jobCard).join('') + '</div>' : '')
      + '<div style="margin:0 14px 88px;background:linear-gradient(135deg,#1A3A8F,#0f2460);border-radius:16px;padding:20px">'
      + '<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:6px">Hiring? Post a Job Free</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.7);margin-bottom:14px">Reach thousands of qualified candidates across Zimbabwe</div>'
      + '<button onclick="H.openInner(\'PostJob\')" style="background:#F5A623;border:none;color:#1A3A8F;font-size:14px;font-weight:800;padding:12px 24px;border-radius:10px;cursor:pointer">Post a Job →</button>'
      + '</div></div>';
  };

  H.pages.Jobs_after = function () {
    if (H._initAdCarousels) H._initAdCarousels();
    if (typeof H.fetchJobsFromSupabase === 'function') H.fetchJobsFromSupabase().catch(function(){});
  };

  // ── Job taxonomy used across the discovery page ───────────────
  var JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
  var JOB_QUALS = [
    { key: 'none',        label: 'No formal qualification', match: ['no formal', 'no qualification', 'general worker'] },
    { key: 'certificate', label: 'Certificate / Diploma',   match: ['certificate', 'diploma'] },
    { key: 'degree',      label: 'Degree',                  match: ['degree', 'bachelor', 'bsc', 'ba '] },
    { key: 'postgrad',    label: 'Postgraduate',            match: ['postgrad', 'masters', 'msc', 'mba', 'phd'] }
  ];

  // Icon paths and accent colors per job category.
  var JOB_CAT_ICON = {
    'Accounting & Finance': '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    'Sales & Marketing':    '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-5"/>',
    'IT & Technology':      '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    'Construction':         '<path d="M2 20h20M4 20V8l8-5 8 5v12M9 20v-6h6v6"/>',
    'Healthcare':           '<path d="M19 14a7 7 0 11-14 0 7 7 0 0114 0z"/><path d="M12 8v4M10 10h4"/>',
    'Education':            '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5"/>',
    'Hospitality':          '<path d="M3 11h18M5 11V7a7 7 0 0114 0v4M4 11v3a8 8 0 0016 0v-3"/>',
    'Administration':       '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    'Engineering':          '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z"/>',
    'Driving & Logistics':  '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>'
  };
  var JOB_CAT_COLOR = {
    'Accounting & Finance': 'linear-gradient(135deg,#1A3A8F,#2952cc)',
    'Sales & Marketing':    'linear-gradient(135deg,#F5A623,#e8910a)',
    'IT & Technology':      'linear-gradient(135deg,#0ea5e9,#0284c7)',
    'Construction':         'linear-gradient(135deg,#78716c,#57534e)',
    'Healthcare':           'linear-gradient(135deg,#ef4444,#dc2626)',
    'Education':            'linear-gradient(135deg,#8b5cf6,#7c3aed)',
    'Hospitality':          'linear-gradient(135deg,#f97316,#ea580c)',
    'Administration':       'linear-gradient(135deg,#14b8a6,#0d9488)',
    'Engineering':          'linear-gradient(135deg,#6366f1,#4f46e5)',
    'Driving & Logistics':  'linear-gradient(135deg,#22c55e,#16a34a)'
  };

  function _activeJobs() {
    return (H.state.listings || []).filter(function (l) { return l.status === 'active' && (l.cat || '').toLowerCase() === 'jobs'; });
  }
  function _jobIndustry(l) { return parseLine((l.desc || '').split('\n'), 'INDUSTRY') || l.subcat || ''; }
  function _jobTypeOf(l)   { return parseLine((l.desc || '').split('\n'), 'JOB TYPE') || ''; }
  // A job belongs to a category when its stored INDUSTRY matches exactly, or
  // ANY significant token (≥3 chars) from the category name matches as a whole
  // word in the title/description. Trying all tokens handles categories like
  // "IT & Technology" where the first token "IT" is only 2 chars.
  function _jobInCat(l, cat) {
    if (_jobIndustry(l) === cat) return true;
    var hay = (l.title + ' ' + (l.desc || '')).toLowerCase();
    return cat.split(/\s*&\s*|\s+/).some(function (part) {
      var tok = part.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '');
      if (tok.length < 3) return false;
      return new RegExp('\\b' + tok + '\\b').test(hay);
    });
  }
  function _catCount(jobs, cat) {
    return jobs.filter(function (l) { return _jobInCat(l, cat); }).length;
  }

  // ── Find Jobs: professional discovery landing ─────────────────
  H.pages.FindJobs = function () {
    var jobs = _activeJobs().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var popular = jobs.slice(0, 8);

    var catCards = JOB_CATS.map(function (cat) {
      var cnt = _catCount(jobs, cat);
      var icon = JOB_CAT_ICON[cat] || '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>';
      var grad = JOB_CAT_COLOR[cat] || 'linear-gradient(135deg,#1A3A8F,#2952cc)';
      return '<div onclick="H.openInner(\'JobResults\',{cat:\'' + cat + '\'})" style="background:var(--card);border:1px solid var(--border);border-radius:14px;cursor:pointer;overflow:hidden">'
        + '<div style="background:' + grad + ';padding:18px 0;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></div>'
        + '<div style="padding:10px 11px 11px"><div style="font-size:12.5px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:3px">' + H.escHtml(cat) + '</div>'
        + '<div style="font-size:11px;color:var(--sub)">' + cnt + ' job' + (cnt !== 1 ? 's' : '') + '</div></div></div>';
    }).join('');

    var typeCards = JOB_TYPES.map(function (t) {
      var cnt = jobs.filter(function (l) { return _jobTypeOf(l).toLowerCase() === t.toLowerCase(); }).length;
      return '<div onclick="H.openInner(\'JobResults\',{type:\'' + t + '\'})" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:13px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between">'
        + '<span style="font-size:13px;font-weight:700;color:var(--text)">' + t + '</span>'
        + '<span style="font-size:11px;font-weight:700;color:#1A3A8F;background:#1A3A8F12;padding:2px 8px;border-radius:10px">' + cnt + '</span></div>';
    }).join('');

    var qualIcons = {
      none:        '<path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M9 12h6M12 9v6"/>',
      certificate: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/>',
      degree:      '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5"/>',
      postgrad:    '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
    };
    var qualCards = JOB_QUALS.map(function (q) {
      var qIco = qualIcons[q.key] || qualIcons.degree;
      return '<div onclick="H.openInner(\'JobResults\',{qual:\'' + q.key + '\'})" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;text-align:center">'
        + '<div style="display:flex;justify-content:center;margin-bottom:8px"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1A3A8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + qIco + '</svg></div>'
        + '<div style="font-size:12.5px;font-weight:700;color:var(--text);line-height:1.3">' + H.escHtml(q.label) + '</div></div>';
    }).join('');

    var sectionHead = function (title, action, onclick) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
        + '<div style="font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.3px">' + title + '</div>'
        + (action ? '<button onclick="' + onclick + '" style="background:none;border:none;color:#1A3A8F;font-size:12.5px;font-weight:700;cursor:pointer;padding:0;font-family:inherit">' + action + ' →</button>' : '')
        + '</div>';
    };

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#1A3A8F">'
      + '<button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title">Find Jobs</div>'
      + '<button onclick="H.openInner(\'AppliedJobs\')" title="My Applications" style="background:rgba(255,255,255,.18);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:7px 11px;border-radius:9px">Applied</button></div>'
      // Hero
      + '<div style="background:linear-gradient(135deg,#1A3A8F 0%,#16307a 100%);padding:22px 16px 26px">'
      + '<div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-.5px;margin-bottom:6px">Job hunting made easy</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.8);margin-bottom:16px">Discover thousands of openings across Zimbabwe.</div>'
      + '<div onclick="H.openInner(\'JobResults\')" style="background:#fff;border-radius:14px;display:flex;align-items:center;padding:0 14px;gap:9px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.18)">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#999" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<span style="flex:1;padding:14px 0;font-size:14px;color:#999">Search job title, company, skills…</span></div>'
      + '</div>'
      + '<div style="padding:18px 14px 100px">'
      // Popular jobs
      + (popular.length
        ? sectionHead('Popular Jobs', 'View all', "H.openInner('JobResults')")
          + '<div style="display:flex;gap:12px;overflow-x:auto;margin:0 -14px 24px;padding:2px 14px;scrollbar-width:none">'
          + popular.map(_popularJobCard).join('')
          + '</div>'
        : '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px"><div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">No openings yet</div><div style="font-size:12.5px;color:var(--sub)">New jobs will appear here as employers post them.</div></div>')
      // Jobs by category
      + sectionHead('Jobs by Category', 'View all', "H.openInner('JobResults')")
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px">' + catCards + '</div>'
      // Jobs by type
      + sectionHead('Jobs by Type', '', '')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px">' + typeCards + '</div>'
      // Jobs by qualification
      + sectionHead('Jobs by Qualification', '', '')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px">' + qualCards + '</div>'
      // Update CV banner
      + '<div onclick="H._getHired()" style="background:linear-gradient(135deg,#22c55e,#15803d);border-radius:18px;padding:20px;cursor:pointer;display:flex;align-items:center;gap:14px">'
      + '<div style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:15.5px;font-weight:800;color:#fff;margin-bottom:3px">Update your CV</div><div style="font-size:12.5px;color:rgba(255,255,255,.85);line-height:1.4">Build your profile so employers can find you.</div></div>'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
      + '</div></div></div>';
  };

  function _popularJobCard(l) {
    var lines    = (l.desc || '').split('\n');
    var company  = l.company || l.sellerName || parseLine(lines, 'COMPANY') || 'Company';
    var jobType  = parseLine(lines, 'JOB TYPE') || '';
    var salary   = parseLine(lines, 'SALARY') || 'Negotiable';
    var _pSeller = (H.state.users || []).find(function(u){ return u.id === l.sellerId; });
    var _pBiz    = (H.state.businesses || []).find(function(b){ return b.ownerUserId === l.sellerId && b.status === 'active'; });
    var _pLogoSrc = (_pBiz && _pBiz.logo) || (_pSeller && _pSeller.avatar) || '';
    var _ini = company.split(' ').slice(0,2).map(function(w){ return w[0] || ''; }).join('').toUpperCase() || 'JB';
    var salaryColor = salary === 'Negotiable' ? '#9ca3af' : '#15803d';
    var icoPay = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    var icoPin = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

    return '<div onclick="H.openInner(\'JobDetail\',{id:\'' + l.id + '\'})" style="flex:0 0 168px;min-width:168px;background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:12px;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.06)">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">'
      + _jobLogo(_pLogoSrc, _ini, 36)
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:700;color:var(--text,#111827);line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + H.escHtml(l.title) + '</div>'
      + '</div></div>'
      + '<div style="font-size:11.5px;font-weight:600;color:#F5A623;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:9px">' + H.escHtml(company) + '</div>'
      + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
      + icoPay + '<span style="font-size:12px;font-weight:700;color:' + salaryColor + '">' + H.escHtml(salary) + '</span>'
      + '</div>'
      + (l.city ? '<div style="display:flex;align-items:center;gap:5px;margin-bottom:8px">' + icoPin + '<span style="font-size:11px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(l.city) + '</span></div>' : '<div style="margin-bottom:8px"></div>')
      + (jobType ? '<span style="display:inline-block;font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;background:#EEF2FF;color:#1A3A8F">' + H.escHtml(jobType) + '</span>' : '')
      + '</div>';
  }

  // ── Job Results: filtered list ────────────────────────────────
  H.pages.JobResults = function (params) {
    params = params || {};
    var jobs = _activeJobs().sort(function (a, b) { return b.createdAt - a.createdAt; });

    var filterHtml = H._sel('findjobs', 'subcat', 'Job Category', [['all', 'All Categories']].concat(JOB_CATS.map(function (c) { return [c, c]; })).concat([['Other', 'Other']]))
      + H._sel('findjobs', 'fuelType', 'Job Type', [['all', 'All'], ['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contract', 'Contract'], ['freelance', 'Freelance'], ['internship', 'Internship']])
      + H._sel('findjobs', 'propType', 'Qualification', [['all', 'All']].concat(JOB_QUALS.map(function (q) { return [q.key, q.label]; })))
      + H._citysel('findjobs') + H._priceRange('findjobs') + H._sortsel('findjobs');

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#1A3A8F">'
      + '<button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div class="det-topbar-title">All Jobs</div>'
      + '<button onclick="H.openInner(\'AppliedJobs\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px">Applied</button>'
      + '</div>'
      + '<div style="background:#1A3A8F;padding:0 12px 12px">'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<div style="background:#fff;border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px;flex:1">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#999" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="cs_findjobs" placeholder="Search jobs…" autocomplete="off" value="' + H.escHtml(params.q || '') + '" oninput="H._applyJobFilters()" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:#1A3A8F;font-family:Inter,sans-serif"></div>'
      + '<button onclick="H._toggleFilters(\'findjobs\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:10px 12px;border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>Filter'
      + '<span id="fb_findjobs" style="display:none;background:#F5A623;color:#1A3A8F;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px"></span></button>'
      + '</div>'
      + '<div style="color:rgba(255,255,255,.75);font-size:12px;font-weight:600;margin-top:8px"><span id="cc_findjobs">' + jobs.length + ' jobs</span></div>'
      + '</div>'
      + '<div id="fp_findjobs" style="display:none;background:var(--card);border-bottom:2px solid #1A3A8F;padding:16px 14px">'
      + filterHtml
      + '<div style="display:flex;gap:8px;margin-top:4px">'
      + '<button onclick="H._clearFilters(\'findjobs\')" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer">Clear</button>'
      + '<button onclick="H._toggleFilters(\'findjobs\')" style="flex:2;padding:10px;background:#1A3A8F;border:none;border-radius:10px;font-size:13px;font-weight:700;color:#fff;cursor:pointer">Apply Filters</button>'
      + '</div></div>'
      + '<div id="cl_findjobs" style="padding:12px 12px 88px">'
      + (jobs.length ? jobs.map(jobCard).join('') : H.emptyState('No jobs yet', 'Check back soon!', 'Post a Job', "H.openInner('PostJob')"))
      + '</div></div>';
  };

  H.pages.FindJobs_after = function () {
    if (typeof H.fetchJobsFromSupabase === 'function') H.fetchJobsFromSupabase().then(function() {
      var el = document.getElementById('cl_findjobs');
      if (el && typeof H._applyJobFilters === 'function') H._applyJobFilters();
    }).catch(function(){});
  };

  H.pages.JobResults_after = function (params) {
    params = params || {};
    H._filters['findjobs'] = {};
    if (params.cat)  H._filters['findjobs'].subcat   = params.cat;
    if (params.type) H._filters['findjobs'].fuelType = params.type.toLowerCase();
    if (params.qual) H._filters['findjobs'].propType = params.qual;
    H._applyJobFilters();
  };

  H._applyJobFilters = function () {
    var el = document.getElementById('cl_findjobs');
    if (!el) return;
    var f = H._filters['findjobs'] || {};
    var jobs = _activeJobs();
    var q = ((document.getElementById('cs_findjobs') || {}).value || '').toLowerCase().trim();
    if (q) jobs = jobs.filter(function (l) { return (l.title + ' ' + (l.desc || '') + ' ' + (l.city || '') + ' ' + (l.sellerName || '')).toLowerCase().includes(q); });
    if (f.city && f.city !== 'all') jobs = jobs.filter(function (l) { return (l.city + ' ' + (l.prov || '')).toLowerCase().includes(f.city.toLowerCase()); });
    if (f.subcat && f.subcat !== 'all') jobs = jobs.filter(function (l) { return _jobInCat(l, f.subcat); });
    if (f.fuelType && f.fuelType !== 'all') jobs = jobs.filter(function (l) { return _jobTypeOf(l).toLowerCase().includes(f.fuelType.replace('-', ' ')); });
    if (f.propType && f.propType !== 'all') {
      var ql = (JOB_QUALS.find(function (x) { return x.key === f.propType; }) || {}).match || [];
      jobs = jobs.filter(function (l) { var t = (l.desc || '').toLowerCase(); return ql.some(function (m) { return t.includes(m); }); });
    }
    if (f.priceMin) jobs = jobs.filter(function (l) { return (l.price || 0) >= +f.priceMin; });
    if (f.priceMax) jobs = jobs.filter(function (l) { return (l.price || 0) <= +f.priceMax; });
    jobs.sort(function (a, b) { return f.sort === 'salary' ? (b.price || 0) - (a.price || 0) : b.createdAt - a.createdAt; });
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
    var ZW = H._ZW_CITIES || [];

    return '<div class="page active">'
      + '<div class="det-topbar" style="background:#1A3A8F"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="det-topbar-title">Hire Talent</div>'
      + '<div style="display:flex;gap:6px">'
      + '<button onclick="H.openInner(\'MyContactRequests\')" title="My Requests" style="background:rgba(255,255,255,.18);border:none;color:#fff;cursor:pointer;padding:7px;border-radius:9px;display:flex"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></button>'
      + '<button onclick="H.openInner(\'PostJob\')" style="background:rgba(255,255,255,.18);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:7px 11px;border-radius:9px">+ Post Job</button>'
      + '</div></div>'
      + '<div style="background:#1A3A8F;padding:0 12px 14px">'
      + '<div style="background:rgba(255,255,255,.13);border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="talentQ" placeholder="Search by name, skill, title…" autocomplete="off" oninput="H._filterTalent()" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:#fff;font-family:Inter,sans-serif"></div>'
      + '<div style="color:rgba(255,255,255,.65);font-size:12px;font-weight:600;margin-top:8px"><span id="talentCount">' + candidates.length + ' candidate' + (candidates.length !== 1 ? 's' : '') + '</span></div>'
      + '</div>'
      // Quick filter row — Filters button + City / Category / Experience
      + '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;background:var(--card)">'
      + '<button onclick="H._openTalentFilters()" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:9px 14px;background:#1A3A8F;border:none;border-radius:11px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>Filters'
      + '<span id="talentFilterBadge" style="display:none;background:#fff;color:#1A3A8F;font-size:11px;font-weight:800;min-width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;padding:0 5px"></span></button>'
      + _quickSel('city', [['all', 'City']].concat(ZW.map(function (c) { return [c, c]; })))
      + _quickSel('sector', [['all', 'Category']].concat(JOB_PROFESSIONS.map(function (p) { return [p, p]; })))
      + _quickSel('exp', [['all', 'Experience'], ['0-1', '0-1 Years'], ['1-2', '1-2 Years'], ['2-5', '2-5 Years'], ['5-10', '5-10 Years'], ['10+', '10+ Years']])
      + '</div>'
      + '<div id="talentList" style="padding:12px 14px 120px">'
      + (candidates.length ? candidates.map(_candidateCard).join('') : _emptyTalent())
      + '</div></div>';
  };

  H._mountTalentFloatBar = function () {
    var ex = document.getElementById('talentFloatBar'); if (ex) ex.remove();
    var bar = document.createElement('div');
    bar.id = 'talentFloatBar';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));z-index:160;display:flex;background:var(--card);border:1px solid var(--border);border-radius:24px;box-shadow:0 6px 22px rgba(0,0,0,.22);overflow:hidden';
    bar.innerHTML = '<button onclick="H._talentSortSheet()" style="display:flex;align-items:center;gap:6px;padding:11px 24px;background:none;border:none;font-size:13px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg>Sort</button>'
      + '<div style="width:1px;background:var(--border)"></div>'
      + '<button onclick="H._saveTalentSearch()" style="display:flex;align-items:center;gap:6px;padding:11px 24px;background:none;border:none;font-size:13px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>Save</button>';
    document.body.appendChild(bar);
  };

  H.pages.HireTalent_after = function () {
    H._tSyncBadge();
    H._filterTalent();
    H._mountTalentFloatBar();
    var _sb = window.supabase;
    if (!_sb || typeof _sb.from !== 'function') return;
    // Load profiles that are open to work OR have a CV set to visible
    _sb.from('profiles')
      .select('id,name,phone,email,avatar,verified,job_title,skills,sector,exp,city,open_to_work,cv')
      .or('open_to_work.eq.true,cv->visible.eq.true')
      .limit(20)
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

  // ── Candidate attribute derivation (for filters & cards) ──────
  // Highest education level from a candidate's CV.
  function _candEduLevel(u) {
    var edu = _arr(u.cv && u.cv.education);
    var text = edu.map(function (e) { return (e.degree || e.qualification || ''); }).join(' ').toLowerCase();
    if (/\b(master|msc|m\.sc|mba|phd|doctorate|postgrad|post-grad)\b/.test(text)) return 'postgrad';
    if (/\b(degree|bachelor|bsc|b\.sc|beng|honours|hons)\b/.test(text)) return 'degree';
    if (/\b(o.level|a.level|high school|high-school|secondary|zjc|matric)\b/.test(text)) return 'secondary';
    if (/\b(certificate|diploma|hexco|cert)\b/.test(text)) return 'certificate';
    return '';
  }
  // Years-of-experience range [min,max] for a candidate.
  function _candExpRange(u) {
    switch (u.exp) {
      case 'entry':  return [0, 2];
      case 'mid':    return [3, 5];
      case 'senior': return [5, 10];
      case 'expert': return [10, 99];
    }
    var y = ((u.cv && u.cv.experience) || []).length * 2;
    return [y, y];
  }
  function _candExpYears(u) { return _candExpRange(u)[1]; }
  function _candExpLevel(u) {
    if (u.exp) return u.exp;
    var y = _candExpYears(u);
    if (y >= 10) return 'expert';
    if (y >= 5)  return 'senior';
    if (y >= 3)  return 'mid';
    return 'entry';
  }
  function _candSalary(u) {
    var n = (u.cv && parseFloat(u.cv.expectedSalary)) || 0;
    if (!n) { var s = (u.expectedSalary || '').replace(/[^\d.]/g, ''); n = parseFloat(s) || 0; }
    return n || 0;
  }
  function _candCommitment(u) { return ((u.jobTypes || '') + ' ' + ((u.cv && u.cv.jobTypes) || '')).toLowerCase(); }
  function _candPostedTs(u) { return u.profileUpdatedAt || u.createdAt || 0; }

  // Quick dropdown in the filter row (label shown when value === 'all').
  function _quickSel(key, opts) {
    var f = H._filters['talent'] || {}; var cur = f[key] || 'all';
    return '<select onchange="H._setFilter(\'talent\',\'' + key + '\',this.value);H._filterTalent()" style="flex-shrink:0;padding:9px 12px;border:1.5px solid ' + (cur !== 'all' ? '#1A3A8F' : 'var(--border)') + ';border-radius:11px;font-size:13px;font-weight:600;background:' + (cur !== 'all' ? '#1A3A8F0d' : 'var(--bg)') + ';color:' + (cur !== 'all' ? '#1A3A8F' : 'var(--text)') + ';outline:none;font-family:inherit;max-width:150px">'
      + opts.map(function (o) { return '<option value="' + H.escHtml(o[0]) + '"' + (cur === o[0] ? ' selected' : '') + '>' + H.escHtml(o[1]) + '</option>'; }).join('')
      + '</select>';
  }

  var _EXP_BUCKET = { '0-1': [0, 1], '1-2': [1, 2], '2-5': [2, 5], '5-10': [5, 10], '10+': [10, 99] };

  // Apply every active filter and return the sorted candidate list.
  function _talentList() {
    var f = H._filters['talent'] || {};
    var q = (((document.getElementById('talentQ') || {}).value || '') + ' ' + (f.kw || '')).toLowerCase().trim();
    var list = (H.state.users || []).filter(function (u) {
      return u.openToWork || (u.cv && u.cv.visible !== false && (u.cv.headline || u.cv.summary || (u.cv.experience && u.cv.experience.length)));
    });
    if (q) list = list.filter(function (u) {
      var cv = u.cv || {};
      var t = [u.name||'', u.jobTitle||'', u.sector||'', cv.headline||'', cv.summary||'',
        _arr(cv.skills).join(' '), _arr(cv.experience).map(function(e){return (e.title||'')+(e.company||'');}).join(' '),
        u.city||'', cv.location||''].join(' ').toLowerCase();
      return t.includes(q);
    });
    if (f.sector && f.sector !== 'all') list = list.filter(function (u) {
      if ((u.sector || '') === f.sector) return true;
      var tok = f.sector.split(/[\/(,\s]/)[0].toLowerCase();
      var cv = u.cv || {};
      var text = [(u.sector||''), (u.jobTitle||''), (cv.headline||''), _arr(cv.skills).join(' ')].join(' ').toLowerCase();
      return tok.length > 2 && text.indexOf(tok) > -1;
    });
    if (f.city && f.city !== 'all') list = list.filter(function (u) {
      return ((u.cv && u.cv.location || u.city) || '').toLowerCase().includes(f.city.toLowerCase());
    });
    if (f.exp && f.exp !== 'all') {
      var b = _EXP_BUCKET[f.exp];
      if (b) list = list.filter(function (u) { var r = _candExpRange(u); return r[0] <= b[1] && r[1] >= b[0]; });
    }
    if (f.edu && f.edu !== 'all') list = list.filter(function (u) {
      var lvl = _candEduLevel(u); return f.edu === 'na' ? !lvl : lvl === f.edu;
    });
    if (f.salary && f.salary !== 'all') list = list.filter(function (u) {
      var n = _candSalary(u);
      switch (f.salary) {
        case 'negotiable': return !n;
        case '0-500':      return n > 0 && n < 500;
        case '500-999':    return n >= 500 && n < 1000;
        case '1000-1999':  return n >= 1000 && n < 2000;
        case '2000+':      return n >= 2000;
      }
      return true;
    });
    if (f.commitment && f.commitment !== 'all') list = list.filter(function (u) {
      var c = _candCommitment(u); if (!c.trim()) return false;
      switch (f.commitment) {
        case 'full':      return c.includes('full');
        case 'part':      return c.includes('part');
        case 'contract':  return c.includes('contract');
        case 'temporary': return c.includes('temp');
        case 'other':     return !/full|part|contract|temp/.test(c);
      }
      return true;
    });
    if (f.posted && f.posted !== 'all') {
      var DAY = 86400000, now = Date.now();
      var lim = { today: 1, '3d': 3, '1w': 7, '2w': 14 }[f.posted];
      if (lim) list = list.filter(function (u) { var t = _candPostedTs(u); return t && (now - t) <= lim * DAY; });
    }
    if (f.verified === '1') list = list.filter(function (u) { return u.verified; });
    if (f.sort === 'experience') list.sort(function (a, b) { return _candExpYears(b) - _candExpYears(a); });
    else if (f.sort === 'name') list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    else if (f.sort === 'salary') list.sort(function (a, b) { return _candSalary(b) - _candSalary(a); });
    else list.sort(function (a, b) { return (b.profileUpdatedAt || b.createdAt || 0) - (a.profileUpdatedAt || a.createdAt || 0); });
    return list;
  }

  H._filterTalent = function () {
    var el = document.getElementById('talentList');
    var cnt = document.getElementById('talentCount');
    if (!el) return;
    var list = _talentList();
    if (cnt) cnt.textContent = list.length + ' candidate' + (list.length !== 1 ? 's' : '');
    el.innerHTML = list.length ? list.map(_candidateCard).join('') : _emptyTalent();
    H._tSyncBadge();
  };

  H._tSyncBadge = function () {
    var f = H._filters['talent'] || {};
    var keys = ['city', 'sector', 'salary', 'exp', 'edu', 'commitment', 'posted'];
    var n = keys.filter(function (k) { return f[k] && f[k] !== 'all'; }).length;
    if (f.kw) n++;
    if (f.verified === '1') n++;
    var b = document.getElementById('talentFilterBadge');
    if (b) { b.textContent = n || ''; b.style.display = n ? 'inline-flex' : 'none'; }
  };

  // ── Sort sheet (floating Sort button) ─────────────────────────
  H._talentSortSheet = function () {
    var f = H._filters['talent'] || {};
    var cur = f.sort || 'recent';
    var opts = [['recent', 'Most Recent'], ['experience', 'Most Experienced'], ['salary', 'Highest Salary'], ['name', 'Name (A–Z)']];
    var check = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var rows = opts.map(function (o) {
      var on = cur === o[0];
      return '<button onclick="H._setFilter(\'talent\',\'sort\',\'' + o[0] + '\');H._closeSheet(\'tsort\');H._filterTalent()" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:15px 18px;background:none;border:none;border-bottom:1px solid var(--border);font-size:14.5px;font-weight:' + (on ? '700' : '500') + ';color:' + (on ? '#1A3A8F' : 'var(--text)') + ';cursor:pointer;font-family:inherit">' + o[1] + (on ? check : '') + '</button>';
    }).join('');
    H._showSheet('tsort', 'Sort by', rows);
  };

  H._saveTalentSearch = function () {
    var f = H._filters['talent'] || {};
    var active = Object.keys(f).filter(function (k) { return k !== 'sort' && f[k] && f[k] !== 'all'; });
    if (!active.length) { H.toast('Set some filters first, then Save'); return; }
    H.state.savedSearches = H.state.savedSearches || [];
    H.state.savedSearches.push({ id: H.uid(), type: 'talent', filters: JSON.parse(JSON.stringify(f)), createdAt: Date.now() });
    H.saveState();
    H.toast('Search saved');
  };

  // ── Generic bottom sheet helper (used by sort) ────────────────
  H._showSheet = function (id, title, bodyHtml) {
    H._closeSheet(id);
    var d = document.createElement('div');
    d.id = 'sheet_' + id;
    d.style.cssText = 'position:fixed;inset:0;z-index:3200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end';
    d.onclick = function (e) { if (e.target === d) H._closeSheet(id); };
    d.innerHTML = '<div style="width:100%;background:var(--card);border-radius:20px 20px 0 0;overflow:hidden;animation:sheetUp .2s ease">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border)">'
      + '<span style="font-size:16px;font-weight:800;color:var(--text)">' + H.escHtml(title) + '</span>'
      + '<button onclick="H._closeSheet(\'' + id + '\')" style="background:none;border:none;cursor:pointer;color:var(--sub);padding:2px"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      + '<div style="padding-bottom:calc(8px + env(safe-area-inset-bottom))">' + bodyHtml + '</div></div>';
    document.body.appendChild(d);
  };
  H._closeSheet = function (id) { var el = document.getElementById('sheet_' + id); if (el) el.remove(); };

  // ── Full "All Filters" sheet ──────────────────────────────────
  function _tcStyle(on) {
    return 'padding:9px 15px;border-radius:22px;border:1.5px solid ' + (on ? '#1A3A8F' : 'var(--border)') + ';background:' + (on ? '#1A3A8F' : 'var(--card)') + ';color:' + (on ? '#fff' : 'var(--text)') + ';font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;margin:0 8px 8px 0';
  }
  function _tChips(key, opts) {
    var f = H._filters['talent'] || {}; var cur = f[key] || 'all';
    return opts.map(function (o) {
      return '<button data-tchip data-key="' + key + '" data-val="' + H.escHtml(o[0]) + '" onclick="H._tChip(this)" style="' + _tcStyle(cur === o[0]) + '">' + H.escHtml(o[1]) + '</button>';
    }).join('');
  }
  function _fg(title, inner, scroll) {
    return '<div style="padding:18px 16px;border-bottom:1px solid var(--border)">'
      + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px">' + title + '</div>'
      + (scroll
        ? '<div style="display:flex;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px">' + inner + '</div>'
        : '<div style="display:flex;flex-wrap:wrap">' + inner + '</div>')
      + '</div>';
  }
  function _talentFilterGroups() {
    var f = H._filters['talent'] || {};
    var ZW = H._ZW_CITIES || [];
    var von = f.verified === '1';
    var kwField = '<div style="padding:18px 16px;border-bottom:1px solid var(--border)">'
      + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px">Keyword</div>'
      + '<div style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:12px;padding:0 12px;background:var(--card)">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--sub)" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="tfKw" value="' + H.escHtml(f.kw || '') + '" oninput="(H._filters.talent=H._filters.talent||{}).kw=this.value;H._tUpdateResults()" placeholder="Search keywords" style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:var(--text);font-family:inherit"></div></div>';
    var catField = '<div style="padding:18px 16px;border-bottom:1px solid var(--border)">'
      + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px">Category</div>'
      + '<select onchange="(H._filters.talent=H._filters.talent||{}).sector=this.value;H._tUpdateResults()" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;font-family:inherit">'
      + '<option value="all">All Categories</option>'
      + JOB_PROFESSIONS.map(function (p) { return '<option' + ((f.sector || 'all') === p ? ' selected' : '') + '>' + H.escHtml(p) + '</option>'; }).join('')
      + '</select></div>';
    var moreField = '<div style="padding:18px 16px">'
      + '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px">More Filters</div>'
      + '<div onclick="H._tToggleVerified(this)" data-on="' + (von ? '1' : '0') + '" style="display:flex;align-items:center;gap:12px;border:1.5px solid ' + (von ? '#1A3A8F' : 'var(--border)') + ';border-radius:14px;padding:14px;cursor:pointer;background:' + (von ? '#1A3A8F0d' : 'var(--card)') + '">'
      + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0"><path d="M12 2l2.4 2.4 3.3-.6.6 3.3L21 12l-2.7 1.9.6 3.3-3.3.6L12 22l-2.4-2.4-3.3.6-.6-3.3L3 12l2.7-1.9-.6-3.3 3.3.6z"/><polyline points="9 12 11 14 15 10"/></svg>'
      + '<div style="flex:1"><div style="font-size:13.5px;font-weight:700;color:var(--text)">Verified users only</div><div style="font-size:12px;color:var(--sub)">Show candidates with a verified badge</div></div>'
      + '<div style="width:44px;height:25px;border-radius:13px;background:' + (von ? '#1A3A8F' : 'var(--border)') + ';position:relative;flex-shrink:0;transition:background .2s"><div style="position:absolute;top:3px;left:' + (von ? '22px' : '3px') + ';width:19px;height:19px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.25)"></div></div>'
      + '</div></div>';
    return _fg('City', _tChips('city', [['all', 'All Cities']].concat(ZW.map(function (c) { return [c, c]; }))), true)
      + kwField
      + catField
      + _fg('Desired Salary', _tChips('salary', [['all', 'Any'], ['negotiable', 'Negotiable'], ['0-500', 'Less than $500'], ['500-999', '$500 – $999'], ['1000-1999', '$1,000 – $1,999'], ['2000+', '$2,000+']]))
      + _fg('Experience', _tChips('exp', [['all', 'Any'], ['0-1', '0-1 Years'], ['1-2', '1-2 Years'], ['2-5', '2-5 Years'], ['5-10', '5-10 Years'], ['10+', '10+ Years']]))
      + _fg('Education', _tChips('edu', [['all', 'Any'], ['na', 'N/A'], ['secondary', 'High School / Secondary'], ['certificate', 'Certificate / Diploma'], ['degree', 'Degree'], ['postgrad', 'Postgraduate']]))
      + _fg('Commitment', _tChips('commitment', [['all', 'Any'], ['full', 'Full Time'], ['part', 'Part Time'], ['contract', 'Contract'], ['temporary', 'Temporary'], ['other', 'Other']]))
      + _fg('Posted', _tChips('posted', [['all', 'Any time'], ['today', 'Today'], ['3d', 'Within 3 days'], ['1w', 'Within 1 week'], ['2w', 'Within 2 weeks']]))
      + moreField;
  }

  H._openTalentFilters = function () {
    H._closeTalentFilters();
    var n = _talentList().length;
    var html = '<div id="talentFilterPanel" style="position:fixed;inset:0;z-index:3100;background:var(--bg);display:flex;flex-direction:column;overflow:hidden">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:calc(14px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid var(--border);flex-shrink:0">'
      + '<button onclick="H._closeTalentFilters()" style="background:none;border:none;cursor:pointer;color:var(--text);padding:6px;margin:-6px"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
      + '<span style="font-size:16px;font-weight:800;color:var(--text)">Filters</span>'
      + '<button onclick="H._tResetFilters()" style="background:none;border:none;cursor:pointer;color:#1A3A8F;font-size:14px;font-weight:700;font-family:inherit">Reset</button></div>'
      + '<div id="talentFilterBody" style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch">' + _talentFilterGroups() + '</div>'
      + '<div style="padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);flex-shrink:0">'
      + '<button id="talentResultsBtn" onclick="H._tApplyFilters()" style="width:100%;padding:15px;background:#1A3A8F;color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Show ' + n + ' Result' + (n !== 1 ? 's' : '') + '</button></div>'
      + '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  H._closeTalentFilters = function () { var p = document.getElementById('talentFilterPanel'); if (p) p.remove(); };
  H._tApplyFilters = function () { H._closeTalentFilters(); H._filterTalent(); };
  H._tResetFilters = function () {
    H._filters['talent'] = {};
    var b = document.getElementById('talentFilterBody');
    if (b) b.innerHTML = _talentFilterGroups();
    H._tUpdateResults();
  };
  H._tChip = function (el) {
    var key = el.getAttribute('data-key'), val = el.getAttribute('data-val');
    (H._filters.talent = H._filters.talent || {})[key] = val;
    document.querySelectorAll('[data-tchip][data-key="' + key + '"]').forEach(function (c) {
      c.style.cssText = _tcStyle(c.getAttribute('data-val') === val);
    });
    H._tUpdateResults();
  };
  H._tToggleVerified = function (el) {
    var f = H._filters.talent = H._filters.talent || {};
    f.verified = f.verified === '1' ? '' : '1';
    var b = document.getElementById('talentFilterBody');
    if (b) b.innerHTML = _talentFilterGroups();
    H._tUpdateResults();
  };
  H._tUpdateResults = function () {
    var n = _talentList().length;
    var btn = document.getElementById('talentResultsBtn');
    if (btn) btn.textContent = 'Show ' + n + ' Result' + (n !== 1 ? 's' : '');
  };

  var _EXP_LABEL = { entry: 'Entry level', mid: '3–5 yrs exp', senior: '5–10 yrs exp', expert: '10+ yrs exp' };
  var _EDU_LABEL = { certificate: 'Certificate / Diploma', degree: 'Degree', postgrad: 'Postgraduate' };

  function _candidateCard(u) {
    var ini = H.initials(u.name || 'U');
    var cv  = u.cv || {};
    var req = H._contactReqFor(u.id);
    var unlocked = !!(req && req.status === 'approved');
    var pending  = !!(req && req.status === 'pending');
    var verBadge = u.verified
      ? '<span style="display:inline-flex;align-items:center;gap:3px;background:#1A3A8F12;color:#1A3A8F;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">' + H.verifiedBadge(11) + 'Verified</span>'
      : '';
    var position = (cv.experience && cv.experience[0] && cv.experience[0].title) || cv.headline || u.jobTitle || '';
    var headline = cv.headline || position || 'Candidate';
    var location = cv.location || u.city || '';
    var expLabel = _EXP_LABEL[_candExpLevel(u)] || '';
    var eduLabel = _EDU_LABEL[_candEduLevel(u)] || '';
    var expectedSal = u.expectedSalary || (cv.expectedSalary ? '$' + cv.expectedSalary + '/mo' : '');
    var availability = cv.availability || cv.noticePeriod || (u.openToWork ? 'Available now' : '');
    var posted = u.profileUpdatedAt || u.createdAt;
    var saved = (H.state.savedCandidates || []).indexOf(u.id) > -1;
    var skills = (Array.isArray(cv.skills) && cv.skills.length ? cv.skills : (u.skills || '').split(',')).map(function (s) { return (s || '').trim(); }).filter(Boolean).slice(0, 4);

    // Contact details — revealed only after an approved request.
    var waFull  = u.whatsappFull || '';
    var callNum = u.phoneForCalls || waFull;
    var canWa   = !!waFull   && (u.contactMethod !== 'call');
    var canCall = !!callNum  && (u.contactMethod !== 'whatsapp');
    var waUrl   = 'https://wa.me/' + waFull + '?text=' + encodeURIComponent('Hi ' + (u.name || '') + ', I saw your profile on PaMarket and I have a job opportunity for you.');

    function metaRow(icon, label, val) {
      if (!val) return '';
      return '<div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text)">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--sub)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">' + icon + '</svg>'
        + '<span style="color:var(--sub)">' + label + '</span>'
        + '<span style="font-weight:600;margin-left:auto;text-align:right">' + H.escHtml(val) + '</span></div>';
    }

    var userIcon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

    // Bottom action depends on unlock state.
    var actions;
    if (unlocked) {
      actions = (canWa
        ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" onclick="event.stopPropagation()" style="flex:1;padding:11px;background:#25D366;color:#fff;border-radius:11px;font-size:13px;font-weight:700;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:5px;font-family:inherit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp</a>'
        : (canCall
          ? '<a href="tel:+' + H.escHtml(callNum) + '" onclick="event.stopPropagation()" style="flex:1;padding:11px;background:#1A3A8F;color:#fff;border-radius:11px;font-size:13px;font-weight:700;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:5px;font-family:inherit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call</a>'
          : '<button onclick="event.stopPropagation();H.startChatWith(\'' + u.id + '\')" style="flex:1;padding:11px;background:#1A3A8F;color:#fff;border:none;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Message</button>'));
    } else if (pending) {
      actions = '<div style="flex:1;padding:11px;background:#F5A62318;color:#c07800;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Pending review</div>';
    } else {
      actions = '<button onclick="event.stopPropagation();H._requestContact(\'' + u.id + '\')" style="flex:1;padding:11px;background:#1A3A8F;color:#fff;border:none;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Request to contact</button>';
    }

    return '<div onclick="H.openInner(\'ViewCandidateCV\',{id:\'' + u.id + '\'})" style="background:var(--card);border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.05);cursor:pointer">'
      + '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">'
      + '<div style="width:52px;height:52px;border-radius:50%;overflow:hidden;flex-shrink:0">'
      + (u.avatar ? '<img src="' + u.avatar + '" style="width:100%;height:100%;object-fit:cover">' : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A3A8F,#3a6fd8);display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;color:#fff">' + (unlocked ? ini : userIcon) + '</div>')
      + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(unlocked ? (u.name || 'Candidate') : headline) + '</div>'
      + (unlocked
        ? '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#1A3A8F;font-weight:700">' + (u.verified ? H.verifiedBadge(12) : '') + H.escHtml(headline) + '</div>'
        : '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#15803d;font-weight:700"><span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block"></span>Looking for a job</div>')
      + '</div>'
      + '<button onclick="event.stopPropagation();H._toggleSaveCandidate(\'' + u.id + '\')" style="background:none;border:none;cursor:pointer;padding:2px;flex-shrink:0;color:' + (saved ? '#F5A623' : 'var(--sub)') + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="' + (saved ? '#F5A623' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg></button>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px;background:var(--bg);border-radius:12px;padding:12px 14px;margin-bottom:12px">'
      + metaRow('<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>', 'Current position', position)
      + metaRow('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>', 'Desired salary', expectedSal)
      + metaRow('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'Experience', expLabel)
      + metaRow('<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5"/>', 'Education', eduLabel)
      + metaRow('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>', 'Availability', availability)
      + metaRow('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', 'Location', location)
      + '</div>'
      + (skills.length ? '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">' + skills.map(function (s) { return '<span style="background:#1A3A8F12;color:#1A3A8F;font-size:11px;font-weight:600;padding:3px 9px;border-radius:7px">' + H.escHtml(s) + '</span>'; }).join('') + '</div>' : '')
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + (verBadge || '<span></span>')
      + (posted ? '<span style="font-size:11px;color:var(--sub)">' + H.timeAgo(posted) + '</span>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px">'
      + actions
      + '<button onclick="event.stopPropagation();H.openInner(\'ViewCandidateCV\',{id:\'' + u.id + '\'})" style="flex:1;padding:11px;background:var(--bg);color:#1A3A8F;border:1.5px solid #1A3A8F;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">View Profile</button>'
      + '</div></div>';
  }

  // Find the current user's request for a candidate (any status), or null.
  H._contactReqFor = function (candidateId) {
    var me = H.currentUser(); if (!me) return null;
    return (H.state.contactRequests || []).find(function (r) {
      return r.candidateId === candidateId && r.requesterId === me.id;
    }) || null;
  };

  // Open the "Request to contact" form for a candidate.
  H._requestContact = function (candidateId) {
    var me = H.currentUser();
    if (!me) { H.requireAuth('Sign in to request candidate contact'); return; }
    if (me.id === candidateId) { H.toast('This is your own profile'); return; }
    var req = H._contactReqFor(candidateId);
    if (req && req.status === 'approved') { H.toast('Contact already unlocked'); return; }
    if (req && req.status === 'pending') { H.toast('Your request is already under review'); return; }
    var inStyle = 'width:100%;padding:11px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;font-family:inherit;margin-top:4px';
    H.modal({
      title: 'Request to contact',
      body: '<div style="font-size:12.5px;color:var(--sub);line-height:1.6;margin-bottom:14px">Tell us a little about the role. Our team reviews each request and unlocks this candidate&#39;s name and contact details once approved.</div>'
        + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;color:var(--text)">Your company / organisation *</label><input id="crCompany" placeholder="e.g. Acme Logistics" value="' + H.escHtml(me.company || '') + '" style="' + inStyle + '"></div>'
        + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:700;color:var(--text)">Role you&#39;re hiring for *</label><input id="crRole" placeholder="e.g. Delivery Driver" style="' + inStyle + '"></div>'
        + '<div><label style="font-size:12px;font-weight:700;color:var(--text)">Message (optional)</label><textarea id="crNote" rows="3" placeholder="Anything you\'d like us to know..." style="' + inStyle + ';resize:vertical"></textarea></div>',
      confirmText: 'Send request',
      onConfirm: function () {
        var company = ((document.getElementById('crCompany') || {}).value || '').trim();
        var role    = ((document.getElementById('crRole') || {}).value || '').trim();
        var note    = ((document.getElementById('crNote') || {}).value || '').trim();
        if (!company || !role) { H.toast('Please add your company and the role'); return false; }
        H._submitContactRequest(candidateId, company, role, note);
      }
    });
  };

  H._submitContactRequest = function (candidateId, company, role, note) {
    var me = H.currentUser(); if (!me) return;
    var cand = (H.state.users || []).find(function (x) { return x.id === candidateId; }) || {};
    var existing = H._contactReqFor(candidateId);
    var rec = {
      id: existing ? existing.id : H.uid(),
      requesterId: me.id, candidateId: candidateId,
      requesterName: me.name || '', candidateName: cand.name || '',
      candidateLocation: (cand.cv && cand.cv.location) || cand.city || '',
      company: company, role: role, note: note || '',
      status: 'pending', createdAt: Date.now()
    };
    H.state.contactRequests = H.state.contactRequests || [];
    if (existing) Object.assign(existing, rec); else H.state.contactRequests.push(rec);
    H.saveState();

    var _sb = window.supabase;
    if (_sb && typeof _sb.from === 'function') {
      var row = {
        requester_id: me.id, candidate_id: candidateId,
        requester_name: me.name || '', candidate_name: cand.name || '',
        company: company, role: role, note: note || '', status: 'pending'
      };
      // Clear any prior row for this pair (RLS forbids declined→pending updates),
      // then insert a fresh pending request.
      _sb.from('contact_requests').delete().eq('requester_id', me.id).eq('candidate_id', candidateId).then(function () {
        _sb.from('contact_requests').insert(row).select().then(function (r) {
          if (r && !r.error && r.data && r.data[0]) {
            var local = H._contactReqFor(candidateId);
            if (local) { local.id = r.data[0].id; H.saveState(); }
          } else if (r && r.error) { console.warn('contact request error:', r.error.message); }
        });
      });
    }
    H.toast('Request sent — we\'ll review and notify you');
    if (H.currentPageName === 'ViewCandidateCV') H.renderPage('ViewCandidateCV', { id: candidateId });
    else if (typeof H._filterTalent === 'function') H._filterTalent();
  };

  H._toggleSaveCandidate = function (id) {
    H.state.savedCandidates = H.state.savedCandidates || [];
    var i = H.state.savedCandidates.indexOf(id);
    if (i > -1) { H.state.savedCandidates.splice(i, 1); H.toast('Removed from saved'); }
    else { H.state.savedCandidates.push(id); H.toast('Candidate saved'); }
    H.saveState();
    H._filterTalent();
  };

  // ── Track Requests — the employer's own contact-unlock requests ──
  // Helper: has the current user been approved to see this candidate?
  H.isContactUnlocked = function (candidateId) {
    var me = H.currentUser(); if (!me) return false;
    return (H.state.contactRequests || []).some(function (r) {
      return r.candidateId === candidateId && r.requesterId === me.id && r.status === 'approved';
    });
  };

  H.pages.MyContactRequests = function () {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('My Requests') + H.emptyState('Sign in required', 'Sign in to track your contact requests', null, null) + '</div>';
    var reqs = (H.state.contactRequests || []).filter(function (r) { return r.requesterId === u.id; })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var statusMeta = {
      pending:  { c: '#F5A623', bg: '#F5A62318', label: 'Pending review' },
      approved: { c: '#15803d', bg: '#22c55e1a', label: 'Approved' },
      declined: { c: '#ef4444', bg: '#ef444418', label: 'Declined' }
    };
    var body;
    if (!reqs.length) {
      body = H.emptyState('No requests yet', 'When you request a candidate\'s contact in Hire Talent, it shows here with its status.', 'Browse Candidates', "H.openInner('HireTalent')");
    } else {
      body = '<div style="padding:12px 14px 88px">' + reqs.map(function (r) {
        var m = statusMeta[r.status] || statusMeta.pending;
        var cand = (H.state.users || []).find(function (x) { return x.id === r.candidateId; }) || {};
        var approved = r.status === 'approved';
        var name = approved ? (cand.name || r.candidateName || 'Candidate') : ('Candidate · ' + (r.candidateLocation || cand.city || 'Zimbabwe'));
        var phone = cand.whatsappFull || cand.phoneForCalls || cand.phone || '';
        return '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.05)">'
          + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">'
          + '<div style="min-width:0"><div style="font-size:15px;font-weight:800;color:var(--text)">' + H.escHtml(name) + '</div>'
          + (r.role ? '<div style="font-size:12px;color:var(--sub);margin-top:1px">' + H.escHtml(r.role) + (r.company ? ' · ' + H.escHtml(r.company) : '') + '</div>' : '')
          + '</div>'
          + '<span style="flex-shrink:0;background:' + m.bg + ';color:' + m.c + ';font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px">' + m.label + '</span></div>'
          + (approved
            ? '<div style="background:var(--bg);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px">'
              + '<div style="font-size:12px;color:var(--sub)">Contact unlocked — you can now reach this candidate:</div>'
              + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
              + (phone ? '<a href="tel:+' + H.escHtml(phone) + '" style="display:inline-flex;align-items:center;gap:5px;background:#1A3A8F;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 12px;border-radius:9px"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg>Call</a>' : '')
              + '<button onclick="H.openInner(\'ViewCandidateCV\',{id:\'' + H.escHtml(r.candidateId) + '\'})" style="display:inline-flex;align-items:center;gap:5px;background:var(--card);color:#1A3A8F;border:1.5px solid #1A3A8F;font-size:12px;font-weight:700;padding:8px 12px;border-radius:9px;cursor:pointer;font-family:inherit">View Profile</button>'
              + '</div></div>'
            : (r.status === 'declined'
              ? '<div style="font-size:12px;color:var(--sub);line-height:1.5">This request was not approved. You can try another candidate.</div>'
              : '<div style="font-size:12px;color:var(--sub);line-height:1.5">We&#39;re reviewing your request. You&#39;ll be notified once it&#39;s approved and the contact details unlock here.</div>'))
          + '<div style="font-size:11px;color:var(--sub2);margin-top:8px">Requested ' + H.timeAgo(r.createdAt) + '</div>'
          + '</div>';
      }).join('') + '</div>';
    }
    return '<div class="page active">' + H.innerTopbar('My Requests') + body + '</div>';
  };

  // Pull the latest status of my requests from the cloud.
  H.pages.MyContactRequests_after = function () {
    // The re-render below re-invokes this hook; skip the refetch that one time
    // so we never spin in a render→fetch→render loop (which caused flickering).
    if (H._mcrSkipFetch) { H._mcrSkipFetch = false; return; }
    var u = H.currentUser(); if (!u) return;
    var _sb = window.supabase;
    if (!_sb || typeof _sb.from !== 'function') return;
    _sb.from('contact_requests').select('*').eq('requester_id', u.id).then(function (res) {
      // Nothing returned (incl. empty list) → never re-render.
      if (res.error || !Array.isArray(res.data) || !res.data.length) return;
      H.state.contactRequests = H.state.contactRequests || [];
      var sig = function () { return (H.state.contactRequests || []).map(function (r) { return r.id + ':' + r.status; }).sort().join('|'); };
      var before = sig();
      res.data.forEach(function (row) {
        var ex = H.state.contactRequests.find(function (x) { return x.id === row.id; });
        var mapped = {
          id: row.id, requesterId: row.requester_id, candidateId: row.candidate_id,
          candidateName: row.candidate_name || (ex && ex.candidateName) || '',
          company: row.company || '', role: row.role || '', note: row.note || '',
          status: row.status || 'pending', createdAt: ex && ex.createdAt ? ex.createdAt : (row.created_at ? new Date(row.created_at).getTime() : Date.now())
        };
        if (ex) Object.assign(ex, mapped); else H.state.contactRequests.push(mapped);
      });
      H.saveState();
      // Only re-render when something actually changed, and guard the refetch.
      if (before !== sig() && H.currentPageName === 'MyContactRequests') {
        H._mcrSkipFetch = true;
        H.renderPage('MyContactRequests');
      }
    });
  };

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
    var req = H._contactReqFor(uid);
    var unlocked = !!(req && req.status === 'approved');
    var pending  = !!(req && req.status === 'pending');
    var reveal = isMine || unlocked;   // may we show name + contact?
    var cv  = u.cv || {};
    var ini = H.initials(u.name || 'U');
    var verBadge = u.verified ? '<span style="display:inline-flex;vertical-align:middle">' + H.verifiedBadge(14) + '</span>' : '';
    var expLvl = { entry: 'Entry Level (0–2 yrs)', mid: '3–5 Years', senior: '5–10 Years', expert: '10+ Years' }[u.exp || ''] || '';
    var skills = Array.isArray(cv.skills) && cv.skills.length ? cv.skills : (u.skills || '').split(',').filter(Boolean).map(function (s) { return s.trim(); }).filter(Boolean);
    var exp   = _arr(cv.experience);
    var edu   = _arr(cv.education);
    var certs = _arr(cv.certifications);
    var headline    = cv.headline || u.jobTitle || 'Open to Work';
    var location    = cv.location || u.city || '';
    var summary     = cv.summary  || '';
    var expectedSal = cv.expectedSalary ? '$' + cv.expectedSalary + '/mo' : (u.expectedSalary || '');
    var waFull  = u.whatsappFull || '';
    var callNum = u.phoneForCalls || waFull;
    var canWa   = reveal && !!waFull  && (u.contactMethod !== 'call');
    var canCall = reveal && !!callNum && (u.contactMethod !== 'whatsapp');
    var waUrl   = 'https://wa.me/' + waFull + '?text=' + encodeURIComponent('Hi ' + (u.name || '') + ', I saw your profile on PaMarket and I have a job opportunity for you.');
    var jobTypes = (u.jobTypes || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    // Action used in the header + bottom bar when contact is still locked.
    var reqBtnHeader = pending
      ? '<div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.18);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;color:#fff"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Request pending</div>'
      : '<div onclick="H._requestContact(\'' + H.escHtml(u.id) + '\')" style="display:flex;align-items:center;gap:5px;background:#F5A623;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:800;color:#1A3A8F;cursor:pointer"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Request to contact</div>';

    var coverLetter = cv.coverLetter || '';
    var eduLevel = cv.educationLevel || u.educationLevel
      || ({ secondary: 'High School / Secondary', certificate: 'Certificate / Diploma', degree: "Bachelor's Degree", postgrad: 'Postgraduate' }[_candEduLevel(u)] || '');
    var commitment = jobTypes.join(', ');
    var postedTs = u.profileUpdatedAt || u.createdAt;
    var postedOn = postedTs ? new Date(postedTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    // Clean, left-aligned section (matches the reference; no flanking rules)
    var sec = function (title, body) {
      return '<div style="padding:20px 0;border-top:1px solid var(--border)">'
        + '<div style="font-size:17px;font-weight:700;color:var(--text);letter-spacing:-.015em;margin-bottom:13px">' + title + '</div>' + body + '</div>';
    };
    var drow = function (k, v) {
      return v ? '<div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0"><span style="font-size:13.5px;color:var(--sub);font-weight:500">' + k + '</span><span style="font-size:13.5px;color:var(--text);font-weight:600;text-align:right">' + H.escHtml(v) + '</span></div>' : '';
    };
    var longDesc = coverLetter.length > 260;
    var descHtml = '<div id="cvDescBox" style="font-size:13.5px;color:var(--text);line-height:1.75;white-space:pre-wrap;' + (longDesc ? 'max-height:118px;overflow:hidden;' : '') + '">' + H.escHtml(coverLetter) + '</div>'
      + (longDesc ? '<button onclick="var d=document.getElementById(\'cvDescBox\');d.style.maxHeight=\'none\';this.style.display=\'none\'" style="background:none;border:none;color:#1A3A8F;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px;padding:0">Show full description</button>' : '');

    return '<div class="page active">'
      + H.innerTopbar('Candidate CV')
      + '<div>'
      // ── header ──
      + '<div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952c8 100%);padding:22px 18px 20px">'
      + '<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">'
      + '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:3px solid rgba(255,255,255,.3)">'
      + (u.avatar ? '<img src="' + u.avatar + '" onclick="H.viewImage(\'' + (u.avatar || '').replace(/'/g, "\\'") + '\')" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in">' : '<div style="width:100%;height:100%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">' + (reveal ? ini : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>') + '</div>')
      + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px"><div style="font-size:19px;font-weight:800;color:#fff">' + H.escHtml(reveal ? (u.name || 'Anonymous') : 'Candidate') + '</div>' + (reveal ? verBadge : '') + '</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.9);font-weight:600;margin-bottom:5px">' + H.escHtml(headline) + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:rgba(255,255,255,.72)">'
      + (location ? '<span style="display:inline-flex;align-items:center;gap:3px">' + H.ICONS.location + H.escHtml(location) + '</span>' : '')
      + (expLvl   ? '<span style="display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>' + H.escHtml(expLvl) + '</span>' : '')
      + (expectedSal ? '<span style="display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' + H.escHtml(expectedSal) + '</span>' : '')
      + '</div>'
      + (jobTypes.length ? '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">' + jobTypes.map(function(t){ return '<span style="background:rgba(255,255,255,.2);color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px">' + H.escHtml(t) + '</span>'; }).join('') + '</div>' : '')
      + ((reveal && (u.linkedinUrl || u.githubUrl || u.websiteUrl)) ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:11px">'
          + (u.linkedinUrl ? '<a href="' + H.escHtml(u.linkedinUrl) + '" target="_blank" style="color:rgba(255,255,255,.85);text-decoration:none;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> LinkedIn</a>' : '')
          + (u.githubUrl   ? '<a href="' + H.escHtml(u.githubUrl)   + '" target="_blank" style="color:rgba(255,255,255,.85);text-decoration:none;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg> GitHub</a>' : '')
          + (u.websiteUrl  ? '<a href="' + H.escHtml(u.websiteUrl)  + '" target="_blank" style="color:rgba(255,255,255,.85);text-decoration:none;display:inline-flex;align-items:center;gap:3px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg> Portfolio</a>' : '')
          + '</div>' : '')
      + '</div></div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:14px 18px 2px">'
      + (reveal
        ? (canWa ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" style="flex:1;min-width:128px;display:flex;align-items:center;justify-content:center;gap:6px;background:#25D366;padding:11px 12px;border-radius:10px;font-size:12.5px;font-weight:700;color:#fff;text-decoration:none"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp</a>' : '')
          + (canCall ? '<a href="tel:+' + H.escHtml(callNum) + '" style="flex:1;min-width:128px;display:flex;align-items:center;justify-content:center;gap:6px;background:#1A3A8F;padding:11px 12px;border-radius:10px;font-size:12.5px;font-weight:700;color:#fff;text-decoration:none"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call</a>' : '')
          + '<div onclick="H.startChatWith(\'' + H.escHtml(u.id) + '\')" style="flex:1;min-width:128px;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--bg);padding:11px 12px;border-radius:10px;font-size:12.5px;font-weight:700;color:#1A3A8F;border:1.5px solid #1A3A8F;cursor:pointer"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Message</div>'
        : reqBtnHeader)
      + '</div></div>'
      // ── body ──
      + '<div style="padding:0 18px 140px">'
      + (!reveal ? '<div style="display:flex;align-items:flex-start;gap:10px;background:#1A3A8F0d;border:1px solid #1A3A8F22;border-radius:12px;padding:12px 14px;margin:16px 0 4px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0;margin-top:1px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><div style="font-size:12.5px;color:var(--text);line-height:1.55">' + (pending ? 'Your request is under review. The full name and contact details unlock here once it&#39;s approved.' : 'This candidate&#39;s <strong>name and contact details are hidden</strong>. Send a request and our team will unlock them for you once approved.') + '</div></div>' : '')
      // Details
      + ((expLvl || eduLevel || commitment || expectedSal || postedOn)
          ? sec('Details', drow('Work experience', expLvl) + drow('Education level', eduLevel) + drow('Commitment', commitment) + drow('Desired salary', expectedSal) + drow('Posted on', postedOn))
          : '')
      // Description (cover letter)
      + (coverLetter ? sec('Description', descHtml) : '')
      // About / summary
      + ((summary || u.bio) ? sec('About', '<p style="font-size:13.5px;color:var(--text);line-height:1.7;margin:0;white-space:pre-wrap">' + H.escHtml(summary || u.bio) + '</p>') : '')
      // Work experience
      + (exp.length ? sec('Work Experience', exp.map(function (e) {
          return '<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:3px">'
            + '<div style="font-size:14px;font-weight:700;color:var(--text)">' + H.escHtml(e.title || '') + '</div>'
            + (e.duration ? '<div style="font-size:11px;color:var(--sub);white-space:nowrap;flex-shrink:0">' + H.escHtml(e.duration) + '</div>' : '')
            + '</div>'
            + '<div style="font-size:12px;color:#1A3A8F;font-weight:600;margin-bottom:4px">' + H.escHtml(e.company || '') + '</div>'
            + (e.description ? '<div style="font-size:12px;color:var(--sub);line-height:1.65">' + H.escHtml(e.description) + '</div>' : '')
            + '</div>';
        }).join('')) : '')
      + (edu.length ? sec('Education', edu.map(function (e) {
          return '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
            + '<div style="font-size:14px;font-weight:700;color:var(--text)">' + H.escHtml(e.degree || e.qualification || '') + '</div>'
            + '<div style="font-size:12px;color:#1A3A8F;font-weight:600">' + H.escHtml(e.school || e.institution || '') + '</div>'
            + (e.year ? '<div style="font-size:11px;color:var(--sub);margin-top:2px">' + H.escHtml(e.year) + '</div>' : '')
            + '</div>';
        }).join('')) : '')
      + (skills.length ? sec('Skills', '<div style="display:flex;flex-wrap:wrap;gap:6px">' + skills.map(function (s) {
          return '<span style="background:#1A3A8F14;border:1px solid #1A3A8F30;color:#1A3A8F;font-size:12px;font-weight:600;padding:4px 10px;border-radius:8px">' + H.escHtml(s) + '</span>';
        }).join('') + '</div>') : '')
      + (certs.length ? sec('Certifications', certs.map(function (c) {
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
        : (reveal
          ? ((canWa ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" style="flex:1;padding:13px;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp</a>' : '')
            + (canCall ? '<a href="tel:+' + H.escHtml(callNum) + '" style="flex:1;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call</a>' : '')
            + '<button onclick="H.startChatWith(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:13px;' + (canWa || canCall ? 'background:var(--bg);color:#1A3A8F;border:1.5px solid #1A3A8F;' : 'background:#1A3A8F;color:#fff;border:none;') + 'border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Message</button>'
            + '<button onclick="H._cvDownload(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:13px;background:linear-gradient(135deg,#1A3A8F,#2952c8);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CV</button>')
          : (pending
            ? '<div style="flex:1;padding:14px;background:#F5A62318;color:#c07800;border-radius:12px;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Request pending review</div>'
            : '<button onclick="H._requestContact(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Request to contact</button>'))
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
    var skills = Array.isArray(cv.skills) && cv.skills.length ? cv.skills : (u.skills || '').split(',').filter(Boolean).map(function (s) { return s.trim(); }).filter(Boolean);
    var exp   = _arr(cv.experience);
    var edu   = _arr(cv.education);
    var certs = _arr(cv.certifications);
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

    if (!u.companyVerified) {
      var pendingBanner = u.company_verification_pending
        ? '<div style="background:#F5A62318;border:1px solid #F5A62340;border-radius:12px;padding:14px 16px;margin-bottom:20px"><div style="font-size:14px;font-weight:700;color:#c07800">Verification Pending</div><div style="font-size:13px;color:var(--sub);margin-top:4px">Your documents are under review. We\'ll notify you once approved.</div></div>'
        : '<button onclick="H.openInner(\'CompanyVerify\')" style="padding:14px 32px;background:linear-gradient(135deg,#1A3A8F,#0f2460);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;display:inline-block">Get Verified to Post Jobs</button>';
      return '<div class="page active">'
        + '<div class="det-topbar"><button class="back" onclick="H.goBack()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="det-topbar-title">Post a Job</div></div>'
        + '<div style="padding:48px 24px;text-align:center">'
        + '<div style="margin-bottom:16px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>'
        + '<div style="font-size:19px;font-weight:800;color:var(--text);margin-bottom:8px">Verification Required</div>'
        + '<div style="font-size:14px;color:var(--sub);line-height:1.7;margin-bottom:8px">To post a job you need to be verified. This protects job seekers from fraudulent listings.</div>'
        + '<div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:24px">Registered companies and sole traders / individuals are both welcome. Sole traders only need a National ID or Passport.</div>'
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
      + '<div style="font-size:12px;color:#1A3A8F;font-weight:600;line-height:1.6">Jobs go live immediately. Company name is always visible. Posting is free up to your plan\'s limit — '
      + '<span onclick="H.buyJobCreditsSheet()" style="text-decoration:underline;cursor:pointer">buy credits</span> or upgrade your '
      + '<span onclick="H.openInner(\'RecruiterSubscription\')" style="text-decoration:underline;cursor:pointer">recruiter plan</span> to post more.'
      + '<span id="jobCreditInfo">' + _jobCreditInfoText() + '</span></div>'
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

  function _jobCreditInfoText() {
    var n = H.state.jobCreditBalance || 0;
    return n > 0 ? ' You have ' + n + ' credit' + (n === 1 ? '' : 's') + '.' : '';
  }

  H.pages.PostJob_after = function () {
    H._jobQuestionsArr = [];
    H._jqRender();
    // Refresh credit balance / recruiter plan in the background, then patch
    // ONLY the banner text in place. Never H.renderPage() from this hook —
    // a full re-render wipes whatever the user has already typed into the
    // form AND re-runs this hook, fetching in an endless loop.
    if (typeof H.fetchJobCreditBalance === 'function') {
      H.fetchJobCreditBalance().then(function () {
        var el = document.getElementById('jobCreditInfo');
        if (el) el.textContent = _jobCreditInfoText();
      });
    }
    if (typeof H.fetchRecruiterProfile === 'function') H.fetchRecruiterProfile();
  };

  H.buyJobCreditsSheet = function () {
    var products = H.getActiveProducts('jobCredits');
    if (!products.length) return;
    var old = document.getElementById('_jobCreditSheet');
    if (old) old.remove();
    var sheet = document.createElement('div');
    sheet.id = '_jobCreditSheet';
    sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    sheet.addEventListener('click', function (ev) { if (ev.target === sheet) sheet.remove(); });
    var planHtml = products.map(function (p) {
      return '<button class="buy-sheet-opt' + (p.tag ? ' recommended' : '') + '" onclick="document.getElementById(\'_jobCreditSheet\').remove();H.buyJobCredits(\'' + p.productId + '\')">'
        + '<div><div class="buy-sheet-opt-name-row"><span class="buy-sheet-opt-name">' + p.label + '</span>'
        + (p.tag ? '<span class="buy-sheet-opt-tag">' + p.tag.toUpperCase() + '</span>' : '') + '</div></div>'
        + '<div class="buy-sheet-opt-price">' + (p.estimatedPriceUsd ? '$' + p.estimatedPriceUsd : 'Buy') + '</div>'
        + '</button>';
    }).join('');
    sheet.innerHTML = '<div style="background:var(--card,#fff);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 18px calc(env(safe-area-inset-bottom,0px)+20px);box-sizing:border-box">'
      + '<div style="width:36px;height:4px;background:var(--border-mid,#E2E2E7);border-radius:4px;margin:0 auto 16px"></div>'
      + '<div class="buy-sheet-title">Buy job posting credits</div>'
      + '<div class="buy-sheet-sub">Each credit publishes one extra job listing.</div>'
      + planHtml
      + '<button class="buy-sheet-cancel" onclick="document.getElementById(\'_jobCreditSheet\')&&document.getElementById(\'_jobCreditSheet\').remove()">Cancel</button>'
      + '<div class="buy-sheet-gplay-note">' + H.ICONS.googlePlay + '<span>Paid securely through Google Play — PaMarket never sees your card details.</span></div>'
      + '</div>';
    document.body.appendChild(sheet);
  };

  function _field(id, label, type, placeholder, value) {
    return '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">' + label + '</label>'
      + '<input id="' + id + '" type="' + type + '" placeholder="' + H.escHtml(placeholder) + '" value="' + (value || '') + '" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box"></div>';
  }

  function _textarea(id, label, placeholder, rows) {
    return '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">' + label + '</label>'
      + '<textarea id="' + id + '" placeholder="' + H.escHtml(placeholder) + '" rows="' + rows + '" style="width:100%;padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:Inter,sans-serif"></textarea></div>';
  }

  H._submitJob = async function () {
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
    if (!u.companyVerified) { H.toast('You must be verified to post jobs. Go to Profile > Get Verified.', 4000); return; }

    // Posting stays free up to the recruiter's plan limit (grandfathered —
    // this does not change existing free-posting behavior for anyone under
    // their limit). Only once AT the limit do we require a job credit,
    // consumed via spend_job_credit (server-side, auth.uid()-scoped) right
    // after the listing is created — never gated purely client-side, since
    // H.state.jobCreditBalance is just a locally cached read, not the
    // source of truth.
    var ent = typeof H.recruiterPlanEntitlements === 'function' ? H.recruiterPlanEntitlements((H.state.recruiterProfile || {}).planId || 'free') : { activeJobPosts: -1 };
    var activePosts = (H.state.listings || []).filter(function (l) { return l.cat === 'jobs' && l.sellerId === u.id && l.status !== 'removed'; }).length;
    var overLimit = ent.activeJobPosts >= 0 && activePosts >= ent.activeJobPosts;
    if (overLimit && (H.state.jobCreditBalance || 0) <= 0) {
      H.toast('You’ve reached your plan’s free job post limit. Buy a job credit or upgrade your recruiter plan to post more.', 5000, true);
      return;
    }

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
    // Cloud save — same safety contract as the main post flow. saveListingToCloud
    // surfaces the Phase A moderation trigger (content_blocked / account_banned /
    // account_suspended) as { blocked:true }. The backend is the source of truth;
    // no moderation rules are duplicated here — we only react to its decision.
    if (typeof H.saveListingToCloud === 'function') {
      var saveRes;
      try {
        saveRes = await (H.withTimeout ? H.withTimeout(H.saveListingToCloud(listing), 20000, 'save job') : H.saveListingToCloud(listing));
      } catch (e) {
        if (e && e._timeout && H.showError) H.showError('Saved on your device but the cloud didn’t respond — it will sync later.', e, 'jobs.cloud.timeout');
      }
      if (saveRes && saveRes.blocked) {
        // Rejected by the backend: undo the optimistic local add so the job never
        // shows as published, and show the friendly reason. No credit is spent.
        H.state.listings = (H.state.listings || []).filter(function (x) { return x.id !== listing.id; });
        H.saveState();
        var msg = (saveRes.friendly && saveRes.friendly.message) ||
          (window.Safety ? Safety.friendlyError(saveRes.error).message : 'This job could not be posted.');
        H.toast(msg, 6000, true);
        return;
      }
    }
    if (overLimit) {
      var sb = window.supabase;
      if (sb) {
        sb.rpc('spend_job_credit', { p_listing_id: listing.id }).then(function (r) {
          if (r.error || !r.data || r.data.ok !== true) {
            console.warn('spend_job_credit failed:', r.error && r.error.message, r.data && r.data.msg);
          } else if (typeof H.fetchJobCreditBalance === 'function') {
            H.fetchJobCreditBalance();
          }
        });
      }
    }
    // Reflect the backend's moderation state: a job flagged by the content filter
    // comes back as status 'flagged' (or 'pending' under manual review), so tell
    // the recruiter it's in review rather than falsely claiming it's live.
    var finalStatus = (listing.status || 'active');
    if (finalStatus !== 'active') {
      H.toast('Job submitted — it will appear once it passes review.', 5000);
    } else {
      H.toast('Job posted! Candidates can now apply.');
    }
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

    var lines    = (l.desc || '').split('\n');
    var company  = l.company || l.sellerName || parseLine(lines, 'COMPANY') || 'Company';
    var jobType  = parseLine(lines, 'JOB TYPE')      || '';
    var industry = parseLine(lines, 'INDUSTRY')      || '';
    var salary   = parseLine(lines, 'SALARY')        || 'Not disclosed';
    var expReq   = parseLine(lines, 'EXPERIENCE')    || '';
    var eduReq   = parseLine(lines, 'MIN EDUCATION') || parseLine(lines, 'EDUCATION') || '';
    var benefits = parseLine(lines, 'BENEFITS')      || '';
    var language = parseLine(lines, 'LANGUAGE')      || 'English';
    var coSize   = parseLine(lines, 'COMPANY SIZE')  || '';
    var skill    = parseLine(lines, 'SKILLS')        || parseLine(lines, 'SKILL') || '';
    var national = parseLine(lines, 'NATIONALITY')   || '';

    var d = l.desc || '';
    var descS  = d.indexOf('\nDESCRIPTION:\n');
    var respS  = d.indexOf('\nRESPONSIBILITIES:\n');
    var reqS   = d.indexOf('\nREQUIREMENTS:\n');
    var applyS = d.indexOf('\nHOW TO APPLY:');
    function _next(from) { return [respS,reqS,applyS,d.length].filter(function(x){return x>from;}).sort(function(a,b){return a-b;})[0]; }
    var description      = descS > -1 ? d.slice(descS + 14, _next(descS)).trim() : (d.split('\n').filter(function(ln){return !ln.includes(':');}).slice(0,4).join('\n') || '');
    var responsibilities = respS > -1 ? d.slice(respS + 19, _next(respS)).trim() : '';
    var requirements     = reqS  > -1 ? d.slice(reqS  + 15, _next(reqS)).trim()  : '';

    var u        = H.currentUser();
    var isMine   = u && l.sellerId && l.sellerId === u.id;
    var apps     = (H.state.applications || []);
    var myApp    = u ? apps.find(function(a){ return a.jobId === id && a.applicantId === u.id; }) : null;
    var appCount = apps.filter(function(a){ return a.jobId === id; }).length;

    var _sellerBiz  = (H.state.businesses || []).find(function(b){ return b.ownerUserId === l.sellerId && b.status === 'active'; });
    var _sellerUser = (H.state.users || []).find(function(u2){ return u2.id === l.sellerId; });
    var _logoSrc = (l.photos && l.photos[0]) || (_sellerBiz && _sellerBiz.logo) || (_sellerUser && _sellerUser.avatar) || '';
    var _ini = company.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase() || 'JB';

    var logoHtml = '<div style="width:58px;height:58px;border-radius:13px;border:1.5px solid #e5e7eb;background:#f9fafb;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;color:#374151;flex-shrink:0;overflow:hidden">'
      + (_logoSrc ? '<img src="' + _logoSrc + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : _ini)
      + '</div>';

    var icoCard   = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
    var icoPin    = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    var icoClock  = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    var icoBrief  = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
    var icoPerson = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    var icoFlag   = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';

    function infoRow(ico, label, val) {
      if (!val) return '';
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6">'
        + '<div style="width:36px;height:36px;border-radius:9px;background:#f9fafb;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + ico + '</div>'
        + '<div style="min-width:0"><div style="font-size:11px;color:#9ca3af;margin-bottom:1px">' + label + '</div>'
        + '<div style="font-size:14px;font-weight:600;color:#111827">' + H.escHtml(val) + '</div></div></div>';
    }

    function detailRow(label, val) {
      if (!val) return '';
      return '<div style="display:flex;align-items:baseline;padding:11px 0;border-bottom:1px solid #f3f4f6">'
        + '<div style="font-size:13px;color:#6b7280;width:115px;flex-shrink:0">' + label + '</div>'
        + '<div style="font-size:13.5px;font-weight:600;color:#111827;flex:1">' + H.escHtml(val) + '</div>'
        + '</div>';
    }

    var jobDetailsText = [description, responsibilities, requirements].filter(Boolean).join('\n\n');

    var applyBtn = myApp
      ? '<div style="width:100%;padding:15px;background:#f0fdf4;border-radius:13px;text-align:center;font-size:14px;font-weight:700;color:#15803d;display:flex;align-items:center;justify-content:center;gap:7px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Application Submitted</div>'
      : '<button onclick="H._applyToJob(\'' + id + '\')" style="width:100%;padding:15px;background:#111827;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Apply Now</button>';

    var hasCV = u && (u.cv || u.jobTitle);

    return '<div class="page active">'
      // Topbar
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 14px;height:56px;background:#fff;border-bottom:1px solid #f3f4f6;position:sticky;top:0;z-index:10">'
      + '<button onclick="H.goBack()" style="width:36px;height:36px;border-radius:50%;background:#f3f4f6;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#111827" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div style="flex:1;text-align:center;padding:0 8px;min-width:0"><div style="font-size:14px;font-weight:700;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:11px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(company) + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-shrink:0">'
      + '<button style="width:36px;height:36px;border-radius:50%;background:#f3f4f6;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>'
      + '<button onclick="H.share&&H.share()" style="width:36px;height:36px;border-radius:50%;background:#f3f4f6;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>'
      + '</div></div>'

      // Content area
      + '<div style="padding:14px 14px 130px;background:#f9fafb">'

      // Company / title card
      + '<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:10px;border:1px solid #e5e7eb">'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">'
      + logoHtml
      + '<div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800;color:#111827;line-height:1.25;margin-bottom:3px">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:13px;color:#6b7280">' + H.escHtml(company) + (l.city ? ' &middot; ' + H.escHtml(l.city) : '') + '</div></div></div>'
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<div style="width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0"></div>'
      + '<span style="font-size:12px;color:#6b7280">' + (appCount > 0 ? appCount + ' Applicant' + (appCount !== 1 ? 's' : '') : 'Be among the first to apply') + '</span>'
      + '<span style="color:#d1d5db">&middot;</span>'
      + '<span style="font-size:12px;color:#6b7280">Posted ' + H.timeAgo(l.createdAt) + '</span>'
      + '</div></div>'

      // Info rows
      + '<div style="background:#fff;border-radius:16px;padding:4px 16px;margin-bottom:10px;border:1px solid #e5e7eb">'
      + infoRow(icoCard,   'Salary',      salary)
      + infoRow(icoPin,    'Location',    l.city || 'Zimbabwe')
      + infoRow(icoClock,  'Job Type',    jobType || 'Full-time')
      + infoRow(icoBrief,  'Experience',  expReq)
      + infoRow(icoPerson, 'Nationality', national)
      + '</div>'

      // Apply button (inline)
      + '<div style="margin-bottom:10px">' + applyBtn + '</div>'

      // Job Details
      + (jobDetailsText
        ? '<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:10px;border:1px solid #e5e7eb">'
        + '<div style="font-size:15px;font-weight:800;color:#111827;margin-bottom:12px">Job Details</div>'
        + '<div style="font-size:14px;color:#374151;line-height:1.75;white-space:pre-line">' + H.escHtml(jobDetailsText) + '</div>'
        + '</div>'
        : '')

      // Details table
      + '<div style="background:#fff;border-radius:16px;padding:4px 16px;margin-bottom:10px;border:1px solid #e5e7eb">'
      + detailRow('Benefits',      benefits || 'Not specified')
      + detailRow('Min Education', eduReq   || 'Not specified')
      + detailRow('Language',      language)
      + detailRow('Company Size',  coSize)
      + detailRow('Skill',         skill)
      + detailRow('Industry',      industry)
      + (national ? detailRow('Nationality', national) : '')
      + '</div>'

      // Report this Ad
      + '<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:16px;padding:14px 16px;margin-bottom:10px;border:1px solid #e5e7eb">'
      + '<div onclick="' + (isMine ? '' : 'H.reportListing(\'' + id + '\')') + '" style="display:flex;align-items:center;gap:10px;cursor:pointer">' + icoFlag + '<span style="font-size:13.5px;font-weight:600;color:#374151">Report this Ad</span></div>'
      + (isMine ? '<span style="font-size:12.5px;font-weight:600;color:#1A3A8F;cursor:pointer" onclick="H.openInner(\'EditJob\',{listingId:\'' + id + '\'})">Manage Ad</span>' : '')
      + '</div>'

      // Add Digital Profile CTA
      + (!hasCV
        ? '<div onclick="H._getHired()" style="background:#1A3A8F;border-radius:16px;padding:18px 16px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between">'
        + '<div><div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:3px">Add a Digital Profile</div>'
        + '<div style="font-size:12px;color:rgba(255,255,255,.7)">Stand out with a complete CV profile</div></div>'
        + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'
        + '</div>'
        : '')

      + '</div>'

      // Sticky footer
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid #e5e7eb;z-index:200">'
      + (isMine
        ? '<button onclick="H.openInner(\'JobApplications\',{jobId:\'' + id + '\'})" style="width:100%;padding:14px;background:#111827;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px">View Applications (' + appCount + ')</button>'
        + '<div style="display:flex;gap:8px;margin-bottom:8px">'
        + '<button onclick="H.boostJobListing(\'' + id + '\')" style="flex:1;padding:11px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer">Boost this Job</button>'
        + '</div>'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="H.openInner(\'EditJob\',{listingId:\'' + id + '\'})" style="flex:1;padding:11px;background:#f9fafb;color:#374151;border:1.5px solid #e5e7eb;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer">Edit</button>'
        + '<button onclick="H._markJobFilled(\'' + id + '\')" style="flex:1;padding:11px;background:#f0fdf4;color:#15803d;border:1.5px solid #bbf7d0;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer">Mark Filled</button>'
        + '<button onclick="H._deleteJob(\'' + id + '\')" style="flex:1;padding:11px;background:#fef2f2;color:#dc2626;border:1.5px solid #fecaca;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer">Delete</button>'
        + '</div>'
        : applyBtn)
      + '</div></div>';
  };

  H._applyToJob = function (jobId) {
    if (!H.currentUser()) { H.requireAuth('Sign in to apply for jobs'); return; }
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; });
    if (!l) { H.toast('Job not found'); return; }
    H.openInner('ApplyJob', { jobId: jobId });
  };

  // Education-level → qualification dropdown value (reuses Hire-Talent matcher).
  var _QUAL_OPTS = [['none', 'No formal qualification'], ['secondary', 'High School / Secondary'], ['certificate', 'Certificate / Diploma'], ['degree', "Bachelor's Degree"], ['postgrad', 'Postgraduate']];

  H.pages.ApplyJob = function (params) {
    var jobId = params && params.jobId;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; });
    if (!l) return '<div class="page active">' + H.innerTopbar('Apply') + H.emptyState('Job not found', '', null, null) + '</div>';
    var u = H.currentUser() || {};
    var cv = u.cv || {};
    var company = l.company || l.sellerName || 'Company';
    var companyInitials = company.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase() || 'CO';
    var questions = l.custom_questions || [];
    var inS = 'width:100%;padding:13px 14px;border:1.5px solid var(--border);border-radius:13px;font-size:15px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;font-family:inherit;line-height:1.4';

    // Prefill from saved profile
    var preQual    = _candEduLevel(u) || '';
    var preTitle   = u.jobTitle || cv.headline || '';
    var preCat     = parseLine((l.desc || '').split('\n'), 'INDUSTRY') || '';
    var lastExp    = (_arr(cv.experience)[0]) || {};
    var preCompany = lastExp.company || '';
    var experienced = !!(u.exp && u.exp !== 'entry') || (_arr(cv.experience).length > 0);
    var resumeName = u.cvFileName || (u.cvFileUrl ? 'Resume on file' : '');
    var hasSavedCV = !!(preTitle || preCompany || preQual || resumeName);

    // Section heading helper — thin left accent bar, friendly tone
    function secHead(title, sub) {
      return '<div style="display:flex;align-items:center;gap:10px;margin:24px 0 14px">'
        + '<div style="width:4px;height:20px;background:#1A3A8F;border-radius:3px;flex-shrink:0"></div>'
        + '<div><div style="font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.2px">' + title + '</div>'
        + (sub ? '<div style="font-size:12px;color:var(--sub);margin-top:1px">' + sub + '</div>' : '')
        + '</div></div>';
    }

    // Inline field — label above input
    function field(label, req, inner) {
      return '<div style="margin-bottom:14px">'
        + '<label style="font-size:13px;font-weight:700;color:var(--text);display:block;margin-bottom:7px">'
        + label + (req ? '<span style="color:#ef4444;margin-left:3px">*</span>' : '') + '</label>'
        + inner + '</div>';
    }

    var statusBtn = function (val, label) {
      var on = (experienced ? 'Experienced' : 'Fresher') === val;
      return '<button type="button" data-val="' + val + '" onclick="H._ajStatus(this)" style="flex:1;padding:12px;border:1.5px solid ' + (on ? '#1A3A8F' : 'var(--border)') + ';border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:' + (on ? '#1A3A8F' : 'var(--card)') + ';color:' + (on ? '#fff' : 'var(--text)') + ';font-family:inherit;transition:all .15s">' + label + '</button>';
    };

    // CV snapshot card shown when they have a saved profile
    var cvCard = hasSavedCV
      ? '<div style="background:var(--bg);border:1.5px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:8px">'
          + (preTitle ? '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:3px">' + H.escHtml(preTitle) + '</div>' : '')
          + (preCompany ? '<div style="font-size:13px;color:var(--sub);margin-bottom:6px">' + H.escHtml(preCompany) + (lastExp.startDate ? ' · ' + H.escHtml(lastExp.startDate) : '') + '</div>' : '')
          + (preQual ? '<div style="display:inline-flex;align-items:center;background:#EEF2FF;color:#1A3A8F;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:8px">' + H.escHtml((_QUAL_OPTS.find(function(o){return o[0]===preQual;})||['',''])[1] || preQual) + '</div>' : '')
          + (resumeName
              ? '<div style="display:flex;align-items:center;gap:8px;background:#22c55e12;border:1px solid #22c55e30;border-radius:10px;padding:9px 12px;margin-top:4px">'
                + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#15803d" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
                + '<span style="flex:1;font-size:13px;font-weight:600;color:#15803d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(resumeName) + '</span>'
                + (u.cvFileUrl ? '<a href="' + H.escHtml(u.cvFileUrl) + '" target="_blank" style="font-size:12px;font-weight:700;color:#15803d;text-decoration:none;padding:2px 0">View</a>' : '')
                + '</div>'
              : '')
          + '</div>'
        : '';

    var cvUpdateBtn = '<button onclick="H.openInner(\'CandidateProfile\')" style="width:100%;padding:13px;background:var(--bg);border:1.5px dashed #1A3A8F;border-radius:13px;font-size:14px;font-weight:700;color:#1A3A8F;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">'
      + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + (hasSavedCV ? 'Update your CV before applying' : 'Build your CV profile')
      + '</button>';

    var questionsHtml = questions.map(function (q, i) {
      var lbl = '<label style="font-size:14px;font-weight:600;color:var(--text);display:block;margin-bottom:10px;line-height:1.5">'
        + (q.required ? '<span style="color:#ef4444;margin-right:3px">*</span>' : '') + H.escHtml(q.question) + '</label>';
      var inp = '';
      if (q.type === 'yesno') {
        inp = '<div id="applyQ_' + i + '" data-value="" style="display:flex;gap:8px">'
          + '<button type="button" onclick="var p=this.parentElement;p.dataset.value=\'Yes\';this.style.background=\'#1A3A8F\';this.style.color=\'#fff\';this.style.borderColor=\'#1A3A8F\';this.nextElementSibling.style.background=\'var(--card)\';this.nextElementSibling.style.color=\'var(--text)\';this.nextElementSibling.style.borderColor=\'var(--border)\'" style="flex:1;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--card);color:var(--text);font-family:inherit">Yes</button>'
          + '<button type="button" onclick="var p=this.parentElement;p.dataset.value=\'No\';this.style.background=\'#1A3A8F\';this.style.color=\'#fff\';this.style.borderColor=\'#1A3A8F\';this.previousElementSibling.style.background=\'var(--card)\';this.previousElementSibling.style.color=\'var(--text)\';this.previousElementSibling.style.borderColor=\'var(--border)\'" style="flex:1;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--card);color:var(--text);font-family:inherit">No</button>'
          + '</div>';
      } else if (q.type === 'select') {
        inp = '<select id="applyQ_' + i + '" style="' + inS + '"><option value="">Pick one…</option>'
          + (q.options || []).map(function(o){ return '<option>' + H.escHtml(o) + '</option>'; }).join('') + '</select>';
      } else {
        inp = '<textarea id="applyQ_' + i + '" rows="3" placeholder="Your answer…" style="' + inS + ';resize:vertical"></textarea>';
      }
      return '<div style="margin-bottom:18px">' + lbl + inp + '</div>';
    }).join('');

    var _sellerBiz = (H.state.businesses || []).find(function(b){ return b.ownerUserId === l.sellerId && b.status === 'active'; });
    var _sellerUser = (H.state.users || []).find(function(u2){ return u2.id === l.sellerId; });
    var _logoSrc = (l.photos && l.photos[0]) || (_sellerBiz && _sellerBiz.logo) || (_sellerUser && _sellerUser.avatar) || '';

    return '<div class="page active">'
      + H.innerTopbar('Apply for this Job')

      + '<div style="padding:16px 16px 110px">'

      // ── Job context ──────────────────────────────────────────────
      + '<div style="display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:4px">'
      + '<div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#1A3A8F,#2952cc);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden">'
      + (_logoSrc ? '<img src="' + _logoSrc + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">' : '')
      + (_logoSrc ? '' : companyInitials)
      + '</div>'
      + '<div style="min-width:0"><div style="font-size:15px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(l.title) + '</div>'
      + '<div style="font-size:13px;color:var(--sub);margin-top:2px">' + H.escHtml(company) + ' · ' + H.escHtml(l.city || 'Zimbabwe') + '</div></div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--sub);text-align:center;padding:8px 0 4px">Your application goes directly to the employer</div>'

      // ── Section 1: About you ─────────────────────────────────────
      + secHead('About you', 'The employer will use this to contact you')
      + field('What is your full name?', true, '<input id="ajName" value="' + H.escHtml(u.name || '') + '" placeholder="e.g. Tendai Moyo" style="' + inS + '">')
      + field('Your email address', true, '<input id="ajEmail" type="email" value="' + H.escHtml(u.email || '') + '" placeholder="you@gmail.com" style="' + inS + '">')
      + field('Your phone number', true, '<input id="ajPhone" type="tel" value="' + H.escHtml(u.phone || u.whatsappFull || '') + '" placeholder="077 123 4567" style="' + inS + '">')
      + field('Where are you based?', false, '<input id="ajCity" value="' + H.escHtml(u.city || '') + '" placeholder="City or town, e.g. Harare" style="' + inS + '">')

      // ── Section 2: Your CV ───────────────────────────────────────
      + secHead('Your CV', hasSavedCV ? 'This is what the employer will see about your background' : 'Help the employer understand your experience')
      + (hasSavedCV ? cvCard : '')
      + cvUpdateBtn

      // Show the detail fields so they can still fill in / confirm manually
      + '<div style="margin-top:18px">'
      + field('Your highest qualification', true, '<select id="ajQual" style="' + inS + '"><option value="">Select your qualification…</option>'
          + _QUAL_OPTS.map(function(o){ return '<option value="' + o[0] + '"' + (preQual === o[0] ? ' selected' : '') + '>' + H.escHtml(o[1]) + '</option>'; }).join('') + '</select>')
      + field('Are you experienced or a fresher?', true,
          '<div id="ajStatus" data-value="' + (experienced ? 'Experienced' : 'Fresher') + '" style="display:flex;gap:8px">'
          + statusBtn('Fresher', 'Fresher — just starting out')
          + statusBtn('Experienced', 'Experienced')
          + '</div>')
      + field('Your current job title', true, '<input id="ajTitle" value="' + H.escHtml(preTitle) + '" placeholder="e.g. Customer Service Driver" style="' + inS + '">')
      + field('Which job category fits best?', true, '<select id="ajCategory" style="' + inS + '"><option value="">Pick a category…</option>'
          + JOB_CATS.map(function(c){ return '<option' + (preCat === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('') + '<option' + (preCat === 'Other' ? ' selected' : '') + '>Other</option></select>')
      + field('Specific industry (optional)', false, '<input id="ajIndustry" placeholder="e.g. Logistics, Mining, Retail…" style="' + inS + '">')
      + field('Most recent employer', false, '<input id="ajCompany" value="' + H.escHtml(preCompany) + '" placeholder="Company name" style="' + inS + '">')
      + field('How long were you there?', false,
          '<div style="display:flex;gap:10px;margin-bottom:10px">'
          + '<div style="flex:1"><label style="font-size:11px;color:var(--sub);font-weight:600;display:block;margin-bottom:5px">From</label><input id="ajStart" type="month" style="' + inS + '"></div>'
          + '<div style="flex:1"><label style="font-size:11px;color:var(--sub);font-weight:600;display:block;margin-bottom:5px">To</label><input id="ajEnd" type="month" style="' + inS + '"></div>'
          + '</div>'
          + '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px 14px;background:var(--bg);border-radius:12px;border:1.5px solid var(--border)">'
          + '<input type="checkbox" id="ajCurrent" onchange="var e=document.getElementById(\'ajEnd\');e.disabled=this.checked;if(this.checked)e.value=\'\'" style="width:18px;height:18px;accent-color:#1A3A8F;flex-shrink:0">'
          + '<span style="font-size:14px;font-weight:600;color:var(--text)">I still work here</span></label>')
      + '</div>'

      // ── Section 3: Why you? ──────────────────────────────────────
      + secHead('Why are you a good fit?', 'Optional — but a personal note makes a big difference')
      + '<textarea id="applyMsg" rows="4" placeholder="Tell the employer a bit about yourself — why this role suits you, what you bring to the table, or anything else worth knowing." style="' + inS + ';resize:vertical"></textarea>'

      // ── Screening questions ──────────────────────────────────────
      + (questions.length
        ? '<div style="margin-top:22px">'
          + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
          + '<div style="width:4px;height:20px;background:#F5A623;border-radius:3px;flex-shrink:0"></div>'
          + '<div style="font-size:16px;font-weight:800;color:var(--text)">A few quick questions</div></div>'
          + questionsHtml
          + '</div>'
        : '')

      + '</div>'

      // ── Sticky footer ────────────────────────────────────────────
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button onclick="H._submitApplyJob(\'' + H.escHtml(jobId) + '\')" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#2952cc);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Submit Application</button>'
      + '<button onclick="H._clearApplyForm()" style="width:100%;margin-top:8px;padding:11px;background:none;border:none;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;font-family:inherit">Clear form and start over</button>'
      + '</div></div>';
  };

  H._ajStatus = function (btn) {
    var wrap = document.getElementById('ajStatus'); if (!wrap) return;
    wrap.dataset.value = btn.getAttribute('data-val');
    [].forEach.call(wrap.querySelectorAll('button'), function (b) {
      var on = b === btn;
      b.style.background = on ? '#1A3A8F' : 'var(--card)';
      b.style.color = on ? '#fff' : 'var(--text)';
      b.style.borderColor = on ? '#1A3A8F' : 'var(--border)';
    });
  };

  H._clearApplyForm = function () {
    ['ajName', 'ajEmail', 'ajPhone', 'ajCity', 'ajTitle', 'ajIndustry', 'ajCompany', 'ajStart', 'ajEnd', 'applyMsg'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    ['ajQual', 'ajCategory'].forEach(function (id) { var el = document.getElementById(id); if (el) el.selectedIndex = 0; });
    var cur = document.getElementById('ajCurrent'); if (cur) cur.checked = false;
    var end = document.getElementById('ajEnd'); if (end) end.disabled = false;
    H.toast('Form cleared');
  };

  function _fmtMonth(v) { // "2022-06" → "06/2022"
    if (!v) return '';
    var p = v.split('-'); return p.length === 2 ? p[1] + '/' + p[0] : v;
  }

  H._submitApplyJob = function (jobId) {
    var u = H.currentUser(); if (!u) return;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; }); if (!l) return;
    function val(id) { return ((document.getElementById(id) || {}).value || '').trim(); }
    var name = val('ajName'), email = val('ajEmail'), phone = val('ajPhone');
    var city = val('ajCity'), title = val('ajTitle');
    var qualSel = document.getElementById('ajQual');
    var qual = qualSel ? (qualSel.options[qualSel.selectedIndex] || {}).text || '' : '';
    var qualVal = val('ajQual');
    var category = val('ajCategory'), industry = val('ajIndustry'), curCompany = val('ajCompany');
    var status = (document.getElementById('ajStatus') || {}).dataset ? document.getElementById('ajStatus').dataset.value : '';
    var start = _fmtMonth(val('ajStart')), end = _fmtMonth(val('ajEnd'));
    var current = !!(document.getElementById('ajCurrent') || {}).checked;
    var duration = start ? (start + ' – ' + (current ? 'Present' : (end || '—'))) : '';

    if (!name)  { H.toast('Please enter your full name'); return; }
    if (!email) { H.toast('Please enter your email address'); return; }
    if (!phone) { H.toast('Please enter your phone number'); return; }
    if (!qualVal) { H.toast('Please select your qualification'); return; }
    if (!title) { H.toast('Please enter your job title'); return; }
    if (!category) { H.toast('Please select a job category'); return; }

    var msg = val('applyMsg');
    var answers = [];
    function add(q, a) { if (a) answers.push({ question: q, answer: a }); }
    add('Located in', city);
    add('Qualification', qual);
    add('Job status', status);
    add('Current / desired job title', title);
    add('Category', category);
    add('Industry', industry);
    add('Current / last company', curCompany);
    add('Duration', duration);
    if (u.cvFileName || u.cvFileUrl) add('Resume', u.cvFileName || u.cvFileUrl);

    // Screening questions
    var questions = l.custom_questions || [];
    var valid = true;
    questions.forEach(function (q, i) {
      var el = document.getElementById('applyQ_' + i);
      var v = (q.type === 'yesno') ? (el ? (el.dataset.value || '') : '') : (el ? ((el.value || '').trim()) : '');
      if (q.required && !v) { H.toast('Please answer: ' + q.question.slice(0, 60)); valid = false; }
      answers.push({ questionId: q.id, question: q.question, answer: v });
    });
    if (!valid) return;

    H._submitJobApplication(jobId, msg, answers, { name: name, email: email, phone: phone });
  };

  H._submitJobApplication = function (jobId, message, answers, profile) {
    var u = H.currentUser(); if (!u) return;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; }); if (!l) return;
    var company = l.company || l.sellerName || 'Company';
    profile = profile || {};
    H.state.applications = H.state.applications || [];
    var existing = H.state.applications.find(function(a){ return a.jobId === jobId && a.applicantId === u.id; });
    if (existing) { H.toast('You already applied for this job'); return; }
    var app = {
      id: H.uid(), jobId: jobId, jobTitle: l.title, company: company,
      applicantId: u.id,
      applicantName: profile.name || u.name || 'Applicant',
      applicantEmail: profile.email || u.email || '',
      applicantPhone: profile.phone || u.phone || '',
      message: message, answers: answers || [], status: 'pending', appliedAt: Date.now(),
      employerId: l.sellerId
    };
    H.state.applications.push(app);
    H.saveState();
    if (typeof H.saveApplicationToCloud === 'function') H.saveApplicationToCloud(app);
    if (l.sellerId) H.pushNotif(l.sellerId, 'New Application', (u.name || 'Someone') + ' applied for ' + (l.title || 'your job'), 'message');
    if (!Array.isArray(H.state.conversations)) H.state.conversations = [];
    var ids = [u.id, l.sellerId].sort();
    var convId = 'job_' + H.idFrag(jobId) + '_' + H.idFrag(ids[0]) + '_' + H.idFrag(ids[1]);
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

  // ── Colour pool for applicant avatars ──────────────────────
  var _APP_COLORS = ['#1A3A8F','#7C3AED','#059669','#DC2626','#F59E0B','#2563EB','#DB2777','#0891B2'];
  function _appAvatarColor(name) {
    var h = 0;
    for (var i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % _APP_COLORS.length;
    return _APP_COLORS[Math.abs(h)];
  }
  var _APP_STATUS_LABEL = { new:'NEW', pending:'NEW', reviewed:'REVIEWED', shortlisted:'SHORTLISTED', hired:'HIRED', declined:'DECLINED', rejected:'DECLINED' };
  var _APP_STATUS_COLOR = { new:'#F5A623', pending:'#F5A623', reviewed:'#6366F1', shortlisted:'#22c55e', hired:'#15803d', declined:'#ef4444', rejected:'#ef4444' };

  H.pages.JobApplications = function (params) {
    var jobId     = params && params.jobId;
    var filterKey = (params && params.filter) || 'all';
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Applications') + H.emptyState('Sign in required', '', null, null) + '</div>';

    var l       = (H.state.listings || []).find(function(x){ return x.id === jobId; });
    var title   = l ? l.title   : 'Job';
    var company = l ? (l.company || l.sellerName || 'Company') : 'Company';

    var all = (H.state.applications || [])
      .filter(function(a){ return a.jobId === jobId; })
      .sort(function(a, b){ return b.appliedAt - a.appliedAt; });

    var nNew  = all.filter(function(a){ var s=a.status||'new'; return s==='new'||s==='pending'||s==='reviewed'; }).length;
    var nShrt = all.filter(function(a){ return a.status==='shortlisted'; }).length;
    var nHire = all.filter(function(a){ return a.status==='hired'; }).length;
    var nDecl = all.filter(function(a){ return a.status==='declined'||a.status==='rejected'; }).length;

    var shown = filterKey === 'all' ? all
      : filterKey === 'new' ? all.filter(function(a){ var s=a.status||'new'; return s==='new'||s==='pending'||s==='reviewed'; })
      : filterKey === 'declined' ? all.filter(function(a){ return a.status==='declined'||a.status==='rejected'; })
      : all.filter(function(a){ return a.status === filterKey; });

    function _statBox(n, lbl, col) {
      return '<div style="flex:1;padding:10px 4px;text-align:center">'
        + '<div style="font-size:20px;font-weight:900;color:' + col + '">' + n + '</div>'
        + '<div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.4px;margin-top:1px">' + lbl + '</div>'
        + '</div>';
    }

    var pills = [['all','All',all.length],['new','New',nNew],['shortlisted','Shortlisted',nShrt],['hired','Hired',nHire],['declined','Declined',nDecl]].map(function(fp){
      var on = filterKey === fp[0];
      return '<button onclick="H.renderPage(\'JobApplications\',{jobId:\''+jobId+'\',filter:\''+fp[0]+'\'})" style="padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;border:'+(on?'none':'1.5px solid var(--border)')+';background:'+(on?'#1A3A8F':'var(--card)')+';color:'+(on?'#fff':'var(--sub)')+';cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">'
        + fp[1] + (fp[2] ? ' (' + fp[2] + ')' : '') + '</button>';
    }).join('');

    function _appCard(app) {
      var s      = app.status || 'new';
      var sLbl   = _APP_STATUS_LABEL[s] || s.toUpperCase();
      var sCol   = _APP_STATUS_COLOR[s] || '#9CA3AF';
      var ini    = (app.applicantName || 'A').split(' ').map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0, 2);
      var color  = _appAvatarColor(app.applicantName);
      var msg    = (app.message || '').trim();
      var preview = msg ? ('"' + msg.slice(0, 130) + (msg.length > 130 ? '…' : '') + '"') : '';
      var fade   = (s === 'declined' || s === 'rejected') ? 'opacity:.65;' : '';

      // Action buttons follow the interview pipeline:
      // new/reviewed → Shortlist | Message | Decline
      // shortlisted  → Mark Hired | Message | Decline
      // hired        → Message only
      // declined     → Reconsider
      var btns;
      if (s === 'hired') {
        btns = '<button onclick="H._openApplicationChat(\''+app.id+'\')" style="flex:1;padding:10px;background:#EFF6FF;color:#1A3A8F;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Message</button>';
      } else if (s === 'shortlisted') {
        btns = '<button onclick="H._setAppStatus(\''+app.id+'\',\'hired\')" style="flex:1;padding:10px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Mark Hired</button>'
             + '<button onclick="H._openApplicationChat(\''+app.id+'\')" style="flex:1;padding:10px;background:#EFF6FF;color:#1A3A8F;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Message</button>'
             + '<button onclick="H._setAppStatus(\''+app.id+'\',\'declined\')" style="flex:1;padding:10px;background:#FEE2E2;color:#991B1B;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>';
      } else if (s === 'declined' || s === 'rejected') {
        btns = '<button onclick="H._setAppStatus(\''+app.id+'\',\'shortlisted\')" style="flex:1;padding:10px;background:#EFF6FF;color:#1A3A8F;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Reconsider</button>'
             + '<button onclick="H._openApplicationChat(\''+app.id+'\')" style="flex:1;padding:10px;background:#F3F4F6;color:#374151;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Message</button>';
      } else {
        // new / reviewed / pending
        btns = '<button onclick="H._setAppStatus(\''+app.id+'\',\'shortlisted\')" style="flex:1;padding:10px;background:#DCFCE7;color:#15803d;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Shortlist</button>'
             + '<button onclick="H._openApplicationChat(\''+app.id+'\')" style="flex:1;padding:10px;background:#EFF6FF;color:#1A3A8F;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Message</button>'
             + '<button onclick="H._setAppStatus(\''+app.id+'\',\'declined\')" style="flex:1;padding:10px;background:#FEE2E2;color:#991B1B;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>';
      }

      return '<div style="background:var(--card);border-radius:16px;border:1px solid var(--border);overflow:hidden;margin-bottom:12px;' + fade + '">'
        + '<div style="display:flex;align-items:center;gap:12px;padding:14px 14px 10px">'
        + '<div style="width:46px;height:46px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#fff;flex-shrink:0">' + H.escHtml(ini) + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:800;color:var(--text)">' + H.escHtml(app.applicantName || 'Applicant') + '</div>'
        + '<div style="font-size:11px;color:var(--sub);margin-top:2px">' + H.timeAgo(app.appliedAt) + (app.applicantPhone ? ' · ' + H.escHtml(app.applicantPhone) : '') + '</div>'
        + '</div>'
        + '<span style="background:' + sCol + '18;color:' + sCol + ';font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap">' + sLbl + '</span>'
        + '</div>'
        + (preview ? '<div style="margin:0 14px 10px;padding:9px 12px;background:var(--bg);border-radius:10px;border-left:3px solid #1A3A8F">'
            + '<div style="font-size:12.5px;color:var(--sub);line-height:1.55;font-style:italic">' + H.escHtml(preview) + '</div></div>' : '')
        + '<div style="display:flex;gap:7px;padding:0 14px 14px">'
        + '<button onclick="H.openInner(\'ApplicationDetail\',{appId:\'' + app.id + '\'})" style="display:flex;align-items:center;justify-content:center;gap:5px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit;flex-shrink:0"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Full CV</button>'
        + btns
        + '</div></div>';
    }

    return '<div class="page active">'
      + '<div style="background:#1A3A8F;padding:48px 16px 0">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
      + '<button onclick="H.goBack()" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#fff">Applications</div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,.65);margin-top:1px">' + H.escHtml(title) + ' · ' + H.escHtml(company) + '</div></div>'
      + (nNew > 0 ? '<span style="background:#F5A623;color:#1A3A8F;font-size:11px;font-weight:800;padding:3px 9px;border-radius:20px">' + nNew + ' New</span>' : '')
      + '</div>'
      + '<div style="display:flex;background:rgba(255,255,255,.1);border-radius:14px 14px 0 0">'
      + _statBox(all.length, 'Total',       '#fff')
      + _statBox(nNew,       'New',         '#F5A623')
      + _statBox(nShrt,      'Shortlisted', '#86EFAC')
      + _statBox(nHire,      'Hired',       '#4ADE80')
      + '</div></div>'
      + '<div style="display:flex;gap:8px;overflow-x:auto;padding:12px 14px;background:var(--card);border-bottom:1px solid var(--border);scrollbar-width:none">' + pills + '</div>'
      + '<div style="padding:12px 14px 88px">'
      + (shown.length ? shown.map(_appCard).join('') : H.emptyState('No applications here', 'Try a different filter', null, null))
      + '</div></div>';
  };

  // ── Full application detail page ────────────────────────────
  H.pages.ApplicationDetail = function (params) {
    var appId = params && params.appId;
    var app   = (H.state.applications || []).find(function(a){ return a.id === appId; });
    if (!app) return '<div class="page active">' + H.innerTopbar('Application') + H.emptyState('Not found', '', null, null) + '</div>';

    // Mark as reviewed when the employer opens the detail
    if (!app.status || app.status === 'new' || app.status === 'pending') {
      app.status = 'reviewed';
      H.saveState();
      if (typeof H.updateApplicationStatusCloud === 'function') H.updateApplicationStatusCloud(appId, 'reviewed');
    }

    var s      = app.status || 'reviewed';
    var sLbl   = _APP_STATUS_LABEL[s] || s;
    var sCol   = _APP_STATUS_COLOR[s] || '#9CA3AF';
    var ini    = (app.applicantName || 'A').split(' ').map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0, 2);
    var color  = _appAvatarColor(app.applicantName);

    var row = function(lbl, val) {
      return val ? '<div style="display:flex;padding:10px 0;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:12px;color:var(--sub);width:110px;flex-shrink:0;padding-top:1px">' + lbl + '</div>'
        + '<div style="font-size:13px;font-weight:600;color:var(--text);flex:1">' + H.escHtml(val) + '</div>'
        + '</div>' : '';
    };

    var footerBtns;
    if (s === 'hired') {
      footerBtns = '<button onclick="H._openApplicationChat(\''+appId+'\')" style="flex:1;padding:14px;background:#EFF6FF;color:#1A3A8F;border:none;border-radius:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Message</button>';
    } else if (s === 'shortlisted') {
      footerBtns = '<button onclick="H._setAppStatus(\''+appId+'\',\'hired\')" style="flex:1;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Mark Hired</button>'
                 + '<button onclick="H._openApplicationChat(\''+appId+'\')" style="flex:1;padding:14px;background:#EFF6FF;color:#1A3A8F;border:none;border-radius:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Message</button>';
    } else if (s === 'declined' || s === 'rejected') {
      footerBtns = '<button onclick="H._setAppStatus(\''+appId+'\',\'shortlisted\')" style="flex:1;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Reconsider</button>';
    } else {
      footerBtns = '<button onclick="H._setAppStatus(\''+appId+'\',\'shortlisted\')" style="flex:1;padding:14px;background:#1A3A8F;color:#fff;border:none;border-radius:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Shortlist for Interview</button>'
                 + '<button onclick="H._setAppStatus(\''+appId+'\',\'declined\')" style="flex:1;padding:14px;background:#FEE2E2;color:#991B1B;border:none;border-radius:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>';
    }

    return '<div class="page active">'
      + H.innerTopbar('Application')
      + '<div style="padding:16px 14px 100px">'

      // Applicant header card
      + '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:14px;display:flex;align-items:center;gap:14px">'
      + '<div style="width:54px;height:54px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff;flex-shrink:0">' + H.escHtml(ini) + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:17px;font-weight:800;color:var(--text)">' + H.escHtml(app.applicantName || 'Applicant') + '</div>'
      + '<div style="font-size:12px;color:var(--sub);margin-top:3px">' + H.timeAgo(app.appliedAt) + ' · ' + H.escHtml(app.jobTitle || '') + '</div>'
      + '</div>'
      + '<span style="background:' + sCol + '18;color:' + sCol + ';font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px">' + sLbl + '</span>'
      + '</div>'

      // Contact details
      + '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Contact</div>'
      + row('Phone', app.applicantPhone)
      + row('Email', app.applicantEmail)
      + row('City', app.applicantCity || '')
      + row('Experience', app.applicantExp || '')
      + row('Education', app.applicantQual || '')
      + '</div>'

      // Cover letter
      + (app.message ? '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px">'
          + '<div style="font-size:10px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Cover Letter</div>'
          + '<div style="font-size:13.5px;color:var(--text);line-height:1.75;white-space:pre-wrap">' + H.escHtml(app.message) + '</div>'
          + '</div>' : '')

      // Profile summary (generic fields like qualification, city, title, etc.)
      + (function() {
          var profileQA = (app.answers || []).filter(function(qa) { return !qa.questionId; });
          if (!profileQA.length) return '';
          return '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px">'
            + '<div style="font-size:10px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Profile Summary</div>'
            + profileQA.map(function(qa) {
                return qa.answer ? '<div style="display:flex;padding:7px 0;border-bottom:1px solid var(--border)">'
                  + '<div style="font-size:12px;color:var(--sub);width:120px;flex-shrink:0;padding-top:1px">' + H.escHtml(qa.question || '') + '</div>'
                  + '<div style="font-size:13px;font-weight:600;color:var(--text);flex:1">' + H.escHtml(qa.answer || '—') + '</div>'
                  + '</div>' : '';
              }).join('')
            + '</div>';
        }())
      // Screening questions from the employer — matched to candidate's answers
      + (function() {
          var customQA = (app.answers || []).filter(function(qa) { return !!qa.questionId; });
          if (!customQA.length) return '';
          return '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px">'
            + '<div style="font-size:10px;font-weight:800;color:#1A3A8F;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Screening Questions</div>'
            + customQA.map(function(qa) {
                return '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">'
                  + '<div style="font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px">' + H.escHtml(qa.question || '') + '</div>'
                  + '<div style="font-size:13.5px;color:var(--text);line-height:1.55;font-weight:500">' + H.escHtml(qa.answer || '—') + '</div>'
                  + '</div>';
              }).join('')
            + '</div>';
        }())

      + '</div>'

      // Sticky footer
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);border-top:1px solid var(--border);padding:12px 14px;padding-bottom:calc(12px + env(safe-area-inset-bottom));z-index:100;display:flex;gap:10px">'
      + footerBtns
      + '</div></div>';
  };

  H._setAppStatus = function (appId, status) {
    var app = (H.state.applications || []).find(function(a){ return a.id === appId; });
    if (!app) return;
    var prevStatus = app.status;
    app.status = status;
    H.saveState();
    if (typeof H.updateApplicationStatusCloud === 'function') H.updateApplicationStatusCloud(appId, status);
    var jobId   = app.jobId;
    var jTitle  = app.jobTitle || 'this position';
    var company = app.company  || 'the company';

    var toastMsg = { shortlisted: 'Shortlisted!', hired: 'Marked as Hired', declined: 'Declined', rejected: 'Declined' }[status] || 'Updated';
    H.toast(toastMsg);

    if (app.applicantId) {
      var notifTitle, notifBody, notifType;
      if (status === 'shortlisted') {
        notifTitle = 'You\'ve been shortlisted!';
        notifBody  = 'Great news! Your application for ' + jTitle + ' at ' + company + ' has been shortlisted. The employer will be in touch to arrange an interview.';
        notifType  = 'verify';
      } else if (status === 'hired') {
        notifTitle = 'Congratulations — You\'re Hired!';
        notifBody  = 'You have been selected for the role of ' + jTitle + ' at ' + company + '. Please check your messages for next steps.';
        notifType  = 'verify';
      } else if (status === 'declined' || status === 'rejected') {
        notifTitle = 'Application Update';
        notifBody  = 'Thank you for applying to ' + jTitle + ' at ' + company + '. The employer has moved forward with other candidates.';
        notifType  = 'info';
      }
      if (notifTitle) H.pushNotif(app.applicantId, notifTitle, notifBody, notifType);
    }

    // If we are on the detail page, return to the list; otherwise re-render list in place
    if (H.currentPageName === 'ApplicationDetail') {
      H.goBack();
    } else {
      H.renderPage('JobApplications', { jobId: jobId, filter: H.currentPageParams && H.currentPageParams.filter || 'all' });
    }
  };

  H.pages.JobApplications_after = function(params) {
    if (typeof H.syncApplications === 'function' && !H._syncingJobApplications) {
      H._syncingJobApplications = true;
      H.syncApplications().then(function(){
        if (H.currentPageName === 'JobApplications') H.renderPage('JobApplications', params || H.currentPageParams);
      }).catch(function(){}).finally(function(){
        H._syncingJobApplications = false;
      });
    }
  };

  H._deleteJob = function (id) {
    H.modal({
      title: 'Delete Job',
      body: '<div style="font-size:13px;color:var(--sub);line-height:1.6">This will permanently remove the job listing and all its applications. This cannot be undone.</div>',
      confirmText: 'Delete Job',
      danger: true,
      onConfirm: function () {
        var idx = (H.state.listings || []).findIndex(function(l){ return l.id === id; });
        if (idx > -1) H.state.listings.splice(idx, 1);
        H.saveState();
        var _sb = window.supabase;
        if (_sb && typeof _sb.from === 'function') {
          _sb.from('listings').update({ status: 'removed' }).eq('id', id)
            .then(function(r){ if(r&&r.error) console.warn('delete job:', r.error.message); });
        }
        H.toast('Job deleted');
        H.goBack(); H.goBack();
      }
    });
  };

  H._markJobFilled = function (id) {
    H.modal({
      title: 'Position Filled?',
      body: '<div style="font-size:13px;color:var(--sub);line-height:1.6">Mark this job as filled. It will be removed from active listings so no new applications come in.</div>',
      confirmText: 'Yes, Mark as Filled',
      onConfirm: function () {
        var l = (H.state.listings || []).find(function(x){ return x.id === id; });
        if (!l) return;
        l.status = 'filled';
        H.saveState();
        var _sb = window.supabase;
        if (_sb && typeof _sb.from === 'function') {
          _sb.from('listings').update({ status: 'filled' }).eq('id', id)
            .then(function(r){ if(r&&r.error) console.warn('mark filled:', r.error.message); });
        }
        H.toast('Job marked as filled — removed from active listings');
        H.goBack(); H.goBack();
      }
    });
  };

  H._openApplicationChat = function(appId) {
    var app = (H.state.applications || []).find(function(a){ return a.id === appId; });
    if (!app) return;
    var ids = [app.applicantId, app.employerId].sort();
    var convId = 'job_' + H.idFrag(app.jobId) + '_' + H.idFrag(ids[0]) + '_' + H.idFrag(ids[1]);
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
    if (!u) return '<div class="page active sticky-topbar">' + H.innerTopbar('My Applications') + H.emptyState('Sign in required', '', null, null) + '</div>';
    var apps = (H.state.applications || []).filter(function(a){ return a.applicantId === u.id; })
      .sort(function(a,b){ return b.appliedAt - a.appliedAt; });
    var statusColors = { pending:'#F5A623', reviewed:'#1A3A8F', shortlisted:'#22c55e', rejected:'#ef4444' };
    var statusLabels = { pending:'Pending', reviewed:'Reviewed', shortlisted:'Shortlisted', rejected:'Not selected' };

    return '<div class="page active sticky-topbar">'
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

  var _cpCardOpen = false;
  function _cpSectionHead(icon, title) {
    // Each section is its own card; close the previous one (if any) and open a new.
    var pre = _cpCardOpen ? '</div>' : '';
    _cpCardOpen = true;
    return pre + '<div class="cp-card"><div class="cp-card-head">'
      + '<span class="cp-card-ic">' + icon + '</span>'
      + '<span class="cp-card-title">' + title + '</span>'
      + '</div>';
  }
  // Close the final open card.
  function _cpSectionEnd() { var s = _cpCardOpen ? '</div>' : ''; _cpCardOpen = false; return s; }

  function _cpRenderSkillChips(skills) {
    return skills.map(function(s, i) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:#1A3A8F;color:#fff;font-size:12px;font-weight:600;padding:4px 8px;border-radius:8px">'
        + H.escHtml(s.trim())
        + '<button onclick="H._cpRemoveSkill(' + i + ')" style="background:none;border:none;color:#fff;font-size:13px;cursor:pointer;padding:0;line-height:1;font-family:inherit">×</button>'
        + '</span>';
    }).join('');
  }

  function _cpRenderExpList(arr) {
    if (!arr || !arr.length) {
      return '<div style="color:var(--sub);font-size:13px;padding:2px 0 10px">No experience added yet. Add your roles, companies and dates below.</div>';
    }
    return arr.map(function (e, i) {
      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px">'
        + '<div style="font-size:14px;font-weight:700;color:var(--text)">' + H.escHtml(e.title || '') + '</div>'
        + '<div style="font-size:13px;color:#1A3A8F;font-weight:600;margin-top:2px">' + H.escHtml(e.company || '') + '</div>'
        + ((e.duration || e.current) ? '<div style="font-size:12px;color:var(--sub);margin-top:2px">' + H.escHtml(e.duration || '') + (e.current ? ' · Current' : '') + '</div>' : '')
        + (e.desc ? '<div style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.5;white-space:pre-wrap">' + H.escHtml(e.desc) + '</div>' : '')
        + '<div style="display:flex;gap:8px;margin-top:10px">'
        + '<button type="button" onclick="H._cpExp.edit(' + i + ')" style="font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;background:#EFF6FF;color:#1A3A8F;border:1px solid #BFDBFE;cursor:pointer;font-family:inherit">Edit</button>'
        + '<button type="button" onclick="H._cpExp.del(' + i + ')" style="font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;cursor:pointer;font-family:inherit">Remove</button>'
        + '</div>'
        + '</div>';
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
    btn.style.background  = on ? '#1A3A8F' : 'var(--card)';
    btn.style.color       = on ? '#fff'    : 'var(--text)';
    btn.style.border      = on ? '1.5px solid #1A3A8F' : '1.5px solid var(--border)';
  };

  window._cpCM = function(btn) {
    var wrap = document.getElementById('cpCMWrap');
    if (!wrap) return;
    [].forEach.call(wrap.querySelectorAll('button[data-cm]'), function(b) {
      b.setAttribute('data-sel', '0');
      b.style.background = 'var(--card)';
      b.style.color      = 'var(--text)';
      b.style.border     = '1.5px solid var(--border)';
    });
    btn.setAttribute('data-sel', '1');
    btn.style.background = '#1A3A8F';
    btn.style.color      = '#fff';
    btn.style.border     = '1.5px solid #1A3A8F';
  };

  // Single-select pill group writing to a hidden input (Notice Period, Education).
  window._cpPick = function(btn) {
    var wrap = btn.parentNode;
    var hid = document.getElementById(wrap.getAttribute('data-target'));
    var val = btn.getAttribute('data-val');
    var already = hid && hid.value === val;
    [].forEach.call(wrap.querySelectorAll('button[data-val]'), function(b) {
      b.style.background = 'var(--card)'; b.style.color = 'var(--text)'; b.style.border = '1.5px solid var(--border)';
    });
    if (already) { if (hid) hid.value = ''; return; }
    btn.style.background = '#1A3A8F'; btn.style.color = '#fff'; btn.style.border = '1.5px solid #1A3A8F';
    if (hid) hid.value = val;
  };

  // Render a single-select pill row + its hidden input.
  function _cpPillRow(target, options, current) {
    return '<div data-target="' + target + '" style="display:flex;flex-wrap:wrap;gap:8px">'
      + options.map(function(o) {
        var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o, sel = current === v;
        return '<button type="button" onclick="_cpPick(this)" data-val="' + H.escHtml(v) + '" style="padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:' + (sel ? '#1A3A8F' : 'var(--card)') + ';color:' + (sel ? '#fff' : 'var(--text)') + ';border:1.5px solid ' + (sel ? '#1A3A8F' : 'var(--border)') + '">' + H.escHtml(t) + '</button>';
      }).join('')
      + '</div><input type="hidden" id="' + target + '" value="' + H.escHtml(current || '') + '">';
  }
  H._cpPillRow = _cpPillRow;

  window._cpOpenFile = function() {
    var fi = document.getElementById('cpResumeFile');
    if (fi) { try { fi.click(); } catch(e) {} }
  };

  window._cpSamePhone = function(el) {
    var row = document.getElementById('cpPhoneRow');
    if (row) row.style.display = el.checked ? 'none' : '';
  };

  H.pages.CandidateProfile = function (params) {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Job Seeker Profile') + H.emptyState('Sign in required', 'Sign in to set up your job seeker profile', 'Sign In', "H.requireAuth('Job seeker profile')") + '</div>';
    _cpCardOpen = false; // reset card-wrapping state for this render
    // Pre-fill from the Get Hired wizard (location + profession), else existing.
    var preCity   = (params && params.city && params.city !== 'Any') ? params.city : (u.city || '');
    var preSector = (params && params.sector) || u.sector || '';
    var ZW = H._ZW_CITIES || [];
    var expLevels = [['entry','Entry Level (0-2 yrs)'],['mid','3-5 Years'],['senior','5-10 Years'],['expert','10+ Years']];
    var on = u.openToWork ? '1' : '0';
    var togBg   = u.openToWork ? '#22c55e' : 'var(--border)';
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

    var jt_off = '1.5px solid var(--border)';
    var jt_on  = '1.5px solid #1A3A8F';

    return '<div class="page active">'
      + H.innerTopbar('Job Seeker Profile')
      + '<div style="margin:12px 14px;background:#22c55e18;border-radius:12px;padding:12px 14px;display:flex;gap:10px">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#15803d" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      + '<div style="font-size:12px;color:#15803d;font-weight:600;line-height:1.6">Employers in Hire Talent can find and contact you when you turn on Open to Work.</div>'
      + '</div>'
      + '<div style="padding:0 14px 100px">'

      // ── Open to Work toggle ──
      + '<div style="margin-bottom:16px;background:var(--card);border-radius:12px;padding:16px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<div><div style="font-size:15px;font-weight:700;color:var(--text)">Open to Work</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Appear in employer searches</div></div>'
      + '<div id="otwTog" onclick="var o=this.dataset.on===\'1\'?\'0\':\'1\';this.dataset.on=o;this.style.background=o===\'1\'?\'#22c55e\':\'var(--border)\';this.querySelector(\'div\').style.left=o===\'1\'?\'23px\':\'3px\'" data-on="' + on + '" style="width:46px;height:26px;border-radius:13px;background:' + togBg + ';position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">'
      + '<div style="position:absolute;top:3px;left:' + togLeft + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div></div>'
      + '</div>'

      // ── Basic Details ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>', 'Basic Details')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Current / Desired Job Title</label>'
      + '<input id="cpTitle" placeholder="e.g. Accountant, Driver, Teacher" value="' + H.escHtml(u.jobTitle || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Profession / Sector</label>'
      + '<select id="cpSector" style="' + inStyle + '"><option value="">Select profession…</option>'
      + (JOB_PROFESSIONS.indexOf(preSector) === -1 && preSector ? '<option value="' + H.escHtml(preSector) + '" selected>' + H.escHtml(preSector) + '</option>' : '')
      + JOB_PROFESSIONS.map(function(c){ return '<option value="' + H.escHtml(c) + '"' + (preSector === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Experience Level</label>'
      + '<select id="cpExp" style="' + inStyle + '"><option value="">Select level…</option>'
      + expLevels.map(function(e){ return '<option value="' + e[0] + '"' + (u.exp === e[0] ? ' selected' : '') + '>' + H.escHtml(e[1]) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">City</label>'
      + '<select id="cpCity" style="' + inStyle + '"><option value="">Select city…</option>'
      + ZW.map(function(c){ return '<option value="' + H.escHtml(c) + '"' + (preCity === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '<option value="Remote / Online"' + (preCity === 'Remote / Online' ? ' selected' : '') + '>Remote / Online</option>'
      + '</select></div>'

      // ── Professional Background ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>', 'Professional Background')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Bio / About Me</label>'
      + '<textarea id="cpBio" maxlength="300" placeholder="Tell employers a bit about yourself…" style="' + inStyle + 'height:90px;resize:vertical">' + H.escHtml(u.bio || '') + '</textarea>'
      + '<div style="text-align:right;font-size:11px;color:var(--sub);margin-top:3px"><span id="cpBioCount">' + (u.bio || '').length + '</span>/300</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Cover Letter <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<div style="font-size:12px;color:var(--sub);margin-bottom:8px;line-height:1.5">A short letter to employers, e.g. <em>“Dear Hiring Manager, I am writing to express my interest…”</em>. This shows as the Description on your profile.</div>'
      + '<textarea id="cpCover" maxlength="2000" placeholder="Dear Hiring Manager,&#10;&#10;I am writing to express my strong interest in…" style="' + inStyle + 'height:150px;resize:vertical;line-height:1.6">' + H.escHtml((u.cv && u.cv.coverLetter) || '') + '</textarea>'
      + '<div style="text-align:right;font-size:11px;color:var(--sub);margin-top:3px"><span id="cpCoverCount">' + (((u.cv && u.cv.coverLetter) || '').length) + '</span>/2000</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Skills</label>'
      + '<div id="cpSkillsChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + _cpRenderSkillChips(existingSkills) + '</div>'
      + '<input id="cpSkillsInput" placeholder="Type a skill and press comma or Enter…" style="' + inStyle + '">'
      + '<input type="hidden" id="cpSkillsVal" value="' + H.escHtml(existingSkills.join(',')) + '">'
      + '</div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Expected Salary / Rate <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpSalary" placeholder="e.g. $500/mo, $20/hr or Negotiable" value="' + H.escHtml(u.expectedSalary || '') + '" style="' + inStyle + '"></div>'

      // ── Work Experience ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>', 'Work Experience')
      + '<div style="font-size:12px;color:var(--sub);margin-bottom:10px;line-height:1.5">Add your roles, companies, dates and what you did in each one.</div>'
      + '<div id="cpExpList">' + _cpRenderExpList((u.cv && u.cv.experience) || []) + '</div>'
      + '<button type="button" onclick="H._cpExp.add()" style="width:100%;padding:12px;border-radius:12px;background:#EFF6FF;color:#1A3A8F;border:1.5px dashed #1A3A8F;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:6px">+ Add Experience</button>'

      // ── Job Preferences ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>', 'Job Preferences')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Job Type / Availability</label>'
      + '<div id="cpJTWrap" style="display:flex;flex-wrap:wrap;gap:8px">'
      + jobTypesList.map(function(t) {
          var sel = selectedJobTypes.indexOf(t) !== -1;
          return '<button type="button" onclick="_cpJT(this)" data-jt="' + H.escHtml(t) + '" data-sel="' + (sel ? '1' : '0') + '" style="padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:' + (sel ? '#1A3A8F' : 'var(--card)') + ';color:' + (sel ? '#fff' : 'var(--text)') + ';border:1.5px solid ' + (sel ? '#1A3A8F' : 'var(--border)') + '">' + H.escHtml(t) + '</button>';
        }).join('')
      + '</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Notice Period</label>'
      + _cpPillRow('cpNotice', ['Available Immediately', 'Less than 2 weeks', '1 Month', 'More than 1 Month'], (u.cv && u.cv.noticePeriod) || u.noticePeriod || '')
      + '</div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Education Level</label>'
      + _cpPillRow('cpEduLevel', ['High School', 'Diploma', "Bachelor's Degree", "Master's Degree", 'PhD', 'Other'], (u.cv && u.cv.educationLevel) || u.educationLevel || '')
      + '</div>'

      // ── Contact & Reach ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg>', 'Contact & Reach')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">WhatsApp Number</label>'
      + '<div style="display:flex;gap:8px">'
      + '<select id="cpWaCC" style="padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;flex-shrink:0;font-family:inherit">'
      + waCCOptions.map(function(o){ return '<option value="' + o[0] + '"' + (waCC === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
      + '</select>'
      + '<input id="cpWaNum" type="tel" placeholder="712 345 678" value="' + H.escHtml(waNum) + '" style="' + inStyle + '">'
      + '</div>'
      + '<div style="font-size:11px;color:var(--sub);margin-top:5px">Employers can message you directly on WhatsApp</div>'
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
          return '<button type="button" onclick="_cpCM(this)" data-cm="' + cm[1] + '" data-sel="' + (sel ? '1' : '0') + '" style="flex:1;padding:10px 6px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px;background:' + (sel ? '#1A3A8F' : 'var(--card)') + ';color:' + (sel ? '#fff' : 'var(--text)') + ';border:1.5px solid ' + (sel ? '#1A3A8F' : 'var(--border)') + '">' + cm[0] + '</button>';
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
      + '<div id="cpResumeZone" style="margin-bottom:4px">' + _cpRenderResumeZone(cvFileName) + '</div>'
      + '<input type="file" id="cpResumeFile" accept=".pdf,.doc,.docx" style="position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px">'
      + _cpSectionEnd()

      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button id="cpSaveBtn" onclick="H._saveCandidateProfile()" style="width:100%;padding:15px;background:linear-gradient(135deg,#22c55e,#15803d);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Save Profile</button>'
      + '</div></div>';
  };

  H.pages.CandidateProfile_after = function () {
    // ── Work Experience (LinkedIn-style) ──
    var _cpu = H.currentUser() || {};
    H._cpExpArr = (_cpu.cv && Array.isArray(_cpu.cv.experience))
      ? _cpu.cv.experience.map(function (e) { return { title: e.title, company: e.company, duration: e.duration, current: e.current, desc: e.desc }; })
      : [];

    function _cpRefreshExp() {
      var el = document.getElementById('cpExpList');
      if (el) el.innerHTML = _cpRenderExpList(H._cpExpArr);
    }

    function _expFormBody(e) {
      e = e || {};
      return '<div style="display:flex;flex-direction:column;gap:8px">'
        + '<input id="expTitle" class="fi" value="' + H.escHtml(e.title || '') + '" placeholder="Job Title *">'
        + '<input id="expCompany" class="fi" value="' + H.escHtml(e.company || '') + '" placeholder="Company Name *">'
        + '<input id="expDuration" class="fi" value="' + H.escHtml(e.duration || '') + '" placeholder="Duration e.g. Jan 2020 – Dec 2022">'
        + '<label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="expCurrent"' + (e.current ? ' checked' : '') + '>Still working here</label>'
        + '<textarea id="expDesc" class="fi" rows="3" placeholder="What you did / responsibilities…">' + H.escHtml(e.desc || '') + '</textarea>'
        + '</div>';
    }

    function _readExpForm() {
      var title   = ((document.getElementById('expTitle')   || {}).value || '').trim();
      var company = ((document.getElementById('expCompany') || {}).value || '').trim();
      if (!title || !company) { H.toast('Title and company are required'); return null; }
      return {
        title: title, company: company,
        duration: ((document.getElementById('expDuration') || {}).value || '').trim(),
        current:  !!(document.getElementById('expCurrent') && document.getElementById('expCurrent').checked),
        desc:     ((document.getElementById('expDesc') || {}).value || '').trim()
      };
    }

    H._cpExp = {
      add: function () {
        H.modal({
          title: 'Add Work Experience',
          body: _expFormBody(),
          confirmText: 'Add',
          onConfirm: function () {
            var entry = _readExpForm();
            if (!entry) return false;
            H._cpExpArr.push(entry);
            _cpRefreshExp();
          }
        });
      },
      edit: function (i) {
        H.modal({
          title: 'Edit Work Experience',
          body: _expFormBody(H._cpExpArr[i] || {}),
          confirmText: 'Save',
          onConfirm: function () {
            var entry = _readExpForm();
            if (!entry) return false;
            H._cpExpArr[i] = entry;
            _cpRefreshExp();
          }
        });
      },
      del: function (i) {
        H._cpExpArr.splice(i, 1);
        _cpRefreshExp();
      }
    };

    // Bio counter
    var bioEl = document.getElementById('cpBio');
    if (bioEl) {
      bioEl.addEventListener('input', function() {
        var cnt = document.getElementById('cpBioCount');
        if (cnt) cnt.textContent = this.value.length;
      });
    }
    // Cover letter counter
    var coverEl = document.getElementById('cpCover');
    if (coverEl) {
      coverEl.addEventListener('input', function() {
        var cnt = document.getElementById('cpCoverCount');
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

    // Validate required basics so an empty profile can't be saved.
    var vTitle  = ((document.getElementById('cpTitle')  || {}).value || '').trim();
    var vSector = (document.getElementById('cpSector')  || {}).value || '';
    var vCity   = (document.getElementById('cpCity')    || {}).value || '';
    var vBio    = ((document.getElementById('cpBio')    || {}).value || '').trim();
    if (!vTitle)  { H.toast('Add your job title to continue'); var e1=document.getElementById('cpTitle'); if(e1) e1.focus(); return; }
    if (!vSector) { H.toast('Choose your profession / sector'); return; }
    if (!vCity)   { H.toast('Choose your city'); return; }
    if (vBio.length < 20) { H.toast('Write a short bio (at least 20 characters) so employers know you'); var e2=document.getElementById('cpBio'); if(e2) e2.focus(); return; }

    var saveBtn = document.getElementById('cpSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    // Collect all form values
    u.openToWork     = !!(document.getElementById('otwTog') && document.getElementById('otwTog').dataset.on === '1');
    u.jobTitle       = vTitle;
    u.sector         = vSector;
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
    u.noticePeriod   = (document.getElementById('cpNotice')   || {}).value || '';
    u.educationLevel = (document.getElementById('cpEduLevel') || {}).value || '';

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
      coverLetter:    ((document.getElementById('cpCover') || {}).value || '').trim() || prevCv.coverLetter || '',
      skills:         (u.skills || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
      expectedSalary: u.expectedSalary || prevCv.expectedSalary || '',
      visible:        !!u.openToWork,
      experience:     (H._cpExpArr || prevCv.experience || []),
      education:      prevCv.education      || [],
      certifications: prevCv.certifications || [],
      noticePeriod:   u.noticePeriod   || prevCv.noticePeriod   || '',
      educationLevel: u.educationLevel || prevCv.educationLevel || '',
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

    if (H._cpResumeData && H._cpResumeFileName && typeof H.uploadToR2 === 'function') {
      try {
        var b64    = H._cpResumeData.split(',')[1] || '';
        var mmatch = H._cpResumeData.match(/data:([^;]+);/);
        var mime   = mmatch ? mmatch[1] : 'application/octet-stream';
        var bytes  = atob(b64);
        var arr    = new Uint8Array(bytes.length);
        for (var k = 0; k < bytes.length; k++) arr[k] = bytes.charCodeAt(k);
        var blob   = new Blob([arr], { type: mime });
        var key    = 'cv/' + u.id + '/' + Date.now() + '_' + H._cpResumeFileName;
        H.uploadToR2(blob, key, mime)
          .then(function(url) { _syncToCloud(url || ''); })
          .catch(function() { _syncToCloud(''); });
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

  // ── Recruiter subscription entitlements (single source of truth) ──
  // Mirrors H.PLAN_ENTITLEMENTS' shape in business-subscription.js.
  // Single paid tier only — recruiter_pro does not exist as a real Play
  // Console product; do not reintroduce a second tier here without first
  // creating a real recruiter_pro subscription product and adding it to
  // billing-products.js/.ts. activeJobPosts limit is enforced client-side
  // in H._submitJob below; -1 = unlimited.
  H.RECRUITER_PLAN_ENTITLEMENTS = {
    free:      { name: 'Free',      activeJobPosts: 2,  candidateAccess: 'limited', profileVisibility: 'standard', rank: 0 },
    recruiter: { name: 'Recruiter', activeJobPosts: -1, candidateAccess: 'full',     profileVisibility: 'featured', rank: 1 },
  };
  H.recruiterPlanEntitlements = function (planId) { return H.RECRUITER_PLAN_ENTITLEMENTS[planId] || H.RECRUITER_PLAN_ENTITLEMENTS.free; };

  H.RECRUITER_PLANS = [
    { id: 'free',      price: 0 },
    { id: 'recruiter', price: 12 },
  ];

  H.pages.RecruiterSubscription = function () {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Recruiter Plan') + H.emptyState('Sign in required', 'Sign in to manage your recruiter plan') + '</div>';

    var prof = H.state.recruiterProfile || { planId: 'free' };
    var curPlanId = prof.planId || 'free';
    var ent = H.recruiterPlanEntitlements(curPlanId);
    var curRank = ent.rank;

    var jobsPosted = (H.state.listings || []).filter(function (l) { return l.cat === 'jobs' && l.sellerId === u.id; }).length;

    function planCard(p) {
      var pent = H.recruiterPlanEntitlements(p.id);
      var cur = p.id === curPlanId;
      var higher = pent.rank > curRank;
      var priceParts = p.price === 0 ? '<div class="pcard-amt">Free</div>' : '<div class="pcard-amt">$' + p.price + '</div><div class="pcard-per">/mo</div>';
      var btn = '';
      if (cur) {
        btn = '<button class="pcard-btn pcard-btn-current">Your current plan</button>';
      } else if (higher && p.price > 0) {
        btn = '<button class="pcard-btn pcard-btn-buy" onclick="H.upgradeRecruiterPlan(\'' + p.id + '\',\'monthly\')">Upgrade to ' + H.escHtml(pent.name) + '</button>';
      }
      var features = [
        (pent.activeJobPosts < 0 ? 'Unlimited' : pent.activeJobPosts) + ' active job posts',
        H.escHtml(pent.candidateAccess) + ' candidate access',
        H.escHtml(pent.profileVisibility) + ' profile visibility'
      ].map(function (f) {
        return '<div class="pcard-feature"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' + f + '</div>';
      }).join('');
      return '<div class="pcard' + (cur ? ' pcard-current' : '') + '">'
        + '<div class="pcard-head">'
        + '<div class="pcard-name-row"><span class="pcard-name">' + H.escHtml(pent.name) + '</span>' + (cur ? '<span class="pcard-current-tag">CURRENT</span>' : '') + '</div>'
        + '<div class="pcard-price">' + priceParts + '</div></div>'
        + '<div class="pcard-divider"></div>'
        + '<div class="pcard-features">' + features + '</div>'
        + btn + '</div>';
    }

    return '<div class="page active">'
      + H.innerTopbar('Recruiter Plan')
      + '<div class="inner-content" style="padding-bottom:40px">'
      + '<div class="sub-hero">'
      + '<div class="sub-hero-label">CURRENT PLAN</div>'
      + '<div class="sub-hero-row"><div class="sub-hero-plan">' + H.escHtml(ent.name) + '</div></div>'
      + '<div class="sub-hero-meta">' + jobsPosted + ' active job post' + (jobsPosted === 1 ? '' : 's') + (ent.activeJobPosts < 0 ? '' : ' of ' + ent.activeJobPosts) + '</div>'
      + '</div>'
      + '<div class="sub-gplay-badge">' + H.ICONS.googlePlay + '<div class="sub-gplay-txt"><b>Play Protect Certified</b>Payments handled entirely by Google Play</div></div>'
      + '<div class="sub-section-title">Available plans</div>'
      + H.RECRUITER_PLANS.map(planCard).join('')
      + '</div></div>';
  };

  H.pages.RecruiterSubscription_after = function () {
    // Re-render ONLY when the fetched plan actually differs from what was
    // rendered — an unconditional renderPage() here re-runs this hook and
    // fetches in an endless loop. Reconcile first (re-syncs a missed
    // renewal/cancellation with Google), then refresh the profile.
    var prevPlanId = (H.state.recruiterProfile || {}).planId || 'free';
    var refresh = function () {
      if (typeof H.fetchRecruiterProfile !== 'function') return;
      H.fetchRecruiterProfile().then(function (prof) {
        var newPlanId = (prof || {}).planId || 'free';
        if (newPlanId !== prevPlanId && H.currentPageName === 'RecruiterSubscription') {
          H.renderPage('RecruiterSubscription', H.currentPageParams);
        }
      });
    };
    if (typeof H.reconcileRecruiterSubscription === 'function') {
      H.reconcileRecruiterSubscription().then(refresh).catch(refresh);
    } else {
      refresh();
    }
  };

})(window.H);
