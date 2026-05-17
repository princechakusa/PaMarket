'use strict';
(function (H) {

  // Generic category page factory used for 7 of the 8 product categories
  function makeCatPage(catId, displayName) {
    H.pages[displayName] = function () {
      const listings = (H.state.listings || [])
        .filter(l => l.status === 'active' && l.cat === catId)
        .sort((a, b) => {
          const ba = (a.boost && a.boost.until > Date.now()) ? 1 : 0;
          const bb = (b.boost && b.boost.until > Date.now()) ? 1 : 0;
          if (ba !== bb) return bb - ba;
          return b.createdAt - a.createdAt;
        });

      return `<div class="page active">
        <div class="det-topbar">
          <button class="back" onclick="H.goBack()">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="det-topbar-title">${H.escHtml(displayName)}</div>
          <button onclick="H.navTo('Post')" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px;white-space:nowrap">+ Post</button>
        </div>
        <div style="background:#1A3A8F;padding:0 12px 12px">
          <div style="background:rgba(255,255,255,.13);border-radius:12px;display:flex;align-items:center;padding:0 12px;gap:8px">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="catSearch" placeholder="Search in ${H.escHtml(displayName)}…" autocomplete="off"
              oninput="H._catSearch(this.value,'${catId}')"
              style="flex:1;border:none;outline:none;padding:12px 0;font-size:14px;background:transparent;color:#fff;font-family:Inter,sans-serif;caret-color:#F5A623"
              >
          </div>
          <div style="color:rgba(255,255,255,.65);font-size:12px;font-weight:600;margin-top:8px;padding:0 2px">
            ${listings.length} listing${listings.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div id="catList" style="padding-bottom:88px">
          ${listings.length
            ? '<div class="listing-list">' + listings.map(H.renderListCard).join('') + '</div>'
            : H.emptyState('No ' + H.escHtml(displayName) + ' listings yet', 'Be the first to post in this category!', 'Post an Ad', "H.navTo('Post')")}
        </div>
      </div>`;
    };
  }

  makeCatPage('property',    'Property');
  makeCatPage('vehicles',    'Vehicles');
  makeCatPage('rooms',       'Rooms');
  makeCatPage('electronics', 'Electronics');
  makeCatPage('furniture',   'Furniture');
  makeCatPage('fashion',     'Fashion');
  makeCatPage('services',    'Services');

  // In-page search helper (called from oninput)
  H._catSearch = function (q, catId) {
    const el = document.getElementById('catList');
    if (!el) return;
    const all = (H.state.listings || []).filter(l => l.status === 'active' && l.cat === catId);
    const filtered = q.trim()
      ? all.filter(l =>
          (l.title + ' ' + (l.desc || '') + ' ' + (l.city || '') + ' ' + (l.suburb || ''))
            .toLowerCase().includes(q.toLowerCase())
        )
      : all;
    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    el.innerHTML = sorted.length
      ? '<div class="listing-list">' + sorted.map(H.renderListCard).join('') + '</div>'
      : H.emptyState('No matches', 'Try different keywords', null, null);
  };

  // ── Jobs Board ────────────────────────────────────────────
  H.pages.Jobs = function () {
    if (typeof H.fetchListingsFromSupabase === 'function') {
      H.fetchListingsFromSupabase().catch(() => {});
    }
    const jobs = (H.state.listings || [])
      .filter(l => l.status === 'active' && l.cat === 'jobs')
      .sort((a, b) => b.createdAt - a.createdAt);

    return `<div class="page active">
      <div class="det-topbar" style="background:#F5A623">
        <button class="back" onclick="H.goBack()" style="color:#1A3A8F">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="det-topbar-title" style="color:#1A3A8F">Jobs Board</div>
        <button onclick="H.openInner('PostJob')" style="background:#1A3A8F;border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:8px">+ Post Job</button>
      </div>
      <div style="background:#F5A623;padding:8px 16px 12px">
        <div style="color:#1A3A8F;font-size:12px;font-weight:700">${jobs.length} opening${jobs.length !== 1 ? 's' : ''} across Zimbabwe</div>
      </div>
      <div style="padding:12px 12px 88px">
        ${jobs.length
          ? jobs.map(l => _renderJobCard(l)).join('')
          : H.emptyState('No jobs posted yet', 'Be the first to post a job opening!', 'Post a Job', "H.openInner('PostJob')")}
      </div>
    </div>`;
  };

  function _renderJobCard(l) {
    const lines    = (l.desc || '').split('\n');
    const company  = l.sellerName || _parseLine(lines, 'COMPANY') || 'Company';
    const jobType  = _parseLine(lines, 'JOB TYPE') || '';
    const salary   = _parseLine(lines, 'SALARY') || '';
    const industry = _parseLine(lines, 'INDUSTRY') || '';
    return `<div onclick="H.openListing('${l.id}')"
      style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border);cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:#F5A62320;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#c07800" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H.escHtml(l.title)}</div>
          <div style="font-size:13px;color:var(--sub);margin-bottom:8px">${H.escHtml(company)}${industry ? ' · ' + H.escHtml(industry) : ''}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${jobType  ? `<span style="background:#1A3A8F18;color:#1A3A8F;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px">${H.escHtml(jobType)}</span>` : ''}
            ${salary   ? `<span style="background:#F5A62318;color:#c07800;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px">${H.escHtml(salary)}</span>` : ''}
            <span style="background:var(--bg);color:var(--sub);font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px">${H.escHtml(l.city || l.prov || 'Zimbabwe')}</span>
            <span style="color:var(--sub2);font-size:11px;padding:3px 0">${H.timeAgo(l.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  function _parseLine(lines, key) {
    const found = lines.find(ln => ln.startsWith(key + ':'));
    return found ? found.slice(key.length + 1).trim() : '';
  }

  // ── Job Detail ────────────────────────────────────────────
  H.pages.JobDetail = function ({ id }) {
    const l = (H.state.listings || []).find(x => x.id === id);
    if (!l) return `<div class="page active">${H.innerTopbar('Job')}${H.emptyState('Job not found', 'This posting may have been removed.', 'Browse Jobs', "H.filterByCat('jobs')")}</div>`;

    const lines    = (l.desc || '').split('\n');
    const company  = l.sellerName || _parseLine(lines, 'COMPANY') || 'Company';
    const jobType  = _parseLine(lines, 'JOB TYPE') || '';
    const industry = _parseLine(lines, 'INDUSTRY') || '';
    const salary   = _parseLine(lines, 'SALARY') || 'Not disclosed';
    const deadline = _parseLine(lines, 'DEADLINE') || '';

    const descStart  = l.desc.indexOf('\nDESCRIPTION:\n');
    const reqStart   = l.desc.indexOf('\nREQUIREMENTS:\n');
    const applyStart = l.desc.indexOf('\nHOW TO APPLY:');
    const description  = descStart  > -1 ? l.desc.slice(descStart  + 14, reqStart   > -1 ? reqStart   : applyStart > -1 ? applyStart : undefined).trim() : '';
    const requirements = reqStart   > -1 ? l.desc.slice(reqStart   + 15, applyStart > -1 ? applyStart : undefined).trim() : '';
    const applySection = applyStart > -1 ? l.desc.slice(applyStart + 14).trim() : '';

    const emailMatch = applySection.match(/Email:\s*(.+)/);
    const phoneMatch = applySection.match(/WhatsApp:\s*(.+)/);
    const applyEmail = emailMatch ? emailMatch[1].trim() : '';
    const applyPhone = phoneMatch ? phoneMatch[1].trim().replace(/[^\d+]/g, '') : '';

    return `<div class="page active">
      <div class="det-topbar" style="background:#F5A623">
        <button class="back" onclick="H.goBack()" style="color:#1A3A8F">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="det-topbar-title" style="color:#1A3A8F;font-size:14px">${H.escHtml(l.title)}</div>
      </div>

      <div style="background:#F5A623;padding:16px;padding-top:4px">
        <div style="background:rgba(255,255,255,.9);border-radius:14px;padding:16px">
          <div style="font-size:18px;font-weight:800;color:#1A3A8F;margin-bottom:4px">${H.escHtml(l.title)}</div>
          <div style="font-size:14px;color:#333;font-weight:600;margin-bottom:10px">${H.escHtml(company)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${jobType  ? `<span style="background:#1A3A8F;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:8px">${H.escHtml(jobType)}</span>` : ''}
            ${industry ? `<span style="background:#F5A62330;color:#c07800;font-size:12px;font-weight:700;padding:4px 10px;border-radius:8px">${H.escHtml(industry)}</span>` : ''}
          </div>
        </div>
      </div>

      <div style="padding:12px 12px 120px">
        <div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:10px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Salary</div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${H.escHtml(salary)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Location</div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${H.escHtml(l.city || l.prov || 'Zimbabwe')}</div>
            </div>
            ${deadline ? `<div>
              <div style="font-size:10px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Deadline</div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${H.escHtml(deadline)}</div>
            </div>` : ''}
            <div>
              <div style="font-size:10px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Posted</div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${H.timeAgo(l.createdAt)}</div>
            </div>
          </div>
        </div>

        ${description ? `<div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">Job Description</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.75;white-space:pre-line">${H.escHtml(description)}</div>
        </div>` : ''}

        ${requirements ? `<div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">Requirements</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.75;white-space:pre-line">${H.escHtml(requirements)}</div>
        </div>` : ''}
      </div>

      <!-- Sticky apply bar -->
      <div style="position:fixed;bottom:0;left:0;right:0;background:var(--card);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--border);display:flex;gap:8px;z-index:200">
        ${applyEmail
          ? `<a href="mailto:${H.escHtml(applyEmail)}?subject=${encodeURIComponent('Application: ' + l.title)}"
              style="flex:1;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Apply by Email</a>`
          : ''}
        ${applyPhone
          ? `<button onclick="window.open('https://wa.me/${H.escHtml(applyPhone)}?text=${encodeURIComponent('Hi, I am interested in the ' + l.title + ' position at ' + company)}','_blank')"
              style="flex:1;padding:13px;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Apply via WhatsApp</button>`
          : ''}
        ${!applyEmail && !applyPhone
          ? `<button onclick="H.toast('Contact info not available for this job')"
              style="flex:1;padding:13px;background:#1A3A8F;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Apply Now</button>`
          : ''}
      </div>
    </div>`;
  };

})(window.H);
