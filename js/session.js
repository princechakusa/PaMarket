// Shared session UI helper for the public website.
// Reads the same localStorage 'pm_session' shape written by auth.html/auth-callback.html.
// Injects an account chip + dropdown into #signInBtn's parent when a session exists.
(function (global) {
  var APP_URL = 'https://play.google.com/store/apps/details?id=com.pamarket.app';

  function getSession() {
    try {
      var s = localStorage.getItem('pm_session');
      if (!s) return null;
      var session = JSON.parse(s);
      if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) {
        localStorage.removeItem('pm_session');
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function pmSignOut() {
    localStorage.removeItem('pm_session');
    window.location.reload();
  }
  global.pmSignOut = pmSignOut;

  function injectStyles() {
    if (document.getElementById('pmAcctStyles')) return;
    var style = document.createElement('style');
    style.id = 'pmAcctStyles';
    style.textContent =
      '.acct-wrap{position:relative}' +
      '.acct-chip{display:flex;align-items:center;gap:8px;border:1.5px solid #E2E8F0;border-radius:9px;padding:6px 10px 6px 6px;transition:border-color .15s;background:#fff;cursor:pointer}' +
      '.acct-chip:hover{border-color:#1A3A8F}' +
      '.acct-avatar{width:26px;height:26px;border-radius:50%;background:#1A3A8F;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;overflow:hidden}' +
      '.acct-avatar img{width:100%;height:100%;object-fit:cover}' +
      '.acct-name{font-size:13px;font-weight:600;color:#0F172A;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.acct-caret{color:#94A3B8;transition:transform .15s}' +
      '.acct-wrap.open .acct-caret{transform:rotate(180deg)}' +
      '.acct-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 16px 40px rgba(15,36,96,.15);min-width:220px;padding:6px;z-index:400}' +
      '.acct-wrap.open .acct-menu{display:block}' +
      '.acct-menu a{display:block;padding:10px 12px;font-size:13.5px;color:#0F172A;border-radius:8px;font-weight:500}' +
      '.acct-menu a:hover{background:#F8FAFC}' +
      '.acct-menu .acct-sep{height:1px;background:#E2E8F0;margin:6px 4px}' +
      '.acct-menu .acct-signout{color:#DC2626;font-weight:600}';
    document.head.appendChild(style);
  }

  function initAccountUI() {
    var session = getSession();
    var signInBtn = document.getElementById('signInBtn');
    if (!signInBtn || !session || !session.user) return;

    injectStyles();

    var user = session.user;
    var name =
      (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      user.email ||
      'Account';
    var initials = name
      .split(' ')
      .map(function (w) { return w[0]; })
      .slice(0, 2)
      .join('')
      .toUpperCase();
    var profileUrl = 'profile?id=' + encodeURIComponent(user.id);

    var wrap = document.createElement('div');
    wrap.className = 'acct-wrap';
    wrap.innerHTML =
      '<div class="acct-chip" id="acctChipBtn">' +
        '<span class="acct-avatar">' + (initials || 'U') + '</span>' +
        '<span class="acct-name">' + name.split(' ')[0] + '</span>' +
        '<svg class="acct-caret" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="acct-menu">' +
        '<a href="dashboard">My Dashboard</a>' +
        '<a href="admin" id="acctAdminLink" style="display:none">Admin Console</a>' +
        '<a href="' + profileUrl + '">My Profile</a>' +
        '<a href="' + profileUrl + '">My Ads</a>' +
        '<a href="post-job">Post a Job</a>' +
        '<a href="applications">Job Applications</a>' +
        '<a href="' + APP_URL + '" target="_blank" rel="noopener">Favorites (open app)</a>' +
        '<a href="' + APP_URL + '" target="_blank" rel="noopener">Chats (open app)</a>' +
        '<div class="acct-sep"></div>' +
        '<a href="rentals#fleet">My Rental Fleet</a>' +
        '<a href="' + APP_URL + '" target="_blank" rel="noopener">Account Settings</a>' +
        '<a href="#" class="acct-signout" id="acctSignOutBtn">Sign Out</a>' +
      '</div>';

    signInBtn.replaceWith(wrap);

    wrap.querySelector('#acctChipBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    wrap.querySelector('#acctSignOutBtn').addEventListener('click', function (e) {
      e.preventDefault();
      pmSignOut();
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });

    // Reveal the Admin Console link only for admins (best-effort; the /admin
    // page enforces access server-side regardless).
    try {
      if (window.PM && PM.currentUserRole) {
        PM.currentUserRole().then(function (role) {
          if (role === 'admin') {
            var link = wrap.querySelector('#acctAdminLink');
            if (link) link.style.display = 'block';
          }
        }).catch(function () {});
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccountUI);
  } else {
    initAccountUI();
  }
})(window);
