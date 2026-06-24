/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  // ── Official PaMarket social channels ──────────────────────
  H.SOCIALS = [
    { name: 'TikTok',    url: 'https://www.tiktok.com/@pamarketzimbabwe', bg: '#000000',
      svg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.07v12.2a2.43 2.43 0 1 1-2.43-2.43c.2 0 .4.02.59.06v-3.13a5.57 5.57 0 0 0-.59-.03 5.56 5.56 0 1 0 5.56 5.56V9.01a7.33 7.33 0 0 0 4.28 1.37V7.3a4.28 4.28 0 0 1-3.3-1.48z"/></svg>' },
    { name: 'Facebook',  url: 'https://www.facebook.com/profile.php?id=61591000371129', bg: '#1877F2',
      svg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z"/></svg>' },
    { name: 'Instagram', url: 'https://www.instagram.com/pamarketzim/', bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
      svg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>' },
    { name: 'YouTube',   url: 'https://www.youtube.com/@PaMarketZim', bg: '#FF0000',
      svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7l5.7 3.3z"/></svg>' }
  ];

  // Reusable row of social buttons (used on About + anywhere else).
  H._socialLinks = function () {
    return H.SOCIALS.map(function (s) {
      return '<a href="' + s.url + '" target="_blank" rel="noopener" title="' + s.name + '" aria-label="' + s.name + '"'
        + ' onclick="event.preventDefault();(window.open(\'' + s.url + '\',\'_blank\',\'noopener\'))" '
        + ' style="width:46px;height:46px;border-radius:50%;background:' + s.bg + ';display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 3px 10px -3px rgba(16,24,40,.4)">'
        + s.svg + '</a>';
    }).join('');
  };

  // Icons (prefer H.ICONS, fallback set)
  const I = (window.H && H.ICONS) || {};
  const S = {
    help:       '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    doc:        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    lock:       '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    users:      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    mail:       '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    bug:        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l1.88 1.88"/><path d="M14.12 3.88L16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4c0 3.3-2.7 6-6 6z"/><path d="M3 7h2"/><path d="M19 7h2"/><path d="M3 13h2"/><path d="M19 13h2"/><line x1="6" y1="7" x2="6" y2="12"/><line x1="18" y1="7" x2="18" y2="12"/></svg>',
    message:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    phone:      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg>',
    chevron:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    chevronDown:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  };

  // --- Help Center ------------------------------------------
  pages.Help = function () {
    return `<div class="page active">
      ${H.innerTopbar('Help & Support')}
      <div class="form-wrap">
        <div class="help-section">
          <div class="section-title">Common Questions</div>
          <button class="help-item" onclick="H.openInner('FAQs')">
            <span class="help-icon">${S.help}</span>
            <span class="help-label">FAQs</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div class="help-section">
          <div class="section-title">For Businesses</div>
          <button class="help-item" onclick="H.openInner('HelpVerification')">
            <span class="help-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
            <span class="help-label">How to Get Verified</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div class="help-section">
          <div class="section-title">Documentation</div>
          <button class="help-item" onclick="H.openInner('HelpTerms')">
            <span class="help-icon">${S.doc}</span>
            <span class="help-label">Terms & Conditions</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
          <button class="help-item" onclick="H.openInner('HelpPrivacy')">
            <span class="help-icon">${S.lock}</span>
            <span class="help-label">Privacy Policy</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
          <button class="help-item" onclick="H.openInner('HelpCommunity')">
            <span class="help-icon">${S.users}</span>
            <span class="help-label">Community Guidelines</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div class="help-section">
          <div class="section-title">Support</div>
          <button class="help-item" onclick="H.openInner('ContactSupport')">
            <span class="help-icon">${S.mail}</span>
            <span class="help-label">Contact Support</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
          <button class="help-item" onclick="H.openInner('ReportProblem')">
            <span class="help-icon">${S.bug}</span>
            <span class="help-label">Report a Problem</span>
            <span class="help-arrow">${S.chevron}</span>
          </button>
        </div>

        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">Quick Contact</div>
          <a href="mailto:chakusaprince@gmail.com" style="display:flex;align-items:center;gap:10px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--border)">
            <span style="color:#1A3A8F">${S.mail}</span>
            <span style="font-size:13px;font-weight:600;color:#1A3A8F">chakusaprince@gmail.com</span>
          </a>
          <a href="tel:+971589772645" style="display:flex;align-items:center;gap:10px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--border)">
            <span style="color:#16a34a">${S.phone}</span>
            <span style="font-size:13px;font-weight:600;color:#16a34a">+971 589 772 645</span>
          </a>
          <a href="https://wa.me/971589772645" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:10px 0;text-decoration:none">
            <span style="color:#25D366"><svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg></span>
            <span style="font-size:13px;font-weight:600;color:#25D366">Chat on WhatsApp</span>
          </a>
        </div>

        <div style="height:20px"></div>
      </div>
    </div>`;
  };

  // --- FAQs -------------------------------------------------
  pages.FAQs = function () {
    const faqs = [
      {
        q: 'How do I post an ad on PaMarket?',
        a: 'Tap the "Post" button at the bottom of the screen. Choose your category, add clear photos, write a title and description, set your price, and select your location. Your listing goes live instantly — no waiting for review.'
      },
      {
        q: 'Is PaMarket free to use?',
        a: 'Yes — completely free. Posting ads, browsing listings, sending messages, applying for jobs, and getting verified are all 100% free. No subscriptions, no commission on sales, no hidden charges.'
      },
      {
        q: 'How do I get my account verified?',
        a: 'Go to Account → Verify Identity. Enter your ID number, take a selfie, and upload a photo of your National ID or passport. Our team reviews your submission within 24 hours and your blue verified badge appears automatically when approved.'
      },
      {
        q: 'How long do my listings stay active?',
        a: 'Listings stay active for 30 days. You can renew any listing anytime by going to My Listings and tapping Renew. Renewing resets the 30-day timer and bumps your listing back to the top.'
      },
      {
        q: 'Can I edit or delete a listing after posting?',
        a: 'Yes. Go to Account → My Listings, tap the listing you want to change, then tap Edit to update photos, price, or description. To remove a listing, tap Delete. Deleted listings are permanently removed and cannot be recovered.'
      },
      {
        q: 'How do payments work?',
        a: 'PaMarket does not process or hold any payments. All payments are arranged directly between the buyer and seller — cash on collection, EcoCash, OneMoney, or bank transfer. Always inspect the item in person before paying, and never send money upfront for something you have not seen.'
      },
      {
        q: 'How do I stay safe from scams?',
        a: 'Never pay in advance without seeing the item. Avoid sellers who refuse to meet in person or who ask you to pay via gift cards or Western Union. If a deal feels too good to be true, it probably is. Use the in-app Report button to flag suspicious listings immediately.'
      },
      {
        q: 'How do I contact a seller?',
        a: 'Tap any listing, then tap "Send Message" to chat in-app, or tap "Call" or "WhatsApp" to contact the seller directly. All messages are stored in your Messages tab so you never lose a conversation.'
      },
      {
        q: 'How do I report a listing or block a user?',
        a: 'To report a listing: open the listing and tap the flag icon or scroll to the bottom and tap "Report". To block a user: tap their name on a listing or in Messages, then tap "Block User". Blocked users cannot see your listings or message you.'
      },
      {
        q: 'How do I post a job as a company?',
        a: 'Your company must be verified before you can post jobs on PaMarket. Go to Post → Jobs and follow the Company Verification steps. You will need your Certificate of Incorporation, Tax Clearance Certificate from ZIMRA, owner ID, and a photo of your premises. Verification takes up to 2 business days.'
      },
      {
        q: 'Why is my listing not showing up?',
        a: 'Make sure your listing is set to "Active" in My Listings. Check that it was saved successfully — you should have received a confirmation. If your listing was removed by our moderation team, you will receive a notification with the reason. Contact support if you believe this was an error.'
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings → Security → Delete Account. Type DELETE to confirm. Your account, listings, and messages are permanently removed within 30 days. This action cannot be undone — download any data you need before proceeding.'
      }
    ];

    return `<div class="page active">
      ${H.innerTopbar('FAQs')}
      <div class="faq-list">
        ${faqs.map((item, idx) => `
          <div class="faq-item" id="faq-${idx}">
            <button class="faq-question" onclick="H._faqs.toggleFaq(${idx})">
              <span>${H.escHtml(item.q)}</span>
              <span class="faq-toggle">${S.chevronDown}</span>
            </button>
            <div class="faq-answer">
              <div class="faq-text">${H.escHtml(item.a)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="height:20px"></div>
    </div>`;
  };

  pages.FAQs_after = function () {
    H._faqs = {
      toggleFaq: (idx) => {
        const item = document.getElementById('faq-' + idx);
        if (!item) return;
        item.classList.toggle('open');
      }
    };
  };

  // --- Contact Support --------------------------------------
  pages.ContactSupport = function () {
    return `<div class="page active">
      ${H.innerTopbar('Contact Support')}
      <div class="form-wrap">

        <a href="mailto:chakusaprince@gmail.com" style="display:flex;align-items:center;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;text-decoration:none;-webkit-tap-highlight-color:transparent">
          <div style="width:42px;height:42px;border-radius:12px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F">${S.mail}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--sub);font-weight:500;margin-bottom:2px">Email Support</div>
            <div style="font-size:14px;font-weight:700;color:#1A3A8F">chakusaprince@gmail.com</div>
          </div>
          <div style="color:var(--sub)">${S.chevron}</div>
        </a>

        <a href="tel:+971589772645" style="display:flex;align-items:center;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;text-decoration:none;-webkit-tap-highlight-color:transparent">
          <div style="width:42px;height:42px;border-radius:12px;background:#F0FDF4;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#16a34a">${S.phone}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--sub);font-weight:500;margin-bottom:2px">Call / WhatsApp</div>
            <div style="font-size:14px;font-weight:700;color:#16a34a">+971 589 772 645</div>
          </div>
          <div style="color:var(--sub)">${S.chevron}</div>
        </a>

        <a href="https://wa.me/971589772645" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px;text-decoration:none;-webkit-tap-highlight-color:transparent">
          <div style="width:42px;height:42px;border-radius:12px;background:#F0FDF4;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--sub);font-weight:500;margin-bottom:2px">WhatsApp</div>
            <div style="font-size:14px;font-weight:700;color:#25D366">Chat on WhatsApp</div>
          </div>
          <div style="color:var(--sub)">${S.chevron}</div>
        </a>

      </div>
    </div>`;
  };

  // --- Support Bot (Report a Problem) ----------------------
  pages.ReportProblem = function () {
    var u = H.currentUser();
    var uName = u && u.name ? u.name.split(' ')[0] : null;
    return `<div class="page active" style="display:flex;flex-direction:column;overflow:hidden;height:100%;background:#F5F7FC">

      <!-- Header -->
      <div style="background:#1A3A8F;padding:14px 16px 14px;display:flex;align-items:center;gap:12px">
        <button onclick="H.goBack()" style="background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#3B6FE8,#1A3A8F);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.25)">P</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:800;color:#fff">PaMarket Support</div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:1px">
            <span style="width:7px;height:7px;border-radius:50%;background:#4ADE80;flex-shrink:0"></span>
            <span style="font-size:11px;color:rgba(255,255,255,0.8);font-weight:500">Online · Usually replies instantly</span>
          </div>
        </div>
        <button onclick="H._bot.clearChat()" title="Clear chat" style="background:rgba(255,255,255,0.12);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;font-family:Inter,sans-serif">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          Clear
        </button>
      </div>

      <!-- Chat area -->
      <div id="botChat" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px 14px 8px;display:flex;flex-direction:column;gap:14px;min-height:0"></div>

      <!-- Quick-reply chips -->
      <div id="botChips" style="padding:8px 12px 6px;display:flex;flex-wrap:wrap;gap:7px;align-items:center;background:#fff;border-top:1px solid #E8EBF2"></div>

      <!-- Input bar -->
      <div style="padding:8px 12px 22px;background:#fff;display:flex;gap:8px;align-items:center;border-top:1px solid #E8EBF2">
        <input id="botInput" class="fi" style="flex:1;margin:0;font-size:14px;border-radius:22px;padding:10px 16px;background:#F5F7FC;border:1.5px solid #E8EBF2" placeholder="Type your question..." onkeydown="if(event.key==='Enter')H._bot.send()">
        <button onclick="H._bot.send()" style="background:#1A3A8F;color:#fff;border:none;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>`;
  };

  pages.ReportProblem_after = function () {
    if (!document.getElementById('bot-css')) {
      var st = document.createElement('style');
      st.id = 'bot-css';
      st.textContent =
        '@keyframes botIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
        '@keyframes dotP{0%,80%,100%{transform:scale(.45);opacity:.3}40%{transform:scale(1);opacity:1}}' +
        '.bot-bbl{animation:botIn .22s ease}' +
        '.bot-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#9ca3af;margin:0 2px;animation:dotP 1.3s ease-in-out infinite}' +
        '.bot-dot:nth-child(2){animation-delay:.22s}.bot-dot:nth-child(3){animation-delay:.44s}' +
        '.bot-chip{transition:background .15s,color .15s,border-color .15s}' +
        '.bot-chip:active{background:#1A3A8F!important;color:#fff!important;border-color:#1A3A8F!important}' +
        '.bot-cat-btn:active{transform:scale(0.97)}';
      document.head.appendChild(st);
    }

    var HKEY = 'pm_bot_h3';
    var WA   = 'https://wa.me/971589772645';
    var ML   = 'mailto:chakusaprince@gmail.com';
    var PH   = 'tel:+971589772645';
    var WASVG= '<svg viewBox="0 0 24 24" width="17" height="17" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';

    /* ── knowledge base — 30 topics ── */
    var KB = [
      {
        tags:['sign in','login','log in','signin','forgot password','reset password','locked out','wrong password','account access','cant sign','cannot sign','email not found','not signing','change password'],
        answer:'To sign in:\nTap "Sign In" on the home screen and enter your email and password.\n\nForgot your password?\n• Tap "Forgot Password" below the sign-in form\n• Check your inbox AND spam folder for the reset link\n• The link expires in 1 hour — request a new one if needed\n\nIf your email is not recognised, you may have registered with a different address or via Google.',
        chips:['Delete Account','Account Banned','Talk to a Human']
      },
      {
        tags:['post','create listing','add listing','sell','post ad','how to post','new listing','list item','publish listing','upload item','add item'],
        answer:'To post a listing:\n1. Tap the orange + Post button at the bottom of the screen\n2. Choose the right category\n3. Add 3–5 clear photos, a title, description, and price\n4. Set your location and tap Publish\n\nListings go live within a few minutes after review. Clear photos and honest descriptions get up to 3x more responses.',
        chips:['Edit a Listing','Mark as Sold','Get Verified']
      },
      {
        tags:['verify','verification','id','identity','badge','blue badge','verified seller','document','selfie','id document','get verified','identity check'],
        answer:'To earn your verified badge:\n1. Go to Profile (bottom nav)\n2. Tap "Verify Identity"\n3. Upload a clear photo of your national ID or passport\n4. Take a selfie — your face must match the ID\n5. Submit and wait up to 24 hours\n\nVerified sellers rank higher in search and get significantly more enquiries from buyers.',
        chips:['Edit Profile','Post a Listing','Talk to a Human']
      },
      {
        tags:['message','chat','messaging','inbox','not receiving','send message','conversation','message seller','not syncing','not delivered','no reply','messages disappear','chat not working'],
        answer:'Troubleshooting messages:\n\n• Make sure you are signed in\n• Check your internet connection\n• Close the app fully and reopen — messages sync on reload\n• Wait 10–15 seconds after sending for delivery\n\nTo start a new chat:\nOpen any listing → tap "Message Seller"\n\nIf the other person cannot see your message, ask them to close and reopen the app.',
        chips:['Notification Issue','Block a User','Talk to a Human']
      },
      {
        tags:['scam','fraud','fake','suspicious','stolen','illegal','inappropriate','cheat','deceive','fake listing','advance fee','deposit scam','fake job','fake rental','report scam'],
        answer:'To report a scam or suspicious listing:\n1. Open the listing or user profile\n2. Tap the menu (three dots) → tap "Report"\n3. Select "Fraud / Scam" and describe what happened\n4. Submit — we review within 24 hours\n\nSafety rules:\n• NEVER pay any deposit before physically viewing an item\n• NEVER share your OTP, PIN, or bank password\n• Meet in a safe, busy public place\n• If it feels wrong, walk away immediately',
        chips:['Block a User','Report a User','Talk to a Human']
      },
      {
        tags:['report user','bad user','bad seller','bad buyer','harass','abusive','threatening','rude','spam'],
        answer:'To report a user:\n1. Tap their name or profile picture to open their profile\n2. Scroll to the bottom\n3. Tap "Report User"\n4. Select the reason and submit\n\nTo block them immediately:\n• On their profile, tap "Block User"\n• They can no longer message you, see your phone number, or view your listings',
        chips:['Report a Scam','Talk to a Human','Ask Another Question']
      },
      {
        tags:['payment','pay','ecocash','onemoney','bank transfer','mobile money','zipit','rtgs','how to pay','transaction','cash'],
        answer:'PaMarket uses direct peer-to-peer payments between buyers and sellers.\n\nAccepted methods:\n• EcoCash — send to seller\'s registered number\n• OneMoney — same process\n• Bank transfer (ZIPIT / RTGS)\n• Cash on delivery (meet in person)\n\nPaMarket does NOT hold or process payments. Always inspect items before paying — never pay sight-unseen.',
        chips:['Report a Scam','Ask Another Question']
      },
      {
        tags:['job','apply','application','vacancy','hire','employer','employee','applied','apply for job','job not showing','job listing','find job'],
        answer:'To apply for a job:\n1. Open the job listing\n2. Tap "Apply Now"\n3. Fill in your name, phone, email, and a short cover message\n4. Submit — the employer contacts you directly\n\nFor employers:\n• Post in the "Jobs" category\n• Tap "Mark as Filled" once the position is taken\n\nTip: Upload your CV in your profile for one-tap applications.',
        chips:['Upload My CV','Post a Listing','Talk to a Human']
      },
      {
        tags:['cv','resume','upload cv','build cv','my cv','curriculum','work experience','open to work','job seeker'],
        answer:'To build and upload your CV:\n1. Go to Profile (bottom nav)\n2. Tap "Edit Profile"\n3. Scroll to the CV / Work Experience section\n4. Add your job history, skills, education, and sector\n5. Toggle "Open to Work" ON so employers can find you\n\nYour CV is shared automatically when you apply for any job listing.',
        chips:['Apply for a Job','Get Verified','Ask Another Question']
      },
      {
        tags:['delete account','remove account','close account','deactivate','leave pamarket','cancel account','erase account','remove my account'],
        answer:'To permanently delete your account:\n1. Go to Settings (profile icon → Settings)\n2. Scroll to the Security section\n3. Tap "Delete Account"\n4. Enter your password to confirm\n\nThis cannot be undone. All your listings, messages, CV, and personal data are permanently deleted within 30 days.',
        chips:['Sign In Issue','Talk to a Human','Ask Another Question']
      },
      {
        tags:['crash','not loading','slow','freeze','stuck','error','blank screen','app not working','force close','bug','broken','not opening','keeps crashing','white screen','technical','glitch'],
        answer:'Step-by-step fix for app issues:\n\n1. Close the app fully and reopen it\n2. Check your internet (try switching between WiFi and mobile data)\n3. Restart your phone\n4. Clear the app cache:\n   Android: Settings → Apps → PaMarket → Storage → Clear Cache\n   iPhone: Settings → General → iPhone Storage → Offload App\n5. Uninstall and reinstall the latest version\n\nStill broken? Submit a bug report and we will fix it quickly.',
        chips:['Submit a Bug Report','Talk to a Human','Ask Another Question']
      },
      {
        tags:['edit','update listing','change price','modify listing','update ad','change description','change photo','edit my listing'],
        answer:'To edit a listing:\n1. Tap Profile (bottom nav) → My Listings\n2. Tap the listing you want to change\n3. Tap "Edit Ad"\n4. Update the title, price, photos, description, or location\n5. Tap Save — changes appear live within seconds',
        chips:['Mark as Sold','Delete a Listing','Get Verified']
      },
      {
        tags:['delete listing','remove listing','take down','delete ad','remove ad','remove my listing'],
        answer:'To delete a listing:\n1. Go to My Listings (Profile icon)\n2. Tap the listing\n3. Tap "Remove"\n4. Confirm deletion\n\nThe listing is permanently removed from the marketplace.\n\nIf you just sold the item, use "Stop It" instead — it hides the listing while keeping your record.',
        chips:['Post a Listing','Edit a Listing','Ask Another Question']
      },
      {
        tags:['sold','mark sold','mark filled','filled','listing sold','close listing','item sold','job filled','position filled','stop listing'],
        answer:'To mark a listing as sold or filled:\n1. Go to My Listings\n2. Tap the listing\n3. Tap "Stop It" (items / rentals) or "Stop It" (job vacancies)\n\nThe listing is hidden from public search but kept in your account records. Tap "Remove" if you want it fully deleted.',
        chips:['Post a Listing','Edit a Listing','Ask Another Question']
      },
      {
        tags:['notification','alert','push notification','not getting notification','no notification','enable notification','not notified','push not working'],
        answer:'To fix notifications:\n\nAndroid:\nSettings → Apps → PaMarket → Notifications → Turn ON\n\niPhone:\nSettings → PaMarket → Notifications → Allow Notifications\n\nAlso make sure you are signed in — notifications only work when logged in.\n\nYou will receive alerts for: new messages, job applications, listing status changes, and admin updates.',
        chips:['Messages Issue','Talk to a Human','Ask Another Question']
      },
      {
        tags:['block','block user','blocked','unwanted messages','spam user','how to block'],
        answer:'To block a user:\n1. Tap their name or profile photo to open their profile\n2. Scroll to the bottom of their profile\n3. Tap "Block User"\n\nBlocked users cannot message you, call you, or see your contact details. Manage all blocked users in Settings.',
        chips:['Report a User','Messages Issue','Ask Another Question']
      },
      {
        tags:['free','cost','price','fee','how much','charges','paid feature','subscription','pricing','is it free'],
        answer:'PaMarket is 100% free for buyers and sellers!\n\nEverything is free:\n• Post unlimited listings\n• Message any seller or buyer\n• Apply for jobs\n• Browse all categories\n• Create your profile and CV\n• Get verified\n\nNo subscription. No hidden fees. No commission on sales.',
        chips:['Post a Listing','Get Verified','Ask Another Question']
      },
      {
        tags:['profile','update profile','edit profile','change name','change photo','profile picture','bio','city','avatar','update my profile'],
        answer:'To update your profile:\n1. Tap the Profile icon at the bottom\n2. Tap "Edit Profile"\n3. Change your name, profile photo, bio, city, phone number, or skills\n4. Tap Save\n\nA complete profile with a clear photo gets 3× more responses from buyers and employers.',
        chips:['Get Verified','Upload My CV','Ask Another Question']
      },
      {
        tags:['rental','rent','house','room','property','accommodation','commercial space','apartment','flat','lodge','bedsit','find room'],
        answer:'To find a rental:\n• Select the category on the home screen or search by city\n• Filter by price range and province\n• Tap any listing to see full details and contact the landlord directly\n\nTo post a rental:\n• Tap + Post → choose the right category\n• Add real photos of the actual property, monthly rent, and exact location\n\nNEVER pay a deposit before physically viewing a property.',
        chips:['Post a Listing','Report a Scam','Ask Another Question']
      },
      {
        tags:['category','what can i sell','electronics','cars','vehicles','furniture','clothes','services','animals','farm','what can be sold','categories'],
        answer:'PaMarket supports all legal categories:\n\nBuy & Sell\nElectronics · Clothing · Furniture · Vehicles · Appliances · Farm equipment\n\nJobs\nAll sectors · Full-time · Part-time · Freelance · Domestic\n\nRentals\nHouses · Rooms · Commercial spaces · Farmland\n\nServices\nPlumbing · Construction · Cleaning · Delivery · Tutoring\n\nAlways choose the most specific category — it gets your listing found faster.',
        chips:['Post a Listing','Get Verified','Ask Another Question']
      },
      {
        tags:['photo','image upload','add photo','photo not uploading','picture not loading','image not showing','photo failed','upload image'],
        answer:'Tips for uploading photos:\n• Use JPG or PNG files under 5 MB each\n• Make sure your internet is stable when uploading\n• Try a different photo if one specific image keeps failing\n• Clear app cache if photos will not display\n\nYou can add up to 5 photos per listing. The FIRST photo becomes your thumbnail — make it the best, clearest shot.',
        chips:['Post a Listing','Edit a Listing','Submit a Bug Report']
      },
      {
        tags:['renew','expired listing','30 days','listing expired','listing removed','disappeared','no longer showing','listing gone','expired'],
        answer:'Listings stay active for 30 days, then automatically archive.\n\nTo renew an expired listing:\n1. Go to My Listings\n2. Find the expired listing\n3. Tap "Post Again"\n\nThis re-publishes it free for another 30 days.\n\nIf your listing disappeared before 30 days, it may have been reported and removed. Check your notification inbox or contact us.',
        chips:['Edit a Listing','Post a Listing','Talk to a Human']
      },
      {
        tags:['search','find listing','browse','cant find','not showing up','listing not found','search not working','search results','not appearing'],
        answer:'How to find listings:\n• Use the search bar at the top — try specific keywords like "iPhone 13 Harare"\n• Browse by category on the home screen\n• Filter by province, price range, or category\n\nIf YOUR listing is not showing in search:\n• It may still be under review (allow a few minutes after posting)\n• Check it has not expired (30-day limit)\n• Try searching for the exact title you used',
        chips:['Post a Listing','Renew a Listing','Talk to a Human']
      },
      {
        tags:['banned','suspended','account suspended','account banned','why banned','appeal ban','unban','account disabled','account blocked'],
        answer:'If your account has been suspended:\n\n1. Check your registered email — we send a notification explaining the reason\n2. Common reasons: policy violation, reported content, suspicious activity\n\nTo appeal:\n• Use the "Talk to a Human" option below\n• Include: your account email, reason you believe the ban is an error, any supporting evidence\n• We review all appeals within 7 days\n\nCreating a second account to bypass a ban results in permanent removal.',
        chips:['Talk to a Human','Ask Another Question']
      },
      {
        tags:['change phone','phone number','update phone','new number','change number','update contact'],
        answer:'To update your phone number:\n1. Go to Profile (bottom nav)\n2. Tap "Edit Profile"\n3. Update your phone number field\n4. Save changes\n\nYour phone number is visible to other users when they view your listings — make sure it is a number you actively use.',
        chips:['Edit Profile','Get Verified','Ask Another Question']
      },
      {
        tags:['privacy','hide number','private','who can see','data','personal info','privacy settings','hide my number'],
        answer:'To manage your privacy settings:\n1. Go to Profile → Settings\n2. Scroll to Privacy\n3. You can hide your phone number from listings, turn off messaging, and control who sees your profile\n\nYour data is never sold to third parties. We only use your information to operate the PaMarket platform.',
        chips:['Edit Profile','Delete Account','Ask Another Question']
      },
      {
        tags:['business','shop','local shop','business profile','business account','create business','my shop','business listing'],
        answer:'To create a business / local shop profile:\n1. Go to Profile (bottom nav)\n2. Tap "My Business" or look for the business option\n3. Set up your shop name, logo, categories, and description\n4. Link your listings to your shop\n\nBusiness profiles appear in the "Local Shops" section on the home screen and give you more visibility.\n\nContact us if you need help setting up a business account.',
        chips:['Get Verified','Post a Listing','Talk to a Human']
      },
      {
        tags:['boost','sponsored','advertise','ad','promote listing','feature listing','paid ad','promote my listing'],
        answer:'To promote your listing or run a sponsored ad:\n\nContact our team directly — we manage sponsored ads for businesses and individuals who want extra visibility on the platform.\n\nSponsored ads appear at the top of the home screen as featured banners and reach all users in Zimbabwe.\n\nPricing depends on the duration and placement. Get in touch to discuss options.',
        chips:['Talk to a Human','Ask Another Question']
      },
      {
        tags:['update','version','new version','app update','outdated','install update','latest version'],
        answer:'To update PaMarket to the latest version:\n\nAndroid:\nOpen Google Play Store → search "PaMarket" → tap Update\n\niPhone:\nOpen App Store → tap your profile icon → scroll to PaMarket → tap Update\n\nAlways keep the app updated for the best performance, bug fixes, and new features.',
        chips:['App Not Working','Ask Another Question']
      },
      {
        tags:['password','change password','reset password','update password','forgot password','new password'],
        answer:'To change your password:\n1. Go to Settings (profile icon → Settings)\n2. Tap "Change Password"\n3. Enter your current password, then your new password\n4. Tap Save\n\nForgot your current password?\n• Sign out, then tap "Forgot Password" on the sign-in screen\n• Check your email for the reset link',
        chips:['Sign In Issue','Delete Account','Ask Another Question']
      },
    ];

    var chat     = document.getElementById('botChat');
    var chipsEl  = document.getElementById('botChips');
    var input    = document.getElementById('botInput');
    var history  = [];
    var u        = H.currentUser();
    var uName    = u && u.name ? u.name.split(' ')[0] : null;

    var INIT_CHIPS = [
      'App Not Working','Sign In Issue','Post a Listing','Get Verified',
      'Messages Issue','Report a Scam','Job / CV Help','Account Banned',
      'Pricing Info','Submit a Bug Report','Talk to a Human'
    ];

    var CHIP_MAP = {
      'Sign In Issue':     'sign in login forgot password',
      'Post a Listing':    'post create listing sell publish',
      'Get Verified':      'verify verification badge identity',
      'Messages Issue':    'message chat not working inbox',
      'Messaging Issue':   'message chat not working inbox',
      'Report a Scam':     'scam fraud fake suspicious',
      'Job / CV Help':     'job apply cv resume vacancy',
      'App Not Working':   'crash not loading freeze error bug technical glitch',
      'Pricing Info':      'free cost price fee subscription',
      'Account Banned':    'banned suspended appeal account',
      'Edit a Listing':    'edit update listing change price',
      'Delete a Listing':  'delete remove listing',
      'Mark as Sold':      'sold filled close listing',
      'Upload My CV':      'cv resume upload build',
      'Apply for a Job':   'job apply application vacancy',
      'Payment Methods':   'payment pay ecocash onemoney bank transfer',
      'Block a User':      'block user blocked harass',
      'Report a User':     'report user bad seller harass',
      'Notification Issue':'notification alert push not getting',
      'Edit Profile':      'profile photo bio city update',
      'Renew a Listing':   'renew expired listing 30 days',
      'Change Password':   'password change reset forgot',
      'Privacy Settings':  'privacy hide number personal data',
      'Business Profile':  'business shop local profile account',
      'Boost / Advertise': 'boost sponsored advertise promote listing',
    };

    function timeStr() {
      return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }

    function nl2br(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }

    function scrollDown() {
      setTimeout(function(){ if (chat) chat.scrollTop = chat.scrollHeight; }, 70);
    }

    function saveHistory() {
      try { localStorage.setItem(HKEY, JSON.stringify(history.slice(-80))); } catch(e) {}
    }

    function loadHistory() {
      try { var s = localStorage.getItem(HKEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
    }

    function avatar() {
      var d = document.createElement('div');
      d.style.cssText = 'width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1A3A8F,#3B6FE8);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 2px 6px rgba(26,58,143,.3)';
      d.textContent = 'P';
      return d;
    }

    function addMsg(text, isUser, restored) {
      if (!restored) { history.push({t:text, u:isUser, ts:timeStr()}); saveHistory(); }

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px;' + (isUser ? 'justify-content:flex-end' : 'justify-content:flex-start');

      if (!isUser) row.appendChild(avatar());

      var col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;align-items:' + (isUser ? 'flex-end' : 'flex-start') + ';max-width:82%;gap:3px';

      var bbl = document.createElement('div');
      if (!restored) bbl.className = 'bot-bbl';
      bbl.style.cssText = 'padding:11px 15px;border-radius:' + (isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px') + ';font-size:14px;line-height:1.6;word-break:break-word;' + (isUser ? 'background:#1A3A8F;color:#fff' : 'background:#fff;color:#1C2340;border:1.5px solid #E8EBF2;box-shadow:0 1px 4px rgba(0,0,0,0.06)');
      bbl.innerHTML = nl2br(text);
      col.appendChild(bbl);

      var ts = document.createElement('div');
      ts.style.cssText = 'font-size:10px;color:#9CA3AF;padding:0 4px';
      ts.textContent = restored && restored.ts ? restored.ts : timeStr();
      col.appendChild(ts);

      if (!isUser && !restored) {
        var fb = document.createElement('div');
        fb.style.cssText = 'display:flex;gap:6px;padding:0 2px;margin-top:2px';
        fb.innerHTML =
          '<button onclick="H._bot.helpful(this)" style="background:#fff;border:1.5px solid #E8EBF2;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:#5A6480;cursor:pointer">Helpful</button>' +
          '<button onclick="H._bot.notHelpful(this)" style="background:#fff;border:1.5px solid #E8EBF2;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:#5A6480;cursor:pointer">Not helpful</button>';
        col.appendChild(fb);
      }

      row.appendChild(col);
      chat.appendChild(row);
      scrollDown();
    }

    function showTyping() {
      hideTyping();
      var row = document.createElement('div');
      row.id = 'bot-typing';
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px';
      row.appendChild(avatar());
      var bbl = document.createElement('div');
      bbl.style.cssText = 'background:#fff;border:1.5px solid #E8EBF2;border-radius:18px 18px 18px 4px;padding:13px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.06)';
      bbl.innerHTML = '<span class="bot-dot"></span><span class="bot-dot"></span><span class="bot-dot"></span>';
      row.appendChild(bbl);
      chat.appendChild(row);
      scrollDown();
    }

    function hideTyping() {
      var el = document.getElementById('bot-typing');
      if (el) el.remove();
    }

    function addContactCard() {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px';
      row.appendChild(avatar());
      var card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-width:88%';
      card.innerHTML =
        '<div style="font-size:12px;color:#9CA3AF;padding:0 2px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Contact our team directly</div>' +
        '<a href="'+WA+'" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;background:#F0FDF4;border:1.5px solid #bbf7d0;border-radius:14px;padding:12px 14px;text-decoration:none">'+WASVG+'<div><div style="font-size:13px;font-weight:700;color:#16a34a">WhatsApp</div><div style="font-size:11px;color:#6B7280">+971 589 772 645 · Fastest reply</div></div></a>' +
        '<a href="'+ML+'" style="display:flex;align-items:center;gap:10px;background:#EFF6FF;border:1.5px solid #bfdbfe;border-radius:14px;padding:12px 14px;text-decoration:none"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><div><div style="font-size:13px;font-weight:700;color:#1A3A8F">Email</div><div style="font-size:11px;color:#6B7280">support@pamarket.app</div></div></a>' +
        '<a href="'+PH+'" style="display:flex;align-items:center;gap:10px;background:#F0FDF4;border:1.5px solid #bbf7d0;border-radius:14px;padding:12px 14px;text-decoration:none"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 2.1.74 3.26a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c1.16.38 2.3.61 3.26.74a2 2 0 0 1 1.72 2.03z"/></svg><div><div style="font-size:13px;font-weight:700;color:#16a34a">Call / WhatsApp</div><div style="font-size:11px;color:#6B7280">+971 589 772 645</div></div></a>';
      row.appendChild(card);
      chat.appendChild(row);
      scrollDown();
    }

    function addTicketForm(prefillIssue) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-end;gap:8px';
      row.appendChild(avatar());
      var card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1.5px solid #E8EBF2;border-radius:18px 18px 18px 4px;padding:16px;max-width:88%;box-shadow:0 1px 4px rgba(0,0,0,0.06)';
      card.innerHTML =
        '<div style="font-size:13px;font-weight:700;color:#1C2340;margin-bottom:12px">Send us a message</div>' +
        '<textarea id="ticketDesc" placeholder="' + (prefillIssue || 'Describe your issue in detail...') + '" style="width:100%;min-height:90px;border:1.5px solid #E8EBF2;border-radius:10px;padding:10px 12px;font-size:13px;font-family:Inter,sans-serif;color:#1C2340;background:#F5F7FC;resize:none;outline:none;box-sizing:border-box"></textarea>' +
        '<button onclick="H._bot.submitTicket()" style="width:100%;margin-top:10px;padding:12px;background:#1A3A8F;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Send to Support Team</button>';
      row.appendChild(card);
      chat.appendChild(row);
      scrollDown();
    }

    function showChips(list) {
      if (!chipsEl) return;
      chipsEl.innerHTML = '';
      list.forEach(function(label) {
        var isHighlight = label === 'Talk to a Human' || label === 'Submit a Bug Report';
        var btn = document.createElement('button');
        btn.className = 'bot-chip';
        btn.style.cssText = 'background:' + (isHighlight ? '#EFF6FF' : '#fff') + ';border:1.5px solid ' + (isHighlight ? '#BFDBFE' : '#E8EBF2') + ';border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;color:' + (isHighlight ? '#1A3A8F' : '#374151') + ';cursor:pointer;white-space:nowrap';
        btn.textContent = label;
        btn.onclick = function(){ handleInput(label); };
        chipsEl.appendChild(btn);
      });
    }

    function bestMatch(text) {
      var lower = text.toLowerCase();
      var best = null, top = 0;
      KB.forEach(function(entry) {
        var hits = 0;
        entry.tags.forEach(function(tag){ if (lower.indexOf(tag) !== -1) hits++; });
        if (hits > top) { top = hits; best = entry; }
      });
      return top > 0 ? best : null;
    }

    function respond(query) {
      hideTyping();
      var match = bestMatch(query);
      if (match) {
        addMsg(match.answer, false);
        var chips = (match.chips || []).slice();
        if (chips.indexOf('Ask Another Question') === -1) chips.push('Ask Another Question');
        showChips(chips);
      } else {
        addMsg("I could not find a specific answer for that. Let me connect you with our support team:", false);
        addContactCard();
        showChips(['Submit a Bug Report','Ask Another Question']);
      }
    }

    function handleInput(text) {
      if (!text || !text.trim()) return;
      if (input) input.value = '';

      if (text === 'Ask Another Question') {
        addMsg(text, true);
        addMsg('Of course! What can I help you with?', false);
        showChips(INIT_CHIPS);
        return;
      }
      if (text === 'Contact Support') {
        addMsg(text, true);
        addMsg('Here are all the ways to reach us:', false);
        addContactCard();
        showChips(['Submit a Bug Report','Ask Another Question']);
        return;
      }
      if (text === 'Talk to a Human') {
        addMsg(text, true);
        addMsg('No problem. You can reach our team directly below, or leave us a message and we will get back to you.', false);
        addContactCard();
        setTimeout(function(){ addTicketForm(); showChips(['Ask Another Question']); }, 400);
        return;
      }
      if (text === 'Submit a Bug Report') {
        addMsg(text, true);
        addMsg('Please describe what happened. Include what page you were on and what you expected to happen:', false);
        setTimeout(function(){ addTicketForm('e.g. The app crashes when I open Messages on Android...'); showChips(['Ask Another Question']); }, 300);
        return;
      }

      addMsg(text, true);
      var query = CHIP_MAP[text] || text;
      showTyping();
      setTimeout(function(){ respond(query); }, 680);
    }

    H._bot = {
      send: function() {
        var val = input ? input.value.trim() : '';
        if (val) handleInput(val);
      },
      helpful: function(btn) {
        if (btn.parentElement) btn.parentElement.innerHTML = '<span style="font-size:11px;color:#16a34a;font-weight:700;padding:0 2px">Thanks — glad that helped!</span>';
        showChips(INIT_CHIPS);
      },
      notHelpful: function(btn) {
        if (btn.parentElement) btn.parentElement.innerHTML = '<span style="font-size:11px;color:#6B7280;padding:0 2px">Let me get our team to help...</span>';
        setTimeout(function(){
          addMsg('Let me connect you with a real person.', false);
          addContactCard();
          setTimeout(function(){ addTicketForm(); showChips(['Ask Another Question']); }, 350);
        }, 300);
      },
      clearChat: function() {
        try { localStorage.removeItem(HKEY); } catch(e) {}
        history = [];
        if (chat) chat.innerHTML = '';
        if (chipsEl) chipsEl.innerHTML = '';
        var greeting = uName
          ? 'Hi ' + uName + '! Chat cleared. What can I help you with?'
          : 'Chat cleared. What can I help you with?';
        addMsg(greeting, false, true);
        showChips(INIT_CHIPS);
      },
      submitTicket: function() {
        var desc = (document.getElementById('ticketDesc') || {}).value || '';
        desc = desc.trim();
        if (!desc) { H.toast('Please describe your issue first'); return; }
        var cu = H.currentUser();
        var subject = desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
        var full = subject + '\n\n' + desc;
        var rep = {
          id: H.uid ? H.uid() : (Date.now() + ''),
          reporter_id: cu ? cu.id : null,
          target_type: 'support',
          target_id: null,
          reason: '[Support] ' + full,
          status: 'open',
          created_at: new Date().toISOString()
        };
        var btn = document.querySelector('#ticketDesc + button') || document.querySelector('button[onclick="H._bot.submitTicket()"]');
        if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }
        var finish = function(ok) {
          if (ok) {
            addMsg('Your message has been sent to the support team. We will get back to you as soon as possible.\n\nReference: ' + rep.id.slice(0, 8).toUpperCase(), false);
          } else {
            addMsg('Message sent. We will follow up on WhatsApp or email.', false);
          }
          showChips(['Ask Another Question','Talk to a Human']);
          var form = document.getElementById('ticketDesc');
          if (form && form.parentElement) form.parentElement.style.display = 'none';
        };
        if (window.supabase && typeof window.supabase.from === 'function') {
          window.supabase.from('reports').insert(rep).then(function(r){ finish(!r || !r.error); }).catch(function(){ finish(false); });
        } else {
          finish(false);
        }
      }
    };

    /* ── init: restore history or show greeting ── */
    var saved = loadHistory();
    if (saved && saved.length > 0) {
      history = saved;
      saved.forEach(function(m) { addMsg(m.t, m.u, m); });
      var wb = uName ? 'Welcome back, ' + uName + '! How can I help you today?' : 'Welcome back! How can I help you today?';
      addMsg(wb, false, true);
      showChips(INIT_CHIPS);
    } else {
      var greeting = uName
        ? 'Hi ' + uName + '! I am the PaMarket Support Bot.\n\nI can answer questions instantly across 30 topics. Tap a topic below or type your question.'
        : 'Hi! I am the PaMarket Support Bot.\n\nI can answer questions instantly across 30 topics. Tap a topic below or type your question.';
      addMsg(greeting, false, true);
      showChips(INIT_CHIPS);
    }
  };

  // --- Terms & Conditions ----------------------------------
  pages.HelpTerms = function () {
    return `<div class="page active">
      ${H.innerTopbar('Terms of Service')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Terms of Service</h2>
          <p style="color:var(--ash);font-size:12px">Last updated: June 2026 · Effective immediately</p>

          <h2>1. Agreement to Terms</h2>
          <p>By downloading, installing, or using the PaMarket application ("App"), you agree to be legally bound by these Terms of Service. If you do not agree to these terms, you must not use the App. These terms govern all users: buyers, sellers, job seekers, employers, and visitors.</p>

          <h2>2. Who Can Use PaMarket</h2>
          <p>You must be at least 18 years old to create an account or use PaMarket. By registering, you confirm that you meet this age requirement and are legally competent to enter into contracts under Zimbabwean law. We reserve the right to terminate accounts where the minimum age requirement is not met.</p>

          <h2>3. Account Responsibility</h2>
          <p>You are responsible for keeping your account credentials confidential. All activity that occurs under your account is your responsibility. You must provide accurate and truthful information when registering. If you suspect unauthorized access to your account, contact us immediately at chakusaprince@gmail.com or WhatsApp +971 589 772 645.</p>

          <h2>4. What PaMarket Is</h2>
          <p>PaMarket is an online classifieds marketplace that connects buyers and sellers in Zimbabwe. We provide the platform — we are not a party to any transaction between users. We do not hold payments, guarantee delivery, or verify the condition of items unless stated. All transactions are conducted directly between users at their own risk.</p>

          <h2>5. Verification</h2>

          <p><strong>Individual Identity Verification</strong></p>
          <p>Users may optionally verify their personal identity to receive a blue Verified badge. Verification requires uploading a photo of a government-issued ID (National ID, passport, or driver's licence — both sides where applicable) and taking a facial selfie through the App. Your ID and selfie are reviewed by PaMarket staff solely to confirm your identity. Verified users build more trust with buyers and receive more enquiries. Providing false or altered documents during verification will result in immediate account termination.</p>

          <p><strong>Company Verification (required for job postings)</strong></p>
          <p>To protect job seekers from fraudulent job listings, all companies must be verified by PaMarket before they can post jobs. Verification requires submitting photos of: (1) your Certificate of Incorporation or Business Registration from CIPCC, (2) the National ID or passport of the business owner or director, (3) a valid Tax Clearance Certificate from ZIMRA, and (4) a photo of your business premises. Documents are submitted via WhatsApp and reviewed within 2 business days. Unverified accounts will see a verification prompt and cannot proceed with job posting until approved. Submitting false, expired, or edited documents is a serious offence and will result in a permanent ban and may be reported to Zimbabwean authorities.</p>

          <h2>6. Listing Rules</h2>
          <p>All listings must be honest, legal, and comply with Zimbabwean law. You must own or have explicit authority to sell any item listed. The following content is strictly prohibited and will result in immediate removal and account termination:</p>
          <ul>
            <li>Stolen, counterfeit, or fraudulent goods of any kind</li>
            <li>Weapons, firearms, ammunition, or explosive devices</li>
            <li>Illegal drugs, controlled substances, or drug paraphernalia</li>
            <li>Adult, sexually explicit, or pornographic content</li>
            <li>Protected wildlife, animal products, or endangered species</li>
            <li>Pyramid schemes, multi-level marketing, or investment fraud</li>
            <li>Fake, misleading, or non-existent job listings</li>
            <li>Fraudulent rental listings or advance deposit scams</li>
            <li>Human trafficking, exploitation, or domestic workers without consent</li>
          </ul>

          <h2>7. User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Harass, threaten, abuse, or discriminate against other users</li>
            <li>Post false, misleading, or deceptive information or images</li>
            <li>Send unsolicited messages (spam) to other users</li>
            <li>Attempt to circumvent our moderation, security, or verification systems</li>
            <li>Create multiple accounts to evade a suspension or ban</li>
            <li>Impersonate another person, business, or official entity</li>
            <li>Use automated tools to scrape or access the platform</li>
          </ul>

          <h2>8. User Content License</h2>
          <p>By posting photos, text, or any content on PaMarket, you grant us a non-exclusive, worldwide, royalty-free license to display, reproduce, and distribute that content within the App and for promotional purposes. You confirm that you own or have the rights to all content you post and that it does not infringe any third-party rights.</p>

          <h2>9. Intellectual Property</h2>
          <p>All design, branding, logos, code, and content created by PaMarket are protected by copyright and intellectual property law. You may not copy, reproduce, reverse-engineer, or redistribute any part of the App without our written consent.</p>

          <h2>10. Moderation and Enforcement</h2>
          <p>We reserve the right to remove any listing, suspend, or permanently ban any account that violates these Terms at any time, with or without notice. Serious violations including fraud, scams, or illegal activity may be reported to relevant Zimbabwean authorities. Banned users may appeal by contacting chakusaprince@gmail.com within 14 days of the ban.</p>

          <h2>11. Disclaimer of Warranties</h2>
          <p>PaMarket is provided "as is" and "as available" without any warranties, express or implied. We do not guarantee that the App will be uninterrupted, error-free, or that listings are accurate. We are not responsible for the quality, safety, legality, or availability of listed items.</p>

          <h2>12. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, PaMarket and its operators shall not be liable for any indirect, incidental, punitive, or consequential damages arising from your use of the App, including loss of money, data, or business opportunity resulting from transactions between users.</p>

          <h2>13. Governing Law</h2>
          <p>These Terms are governed exclusively by the laws of the Republic of Zimbabwe. Any legal disputes shall be subject to the jurisdiction of the courts of Zimbabwe.</p>

          <h2>14. Changes to These Terms</h2>
          <p>We may update these Terms from time to time. We will notify users of significant changes through the App. Continued use of the App after any update constitutes your acceptance of the revised Terms. You may stop using the App at any time if you disagree with the updated Terms.</p>

          <h2>15. Contact Us</h2>
          <p>For questions about these Terms, contact us at:</p>
          <ul>
            <li>Email: chakusaprince@gmail.com</li>
            <li>WhatsApp: +971 589 772 645</li>
          </ul>
        </div>
      </div>
    </div>`;
  };
pages.HelpPrivacy = function () {
    return `<div class="page active">
      ${H.innerTopbar('Privacy Policy')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Privacy Policy</h2>
          <p style="color:var(--ash);font-size:12px">Last updated: June 2026</p>

          <h2>1. Who We Are</h2>
          <p>PaMarket is a Zimbabwean marketplace application. We are committed to protecting your privacy and handling your data responsibly. This policy explains what data we collect, why we collect it, and how we protect it.</p>

          <h2>2. Data We Collect</h2>
          <ul>
            <li><strong>Account data:</strong> Name, email address, phone number, encrypted password</li>
            <li><strong>Profile data:</strong> Profile photo, bio, city/province location</li>
            <li><strong>Listing data:</strong> Photos, descriptions, prices, and location of items you post</li>
            <li><strong>Messages:</strong> In-app conversations between buyers and sellers</li>
            <li><strong>Device data:</strong> Device type, operating system version, app version</li>
            <li><strong>Usage data:</strong> Pages viewed, search queries, and listing interactions</li>
            <li><strong>Identity verification data:</strong> If you choose to verify your personal identity, we collect photos of your government-issued ID document (National ID, passport, or driver's licence — both sides where applicable) and a facial selfie photograph taken through the App. These are used solely to confirm that you are a real person and match your ID.</li>
            <li><strong>Business verification data:</strong> If you request business verification to post jobs, we collect photos of your business registration certificate, the owner or director's National ID or passport, a Tax Clearance Certificate, and a photo of your business premises. These are submitted by you through WhatsApp and reviewed by our team.</li>
          </ul>

          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To create and manage your user account</li>
            <li>To display your listings to other users across Zimbabwe</li>
            <li>To facilitate secure in-app messaging between buyers and sellers</li>
            <li>To detect, investigate, and prevent fraud and policy violations</li>
            <li>To improve the App, fix bugs, and enhance user experience</li>
            <li>To send you important notifications about your account and listings</li>
          </ul>

          <h2>4. Data We Do Not Collect</h2>
          <ul>
            <li>We do not collect your precise GPS or real-time location</li>
            <li>We do not collect payment card numbers or banking credentials</li>
            <li>We do not access your camera or photo library without your explicit action</li>
            <li>We do not collect contacts, call logs, or SMS messages</li>
          </ul>

          <h2>5. Data Sharing</h2>
          <p>We do not sell your personal data to third parties. We may share data with:</p>
          <ul>
            <li><strong>Other users:</strong> Your public profile name, phone number (if provided), and listings are visible to all users</li>
            <li><strong>Supabase:</strong> Our secure database and authentication infrastructure provider</li>
            <li><strong>Legal authorities:</strong> When required by Zimbabwean law, court order, or to protect public safety</li>
          </ul>

          <h2>6. Data Security</h2>
          <p>We implement industry-standard security: HTTPS encryption for all data in transit, encrypted password storage (never stored in plain text), row-level security on our database, and access controls. While we take all reasonable precautions, no internet system is 100% secure and we cannot guarantee absolute security of your data.</p>

          <h2>7. Identity &amp; Business Verification</h2>

          <p><strong>Individual Identity Verification (optional)</strong></p>
          <p>Any user may choose to verify their personal identity to receive a blue Verified badge on their profile and listings. When you go through identity verification, you agree to the following:</p>
          <ul>
            <li>You will be asked to upload a clear photo of a government-issued ID document — National ID card, passport, or driver's licence. If the document has two sides (e.g. National ID), both sides must be submitted.</li>
            <li>You will be asked to take a selfie photograph of your face through the App. This is compared against your ID photo to confirm you are the same person.</li>
            <li>Your ID document and selfie are transmitted securely and are only accessible to authorised PaMarket staff for verification purposes.</li>
            <li>These images are never shown to other users, never sold, and never shared with third parties except where required by Zimbabwean law.</li>
            <li>Once verified, your images are retained securely for as long as your account remains active. You may request deletion at any time by contacting us, which will remove your Verified badge.</li>
          </ul>

          <p><strong>Business Verification (required to post jobs)</strong></p>
          <p>To post job listings on PaMarket, your company must be verified. This protects job seekers from fraudulent listings. Verification is done remotely — you submit document photos to our team via WhatsApp for review. When you apply, you agree to the following:</p>
          <ul>
            <li><strong>Required documents:</strong> (1) Certificate of Incorporation or Business Registration from CIPCC, (2) National ID or passport of the business owner or director, (3) a valid Tax Clearance Certificate from ZIMRA, and (4) a photo of your business premises exterior showing any signage.</li>
            <li>All documents must be genuine, current, and unaltered. Submitting false or edited documents will result in a permanent ban and may be reported to relevant Zimbabwean authorities.</li>
            <li>Documents are used solely to confirm your business is legitimate and to display a Verified Business badge on your profile and job listings.</li>
            <li>Documents are stored securely, accessible only to authorised PaMarket staff, and are never shared with other users or third parties except where required by law.</li>
            <li>Documents are retained for as long as your Verified status is active and deleted within 30 days of account deletion or withdrawal from the programme.</li>
            <li>By submitting documents you consent to this collection and storage. You may withdraw consent at any time by contacting us, which will remove your Verified badge and disable job posting.</li>
          </ul>

          <h2>8. Camera and Photo Permissions</h2>
          <p>We request camera and photo library access only when you choose to upload a photo for a listing or your profile. The App never accesses your camera or photos passively. You may deny this permission and still use the App without photo uploads.</p>

          <h2>9. Notifications Permission</h2>
          <p>We request permission to send push notifications to alert you about new messages, listing activity, and account updates. You may disable notifications at any time in your device settings. Turning off notifications will not affect your ability to use the App.</p>

          <h2>10. Data Retention</h2>
          <p>We retain your data for as long as your account is active. When you delete your account, all personal data, listings, messages, and transaction records are permanently deleted within 30 days. Backup copies are purged within 90 days of account deletion.</p>

          <h2>11. Your Rights</h2>
          <ul>
            <li>Access and review your personal data at any time via your Profile page</li>
            <li>Correct inaccurate information through your Profile Settings</li>
            <li>Delete your account and all associated data via Settings → Delete Account</li>
            <li>Opt out of promotional notifications via Settings → Notification Preferences</li>
            <li>Withdraw consent for business verification photography at any time by contacting us</li>
            <li>Request a copy of all data we hold about you by emailing chakusaprince@gmail.com</li>
          </ul>

          <h2>12. Children's Privacy</h2>
          <p>PaMarket is strictly for users aged 18 and over. We do not knowingly collect personal data from anyone under 18. If we discover that a minor has created an account, we will immediately delete their account and all associated data. If you believe a minor is using the App, please contact us.</p>

          <h2>13. Third-Party Links</h2>
          <p>Listings may include links to WhatsApp or external websites. We are not responsible for the privacy practices or content of any third-party services. We encourage you to review their privacy policies before sharing personal information.</p>

          <h2>14. Changes to This Policy</h2>
          <p>We will notify you of material changes to this Privacy Policy through the App at least 7 days before they take effect. Continued use of the App after changes constitute your acceptance of the updated policy.</p>

          <h2>15. Contact Us</h2>
          <p>For privacy concerns, data requests, or complaints, contact us at:</p>
          <ul>
            <li>Email: chakusaprince@gmail.com</li>
            <li>WhatsApp: +971 589 772 645</li>
          </ul>
        </div>
      </div>
    </div>`;
  };
pages.HelpVerification = function () {
    return `<div class="page active">
      ${H.innerTopbar('How to Get Verified')}
      <div class="form-wrap">

        <!-- Hero -->
        <div style="background:linear-gradient(135deg,#1A3A8F 0%,#0f2460 100%);border-radius:18px;padding:22px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#F5A623" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div>
            <div style="font-size:17px;font-weight:800;color:#fff">Get Verified on PaMarket</div>
            <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:3px;line-height:1.5">Earn a blue badge — builds trust with buyers and employers.</div>
          </div>
        </div>

        <!-- Personal Verification -->
        <div class="section-box">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:34px;height:34px;border-radius:10px;background:#EFF6FF;color:#1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--text)">Personal Verification</div>
              <div style="font-size:11px;color:var(--sub)">Free · Reviewed within 24 hours</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:12px">Confirms you are a real person. Verified sellers get a blue ✓ badge — buyers trust them more.</div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0">
            <div style="width:22px;height:22px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">1</div>
            <div style="font-size:13px;color:var(--text);line-height:1.5">Open <b>Account → Verify Identity</b></div>
          </div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">2</div>
            <div style="font-size:13px;color:var(--text);line-height:1.5">Enter your ID number, tap <b>Take Selfie</b>, and upload a photo of your National ID or passport</div>
          </div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">3</div>
            <div style="font-size:13px;color:var(--text);line-height:1.5">Submit — your badge appears automatically once approved</div>
          </div>
        </div>

        <!-- Business Verification -->
        <div class="section-box" style="margin-top:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:34px;height:34px;border-radius:10px;background:#EFF6FF;color:#1A3A8F;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--text)">Business Verification</div>
              <div style="font-size:11px;color:var(--sub)">Required to post jobs · 2 business days</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:12px">Go to <b>Post a Job → Verify My Company</b> and submit these four documents via WhatsApp:</div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0">
            <div style="width:22px;height:22px;border-radius:6px;background:#EFF6FF;color:#1A3A8F;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">1</div>
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">Certificate of Incorporation</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Business registration from CIPCC</div></div>
          </div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:6px;background:#EFF6FF;color:#1A3A8F;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">2</div>
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">Owner / Director National ID or Passport</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Must match the registration documents</div></div>
          </div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:6px;background:#EFF6FF;color:#1A3A8F;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">3</div>
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">Tax Clearance Certificate</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Current and valid, issued by ZIMRA</div></div>
          </div>
          <div class="info-row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:6px;background:#EFF6FF;color:#1A3A8F;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">4</div>
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">Photo of Business Premises</div><div style="font-size:12px;color:var(--sub);margin-top:2px">Exterior showing signage (home office is acceptable)</div></div>
          </div>
        </div>

        <!-- Photo tips -->
        <div class="section-box" style="margin-top:12px">
          <div class="section-title">Tips for Clear Document Photos</div>
          <div class="info-row" style="padding:8px 0"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1A3A8F" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:13px;color:var(--sub)">Use good lighting — all text must be readable</span></div>
          <div class="info-row" style="padding:8px 0;border-top:1px solid var(--border)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1A3A8F" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:13px;color:var(--sub)">Lay documents flat, shoot straight from above</span></div>
          <div class="info-row" style="padding:8px 0;border-top:1px solid var(--border)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1A3A8F" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:13px;color:var(--sub)">No crops, edits, or filters on document photos</span></div>
          <div class="info-row" style="padding:8px 0;border-top:1px solid var(--border)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1A3A8F" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:13px;color:var(--sub)">Keep the whole document in frame — no cut-off edges</span></div>
        </div>

        <!-- Warning -->
        <div style="display:flex;gap:10px;align-items:flex-start;background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:14px;margin-top:12px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dc2626" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style="font-size:12.5px;color:#991b1b;line-height:1.55"><b>Use genuine documents only.</b> Submitting fake or edited documents leads to a permanent ban and may be reported to Zimbabwean authorities.</div>
        </div>

        <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--sub);line-height:1.6">Need help? WhatsApp <b>+971 589 772 645</b> or email chakusaprince@gmail.com</div>
        <div style="height:16px"></div>
      </div>
    </div>`;
  };

pages.HelpCommunity = function () {
    return `<div class="page active">
      ${H.innerTopbar('Community Guidelines')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Community Guidelines</h2>
          <p style="color:var(--ash);font-size:12px">Last updated: May 2026</p>
          <p>PaMarket is built on trust. These guidelines exist to keep our marketplace safe, fair, and beneficial for every Zimbabwean. Violations result in warnings, listing removal, suspension, or permanent bans.</p>

          <h2>1. Be Honest</h2>
          <p>Accuracy is everything in a marketplace. You must:</p>
          <ul>
            <li>Post accurate titles, descriptions, and photos of your actual item</li>
            <li>Disclose any defects, damage, or issues with items</li>
            <li>Only post items you genuinely have available for sale</li>
            <li>Set fair prices and honor agreed prices</li>
            <li>Never use misleading photos or stolen images</li>
          </ul>

          <h2>2. Be Safe</h2>
          <ul>
            <li>Meet buyers and sellers in safe, public locations</li>
            <li>Never send money before inspecting an item in person</li>
            <li>Be cautious of buyers who pressure you to accept unusual payment methods</li>
            <li>Never share your OTP, PIN, or banking passwords with anyone</li>
            <li>Trust your instincts — if something feels wrong, walk away</li>
          </ul>

          <h2>3. Be Respectful</h2>
          <ul>
            <li>Treat all users with dignity and respect</li>
            <li>No harassment, threats, bullying, or abusive language</li>
            <li>No discrimination based on race, gender, religion, tribe, or disability</li>
            <li>No unsolicited messages or spam to other users</li>
            <li>Respect others privacy — never share personal information without consent</li>
          </ul>

          <h2>4. No Fraud or Scams</h2>
          <p>Zero tolerance for fraud. The following will result in immediate permanent ban:</p>
          <ul>
            <li>Advance fee fraud ("send deposit first")</li>
            <li>Fake job listings designed to collect personal information</li>
            <li>Fake rental listings with non-existent properties</li>
            <li>Selling items you do not own or have no right to sell</li>
            <li>Creating multiple accounts to evade bans</li>
            <li>Any form of identity theft or impersonation</li>
          </ul>

          <h2>5. Prohibited Items</h2>
          <p>The following may never be listed on PaMarket:</p>
          <ul>
            <li>Stolen goods of any kind</li>
            <li>Counterfeit or fake branded products</li>
            <li>Weapons, ammunition, or explosives</li>
            <li>Illegal drugs or controlled substances</li>
            <li>Adult or sexually explicit content</li>
            <li>Protected wildlife or animal products</li>
            <li>Pyramid schemes or investment fraud</li>
            <li>Human trafficking or exploitation</li>
          </ul>

          <h2>6. Jobs & Rentals</h2>
          <p>High-risk categories require extra responsibility:</p>
          <ul>
            <li>Job listings must be genuine with real contact details</li>
            <li>Never charge job seekers an application or registration fee</li>
            <li>Rental listings must describe real, available properties</li>
            <li>Never request rental deposits before viewing a property</li>
            <li>Salary and rent amounts must be realistic and accurate</li>
          </ul>

          <h2>7. Reporting Violations</h2>
          <p>If you see something suspicious:</p>
          <ul>
            <li>Use the Report button on any listing or user profile</li>
            <li>Email us at chakusaprince@gmail.com for urgent matters</li>
            <li>All reports are reviewed within 24 hours</li>
            <li>3 or more reports on a listing triggers automatic review</li>
            <li>False reports made in bad faith will result in action against the reporter</li>
          </ul>

          <h2>8. Enforcement</h2>
          <ul>
            <li><strong>Warning:</strong> First minor violation</li>
            <li><strong>Listing removal:</strong> Content that violates guidelines</li>
            <li><strong>Temporary suspension (24-72 hours):</strong> Repeated minor violations</li>
            <li><strong>7-day suspension:</strong> Serious violations</li>
            <li><strong>Permanent ban:</strong> Fraud, scams, or 3+ serious violations</li>
          </ul>
          <p>Banned users may appeal by emailing chakusaprince@gmail.com with evidence. We review all appeals within 7 days.</p>

          <h2>9. Our Commitment</h2>
          <p>We are committed to making PaMarket Zimbabwe's most trusted marketplace. We review all reports, take action on violations, and continuously improve our safety systems. Together we can build a marketplace that works for everyone.</p>

          <h2>Contact Safety Team</h2>
          <p>chakusaprince@gmail.com</p>
        </div>
      </div>
    </div>`;
  };

  // --- About PaMarket -----------------------------------------
  pages.About = function () {
    const year = new Date().getFullYear();

    const sec = (title) => `<p style="font-size:16px;font-weight:800;color:var(--text);margin:28px 0 10px;letter-spacing:-.2px">${title}</p>`;

    const featureCard = ([icon, title, desc]) => `
      <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:26px;margin-bottom:7px">${icon}</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${title}</div>
        <div style="font-size:11px;color:var(--sub);line-height:1.55">${desc}</div>
      </div>`;

    const valueCard = ([icon, title, body]) => `
      <div style="display:flex;align-items:flex-start;gap:14px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:22px;flex-shrink:0;margin-top:1px">${icon}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div>
          <div style="font-size:12px;color:var(--sub);line-height:1.6">${body}</div>
        </div>
      </div>`;

    const stepCard = (num, title, body) => `
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">
        <div style="width:32px;height:32px;border-radius:50%;background:#1A3A8F;color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${num}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div>
          <div style="font-size:12px;color:var(--sub);line-height:1.6">${body}</div>
        </div>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('About PaMarket')}

      <!-- Hero -->
      <div style="background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 100%);padding:36px 20px 32px;text-align:center">
        <div style="width:72px;height:72px;background:rgba(255,255,255,.15);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-1px">Pa</div>
        <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px">Pa<span style="color:#F5A623">Market</span></div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:6px">Zimbabwe's Free Marketplace</div>
        <div style="display:flex;justify-content:center;gap:16px;margin-top:18px">
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:900;color:#F5A623">2026</div>
            <div style="font-size:10px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Founded</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.2)"></div>
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:900;color:#F5A623">10+</div>
            <div style="font-size:10px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Categories</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.2)"></div>
          <div style="text-align:center">
            <div style="font-size:18px;font-weight:900;color:#F5A623">Free</div>
            <div style="font-size:10px;color:rgba(255,255,255,.6);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Always</div>
          </div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:18px;font-weight:600">Version 2.0.0</div>
      </div>

      <div class="doc-content" style="padding-top:4px">

        ${sec('Our Story')}
        <p style="font-size:13px;color:var(--sub);line-height:1.75">PaMarket was born in 2026 out of a simple observation: Zimbabweans needed a modern, free, and reliable place to buy, sell, and connect online. Existing platforms were either too expensive, too complicated, or not built for the Zimbabwean context.</p>
        <p style="font-size:13px;color:var(--sub);line-height:1.75;margin-top:10px">We set out to build something different. PaMarket is designed from the ground up for Zimbabwe, covering all 10 provinces, supporting local pricing in USD and ZiG, and making it as easy as possible to post an ad, browse listings, and get in touch with buyers and sellers.</p>

        ${sec('Our Mission')}
        <p style="font-size:13px;color:var(--sub);line-height:1.75">To make commerce accessible to every Zimbabwean, regardless of location or budget. Buying, selling, renting, and finding work should be free and simple for everyone.</p>

        ${sec('What We Offer')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
          ${[
            ['🛒','Buy and Sell','Post ads and find deals on goods across all categories'],
            ['💼','Jobs Board','Post vacancies and find work across all industries'],
            ['🏠','Property and Rooms','Houses, flats, rooms, and commercial spaces for rent or sale'],
            ['🚗','Vehicles','Cars, trucks, motorbikes, and farming equipment'],
            ['👗','Fashion','Clothes, shoes, and accessories at local prices'],
            ['📱','Electronics','Phones, laptops, appliances, and gadgets'],
            ['🛋️','Furniture','Home furniture, office furniture, and decor'],
            ['🐾','Pets and Agriculture','Animals, livestock, seeds, and farming supplies'],
            ['🔧','Services','Plumbers, electricians, drivers, and skilled tradespeople'],
            ['👶','Baby and Kids','Baby gear, toys, and children\'s items']
          ].map(featureCard).join('')}
        </div>

        ${sec('How It Works')}
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px 16px 4px">
          ${stepCard(1, 'Create a free account', 'Sign up in seconds using your email, Google, or Apple account. No subscription fees, no hidden charges.')}
          ${stepCard(2, 'Post your listing', 'Add photos, a description, and your price. Your ad goes live instantly and reaches buyers across Zimbabwe.')}
          ${stepCard(3, 'Connect and close the deal', 'Buyers reach out via in-app messaging or WhatsApp. Arrange a viewing, negotiate, and complete the sale safely.')}
        </div>

        ${sec('Who Is PaMarket For?')}
        ${[
          ['👤', 'Individuals', 'Sell items you no longer need, find second-hand bargains, or rent out a spare room.'],
          ['🏢', 'Small Businesses', 'Promote your products and services to active buyers in your city and province.'],
          ['👔', 'Employers', 'Post job vacancies and find qualified candidates from across Zimbabwe.'],
          ['🔍', 'Job Seekers', 'Browse real job listings and apply directly through the app.'],
          ['🏗️', 'Property Owners', 'List properties and rooms for rent or sale and manage enquiries in one place.'],
          ['🚜', 'Farmers and Traders', 'Buy and sell agricultural produce, livestock, and equipment.']
        ].map(valueCard).join('')}

        ${sec('Our Values')}
        ${[
          ['🇿🇼', 'Made for Zimbabwe', 'Every feature is designed with Zimbabwean users in mind, from province-based filtering to ZiG and USD pricing support.'],
          ['🆓', 'Free to Use', 'Posting and browsing are always free. We believe access to a marketplace should not cost money.'],
          ['🔒', 'Safety First', 'We verify seller identities, moderate listings, and give users tools to report and block bad actors.'],
          ['⚡', 'Simple and Fast', 'The app is lightweight and designed to work well on any smartphone and connection speed.'],
          ['🤝', 'Community Driven', 'PaMarket grows through the trust of its community. We listen to feedback and improve constantly.']
        ].map(valueCard).join('')}

        ${sec('Legal')}
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;overflow:hidden">
          <div onclick="H.openInner('HelpPrivacy')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:var(--text)">Privacy Policy</span>
            <span style="color:var(--sub)">›</span>
          </div>
          <div onclick="H.openInner('HelpTerms')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:var(--text)">Terms of Service</span>
            <span style="color:var(--sub)">›</span>
          </div>
          <div onclick="H.openInner('HelpCommunity')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:var(--text)">Community Guidelines</span>
            <span style="color:var(--sub)">›</span>
          </div>
        </div>
        <p style="font-size:12px;color:var(--sub);line-height:1.7;margin-top:12px">PaMarket operates as a platform for user-generated listings. We do not own, sell, or warrant any items listed. Users are responsible for ensuring their listings comply with applicable Zimbabwean law. Prohibited content will be removed and accounts suspended.</p>

        ${sec('Contact Us')}
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;overflow:hidden">
          <a href="mailto:chakusaprince@gmail.com" style="display:flex;align-items:center;gap:14px;padding:14px 16px;text-decoration:none;border-bottom:1px solid var(--border)">
            <div style="width:36px;height:36px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div>
              <div style="font-size:11px;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Support Email</div>
              <div style="font-size:13px;font-weight:700;color:#1A3A8F;margin-top:2px">chakusaprince@gmail.com</div>
            </div>
          </a>
          <a href="https://wa.me/971589772645" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:14px;padding:14px 16px;text-decoration:none">
            <div style="width:36px;height:36px;border-radius:10px;background:#E8FFF2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            </div>
            <div>
              <div style="font-size:11px;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.5px">WhatsApp Support</div>
              <div style="font-size:13px;font-weight:700;color:#25D366;margin-top:2px">+971 589 772 645</div>
            </div>
          </a>
        </div>

        ${sec('Follow Us')}
        <div style="font-size:12px;color:var(--sub);margin-bottom:12px;line-height:1.6">Stay updated with the latest listings, deals and news from PaMarket Zimbabwe.</div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          ${H._socialLinks ? H._socialLinks() : ''}
        </div>

        <div style="text-align:center;padding:32px 0 8px">
          <div style="font-size:12px;color:var(--sub)">© ${year} PaMarket · Made in Zimbabwe 🇿🇼</div>
          <div style="font-size:11px;color:var(--text-hint,#bbb);margin-top:4px">Version 2.0.0 · Built with care for Zimbabwe</div>
        </div>
      </div>
    </div>`;
  };

})(window.H = window.H || {});

H.pages.LegalHub = function() {
  var sections = [
    { title: 'Terms', items: ['Terms of Use','Acceptable Use Policy','Seller Terms','Buyer Protection'] },
    { title: 'Privacy', items: ['Privacy Policy','Cookie Policy','Data Deletion','GDPR Compliance'] },
    { title: 'Platform Policies', items: ['Community Guidelines','Prohibited Items','Anti-Fraud Policy','Dispute Resolution'] }
  ];
  var emailLink = 'mailto:chakusaprince@gmail.com';
  var waLink = 'https://wa.me/971589772645';
  var html = '<div class="page active">' + H.innerTopbar('Legal Hub');
  html += '<div class="legal-hero"><div class="legal-hero-title">Welcome to<br><strong>PaMarket Legal Hub</strong></div><div class="legal-hero-sub">Legal information for PaMarket products and services</div></div>';
  sections.forEach(function(sec) {
    html += '<div class="legal-section-title">' + sec.title + '</div><div class="legal-list">';
    sec.items.forEach(function(item) { html += '<div class="legal-item"><div class="legal-item-title">' + item + '</div><div class="legal-item-arrow">&rsaquo;</div></div>'; });
    html += '</div>';
  });
  html += '<div class="legal-contact"><div class="legal-contact-title">Need to contact us?</div>';
  html += '<div class="legal-contact-body">Email: <span onclick="window.open(emailLink)" style="color:#1A3A8F;font-weight:600;cursor:pointer">chakusaprince@gmail.com</span></div>';
  html += '<div class="legal-contact-body" style="margin-top:6px">WhatsApp: <span onclick="window.open(waLink)" style="color:#25D366;font-weight:600;cursor:pointer">+971 589 772 645</span></div>';
  html += '</div>';
  html += '<div class="legal-footer"><div class="legal-footer-links">';
  ['About Us','Advertise','Terms of Use','Privacy Policy'].forEach(function(l) { html += '<span class="legal-footer-link" onclick="H.openInner(\x27About\x27)">' + l + '</span>'; });
  html += '</div><div class="legal-footer-copy">PaMarket &copy; 2026 &middot; Zimbabwe\'s #1 Free Marketplace</div></div>';
  html += '</div></div>';
  return html;
};