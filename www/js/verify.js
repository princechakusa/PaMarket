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

  // Captured images are held in memory only (never written to localStorage) and
  // uploaded to private Storage on submit — so sensitive PII isn't persisted on device.
  let _pendingId     = null;
  let _pendingSelfie = null;

  function stopCam() {
    if (livenessTimer) { clearInterval(livenessTimer); livenessTimer = null; }
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  }

  // ── Verification document storage helpers (shared with admin & company flow) ──
  function _dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1]); var n = bin.length; var arr = new Uint8Array(n);
    while (n--) arr[n] = bin.charCodeAt(n);
    return new Blob([arr], { type: mime });
  }

  // Upload a captured image (data URL) to the private verification-docs bucket.
  // Returns the storage path, or null if unavailable (caller falls back to base64).
  H.uploadVerificationDoc = async function (userId, dataUrl, label) {
    var sb = window.supabase;
    if (!sb || !sb.storage || !dataUrl || dataUrl.indexOf('data:') !== 0) return null;
    try {
      var blob = _dataUrlToBlob(dataUrl);
      var path = userId + '/' + label + '_' + Date.now() + '.jpg';
      var up = await sb.storage.from('verification-docs').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (up.error) { console.warn('verification upload failed:', up.error.message); return null; }
      return path;
    } catch (e) { console.warn('verification upload error:', e); return null; }
  };

  // Admin: turn a stored path into a short-lived signed URL for review.
  H.signedVerificationUrl = async function (path, secs) {
    var sb = window.supabase;
    if (!sb || !sb.storage || !path) return null;
    try {
      var r = await sb.storage.from('verification-docs').createSignedUrl(path, secs || 3600);
      return (r && r.data && r.data.signedUrl) || null;
    } catch (e) { return null; }
  };

  // ---------------------------------------------------
  // VERIFY PAGE
  // ---------------------------------------------------
  pages.Verify = function () {
    const u         = currentUser();
    const idImg     = _pendingId || u.idDocs || null;
    const selfieImg = _pendingSelfie || u.selfie || null;
    const hasId     = !!idImg;
    const hasSelfie = !!selfieImg;
    const isPending = !!u.verification_pending;

    if (u.verified) {
      return `<div class="page active">${innerTopbar('Identity Verified')}
        <div class="inner-content">
          <div style="background:linear-gradient(135deg,#16a34a,#15803d);border-radius:20px;padding:26px 20px;text-align:center;color:#fff;margin-bottom:16px;box-shadow:0 8px 24px rgba(21,128,61,.25)">
            <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div style="font-size:19px;font-weight:800">You're Verified</div>
            <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:4px">Your blue badge is live across your listings and profile.</div>
          </div>
          <div class="tip-box"><div class="tip-title">${I.lock} Blue badge active</div>
            <div class="tip-body">Verified sellers earn more buyer trust and more enquiries.</div>
          </div>
        </div>
      </div>`;
    }

    if (isPending) {
      return `<div class="page active">${innerTopbar('Verify Identity')}
        <div class="inner-content">
          <div style="background:linear-gradient(135deg,#1A3A8F,#0f2460);border-radius:20px;padding:26px 20px;text-align:center;color:#fff;margin-bottom:16px;box-shadow:0 8px 24px rgba(26,58,143,.25)">
            <div style="width:64px;height:64px;border-radius:50%;background:rgba(245,166,35,.22);display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#F5A623" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <div style="font-size:19px;font-weight:800">Under Review</div>
            <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:6px;line-height:1.55">Your ID and selfie were submitted. Our team reviews within 24 hours and you'll be notified once approved.</div>
          </div>
          <div class="tip-box">
            <div class="tip-title">${I.lock} What happens next?</div>
            <div class="tip-body">Once approved, your blue <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> badge appears automatically on all your listings.</div>
          </div>
          <button class="ml-act-btn" style="width:100%;padding:12px;margin-top:12px" onclick="H._verify.cancelPending()">Cancel request</button>
        </div>
      </div>`;
    }

    // ── Premium step card helper ──
    const doneCount = 1 + (hasId ? 1 : 0) + (hasSelfie ? 1 : 0);
    const pct = Math.round((doneCount / 3) * 100);
    const ready = hasId && hasSelfie;
    const checkSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

    const badge = (state, n) => {
      if (state === 'done') return `<div style="width:38px;height:38px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(22,163,74,.35)">${checkSvg}</div>`;
      const bg = state === 'active' ? '#1A3A8F' : '#EEF2FB';
      const col = state === 'active' ? '#fff' : '#94a3b8';
      return `<div style="width:38px;height:38px;border-radius:50%;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:800">${n}</div>`;
    };

    const card = (state, n, title, sub, inner) => `
      <div style="background:var(--card,#fff);border:1px solid ${state === 'active' ? '#C7D6F5' : 'var(--border,#E8ECF4)'};border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(16,24,40,.04)">
        <div style="display:flex;gap:14px;align-items:flex-start">
          ${badge(state, n)}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:15px;font-weight:800;color:var(--text)">${title}</div>
              ${state === 'done' ? '<span style="font-size:10.5px;font-weight:800;color:#16a34a;background:#dcfce7;border-radius:20px;padding:2px 9px;letter-spacing:.3px">ADDED</span>' : ''}
            </div>
            <div style="font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.55">${sub}</div>
            ${inner || ''}
          </div>
        </div>
      </div>`;

    const actBtn = (label, onclick, accent) => `<button onclick="${onclick}" style="margin-top:12px;display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;background:${accent ? '#EEF2FB' : 'linear-gradient(135deg,#1A3A8F,#2952cc)'};color:${accent ? '#1A3A8F' : '#fff'}">${I.camera} ${label}</button>`;

    return `<div class="page active">${innerTopbar('Verify Identity')}
      <div class="inner-content" style="padding-bottom:40px">

        <!-- Hero + progress -->
        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 100%);border-radius:22px;padding:22px 20px;margin-bottom:18px;color:#fff;box-shadow:0 10px 28px rgba(26,58,143,.28)">
          <div style="display:flex;align-items:center;gap:13px;margin-bottom:16px">
            <div style="width:50px;height:50px;border-radius:15px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#F5A623" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
            <div style="flex:1">
              <div style="font-size:18px;font-weight:800;letter-spacing:-.3px">Get Verified</div>
              <div style="font-size:12.5px;color:rgba(255,255,255,.82);margin-top:1px">Verified sellers get up to 4× more enquiries</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;height:8px;background:rgba(255,255,255,.18);border-radius:5px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#F5A623,#ffc55c);border-radius:5px;transition:width .35s"></div></div>
            <div style="font-size:12px;font-weight:800;color:#F5A623;white-space:nowrap">${doneCount} of 3</div>
          </div>
        </div>

        ${card('done', 1, 'Phone Verified', escHtml(u.phone || 'Your phone number is confirmed'), '')}

        ${card(hasId ? 'done' : 'active', 2, 'Upload ID Document', "National ID, passport or driver's licence. Capture both sides if applicable.",
          `<input type="file" id="idFile" accept="image/*" capture="environment" style="display:none" onchange="H._verify.onIdUpload(event)">
           ${actBtn(hasId ? 'Replace ID' : 'Upload ID', "document.getElementById('idFile').click()", hasId)}
           ${hasId ? `<div style="margin-top:12px;border-radius:14px;overflow:hidden;border:1px solid var(--border,#E8ECF4);max-width:240px"><img src="${idImg}" style="width:100%;display:block"></div>` : ''}`)}

        ${card(hasSelfie ? 'done' : (hasId ? 'active' : 'todo'), 3, 'Face Selfie', 'Take a clear photo of your face. Reviewed alongside your ID.',
          `${actBtn(hasSelfie ? 'Re-take Selfie' : 'Take Selfie', 'H._verify.takeSelfie()', hasSelfie)}
           ${hasSelfie ? `<div style="margin-top:12px"><img src="${selfieImg}" style="width:104px;height:104px;border-radius:50%;object-fit:cover;border:3px solid #16a34a"></div>` : ''}`)}

        <button class="btn-pri" id="submitVerifyBtn" ${ready ? '' : 'disabled'} onclick="H._verify.submitForReview()" style="width:100%;margin-top:6px;${ready ? '' : 'opacity:.5;cursor:not-allowed'}">${ready ? 'Submit for Review' : 'Add ID & selfie to continue'}</button>
        <div style="font-size:12px;color:var(--sub);text-align:center;margin-top:8px">Reviewed by our team within 24 hours.</div>

        <div style="display:flex;gap:10px;align-items:flex-start;background:#EEF2FB;border-radius:14px;padding:14px;margin-top:16px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2" style="flex-shrink:0;margin-top:1px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div style="font-size:12px;color:var(--sub);line-height:1.55"><b style="color:#1A3A8F">Your data is secure.</b> Your ID and selfie are stored privately and used only to confirm your identity. They are never sold or shared.</div>
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

    // Selfie capture — use the reliable native front camera on device; fall back to
    // the in-app getUserMedia camera only on the web or if the plugin is unavailable.
    async takeSelfie() {
      const Camera   = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera;
      const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
      if (isNative && Camera) {
        try {
          const photo = await Camera.getPhoto({
            quality: 85,
            allowEditing: false,
            resultType: 'dataUrl',
            source: 'CAMERA',
            direction: 'FRONT',
            width: 600,
            height: 600,
            correctOrientation: true,
            promptLabelHeader: 'Take a Selfie'
          });
          const dataUrl = photo && (photo.dataUrl || (photo.base64String ? 'data:image/jpeg;base64,' + photo.base64String : null));
          if (dataUrl) {
            _pendingSelfie = dataUrl;   // held in memory only, uploaded on submit
            toast('Selfie saved'); renderPage('Verify');
          }
        } catch (e) {
          const m = ((e && e.message) || '').toLowerCase();
          if (m.includes('cancel') || m.includes('denied')) return;
          openInner('SelfieCam'); // fall back to the in-app camera
        }
        return;
      }
      openInner('SelfieCam');
    },

    onIdUpload(e) {
      const f = e.target.files[0]; if (!f) return;
      compressImage(f, 1400, 0.82).then(d => {
        _pendingId = d;            // held in memory only, uploaded on submit
        renderPage('Verify'); toast('ID added');
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
      const idData     = _pendingId     || u.idDocs || null;
      const selfieData = _pendingSelfie || u.selfie || null;
      if (!idData || !selfieData) { toast('Complete both steps first'); return; }
      const btn = document.getElementById('submitVerifyBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      try {
        if (!window.supabase) throw new Error('Not connected');
        // Use the live authenticated user id so it matches the database security rule.
        let authId = u.id;
        try { const ar = await window.supabase.auth.getUser(); if (ar && ar.data && ar.data.user && ar.data.user.id) authId = ar.data.user.id; } catch (e) {}
        if (!authId) throw new Error('Your session expired. Please sign out and sign in again, then retry.');
        // Upload images to the private bucket; keep base64 only as a fallback if
        // Storage isn't set up yet (migration not run) so nothing breaks.
        const idPath     = await H.uploadVerificationDoc(authId, idData, 'id');
        const selfiePath = await H.uploadVerificationDoc(authId, selfieData, 'selfie');
        const rec = { user_id: authId, status: 'pending', submitted_at: new Date().toISOString() };
        if (idPath && selfiePath) {
          rec.id_doc_path = idPath; rec.selfie_path = selfiePath;
          rec.id_doc = null; rec.selfie = null;
        } else {
          rec.id_doc = idData; rec.selfie = selfieData; // legacy fallback
        }
        const { error: vErr } = await window.supabase.from('verifications').upsert(rec, { onConflict: 'user_id' });
        if (vErr) throw vErr;
        // Mark profile as pending
        const { error: pErr } = await window.supabase.from('profiles')
          .update({ verification_pending: true })
          .eq('id', authId);
        if (pErr) throw pErr;
        // Clear sensitive images from device once submitted.
        _pendingId = null; _pendingSelfie = null;
        u.idDocs = null; u.selfie = null;
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

      _pendingSelfie = dataUrl;   // held in memory only, uploaded on submit
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

  // ---------------------------------------------------
  // COMPANY VERIFICATION (in-app, native camera + private storage)
  // ---------------------------------------------------
  var _pendingCompany = {};   // keyed by doc id -> dataURL (memory only)
  var _companyName    = '';
  var _verifyType     = null; // 'company' | 'individual' | null (shows chooser)
  var COMPANY_DOCS = [
    ['reg',      'Certificate of Incorporation', 'CIPC business registration certificate'],
    ['tax',      'Tax Clearance Certificate',    'Valid certificate from ZIMRA'],
    ['premises', 'Business Premises Photo',       'Outside of your premises showing any signage']
  ];
  var INDIVIDUAL_DOCS = [
    ['nationalId', 'National ID or Passport', 'A clear photo of your national ID or passport']
  ];

  pages.CompanyVerify = function () {
    const u = currentUser();
    if (!u) return `<div class="page active">${innerTopbar('Verify to Post Jobs')}${H.emptyState('Sign in required', 'Sign in to verify your account')}</div>`;

    if (u.companyVerified) {
      return `<div class="page active">${innerTopbar('Verify to Post Jobs')}
        <div class="inner-content" style="text-align:center;padding:40px 24px">
          <div style="width:72px;height:72px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">Verified</div>
          <div style="font-size:13px;color:var(--sub)">Your blue Verified badge is active. You can post jobs.</div>
        </div></div>`;
    }
    if (u.company_verification_pending) {
      return `<div class="page active">${innerTopbar('Verify to Post Jobs')}
        <div class="inner-content" style="text-align:center;padding:40px 24px">
          <div style="font-size:42px;margin-bottom:10px">&#128339;</div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">Under Review</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6">Your documents were submitted. Our team reviews within 2 business days.</div>
          <button class="ml-act-btn" style="width:100%;padding:12px;margin-top:20px" onclick="H._companyVerify.cancelPending()">Cancel Request</button>
        </div></div>`;
    }

    // Type chooser - shown when user hasn't picked company or individual yet
    if (!_verifyType) {
      return `<div class="page active">${innerTopbar('Verify to Post Jobs')}
        <div class="inner-content">
          <div style="font-size:14px;color:var(--sub);line-height:1.6;margin-bottom:24px">Choose the option that applies to you. Both allow you to post jobs on PaMarket.</div>
          <div onclick="H._companyVerify.setType('company')" style="background:var(--card);border:2px solid var(--border);border-radius:16px;padding:20px;margin-bottom:14px;cursor:pointer">
            <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">Registered Company</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.6">You have a registered business with a Certificate of Incorporation from CIPC. Requires 3 documents.</div>
          </div>
          <div onclick="H._companyVerify.setType('individual')" style="background:var(--card);border:2px solid var(--border);border-radius:16px;padding:20px;cursor:pointer">
            <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">Sole Trader / Individual</div>
            <div style="font-size:13px;color:var(--sub);line-height:1.6">You are a sole trader, freelancer, or individual employer without a registered company. Requires your National ID or Passport only.</div>
          </div>
        </div></div>`;
    }

    const isIndividual = _verifyType === 'individual';
    const activeDocs   = isIndividual ? INDIVIDUAL_DOCS : COMPANY_DOCS;
    const allDone      = activeDocs.every(d => _pendingCompany[d[0]]);
    const nameVal      = escHtml(_companyName || u.company || u.name || '');
    const nameLabel    = isIndividual ? 'Your Full Name' : 'Company / Business Name';
    const namePlaceholder = isIndividual ? 'Your full legal name' : 'Registered business name';
    const docCount     = activeDocs.length;
    const subtitle     = isIndividual
      ? 'Submit your National ID or Passport to earn your Verified badge and post jobs. Reviewed within 2 business days.'
      : `Submit the ${docCount} documents below to earn your blue <b>Verified Business</b> badge and post jobs. Reviewed within 2 business days.`;

    return `<div class="page active">${innerTopbar(isIndividual ? 'Individual Verification' : 'Company Verification')}
      <div class="inner-content">
        <button onclick="H._companyVerify.setType(null)" style="background:none;border:none;color:#1A3A8F;font-size:13px;font-weight:600;cursor:pointer;padding:0;margin-bottom:14px">&#8592; Change type</button>
        <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:16px">${subtitle}</div>
        <div class="fg" style="margin-bottom:18px">
          <div class="fl">${nameLabel}</div>
          <input class="fi" id="cvCompanyName" placeholder="${namePlaceholder}" value="${nameVal}" oninput="H._companyVerify.syncName(this.value)">
        </div>
        ${activeDocs.map((d, i) => {
          const done = !!_pendingCompany[d[0]];
          return `<div class="verify-step">
            <div class="verify-num ${done ? 'done' : ''}">${done ? I.check : `<span style="font-size:15px;font-weight:600">${i + 1}</span>`}</div>
            <div style="flex:1">
              <div class="verify-step-title">${d[1]}</div>
              <div class="verify-step-sub">${d[2]}</div>
              <button class="verify-step-btn" onclick="H._companyVerify.capture('${d[0]}')">${I.camera} ${done ? 'Replace Photo' : 'Add Photo'}</button>
              ${done ? `<img src="${_pendingCompany[d[0]]}" style="width:100%;max-width:240px;border-radius:12px;margin-top:10px">` : ''}
            </div>
          </div>`;
        }).join('')}
        <button class="btn-pri" id="cvSubmitBtn" ${allDone ? '' : 'disabled'} onclick="H._companyVerify.submit()" style="margin-top:8px">Submit for Review</button>
        <input type="file" id="cvDocFile" accept="image/*" capture="environment" style="display:none" onchange="H._companyVerify.onFile(event)">
        <div class="tip-box" style="margin-top:14px"><div class="tip-title">${I.lock} Secure</div><div class="tip-body">Your documents are stored privately and used only to verify your identity. Never sold or shared.</div></div>
      </div></div>`;
  };

  H._companyVerify = {
    _activeKey: null,
    setType(t) { _verifyType = t; _pendingCompany = {}; _companyName = ''; renderPage('CompanyVerify'); },
    syncName(v) { _companyName = v; var b = document.getElementById('cvSubmitBtn'); if (b) {/* keep state */} },
    async capture(key) {
      this._activeKey = key;
      const Camera   = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera;
      const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
      var nm = document.getElementById('cvCompanyName'); if (nm) _companyName = nm.value;
      if (isNative && Camera) {
        try {
          const photo = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: 'dataUrl', source: 'PROMPT', width: 1400, correctOrientation: true });
          const d = photo && photo.dataUrl;
          if (d) { _pendingCompany[key] = d; renderPage('CompanyVerify'); }
        } catch (e) {
          const m = ((e && e.message) || '').toLowerCase();
          if (m.includes('cancel') || m.includes('denied')) return;
          var fi = document.getElementById('cvDocFile'); if (fi) fi.click();
        }
        return;
      }
      var fi2 = document.getElementById('cvDocFile'); if (fi2) fi2.click();
    },
    onFile(e) {
      const f = e.target.files[0]; if (!f || !this._activeKey) return;
      var nm = document.getElementById('cvCompanyName'); if (nm) _companyName = nm.value;
      const key = this._activeKey;
      compressImage(f, 1400, 0.82).then(d => { _pendingCompany[key] = d; renderPage('CompanyVerify'); });
    },
    async submit() {
      const u = currentUser();
      var nmEl = document.getElementById('cvCompanyName');
      const name = ((nmEl && nmEl.value) || _companyName || u.company || '').trim();
      const isIndividual = _verifyType === 'individual';
      const activeDocs   = isIndividual ? INDIVIDUAL_DOCS : COMPANY_DOCS;
      if (!name) { toast(isIndividual ? 'Enter your full name' : 'Enter your company name'); return; }
      if (!activeDocs.every(d => _pendingCompany[d[0]])) { toast('Add all required documents'); return; }
      const btn = document.getElementById('cvSubmitBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      try {
        if (!window.supabase) throw new Error('Not connected');
        const paths = {};
        for (const d of activeDocs) {
          paths[d[0]] = await H.uploadVerificationDoc(u.id, _pendingCompany[d[0]], 'co_' + d[0]);
        }
        if (Object.keys(paths).some(k => !paths[k])) throw new Error('Document storage is not set up yet');
        // Use 'SOLE TRADER: ' prefix so admin can identify the type without a new DB column.
        const storedName = isIndividual ? ('SOLE TRADER: ' + name) : name;
        const rec = {
          user_id: u.id, company_name: storedName, status: 'pending', submitted_at: new Date().toISOString(),
          reg_cert_path: paths.reg || null,
          owner_id_path: paths.nationalId || null,
          tax_cert_path: paths.tax || null,
          premises_path: paths.premises || null
        };
        const { error } = await window.supabase.from('company_verifications').upsert(rec, { onConflict: 'user_id' });
        if (error) throw error;
        await window.supabase.from('profiles').update({ company_verification_pending: true, company: name }).eq('id', u.id);
        _pendingCompany = {}; _companyName = ''; _verifyType = null;
        u.company = name; u.company_verification_pending = true; saveState();
        toast('Documents submitted! Reviewed within 2 business days.', 5000);
        renderPage('CompanyVerify');
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Review'; }
        toast('Failed to submit: ' + (e.message || 'Check your connection'), 4000, true);
      }
    },
    async cancelPending() {
      const u = currentUser();
      u.company_verification_pending = false; saveState();
      if (window.supabase) await window.supabase.from('profiles').update({ company_verification_pending: false }).eq('id', u.id);
      toast('Request cancelled'); renderPage('CompanyVerify');
    }
  };

})(window.H);