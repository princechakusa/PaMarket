'use strict';
(function (H) {
  const pages = H.pages;

  // -- CHANGE PASSWORD ---------------------------------------
  pages.ChangePassword = function () {
    return `<div class="page active">
      ${H.innerTopbar('Change Password')}
      <div class="form-wrap">
        <div class="fg">
          <div class="fl">Current Password</div>
          <input class="fi" type="password" id="curPass" placeholder="Enter current password">
        </div>
        <div class="fg">
          <div class="fl">New Password</div>
          <input class="fi" type="password" id="newPass" placeholder="Enter new password">
        </div>
        <div class="fg">
          <div class="fl">Confirm New Password</div>
          <input class="fi" type="password" id="confPass" placeholder="Confirm new password">
        </div>
        <button class="btn-pri" onclick="H._changePassword.save()">Update Password</button>
        <button class="btn-sec" onclick="H.goBack()">Cancel</button>
      </div>
    </div>`;
  };

  pages.ChangePassword_after = function () {
    H._changePassword = {
      save: () => {
        const cur  = document.getElementById('curPass')?.value;
        const nw   = document.getElementById('newPass')?.value;
        const conf = document.getElementById('confPass')?.value;
        const u    = H.currentUser();
        if (!cur || !nw || !conf)      { H.toast('Fill in all fields'); return; }
        if (cur !== u.password)        { H.toast('Current password is incorrect'); return; }
        if (nw.length < 6)             { H.toast('New password must be at least 6 characters'); return; }
        if (nw !== conf)               { H.toast('Passwords do not match'); return; }
        u.password = nw;
        H.saveState();
        H.toast('Password updated successfully');
        H.goBack();
      }
    };
  };

  pages.TwoFactor = function () {
    const u = H.currentUser();
    const enabled = u.twoFactorEnabled || false;
    return `<div class="page active">
      ${H.innerTopbar('Two-Factor Authentication')}
      <div class="form-wrap">
        <div class="section-box">
          <div class="verify-title">${enabled ? '2FA Enabled' : '2FA Disabled'}</div>
          <div class="verify-sub">${enabled ? 'Your account is protected.' : 'Add an extra layer of security.'}</div>
        </div>
        <div class="section-box">
          <div class="section-title">How it works</div>
          <div class="info-row"><span class="info-label">Step 1</span><span class="info-val">Enter your password</span></div>
          <div class="info-row"><span class="info-label">Step 2</span><span class="info-val">Get a code via SMS</span></div>
          <div class="info-row"><span class="info-label">Step 3</span><span class="info-val">Enter code to log in</span></div>
        </div>
        <button class="btn-pri" onclick="H._twoFactor.toggle()">${enabled ? 'Disable 2FA' : 'Enable 2FA'}</button>
        <button class="btn-sec" onclick="H.goBack()">Back</button>
      </div>
    </div>`;
  };

  pages.TwoFactor_after = function () {
    H._twoFactor = {
      toggle: () => {
        const u = H.currentUser();
        u.twoFactorEnabled = !u.twoFactorEnabled;
        H.saveState();
        H.toast(u.twoFactorEnabled ? '2FA enabled' : '2FA disabled');
        H.renderPage('TwoFactor');
      }
    };
  };

  pages.ActiveSessions = function () {
    const u = H.currentUser();
    const sessions = u.sessions || [{ id: 'current', device: 'This device', location: 'Zimbabwe', time: Date.now(), current: true }];
    return `<div class="page active">
      ${H.innerTopbar('Active Sessions')}
      <div class="form-wrap">
        <div class="section-box">
          <div class="section-title">Logged-in Devices</div>
          ${sessions.map(s => `
            <div class="info-row">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--charcoal)">${H.escHtml(s.device)}</div>
                <div style="font-size:11px;color:var(--ash);margin-top:2px">${H.escHtml(s.location)} · ${new Date(s.time).toLocaleDateString()}</div>
              </div>
              ${s.current ? '<span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:3px 10px;border-radius:20px">Current</span>'
                : `<button class="btn-unblock" onclick="H._sessions.revoke('${s.id}')">Revoke</button>`}
            </div>`).join('')}
        </div>
        <button class="btn-sec" style="background:var(--red2);color:var(--red)" onclick="H._sessions.revokeAll()">Sign Out All Other Devices</button>
        <button class="btn-sec" onclick="H.goBack()">Back</button>
      </div>
    </div>`;
  };

  pages.ActiveSessions_after = function () {
    H._sessions = {
      revoke: (id) => {
        const u = H.currentUser();
        u.sessions = (u.sessions || []).filter(s => s.id !== id);
        H.saveState(); H.toast('Session revoked'); H.renderPage('ActiveSessions');
      },
      revokeAll: () => {
        const u = H.currentUser();
        u.sessions = (u.sessions || []).filter(s => s.current);
        H.saveState(); H.toast('All other sessions signed out'); H.renderPage('ActiveSessions');
      }
    };
  };

  pages.DeleteAccount = function () {
    return `<div class="page active">
      ${H.innerTopbar('Delete Account')}
      <div class="form-wrap">
        <div class="section-box" style="border:1.5px solid rgba(192,57,43,.2);text-align:center;padding:24px">
          <div class="verify-title" style="color:var(--red)">Delete Account</div>
          <div class="verify-sub">This permanently deletes your account, listings, messages and wallet. Cannot be undone.</div>
        </div>
        <div class="section-box">
          <div class="section-title">What will be deleted</div>
          <div class="info-row"><span class="info-label">Profile</span><span class="info-val" style="color:var(--red)">Permanently removed</span></div>
          <div class="info-row"><span class="info-label">Listings</span><span class="info-val" style="color:var(--red)">All deleted</span></div>
          <div class="info-row"><span class="info-label">Messages</span><span class="info-val" style="color:var(--red)">All deleted</span></div>
          <div class="info-row"><span class="info-label">Wallet</span><span class="info-val" style="color:var(--red)">Balance forfeited</span></div>
        </div>
        <div class="fg">
          <div class="fl">Type DELETE to confirm</div>
          <input class="fi" id="deleteConfirm" placeholder="Type DELETE">
        </div>
        <button class="btn-pri" style="background:var(--red)" onclick="H._deleteAccount.confirm()">Permanently Delete Account</button>
        <button class="btn-sec" onclick="H.goBack()">Cancel · Keep Account</button>
      </div>
    </div>`;
  };

  pages.DeleteAccount_after = function () {
    H._deleteAccount = {
      confirm: () => {
        const val = document.getElementById('deleteConfirm')?.value?.trim();
        if (val !== 'DELETE') { H.toast('Type DELETE to confirm'); return; }
        const u = H.currentUser();
        H.state.listings      = (H.state.listings || []).filter(l => l.sellerId !== u.id);
        H.state.conversations = (H.state.conversations || []).filter(c => !c.members.includes(u.id));
        H.state.users         = (H.state.users || []).filter(x => x.id !== u.id);
        H.state.currentUserId = null;
        H.saveState();
        H.toast('Account deleted');
        H.navTo('Home', null);
      }
    };
  };

})(window.H = window.H || {});
