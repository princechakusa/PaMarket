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

  // ── Shared business-side rental state ────────────────────────────────────
  H._rentalBiz = H._rentalBiz || {};
  const RB = H._rentalBiz;
  RB.company    = RB.company    || null;
  RB.fleet      = RB.fleet      || [];
  RB.leads      = RB.leads      || [];
  RB._loading   = false;
  RB._wizState  = null;

  // ── Wizard steps config ──────────────────────────────────────────────────
  const WIZARD_STEPS = ['Details', 'Pricing', 'Specs', 'Photos'];

  function _wizStepBar(current) {
    return `<div style="display:flex;align-items:center;padding:0 16px;margin-bottom:20px">
      ${WIZARD_STEPS.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        const dot     = done
          ? `<span style="width:24px;height:24px;border-radius:50%;background:#1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>`
          : `<span style="width:24px;height:24px;border-radius:50%;background:${active ? '#1A3A8F' : '#E8ECF4'};color:${active ? '#fff' : '#94A3B8'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">${i+1}</span>`;
        const line    = i < WIZARD_STEPS.length - 1
          ? `<div style="flex:1;height:2px;background:${done ? '#1A3A8F' : '#E8ECF4'}"></div>`
          : '';
        return `${dot}${line}`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;padding:0 4px;margin-bottom:8px">
      ${WIZARD_STEPS.map((s, i) => `<div style="font-size:10.5px;font-weight:${i===current?'700':'500'};color:${i===current?'#1A3A8F':'var(--sub)'};text-align:center;flex:1">${s}</div>`).join('')}
    </div>`;
  }

  function _textField(id, label, placeholder, type, val) {
    return `<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">${label}</label><input id="${id}" type="${type || 'text'}" placeholder="${esc(placeholder || '')}" value="${esc(val || '')}" autocomplete="off" style="width:100%;padding:12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:14px;background:var(--card,#fff);color:var(--text);font-family:inherit;box-sizing:border-box" oninput="RB._wizStateChanged()"></div>`;
  }

  function _selectField(id, label, opts, val) {
    const options = opts.map(([v,l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">${label}</label><select id="${id}" style="width:100%;padding:12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:14px;background:var(--card,#fff);color:var(--text);font-family:inherit;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px">${options}</select></div>`;
  }

  function _priceField(id, label, val) {
    return `<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">${label}</label><div style="position:relative"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;font-weight:700;color:var(--sub)">$</span><input id="${id}" type="number" min="0" step="1" value="${val || ''}" placeholder="0" style="width:100%;padding:12px 12px 12px 26px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:14px;background:var(--card,#fff);color:var(--text);font-family:inherit;box-sizing:border-box"></div></div>`;
  }

  // ── Guard: ensure user has a business ────────────────────────────────────
  function _requireBiz() {
    const u = H.currentUser();
    if (!u) { H.requireAuth('Sign in to manage your rental business'); return null; }
    const biz = (H.state.businesses || []).find(b => b.ownerUserId === u.id);
    return biz || null;
  }

  // ── Status badge ─────────────────────────────────────────────────────────
  function _statusPill(s) {
    const m = { active:['#166534','#DCFCE7','Active'], paused:['#92400E','#FEF3C7','Paused'], draft:['#475569','#E2E8F0','Draft'], archived:['#6B7280','#F3F4F6','Archived'] };
    const c = m[s] || m.draft;
    return `<span style="font-size:10px;font-weight:800;color:${c[0]};background:${c[1]};border-radius:20px;padding:2px 8px">${c[2]}</span>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalCompanySetup — first-time rental company registration
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalCompanySetup = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Rental Setup')}${H.emptyState('Business required', 'Register a business first to use the rentals module.', 'Register Business', "H.openInner('BusinessOnboarding')")}</div>`;

    return `<div class="page active">
      ${H.innerTopbar('Set Up Rental Company')}
      <div class="inner-content">
        <div style="background:#EEF2FB;border-radius:14px;padding:16px;margin-bottom:20px">
          <div style="font-size:15px;font-weight:800;color:#1A3A8F;margin-bottom:6px">Activate Vehicle Rentals</div>
          <div style="font-size:13px;color:#475569;line-height:1.6">Connect your business to the PaMarket rental marketplace. Customers will be able to browse your fleet and contact you directly.</div>
        </div>
        ${_textField('rcSetupBio', 'Company description', 'Tell customers about your rental services, coverage areas, and fleet...', 'text', '')}
        ${_textField('rcSetupPhone', 'Contact phone', '+263 77 000 0000', 'tel', biz.phone || '')}
        ${_textField('rcSetupWA', 'WhatsApp number', '+263 77 000 0000', 'tel', biz.phone || '')}
        <button class="btn-pri" style="width:100%;margin-top:8px" onclick="H._rentalBiz.submitSetup('${esc(biz.id)}')">Activate Rental Portal</button>
      </div>
    </div>`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalDashboard — main business rental hub
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalDashboard = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Rentals')}${H.emptyState('Business account required', 'Register a business to manage rental vehicles.', 'Register Business', "H.openInner('BusinessOnboarding')")}</div>`;

    if (!RB.company) {
      return `<div class="page active" id="rentalDashPage">
        ${H.innerTopbar('Rental Dashboard')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">
          ${Array(4).fill('<div class="skel" style="height:80px;border-radius:14px"></div>').join('')}
        </div>
      </div>`;
    }

    const rc    = RB.company;
    const fleet = RB.fleet;
    const leads = RB.leads;
    const active   = fleet.filter(v => v.status === 'active').length;
    const avail    = fleet.filter(v => v.is_available).length;
    const paused   = fleet.filter(v => v.status === 'paused').length;
    const newLeads = leads.filter(l => l.status === 'new').length;
    const avgRating= rc.avg_rating ? Number(rc.avg_rating).toFixed(1) : '—';

    const statCard = (val, label, sub) => `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px">
      <div style="font-size:24px;font-weight:800;color:#1A3A8F">${val}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:2px">${label}</div>
      ${sub ? `<div style="font-size:11px;color:var(--sub);margin-top:2px">${sub}</div>` : ''}
    </div>`;

    const recentLeads = leads.slice(0, 5).map(l => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border,#E8ECF4)">
      <div style="width:36px;height:36px;border-radius:50%;background:#EEF2FB;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#1A3A8F;flex-shrink:0">${esc((l.user_name || '?').charAt(0).toUpperCase())}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.user_name || 'Customer')}</div>
        <div style="font-size:12px;color:var(--sub)">${esc(l.vehicle_name || '')} · ${esc(l.lead_source || 'inquiry')}</div>
      </div>
      <span style="font-size:10px;font-weight:800;${l.status === 'new' ? 'color:#1A3A8F;background:#EEF2FB' : 'color:#6B7280;background:#F3F4F6'};border-radius:20px;padding:2px 8px">${esc(l.status || 'new')}</span>
    </div>`).join('');

    const quickActions = [
      ['Add Vehicle', `H.openInner('RentalAddVehicle',{bizId:'${esc(biz.id)}'})`, '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'],
      ['Manage Fleet', `H.openInner('RentalManageFleet',{bizId:'${esc(biz.id)}'})`, '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M7 17h10"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>'],
      ['Analytics', `H.openInner('RentalBusinessAnalytics',{bizId:'${esc(biz.id)}'})`, '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'],
    ].map(([label, onclick, icon]) => `<button onclick="${onclick}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:14px 8px;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;cursor:pointer;font-family:inherit;color:var(--text)">
      <span style="color:#1A3A8F">${icon}</span>
      <span style="font-size:12px;font-weight:700">${label}</span>
    </button>`).join('');

    return `<div class="page active" id="rentalDashPage">
      ${H.innerTopbar('Rental Dashboard')}
      <div class="inner-content">
        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#1A3A8F 100%);border-radius:16px;padding:16px;margin-bottom:16px;color:#fff">
          <div style="font-size:13px;font-weight:600;opacity:.8;margin-bottom:4px">${esc(biz.name)}</div>
          <div style="font-size:22px;font-weight:800">${esc(rc.company_name || biz.name)}</div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:10px;font-size:13px;opacity:.9">
            <span>${rc.fleet_count || 0} vehicles</span>
            <span style="opacity:.4">|</span>
            <span>${avgRating} rating</span>
            ${rc.status !== 'active' ? `<span style="background:rgba(255,255,255,.2);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">${esc(rc.status)}</span>` : ''}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          ${statCard(active,   'Active Vehicles', avail + ' available')}
          ${statCard(paused,   'Paused', 'Not visible to customers')}
          ${statCard(newLeads, 'New Inquiries', leads.length + ' total')}
          ${statCard(avgRating,'Rating', rc.review_count + ' reviews')}
        </div>

        <div style="display:flex;gap:10px;margin-bottom:20px">${quickActions}</div>

        ${leads.length ? `<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:10px">Recent Inquiries</div>
          <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:0 14px">
            ${recentLeads}
          </div>` : ''}
      </div>
    </div>`;
  };

  H.pages.RentalDashboard_after = function (params) {
    const biz = _requireBiz();
    if (!biz) return;
    if (!RB.company) RB.loadCompanyData(biz.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalManageFleet
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalManageFleet = function (params) {
    const bizId = params && params.bizId;
    const biz   = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Fleet')}${H.emptyState('Business required', '')}</div>`;

    const fleet = RB.fleet;

    if (!fleet.length && RB._loading) {
      return `<div class="page active" id="rentalFleetPage">
        ${H.innerTopbar('Manage Fleet')}
        <div style="display:flex;flex-direction:column;gap:10px;padding:16px">${Array(4).fill('<div class="skel" style="height:90px;border-radius:14px"></div>').join('')}</div>
      </div>`;
    }

    const vehicleRow = (v) => {
      const img = v.cover_url
        ? `<img src="${esc(v.cover_url)}" style="width:100%;height:100%;object-fit:cover">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94A3B8"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2M7 17h10"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg></div>`;
      const isActive = v.status === 'active';
      return `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:12px;display:flex;gap:12px;align-items:flex-start">
        <div style="width:64px;height:56px;border-radius:10px;background:#EEF2FB;overflow:hidden;flex-shrink:0">${img}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div>
              <div style="font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${esc((v.brand_label || '') + ' ' + (v.model || ''))} <span style="font-weight:500;color:var(--sub)">${v.year || ''}</span></div>
              <div style="font-size:13px;font-weight:700;color:#1A3A8F;margin-top:2px">$${fmt(v.daily_rate)}/day</div>
            </div>
            ${_statusPill(v.status)}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button onclick="H.openInner('RentalEditVehicle',{id:'${esc(v.id)}',bizId:'${esc(biz.id)}'})" style="padding:7px 12px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">Edit</button>
            <button onclick="H._rentalBiz.toggleFleetStatus('${esc(v.id)}','${isActive ? 'paused' : 'active'}')" style="padding:7px 12px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">${isActive ? 'Pause' : 'Activate'}</button>
            <label style="padding:7px 12px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;display:inline-flex;align-items:center;gap:5px">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" style="display:none" onchange="H._rentalBiz.handlePhotoUpload('${esc(v.id)}',this)">
            </label>
            <button onclick="H.openInner('RentalAvailability',{id:'${esc(v.id)}',bizId:'${esc(biz.id)}'})" style="padding:7px 12px;border-radius:9px;border:1px solid var(--border,#E8ECF4);background:var(--card,#fff);font-size:12px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit">Dates</button>
            <button onclick="H._rentalBiz.removeVehicle('${esc(v.id)}')" style="padding:7px 12px;border-radius:9px;border:1px solid #FECACA;background:#FFF1F0;font-size:12px;font-weight:700;color:#EF4444;cursor:pointer;font-family:inherit">Remove</button>
          </div>
        </div>
      </div>`;
    };

    return `<div class="page active" id="rentalFleetPage">
      ${H.innerTopbar('Manage Fleet')}
      <div class="inner-content">
        <button onclick="H.openInner('RentalAddVehicle',{bizId:'${esc(biz.id)}'})" class="btn-pri" style="width:100%;margin-bottom:16px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Vehicle
        </button>
        ${fleet.length
          ? `<div style="display:flex;flex-direction:column;gap:10px">${fleet.map(vehicleRow).join('')}</div>`
          : H.emptyState('No vehicles in fleet', 'Add your first vehicle to start renting.', 'Add Vehicle', `H.openInner('RentalAddVehicle',{bizId:'${esc(biz.id)}'})`)}
      </div>
    </div>`;
  };

  H.pages.RentalManageFleet_after = function (params) {
    const biz = _requireBiz();
    if (!biz) return;
    if (!RB.company || !RB.fleet.length) RB.loadCompanyData(biz.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalAddVehicle (4-step wizard)
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalAddVehicle = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Add Vehicle')}${H.emptyState('Business required', '')}</div>`;
    if (!RB._wizState) { RB._wizState = { step: 0, data: {}, bizId: params && params.bizId || biz.id }; }
    return RB._renderWizStep(RB._wizState.step);
  };

  H.pages.RentalAddVehicle_after = function () { window.RB = RB; };

  RB._renderWizStep = function (step) {
    const d    = (RB._wizState && RB._wizState.data) || {};
    const bizId= (RB._wizState && RB._wizState.bizId) || '';

    const BRANDS = [['','Select brand'],['toyota','Toyota'],['honda','Honda'],['nissan','Nissan'],['mercedes','Mercedes-Benz'],['bmw','BMW'],['ford','Ford'],['isuzu','Isuzu'],['hyundai','Hyundai'],['kia','Kia'],['vw','Volkswagen'],['mitsubishi','Mitsubishi'],['suzuki','Suzuki'],['mazda','Mazda'],['other','Other']];
    const CATS   = [['','Select category'],['suv','SUV'],['sedan','Sedan'],['pickup','Pickup'],['minibus','Minibus'],['luxury','Luxury'],['bus','Bus'],['motorbike','Motorbike'],['other','Other']];
    const CITIES = [['','Select city'],['harare','Harare'],['bulawayo','Bulawayo'],['mutare','Mutare'],['gweru','Gweru'],['masvingo','Masvingo'],['victoria-falls','Victoria Falls'],['kwekwe','Kwekwe'],['kadoma','Kadoma'],['chinhoyi','Chinhoyi']];
    const TRANS  = [['','Select'],['Manual','Manual'],['Automatic','Automatic'],['CVT','CVT'],['Semi-Automatic','Semi-Automatic']];
    const FUELS  = [['','Select'],['Petrol','Petrol'],['Diesel','Diesel'],['Hybrid','Hybrid'],['Electric','Electric']];
    const DRIVES = [['','Select'],['FWD','Front Wheel Drive'],['RWD','Rear Wheel Drive'],['4WD','4WD / AWD']];

    let body = '';
    if (step === 0) {
      body = _selectField('avBrand',  'Brand',    BRANDS, d.brand_slug)
           + _selectField('avCat',    'Category', CATS,   d.category_slug)
           + _textField  ('avModel',  'Model',    'e.g. Hilux, Vitz, Actros', 'text', d.model)
           + _textField  ('avYear',   'Year',     'e.g. 2022', 'number', d.year)
           + _selectField('avCity',   'City',     CITIES, d.city_slug);
    } else if (step === 1) {
      body = _priceField('avDaily',   'Daily rate (USD)',   d.daily_rate)
           + _priceField('avWeekly',  'Weekly rate (USD)',  d.weekly_rate)
           + _priceField('avMonthly', 'Monthly rate (USD)', d.monthly_rate)
           + _priceField('avDeposit', 'Security deposit',   d.deposit)
           + _textField ('avMinDays', 'Minimum rental days', '1', 'number', d.min_rental_days)
           + _priceField('avDriver',  'Driver rate/day (0 = self-drive only)', d.driver_rate);
    } else if (step === 2) {
      body = _selectField('avTrans', 'Transmission', TRANS, d.transmission)
           + _selectField('avFuel',  'Fuel type',    FUELS, d.fuel_type)
           + _selectField('avDrive', 'Drive type',   DRIVES, d.drive_type)
           + _textField  ('avSeats', 'Seats',        '5', 'number', d.seats)
           + _textField  ('avMile',  'Mileage (km)', '50000', 'number', d.mileage_km)
           + _textField  ('avEngine','Engine (cc)',  '2000', 'number', d.engine_capacity);
    } else if (step === 3) {
      body = `<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">Description</label><textarea id="avDesc" rows="4" placeholder="Describe the vehicle condition, included accessories, rental terms..." style="width:100%;padding:12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:14px;background:var(--card,#fff);color:var(--text);font-family:inherit;box-sizing:border-box;resize:vertical">${esc(d.description || '')}</textarea></div>
      <div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--sub);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">Features (one per line)</label><textarea id="avFeatures" rows="4" placeholder="Air conditioning\nBluetooth\nCruise control\nGPS navigation" style="width:100%;padding:12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:14px;background:var(--card,#fff);color:var(--text);font-family:inherit;box-sizing:border-box;resize:vertical">${esc((d.features || []).join('\n'))}</textarea></div>
      <div style="background:#EEF2FB;border-radius:12px;padding:14px;font-size:13px;color:#1A3A8F;line-height:1.5"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Vehicle photos can be uploaded after creation from the fleet management screen.</div>`;
    }

    const isLast = step === WIZARD_STEPS.length - 1;
    return `<div class="page active">
      ${H.innerTopbar('Add Vehicle')}
      <div class="inner-content">
        ${_wizStepBar(step)}
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:16px">${WIZARD_STEPS[step]}</div>
        ${body}
        <div style="display:flex;gap:10px;margin-top:16px">
          ${step > 0 ? `<button class="btn-sec" style="flex:1" onclick="H._rentalBiz._wizBack()">Back</button>` : `<button class="btn-sec" style="flex:1" onclick="H.goBack()">Cancel</button>`}
          <button class="btn-pri" style="flex:2" onclick="H._rentalBiz._wizNext(${step})">${isLast ? 'Create Vehicle' : 'Continue'}</button>
        </div>
      </div>
    </div>`;
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
      d.brand_slug    = document.getElementById('avBrand')?.value;
      d.category_slug = document.getElementById('avCat')?.value;
      d.model         = document.getElementById('avModel')?.value?.trim();
      d.year          = parseInt(document.getElementById('avYear')?.value) || null;
      d.city_slug     = document.getElementById('avCity')?.value;
      if (!d.brand_slug || !d.category_slug || !d.model || !d.city_slug) { H.toast('Please fill in all required fields.'); return; }
      if (d.year && (d.year < 1980 || d.year > new Date().getFullYear() + 1)) { H.toast('Please enter a valid year.'); return; }
    } else if (step === 1) {
      d.daily_rate    = parseFloat(document.getElementById('avDaily')?.value) || null;
      d.weekly_rate   = parseFloat(document.getElementById('avWeekly')?.value) || null;
      d.monthly_rate  = parseFloat(document.getElementById('avMonthly')?.value) || null;
      d.deposit       = parseFloat(document.getElementById('avDeposit')?.value) || null;
      d.min_rental_days= parseInt(document.getElementById('avMinDays')?.value) || 1;
      d.driver_rate   = parseFloat(document.getElementById('avDriver')?.value) || null;
      if (!d.daily_rate || d.daily_rate <= 0) { H.toast('Please enter a daily rate.'); return; }
    } else if (step === 2) {
      d.transmission  = document.getElementById('avTrans')?.value || null;
      d.fuel_type     = document.getElementById('avFuel')?.value  || null;
      d.drive_type    = document.getElementById('avDrive')?.value || null;
      d.seats         = parseInt(document.getElementById('avSeats')?.value) || null;
      d.mileage_km    = parseInt(document.getElementById('avMile')?.value) || null;
      d.engine_capacity= parseInt(document.getElementById('avEngine')?.value) || null;
      if (!d.transmission || !d.fuel_type) { H.toast('Please select transmission and fuel type.'); return; }
    } else if (step === 3) {
      d.description = document.getElementById('avDesc')?.value?.trim() || null;
      d.features    = (document.getElementById('avFeatures')?.value || '').split('\n').map(f => f.trim()).filter(Boolean);
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

    const btn = document.querySelector('.btn-pri');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

    try {
      const [catRes, brandRes, locRes, compRes] = await Promise.all([
        sb.from('rental_categories').select('id').eq('slug', d.category_slug).single(),
        sb.from('rental_brands').select('id').eq('slug', d.brand_slug).single(),
        sb.from('rental_locations').select('id').eq('slug', d.city_slug).single(),
        sb.from('rental_companies').select('id').eq('business_id', biz.id).single(),
      ]);

      if (catRes.error || brandRes.error || !compRes.data) {
        if (!compRes.data) { H.toast('Rental company not set up. Please complete setup first.', 5000, true); H.openInner('RentalCompanySetup'); return; }
        throw catRes.error || brandRes.error;
      }

      const listingPayload = {
        company_id:     compRes.data.id,
        category_id:    catRes.data.id,
        brand_id:       brandRes.data.id,
        location_id:    locRes.data ? locRes.data.id : null,
        model:          d.model,
        year:           d.year,
        daily_rate:     d.daily_rate,
        weekly_rate:    d.weekly_rate || null,
        monthly_rate:   d.monthly_rate || null,
        deposit:        d.deposit || null,
        min_rental_days:d.min_rental_days || 1,
        driver_rate:    d.driver_rate || null,
        description:    d.description || null,
        status:         'active',
        admin_status:   'pending_review',
        is_available:   true,
      };

      const { data: listing, error: lstErr } = await sb.from('rental_vehicle_listings').insert(listingPayload).select('id').single();
      if (lstErr) throw lstErr;

      const specsPayload = {
        listing_id:     listing.id,
        transmission:   d.transmission || null,
        fuel_type:      d.fuel_type    || null,
        drive_type:     d.drive_type   || null,
        seats:          d.seats        || null,
        mileage_km:     d.mileage_km   || null,
        engine_capacity:d.engine_capacity || null,
      };
      await sb.from('rental_vehicle_specs').insert(specsPayload);

      if (d.features && d.features.length) {
        await sb.from('rental_vehicle_features').insert(d.features.map(f => ({ listing_id: listing.id, feature: f })));
      }

      RB._wizState = null;
      RB.fleet = [];
      H.toast('Vehicle created! It will appear in the marketplace once approved.');
      H.openInner('RentalManageFleet', { bizId: biz.id });
    } catch (e) {
      console.warn('vehicle create:', e);
      H.toast('Could not create vehicle. Check your details and try again.', 5000, true);
      if (btn) { btn.disabled = false; btn.textContent = 'Create Vehicle'; }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalAvailability — block dates for a vehicle
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalAvailability = function (params) {
    const id    = params && params.id;
    const bizId = params && params.bizId;
    const v     = RB.fleet.find(x => x.id === id) || {};
    const blocks= (RB._availBlocks && RB._availBlocks[id]) || [];

    const blockRows = blocks.map(b => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border,#E8ECF4)">
      <div><div style="font-size:13px;font-weight:700;color:var(--text)">${esc(b.starts_on)} → ${esc(b.ends_on)}</div><div style="font-size:12px;color:var(--sub);margin-top:2px">${esc(b.reason || 'Blocked')}</div></div>
      <button onclick="H._rentalBiz.removeBlock('${esc(id)}','${esc(b.id)}')" style="background:#FFF1F0;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;color:#EF4444;cursor:pointer;font-family:inherit">Remove</button>
    </div>`).join('');

    return `<div class="page active">
      ${H.innerTopbar('Availability — ' + esc((v.brand_label || '') + ' ' + (v.model || '')))}
      <div class="inner-content">
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Block Date Range</div>
          ${_textField('avlStart', 'Start date', 'YYYY-MM-DD', 'date', '')}
          ${_textField('avlEnd',   'End date',   'YYYY-MM-DD', 'date', '')}
          ${_textField('avlReason','Reason',     'Maintenance, Booked, etc.', 'text', '')}
          <button onclick="H._rentalBiz.addBlock('${esc(id)}')" class="btn-pri" style="width:100%;margin-top:4px">Block These Dates</button>
        </div>
        ${blocks.length
          ? `<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:8px">Blocked Periods</div>
             <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:0 14px">${blockRows}</div>`
          : `<div style="text-align:center;color:var(--sub);font-size:13px;padding:20px 0">No blocked dates</div>`}
      </div>
    </div>`;
  };

  H.pages.RentalAvailability_after = function (params) {
    const id = params && params.id;
    if (id) RB.loadAvailability(id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalBusinessAnalytics
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalBusinessAnalytics = function (params) {
    const biz = _requireBiz();
    if (!biz) return `<div class="page active">${H.innerTopbar('Analytics')}${H.emptyState('Business required', '')}</div>`;

    const rc  = RB.company || {};
    const a   = RB._analytics;   // from rental_business_analytics RPC

    const statCard = (val, label, sub) => `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:#1A3A8F">${val}</div>
      <div style="font-size:11.5px;font-weight:600;color:var(--sub);margin-top:3px">${label}</div>
      ${sub ? `<div style="font-size:10.5px;color:var(--sub);margin-top:1px">${sub}</div>` : ''}
    </div>`;

    // Fallback: compute from fleet cache while RPC loads
    const fleet = RB.fleet;
    const totalViews     = a ? a.views_30d      : fleet.reduce((n, v) => n + (v.view_count || 0), 0);
    const totalInquiries = a ? (a.chats_30d + a.whatsapp_30d + a.calls_30d) : fleet.reduce((n, v) => n + (v.inquiry_count || 0), 0);
    const totalSaves     = a ? a.saves_30d      : fleet.reduce((n, v) => n + (v.save_count || 0), 0);
    const convRate       = totalViews ? Math.round((totalInquiries / totalViews) * 100) : 0;
    const period         = a ? '30d' : 'all time';

    const topByViews = fleet.slice().sort((x,y)=>(y.view_count||0)-(x.view_count||0)).slice(0,5);
    const maxV = Math.max(1, ...(topByViews.map(v=>v.view_count||0)));
    const barRows = topByViews.map(v => {
      const pct = Math.round(((v.view_count||0)/maxV)*100);
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">${esc((v.brand_label||'') + ' ' + (v.model||''))}</span>
          <span style="color:var(--sub)">${fmt(v.view_count||0)}</span>
        </div>
        <div style="background:#EEF2FB;border-radius:4px;height:8px;overflow:hidden"><div style="background:#1A3A8F;height:100%;border-radius:4px;width:${pct}%"></div></div>
      </div>`;
    }).join('');

    return `<div class="page active">
      ${H.innerTopbar('Analytics')}
      <div class="inner-content">
        ${!a ? `<div style="background:#EEF2FB;border-radius:10px;padding:10px 14px;font-size:12px;color:#1A3A8F;margin-bottom:12px">Loading 30-day analytics…</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          ${statCard(fmt(totalViews),     'Views',     period)}
          ${statCard(fmt(totalInquiries), 'Inquiries', period)}
          ${statCard(fmt(totalSaves),     'Saves',     period)}
          ${statCard(convRate + '%',      'Conversion', 'Inquiry/View')}
        </div>
        ${a ? `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:14px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Channel Breakdown (30d)</div>
          ${[['chat_open','In-app Chat',a.chats_30d],['whatsapp','WhatsApp',a.whatsapp_30d],['call','Phone Call',a.calls_30d]].map(([,label,val])=>`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.04)">
            <span style="font-size:13px;color:var(--sub)">${label}</span>
            <span style="font-size:13px;font-weight:700;color:var(--text)">${fmt(val||0)}</span>
          </div>`).join('')}
        </div>` : ''}
        ${topByViews.length ? `<div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:14px">Top Vehicles by Views</div>
          ${barRows}
        </div>` : ''}
        <div style="background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:14px;padding:16px">
          <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:4px">Rating</div>
          <div style="font-size:32px;font-weight:800;color:#1A3A8F">${rc.avg_rating ? Number(rc.avg_rating).toFixed(1) : '—'}</div>
          <div style="font-size:13px;color:var(--sub)">from ${fmt(rc.review_count || 0)} review${(rc.review_count||0)===1?'':'s'}</div>
        </div>
      </div>
    </div>`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: RentalEditVehicle — edit existing vehicle
  // ─────────────────────────────────────────────────────────────────────────
  H.pages.RentalEditVehicle = function (params) {
    const id    = params && params.id;
    const bizId = params && params.bizId;
    const v     = RB.fleet.find(x => x.id === id) || {};

    const TRANS = [['','Select'],['Manual','Manual'],['Automatic','Automatic'],['CVT','CVT'],['Semi-Automatic','Semi-Automatic']];
    const FUELS = [['','Select'],['Petrol','Petrol'],['Diesel','Diesel'],['Hybrid','Hybrid'],['Electric','Electric']];
    const DRIVES= [['','Select'],['FWD','FWD'],['RWD','RWD'],['4WD','4WD / AWD']];

    return `<div class="page active">
      ${H.innerTopbar('Edit Vehicle')}
      <div class="inner-content">
        <div style="font-size:13px;font-weight:600;color:var(--sub);margin-bottom:16px">${esc((v.brand_label||'') + ' ' + (v.model||''))} · ${esc(v.year||'')}</div>

        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);margin-bottom:12px">Pricing</div>
        ${_priceField('evDaily',   'Daily rate',    v.daily_rate)}
        ${_priceField('evWeekly',  'Weekly rate',   v.weekly_rate)}
        ${_priceField('evMonthly', 'Monthly rate',  v.monthly_rate)}
        ${_priceField('evDeposit', 'Security deposit', v.deposit)}
        ${_textField ('evMinDays', 'Minimum rental days', '1', 'number', v.min_rental_days)}
        ${_priceField('evDriver',  'Driver rate/day',   v.driver_rate)}

        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);margin:16px 0 12px">Specs</div>
        ${_selectField('evTrans', 'Transmission', TRANS, v.transmission)}
        ${_selectField('evFuel',  'Fuel type',    FUELS, v.fuel_type)}
        ${_selectField('evDrive', 'Drive type',   DRIVES, v.drive_type)}
        ${_textField  ('evSeats', 'Seats',        '5',    'number', v.seats)}
        ${_textField  ('evMile',  'Mileage (km)', '',     'number', v.mileage_km)}

        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);margin:16px 0 12px">Description</div>
        <textarea id="evDesc" rows="4" style="width:100%;padding:12px;border:1.5px solid var(--border,#E8ECF4);border-radius:10px;font-size:14px;background:var(--card,#fff);color:var(--text);font-family:inherit;box-sizing:border-box;resize:vertical;margin-bottom:14px">${esc(v.description || '')}</textarea>

        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);margin-bottom:12px">Availability</div>
        <div style="display:flex;align-items:center;gap:12px;background:var(--card,#fff);border:1px solid var(--border,#E8ECF4);border-radius:12px;padding:14px;margin-bottom:14px">
          <div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--text)">Mark as available</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Customers can see and enquire about this vehicle</div></div>
          <input type="checkbox" id="evAvail" ${v.is_available ? 'checked' : ''} style="width:20px;height:20px;accent-color:#1A3A8F;cursor:pointer">
        </div>

        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn-sec" style="flex:1" onclick="H.goBack()">Cancel</button>
          <button class="btn-pri" style="flex:2" onclick="H._rentalBiz.saveEdit('${esc(id)}')">Save Changes</button>
        </div>
      </div>
    </div>`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Data loaders & action handlers
  // ─────────────────────────────────────────────────────────────────────────
  RB.loadCompanyData = async function (bizId) {
    const sb = window.supabase; if (!sb) return;
    RB._loading = true;
    try {
      const { data: rc, error } = await sb.from('rental_companies')
        .select('id,status,avg_rating,review_count,fleet_count,business_id')
        .eq('business_id', bizId).single();

      if (error && error.code === 'PGRST116') {
        RB.company = null; RB.fleet = []; RB.leads = [];
        RB._loading = false;
        const curPage = H.currentPageName;
        if (curPage === 'RentalDashboard' || curPage === 'RentalManageFleet') {
          H.openInner('RentalCompanySetup');
        }
        return;
      }
      if (error) throw error;

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
      const coverMap  = {};
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
        const nameRes = await sb.from('profiles').select('id,full_name,username').in('id', userIds);
        (nameRes.data || []).forEach(p => { nameMap[p.id] = p.full_name || p.username || 'Customer'; });
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
    const curPage = H.currentPageName;
    if (curPage === 'RentalDashboard')    H.renderPage('RentalDashboard', {});
    if (curPage === 'RentalManageFleet')  H.renderPage('RentalManageFleet', { bizId });
    if (curPage === 'RentalBusinessAnalytics') H.renderPage('RentalBusinessAnalytics', { bizId });
  };

  RB.submitSetup = async function (bizId) {
    const sb = window.supabase; if (!sb) return;
    const bio   = document.getElementById('rcSetupBio')?.value?.trim() || null;
    const phone = document.getElementById('rcSetupPhone')?.value?.trim() || null;
    const wa    = document.getElementById('rcSetupWA')?.value?.trim() || null;
    const btn   = document.querySelector('.btn-pri');
    if (btn) { btn.disabled = true; btn.textContent = 'Setting up…'; }
    try {
      const { data: rc, error } = await sb.from('rental_companies').insert({ business_id: bizId, status: 'pending' }).select('id').single();
      if (error && error.code !== '23505') throw error;
      const compId = rc ? rc.id : (await sb.from('rental_companies').select('id').eq('business_id', bizId).single()).data?.id;
      if (compId) {
        await sb.from('rental_company_profiles').upsert({ company_id: compId, bio: bio || null }, { onConflict: 'company_id' });
      }
      if (phone || wa) {
        await sb.from('businesses').update({ phone: phone || null, whatsapp: wa || null }).eq('id', bizId);
      }
      H.toast('Rental company set up! Pending admin approval.');
      RB.company = null;
      H.openInner('RentalDashboard');
    } catch (e) {
      console.warn('rental setup:', e);
      H.toast('Setup failed. Please try again.', 4000, true);
      if (btn) { btn.disabled = false; btn.textContent = 'Activate Rental Portal'; }
    }
  };

  RB.toggleFleetStatus = async function (vehicleId, newStatus) {
    const sb = window.supabase; if (!sb) return;
    try {
      const { error } = await sb.from('rental_vehicle_listings').update({ status: newStatus }).eq('id', vehicleId);
      if (error) throw error;
      const v = RB.fleet.find(x => x.id === vehicleId);
      if (v) v.status = newStatus;
      H.renderPage('RentalManageFleet', { bizId: RB.company && RB.company.business_id });
      H.toast(newStatus === 'active' ? 'Vehicle activated.' : 'Vehicle paused.');
    } catch (e) {
      H.toast('Could not update status.', 4000, true);
    }
  };

  RB.removeVehicle = function (vehicleId) {
    H.modal({
      title: 'Remove this vehicle?',
      body:  '<div style="font-size:13px;color:var(--sub);line-height:1.6">This will archive the vehicle and hide it from the marketplace. Your listing history and analytics are preserved.</div>',
      confirmText: 'Remove',
      danger: true,
      onConfirm: async () => {
        const sb = window.supabase; if (!sb) return;
        try {
          await sb.from('rental_vehicle_listings').update({ status: 'archived', deleted_at: new Date().toISOString() }).eq('id', vehicleId);
          RB.fleet = RB.fleet.filter(v => v.id !== vehicleId);
          H.renderPage('RentalManageFleet', { bizId: RB.company && RB.company.business_id });
          H.toast('Vehicle removed.');
        } catch (e) {
          H.toast('Could not remove vehicle.', 4000, true);
        }
      }
    });
  };

  RB.saveEdit = async function (vehicleId) {
    const sb = window.supabase; if (!sb) return;
    const btn= document.querySelector('.btn-pri');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const listingUpdate = {
        daily_rate:     parseFloat(document.getElementById('evDaily')?.value)   || null,
        weekly_rate:    parseFloat(document.getElementById('evWeekly')?.value)  || null,
        monthly_rate:   parseFloat(document.getElementById('evMonthly')?.value) || null,
        deposit:        parseFloat(document.getElementById('evDeposit')?.value) || null,
        min_rental_days:parseInt(document.getElementById('evMinDays')?.value)   || 1,
        driver_rate:    parseFloat(document.getElementById('evDriver')?.value)  || null,
        description:    document.getElementById('evDesc')?.value?.trim()        || null,
        is_available:   document.getElementById('evAvail')?.checked             || false,
      };
      if (!listingUpdate.daily_rate || listingUpdate.daily_rate <= 0) { H.toast('Daily rate is required.'); if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; } return; }

      const specsUpdate = {
        transmission: document.getElementById('evTrans')?.value || null,
        fuel_type:    document.getElementById('evFuel')?.value  || null,
        drive_type:   document.getElementById('evDrive')?.value || null,
        seats:        parseInt(document.getElementById('evSeats')?.value) || null,
        mileage_km:   parseInt(document.getElementById('evMile')?.value)  || null,
      };

      await Promise.all([
        sb.from('rental_vehicle_listings').update(listingUpdate).eq('id', vehicleId),
        sb.from('rental_vehicle_specs').upsert({ listing_id: vehicleId, ...specsUpdate }, { onConflict: 'listing_id' }),
      ]);

      const v = RB.fleet.find(x => x.id === vehicleId);
      if (v) Object.assign(v, listingUpdate, specsUpdate);
      delete H._rental.detailCache[vehicleId];

      H.toast('Vehicle updated.');
      H.goBack();
    } catch (e) {
      console.warn('rental edit:', e);
      H.toast('Could not save changes.', 4000, true);
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
      if (e.code === 'P0001') { H.toast('Those dates overlap an existing blocked period.', 4000, true); }
      else { H.toast('Could not block dates.', 4000, true); }
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
  // TASK 2: Image Upload Pipeline
  // Uploads to Supabase Storage bucket "rental-media", stores URL in
  // rental_vehicle_media, refreshes cover_url in fleet cache.
  // ─────────────────────────────────────────────────────────────────────────
  RB.uploadMedia = async function (listingId, file, isCover) {
    const sb = window.supabase; if (!sb) return;
    const u  = H.currentUser(); if (!u) return;

    // Validate client-side before hitting storage (matches bucket policy)
    const ALLOWED = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
    if (!ALLOWED.includes(file.type)) { H.toast('Only JPEG, PNG, WebP, or HEIC images allowed.', 4000, true); return; }
    if (file.size > 8 * 1024 * 1024)  { H.toast('Image must be under 8 MB.', 4000, true); return; }

    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `${u.id}/${listingId}/${Date.now()}.${ext}`;

    try {
      const { error: upErr } = await sb.storage.from('rental-media').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: signed } = await sb.storage.from('rental-media').createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed && signed.signedUrl;
      if (!url) throw new Error('Could not get image URL');

      // If this is the first photo or explicitly cover, set is_cover
      const { count } = await sb.from('rental_vehicle_media').select('id', { count: 'exact', head: true }).eq('listing_id', listingId);
      const willBeCover = isCover || count === 0;

      if (willBeCover) {
        // Demote any existing cover
        await sb.from('rental_vehicle_media').update({ is_cover: false }).eq('listing_id', listingId).eq('is_cover', true);
      }

      await sb.from('rental_vehicle_media').insert({
        listing_id: listingId,
        url,
        storage_path: path,
        is_cover: willBeCover,
        sort_order: count || 0,
      });

      // Refresh cover in fleet cache
      if (willBeCover) {
        const v = RB.fleet.find(x => x.id === listingId);
        if (v) v.cover_url = url;
      }

      return { url, path };
    } catch (e) {
      console.warn('rental upload:', e);
      if (e.statusCode === 409) H.toast('File already exists. Please try again.', 4000, true);
      else H.toast('Upload failed: ' + (e.message || 'Unknown error'), 4000, true);
      return null;
    }
  };

  RB.deleteMedia = async function (mediaId, storagePath, listingId) {
    const sb = window.supabase; if (!sb) return;
    try {
      await sb.from('rental_vehicle_media').delete().eq('id', mediaId);
      if (storagePath) await sb.storage.from('rental-media').remove([storagePath]);
      // Reassign cover to next photo if needed
      const { data: remaining } = await sb.from('rental_vehicle_media').select('id').eq('listing_id', listingId).eq('is_cover', false).order('sort_order').limit(1);
      if (remaining && remaining.length) {
        await sb.from('rental_vehicle_media').update({ is_cover: true }).eq('id', remaining[0].id);
      }
      H.toast('Photo removed.');
    } catch (e) {
      H.toast('Could not delete photo.', 4000, true);
    }
  };

  // Handle file input change (called from inline onchange in the fleet manage UI)
  RB.handlePhotoUpload = async function (listingId, input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const label = input.parentElement && input.parentElement.querySelector('span');
    if (label) label.textContent = 'Uploading…';
    const result = await RB.uploadMedia(listingId, file, false);
    if (result) H.toast('Photo uploaded.');
    if (label) label.textContent = 'Add Photo';
    input.value = '';
    // Refresh manage fleet to show new photo count
    if (H.currentPageName === 'RentalManageFleet') {
      H.renderPage('RentalManageFleet', { bizId: RB.company && RB.company.business_id });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TASK 8: Wire rental_business_analytics RPC into analytics page
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

  H.pages.RentalBusinessAnalytics_after = function (params) {
    const rc = RB.company;
    if (rc && rc.id && rc.id !== RB._analyticsId) {
      RB.loadAnalytics(rc.id);
    }
  };

  window.RB = RB;

})(window.H);
