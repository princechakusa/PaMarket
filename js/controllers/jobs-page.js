/* ============================================================
   jobs.html — real Supabase-driven jobs list + detail panel.
   Data source: listings where category='jobs' (confirmed during
   the homepage build: only 1 real job exists right now — "Full
   charge accountant", Harare CBD, $300). The page is built to look
   intentional at any volume, from 1 job to hundreds, with no
   fabricated example employers (the mockup's Zimplats/Delta/Econet/
   Baines/WFP/Paynow examples are NOT reproduced here).

   Extracted from jobs.html into this external controller (rather
   than a large inline <script>) to stay within this repo's
   architecture size policy (tools/website-build/validate-architecture.js
   flags inline <script> content over 8192 bytes; the pre-redesign
   jobs.html already carried 9069 bytes of grandfathered inline-JS
   debt, and this redesign's list+detail logic is too large to fit
   under that debt ceiling, so it lives here instead).

   Job descriptions on this site follow a loose labelled-section
   convention (see post-job.html): "COMPANY:", "JOB TYPE:",
   "INDUSTRY:", "SALARY:", "DESCRIPTION:", "RESPONSIBILITIES:",
   "REQUIREMENTS:", "HOW TO APPLY:". parseJobDescription() extracts
   those sections when present and falls back to showing the raw
   description as a single "About this role" block when a job
   doesn't follow the convention, so older/irregular postings don't
   render broken.
   ============================================================ */
