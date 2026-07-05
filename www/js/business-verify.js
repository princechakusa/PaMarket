/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * MODULE 4 — VERIFICATION SYSTEM (business)
 * Raises businesses.verification_level via a submission reviewed by Admin (Module 12).
 *   1 = phone verified (auto when a valid phone is on file)
 *   2 = owner ID verified (submit ID doc → pending)
 *   3 = business document verified (submit registration → pending)
 * Reuses H.uploadVerificationDoc (private bucket) + H.compressImage from verify.js.
 */
'use strict';
(function (H) {
  const pages = H.pages;
  const escHtml = (s) => H.escHtml(s);
  const toast = (...a) => H.toast(...a);
  const currentUser = () => H.currentUser();
  const innerTopbar = (...a) => H.innerTopbar(...a);
  const saveState = () => H.saveState();
  const renderPage = (...a) => H.renderPage(...a);

  function getBiz(id) { return (H.state.businesses || []).find(b => b.id === id) || null; }
  function isOwner(b) { const u = currentUser(); return !!(u && b && b.ownerUserId === u.id); }

  let _pending = {}; // { businessId: { id:dataUrl, reg:dataUrl } } (memory only)

  H.fetchBusinessVerification = async function (businessId) {
    const sb = window.supabase; if (!sb || !businessId) return null;
    try {
      const { data } = await sb.from('business_verifications').select('*')
        .eq('business_id', businessId).order('submitted_at', { ascending: false }).limit(1);
      return (data && data[0]) || null;
    } catch (e) { return null; }
  };

  pages.BusinessVerify = function (params) {
    const b = getBiz(params && params.id);
    if (!b) return `<div class="page active">${innerTopbar('Verification')}${H.emptyState('Business not found', '')}</div>`;
    if (!isOwner(b)) return `<div class="page active">${innerTopbar('Verification')}${H.emptyState('Owner only', 'Only the owner can verify this business.')}</div>`;

    const lvl = b.verificationLevel || 0;
    const pend = _pending[b.id] || {};
    const phoneOk = /^(\+263|0)[0-9]{9}$/.test(b.phone || '');
    const pendingReview = !!b.verificationPending;
    const checkSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

    const step = (n, done, active, title, sub, inner) => {
      const bg = done ? '#16a34a' : (active ? '#1A3A8F' : '#EEF2FB');
      const col = done || active ? '#fff' : '#94a3b8';
      return `<div style="background:var(--card,#fff);border:1px solid ${active ? '#C7D6F5' : 'var(--border,#E8ECF4)'};border-radius:16px;padding:16px;margin-bottom:12px">
        <div style="display:flex;gap:13px;align-items:flex-start">
          <div style="width:36px;height:36px;border-radius:50%;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${done ? checkSvg : n}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:800;color:var(--text)">${title}</div>
            <div style="font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.5">${sub}</div>
            ${inner || ''}
          </div>
        </div>
      </div>`;
    };
    const upBtn = (label, onclick) => `<button onclick="${onclick}" style="margin-top:10px;display:inline-flex;align-items:center;gap:7px;padding:10px 16px;border-radius:11px;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;background:#EEF2FB;color:#1A3A8F">${(H.ICONS && H.ICONS.doc) || ''} ${label}</button>`;

    return `<div class="page active">
      ${innerTopbar('Get Verified')}
      <div class="inner-content" style="padding-bottom:40px">
        <div style="background:linear-gradient(135deg,#1A3A8F,#0f2460);border-radius:18px;padding:20px;color:#fff;margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:12px">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#F5A623" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            <div><div style="font-size:18px;font-weight:800">Verification level ${lvl}</div>
            <div style="font-size:12.5px;color:rgba(255,255,255,.8)">Verified businesses earn buyer trust and rank higher.</div></div>
          </div>
        </div>

        ${pendingReview ? `<div style="background:#FFF8EC;border-radius:14px;padding:14px;font-size:13px;color:#92400e;margin-bottom:14px">Your documents are under review. We'll update your level within 2 business days.</div>` : ''}

        ${step(1, lvl >= 1, lvl < 1 && phoneOk, 'Phone Verified', phoneOk ? escHtml(b.phone) : 'Add a valid phone in your profile first.',
          lvl < 1 && phoneOk ? `<button class="btn-pri" style="padding:9px 16px;margin-top:10px;width:auto" onclick="H._bizVerify.confirmPhone('${b.id}')">Confirm phone</button>` : '')}

        ${step(2, lvl >= 2, lvl === 1, 'Owner ID Verified', "National ID or passport of the owner.",
          lvl < 2 ? `${upBtn(pend.id ? 'Replace ID' : 'Upload ID', `H._bizVerify.capture('${b.id}','id')`)}${pend.id ? `<img src="${H.escHtml(pend.id)}" style="width:100%;max-width:220px;border-radius:12px;margin-top:10px">` : ''}` : '')}

        ${step(3, lvl >= 3, lvl === 2, 'Business Document', 'Certificate of incorporation / registration.',
          lvl < 3 ? `${upBtn(pend.reg ? 'Replace Document' : 'Upload Document', `H._bizVerify.capture('${b.id}','reg')`)}${pend.reg ? `<img src="${H.escHtml(pend.reg)}" style="width:100%;max-width:220px;border-radius:12px;margin-top:10px">` : ''}` : '')}

        <input type="file" id="bvFile" accept="image/*" capture="environment" style="display:none" onchange="H._bizVerify.onFile(event)">
        ${(pend.id || pend.reg) && !pendingReview ? `<button class="btn-pri" id="bvSubmit" style="width:100%;margin-top:6px" onclick="H._bizVerify.submit('${b.id}')">Submit for Review</button>` : ''}
        <div style="display:flex;gap:10px;background:#EEF2FB;border-radius:14px;padding:14px;margin-top:16px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div style="font-size:12px;color:var(--sub);line-height:1.5">Documents are stored privately and used only to verify your business.</div>
        </div>
      </div>
    </div>`;
  };

  H._bizVerify = {
    _activeKey: null, _activeBiz: null,
    open(id) { H.openInner('BusinessVerify', { id }); },

    async confirmPhone(id) {
      const b = getBiz(id); if (!b) return;
      b.verificationLevel = Math.max(b.verificationLevel || 0, 1); b.updatedAt = Date.now();
      saveState();
      if (typeof H.saveBusinessToCloud === 'function') await H.saveBusinessToCloud(b);
      toast('Phone verified'); renderPage('BusinessVerify', { id });
    },

    async capture(id, key) {
      this._activeKey = key; this._activeBiz = id;
      const Camera = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera;
      const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
      if (isNative && Camera) {
        try {
          const photo = await Camera.getPhoto({ quality: 80, resultType: 'dataUrl', source: 'PROMPT', width: 1400, correctOrientation: true });
          if (photo && photo.dataUrl) { _pending[id] = _pending[id] || {}; _pending[id][key] = photo.dataUrl; renderPage('BusinessVerify', { id }); }
        } catch (e) { const f = document.getElementById('bvFile'); if (f) f.click(); }
        return;
      }
      const f = document.getElementById('bvFile'); if (f) f.click();
    },

    onFile(e) {
      const f = e.target.files && e.target.files[0]; if (!f || !this._activeBiz) return;
      const id = this._activeBiz, key = this._activeKey;
      H.compressImage(f, 1400, 0.82).then(d => { _pending[id] = _pending[id] || {}; _pending[id][key] = d; renderPage('BusinessVerify', { id }); });
    },

    async submit(id) {
      const b = getBiz(id); if (!b) return;
      const pend = _pending[id] || {};
      if (!pend.id && !pend.reg) { toast('Add a document first'); return; }
      const btn = document.getElementById('bvSubmit'); if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      const u = currentUser();
      let idPath = null, regPath = null;
      try {
        if (pend.id && typeof H.uploadVerificationDoc === 'function') idPath = await H.uploadVerificationDoc(u.id, pend.id, 'biz_id');
        if (pend.reg && typeof H.uploadVerificationDoc === 'function') regPath = await H.uploadVerificationDoc(u.id, pend.reg, 'biz_reg');
      } catch (e) {}
      const level = pend.reg ? 3 : 2;
      const sb = window.supabase;
      if (sb) {
        try { await sb.from('business_verifications').insert({ business_id: id, level_requested: level, id_doc_path: idPath, reg_doc_path: regPath, status: 'pending' }); } catch (e) {}
      }
      b.verificationPending = true; b.updatedAt = Date.now(); saveState();
      if (typeof H.saveBusinessToCloud === 'function') H.saveBusinessToCloud(b);
      _pending[id] = {};
      toast('Submitted for review', 5000);
      renderPage('BusinessVerify', { id });
    }
  };

})(window.H = window.H || {});
