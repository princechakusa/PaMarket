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
              <div style="font-size:15px;font-weight:700;color:#22c55e">You are verified ✓</div>
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
            <div style="font-size:32px;margin-bottom:8px">⏳</div>
            <div style="font-size:15px;font-weight:700;color:#fbbf24">Verification Pending</div>
            <div style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.5">
              Your ID and selfie have been submitted.<br>An admin will review your documents and approve your badge — usually within 24 hours.
            </div>
          </div>
          <div class="tip-box">
            <div class="tip-title">${I.lock} What happens next?</div>
            <div class="tip-body">Once approved you will get a notification and your blue ✓ badge will appear on all your listings automatically.</div>
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
      if (el) el.textContent = faceDetected ? '✓ Face detected — tap Take Photo' : 'Position your face in the oval';
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

      document.getElementById('camState').textContent = '✓ Photo taken';
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