(function () {
  'use strict';

  window.PMJobsNav = { toggleMobile: function (btn) {
    var n = document.getElementById('hpMobNav');
    if (!n) return;
    var open = n.classList.toggle('hidden') === false;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }};

  var FRAUD_WHATSAPP = 'https://wa.me/971589772645'; // same real number used site-wide (footer, safety.html) — no invented hotline
  var FRAUD_WHATSAPP_LABEL = '+971 58 977 2645';

  var params = new URLSearchParams(location.search);
  var state = { q: params.get('q') || '', province: params.get('province') || '', workType: '', selectedId: params.get('id') || '' };
  var jobsCache = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function timeAgo(iso) {
    var diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }
  function initials(name) { return (name || 'PM').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || 'PM'; }

  function parseJobDescription(desc) {
    desc = desc || '';
    var labels = ['COMPANY', 'JOB TYPE', 'INDUSTRY', 'SALARY', 'DESCRIPTION', 'RESPONSIBILITIES', 'REQUIREMENTS', 'HOW TO APPLY'];
    var re = new RegExp('(' + labels.join('|') + '):', 'g');
    var matches = [];
    var m;
    while ((m = re.exec(desc))) matches.push({ label: m[1], index: m.index, contentStart: m.index + m[0].length });
    if (!matches.length) return { company: '', jobType: '', industry: '', salary: '', about: desc.trim(), responsibilities: [], requirements: [], howToApply: '' };
    var out = {};
    matches.forEach(function (mm, i) {
      var end = i + 1 < matches.length ? matches[i + 1].index : desc.length;
      out[mm.label] = desc.slice(mm.contentStart, end).trim();
    });
    function bullets(text) {
      if (!text) return [];
      return text.split(/\n|(?:^|\s)[•·]\s?/).map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length > 2 && !/^(key responsibilities|responsibilities)$/i.test(s); }).slice(0, 8);
    }
    return {
      company: out.COMPANY || '',
      jobType: out['JOB TYPE'] || '',
      industry: out.INDUSTRY || '',
      salary: out.SALARY || '',
      about: (out.DESCRIPTION || '').trim(),
      responsibilities: bullets(out.RESPONSIBILITIES),
      requirements: bullets(out.REQUIREMENTS),
      howToApply: (out['HOW TO APPLY'] || '').trim()
    };
  }

  function extractEmail(text) {
    var m = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.exec(text || '');
    return m ? m[0] : '';
  }

  function jobCardHtml(job, idx) {
    var parsed = parseJobDescription(job.description);
    var company = parsed.company || job.seller_name || 'PaMarket Employer';
    var loc = [job.city, job.province].filter(Boolean).join(', ') || 'Zimbabwe';
    var type = parsed.jobType || 'Full-Time';
    var active = state.selectedId === job.id || (!state.selectedId && idx === 0);
    return '' +
      '<button type="button" onclick="PMJobs.selectJob(\'' + job.id + '\')" class="jobcard' + (active ? ' active' : '') + ' text-left w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md hover:border-primary transition-colors' + (active ? ' border-l-4 border-l-primary' : '') + '">' +
        '<div class="flex items-start gap-3">' +
          '<div class="w-11 h-11 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant font-bold shrink-0">' + esc(initials(company)) + '</div>' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex items-center justify-between gap-2">' +
              '<span class="text-label-sm font-label-sm text-primary truncate">' + esc(company) + '</span>' +
              '<span class="text-[11px] text-on-surface-variant shrink-0">' + timeAgo(job.created_at) + '</span>' +
            '</div>' +
            '<h3 class="text-body-md font-body-md font-semibold text-on-background truncate">' + esc(job.title) + '</h3>' +
            '<p class="text-body-sm font-body-sm text-on-surface-variant truncate">' + esc(loc) + ' · ' + esc(type) + (job.price ? ' · ' + esc(job.currency || 'USD') + ' ' + money(job.price) : '') + '</p>' +
          '</div>' +
        '</div>' +
      '</button>';
  }

  function detailHtml(job) {
    var parsed = parseJobDescription(job.description);
    var company = parsed.company || job.seller_name || 'PaMarket Employer';
    var loc = [job.city, job.province].filter(Boolean).join(', ') || 'Zimbabwe';
    var type = parsed.jobType || 'Full-Time';
    var email = extractEmail(parsed.howToApply) || extractEmail(job.description) || '';
    var waText = 'Hi, I would like to apply for "' + job.title + '" at ' + company + ' — I saw it on PaMarket: https://pamarketzw.com/jobs.html?id=' + job.id;
    var applyHref = email ? 'mailto:' + email + '?subject=' + encodeURIComponent('Application: ' + job.title) : ('https://wa.me/?text=' + encodeURIComponent(waText));

    var respHtml = parsed.responsibilities.length ? '<ul class="mt-2 flex flex-col gap-1.5 text-body-sm font-body-sm text-on-surface-variant list-disc pl-5">' + parsed.responsibilities.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '';
    var reqHtml = parsed.requirements.length ? '<ul class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-body-sm font-body-sm text-on-surface-variant list-disc pl-5">' + parsed.requirements.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '';
    var aboutHtml = parsed.about ? '<p class="mt-2 text-body-sm font-body-sm text-on-surface-variant whitespace-pre-line">' + esc(parsed.about) + '</p>' : '<p class="mt-2 text-body-sm font-body-sm text-on-surface-variant whitespace-pre-line">' + esc((job.description || '').slice(0, 800)) + '</p>';

    return '' +
      '<div class="h-32 bg-gradient-to-r from-primary to-primary-container relative flex items-end p-space-lg">' +
        '<div class="flex items-center gap-3">' +
          '<div class="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary font-bold text-lg shrink-0">' + esc(initials(company)) + '</div>' +
          '<div>' +
            '<span class="inline-block rounded-full bg-on-primary/15 text-on-primary text-[10px] font-bold px-2 py-1 mb-1">Ref: ' + esc(job.id.slice(0, 8).toUpperCase()) + '</span>' +
            '<h2 class="font-headline-md text-headline-sm text-on-primary">' + esc(job.title) + '</h2>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="p-space-lg">' +
        '<p class="text-body-sm font-body-sm text-on-surface-variant">' + esc(company) + ' · ' + esc(loc) + '</p>' +
        (job.price ? '<div class="mt-3 rounded-lg bg-surface-container px-space-md py-space-sm inline-block"><div class="text-price-primary font-price-primary text-on-background">' + esc(job.currency || 'USD') + ' ' + money(job.price) + '/mo</div></div>' : '') +
        '<div class="mt-space-base grid grid-cols-2 gap-space-sm">' +
          '<div class="rounded-lg border border-outline-variant p-space-sm"><div class="text-label-sm font-label-sm text-on-surface-variant">Contract Type</div><div class="text-body-sm font-body-sm font-semibold">' + esc(type) + '</div></div>' +
          '<div class="rounded-lg border border-outline-variant p-space-sm"><div class="text-label-sm font-label-sm text-on-surface-variant">Industry</div><div class="text-body-sm font-body-sm font-semibold">' + esc(parsed.industry || 'Not specified') + '</div></div>' +
          '<div class="rounded-lg border border-outline-variant p-space-sm"><div class="text-label-sm font-label-sm text-on-surface-variant">Work Location</div><div class="text-body-sm font-body-sm font-semibold">' + esc(loc) + '</div></div>' +
          '<div class="rounded-lg border border-outline-variant p-space-sm"><div class="text-label-sm font-label-sm text-on-surface-variant">Province</div><div class="text-body-sm font-body-sm font-semibold">' + esc(job.province || 'Zimbabwe') + '</div></div>' +
        '</div>' +
        '<div class="mt-space-base flex flex-wrap gap-2">' +
          '<a href="' + applyHref + '" target="_blank" rel="noopener" class="rounded-full bg-primary text-on-primary px-5 py-2.5 text-label-md font-label-md">Apply Now</a>' +
          '<button type="button" onclick="event.preventDefault()" class="rounded-full border border-outline-variant px-4 py-2.5 text-label-md font-label-md flex items-center gap-1.5"><span class="pm-material text-[18px]">favorite_border</span>Save</button>' +
          '<a href="https://wa.me/?text=' + encodeURIComponent('Check out this job on PaMarket: ' + job.title + ' at ' + company + ' — https://pamarketzw.com/jobs.html?id=' + job.id) + '" target="_blank" rel="noopener" class="rounded-full border border-outline-variant px-4 py-2.5 text-label-md font-label-md flex items-center gap-1.5"><span class="pm-material text-[18px]">share</span>Share on WhatsApp</a>' +
        '</div>' +
        '<h3 class="mt-space-lg text-headline-sm font-headline-sm text-on-background">About ' + esc(company) + '</h3>' +
        aboutHtml +
        (respHtml ? '<h3 class="mt-space-lg text-headline-sm font-headline-sm text-on-background">Primary Role Responsibilities</h3>' + respHtml : '') +
        (reqHtml ? '<h3 class="mt-space-lg text-headline-sm font-headline-sm text-on-background">Qualifications &amp; Requirements</h3>' + reqHtml : '') +
        '<div class="mt-space-lg rounded-lg bg-error-container p-space-md text-body-sm font-body-sm text-on-error-container">' +
          '<div class="font-bold mb-1 flex items-center gap-1.5"><span class="pm-material text-[18px]">warning</span>PaMarket Jobs Integrity Notice</div>' +
          '<p>Never pay a fee to apply, interview, or be placed in a job. This is always a scam. Report any request for payment on <a class="underline font-semibold" href="' + FRAUD_WHATSAPP + '" target="_blank" rel="noopener">WhatsApp: ' + FRAUD_WHATSAPP_LABEL + '</a> or via the <a class="underline font-semibold" href="safety.html">Safety Center</a>.</p>' +
        '</div>' +
        '<div class="mt-space-base flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant">' +
          '<span>Reference ID: ' + esc(job.id.slice(0, 8).toUpperCase()) + '</span>' +
          '<a href="contact.html?ref=' + esc(job.id) + '" class="text-error font-semibold">Report this listing</a>' +
        '</div>' +
      '</div>';
  }

  function renderList() {
    var list = document.getElementById('jobList');
    var summary = document.getElementById('jobListSummary');
    var filtered = jobsCache.filter(function (j) {
      if (state.workType) {
        var t = (parseJobDescription(j.description).jobType || 'Full-Time').toLowerCase();
        if (!t.indexOf) return true;
        if (state.workType === 'full-time' && t.indexOf('full') === -1) return false;
        if (state.workType === 'part-time' && t.indexOf('part') === -1) return false;
        if (state.workType === 'contract' && t.indexOf('contract') === -1) return false;
        if (state.workType === 'graduate' && t.indexOf('graduate') === -1 && t.indexOf('trainee') === -1) return false;
        if (state.workType === 'remote' && t.indexOf('remote') === -1 && t.indexOf('hybrid') === -1) return false;
      }
      return true;
    });
    summary.textContent = filtered.length + ' live vacanc' + (filtered.length === 1 ? 'y' : 'ies') + (state.province ? ' in ' + state.province : ' across Zimbabwe');
    if (!filtered.length) {
      list.innerHTML = '<div class="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg text-center text-body-sm font-body-sm text-on-surface-variant">No vacancies match these filters yet. <a class="text-primary font-semibold" href="jobs.html">Clear filters</a> or <a class="text-primary font-semibold" href="post-job.html">post the first one free</a>.</div>';
      document.getElementById('jobDetailEmpty').classList.remove('hidden');
      document.getElementById('jobDetailBody').classList.add('hidden');
      return;
    }
    list.innerHTML = filtered.map(jobCardHtml).join('');
    if (!state.selectedId || !filtered.some(function (j) { return j.id === state.selectedId; })) state.selectedId = filtered[0].id;
    renderDetail();
  }

  function renderDetail() {
    var job = jobsCache.find(function (j) { return j.id === state.selectedId; });
    var empty = document.getElementById('jobDetailEmpty'), body = document.getElementById('jobDetailBody');
    if (!job) { empty.classList.remove('hidden'); body.classList.add('hidden'); return; }
    empty.classList.add('hidden');
    body.classList.remove('hidden');
    body.innerHTML = detailHtml(job);
  }

  function renderWorkTypeRibbon() {
    var types = [['', 'All Types'], ['full-time', 'Full-Time'], ['part-time', 'Part-Time'], ['contract', 'Contract'], ['graduate', 'Graduate Trainee'], ['remote', 'Remote & Hybrid']];
    function countFor(key) {
      if (!key) return jobsCache.length;
      return jobsCache.filter(function (j) {
        var t = (parseJobDescription(j.description).jobType || 'Full-Time').toLowerCase();
        if (key === 'full-time') return t.indexOf('full') > -1;
        if (key === 'part-time') return t.indexOf('part') > -1;
        if (key === 'contract') return t.indexOf('contract') > -1;
        if (key === 'graduate') return t.indexOf('graduate') > -1 || t.indexOf('trainee') > -1;
        if (key === 'remote') return t.indexOf('remote') > -1 || t.indexOf('hybrid') > -1;
        return false;
      }).length;
    }
    var wrap = document.getElementById('workTypeRibbon');
    wrap.innerHTML = types.map(function (t) {
      var active = state.workType === t[0];
      var count = countFor(t[0]);
      return '<button type="button" onclick="PMJobs.setWorkType(\'' + t[0] + '\')" class="rounded-full border px-3 py-1.5 text-label-sm font-label-sm ' + (active ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container') + '">' + t[1] + ' (' + count + ')</button>';
    }).join('');
  }

  function loadJobs() {
    var qp = ['status=eq.active', 'expires_at=gt.' + encodeURIComponent(new Date().toISOString()), 'category=eq.jobs'];
    if (state.province) qp.push('province=ilike.*' + encodeURIComponent(state.province) + '*');
    if (state.q) qp.push('title=ilike.*' + encodeURIComponent(state.q) + '*');
    qp.push('select=*', 'order=created_at.desc', 'limit=100');
    document.getElementById('jobList').innerHTML = '<div class="text-body-sm font-body-sm text-on-surface-variant">Loading vacancies…</div>';
    window.PMServiceTransport.fetchJson('listings?' + qp.join('&')).then(function (rows) {
      jobsCache = rows || [];
      renderWorkTypeRibbon();
      renderList();
      document.getElementById('metricActiveJobs').textContent = jobsCache.length.toLocaleString();
      var employers = {};
      jobsCache.forEach(function (j) { employers[j.business_id || j.seller_id] = true; });
      document.getElementById('metricEmployers').textContent = Object.keys(employers).length.toLocaleString();
    }).catch(function () {
      document.getElementById('jobList').innerHTML = '<div class="text-body-sm font-body-sm text-on-surface-variant">Could not load vacancies right now. Please try again shortly.</div>';
    });
  }

  window.PMJobs = {
    selectJob: function (id) { state.selectedId = id; renderList(); window.scrollTo({ top: document.getElementById('jobDetailCol').offsetTop - 220, behavior: 'smooth' }); },
    setWorkType: function (t) { state.workType = t; renderWorkTypeRibbon(); renderList(); }
  };

  window.PMJobsHeaderSearch = function () {
    var prov = document.getElementById('hpProvince'), q = document.getElementById('hpQ');
    state.province = prov ? prov.value : state.province;
    state.q = q ? q.value : state.q;
    loadJobs();
  };
  window.PMJobsHeroSearch = function () {
    var prov = document.getElementById('heroProvince'), q = document.getElementById('heroQ');
    state.province = prov ? prov.value : state.province;
    state.q = q ? q.value : state.q;
    loadJobs();
  };

  function loadTrustStats() {
    window.PMServiceTransport.exactCount('businesses?status=eq.active').then(function (n) {
      document.getElementById('trustVerifiedBusinesses').textContent = n.toLocaleString();
    }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('hpQ').value = state.q;
    document.getElementById('heroQ').value = state.q;
    loadJobs();
    loadTrustStats();
  });
})();
