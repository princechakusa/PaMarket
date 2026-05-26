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
    var salary   = parseLine(lines, 'SALARY') || '';
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
      + (canWa ? '<a href="' + H.escHtml(waUrl) + '" target="_blank" style="flex:1;padding:13px;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp</a>' : '')
      + (canCall ? '<a href="tel:+' + H.escHtml(callNum) + '" style="flex:1;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call</a>' : '')
      + '<button onclick="H.startChatWith(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:13px;' + (canWa || canCall ? 'background:var(--bg);color:#1A3A8F;border:1.5px solid #1A3A8F;' : 'background:#1A3A8F;color:#fff;border:none;') + 'border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Message</button>'
      + '<button onclick="H._cvDownload(\'' + H.escHtml(u.id) + '\')" style="flex:1;padding:13px;background:linear-gradient(135deg,#1A3A8F,#2952c8);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CV</button>'
      + '</div></div>';
  };

  H._cvDownload = function (userId) {
    var u = (H.state.users || []).find(function (x) { return x.id === userId; });
    if (!u) return;
    var cv    = u.cv || {};
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

  function _emptyTalent() {
    return '<div style="text-align:center;padding:40px 20px">'
      + '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>'
      + '<div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">No candidates yet</div>'
      + '<div style="font-size:13px;color:var(--sub);margin-bottom:20px">Job seekers who mark themselves open to work will appear here.</div>'
      + '<button onclick="H.toast(\'Share PaMarket with job seekers!\')" style="padding:12px 24px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Invite Job Seekers</button>'
      + '</div>';
  }

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
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Salary Range (USD)</label>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input id="jSalMin" type="number" placeholder="Min" style="padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box"><input id="jSalMax" type="number" placeholder="Max" style="padding:13px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box"></div></div>'
      + _textarea('jDesc', 'Job Description *', 'Describe the role, responsibilities, company culture…', 6)
      + _textarea('jReqs', 'Requirements & Qualifications', 'List qualifications, experience, skills required…', 4)
      + _textarea('jResp', 'Key Responsibilities', 'List the main duties and responsibilities…', 4)
      + _field('jEmail', 'Application Email', 'email', 'Email to receive applications', H.escHtml(u.email || ''))
      + _field('jPhone', 'WhatsApp Number', 'tel', 'e.g. +263771234567', H.escHtml(u.phone || ''))
      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button onclick="H._submitJob()" style="width:100%;padding:15px;background:linear-gradient(135deg,#1A3A8F,#0f2460);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer">Post Job Now →</button>'
      + '</div></div>';
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
    var salMin = (document.getElementById('jSalMin') || {}).value || '';
    var salMax = (document.getElementById('jSalMax') || {}).value || '';
    var salary = salMin && salMax ? '$' + salMin + ' - $' + salMax : salMin ? 'From $' + salMin : 'Negotiable';
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
      price: salMin ? +salMin : 0, currency: 'USD', city: location, prov: prov || location,
      sellerId: u.id, sellerName: anon ? company : (u.name || company),
      sellerPhone: u.phone || '', company: company,
      createdAt: Date.now(), status: 'active', photos: []
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
    if (!sel) return;
    var cities = (H.CITIES_BY_PROV[prov] || []);
    sel.innerHTML = '<option value="">Select city / town…</option>'
      + cities.map(function (c) { return '<option>' + H.escHtml(c) + '</option>'; }).join('')
      + '<option>Remote</option><option>Multiple Locations</option>';
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
    var company = l.company || l.sellerName || 'Company';
    H.modal({
      title: 'Apply: ' + l.title,
      body: '<div style="margin-bottom:10px;font-size:13px;color:var(--sub)">at <strong>' + H.escHtml(company) + '</strong> · ' + H.escHtml(l.city || 'Zimbabwe') + '</div>'
        + '<textarea id="applyMsg" rows="4" placeholder="Introduce yourself — your experience, why you\'re a great fit, and any relevant skills…" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-size:13px;background:var(--card);color:var(--text);outline:none;box-sizing:border-box;resize:vertical;font-family:Inter,sans-serif"></textarea>'
        + '<div style="font-size:11px;color:var(--sub);margin-top:6px">Your name and application message will be reviewed by the employer. They can message you through PaMarket.</div>',
      confirmText: 'Submit Application',
      onConfirm: function() {
        var msg = (document.getElementById('applyMsg') || {}).value || '';
        H._submitJobApplication(jobId, msg);
      }
    });
  };

  H._submitJobApplication = function (jobId, message) {
    var u = H.currentUser(); if (!u) return;
    var l = (H.state.listings || []).find(function(x){ return x.id === jobId; }); if (!l) return;
    var company = l.company || l.sellerName || 'Company';
    H.state.applications = H.state.applications || [];
    var existing = H.state.applications.find(function(a){ return a.jobId === jobId && a.applicantId === u.id; });
    if (existing) { H.toast('You already applied for this job'); return; }
    var app = {
      id: H.uid(), jobId: jobId, jobTitle: l.title, company: company,
      applicantId: u.id, applicantName: u.name || 'Applicant',
      message: message, status: 'pending', appliedAt: Date.now(),
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
    H.renderPage('JobDetail', {id: jobId});
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
            + (app.message ? '<div style="font-size:13px;color:var(--text);line-height:1.6;padding:10px 12px;background:var(--bg);border-radius:10px;margin-bottom:12px">' + H.escHtml(app.message.slice(0,200)) + (app.message.length>200?'…':'') + '</div>' : '')
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

  function _cpRenderResumeZone(fileName) {
    if (fileName) {
      return '<div style="display:flex;align-items:center;gap:8px;background:#22c55e18;border-radius:10px;padding:10px 12px;border:1.5px solid #22c55e40">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#15803d" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
        + '<span style="flex:1;font-size:13px;font-weight:600;color:#15803d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + H.escHtml(fileName) + '</span>'
        + '<button onclick="H._cpClearResume()" style="background:none;border:none;color:#15803d;font-size:16px;cursor:pointer;padding:0;font-family:inherit">×</button>'
        + '</div>';
    }
    return '<label for="cpResumeFile" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--border);border-radius:10px;padding:20px;cursor:pointer;text-align:center">'
      + '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      + '<span style="font-size:13px;font-weight:600;color:var(--sub)">Tap to upload Resume / CV</span>'
      + '<span style="font-size:11px;color:var(--sub2)">PDF, DOC, DOCX · Max 3 MB</span>'
      + '</label>';
  }

  H.pages.CandidateProfile = function () {
    var u = H.currentUser();
    if (!u) return '<div class="page active">' + H.innerTopbar('Job Seeker Profile') + H.emptyState('Sign in required', 'Sign in to set up your job seeker profile', 'Sign In', "H.requireAuth('Job seeker profile')") + '</div>';
    var ZW = H._ZW_CITIES || [];
    var expLevels = [['entry','Entry Level (0-2 yrs)'],['mid','3-5 Years'],['senior','5-10 Years'],['expert','10+ Years']];
    var on = u.openToWork ? '1' : '0';
    var togBg = u.openToWork ? '#22c55e' : 'var(--border)';
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

      // ── Section 2: Basic Details ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>', 'Basic Details')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Current / Desired Job Title</label>'
      + '<input id="cpTitle" placeholder="e.g. Accountant, Driver, Teacher" value="' + H.escHtml(u.jobTitle || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Industry / Sector</label>'
      + '<select id="cpSector" style="' + inStyle + '"><option value="">Select sector…</option>'
      + JOB_CATS.map(function (c) { return '<option value="' + H.escHtml(c) + '"' + (u.sector === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Experience Level</label>'
      + '<select id="cpExp" style="' + inStyle + '"><option value="">Select level…</option>'
      + expLevels.map(function (e) { return '<option value="' + e[0] + '"' + (u.exp === e[0] ? ' selected' : '') + '>' + H.escHtml(e[1]) + '</option>'; }).join('')
      + '</select></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">City</label>'
      + '<select id="cpCity" style="' + inStyle + '"><option value="">Select city…</option>'
      + ZW.map(function (c) { return '<option value="' + H.escHtml(c) + '"' + (u.city === c ? ' selected' : '') + '>' + H.escHtml(c) + '</option>'; }).join('')
      + '<option value="Remote"' + (u.city === 'Remote' ? ' selected' : '') + '>Remote / Any</option>'
      + '</select></div>'

      // ── Section 3: Professional Background ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>', 'Professional Background')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Bio / About Me</label>'
      + '<textarea id="cpBio" maxlength="300" placeholder="Tell employers a bit about yourself, your strengths and what you\'re looking for…" style="' + inStyle + 'height:90px;resize:vertical">' + H.escHtml(u.bio || '') + '</textarea>'
      + '<div style="text-align:right;font-size:11px;color:var(--sub);margin-top:3px"><span id="cpBioCount">' + (u.bio || '').length + '</span>/300</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Skills</label>'
      + '<div id="cpSkillsChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + _cpRenderSkillChips(existingSkills) + '</div>'
      + '<input id="cpSkillsInput" placeholder="Type a skill and press comma or Enter…" style="' + inStyle + '">'
      + '<input type="hidden" id="cpSkillsVal" value="' + H.escHtml(existingSkills.join(',')) + '">'
      + '</div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Expected Salary / Rate <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpSalary" placeholder="e.g. $500/mo, $20/hr or Negotiable" value="' + H.escHtml(u.expectedSalary || '') + '" style="' + inStyle + '"></div>'

      // ── Section 4: Job Preferences ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>', 'Job Preferences')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Job Type / Availability</label>'
      + '<div id="cpJobTypeWrap" style="display:flex;flex-wrap:wrap;gap:8px">'
      + jobTypesList.map(function(t) {
          var sel = selectedJobTypes.indexOf(t) !== -1;
          return '<button onclick="H._cpToggleJobType(this)" data-jt="' + H.escHtml(t) + '" style="padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid ' + (sel ? '#1A3A8F' : 'var(--border)') + ';background:' + (sel ? '#1A3A8F' : 'var(--card)') + ';color:' + (sel ? '#fff' : 'var(--sub)') + ';font-family:inherit">' + H.escHtml(t) + '</button>';
        }).join('')
      + '</div></div>'

      // ── Section 5: Contact & Reach ──
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
      + '<input type="checkbox" id="cpSamePhone"' + (samePhone ? ' checked' : '') + ' onchange="H._cpToggleSamePhone(this)" style="width:16px;height:16px;cursor:pointer">'
      + '<label for="cpSamePhone" style="font-size:13px;font-weight:600;color:var(--text);cursor:pointer">Same number for calls as WhatsApp</label>'
      + '</div>'
      + '<div id="cpPhoneRow" style="margin-bottom:14px;' + (samePhone ? 'display:none' : '') + '"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Phone for Calls</label>'
      + '<input id="cpPhone" type="tel" placeholder="e.g. 0712 345 678" value="' + H.escHtml(samePhone ? '' : phoneForCalls) + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">Preferred Contact Method</label>'
      + '<div id="cpContactMethodWrap" style="display:flex;gap:8px">'
      + [['<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WhatsApp','whatsapp'],['<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 2.1.74 3.26a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c1.16.38 2.3.61 3.26.74A2 2 0 0122 16.92z"/></svg> Call','call'],['<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Both','both']].map(function(cm){
          var sel = contactMethod === cm[1];
          return '<button onclick="H._cpSetContact(this)" data-cm="' + cm[1] + '" style="flex:1;padding:10px 6px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid ' + (sel ? '#1A3A8F' : 'var(--border)') + ';background:' + (sel ? '#1A3A8F' : 'var(--card)') + ';color:' + (sel ? '#fff' : 'var(--sub)') + ';font-family:inherit">' + cm[0] + '</button>';
        }).join('')
      + '</div></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Best Time to Contact</label>'
      + '<select id="cpAvail" style="' + inStyle + '">'
      + ['Anytime','Morning (8am–12pm)','Afternoon (12pm–5pm)','Evening (5pm–8pm)'].map(function(t){ return '<option value="' + H.escHtml(t) + '"' + ((u.contactAvail || 'Anytime') === t ? ' selected' : '') + '>' + H.escHtml(t) + '</option>'; }).join('')
      + '</select></div>'

      // ── Section 6: Professional Links ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>', 'Professional Links')
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">LinkedIn <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpLinkedin" type="url" placeholder="linkedin.com/in/your-name" value="' + H.escHtml(u.linkedinUrl || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">GitHub <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpGithub" type="url" placeholder="github.com/username" value="' + H.escHtml(u.githubUrl || '') + '" style="' + inStyle + '"></div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Portfolio / Website <span style="font-weight:400;text-transform:none">(optional)</span></label>'
      + '<input id="cpWebsite" type="url" placeholder="yourportfolio.com" value="' + H.escHtml(u.websiteUrl || '') + '" style="' + inStyle + '"></div>'

      // ── Section 7: Resume / CV ──
      + _cpSectionHead('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', 'Resume / CV')
      + '<div id="cpResumeZone" style="margin-bottom:20px">' + _cpRenderResumeZone(cvFileName) + '</div>'
      + '<input type="file" id="cpResumeFile" accept=".pdf,.doc,.docx" style="display:none">'

      + '</div>'
      + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);z-index:200">'
      + '<button id="cpSaveBtn" onclick="H._saveCandidateProfile()" style="width:100%;padding:15px;background:linear-gradient(135deg,#22c55e,#15803d);color:#fff;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">Save Profile</button>'
      + '</div></div>';
  };

  H.pages.CandidateProfile_after = function () {
    // Bio character counter
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
          var val = this.value.replace(/,/g, '').trim();
          if (val && H._cpSkillsArr.indexOf(val) === -1) {
            H._cpSkillsArr.push(val);
            _cpSyncSkills();
          }
          this.value = '';
        }
      });
      skillInput.addEventListener('blur', function() {
        var parts = this.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        parts.forEach(function(p) {
          if (p && H._cpSkillsArr.indexOf(p) === -1) H._cpSkillsArr.push(p);
        });
        if (parts.length) { _cpSyncSkills(); skillInput.value = ''; }
      });
    }

    // Job type toggle
    H._cpToggleJobType = function(btn) {
      var sel = btn.style.background === '#1A3A8F' || btn.style.backgroundColor === 'rgb(26, 58, 143)';
      if (sel) {
        btn.style.background = 'var(--card)';
        btn.style.color = 'var(--sub)';
        btn.style.borderColor = 'var(--border)';
      } else {
        btn.style.background = '#1A3A8F';
        btn.style.color = '#fff';
        btn.style.borderColor = '#1A3A8F';
      }
    };

    // Contact method segment
    H._cpSetContact = function(btn) {
      var wrap = document.getElementById('cpContactMethodWrap');
      if (!wrap) return;
      [].forEach.call(wrap.querySelectorAll('button'), function(b) {
        b.style.background = 'var(--card)';
        b.style.color = 'var(--sub)';
        b.style.borderColor = 'var(--border)';
      });
      btn.style.background = '#1A3A8F';
      btn.style.color = '#fff';
      btn.style.borderColor = '#1A3A8F';
    };

    // Same-as-WhatsApp checkbox
    H._cpToggleSamePhone = function(el) {
      var row = document.getElementById('cpPhoneRow');
      if (row) row.style.display = el.checked ? 'none' : '';
    };

    // Resume upload
    H._cpResumeData = H._cpResumeData || null;
    H._cpResumeFileName = H._cpResumeFileName || null;

    var fileInput = document.getElementById('cpResumeFile');
    if (fileInput) {
      fileInput.addEventListener('change', function() {
        var file = this.files && this.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { H.toast('File too large — max 3 MB'); this.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function(ev) {
          H._cpResumeData = ev.target.result;
          H._cpResumeFileName = file.name;
          var zone = document.getElementById('cpResumeZone');
          if (zone) zone.innerHTML = _cpRenderResumeZone(file.name);
        };
        reader.readAsDataURL(file);
      });
    }

    H._cpClearResume = function() {
      H._cpResumeData = null;
      H._cpResumeFileName = null;
      var fileInput2 = document.getElementById('cpResumeFile');
      if (fileInput2) fileInput2.value = '';
      var zone = document.getElementById('cpResumeZone');
      if (zone) zone.innerHTML = _cpRenderResumeZone('');
    };
  };

  H._saveCandidateProfile = function () {
    var u = H.currentUser(); if (!u) return;
    var btn = document.getElementById('cpSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    u.openToWork = !!(document.getElementById('otwTog') && document.getElementById('otwTog').dataset.on === '1');
    u.jobTitle   = ((document.getElementById('cpTitle')   || {}).value || '').trim();
    u.sector     = (document.getElementById('cpSector')   || {}).value || '';
    u.exp        = (document.getElementById('cpExp')      || {}).value || '';
    u.city       = (document.getElementById('cpCity')     || {}).value || '';
    u.bio        = ((document.getElementById('cpBio')     || {}).value || '').trim();
    u.expectedSalary = ((document.getElementById('cpSalary') || {}).value || '').trim();

    // Skills from chip array
    u.skills = (H._cpSkillsArr || []).join(',');

    // Job types from selected buttons
    var jtWrap = document.getElementById('cpJobTypeWrap');
    var jtArr = [];
    if (jtWrap) {
      [].forEach.call(jtWrap.querySelectorAll('button'), function(b) {
        if (b.style.background === '#1A3A8F' || b.style.backgroundColor === 'rgb(26, 58, 143)') jtArr.push(b.dataset.jt);
      });
    }
    u.jobTypes = jtArr.join(',');

    // WhatsApp & phone
    var waCC  = (document.getElementById('cpWaCC')  || {}).value || '263';
    var waNum = ((document.getElementById('cpWaNum') || {}).value || '').trim();
    var samePhone = !!(document.getElementById('cpSamePhone') && document.getElementById('cpSamePhone').checked);
    var phoneForCalls = samePhone ? waNum : ((document.getElementById('cpPhone') || {}).value || '').trim();
    u.whatsappCC  = waCC;
    u.whatsappNum = waNum;
    u.samePhone   = samePhone;
    u.phoneForCalls = phoneForCalls;
    u.whatsappFull  = waCC + waNum.replace(/^0/, '').replace(/\s/g, '');

    // Contact method
    var cmWrap = document.getElementById('cpContactMethodWrap');
    var contactMethod = '';
    if (cmWrap) {
      var cmSel = cmWrap.querySelector('button[style*="background: #1A3A8F"], button[style*="background:#1A3A8F"]');
      if (!cmSel) {
        [].forEach.call(cmWrap.querySelectorAll('button'), function(b) {
          if (b.style.backgroundColor === 'rgb(26, 58, 143)') cmSel = b;
        });
      }
      if (cmSel) contactMethod = cmSel.dataset.cm || '';
    }
    u.contactMethod = contactMethod;
    u.contactAvail  = (document.getElementById('cpAvail') || {}).value || 'Anytime';

    // Professional links
    u.linkedinUrl = ((document.getElementById('cpLinkedin') || {}).value || '').trim();
    u.githubUrl   = ((document.getElementById('cpGithub')  || {}).value || '').trim();
    u.websiteUrl  = ((document.getElementById('cpWebsite') || {}).value || '').trim();

    // Resume
    if (H._cpResumeFileName) {
      u.cvFileName = H._cpResumeFileName;
      u.cvFileData = H._cpResumeData;
    }

    // Bridge flat fields into u.cv so ViewCandidateCV shows real data
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
      certifications: prevCv.certifications || []
    };

    H.saveState();

    var _sb = window.supabase;
    if (_sb && typeof _sb.from === 'function') {
      var upsertData = {
        id: u.id,
        open_to_work: u.openToWork,
        job_title: u.jobTitle || null,
        skills: u.skills || null,
        sector: u.sector || null,
        exp: u.exp || null,
        city: u.city || null
      };
      try {
        upsertData.bio                 = u.bio                 || null;
        upsertData.job_types           = u.jobTypes            || null;
        upsertData.expected_salary     = u.expectedSalary      || null;
        upsertData.whatsapp_number     = u.whatsappFull        || null;
        upsertData.phone_for_calls     = u.phoneForCalls       || null;
        upsertData.contact_method      = u.contactMethod       || null;
        upsertData.contact_availability = u.contactAvail       || null;
        upsertData.linkedin_url        = u.linkedinUrl         || null;
        upsertData.github_url          = u.githubUrl           || null;
        upsertData.website_url         = u.websiteUrl          || null;
        upsertData.cv_file_name        = u.cvFileName          || null;
        upsertData.cv                  = u.cv                  || null;
      } catch(e) { /* columns may not exist yet */ }
      _sb.from('profiles').upsert(upsertData).then(function (res) {
        if (res && res.error) console.warn('Candidate profile sync:', res.error.message);
      });
    }

    H.toast(u.openToWork ? 'Profile saved — employers can now find you!' : 'Profile saved — you are hidden from employer searches');
    H.goBack();
  };

  H.pages.JobSeekerProfile = H.pages.CandidateProfile;

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
