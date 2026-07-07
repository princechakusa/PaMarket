/* ============================================================================
 * safety.js — Moderation-awareness layer for the app (Phase C).
 *
 * This file does NOT decide anything. All moderation decisions live in the
 * Supabase backend (see supabase/migrations/moderation_backend_phase_a.sql):
 * content filtering, sanctions and listing-state transitions are enforced by
 * triggers, RLS and SECURITY DEFINER functions. The app is a thin client that
 * only *translates and displays* those backend decisions to the user.
 *
 * Responsibilities (display / translation only):
 *   Safety.friendlyError(err)    → turn a raw Postgres/PostgREST error into a
 *                                  human message ({ code, message, blocked }).
 *   Safety.listingStatus(status) → label / message / colour / publiclyVisible
 *                                  for each of the 7 backend listing states.
 *   Safety.checkSanction(userId) → read (never write) user_sanctions so the UI
 *                                  can gate posting/messaging for warned/
 *                                  suspended/banned accounts.
 *   Safety.reportReasons         → the canonical reason lists so every report
 *                                  surface (listing / user / message) agrees.
 * ==========================================================================*/
(function () {
  'use strict';
  var Safety = {};

  // --- Backend error translation -------------------------------------------
  // The Phase A trigger raises exceptions prefixed with a stable machine code:
  //   content_blocked: prohibited content (<label>)
  //   account_banned:  this account is banned from posting
  //   account_suspended: this account is suspended from posting
  // RLS denials surface as generic permission errors. We match on the prefix so
  // wording changes in the backend label never break the mapping.
  var ERROR_MAP = {
    content_blocked: {
      message: 'This ad can’t be posted because it contains prohibited content. Please review our community guidelines and edit your listing.',
      blocked: true
    },
    account_banned: {
      message: 'Your account has been banned and can no longer post on PaMarket. Contact support if you believe this is a mistake.',
      blocked: true
    },
    account_suspended: {
      message: 'Your account is temporarily suspended, so you can’t post right now. Please try again after the suspension ends.',
      blocked: true
    }
  };

  Safety.friendlyError = function (err) {
    var raw = '';
    if (typeof err === 'string') raw = err;
    else if (err && err.message) raw = err.message;
    else if (err) { try { raw = String(err); } catch (e) { raw = ''; } }

    var lower = (raw || '').toLowerCase();
    for (var code in ERROR_MAP) {
      if (!ERROR_MAP.hasOwnProperty(code)) continue;
      if (lower.indexOf(code) !== -1) {
        // Pull the human label out of "content_blocked: prohibited content (Weapons)".
        var label = null;
        var m = raw.match(/\(([^)]+)\)\s*$/);
        if (m) label = m[1];
        return { code: code, message: ERROR_MAP[code].message, blocked: true, label: label };
      }
    }
    // Not a moderation decision — let the caller fall back to its own handling.
    return { code: null, message: raw || 'Something went wrong. Please try again.', blocked: false, label: null };
  };

  // Convenience: does this error represent a backend moderation block?
  Safety.isModerationBlock = function (err) {
    return Safety.friendlyError(err).blocked === true;
  };

  // --- Listing status presentation -----------------------------------------
  // Mirrors the backend listing states (pending / active / under_review /
  // flagged / sold / removed / deleted). `publiclyVisible` tells the buyer-side
  // UI whether a listing should ever appear in Browse / search / detail.
  var STATUS = {
    active: {
      label: 'Live', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0',
      message: 'Your ad is live and visible to buyers.', publiclyVisible: true
    },
    pending: {
      label: 'Pending review', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
      message: 'Your ad is waiting to be reviewed before it goes live.', publiclyVisible: false
    },
    under_review: {
      label: 'Under review', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
      message: 'A moderator is reviewing this ad. It is temporarily hidden from buyers.', publiclyVisible: false
    },
    flagged: {
      label: 'Flagged', color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA',
      message: 'This ad was flagged and is being checked. It may be hidden from buyers until it is cleared.', publiclyVisible: false
    },
    sold: {
      label: 'Sold / Filled', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0',
      message: 'This item is marked as sold.', publiclyVisible: false
    },
    removed: {
      label: 'Removed', color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
      message: 'This ad was removed for breaking our community guidelines.', publiclyVisible: false
    },
    deleted: {
      label: 'Deleted', color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
      message: 'This ad has been deleted.', publiclyVisible: false
    }
  };
  // Legacy status seen in existing data: treat "rejected" like a removal.
  STATUS.rejected = {
    label: 'Rejected', color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
    message: 'This ad was not approved. Edit it to fix the problem and resubmit.', publiclyVisible: false
  };

  Safety.listingStatus = function (status) {
    var s = (status || 'active').toLowerCase();
    return STATUS[s] || STATUS.active;
  };

  // Should a buyer ever see a listing in this state? (Backend RLS is the real
  // gate; this is a belt-and-braces client filter so hidden states never leak
  // into Browse/search if a stale row is cached locally.)
  Safety.isPubliclyVisible = function (status) {
    return Safety.listingStatus(status).publiclyVisible === true;
  };

  // A small badge for the seller's own "My Listings" view.
  Safety.statusBadge = function (status) {
    var s = Safety.listingStatus(status);
    var esc = (window.H && H.escHtml) ? H.escHtml : function (x) { return x; };
    return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;' +
      'font-weight:800;letter-spacing:.02em;color:' + s.color + ';background:' + s.bg +
      ';border:1px solid ' + s.border + '">' + esc(s.label) + '</span>';
  };

  // --- Sanction awareness (read-only) --------------------------------------
  // Reads the user's active sanction from the backend so the UI can gate
  // posting/messaging and show the right message. Never writes — sanctions are
  // created only from the admin panel (Phase B). Returns:
  //   { type: 'none' | 'warning' | 'suspension' | 'ban',
  //     active, message, canPost, canMessage, until }
  // `ok` distinguishes a definitive "no active sanction" (ok:true) from a
  // failed/unavailable lookup (ok:false). Callers that lift a local ban on
  // "none" must only do so when ok:true, so an offline/missing-table read never
  // silently un-bans someone.
  function none(ok) { return { type: 'none', active: false, message: '', canPost: true, canMessage: true, until: null, ok: ok }; }
  var NONE = none(true);

  Safety.checkSanction = async function (userId) {
    try {
      if (!userId || !window.supabase || typeof window.supabase.from !== 'function') return none(false);
      var res = await window.supabase
        .from('user_sanctions')
        .select('sanction_type,reason,expires_at,active')
        .eq('user_id', userId)
        .eq('active', true)
        .order('issued_at', { ascending: false })
        .limit(1);
      if (!res || res.error) return none(false);
      if (!res.data || !res.data.length) return none(true);
      var row = res.data[0];
      var type = (row.sanction_type || '').toLowerCase();
      var until = row.expires_at || null;
      // Expired sanctions are treated as lifted client-side; the backend
      // functions (is_user_suspended/banned) apply the same expiry rule
      // (expires_at is null OR expires_at > now()).
      if (until && new Date(until).getTime() < Date.now()) return NONE;

      if (type === 'permanent_ban' || type === 'ban') {
        return { type: 'ban', active: true, until: until,
          message: 'Your account has been banned for breaking PaMarket’s rules. You can no longer post or message. Contact support to appeal.',
          canPost: false, canMessage: false };
      }
      if (type === 'suspension' || type === 'suspend') {
        return { type: 'suspension', active: true, until: until,
          message: 'Your account is suspended' + (until ? ' until ' + new Date(until).toLocaleDateString() : '') +
            '. You can’t post or send messages during this time.',
          canPost: false, canMessage: false };
      }
      if (type === 'warning' || type === 'warn') {
        return { type: 'warning', active: true, until: until,
          message: 'You’ve received a warning from our moderators' + (row.reason ? ': ' + row.reason : '') +
            '. Please follow the community guidelines to avoid further action.',
          canPost: true, canMessage: true };
      }
      return none(true);
    } catch (e) {
      return none(false); // fail open — never block a user because the check errored
    }
  };

  // --- Canonical report reasons --------------------------------------------
  // One source of truth for every report surface so listing / user / message
  // reports stay consistent (matches the admin panel's expected values).
  Safety.reportReasons = {
    listing: ['Scam or fraud', 'Fake or counterfeit', 'Incorrect information',
              'Prohibited item', 'Spam', 'Offensive content', 'Duplicate', 'Other'],
    user:    ['Scammer', 'Harassment', 'Spam', 'Fake account', 'Impersonation', 'Other'],
    message: ['Scam or fraud', 'Harassment', 'Spam', 'Offensive content', 'Sharing off-platform contact', 'Other']
  };

  // --- Chat safety hints ----------------------------------------------------
  // Detects off-platform contact-sharing / classic scam phrasing in an outgoing
  // or incoming message so the chat UI can show a gentle "keep it on PaMarket"
  // warning. Purely advisory — it never blocks the message.
  var CONTACT_PATTERNS = [
    /\bwhats\s?app\b/i, /\btelegram\b/i,
    /\b(?:\+?263|0)7\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/,        // ZW mobile numbers
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,          // email
    /\bebank(?:ing)?\b|\becocash\b|\bmukuru\b/i            // money-transfer bait
  ];
  Safety.chatSafetyHint = function (text) {
    if (!text) return null;
    for (var i = 0; i < CONTACT_PATTERNS.length; i++) {
      if (CONTACT_PATTERNS[i].test(text)) {
        return 'For your safety, keep conversations and payments inside PaMarket. Be cautious about sharing phone numbers, email or paying before you meet.';
      }
    }
    return null;
  };

  window.Safety = Safety;
  if (window.H) window.H.Safety = Safety;
})();
