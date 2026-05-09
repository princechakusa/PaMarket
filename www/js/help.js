'use strict';
(function (H) {
  const pages = H.pages;

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

        <div style="height:20px"></div>
      </div>
    </div>`;
  };

  // --- FAQs -------------------------------------------------
  pages.FAQs = function () {
    const faqs = [
      {
        q: 'How do I post an ad?',
        a: 'Tap the Post Ad button at the bottom of the screen. Follow the steps to add photos, title, description, price, and location. Your ad will be reviewed before going live.'
      },
      {
        q: 'How much does it cost to post?',
        a: 'Posting an ad is completely free! We only charge for optional premium features like boosting your listing or featured placement.'
      },
      {
        q: 'How long do listings stay active?',
        a: 'Listings remain active for 30 days. You can renew your listing anytime by tapping "Renew" on My Listings.'
      },
      {
        q: 'How do I get verified?',
        a: 'Go to your Profile > Verify Identity. Upload a valid ID and we\'ll verify it within 24 hours. Verified sellers get a blue badge!'
      },
      {
        q: 'Can I edit my listing?',
        a: 'Yes! Go to My Listings, tap the listing, then tap Edit. You can change photos, price, description, and other details.'
      },
      {
        q: 'Is my information safe?',
        a: 'We use industry-standard encryption to protect your data. Your phone number and email are never shared without your permission.'
      },
      {
        q: 'How do I report inappropriate content?',
        a: 'Tap the listing, scroll to the bottom, and tap "Report". Select the reason and submit. We review all reports within 24h.'
      },
      {
        q: 'How do I block a user?',
        a: 'Tap their profile > Block User. They won\'t be able to see your listings or contact you. Manage blocked users in Settings.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept mobile money (EcoCash, OneMoney), bank transfers, and card payments. All payments are secure and verified.'
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings > Security > Delete Account. Your account and all listings will be permanently removed after 30 days.'
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
        <div class="contact-methods">
          <div class="contact-method">
            <div class="contact-icon">${S.mail}</div>
            <div class="contact-label">Email</div>
            <div class="contact-value">support@hostly.co.zw</div>
          </div>

          <div class="contact-method">
            <div class="contact-icon">${S.message}</div>
            <div class="contact-label">Live Chat</div>
            <div class="contact-value">9 AM - 5 PM (Mon-Fri)</div>
          </div>

          <div class="contact-method">
            <div class="contact-icon">${S.phone}</div>
            <div class="contact-label">Call Us</div>
            <div class="contact-value">+263 77 0000 000</div>
          </div>
        </div>

        <div class="section-title" style="margin-top:24px">Send us a message</div>
        <div class="fg">
          <div class="fl">Subject</div>
          <input class="fi" id="supportSubject" placeholder="What's your issue?">
        </div>

        <div class="fg">
          <div class="fl">Message</div>
          <textarea class="fi" rows="5" id="supportMsg" placeholder="Describe your issue in detail..."></textarea>
        </div>

        <button class="btn-pri" onclick="H._support.send()">Send Message</button>
      </div>
    </div>`;
  };

  pages.ContactSupport_after = function () {
    H._support = {
      send: () => {
        const subject = document.getElementById('supportSubject')?.value?.trim();
        const msg = document.getElementById('supportMsg')?.value?.trim();
        if (!subject || !msg) { H.toast('Please fill in all fields'); return; }
        
        H.state.supportTickets = H.state.supportTickets || [];
        H.state.supportTickets.push({
          id: H.uid(),
          userId: H.state.currentUserId,
          subject,
          message: msg,
          createdAt: Date.now(),
          status: 'open'
        });
        H.saveState();
        H.toast('Support ticket created! We\'ll respond within 24h.');
        H.goBack();
      }
    };
  };

  // --- Report Problem ---------------------------------------
  pages.ReportProblem = function () {
    return `<div class="page active">
      ${H.innerTopbar('Report a Problem')}
      <div class="form-wrap">
        <div class="fg">
          <div class="fl">Problem Type</div>
          <select class="fi" id="problemType">
            <option>-- Select --</option>
            <option>App Crash or Error</option>
            <option>Slow Performance</option>
            <option>Missing Features</option>
            <option>Payment Issues</option>
            <option>Other Technical Issue</option>
          </select>
        </div>

        <div class="fg">
          <div class="fl">Description</div>
          <textarea class="fi" rows="5" id="problemDesc" placeholder="Describe the issue and steps to reproduce..."></textarea>
        </div>

        <div class="fg">
          <div class="fl">Screenshots (optional)</div>
          <label class="img-upload-zone" for="problemScreenshot">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <div class="img-upload-title">Tap to add screenshot</div>
          </label>
          <input type="file" id="problemScreenshot" accept="image/*" capture style="display:none">
        </div>

        <button class="btn-pri" onclick="H._problems.report()">Report Issue</button>
      </div>
    </div>`;
  };

  pages.ReportProblem_after = function () {
    H._problems = {
      report: () => {
        const type = document.getElementById('problemType')?.value;
        const desc = document.getElementById('problemDesc')?.value?.trim();
        if (!type || type === '-- Select --' || !desc) { H.toast('Please fill in all fields'); return; }
        
        H.state.reports = H.state.reports || [];
        H.state.reports.push({
          id: H.uid(),
          reporterId: H.state.currentUserId,
          targetType: 'bug',
          problemType: type,
          description: desc,
          createdAt: Date.now(),
          status: 'open'
        });
        H.saveState();
        H.toast('Bug report submitted. Thank you for helping us improve!');
        H.goBack();
      }
    };
  };

  // --- Terms & Conditions ----------------------------------
  pages.HelpTerms = function () {
    return `<div class="page active">
      ${H.innerTopbar('Terms & Conditions')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Terms & Conditions</h2>
          <h3>1. Acceptance of Terms</h3>
          <p>By using the Hostly app and website, you agree to these terms and conditions. If you don't agree, please don't use our services.</p>
          <h3>2. User Responsibilities</h3>
          <p>Users are responsible for all content they post. You agree not to post illegal, defamatory, or infringing content.</p>
          <h3>3. Listing Guidelines</h3>
          <p>All listings must comply with Zimbabwean law. Prohibited items include weapons, counterfeit goods, and stolen property.</p>
          <h3>4. Payment Terms</h3>
          <p>All transactions between buyers and sellers are their responsibility. Hostly is not liable for disputed transactions.</p>
          <h3>5. Intellectual Property</h3>
          <p>All content on Hostly, including design and logos, is owned by Hostly and protected by copyright.</p>
          <h3>6. Limitation of Liability</h3>
          <p>Hostly is provided "as is" without warranties. We're not liable for indirect or consequential damages.</p>
          <h3>7. Changes to Terms</h3>
          <p>We reserve the right to modify these terms. Changes take effect immediately upon posting.</p>
        </div>
      </div>
    </div>`;
  };

  // --- Privacy Policy --------------------------------------
  pages.HelpPrivacy = function () {
    return `<div class="page active">
      ${H.innerTopbar('Privacy Policy')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Privacy Policy</h2>
          <h3>1. Information We Collect</h3>
          <p>We collect: name, phone, email, profile information, listing details, payment information, and usage data.</p>
          <h3>2. How We Use Your Information</h3>
          <p>We use your information to: provide services, process payments, prevent fraud, and improve our platform.</p>
          <h3>3. Data Protection</h3>
          <p>We use industry-standard encryption and security measures to protect your data. Your data is not shared with third parties without consent.</p>
          <h3>4. Your Rights</h3>
          <p>You have the right to access, modify, and delete your personal data. Contact support@hostly.co.zw to exercise these rights.</p>
          <h3>5. Cookies & Tracking</h3>
          <p>We use cookies to enhance your experience. You can disable cookies in your browser settings.</p>
          <h3>6. Third-Party Services</h3>
          <p>We use payment processors and analytics services. They process data according to their privacy policies.</p>
          <h3>7. Children's Privacy</h3>
          <p>Hostly is not intended for users under 18. We don't knowingly collect data from minors.</p>
          <h3>8. Contact Us</h3>
          <p>Questions about privacy? Contact us at privacy@hostly.co.zw</p>
        </div>
      </div>
    </div>`;
  };

  // --- Community Guidelines --------------------------------
  pages.HelpCommunity = function () {
    return `<div class="page active">
      ${H.innerTopbar('Community Guidelines')}
      <div class="doc-content">
        <div class="doc-section">
          <h2>Community Guidelines</h2>
          <h3>Be Honest</h3>
          <p>Provide accurate descriptions and photos. Misleading listings will be removed and may result in suspension.</p>
          <h3>Be Respectful</h3>
          <p>Treat other users with respect. Harassment, discrimination, and hate speech are not tolerated.</p>
          <h3>Be Safe</h3>
          <p>Use secure payment methods. Never send money before seeing the item. Meet in public places.</p>
          <h3>No Spam or Fraud</h3>
          <p>Don't spam, scam, or post duplicate listings. Violators will be permanently banned.</p>
          <h3>No Prohibited Items</h3>
          <p>Don't sell weapons, counterfeit goods, stolen property, or illegal items.</p>
          <h3>Respect Privacy</h3>
          <p>Don't share others' personal information. Respect confidentiality in private messages.</p>
          <h3>Report Violations</h3>
          <p>See something wrong? Use the Report button. We investigate all reports within 24h.</p>
          <h3>Consequences</h3>
          <p>Violations result in warnings, listing removal, temporary suspension, or permanent ban depending on severity.</p>
        </div>
      </div>
    </div>`;
  };

})(window.H = window.H || {});