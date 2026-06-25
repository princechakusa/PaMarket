/*!
 * PaMarket — Legal Hub
 * © 2026 PaMarket Zimbabwe. All rights reserved.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  const chevron = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';

  function docRow(icon, label, page) {
    return `<button onclick="H.openInner('${page}')" style="display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:var(--card);border:none;border-bottom:1px solid var(--border);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <div style="width:36px;height:36px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F">${icon}</div>
      <span style="flex:1;font-size:14px;font-weight:600;color:var(--text)">${label}</span>
      <span style="color:var(--sub)">${chevron}</span>
    </button>`;
  }

  const ICONS = {
    doc:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    users:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    ban:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    brief:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
    cookie: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="14" cy="14" r="1" fill="currentColor"/></svg>',
    mail:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  };

  // ── Legal Hub (main page) ─────────────────────────────────
  pages.LegalHub = function () {
    const socials = [
      { name: 'Facebook',  url: 'https://www.facebook.com/profile.php?id=61591000371129',  bg: '#1877F2', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z"/></svg>' },
      { name: 'Instagram', url: 'https://www.instagram.com/pamarketzim/',                   bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>' },
      { name: 'TikTok',   url: 'https://www.tiktok.com/@pamarketzimbabwe',                  bg: '#010101', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.07v12.2a2.43 2.43 0 1 1-2.43-2.43c.2 0 .4.02.59.06v-3.13a5.57 5.57 0 0 0-.59-.03 5.56 5.56 0 1 0 5.56 5.56V9.01a7.33 7.33 0 0 0 4.28 1.37V7.3a4.28 4.28 0 0 1-3.3-1.48z"/></svg>' },
      { name: 'YouTube',  url: 'https://www.youtube.com/@PaMarketZim',                      bg: '#FF0000', svg: '<svg viewBox="0 0 24 24" width="20" height="18" fill="#fff"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7l5.7 3.3z"/></svg>' },
      { name: 'X',        url: 'https://twitter.com/PaMarketZim',                           bg: '#000000', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.902-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
      { name: 'LinkedIn', url: 'https://www.linkedin.com/company/pamarket',                  bg: '#0A66C2', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>' },
      { name: 'WhatsApp', url: 'https://wa.me/971589772645',                                 bg: '#25D366', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>' },
    ];

    const socialRow = socials.map(s =>
      `<a href="${s.url}" onclick="event.preventDefault();(window.open('${s.url}','_blank','noopener'))" title="${s.name}"
         style="width:40px;height:40px;border-radius:50%;background:${s.bg};display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 2px 8px -2px rgba(0,0,0,.35);flex-shrink:0">
         ${s.svg}
       </a>`
    ).join('');

    return `<div class="page active">
      ${H.innerTopbar('Legal Hub')}

      <!-- Hero -->
      <div style="margin:0 16px 20px;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 60%,#1e4db7 100%);padding:28px 22px 24px;position:relative">
        <div style="position:absolute;top:-18px;right:-18px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
        <div style="position:absolute;bottom:-28px;right:22px;width:80px;height:80px;border-radius:50%;background:rgba(245,166,35,.12)"></div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:8px">PaMarket Zimbabwe</div>
        <div style="font-size:22px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:8px">Legal Hub</div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);line-height:1.55">Transparency is at the core of everything we build. Find all our policies, terms, and guidelines in one place.</div>
      </div>

      <!-- Core Agreements -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Core Agreements</div>
      <div style="margin:0 16px 20px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;overflow:hidden">
        ${docRow(ICONS.doc, 'Terms of Use', 'HelpTerms')}
        ${docRow(ICONS.shield, 'Privacy Policy', 'HelpPrivacy')}
      </div>

      <!-- Platform Rules -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Platform Rules</div>
      <div style="margin:0 16px 20px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;overflow:hidden">
        ${docRow(ICONS.users, 'Community Guidelines', 'HelpCommunity')}
        ${docRow(ICONS.ban, 'Acceptable Use Policy', 'LegalAUP')}
        ${docRow(ICONS.brief, 'Job Platform Terms', 'LegalJobsTerms')}
        ${docRow(ICONS.cookie, 'Cookie &amp; Data Policy', 'LegalCookies')}
      </div>

      <!-- Contact -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Need Help?</div>
      <div style="margin:0 16px 20px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:16px">
        <div style="font-size:13px;color:var(--sub);line-height:1.6;margin-bottom:14px">For questions about our terms or how we handle your data, contact us directly.</div>
        <a href="mailto:support@pamarket.app" style="display:flex;align-items:center;gap:12px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--border)">
          <div style="width:34px;height:34px;border-radius:9px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;color:#1A3A8F;flex-shrink:0">${ICONS.mail}</div>
          <div>
            <div style="font-size:11px;color:var(--sub);font-weight:500">General &amp; Terms enquiries</div>
            <div style="font-size:13px;font-weight:700;color:#1A3A8F">support@pamarket.app</div>
          </div>
        </a>
        <a href="mailto:privacy@pamarket.app" style="display:flex;align-items:center;gap:12px;padding:10px 0;text-decoration:none">
          <div style="width:34px;height:34px;border-radius:9px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;color:#1A3A8F;flex-shrink:0">${ICONS.shield}</div>
          <div>
            <div style="font-size:11px;color:var(--sub);font-weight:500">Privacy &amp; data enquiries</div>
            <div style="font-size:13px;font-weight:700;color:#1A3A8F">privacy@pamarket.app</div>
          </div>
        </a>
      </div>

      <!-- Social -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Follow PaMarket</div>
      <div style="margin:0 16px 24px;display:flex;flex-wrap:wrap;gap:12px">${socialRow}</div>

      <!-- Footer -->
      <div style="text-align:center;padding:8px 16px 36px">
        <div style="font-size:11px;color:var(--sub)">© ${new Date().getFullYear()} PaMarket Zimbabwe · Made in Zimbabwe</div>
        <div style="font-size:10px;color:var(--sub);margin-top:4px">All rights reserved</div>
      </div>
    </div>`;
  };

  // ── Acceptable Use Policy ─────────────────────────────────
  pages.LegalAUP = function () {
    const section = (title, body) =>
      `<div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">${title}</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.65">${body}</div>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('Acceptable Use Policy')}
      <div style="padding:16px">
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:18px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Effective date</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">1 January 2026</div>
        </div>

        <div style="font-size:13px;color:var(--sub);line-height:1.65;margin-bottom:20px">This Acceptable Use Policy ("AUP") sets out what you may and may not do when using PaMarket. By accessing or using PaMarket you agree to this AUP in full. Violations may result in content removal, account suspension, or referral to law enforcement.</div>

        ${section('1. Prohibited Listings', `You may not list, offer, or advertise:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>Illegal drugs, controlled substances, or drug paraphernalia</li>
            <li>Unlicensed firearms, weapons, ammunition, or explosives</li>
            <li>Stolen goods or items obtained through fraud</li>
            <li>Counterfeit, pirated, or trademark-infringing products</li>
            <li>Human trafficking, escort services, or sexual content</li>
            <li>Protected wildlife or endangered species products</li>
            <li>Prescription medicines or regulated medical devices without authority</li>
            <li>Items whose sale is prohibited under Zimbabwean law</li>
          </ul>`)}

        ${section('2. Prohibited Conduct', `You may not:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>Post false, misleading, or deceptive listings</li>
            <li>Impersonate any person, business, or authority</li>
            <li>Harvest other users' personal data without consent</li>
            <li>Send spam, unsolicited messages, or automated bulk messages</li>
            <li>Attempt to bypass, disable, or circumvent any platform security feature</li>
            <li>Use PaMarket to facilitate money laundering or financial fraud</li>
            <li>Create multiple accounts to evade a ban</li>
            <li>Charge job seekers any fee to apply, register, or be placed — this is illegal under Zimbabwean labour law</li>
          </ul>`)}

        ${section('3. Content Standards', `All content you post must:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>Be accurate and not misleading</li>
            <li>Not contain hate speech, discriminatory language, or incitement</li>
            <li>Not contain pornographic, graphic, or violent material</li>
            <li>Not infringe any third-party intellectual property rights</li>
            <li>Be in a language we can moderate (primarily English or Shona/Ndebele)</li>
          </ul>`)}

        ${section('4. Enforcement', `PaMarket may at its sole discretion remove any content and suspend or permanently ban any account that violates this AUP without prior notice. Serious violations — including fraud, illegal listings, or criminal activity — will be referred to the Zimbabwe Republic Police and other competent authorities, including provision of user data under valid legal process.`)}

        ${section('5. Reporting Violations', `Report a listing using the flag icon on any listing detail page. Report a user by tapping their name on a listing or in Messages and selecting "Report". Our moderation team reviews reports 7 days a week.`)}

        ${section('6. Contact', `Questions about this AUP: <a href="mailto:support@pamarket.app" style="color:#1A3A8F;font-weight:600">support@pamarket.app</a>`)}
      </div>
    </div>`;
  };

  // ── Job Platform Terms ────────────────────────────────────
  pages.LegalJobsTerms = function () {
    const section = (title, body) =>
      `<div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">${title}</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.65">${body}</div>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('Job Platform Terms')}
      <div style="padding:16px">
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:18px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Effective date</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">1 January 2026</div>
        </div>

        <div style="font-size:13px;color:var(--sub);line-height:1.65;margin-bottom:20px">These Job Platform Terms apply in addition to our main Terms of Use and govern use of the PaMarket jobs feature by both employers and job seekers.</div>

        ${section('1. Employer Verification', `Before posting a job, your company or sole trader profile must be verified by PaMarket. Verification requires your Certificate of Incorporation (or National ID for sole traders), a ZIMRA Tax Clearance Certificate, a photo of your business premises, and a valid owner ID. Verification is reviewed within 2 business days. Submitting false documents will result in permanent account suspension and may be referred to the Zimbabwe Republic Police.`)}

        ${section('2. Employer Obligations', `As an employer you agree to:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>Post only genuine vacancies that exist within your organisation</li>
            <li><strong>Never charge job seekers any fee</strong> to apply, register, train, complete a test, or be placed — this constitutes unlawful recruitment under the Labour Act [Chapter 28:01] of Zimbabwe and grounds for immediate permanent account suspension and police referral</li>
            <li>Provide an accurate job title, salary range (where applicable), location, and description</li>
            <li>Respond to applicants in a timely and professional manner</li>
            <li>Remove or mark closed any vacancy that has been filled</li>
            <li>Comply with Zimbabwean employment and anti-discrimination law</li>
          </ul>`)}

        ${section('3. Job Seeker Obligations', `As a job seeker you agree to:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>Provide accurate information in your CV and job profile</li>
            <li>Apply only for roles you genuinely intend to pursue</li>
            <li>Not submit false qualifications, references, or work history</li>
            <li>Not use automated tools to mass-apply to listings</li>
          </ul>`)}

        ${section('4. Prohibited Job Content', `The following are not permitted on the PaMarket jobs platform:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>Any listing that charges applicants a fee</li>
            <li>Multi-level marketing or pyramid scheme recruitment</li>
            <li>Listings for illegal activities</li>
            <li>Fraudulent "work from home" scams</li>
            <li>Misleading salary or commission structures</li>
          </ul>`)}

        ${section('5. PaMarket Role', `PaMarket is a platform that connects employers and job seekers. We do not screen candidates, guarantee employment, or act as a recruitment agency. We are not a party to any employment contract formed between an employer and a job seeker. PaMarket is not liable for any hiring decision, employment dispute, or loss arising from use of the jobs feature.`)}

        ${section('6. Contact', `For questions about the jobs platform: <a href="mailto:support@pamarket.app" style="color:#1A3A8F;font-weight:600">support@pamarket.app</a>`)}
      </div>
    </div>`;
  };

  // ── Cookie & Data Policy ──────────────────────────────────
  pages.LegalCookies = function () {
    const section = (title, body) =>
      `<div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">${title}</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.65">${body}</div>
      </div>`;

    return `<div class="page active">
      ${H.innerTopbar('Cookie & Data Policy')}
      <div style="padding:16px">
        <div style="background:var(--card);border:1.5px solid var(--border);border-radius:14px;padding:18px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Effective date</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">1 January 2026</div>
        </div>

        <div style="font-size:13px;color:var(--sub);line-height:1.65;margin-bottom:20px">This policy explains what cookies and local storage are, how PaMarket uses them, and what choices you have.</div>

        ${section('1. What Are Cookies?', `Cookies are small text files stored on your device when you visit a website or use an app. They help us remember your preferences and keep you signed in. PaMarket is primarily a mobile app — we use device local storage (equivalent to cookies) rather than traditional browser cookies.`)}

        ${section('2. What We Store Locally', `
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 4px;font-weight:700;color:var(--text);width:40%">Item</td>
              <td style="padding:8px 4px;font-weight:700;color:var(--text)">Purpose</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 4px">Authentication session</td>
              <td style="padding:8px 4px">Keeps you signed in between app sessions</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 4px">App preferences</td>
              <td style="padding:8px 4px">Theme, language, notification settings</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 4px">Recently viewed listings</td>
              <td style="padding:8px 4px">Enables your "Recently Viewed" history</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 4px">Recent searches</td>
              <td style="padding:8px 4px">Powers search suggestions and your activity page</td>
            </tr>
            <tr>
              <td style="padding:8px 4px">Cached feed data</td>
              <td style="padding:8px 4px">Reduces data usage by caching listing previews</td>
            </tr>
          </table>`)}

        ${section('3. What We Do Not Do', `
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li>We do not use third-party advertising trackers</li>
            <li>We do not sell your browsing data to third parties</li>
            <li>We do not use fingerprinting or cross-site tracking</li>
            <li>We do not share data with data brokers</li>
          </ul>`)}

        ${section('4. Third-Party Services', `PaMarket uses the following third-party services that may store data on your device:
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li><strong>Supabase</strong> — authentication and database (stores your JWT session token locally)</li>
            <li><strong>Cloudflare</strong> — CDN, security, and image delivery</li>
            <li><strong>Firebase (optional)</strong> — push notifications on Android</li>
          </ul>
          Each of these services operates under its own privacy policy. We choose providers that comply with GDPR and applicable data protection standards.`)}

        ${section('5. Your Choices', `
          <ul style="margin:8px 0 0 18px;line-height:2">
            <li><strong>Clear local data:</strong> Sign out of PaMarket to clear your session. Clearing app storage in your device settings removes all locally stored data.</li>
            <li><strong>Recently Viewed:</strong> Clear your history in Account → My Activity.</li>
            <li><strong>Recent Searches:</strong> Clear individual searches or all searches in Account → My Activity.</li>
            <li><strong>Delete account:</strong> Go to Settings → Security → Delete Account to permanently remove all your data from our servers.</li>
          </ul>`)}

        ${section('6. Data Retention', `Local storage on your device persists until you sign out, clear app data, or uninstall the app. Data stored on our servers is retained according to our Privacy Policy. Account data is deleted within 30 days of an account deletion request.`)}

        ${section('7. Contact', `For cookie or data enquiries: <a href="mailto:privacy@pamarket.app" style="color:#1A3A8F;font-weight:600">privacy@pamarket.app</a>`)}

        <div style="height:20px"></div>
      </div>
    </div>`;
  };

})(window.H = window.H || {});
