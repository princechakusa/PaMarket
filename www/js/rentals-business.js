/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE — VEHICLE RENTALS BUSINESS PORTAL
 * Pages: RentalDashboard, RentalManageFleet, RentalAddVehicle, RentalEditVehicle,
 *        RentalAvailability, RentalBusinessAnalytics, RentalCompanySetup
 */
'use strict';
(function (H) {
  const esc   = (s) => H.escHtml(s);
  const toast = (...a) => H.toast(...a);
  const fmt   = (n) => Number(n || 0).toLocaleString();

  H._rentalBiz = H._rentalBiz || {};
  const RB = H._rentalBiz;
  RB.company    = RB.company   || null;
  RB.fleet      = RB.fleet     || [];
  RB.leads      = RB.leads     || [];
  RB._loading   = false;
  RB._wizState  = null;
  RB._fleetTab  = RB._fleetTab || 'all';
  RB._access          = null;   // result of get_user_rental_access()
  RB._loadingAccess   = false;  // true while loadAccess() RPC is in flight
  RB._loadingCompany  = false;  // true while loadCompanyData() is in flight

  const WIZARD_STEPS = ['Basic Info', 'Pricing', 'Description', 'Review'];

  // ── Step progress bar ─────────────────────────────────────────────────────
  function _stepBar(current) {
    let html = '<div style="display:flex;align-items:center;padding:12px 16px;background:#fff;border-bottom:1px solid #E4E4E7;flex-shrink:0">';
    WIZARD_STEPS.forEach((s, i) => {
      const done   = i < current;
      const active = i === current;
      if (done) {
        html += `<div style="width:28px;height:28px;border-radius:50%;background:#12B76A;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>`;
      } else {
        html += `<div style="width:28px;height:28px;border-radius:50%;background:${active ? '#1A3A8F' : '#E4E4E7'};color:${active ? '#fff' : '#A1A1AA'};font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>`;
      }
      if (i < WIZARD_STEPS.length - 1) {
        html += `<div style="flex:1;height:2px;background:${done ? '#12B76A' : '#E4E4E7'}"></div>`;
      }
    });
    html += '</div>';
    return html;
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function _field(id, label, inner) {
    return `<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:#52525B;margin-bottom:6px;letter-spacing:.02em">${label}</div>${inner}</div>`;
  }

  function _textField(id, label, placeholder, type, val) {
    return _field(id, label, `<input id="${id}" type="${type || 'text'}" placeholder="${esc(placeholder || '')}" value="${esc(val || '')}" autocomplete="off" style="width:100%;height:46px;border:1.5px solid #E4E4E7;border-radius:14px;padding:0 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;box-sizing:border-box">`);
  }

  function _selectField(id, label, opts, val) {
    const options = opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return _field(id, label, `<select id="${id}" style="width:100%;height:46px;border:1.5px solid #E4E4E7;border-radius:14px;padding:0 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 14px center;padding-right:40px">${options}</select>`);
  }

  function _priceField(id, label, val) {
    return _field(id, label, `<div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;font-weight:700;color:#52525B">$</span><input id="${id}" type="number" min="0" step="1" value="${val || ''}" placeholder="0.00" style="width:100%;height:46px;border:1.5px solid #E4E4E7;border-radius:14px;padding:0 14px 0 28px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;box-sizing:border-box"></div>`);
  }

  function _rowWrap(...fields) {
    return `<div style="display:flex;gap:10px">${fields.map(f => `<div style="flex:1;min-width:0">${f}</div>`).join('')}</div>`;
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  function _requireBiz() {
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to manage your rental business'); return null; }
    const owned = (H.state.businesses || []).filter(b => b.ownerUserId === u.id);
    // A user can own several businesses; the rental company hangs off ONE of
    // them. Prefer the one the access RPC / loaded company identified.
    const rentalBizId = (RB._access && RB._access.business_id) || (RB.company && RB.company.business_id);
    return owned.find(b => b.id === rentalBizId) || owned[0] || null;
  }

  // ── Status pill ───────────────────────────────────────────────────────────
  function _statusPill(s) {
    const m = {
      active:   ['#12B76A', '#ECFDF5', 'Active'],
      paused:   ['#92400E', '#FEF3C7', 'Paused'],
      draft:    ['#A1A1AA', '#F4F4F5', 'Draft'],
      archived: ['#A1A1AA', '#F4F4F5', 'Archived'],
    };
    const c = m[s] || m.draft;
    return `<span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;color:${c[0]};background:${c[1]}">${c[2]}</span>`;
  }

  const _div = `<div style="height:8px;background:#F4F4F5;flex-shrink:0"></div>`;

  // ─────────────────────────────────────────────────────────────────────────
  // ACCESS CONTROL
  // Calls get_user_rental_access() RPC — the single source of truth.
  // Result is cached in RB._access and refreshed on every dashboard load.
  // ─────────────────────────────────────────────────────────────────────────

  // Build an access object from a rental_companies status value.
  // Used as fallback when the get_user_rental_access RPC is unavailable
  // (migration not yet run) so pages never hang on the loading skeleton.
  function _accessFromStatus(companyId, status) {
    return {
      has_business:         true,
      has_rental_company:   true,
      company_id:           companyId,
      company_status:       status,
      can_access_dashboard: status === 'active' || status === 'pending',
      can_create_fleet:     status === 'active',
      can_create_vehicle:   status === 'active',
    };
  }

  RB.loadAccess = async function () {
    if (RB._loadingAccess) return RB._access;
    RB._loadingAccess = true;
    const sb = window.supabase;
    if (!sb) { RB._loadingAccess = false; return null; }
    try {
      const { data, error } = await sb.rpc('get_user_rental_access');
      if (error) throw error;
      RB._access = data || null;
    } catch (e) {
      console.warn('rental access check:', e);
      // RPC missing or failed: derive access from company data so the
      // dashboard never hangs on the skeleton. RLS still enforces server-side.
      if (RB.company) {
        RB._access = _accessFromStatus(RB.company.id, RB.company.status);
      } else {
        RB._access = null;
      }
    }
    // Re-render current page. Flag stays true during renderPage so _after
    // sees it and skips re-entry. Flag clears AFTER renderPage returns.
    const page = H.currentPageName;
    const biz  = _requireBiz();
    if (biz) {
      if (page === 'RentalDashboard')        H.renderPage('RentalDashboard', {});
      if (page === 'RentalManageFleet')       H.renderPage('RentalManageFleet', { bizId: biz.id });
      if (page === 'RentalAddVehicle')        H.renderPage('RentalAddVehicle',  { bizId: biz.id });
      if (page === 'RentalBusinessAnalytics') H.renderPage('RentalBusinessAnalytics', { bizId: biz.id });
    }
    RB._loadingAccess = false;
    return RB._access;
  };

  // ── Access gate UI states ─────────────────────────────────────────────────
  function _pendingBanner() {
    return `<div style="margin:16px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:16px;padding:20px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:40px;height:40px;border-radius:50%;background:#FEF3C7;border:2px solid #F5A623;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" fill="none" stroke="#F5A623" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:#92400E;margin-bottom:4px">Pending Approval</div>
          <div style="font-size:13px;color:#92400E;line-height:1.6">Your rental company application is under review. Our team will activate your account within 24 to 48 hours.</div>
          <div style="font-size:12px;color:#B45309;margin-top:8px;font-weight:600">Fleet and vehicle management will be available after approval.</div>
        </div>
      </div>
    </div>`;
  }

  function _rejectedScreen(onReapply) {
    return `<div style="padding:24px 16px">
      <div style="background:#FFF1F0;border:1px solid #FECACA;border-radius:16px;padding:24px;text-align:center">
        <div style="width:52px;height:52px;border-radius:50%;background:#FFF1F0;border:2px solid #D92D20;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <svg width="22" height="22" fill="none" stroke="#D92D20" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div style="font-size:16px;font-weight:800;color:#D92D20;margin-bottom:8px">Application Not Approved</div>
        <div style="font-size:13px;color:#991B1B;line-height:1.6;max-width:280px;margin:0 auto">Your rental company application was not approved. This may be due to incomplete documentation or verification requirements.</div>
        <div onclick="${onReapply}" style="margin-top:20px;display:inline-block;padding:12px 28px;background:#D92D20;color:#fff;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Update Application</div>
      </div>
    </div>`;
  }

  function _blockedAction(title, reason) {
    return `<div style="margin:0 16px 16px;background:#F9F9FB;border:1.5px solid #E4E4E7;border-radius:14px;padding:20px;text-align:center">
      <svg width="22" height="22" fill="none" stroke="#A1A1AA" stroke-width="2" viewBox="0 0 24 24" style="display:block;margin:0 auto 10px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <div style="font-size:14px;font-weight:700;color:#52525B;margin-bottom:4px">${title}</div>
      <div style="font-size:12px;color:#A1A1AA;line-height:1.5">${reason}</div>
    </div>`;
  }

  // Loading skeleton (used while access RPC is in flight)
  function _dashSkeleton() {
    return `<div class="page active" id="rentalDashPage">
      <div style="background:#1A3A8F;padding:16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.15)"></div>
          <div style="flex:1">
            <div style="height:14px;width:140px;background:rgba(255,255,255,.2);border-radius:6px;margin-bottom:8px"></div>
            <div style="height:11px;width:100px;background:rgba(255,255,255,.12);border-radius:6px"></div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:12px 16px;overflow-x:auto">
        ${Array(4).fill('<div class="skel" style="flex-shrink:0;width:110px;height:80px;border-radius:14px"></div>').join('')}
      </div>
    </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalCompanySetup
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalCompanySetup = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Rental Setup')}${H.emptyState('Business required', 'Register a business first to use the rentals module.', 'Register Business', "H.openInner('BusinessOnboarding')")}</div>`;

    return `<div class="page active">
      ${H.innerTopbar('Company Profile')}
      <div class="inner-content">
        <div style="background:#EEF2FF;border-left:3px solid #1A3A8F;padding:12px 14px;border-radius:0 10px 10px 0;margin-bottom:20px">
          <div style="font-size:13px;color:#1A3A8F;font-weight:600;line-height:1.5">Connect your business to the PaMarket rental marketplace. Customers can browse your fleet and contact you directly.</div>
        </div>
        ${_field('rcSetupBio', 'Company Description', `<textarea id="rcSetupBio" rows="4" placeholder="Tell customers about your rental services, coverage areas, and fleet..." style="width:100%;min-height:80px;border:1.5px solid #E4E4E7;border-radius:14px;padding:12px 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;resize:none;box-sizing:border-box"></textarea>`)}
        ${_textField('rcSetupPhone', 'Contact Phone', '+263 77 000 0000', 'tel', biz.phone || '')}
        ${_textField('rcSetupWA', 'WhatsApp Number', '+263 77 000 0000', 'tel', biz.phone || '')}
        <div style="height:8px"></div>
        <button class="btn-pri" style="width:100%" onclick="H._rentalBiz.submitSetup('${esc(biz.id)}')">Activate Rental Portal</button>
      </div>
    </div>`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalDashboard
  // Access state machine:
  //   null access  → skeleton (RPC still loading)
  //   no_business  → redirect to BusinessOnboarding
  //   no_company   → redirect to RentalCompanySetup
  //   rejected     → blocked screen with re-apply CTA
  //   pending      → read-only dashboard (header + stats + pending banner)
  //   active       → full dashboard
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalDashboard = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Rentals')}${H.emptyState('Business account required', 'Register a business to manage rental vehicles.', 'Register Business', "H.openInner('BusinessOnboarding')")}</div>`;

    // Still loading access from RPC
    if (!RB._access) return _dashSkeleton();

    const acc = RB._access;

    // No rental company yet → send to setup
    if (!acc.has_rental_company) {
      H.openInner('RentalCompanySetup');
      return `<div class="page active"></div>`;
    }

    // Rejected → full block
    if (acc.company_status === 'rejected') {
      return `<div class="page active">
        ${H.innerTopbar('Rental Dashboard')}
        <div class="inner-content" style="padding:0">
          ${_rejectedScreen("H.openInner('RentalCompanySetup')")}
        </div>
      </div>`;
    }

    // Still loading company data after access confirmed
    if (!RB.company) return _dashSkeleton();

    const rc      = RB.company;
    const fleet   = RB.fleet;
    const leads   = RB.leads;
    const isPending = acc.company_status === 'pending';
    const bizName = rc.company_name || biz.name;
    const initial = bizName.charAt(0).toUpperCase();
    const activeCount = fleet.filter(v => v.status === 'active').length;
    const totalViews  = fleet.reduce((n, v) => n + (v.view_count || 0), 0);
    const newLeads    = leads.filter(l => l.status === 'new').length;

    const statCard = (num, label) => `
      <div style="flex-shrink:0;width:110px;background:#fff;border:1px solid #E4E4E7;border-radius:14px;padding:12px">
        <div style="font-size:22px;font-weight:800;color:#18181B">${num}</div>
        <div style="font-size:11px;color:#A1A1AA;font-weight:600;margin-top:2px">${label}</div>
      </div>`;

    // Quick actions — grayed out and non-clickable when pending
    const menuCard = (title, sub, svgIcon, onclick) => {
      if (isPending) {
        return `<div style="background:#F9F9FB;border:1px solid #E4E4E7;border-radius:18px;padding:16px;opacity:.5;cursor:not-allowed">
          <div style="width:40px;height:40px;border-radius:10px;background:#F4F4F5;display:flex;align-items:center;justify-content:center;margin-bottom:10px">${svgIcon}</div>
          <div style="font-size:14px;font-weight:700;color:#18181B">${title}</div>
          <div style="font-size:12px;color:#A1A1AA;margin-top:2px">${sub}</div>
        </div>`;
      }
      return `<div onclick="${onclick}" style="background:#fff;border:1px solid #E4E4E7;border-radius:18px;padding:16px;cursor:pointer">
        <div style="width:40px;height:40px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;margin-bottom:10px">${svgIcon}</div>
        <div style="font-size:14px;font-weight:700;color:#18181B">${title}</div>
        <div style="font-size:12px;color:#A1A1AA;margin-top:2px">${sub}</div>
      </div>`;
    };

    const recentItems = leads.slice(0, 5).map(l => {
      const init  = (l.user_name || 'C').charAt(0).toUpperCase();
      const isNew = l.status === 'new';
      return `<div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid #E4E4E7;${isNew ? 'border-left:3px solid #1A3A8F;' : ''}cursor:pointer">
        <div style="width:44px;height:44px;border-radius:50%;background:#DBEAFE;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#1A3A8F;flex-shrink:0">${init}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:#18181B">${esc(l.user_name || 'Customer')}</div>
          <div style="font-size:13px;color:#A1A1AA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(l.vehicle_name || 'Rental inquiry')}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:11px;color:#A1A1AA">${esc(l.lead_source || 'inquiry')}</div>
          ${isNew ? `<div style="width:20px;height:20px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:4px 0 0 auto">N</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="page active" id="rentalDashPage">
      <div style="background:#1A3A8F;padding:16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <div onclick="H.goBack()" role="button" aria-label="Back" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
            <svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </div>
          <div style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0">${initial}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(bizName)}</div>
            <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:1px">Rentals Dashboard</div>
          </div>
          <div style="display:flex;gap:12px;flex-shrink:0">
            <div onclick="H.openInner('Notifications')" role="button" aria-label="Notifications" style="cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px">
              <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div onclick="H.openInner('Profile')" role="button" aria-label="Profile" style="cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px">
              <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:12px 16px;overflow-x:auto;flex-shrink:0;scrollbar-width:none;-ms-overflow-style:none">
        ${statCard(fleet.length, 'Total Vehicles')}
        ${statCard(activeCount, 'Active Listings')}
        ${statCard(fmt(totalViews), 'Total Views')}
        ${statCard(newLeads, 'New Inquiries')}
      </div>
      <div style="flex:1;overflow-y:auto">
        ${isPending ? _pendingBanner() : ''}
        ${_div}
        <div style="padding:14px 16px 12px;background:#fff">
          <div style="font-size:14px;font-weight:700;color:#18181B">Quick Actions</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px 16px;background:#fff">
          ${menuCard('Add Vehicle', 'List a new rental',
            '<svg width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            `H.openInner('RentalAddVehicle',{bizId:'${esc(biz.id)}'})`)}
          ${menuCard('Manage Fleet', 'Edit or archive vehicles',
            '<svg width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
            `H.openInner('RentalManageFleet',{bizId:'${esc(biz.id)}'})`)}
          ${menuCard('Analytics', 'Views, leads, trends',
            '<svg width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
            `H.openInner('RentalBusinessAnalytics',{bizId:'${esc(biz.id)}'})`)}
          ${menuCard('Company Profile', 'Update info and logo',
            '<svg width="20" height="20" fill="none" stroke="#1A3A8F" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            `H.openInner('RentalCompanySetup')`)}
        </div>
        ${leads.length ? `
          ${_div}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px;background:#fff">
            <div style="font-size:14px;font-weight:700;color:#18181B">Recent Inquiries</div>
          </div>
          ${recentItems}
        ` : ''}
        <div style="height:32px"></div>
      </div>
    </div>`;
  };

  H.pages.RentalDashboard_after = function (params) {
    const biz = _requireBiz();
    if (!biz) return;
    // If a loader is already in flight (it triggered this re-render), skip
    if (RB._loadingAccess || RB._loadingCompany) return;
    // Fresh navigation: always re-fetch access so status changes reflect immediately
    RB._access = null;
    RB.loadAccess();
    if (!RB.company) RB.loadCompanyData(biz.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalManageFleet
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalManageFleet = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Fleet')}${H.emptyState('Business required', '')}</div>`;

    const acc = RB._access;

    // Pending or rejected: show fleet read-only (owner can see their listings) but no write actions
    const canWrite = acc && acc.can_create_fleet;

    const tab   = RB._fleetTab || 'all';
    const fleet = RB.fleet;

    const allCount    = fleet.length;
    const activeCount = fleet.filter(v => v.status === 'active').length;
    const pausedCount = fleet.filter(v => v.status === 'paused').length;
    const draftCount  = fleet.filter(v => v.status === 'draft').length;

    const filtered = tab === 'all'    ? fleet
                   : tab === 'active' ? fleet.filter(v => v.status === 'active')
                   : tab === 'paused' ? fleet.filter(v => v.status === 'paused')
                   :                    fleet.filter(v => v.status === 'draft');

    const tabItem = (id, label) => {
      const active = tab === id;
      return `<div onclick="H._rentalBiz.setFleetTab('${id}')" style="flex:1;padding:12px 0;text-align:center;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2.5px solid ${active ? '#1A3A8F' : 'transparent'};color:${active ? '#1A3A8F' : '#A1A1AA'}">${label}</div>`;
    };

    const fleetItem = (v) => {
      const img = v.cover_url
        ? `<img src="${esc(v.cover_url)}" style="width:100%;height:100%;object-fit:cover">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" fill="none" stroke="#94A3B8" stroke-width="1.5" viewBox="0 0 24 24"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>`;
      const loc  = v.city_label || '';
      const cat  = v.category_label || '';
      const meta = [cat, loc].filter(Boolean).join(' · ');
      return `<div data-fleet-item data-name="${esc(((v.brand_label || '') + ' ' + (v.model || '')).toLowerCase())}" style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #E4E4E7;align-items:center">
        <div style="width:72px;height:52px;border-radius:10px;background:#E8ECF4;overflow:hidden;flex-shrink:0">${img}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:#18181B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((v.brand_label || '') + ' ' + (v.model || ''))} <span style="font-weight:500;color:#A1A1AA">${v.year || ''}</span></div>
          <div style="font-size:12px;color:#A1A1AA;margin-top:2px">${esc(meta)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <div style="font-size:14px;font-weight:800;color:#1A3A8F">$${fmt(v.daily_rate)}/day</div>
            ${_statusPill(v.status)}
          </div>
        </div>
        ${canWrite ? `<div style="display:flex;gap:8px;flex-shrink:0">
          <div onclick="H.openInner('RentalEditVehicle',{id:'${esc(v.id)}',bizId:'${esc(biz.id)}'})" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #E4E4E7;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">
            <svg width="15" height="15" fill="none" stroke="#52525B" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div onclick="H._rentalBiz._fleetMore('${esc(v.id)}','${esc(biz.id)}','${v.status === 'active' ? 'paused' : 'active'}')" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #E4E4E7;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">
            <svg width="15" height="15" fill="none" stroke="#52525B" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
        </div>` : ''}
      </div>`;
    };

    return `<div class="page active" id="rentalFleetPage">
      <div style="height:52px;background:#fff;display:flex;align-items:center;padding:0 16px;gap:12px;border-bottom:1px solid #E4E4E7;flex-shrink:0">
        <div onclick="H.goBack()" style="width:32px;height:32px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;cursor:pointer">
          <svg width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
        <div style="flex:1;font-size:16px;font-weight:700;color:#18181B">Manage Fleet</div>
        ${canWrite ? `<div onclick="H.openInner('RentalAddVehicle',{bizId:'${esc(biz.id)}'})" style="font-size:13px;font-weight:600;color:#1A3A8F;cursor:pointer">+ Add</div>` : ''}
      </div>
      ${!canWrite && acc ? _blockedAction('Vehicle management locked', 'Your company must be approved before you can add or edit vehicles.') : ''}
      <div style="display:flex;background:#fff;border-bottom:1px solid #E4E4E7;flex-shrink:0">
        ${tabItem('all',    `All (${allCount})`)}
        ${tabItem('active', `Active (${activeCount})`)}
        ${tabItem('paused', `Paused (${pausedCount})`)}
        ${tabItem('draft',  `Draft (${draftCount})`)}
      </div>
      <div style="padding:10px 16px;background:#fff;border-bottom:1px solid #E4E4E7;flex-shrink:0">
        <div style="height:38px;border:1.5px solid #E4E4E7;border-radius:999px;display:flex;align-items:center;padding:0 12px;gap:8px">
          <svg width="14" height="14" fill="none" stroke="#A1A1AA" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Search fleet..." oninput="H._rentalBiz.searchFleet(this.value)" style="flex:1;border:none;outline:none;font-size:13px;color:#18181B;background:transparent;font-family:inherit">
        </div>
      </div>
      <div style="flex:1;overflow-y:auto" id="fleetListWrap">
        ${filtered.length
          ? filtered.map(fleetItem).join('')
          : `<div style="padding:40px 16px;text-align:center"><div style="font-size:14px;font-weight:600;color:#A1A1AA">No vehicles in this category</div>${canWrite ? `<div onclick="H.openInner('RentalAddVehicle',{bizId:'${esc(biz.id)}'})" style="margin-top:12px;display:inline-block;padding:10px 20px;background:#1A3A8F;color:#fff;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Add Vehicle</div>` : ''}</div>`}
      </div>
    </div>`;
  };

  H.pages.RentalManageFleet_after = function (params) {
    const biz = _requireBiz();
    if (!biz) return;
    if (RB._loadingAccess || RB._loadingCompany) return;
    if (!RB._access) RB.loadAccess();
    if (!RB.company) RB.loadCompanyData(biz.id);
  };

  RB.setFleetTab = function (tab) {
    RB._fleetTab = tab;
    const biz = _requireBiz();
    if (biz) H.renderPage('RentalManageFleet', { bizId: biz.id });
  };

  RB.searchFleet = function (q) {
    q = (q || '').toLowerCase();
    document.querySelectorAll('[data-fleet-item]').forEach(el => {
      const name = el.dataset.name || '';
      el.style.display = !q || name.includes(q) ? '' : 'none';
    });
  };

  RB._fleetMore = function (vehicleId, bizId, toggleStatus) {
    const v = RB.fleet.find(x => x.id === vehicleId);
    if (!v) return;
    const isActive = v.status === 'active';
    H.modal({
      title: (v.brand_label || '') + ' ' + (v.model || ''),
      body: `<div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="H.closeModal();H.openInner('RentalEditVehicle',{id:'${esc(vehicleId)}',bizId:'${esc(bizId)}'})" style="width:100%;padding:12px;background:#fff;border:1.5px solid #E4E4E7;border-radius:12px;font-size:14px;font-weight:600;color:#18181B;cursor:pointer;font-family:inherit;text-align:left">Edit Vehicle</button>
        <button onclick="H.closeModal();H._rentalBiz.toggleFleetStatus('${esc(vehicleId)}','${esc(toggleStatus)}')" style="width:100%;padding:12px;background:#fff;border:1.5px solid #E4E4E7;border-radius:12px;font-size:14px;font-weight:600;color:#18181B;cursor:pointer;font-family:inherit;text-align:left">${isActive ? 'Pause Listing' : 'Activate Listing'}</button>
        <button onclick="H.closeModal();H.openInner('RentalAvailability',{id:'${esc(vehicleId)}',bizId:'${esc(bizId)}'})" style="width:100%;padding:12px;background:#fff;border:1.5px solid #E4E4E7;border-radius:12px;font-size:14px;font-weight:600;color:#18181B;cursor:pointer;font-family:inherit;text-align:left">Manage Availability</button>
        <label style="width:100%;padding:12px;background:#fff;border:1.5px solid #E4E4E7;border-radius:12px;font-size:14px;font-weight:600;color:#18181B;cursor:pointer;display:flex;align-items:center;gap:8px">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Upload Photo
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style="display:none" onchange="H.closeModal();H._rentalBiz.handlePhotoUpload('${esc(vehicleId)}',this)">
        </label>
        <button onclick="H.closeModal();H._rentalBiz.removeVehicle('${esc(vehicleId)}')" style="width:100%;padding:12px;background:#FFF1F0;border:1.5px solid #FECACA;border-radius:12px;font-size:14px;font-weight:600;color:#D92D20;cursor:pointer;font-family:inherit;text-align:left">Remove Vehicle</button>
      </div>`,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalAddVehicle (4-step wizard)
  // Blocked unless rental_companies.status = 'active'
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalAddVehicle = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Add Vehicle')}${H.emptyState('Business required', '')}</div>`;

    const acc = RB._access;
    if (acc && !acc.can_create_vehicle) {
      const reason = acc.company_status === 'pending'
        ? 'Your company is pending approval. Vehicle creation will be unlocked once your account is activated.'
        : 'Vehicle creation is not available in your current account state.';
      return `<div class="page active">
        ${H.innerTopbar('Add Vehicle')}
        <div class="inner-content" style="padding:0">
          <div style="height:32px"></div>
          ${_blockedAction('Vehicle creation locked', reason)}
          <div style="padding:0 16px">
            <button onclick="H.goBack()" class="btn-sec" style="width:100%">Go Back</button>
          </div>
        </div>
      </div>`;
    }

    if (!RB._wizState) { RB._wizState = { step: 0, data: {}, bizId: (params && params.bizId) || biz.id }; }
    return RB._renderWizStep(RB._wizState.step);
  };

  H.pages.RentalAddVehicle_after = function () {
    if (!RB._access) RB.loadAccess();
    RB.loadWizLookups();
    window.RB = RB;
  };

  // Load category/brand/location options from the DB so the wizard's dropdown
  // slugs always match what _wizSubmit looks up. Hardcoding them caused vehicle
  // creation to crash whenever a slug drifted (e.g. 'vw' vs 'volkswagen').
  RB._lookups = null;
  RB.loadWizLookups = async function () {
    if (RB._lookups || RB._loadingLookups) return;
    const sb = window.supabase; if (!sb) return;
    RB._loadingLookups = true;
    try {
      // Column names differ per table: categories/brands use `label`;
      // locations use `city` for the display name and `sort_order` to order.
      const [cats, brands, locs] = await Promise.all([
        sb.from('rental_categories').select('slug,label').order('label'),
        sb.from('rental_brands').select('slug,label').order('label'),
        sb.from('rental_locations').select('slug,city').order('sort_order'),
      ]);
      RB._lookups = {
        cats:   (cats.data   || []).map(r => [r.slug, r.label]),
        brands: (brands.data || []).map(r => [r.slug, r.label]),
        cities: (locs.data   || []).map(r => [r.slug, r.city]),
      };
    } catch (e) {
      console.warn('rental wiz lookups:', e);
    }
    RB._loadingLookups = false;
    if (H.currentPageName === 'RentalAddVehicle') {
      H.renderPage('RentalAddVehicle', { bizId: RB._wizState && RB._wizState.bizId });
    }
  };

  RB._renderWizStep = function (step) {
    const d    = (RB._wizState && RB._wizState.data) || {};
    const bizId= (RB._wizState && RB._wizState.bizId) || '';

    const L = RB._lookups;
    const BRANDS = [['', 'Select brand']].concat(L ? L.brands : []);
    const CATS   = [['', 'Select category']].concat(L ? L.cats : []);
    const CITIES = [['', 'Select city']].concat(L ? L.cities : []);
    const TRANS  = [['', 'Select'], ['Automatic', 'Automatic'], ['Manual', 'Manual'], ['CVT', 'CVT'], ['Semi-Automatic', 'Semi-Automatic']];
    const FUELS  = [['', 'Select'], ['Diesel', 'Diesel'], ['Petrol', 'Petrol'], ['Hybrid', 'Hybrid'], ['Electric', 'Electric']];
    const SEATS  = [['', 'Select'], ['4', '4'], ['5', '5'], ['7', '7'], ['8', '8'], ['12', '12+']];
    const MINDAYS= [['1', '1 day'], ['3', '3 days'], ['7', '1 week'], ['14', '2 weeks'], ['30', '1 month']];

    const driveChip = (val) => {
      const sel = d.drive_type === val;
      return `<div onclick="H._rentalBiz._setDriveType('${val}')" data-drive="${val}" style="padding:7px 14px;border:1.5px solid ${sel ? '#1A3A8F' : '#E4E4E7'};border-radius:999px;font-size:13px;font-weight:600;color:${sel ? '#1A3A8F' : '#52525B'};background:${sel ? '#EEF2FF' : '#fff'};cursor:pointer;user-select:none">${val}</div>`;
    };

    let stepTitle = '', stepSub = '', body = '';

    if (step === 0) {
      stepTitle = 'Basic Information';
      stepSub   = 'Vehicle details and category';
      body = `
        ${_selectField('avCat',   'Vehicle Category *', CATS,   d.category_slug)}
        ${_selectField('avBrand', 'Brand *',            BRANDS, d.brand_slug)}
        ${_textField  ('avModel', 'Model *',            'e.g. Fortuner, Aqua, Hilux', 'text', d.model)}
        ${_rowWrap(
            _selectField('avYear',  'Year *', [['', 'Year'], ...Array.from({length: 26}, (_, i) => { const y = String(2025 - i); return [y, y]; })], d.year ? String(d.year) : ''),
            _selectField('avSeats', 'Seats *', SEATS, d.seats ? String(d.seats) : '')
        )}
        ${_rowWrap(
            _selectField('avTrans', 'Transmission *', TRANS, d.transmission),
            _selectField('avFuel',  'Fuel Type *',    FUELS, d.fuel_type)
        )}
        ${_textField('avEngine', 'Engine Capacity', 'e.g. 2.8L', 'text', d.engine_capacity)}
        ${_field('avDrive', 'Drive Type', `<div style="display:flex;gap:8px;flex-wrap:wrap">${['4WD', 'AWD', 'FWD', 'RWD'].map(driveChip).join('')}</div>`)}
        ${_selectField('avCity', 'City / Location *', CITIES, d.city_slug)}`;
    } else if (step === 1) {
      stepTitle = 'Pricing and Rental Terms';
      stepSub   = 'Set your daily rates and deposit';
      body = `
        ${_priceField('avDaily',   'Daily Rate (USD) *', d.daily_rate)}
        ${_rowWrap(
            _priceField('avWeekly',  'Weekly Rate',  d.weekly_rate),
            _priceField('avMonthly', 'Monthly Rate', d.monthly_rate)
        )}
        ${_priceField('avDeposit', 'Security Deposit *', d.deposit)}
        ${_selectField('avMinDays', 'Minimum Rental Period', MINDAYS, d.min_rental_days ? String(d.min_rental_days) : '1')}
        ${_priceField('avDriver', 'Driver Rate / Day (leave blank for self-drive only)', d.driver_rate)}
        ${_field('avNotes', 'Additional Notes', `<textarea id="avNotes" rows="3" placeholder="Pickup location, hours, any specific rental conditions..." style="width:100%;min-height:72px;border:1.5px solid #E4E4E7;border-radius:14px;padding:12px 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;resize:none;box-sizing:border-box">${esc(d.notes || '')}</textarea>`)}`;
    } else if (step === 2) {
      stepTitle = 'Description';
      stepSub   = 'Tell customers about this vehicle';
      body = `
        ${_field('avDesc', 'Description', `<textarea id="avDesc" rows="5" placeholder="Describe the vehicle condition, included accessories, rental terms..." style="width:100%;min-height:100px;border:1.5px solid #E4E4E7;border-radius:14px;padding:12px 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;resize:none;box-sizing:border-box">${esc(d.description || '')}</textarea>`)}
        ${_field('avFeatures', 'Features (one per line)', `<textarea id="avFeatures" rows="4" placeholder="Air conditioning\nBluetooth\nCruise control\nGPS navigation" style="width:100%;min-height:80px;border:1.5px solid #E4E4E7;border-radius:14px;padding:12px 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;resize:none;box-sizing:border-box">${esc((d.features || []).join('\n'))}</textarea>`)}`;
    } else if (step === 3) {
      stepTitle = 'Review and Submit';
      stepSub   = 'Confirm your vehicle details';
      const reviewRow = (label, val) => val ? `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E4E4E7;font-size:13px"><span style="color:#52525B;font-weight:600">${label}</span><span style="color:#18181B;font-weight:700">${esc(String(val))}</span></div>` : '';
      body = `
        <div style="background:#fff;border:1px solid #E4E4E7;border-radius:14px;padding:0 14px;margin-bottom:16px">
          ${reviewRow('Category', d.category_slug)}
          ${reviewRow('Brand', d.brand_slug)}
          ${reviewRow('Model', d.model)}
          ${reviewRow('Year', d.year)}
          ${reviewRow('Seats', d.seats)}
          ${reviewRow('Transmission', d.transmission)}
          ${reviewRow('Fuel Type', d.fuel_type)}
          ${reviewRow('Drive Type', d.drive_type)}
          ${reviewRow('City', d.city_slug)}
          ${reviewRow('Daily Rate', d.daily_rate ? '$' + d.daily_rate : null)}
          ${reviewRow('Weekly Rate', d.weekly_rate ? '$' + d.weekly_rate : null)}
          ${reviewRow('Security Deposit', d.deposit ? '$' + d.deposit : null)}
          ${reviewRow('Min Rental Days', d.min_rental_days)}
        </div>
        <div style="background:#EEF2FF;border-left:3px solid #1A3A8F;padding:10px 14px;border-radius:0 10px 10px 0;font-size:12px;color:#1A3A8F;font-weight:600;line-height:1.5">
          Vehicle photos can be added after creation from the Manage Fleet screen.
        </div>`;
    }

    const isLast = step === WIZARD_STEPS.length - 1;
    return `<div class="page active">
      <div style="height:52px;background:#fff;display:flex;align-items:center;padding:0 16px;gap:12px;border-bottom:1px solid #E4E4E7;flex-shrink:0">
        <div onclick="${step > 0 ? 'H._rentalBiz._wizBack()' : 'H.goBack()'}" style="width:32px;height:32px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;cursor:pointer">
          <svg width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
        <div style="flex:1;font-size:16px;font-weight:700;color:#18181B">Add Rental Vehicle</div>
      </div>
      ${_stepBar(step)}
      <div style="padding:12px 16px 4px;background:#fff;flex-shrink:0">
        <div style="font-size:16px;font-weight:800;color:#18181B">${stepTitle}</div>
        <div style="font-size:13px;color:#A1A1AA;margin-top:2px">${stepSub}</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px">${body}</div>
      <div style="padding:12px 16px;background:#fff;border-top:1px solid #E4E4E7;display:flex;gap:10px;flex-shrink:0">
        ${step > 0 ? `<button onclick="H._rentalBiz._wizBack()" style="height:48px;width:80px;background:#fff;color:#1A3A8F;border:2px solid #1A3A8F;border-radius:14px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">Back</button>` : ''}
        <button class="btn-pri" style="flex:1;height:48px" onclick="H._rentalBiz._wizNext(${step})">${isLast ? 'Create Vehicle' : 'Continue - Step ' + (step + 2) + ' of ' + WIZARD_STEPS.length}</button>
      </div>
    </div>`;
  };

  RB._setDriveType = function (val) {
    if (RB._wizState) RB._wizState.data.drive_type = val;
    document.querySelectorAll('[data-drive]').forEach(el => {
      const sel = el.dataset.drive === val;
      el.style.borderColor = sel ? '#1A3A8F' : '#E4E4E7';
      el.style.color       = sel ? '#1A3A8F' : '#52525B';
      el.style.background  = sel ? '#EEF2FF' : '#fff';
    });
  };

  RB._wizBack = function () {
    if (!RB._wizState || RB._wizState.step <= 0) { H.goBack(); return; }
    RB._wizState.step--;
    H.renderPage('RentalAddVehicle', { bizId: RB._wizState.bizId });
  };

  RB._wizStateChanged = function () { };

  RB._wizNext = function (step) {
    const d = RB._wizState.data;
    if (step === 0) {
      d.category_slug  = document.getElementById('avCat')?.value;
      d.brand_slug     = document.getElementById('avBrand')?.value;
      d.model          = document.getElementById('avModel')?.value?.trim();
      d.year           = parseInt(document.getElementById('avYear')?.value) || null;
      d.seats          = parseInt(document.getElementById('avSeats')?.value) || null;
      d.transmission   = document.getElementById('avTrans')?.value || null;
      d.fuel_type      = document.getElementById('avFuel')?.value || null;
      d.engine_capacity= document.getElementById('avEngine')?.value?.trim() || null;
      d.city_slug      = document.getElementById('avCity')?.value;
      if (!d.category_slug || !d.brand_slug || !d.model || !d.city_slug) { H.toast('Please fill in all required fields.'); return; }
      if (!d.transmission || !d.fuel_type) { H.toast('Please select transmission and fuel type.'); return; }
      if (d.year && (d.year < 1980 || d.year > new Date().getFullYear() + 1)) { H.toast('Please enter a valid year.'); return; }
    } else if (step === 1) {
      d.daily_rate     = parseFloat(document.getElementById('avDaily')?.value) || null;
      d.weekly_rate    = parseFloat(document.getElementById('avWeekly')?.value) || null;
      d.monthly_rate   = parseFloat(document.getElementById('avMonthly')?.value) || null;
      d.deposit        = parseFloat(document.getElementById('avDeposit')?.value) || null;
      d.min_rental_days= parseInt(document.getElementById('avMinDays')?.value) || 1;
      d.driver_rate    = parseFloat(document.getElementById('avDriver')?.value) || null;
      d.notes          = document.getElementById('avNotes')?.value?.trim() || null;
      if (!d.daily_rate || d.daily_rate <= 0) { H.toast('Please enter a daily rate.'); return; }
    } else if (step === 2) {
      d.description = document.getElementById('avDesc')?.value?.trim() || null;
      d.features    = (document.getElementById('avFeatures')?.value || '').split('\n').map(f => f.trim()).filter(Boolean);
    } else if (step === 3) {
      RB._wizSubmit();
      return;
    }
    RB._wizState.step = step + 1;
    H.renderPage('RentalAddVehicle', { bizId: RB._wizState.bizId });
    window.scrollTo(0, 0);
  };

  RB._wizSubmit = async function () {
    const sb = window.supabase; if (!sb) { H.toast('No connection. Try again.', 4000, true); return; }
    const u  = H.currentUser(); if (!u) return;
    const d  = RB._wizState.data;
    const biz= _requireBiz(); if (!biz) return;

    // Re-verify access at submit time — backend RLS will also enforce this,
    // but this gives a clean user-facing error instead of a 403.
    const freshAccess = await RB.loadAccess();
    if (!freshAccess || !freshAccess.can_create_vehicle) {
      H.toast('Vehicle creation requires an active rental company account.', 5000, true);
      return;
    }

    const btn = document.querySelector('.btn-pri');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    let navigatedAway = false;

    try {
      const [catRes, brandRes, locRes, compRes] = await Promise.all([
        sb.from('rental_categories').select('id').eq('slug', d.category_slug).maybeSingle(),
        sb.from('rental_brands').select('id').eq('slug', d.brand_slug).maybeSingle(),
        sb.from('rental_locations').select('id').eq('slug', d.city_slug).maybeSingle(),
        sb.from('rental_companies').select('id').eq('business_id', biz.id).maybeSingle(),
      ]);

      if (!compRes.data) {
        H.toast('Rental company not set up. Please complete setup first.', 5000, true);
        navigatedAway = true;
        H.openInner('RentalCompanySetup');
        return;
      }
      if (!catRes.data || !brandRes.data) {
        H.toast('Selected category or brand is no longer available. Please reselect.', 5000, true);
        return;
      }

      const desc = [d.description, d.notes].filter(Boolean).join('\n\n') || null;

      const listingPayload = {
        company_id:      compRes.data.id,
        category_id:     catRes.data.id,
        brand_id:        brandRes.data.id,
        location_id:     locRes.data ? locRes.data.id : null,
        model:           d.model,
        year:            d.year,
        daily_rate:      d.daily_rate,
        weekly_rate:     d.weekly_rate || null,
        monthly_rate:    d.monthly_rate || null,
        deposit:         d.deposit || null,
        min_rental_days: d.min_rental_days || 1,
        driver_rate:     d.driver_rate || null,
        description:     desc,
        status:          'active',
        admin_status:    'pending_review',
        is_available:    true,
      };

      const { data: listing, error: lstErr } = await sb.from('rental_vehicle_listings').insert(listingPayload).select('id').single();
      if (lstErr) throw lstErr;

      const specsPayload = {
        listing_id:      listing.id,
        transmission:    d.transmission || null,
        fuel_type:       d.fuel_type    || null,
        drive_type:      d.drive_type   || null,
        seats:           d.seats        || null,
        engine_capacity: d.engine_capacity || null,
      };
      await sb.from('rental_vehicle_specs').insert(specsPayload);

      if (d.features && d.features.length) {
        await sb.from('rental_vehicle_features').insert(d.features.map(f => ({ listing_id: listing.id, feature: f })));
      }

      RB._wizState = null;
      RB.fleet = [];
      navigatedAway = true;
      H.toast('Vehicle created! It will appear in the marketplace once approved.');
      H.openInner('RentalManageFleet', { bizId: biz.id });
    } catch (e) {
      console.warn('vehicle create:', e);
      // RLS block from backend — company not active
      if (e && e.code === '42501') {
        H.toast('Access denied. Your company must be active to add vehicles.', 5000, true);
      } else {
        H.toast('Could not create vehicle. Check your details and try again.', 5000, true);
      }
    } finally {
      // Re-enable the button on every path that stays on the wizard, so a
      // failed or blocked submit is always retryable (previously some early
      // returns left it stuck on "Creating...").
      if (!navigatedAway && btn) { btn.disabled = false; btn.textContent = 'Create Vehicle'; }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalAvailability
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalAvailability = function (params) {
    const id     = params && params.id;
    const v      = RB.fleet.find(x => x.id === id) || {};
    const blocks = (RB._availBlocks && RB._availBlocks[id]) || [];
    const vName  = ((v.brand_label || '') + ' ' + (v.model || '')).trim() || 'Vehicle';
    const canWrite = RB._access && RB._access.can_create_vehicle;

    const blockRows = blocks.map(b => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #E4E4E7">
        <div>
          <div style="font-size:13px;font-weight:700;color:#18181B">${esc(b.starts_on)} to ${esc(b.ends_on)}</div>
          <div style="font-size:12px;color:#A1A1AA;margin-top:2px">${esc(b.reason || 'Blocked')}</div>
        </div>
        ${canWrite ? `<button onclick="H._rentalBiz.removeBlock('${esc(id)}','${esc(b.id)}')" style="background:none;border:none;font-size:12px;font-weight:700;color:#D92D20;cursor:pointer;font-family:inherit;padding:4px 0">Remove</button>` : ''}
      </div>`).join('');

    return `<div class="page active">
      ${H.innerTopbar('Availability')}
      <div style="padding:12px 16px;background:#fff;border-bottom:1px solid #E4E4E7;display:flex;gap:12px;align-items:center;flex-shrink:0">
        <div style="width:56px;height:42px;border-radius:10px;background:#E8ECF4;flex-shrink:0;overflow:hidden">
          ${v.cover_url ? `<img src="${esc(v.cover_url)}" style="width:100%;height:100%;object-fit:cover">` : ''}
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#18181B">${esc(vName)}</div>
          <div style="font-size:12px;color:#A1A1AA">$${fmt(v.daily_rate)}/day</div>
        </div>
        <div style="margin-left:auto">${_statusPill(v.status)}</div>
      </div>
      <div class="inner-content" style="padding:0">
        ${canWrite ? `
          <div style="height:8px;background:#F4F4F5"></div>
          <div style="padding:14px 16px 8px;background:#fff">
            <div style="font-size:14px;font-weight:700;color:#18181B">Block Dates</div>
          </div>
          <div style="padding:0 16px 16px;background:#fff;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;gap:10px">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700;color:#52525B;margin-bottom:6px">From</div>
                <input id="avlStart" type="date" style="width:100%;height:46px;border:1.5px solid #E4E4E7;border-radius:14px;padding:0 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;box-sizing:border-box">
              </div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700;color:#52525B;margin-bottom:6px">To</div>
                <input id="avlEnd" type="date" style="width:100%;height:46px;border:1.5px solid #E4E4E7;border-radius:14px;padding:0 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;box-sizing:border-box">
              </div>
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#52525B;margin-bottom:6px">Reason (optional)</div>
              <input id="avlReason" type="text" placeholder="Maintenance, personal use..." style="width:100%;height:46px;border:1.5px solid #E4E4E7;border-radius:14px;padding:0 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;box-sizing:border-box">
            </div>
            <button onclick="H._rentalBiz.addBlock('${esc(id)}')" style="height:48px;width:100%;background:#fff;color:#1A3A8F;border:2px solid #1A3A8F;border-radius:14px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">Block Selected Dates</button>
          </div>
        ` : `<div style="height:8px;background:#F4F4F5"></div>${_blockedAction('Read-only mode', 'Availability management requires an active company account.')}`}
        ${blocks.length ? `
          <div style="height:8px;background:#F4F4F5"></div>
          <div style="padding:14px 16px 8px;background:#fff">
            <div style="font-size:14px;font-weight:700;color:#18181B">Blocked Periods</div>
          </div>
          <div style="background:#fff;border-top:1px solid #E4E4E7">${blockRows}</div>
        ` : `
          <div style="padding:32px 16px;text-align:center">
            <div style="font-size:13px;color:#A1A1AA">No blocked dates. Vehicle is available.</div>
          </div>
        `}
      </div>
    </div>`;
  };

  H.pages.RentalAvailability_after = function (params) {
    const id = params && params.id;
    if (!RB._access) RB.loadAccess();
    if (id) RB.loadAvailability(id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalBusinessAnalytics
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalBusinessAnalytics = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Analytics')}${H.emptyState('Business required', '')}</div>`;

    const rc    = RB.company || {};
    const a     = RB._analytics;
    const fleet = RB.fleet;

    const totalViews     = a ? a.views_30d     : fleet.reduce((n, v) => n + (v.view_count || 0), 0);
    const totalInquiries = a ? (a.chats_30d + a.whatsapp_30d + a.calls_30d) : fleet.reduce((n, v) => n + (v.inquiry_count || 0), 0);
    const convRate       = totalViews ? Math.round((totalInquiries / totalViews) * 100) : 0;

    const kpiCard = (num, label) => `
      <div style="background:#F9F9FB;border:1px solid #E4E4E7;border-radius:14px;padding:12px">
        <div style="font-size:20px;font-weight:800;color:#18181B">${num}</div>
        <div style="font-size:11px;color:#A1A1AA;font-weight:600;margin-top:2px">${label}</div>
      </div>`;

    const topByViews = fleet.slice().sort((x, y) => (y.view_count || 0) - (x.view_count || 0)).slice(0, 5);

    const totalLeadCh = (a ? (a.chats_30d + a.whatsapp_30d + a.calls_30d) : 0) || 1;
    const chatPct = a ? Math.round((a.chats_30d    / totalLeadCh) * 100) : 52;
    const waPct   = a ? Math.round((a.whatsapp_30d / totalLeadCh) * 100) : 34;
    const callPct = a ? Math.round((a.calls_30d    / totalLeadCh) * 100) : 14;

    const sourceBar = (label, pct, color) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="font-weight:600;color:#18181B">${label}</span>
          <span style="font-weight:800;color:#18181B">${pct}%</span>
        </div>
        <div style="height:8px;background:#E4E4E7;border-radius:999px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:999px"></div>
        </div>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('Fleet Analytics')}
      <div class="inner-content" style="padding:0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px;background:#fff;border-bottom:1px solid #E4E4E7">
          ${kpiCard(fmt(totalViews),     'Total Views')}
          ${kpiCard(fmt(totalInquiries), 'Inquiries')}
          ${kpiCard(convRate + '%',      'Inquiry Rate')}
          ${kpiCard(fleet.filter(v => v.status === 'active').length, 'Active Listings')}
        </div>
        ${topByViews.length ? `
          ${_div}
          <div style="padding:14px 16px;background:#fff;border-bottom:1px solid #E4E4E7">
            <div style="font-size:14px;font-weight:700;color:#18181B;margin-bottom:8px">Top Performing Vehicles</div>
            ${topByViews.map(v => `
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E4E4E7;font-size:13px">
                <div>
                  <div style="font-weight:700;color:#18181B">${esc((v.brand_label || '') + ' ' + (v.model || ''))}</div>
                  <div style="color:#A1A1AA;font-size:12px;margin-top:2px">$${fmt(v.daily_rate)}/day</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800;color:#1A3A8F">${fmt(v.view_count || 0)} views</div>
                  <div style="color:#A1A1AA;font-size:12px;margin-top:2px">${fmt(v.inquiry_count || 0)} inquiries</div>
                </div>
              </div>`).join('')}
          </div>
        ` : ''}
        ${_div}
        <div style="padding:14px 16px 16px;background:#fff">
          <div style="font-size:14px;font-weight:700;color:#18181B;margin-bottom:12px">Inquiry Sources</div>
          ${sourceBar('In-app Chat', chatPct, '#1A3A8F')}
          ${sourceBar('WhatsApp',    waPct,   '#25D366')}
          ${sourceBar('Direct Call', callPct, '#12B76A')}
        </div>
        ${rc.avg_rating ? `
          ${_div}
          <div style="padding:16px;background:#fff">
            <div style="font-size:14px;font-weight:700;color:#18181B;margin-bottom:4px">Rating</div>
            <div style="font-size:32px;font-weight:800;color:#1A3A8F">${Number(rc.avg_rating).toFixed(1)}</div>
            <div style="font-size:13px;color:#A1A1AA">from ${fmt(rc.review_count || 0)} review${(rc.review_count || 0) === 1 ? '' : 's'}</div>
          </div>
        ` : ''}
        <div style="height:16px"></div>
      </div>
    </div>`;
  };

  H.pages.RentalBusinessAnalytics_after = function (params) {
    if (!RB._access) RB.loadAccess();
    const rc = RB.company;
    if (rc && rc.id && rc.id !== RB._analyticsId) RB.loadAnalytics(rc.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalEditVehicle
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalEditVehicle = function (params) {
    const id    = params && params.id;
    const bizId = params && params.bizId;
    const v     = RB.fleet.find(x => x.id === id) || {};
    const vName = ((v.brand_label || '') + ' ' + (v.model || '') + (v.year ? ' ' + v.year : '')).trim();

    // Block editing if company not active
    const acc = RB._access;
    if (acc && !acc.can_create_vehicle) {
      return `<div class="page active">
        ${H.innerTopbar('Edit Vehicle')}
        <div class="inner-content" style="padding:0">
          <div style="height:32px"></div>
          ${_blockedAction('Editing locked', 'Your company must be active to edit vehicles.')}
          <div style="padding:0 16px"><button onclick="H.goBack()" class="btn-sec" style="width:100%">Go Back</button></div>
        </div>
      </div>`;
    }

    const TRANS = [['', 'Select'], ['Manual', 'Manual'], ['Automatic', 'Automatic'], ['CVT', 'CVT'], ['Semi-Automatic', 'Semi-Automatic']];
    const FUELS = [['', 'Select'], ['Petrol', 'Petrol'], ['Diesel', 'Diesel'], ['Hybrid', 'Hybrid'], ['Electric', 'Electric']];
    const DRIVES= [['', 'Select'], ['FWD', 'FWD'], ['RWD', 'RWD'], ['4WD', '4WD'], ['AWD', 'AWD']];

    return `<div class="page active">
      ${H.innerTopbar('Edit Vehicle')}
      <div class="inner-content">
        <div style="font-size:14px;font-weight:600;color:#52525B;margin-bottom:16px">${esc(vName)}</div>

        <div style="font-size:13px;font-weight:700;color:#52525B;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Pricing</div>
        ${_priceField('evDaily',   'Daily Rate',           v.daily_rate)}
        ${_rowWrap(_priceField('evWeekly', 'Weekly Rate', v.weekly_rate), _priceField('evMonthly', 'Monthly Rate', v.monthly_rate))}
        ${_priceField('evDeposit', 'Security Deposit',     v.deposit)}
        ${_textField ('evMinDays', 'Minimum Rental Days',  '1', 'number', v.min_rental_days)}
        ${_priceField('evDriver',  'Driver Rate / Day',    v.driver_rate)}

        <div style="font-size:13px;font-weight:700;color:#52525B;text-transform:uppercase;letter-spacing:.4px;margin:16px 0 12px">Specs</div>
        ${_rowWrap(_selectField('evTrans', 'Transmission', TRANS, v.transmission), _selectField('evFuel', 'Fuel Type', FUELS, v.fuel_type))}
        ${_selectField('evDrive', 'Drive Type', DRIVES, v.drive_type)}
        ${_rowWrap(_textField('evSeats', 'Seats', '5', 'number', v.seats), _textField('evMile', 'Mileage (km)', '', 'number', v.mileage_km))}

        <div style="font-size:13px;font-weight:700;color:#52525B;text-transform:uppercase;letter-spacing:.4px;margin:16px 0 12px">Description</div>
        <textarea id="evDesc" rows="4" style="width:100%;border:1.5px solid #E4E4E7;border-radius:14px;padding:12px 14px;font-family:inherit;font-size:14px;color:#18181B;background:#fff;box-sizing:border-box;resize:vertical;margin-bottom:14px">${esc(v.description || '')}</textarea>

        <div style="font-size:13px;font-weight:700;color:#52525B;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Availability</div>
        <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #E4E4E7;border-radius:14px;padding:14px;margin-bottom:20px">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:#18181B">Mark as available</div>
            <div style="font-size:12px;color:#A1A1AA;margin-top:2px">Customers can see and enquire about this vehicle</div>
          </div>
          <input type="checkbox" id="evAvail" ${v.is_available ? 'checked' : ''} style="width:20px;height:20px;accent-color:#1A3A8F;cursor:pointer">
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn-sec" style="flex:1" onclick="H.goBack()">Cancel</button>
          <button class="btn-pri" style="flex:2" onclick="H._rentalBiz.saveEdit('${esc(id)}')">Save Changes</button>
        </div>
      </div>
    </div>`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Data loaders and action handlers
  // ─────────────────────────────────────────────────────────────────────────
  RB.loadCompanyData = async function (bizId) {
    if (RB._loadingCompany) return;
    RB._loadingCompany = true;
    const sb = window.supabase; if (!sb) { RB._loadingCompany = false; return; }
    RB._loading = true;
    try {
      // Search ALL businesses this user owns — the rental company may be
      // attached to a different business than the one passed in.
      const u = H.currentUser();
      const ownedIds = (H.state.businesses || [])
        .filter(b => u && b.ownerUserId === u.id).map(b => b.id);
      if (bizId && !ownedIds.includes(bizId)) ownedIds.push(bizId);

      const { data: rcRows, error } = await sb.from('rental_companies')
        .select('id,status,avg_rating,review_count,fleet_count,business_id')
        .in('business_id', ownedIds).limit(1);
      const rc = (rcRows && rcRows[0]) || null;

      if (!error && !rc) {
        RB.company = null; RB.fleet = []; RB.leads = [];
        RB._loading = false;
        const curPage = H.currentPageName;
        RB._loadingCompany = false;
        if (curPage === 'RentalDashboard' || curPage === 'RentalManageFleet') {
          H.openInner('RentalCompanySetup');
        }
        return;
      }
      if (error) throw error;

      // Use the business the company is actually attached to from here on
      bizId = rc.business_id;
      const bizRes = await sb.from('businesses').select('name').eq('id', bizId).single();

      RB.company = {
        id:           rc.id,
        business_id:  bizId,
        status:       rc.status,
        avg_rating:   rc.avg_rating,
        review_count: rc.review_count,
        fleet_count:  rc.fleet_count,
        company_name: bizRes.data && bizRes.data.name,
      };

      // If the access RPC failed or has not returned, derive access from the
      // company record so pages render instead of hanging on the skeleton
      if (!RB._access) RB._access = _accessFromStatus(rc.id, rc.status);

      const [fleetRes, leadsRes] = await Promise.all([
        sb.from('rental_vehicle_listings')
          .select('id,model,year,daily_rate,weekly_rate,monthly_rate,status,is_available,view_count,save_count,inquiry_count,brand_id,category_id')
          .eq('company_id', rc.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
        sb.from('rental_vehicle_leads')
          .select('id,listing_id,lead_source,status,created_at,user_id')
          .eq('company_id', rc.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const fleetRows = fleetRes.data || [];
      const brandIds  = [...new Set(fleetRows.map(v => v.brand_id).filter(Boolean))];
      let brandMap    = {};
      if (brandIds.length) {
        const brandRes = await sb.from('rental_brands').select('id,slug,label').in('id', brandIds);
        (brandRes.data || []).forEach(b => { brandMap[b.id] = b; });
      }

      const mediaRes = await sb.from('rental_vehicle_media').select('listing_id,url').eq('is_cover', true).in('listing_id', fleetRows.map(v => v.id));
      const coverMap = {};
      (mediaRes.data || []).forEach(m => { coverMap[m.listing_id] = m.url; });

      RB.fleet = fleetRows.map(v => ({
        ...v,
        brand_slug:  brandMap[v.brand_id] && brandMap[v.brand_id].slug,
        brand_label: brandMap[v.brand_id] && brandMap[v.brand_id].label,
        cover_url:   coverMap[v.id] || null,
      }));

      const userIds = [...new Set((leadsRes.data || []).map(l => l.user_id).filter(Boolean))];
      let nameMap   = {};
      if (userIds.length) {
        const nameRes = await sb.from('profiles').select('id,name').in('id', userIds);
        (nameRes.data || []).forEach(p => { nameMap[p.id] = p.name || 'Customer'; });
      }
      const vehicleNameMap = {};
      RB.fleet.forEach(v => { vehicleNameMap[v.id] = (v.brand_label || '') + ' ' + (v.model || ''); });

      RB.leads = (leadsRes.data || []).map(l => ({
        ...l,
        user_name:    nameMap[l.user_id],
        vehicle_name: vehicleNameMap[l.listing_id],
      }));
    } catch (e) {
      console.warn('rental biz load:', e);
      H.toast('Could not load rental data.', 4000, true);
    }
    RB._loading = false;
    // Flag stays true during renderPage so _after sees it and skips re-entry
    const curPage = H.currentPageName;
    if (curPage === 'RentalDashboard')        H.renderPage('RentalDashboard', {});
    if (curPage === 'RentalManageFleet')       H.renderPage('RentalManageFleet', { bizId });
    if (curPage === 'RentalBusinessAnalytics') H.renderPage('RentalBusinessAnalytics', { bizId });
    RB._loadingCompany = false;
  };

  RB.submitSetup = async function (bizId) {
    const sb = window.supabase; if (!sb) return;
    const bio   = document.getElementById('rcSetupBio')?.value?.trim()   || null;
    const phone = document.getElementById('rcSetupPhone')?.value?.trim() || null;
    const wa    = document.getElementById('rcSetupWA')?.value?.trim()    || null;
    const btn   = document.querySelector('.btn-pri');
    if (btn) { btn.disabled = true; btn.textContent = 'Setting up...'; }
    try {
      let sessionRes = await sb.auth.getSession();
      let token = sessionRes?.data?.session?.access_token;
      if (!token) {
        const refreshed = await sb.auth.refreshSession();
        token = refreshed?.data?.session?.access_token;
      }
      if (!token) {
        H.toast('Your session has expired. Please sign out and sign in again.', 5000, true);
        if (btn) { btn.disabled = false; btn.textContent = 'Activate Rental Portal'; }
        return;
      }
      const { data, error } = await sb.rpc('rental_setup_company', {
        p_business_id: bizId,
        p_bio:         bio,
        p_phone:       phone,
        p_whatsapp:    wa,
      });
      if (error) throw error;
      H.toast('Rental company set up! Pending admin approval.');
      RB.company = null;
      RB._access = null;   // force re-fetch on next dashboard entry
      H.openInner('RentalDashboard');
    } catch (e) {
      console.warn('rental setup:', e);
      H.toast('Setup failed. Please sign out, sign back in, and try again.', 5000, true);
      if (btn) { btn.disabled = false; btn.textContent = 'Activate Rental Portal'; }
    }
  };

  RB.toggleFleetStatus = async function (vehicleId, newStatus) {
    const sb = window.supabase; if (!sb) return;
    try {
      const { data, error } = await sb.from('rental_vehicle_listings').update({ status: newStatus }).eq('id', vehicleId).select('id');
      if (error) throw error;
      if (!data || !data.length) throw new Error('Update matched 0 rows — your company must be active to change a listing.');
      const v = RB.fleet.find(x => x.id === vehicleId);
      if (v) v.status = newStatus;
      H.renderPage('RentalManageFleet', { bizId: RB.company && RB.company.business_id });
      H.toast(newStatus === 'active' ? 'Vehicle activated.' : 'Vehicle paused.');
    } catch (e) {
      if (e && e.code === '42501') H.toast('Access denied. Your company account is not active.', 4000, true);
      else H.toast((e && e.message) ? e.message : 'Could not update status.', 4000, true);
    }
  };

  RB.removeVehicle = function (vehicleId) {
    H.modal({
      title: 'Remove this vehicle?',
      body:  '<div style="font-size:13px;color:#52525B;line-height:1.6">This will archive the vehicle and hide it from the marketplace. Your listing history and analytics are preserved.</div>',
      confirmText: 'Remove',
      danger: true,
      onConfirm: async () => {
        const sb = window.supabase; if (!sb) return;
        try {
          const { data, error } = await sb.from('rental_vehicle_listings').update({ status: 'archived', deleted_at: new Date().toISOString() }).eq('id', vehicleId).select('id');
          if (error) throw error;
          if (!data || !data.length) throw new Error('Update matched 0 rows — your company must be active to remove a listing.');
          RB.fleet = RB.fleet.filter(v => v.id !== vehicleId);
          H.renderPage('RentalManageFleet', { bizId: RB.company && RB.company.business_id });
          H.toast('Vehicle removed.');
        } catch (e) {
          if (e && e.code === '42501') H.toast('Access denied. Your company account is not active.', 4000, true);
          else H.toast((e && e.message) ? e.message : 'Could not remove vehicle.', 4000, true);
        }
      },
    });
  };

  RB.saveEdit = async function (vehicleId) {
    const sb = window.supabase; if (!sb) return;
    const btn = document.querySelector('.btn-pri');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
      const listingUpdate = {
        daily_rate:      parseFloat(document.getElementById('evDaily')?.value)   || null,
        weekly_rate:     parseFloat(document.getElementById('evWeekly')?.value)  || null,
        monthly_rate:    parseFloat(document.getElementById('evMonthly')?.value) || null,
        deposit:         parseFloat(document.getElementById('evDeposit')?.value) || null,
        min_rental_days: parseInt(document.getElementById('evMinDays')?.value)   || 1,
        driver_rate:     parseFloat(document.getElementById('evDriver')?.value)  || null,
        description:     document.getElementById('evDesc')?.value?.trim()        || null,
        is_available:    document.getElementById('evAvail')?.checked             || false,
      };
      if (!listingUpdate.daily_rate || listingUpdate.daily_rate <= 0) {
        H.toast('Daily rate is required.');
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        return;
      }
      const specsUpdate = {
        transmission: document.getElementById('evTrans')?.value || null,
        fuel_type:    document.getElementById('evFuel')?.value  || null,
        drive_type:   document.getElementById('evDrive')?.value || null,
        seats:        parseInt(document.getElementById('evSeats')?.value) || null,
        mileage_km:   parseInt(document.getElementById('evMile')?.value)  || null,
      };
      const [lstRes] = await Promise.all([
        sb.from('rental_vehicle_listings').update(listingUpdate).eq('id', vehicleId).select('id'),
        sb.from('rental_vehicle_specs').upsert({ listing_id: vehicleId, ...specsUpdate }, { onConflict: 'listing_id' }),
      ]);
      if (lstRes.error) throw lstRes.error;
      if (!lstRes.data || !lstRes.data.length) {
        throw new Error('Update matched 0 rows — your company must be active to edit vehicles.');
      }
      const v = RB.fleet.find(x => x.id === vehicleId);
      if (v) Object.assign(v, listingUpdate, specsUpdate);
      if (H._rental && H._rental.detailCache) delete H._rental.detailCache[vehicleId];
      H.toast('Vehicle updated.');
      H.goBack();
    } catch (e) {
      console.warn('rental edit:', e);
      if (e && e.code === '42501') H.toast('Access denied. Your company account is not active.', 4000, true);
      else H.toast((e && e.message) ? e.message : 'Could not save changes.', 4000, true);
      if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
    }
  };

  RB.loadAvailability = async function (vehicleId) {
    const sb = window.supabase; if (!sb) return;
    try {
      const { data, error } = await sb.from('rental_vehicle_availability').select('id,starts_on,ends_on,reason').eq('listing_id', vehicleId).order('starts_on');
      if (error) throw error;
      RB._availBlocks = RB._availBlocks || {};
      RB._availBlocks[vehicleId] = data || [];
      if (H.currentPageName === 'RentalAvailability') H.renderPage('RentalAvailability', { id: vehicleId });
    } catch (e) { }
  };

  RB.addBlock = async function (vehicleId) {
    const sb     = window.supabase; if (!sb) return;
    const starts = document.getElementById('avlStart')?.value;
    const ends   = document.getElementById('avlEnd')?.value;
    const reason = document.getElementById('avlReason')?.value?.trim() || null;
    if (!starts || !ends) { H.toast('Please enter both start and end dates.'); return; }
    if (starts > ends)    { H.toast('Start date must be before end date.'); return; }
    try {
      await sb.from('rental_vehicle_availability').insert({ listing_id: vehicleId, starts_on: starts, ends_on: ends, reason });
      H.toast('Dates blocked.');
      RB.loadAvailability(vehicleId);
    } catch (e) {
      if (e.code === 'P0001') H.toast('Those dates overlap an existing blocked period.', 4000, true);
      else if (e.code === '42501') H.toast('Access denied. Your company account is not active.', 4000, true);
      else H.toast('Could not block dates.', 4000, true);
    }
  };

  RB.removeBlock = async function (vehicleId, blockId) {
    const sb = window.supabase; if (!sb) return;
    try {
      await sb.from('rental_vehicle_availability').delete().eq('id', blockId);
      H.toast('Dates unblocked.');
      RB.loadAvailability(vehicleId);
    } catch (e) { H.toast('Could not remove block.', 4000, true); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Image Upload Pipeline
  // ─────────────────────────────────────────────────────────────────────────
  RB.uploadMedia = async function (listingId, file, isCover) {
    const sb = window.supabase; if (!sb) return;
    const u  = H.currentUser(); if (!u) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!ALLOWED.includes(file.type)) { H.toast('Only JPEG, PNG, WebP, or HEIC images allowed.', 4000, true); return; }
    if (file.size > 8 * 1024 * 1024) { H.toast('Image must be under 8 MB.', 4000, true); return; }
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `${u.id}/${listingId}/${Date.now()}.${ext}`;
    try {
      const { error: upErr } = await sb.storage.from('rental-media').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await sb.storage.from('rental-media').createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed && signed.signedUrl;
      if (!url) throw new Error('Could not get image URL');
      const { count } = await sb.from('rental_vehicle_media').select('id', { count: 'exact', head: true }).eq('listing_id', listingId);
      const willBeCover = isCover || count === 0;
      if (willBeCover) {
        await sb.from('rental_vehicle_media').update({ is_cover: false }).eq('listing_id', listingId).eq('is_cover', true);
      }
      await sb.from('rental_vehicle_media').insert({ listing_id: listingId, url, storage_path: path, is_cover: willBeCover, sort_order: count || 0 });
      if (willBeCover) {
        const v = RB.fleet.find(x => x.id === listingId);
        if (v) v.cover_url = url;
      }
      return { url, path };
    } catch (e) {
      console.warn('rental upload:', e);
      if (e.statusCode === 409) H.toast('File already exists. Please try again.', 4000, true);
      else if (e.code === '42501') H.toast('Access denied. Your company account is not active.', 4000, true);
      else H.toast('Upload failed: ' + (e.message || 'Unknown error'), 4000, true);
      return null;
    }
  };

  RB.handlePhotoUpload = async function (listingId, input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const result = await RB.uploadMedia(listingId, file, false);
    if (result) H.toast('Photo uploaded.');
    input.value = '';
    if (H.currentPageName === 'RentalManageFleet') {
      H.renderPage('RentalManageFleet', { bizId: RB.company && RB.company.business_id });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Analytics RPC
  // ─────────────────────────────────────────────────────────────────────────
  RB._analytics   = null;
  RB._analyticsId = null;

  RB.loadAnalytics = async function (companyId) {
    const sb = window.supabase; if (!sb) return;
    try {
      const { data, error } = await sb.rpc('rental_business_analytics', { p_company_id: companyId });
      if (error) throw error;
      RB._analytics   = data;
      RB._analyticsId = companyId;
    } catch (e) {
      console.warn('rental analytics rpc:', e);
      RB._analytics = null;
    }
    if (H.currentPageName === 'RentalBusinessAnalytics') {
      H.renderPage('RentalBusinessAnalytics', { bizId: RB.company && RB.company.business_id });
    }
  };

  window.RB = RB;

})(window.H);
