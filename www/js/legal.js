/*!
 * PaMarket — Legal Hub v2
 * © 2026 PaMarket Zimbabwe. All rights reserved.
 */
'use strict';
(function (H) {
  const pages = H.pages;

  // ── SVG helpers ──────────────────────────────────────────
  const IC = {
    back:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>',
    search:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    chevron:  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>',
    doc:      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    shield:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    users:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    ban:      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    brief:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    cookie:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="8" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/><circle cx="14" cy="14" r="1.2" fill="currentColor"/></svg>',
    cart:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    refund:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>',
    warn:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    lock:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    flag:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    star:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    car:      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    home:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    check:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    zap:      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    mail:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    bug:      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4c0 3.3-2.7 6-6 6z"/></svg>',
  };

  // ── Document content helpers ─────────────────────────────
  function _s(num, title, body) {
    return `<div style="margin-bottom:24px"><div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">${num}. ${title}</div><div style="font-size:13px;color:var(--sub);line-height:1.75">${body}</div></div>`;
  }
  function _li(items) {
    return '<ul style="margin:8px 0 0 20px;line-height:2.1">' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
  }
  function _p(text) { return `<p style="margin:0 0 10px">${text}</p>`; }
  function _dateChip(d) {
    return `<div style="display:inline-flex;align-items:center;gap:6px;background:#EEF2FF;border:1px solid #C7D7FE;border-radius:8px;padding:6px 12px;margin-bottom:18px">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1A3A8F" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <span style="font-size:11px;font-weight:700;color:#1A3A8F">Last updated: ${d}</span>
    </div>`;
  }
  function _contactLine() {
    return `<div style="margin-top:8px;font-size:13px;color:var(--sub)">Questions? Email <a href="mailto:support@pamarket.app" style="color:#1A3A8F;font-weight:700">support@pamarket.app</a></div>`;
  }

  // ── Document content functions ───────────────────────────

  function _docAUP() {
    return _dateChip('1 January 2026')
      + _p('This Acceptable Use Policy ("AUP") defines what you may and may not do on PaMarket. It applies to all users — buyers, sellers, employers, and visitors. Violations may result in content removal, account suspension, or referral to law enforcement.')
      + _s(1, 'Prohibited Listings', 'You may not list, offer, or facilitate the sale of:' + _li([
          'Illegal drugs, controlled substances, or drug paraphernalia',
          'Unlicensed firearms, weapons, ammunition, or explosives of any kind',
          'Stolen goods or items obtained through fraud or theft',
          'Counterfeit, pirated, or trademark-infringing products',
          'Human beings, human organs, or exploitation services',
          'Protected wildlife, endangered species, or their products',
          'Prescription medicines or medical devices without proper authority',
          'Alcohol or tobacco products sold to anyone under 18',
          'Any item whose sale is prohibited under Zimbabwean law'
        ]))
      + _s(2, 'Prohibited Conduct', 'You may not:' + _li([
          'Post false, misleading, or deceptive listings or descriptions',
          'Impersonate any person, business, government official, or authority',
          'Harvest, scrape, or collect other users\' personal data without consent',
          'Send spam, unsolicited commercial messages, or bulk automated messages',
          'Attempt to bypass, disable, or circumvent any security or verification feature',
          'Use PaMarket to facilitate money laundering, hawala transfers, or financial fraud',
          'Create multiple accounts to circumvent a ban or platform restrictions',
          'Interfere with, disrupt, or place excessive load on PaMarket servers',
          'Charge job seekers any fee to apply, register, train, or be placed — this is illegal under Zimbabwean labour law'
        ]))
      + _s(3, 'Content Standards', 'All content you post must:' + _li([
          'Be accurate and not misleading in any material way',
          'Not contain hate speech, discriminatory language, or incitement to violence',
          'Not contain pornographic, explicit, or violent material',
          'Not infringe any third-party intellectual property, copyright, or trademark',
          'Not contain malware, viruses, phishing links, or harmful code',
          'Not reference or advertise external competitor platforms to poach users'
        ]))
      + _s(4, 'Fraud Prevention', _p('PaMarket takes fraud seriously. The following are automatic grounds for permanent suspension and police referral:') + _li([
          'Accepting payment for goods you do not intend to deliver',
          'Requesting advance payment for a job or service without delivery',
          'Posing as a landlord or property agent to steal rental deposits',
          'Creating fake listings to collect contact details',
          'Identity theft or impersonation of another verified user'
        ]))
      + _s(5, 'Enforcement Actions', _p('Violations of this AUP may result in any combination of the following:') + _li([
          '<strong>Warning</strong> — for minor or first-time violations',
          '<strong>Content removal</strong> — listing removed without notice',
          '<strong>Temporary suspension</strong> — 7 to 30 days for repeated violations',
          '<strong>Permanent ban</strong> — for serious, intentional, or criminal violations',
          '<strong>Law enforcement referral</strong> — for fraud, illegal items, or criminal activity, including full cooperation with the Zimbabwe Republic Police and POTRAZ'
        ]))
      + _s(6, 'Reporting Violations', _p('Use the flag icon on any listing or user profile to report. Our moderation team reviews reports 7 days a week, typically within 24 hours for urgent cases.') + _contactLine());
  }

  function _docCookie() {
    return _dateChip('1 January 2026')
      + _p('This Cookie & Data Policy explains what data PaMarket stores on your device, how we use it, and the controls you have. PaMarket is a mobile-first app — we primarily use device local storage rather than browser cookies.')
      + _s(1, 'What We Store Locally', '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px"><tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 4px;font-weight:700;color:var(--text)">Item</td><td style="padding:8px 4px;font-weight:700;color:var(--text)">Purpose</td><td style="padding:8px 4px;font-weight:700;color:var(--text)">Stored until</td></tr><tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 4px">Auth session token</td><td style="padding:8px 4px">Keeps you signed in</td><td style="padding:8px 4px">Sign out or expiry</td></tr><tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 4px">App preferences</td><td style="padding:8px 4px">Theme, language, notification settings</td><td style="padding:8px 4px">Until changed</td></tr><tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 4px">Recently viewed</td><td style="padding:8px 4px">Your listing history</td><td style="padding:8px 4px">Until cleared</td></tr><tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 4px">Recent searches</td><td style="padding:8px 4px">Search suggestions</td><td style="padding:8px 4px">Until cleared</td></tr><tr><td style="padding:8px 4px">Cached listing data</td><td style="padding:8px 4px">Faster loading, reduced data use</td><td style="padding:8px 4px">App restart</td></tr></table>')
      + _s(2, 'Analytics & Performance', _p('We collect anonymised usage data to understand how the app is used and where we can improve. This includes:') + _li([
          'Screen views and navigation paths (no personal data attached)',
          'Error logs to diagnose app crashes and failures',
          'Performance metrics — load times, network latency',
          'Feature usage counts — e.g. how many times the search is used'
        ]) + _p('This data is aggregated and cannot identify individual users.'))
      + _s(3, 'Session Management', _p('Your authentication session is managed by Supabase, our backend provider. Sessions automatically expire after 7 days of inactivity. You can end your session at any time by signing out. For security, we may terminate sessions that show signs of compromise without notice.'))
      + _s(4, 'Third-Party Services', 'We use these services that may process data:' + _li([
          '<strong>Supabase</strong> — authentication, database, and file storage (ISO 27001 compliant)',
          '<strong>Cloudflare R2</strong> — image and document storage (encrypted at rest)',
          '<strong>Firebase Cloud Messaging</strong> — push notifications on Android (optional)',
          '<strong>Cloudflare CDN</strong> — content delivery and DDoS protection'
        ]) + _p('Each service operates under its own privacy policy. We select providers that comply with GDPR and modern data protection standards.'))
      + _s(5, 'What We Do Not Do', 'We never:' + _li([
          'Sell your data to advertisers or data brokers',
          'Use third-party advertising trackers or retargeting pixels',
          'Share your personal information with other PaMarket users without your consent',
          'Use fingerprinting, cross-device tracking, or behavioural profiling for advertising'
        ]))
      + _s(6, 'Your Controls', _li([
          '<strong>Clear recently viewed:</strong> Account → My Activity → Clear',
          '<strong>Clear search history:</strong> Account → My Activity → Clear all',
          '<strong>Sign out:</strong> Ends your session and clears local auth token',
          '<strong>Delete account:</strong> Settings → Security → Delete Account — permanently removes all your data from our servers within 30 days'
        ]))
      + _s(7, 'User Consent', _p('By continuing to use PaMarket you consent to the local storage practices described in this policy. For significant changes to how we handle your data, we will notify you via an in-app notification before the change takes effect.') + _contactLine());
  }

  function _docJobsTerms() {
    return _dateChip('1 January 2026')
      + _p('These Job Platform Terms govern use of the PaMarket jobs feature by all employers and job seekers. They supplement our main Terms of Use and are binding on all users of the jobs module.')
      + _s(1, 'Employer Verification', _p('Before posting a job, your company or sole trader profile must be verified. Verification requires:') + _li([
          'Certificate of Incorporation (companies) or National ID (sole traders)',
          'Current ZIMRA Tax Clearance Certificate',
          'Valid photo ID of the business owner or authorised representative',
          'A photo of the physical business premises',
          'Company name matching your ZIMRA and CRBZ registration'
        ]) + _p('Verification is reviewed within 2 business days. Submitting false or doctored documents is a criminal offence and will result in permanent suspension and referral to the Zimbabwe Republic Police.'))
      + _s(2, 'Employer Obligations', 'As a verified employer you agree to:' + _li([
          'Post only genuine vacancies that exist within your organisation',
          '<strong>Never charge job seekers any fee</strong> to apply, register, attend an interview, complete a test, purchase equipment, or be placed — this is unlawful recruitment under the Labour Act [Chapter 28:01] and grounds for immediate permanent ban and police referral',
          'Provide an honest job title, accurate salary range or "competitive", correct location, and clear role description',
          'Not post the same vacancy more than once in the same 30-day period',
          'Respond to applicants within a reasonable timeframe',
          'Remove or mark any vacancy as "Filled" within 3 days of hiring',
          'Comply with all applicable Zimbabwean employment, health and safety, and anti-discrimination law'
        ]))
      + _s(3, 'Job Seeker Obligations', 'As a job seeker you agree to:' + _li([
          'Provide honest and accurate information in your CV, profile, and applications',
          'Apply only for roles you genuinely intend to pursue',
          'Not submit false qualifications, certifications, or work history',
          'Not use automated bots or scripts to mass-apply to listings',
          'Treat employers with professional respect in all communications'
        ]))
      + _s(4, 'Anti-Scam Protection', _p('PaMarket prohibits:') + _li([
          'Any job listing that directly or indirectly requests money from applicants',
          'Multi-level marketing, pyramid schemes, or commission-only recruitment disguised as employment',
          'Work-from-home schemes requiring upfront equipment or registration fees',
          'Fake company listings designed to harvest personal data',
          'Listings offering unusually high salaries for unskilled roles (a common fraud indicator)'
        ]) + _p('If an employer requests money from you at any stage, report it immediately using the flag icon. Do not pay. PaMarket will never contact you asking for money.'))
      + _s(5, 'Data Handling for Job Applications', _p('When you apply for a job, your CV and contact details are shared only with the verified employer who posted the vacancy. PaMarket does not sell applicant data. Employers must not use applicant data for any purpose other than the specific vacancy applied for.'))
      + _s(6, 'Platform Liability', _p('PaMarket is a platform connecting employers and job seekers. We do not screen candidates, guarantee employment outcomes, or act as a recruitment agency. PaMarket is not a party to any employment contract formed between an employer and a job seeker, and is not liable for any hiring decision, employment dispute, workplace injury, or loss arising from use of the jobs feature.') + _contactLine());
  }

  function _docBuyingSelling() {
    return _dateChip('1 January 2026')
      + _p('These Buying & Selling Terms govern all marketplace transactions on PaMarket. By posting a listing or contacting a seller you agree to these terms.')
      + _s(1, 'Seller Responsibilities', 'All sellers must:' + _li([
          'Own the item outright or have legal authority to sell it',
          'List only genuine items that are physically available and in your possession',
          'Provide an accurate description including condition (new, used, damaged)',
          'Upload real photos of the actual item — not stock photos or images from the internet',
          'Set a fair and honest price in USD or ZiG',
          'Disclose any known defects, damage, or faults clearly in the description',
          'Respond to buyer enquiries within a reasonable time',
          'Remove listings immediately once an item is sold',
          'Meet buyers only in a safe, public place for in-person exchanges'
        ]))
      + _s(2, 'Buyer Responsibilities', 'All buyers must:' + _li([
          'Inspect items thoroughly before paying — all sales are final unless otherwise agreed',
          'Never send money before seeing and verifying the item in person',
          'Negotiate respectfully — do not harass sellers with unreasonable offers',
          'Report suspicious listings using the flag icon rather than proceeding with a risky transaction',
          'Understand that PaMarket does not process or hold payments on your behalf'
        ]))
      + _s(3, 'Payment', _p('PaMarket does not process, hold, or guarantee any payment. All payments are arranged directly between buyer and seller. Common methods include:') + _li([
          'Cash on collection (recommended for in-person meetups)',
          'EcoCash or OneMoney (verify receipt before releasing item)',
          'Bank transfer (verify cleared funds before releasing item)',
          'Zipit or RTGS'
        ]) + _p('<strong>Never use Western Union, gift cards, or cryptocurrency to pay for PaMarket listings.</strong> These are almost always scams.'))
      + _s(4, 'Prohibited Items in Listings', _p('See our Acceptable Use Policy and Prohibited Items Policy for the full list. Key items you may not sell include: illegal drugs, weapons, stolen goods, counterfeit products, and any item prohibited under Zimbabwean law.'))
      + _s(5, 'Price & Currency', _p('Listings may be priced in USD or ZiG. PaMarket displays an approximate ZiG equivalent using our published exchange rate, which is updated regularly but may not reflect the exact interbank or market rate at time of transaction. The agreed price between buyer and seller governs — PaMarket\'s displayed rate is for reference only.'))
      + _s(6, 'Listing Duration & Renewal', _li([
          'Listings remain active for 30 days from the date of posting',
          'You may renew any listing at any time from My Listings — this resets the 30-day timer and moves your listing back to the top',
          'PaMarket may remove listings that violate our policies without notice or prior warning',
          'Listings that have been inactive for 90 days may be archived automatically'
        ]))
      + _s(7, 'Platform Role & Liability', _p('PaMarket is a classified advertising platform. We do not inspect items, guarantee descriptions, mediate disputes, or take responsibility for the quality, legality, or safety of any item listed. All transactions are between private parties. Use good judgement and always inspect before you pay.') + _contactLine());
  }

  function _docRefund() {
    return _dateChip('1 January 2026')
      + _p('PaMarket is a free classified advertising platform — we do not process payments or hold funds. This policy explains how to handle disputes and what PaMarket can and cannot do.')
      + _s(1, 'PaMarket\'s Role in Disputes', _p('PaMarket is not a party to any transaction between a buyer and a seller. We do not hold escrow, process payments, or guarantee delivery. As a result, we cannot:') + _li([
          'Force a seller to issue a refund',
          'Retrieve money paid to another user',
          'Guarantee that a transaction will be completed',
          'Act as an arbitrator in a payment dispute'
        ]))
      + _s(2, 'When a Deal Goes Wrong', _p('If you believe you have been defrauded:') + _li([
          '<strong>Report the listing</strong> — use the flag icon on the listing. We will investigate and may remove the seller\'s account',
          '<strong>Block the user</strong> — prevent further contact from the seller',
          '<strong>Contact support</strong> — email support@pamarket.app with full details including screenshots',
          '<strong>Report to police</strong> — for fraud involving money or goods, file a report with the Zimbabwe Republic Police. PaMarket will cooperate fully with law enforcement',
          '<strong>Contact your bank or mobile money provider</strong> — for EcoCash/OneMoney disputes, contact the provider directly as soon as possible'
        ]))
      + _s(3, 'Seller Refund Obligations', _p('While PaMarket cannot legally compel a seller to refund, sellers who:') + _li([
          'Take payment and do not deliver goods',
          'Deliver goods materially different from their listing description',
          'Accept deposits for items they do not own or cannot deliver'
        ]) + _p('...are in breach of our Terms of Use and Zimbabwean consumer protection law. Confirmed cases will result in permanent account suspension and may be referred to the Zimbabwe Republic Police.'))
      + _s(4, 'PaMarket Boost & Subscription Refunds', _p('For paid services within the PaMarket app (boosted listings, business subscriptions):') + _li([
          'Refund requests must be submitted within 7 days of payment to support@pamarket.app',
          'Refunds are processed within 10 business days if approved',
          'Services already delivered (e.g. a completed boost campaign) are non-refundable',
          'Technical issues or errors that prevented delivery of a paid service qualify for a full refund'
        ]))
      + _s(5, 'Safety Tips to Avoid Disputes', _li([
          'Always inspect the item before paying — even a partial inspection helps',
          'Never pay a deposit for an item you have not seen unless you know the seller personally',
          'Use in-person cash transactions where possible for high-value items',
          'If a deal feels too good to be true, report it and walk away'
        ]) + _contactLine());
  }

  function _docServiceTerms() {
    return _dateChip('1 January 2026')
      + _p('These Service Platform Terms apply to all users who advertise or hire services on PaMarket, including domestic services, professional services, repairs, transport, and freelance work.')
      + _s(1, 'For Service Providers', 'By advertising a service on PaMarket you agree to:' + _li([
          'Provide services honestly matching your advertised description and pricing',
          'Hold any required licences, certifications, or registrations for regulated services (e.g. electrical, plumbing, medical)',
          'Not quote one price and charge another without prior agreement',
          'Meet clients in a safe, agreed location for any in-person service',
          'Protect client privacy and not share personal information obtained through PaMarket',
          'Not sub-contract services to a third party without the client\'s knowledge'
        ]))
      + _s(2, 'For Service Clients', 'When hiring a service through PaMarket you agree to:' + _li([
          'Clearly communicate your requirements before agreeing to a price',
          'Not demand services beyond what was agreed without additional payment',
          'Provide a safe working environment for service providers visiting your premises',
          'Pay in full upon satisfactory completion unless otherwise agreed in writing'
        ]))
      + _s(3, 'Regulated & Professional Services', _p('For services regulated under Zimbabwean law (medical, legal, financial, electrical, plumbing, security), service providers must:') + _li([
          'Hold and display their relevant professional registration or licence number in their listing',
          'Ensure they have valid professional indemnity insurance where applicable',
          'Comply with all applicable professional conduct standards'
        ]) + _p('PaMarket does not verify professional licences. Clients are responsible for verifying credentials before engaging any regulated service provider.'))
      + _s(4, 'Platform Liability', _p('PaMarket provides a space for service providers and clients to connect. We do not vet, endorse, or take responsibility for the quality, legality, or safety of any service advertised. We are not liable for any loss, injury, property damage, or dispute arising from services arranged through the platform.'))
      + _s(5, 'Prohibited Service Listings', 'You may not advertise:' + _li([
          'Illegal services of any kind',
          'Services constituting employment (use the Jobs section instead)',
          'Pyramid scheme recruitment or MLM onboarding',
          'Services that violate our Acceptable Use Policy'
        ]) + _contactLine());
  }

  function _docFraud() {
    return _dateChip('1 January 2026')
      + _p('PaMarket is committed to being a safe platform for Zimbabweans to buy, sell, and find work. This policy explains how we detect and prevent fraud, and how you can protect yourself.')
      + _s(1, 'Common Scams on Classified Platforms', _p('Be alert to:') + _li([
          '<strong>Non-delivery fraud</strong> — seller takes payment and disappears without delivering goods',
          '<strong>Advance fee fraud</strong> — buyer or seller asks you to pay a fee upfront to "release" payment or goods',
          '<strong>Overpayment scam</strong> — buyer sends more than the asking price and asks for change back',
          '<strong>Fake job scams</strong> — employer requests fees from job seekers disguised as training, uniforms, or background checks',
          '<strong>Rental deposit theft</strong> — fake landlords collect deposits for properties they do not own',
          '<strong>Vehicle scams</strong> — low prices for cars that do not exist or are heavily encumbered'
        ]))
      + _s(2, 'Warning Signs', _li([
          'Price is significantly below market value without a clear reason',
          'Seller or employer requests payment via Western Union, gift cards, crypto, or wire transfer',
          'Seller refuses to meet in person or provide verification of ownership',
          'Communication switches quickly to WhatsApp or personal email to avoid platform oversight',
          'Employer promises very high salary for unskilled or vague work',
          'Any party asks you to act urgently or secretly'
        ]))
      + _s(3, 'PaMarket\'s Detection Measures', _li([
          'Automated detection of patterns associated with fraudulent listings',
          'Employer verification before job postings are approved',
          'Identity verification (blue badge) for user trust signals',
          'AI-assisted moderation flagging suspicious listing content',
          'Community reporting — user flags reviewed within 24 hours',
          'Cooperation with POTRAZ and Zimbabwe Republic Police on active investigations'
        ]))
      + _s(4, 'Your Protections', _li([
          'Verified badges (blue) on user profiles indicate identity verification',
          'Business verified badges indicate company registration and ZIMRA compliance',
          'Report any suspicious listing or user immediately using the flag icon',
          'Block any user who contacts you inappropriately'
        ]))
      + _s(5, 'If You Have Been Scammed', _li([
          'Do not pay any more money — stop all further contact',
          'Screenshot all messages, listings, and payment receipts',
          'Email support@pamarket.app immediately with full details',
          'Report to Zimbabwe Republic Police (ZRP) — bring all evidence',
          'Contact your bank or mobile money provider (EcoCash, OneMoney) immediately for a possible chargeback',
          'Report the user in-app using the flag icon'
        ]))
      + _s(6, 'PaMarket\'s Commitment', _p('We will:') + _li([
          'Investigate all fraud reports within 24-48 hours',
          'Permanently ban confirmed fraudulent accounts',
          'Cooperate fully with the Zimbabwe Republic Police and POTRAZ',
          'Share relevant user data with law enforcement under valid legal process',
          'Continue improving our detection systems to stay ahead of new fraud techniques'
        ]) + _contactLine());
  }

  function _docProhibited() {
    return _dateChip('1 January 2026')
      + _p('This policy lists items that may not be bought, sold, or advertised on PaMarket under any circumstances. This list reflects Zimbabwean law, our platform values, and widely accepted marketplace standards.')
      + _s(1, 'Absolutely Prohibited (Zero Tolerance)', 'These items result in immediate permanent ban and possible law enforcement referral:' + _li([
          'Illegal drugs, narcotics, controlled substances, or drug paraphernalia of any kind',
          'Unlicensed firearms, prohibited weapons, ammunition, or explosives',
          'Any item related to human trafficking, forced labour, or exploitation',
          'Child sexual abuse material or any content involving minors in a sexual context',
          'Stolen goods or items obtained through criminal means',
          'Counterfeit currency, forged documents, or fake identification'
        ]))
      + _s(2, 'Regulated Items (Require Licence or Authority)', 'These may be listed only if you hold the required Zimbabwean licence or authority:' + _li([
          'Licensed firearms and ammunition (firearms licence required, certificate of transfer required)',
          'Prescription medicines and medical devices (pharmacy or medical licence required)',
          'Alcohol and tobacco products (liquor licence or trade authority required)',
          'Certain agricultural chemicals and pesticides (ZAA approval required)',
          'Financial products and investment schemes (SEC Zimbabwe registration required)',
          'Land and property (estate agent registration with REIVAZ required for agents)'
        ]))
      + _s(3, 'Counterfeit & Intellectual Property Violations', _li([
          'Counterfeit branded goods (fake Nike, Adidas, Apple, Samsung, etc.)',
          'Pirated software, films, music, or games on any media',
          'Products using another brand\'s trademarked logos or marks without authorisation',
          'Replica luxury goods presented as genuine'
        ]))
      + _s(4, 'Animals & Wildlife', _li([
          'Protected wildlife and endangered species, or their parts/derivatives',
          'Live animals without proof of legal breeding, vaccination records, and health certificates',
          'Ivory, rhino horn, or any product derived from protected CITES-listed animals',
          'Pets that were obtained through illegal trapping or import'
        ]))
      + _s(5, 'Digital & Online Items', _li([
          'Hacking tools, malware, exploit kits, or stolen account credentials',
          'Fake social media accounts, followers, likes, or engagement services',
          'Personal data dumps, email lists obtained without consent',
          'Virtual currency or in-game items from games that prohibit real-money trading'
        ]))
      + _s(6, 'Reporting Prohibited Items', _p('If you see a prohibited item listed on PaMarket, tap the flag icon on the listing to report it. Our moderation team reviews reports 7 days a week. For urgent cases involving illegal weapons or human trafficking, contact the Zimbabwe Republic Police directly.') + _contactLine());
  }

  function _docSuspension() {
    return _dateChip('1 January 2026')
      + _p('This policy explains when and how PaMarket may suspend or permanently ban accounts, what options you have if you believe an action was taken in error, and how reinstatement works.')
      + _s(1, 'Grounds for Account Action', 'PaMarket may take action on your account for:' + _li([
          'Violation of our Terms of Use, Acceptable Use Policy, or Community Guidelines',
          'Posting prohibited or illegal listings',
          'Fraudulent activity or attempts to defraud other users',
          'Impersonating another person or business',
          'Creating multiple accounts to circumvent a previous ban',
          'Abusing, threatening, or harassing other users or PaMarket staff',
          'Submitting false verification documents',
          'Accumulation of confirmed complaints from other users'
        ]))
      + _s(2, 'Types of Account Action', _li([
          '<strong>Warning (1st offence, minor violation)</strong> — email and in-app notification; no access restriction; listing may be removed',
          '<strong>Listing removal</strong> — specific content removed; account remains active',
          '<strong>Temporary suspension (7–30 days)</strong> — account locked; user cannot post, message, or apply for jobs; lifted automatically',
          '<strong>Permanent ban</strong> — account permanently closed; all listings and data removed; user may not create a new account',
          '<strong>Law enforcement referral</strong> — for criminal activity, PaMarket will cooperate fully with the Zimbabwe Republic Police, POTRAZ, and other competent authorities'
        ]))
      + _s(3, 'How We Notify You', _p('When your account is actioned, we will:') + _li([
          'Send an email to your registered address explaining the reason',
          'Display an in-app notification if your account allows it',
          'For permanent bans: send a detailed explanation by email within 48 hours'
        ]))
      + _s(4, 'Appealing an Account Action', _p('If you believe your account was suspended in error:') + _li([
          'Email <a href="mailto:support@pamarket.app" style="color:#1A3A8F;font-weight:700">support@pamarket.app</a> within <strong>14 days</strong> of the action',
          'Include your registered email address, the date of the action, and why you believe it was incorrect',
          'Provide any relevant evidence (screenshots, receipts, communications)',
          'We will review your appeal and respond within <strong>14 business days</strong>'
        ]))
      + _s(5, 'Non-Appealable Actions', 'The following account actions cannot be appealed:' + _li([
          'Permanent bans for fraud, illegal content, or criminal activity',
          'Bans for human trafficking or child exploitation material',
          'Bans for accounts confirmed by law enforcement as criminal',
          'Bans for users who have previously had a successful appeal and re-violated'
        ]))
      + _s(6, 'Reinstatement', _p('Temporary suspensions are lifted automatically on the stated date. No action is required from you. For temporary suspensions where the underlying violation has been resolved (e.g. a removed listing), you may contact support to request early reinstatement, which is at PaMarket\'s sole discretion.') + _contactLine());
  }

  function _docModeration() {
    return _dateChip('1 January 2026')
      + _p('This policy explains how PaMarket moderates content, how decisions are made, and how you can engage with the moderation process.')
      + _s(1, 'What We Moderate', _p('PaMarket moderates:') + _li([
          'All new listings before or shortly after they go live',
          'User-reported listings and user profiles',
          'Profile photos, business logos, and verification documents',
          'Messages flagged by our automated systems for prohibited content',
          'Job postings before activation for verified employers',
          'Reviews and ratings for fake or abusive content'
        ]))
      + _s(2, 'How Moderation Works', _li([
          '<strong>Automated screening</strong> — AI-assisted systems scan listings for prohibited keywords, images, and patterns before they go live',
          '<strong>Human review</strong> — our moderation team reviews flagged content, reported listings, and complex cases',
          '<strong>Community reporting</strong> — users can flag any listing using the flag icon; all reports are reviewed within 24 hours',
          '<strong>Proactive monitoring</strong> — we regularly audit categories with higher fraud rates (vehicles, property, jobs)'
        ]))
      + _s(3, 'Moderation Decisions', _p('When content is reviewed, we may:') + _li([
          'Approve the content — no action taken',
          'Edit the listing (e.g. remove a prohibited category or correct pricing currency)',
          'Request additional information from the seller',
          'Remove the listing with or without warning',
          'Suspend or permanently ban the account'
        ]))
      + _s(4, 'Appeals', _p('If your listing or content was removed and you believe this was incorrect, email <a href="mailto:support@pamarket.app" style="color:#1A3A8F;font-weight:700">support@pamarket.app</a> within 14 days. Include the listing details and your reason for appeal. We will review and respond within 7 business days.'))
      + _s(5, 'Transparency', _p('PaMarket publishes moderation statistics quarterly to give users insight into the health of our marketplace. These include number of listings removed per category, number of accounts banned, and fraud reports processed. Statistics are published on our website at pamarket.app.') + _contactLine());
  }

  function _docReviews() {
    return _dateChip('1 January 2026')
      + _p('Reviews and ratings on PaMarket help buyers and sellers make informed decisions. This policy governs how reviews work, what is and isn\'t allowed, and how disputes are handled.')
      + _s(1, 'Who Can Leave a Review', _li([
          'Any registered user who has had a genuine interaction with the reviewee (buyer/seller/employer/job seeker)',
          'Reviews should reflect your honest, first-hand experience',
          'You may not review yourself or arrange for friends or associates to leave reviews on your behalf'
        ]))
      + _s(2, 'Review Standards', 'Reviews must:' + _li([
          'Be based on a genuine, direct transaction or interaction on PaMarket',
          'Be honest and reflect your actual experience',
          'Not contain personal attacks, hate speech, or discriminatory language',
          'Not include links, contact details, or promotional content',
          'Not be left in exchange for payment, a discount, or any incentive'
        ]))
      + _s(3, 'Prohibited Review Content', 'Reviews will be removed if they:' + _li([
          'Are fake, fabricated, or arranged by the reviewee',
          'Contain offensive, abusive, or threatening language',
          'Include defamatory statements that are untrue',
          'Are retaliatory reviews left with the intent to damage rather than inform',
          'Are duplicates of a review already left for the same transaction'
        ]))
      + _s(4, 'Star Rating System', _p('PaMarket uses a 1–5 star rating system:') + _li([
          '5 stars — Excellent experience, highly recommend',
          '4 stars — Good experience with minor issues',
          '3 stars — Average, met basic expectations',
          '2 stars — Below expectations, significant issues',
          '1 star — Very poor experience or suspected fraud'
        ]) + _p('Your overall rating is a rolling average of all verified reviews on your profile.'))
      + _s(5, 'Disputing a Review', _p('If you believe a review violates this policy:') + _li([
          'Tap the flag icon on the review to report it',
          'Our team will review within 7 business days',
          'Reviews that violate policy will be removed; genuine honest reviews will remain even if negative',
          'You may respond publicly to any review on your profile — responses must also comply with our content standards'
        ]))
      + _s(6, 'Review Manipulation', _p('Creating fake reviews, incentivising reviews, or using multiple accounts to inflate ratings is a serious violation. Confirmed manipulation will result in:') + _li([
          'Removal of all manipulated reviews',
          'Reset or adjustment of the overall rating',
          'Temporary or permanent account suspension'
        ]) + _contactLine());
  }

  function _docVehicle() {
    return _dateChip('1 January 2026')
      + _p('These Vehicle Listing Terms apply to all listings in the Motors & Vehicles category on PaMarket, including cars, trucks, minibuses, motorcycles, tractors, and other motorised vehicles.')
      + _s(1, 'Seller Requirements', 'To list a vehicle you must:' + _li([
          'Be the registered owner of the vehicle, or have written authority from the owner to sell',
          'Ensure the vehicle is not encumbered by an unresolved finance agreement (hire purchase, bank loan) without disclosing this clearly',
          'Upload clear, real photos of the actual vehicle — minimum 4 photos including front, rear, interior, and odometer',
          'List the accurate mileage (odometer tampering is a criminal offence)',
          'Disclose all known mechanical faults, accident history, and chassis or engine modifications',
          'Hold a valid ZRP Change of Ownership (Form MVA1) or be ready to process one at sale'
        ]))
      + _s(2, 'Required Information', 'Each vehicle listing must include:' + _li([
          'Make, model, and year of manufacture',
          'Engine size, fuel type (petrol/diesel/electric/hybrid)',
          'Transmission type (manual/automatic)',
          'Accurate mileage',
          'Right-hand or left-hand drive',
          'Current condition (excellent/good/fair/for parts)',
          'Price in USD (or ZiG equivalent)',
          'Province and city of the vehicle\'s location'
        ]))
      + _s(3, 'Buyer Protections', _li([
          'Always inspect the vehicle in person before paying any deposit',
          'Request a ZINARA (Zimbabwe National Road Administration) search to verify registration and outstanding fees',
          'Request a police clearance to check if the vehicle is stolen',
          'Never pay a full amount before inspecting and test-driving the vehicle',
          'Insist on a written receipt and change of ownership form (ZRP Form MVA1) at point of sale'
        ]))
      + _s(4, 'Finance & Encumbered Vehicles', _p('Sellers must clearly disclose if a vehicle is under active hire purchase, bank loan, or any other financial encumbrance. Selling an encumbered vehicle without disclosure is fraud. Buyers who unknowingly purchase an encumbered vehicle may lose both the vehicle and their money.'))
      + _s(5, 'Prohibited Vehicle Listings', _li([
          'Vehicles with altered or removed chassis numbers (VIN/chassis tampering)',
          'Vehicles confirmed as stolen',
          'Vehicles with tampered odometers',
          'Write-offs presented as roadworthy without disclosure',
          'Unlicensed vehicles being sold as roadworthy'
        ]) + _contactLine());
  }

  function _docProperty() {
    return _dateChip('1 January 2026')
      + _p('These Property Listing Terms apply to all listings in the Property & Accommodation category, including properties for sale, residential rentals, commercial lets, and short-term accommodation.')
      + _s(1, 'Seller & Landlord Requirements', 'To list a property you must:' + _li([
          'Be the property owner, a legally appointed agent, or have written authority from the owner',
          'Estate agents must be registered with the Real Estate Institute of Zimbabwe (REIVAZ)',
          'Provide accurate photos of the actual property — not stock images or photos of a different property',
          'Disclose the accurate size, number of bedrooms/bathrooms, and all known structural or legal issues',
          'List the correct suburb, city, and province',
          'Not list the same property multiple times simultaneously'
        ]))
      + _s(2, 'Rental Listings', 'For residential and commercial rentals:' + _li([
          'State the monthly rental in USD or ZiG clearly',
          'Disclose any deposit requirements upfront (typically 1–3 months rental)',
          'Specify what is and is not included (water, electricity, garden, security)',
          'Specify lease duration and minimum rental period',
          'Do not collect deposits from prospective tenants until a written lease agreement is signed'
        ]))
      + _s(3, 'Buyer / Tenant Protections', _li([
          'Never pay a deposit to a landlord or agent you have not met in person at the actual property',
          'Request proof of ownership (title deeds) or the agent\'s REIVAZ licence before paying anything',
          'Insist on a written lease or sale agreement before any payment is made',
          'Be cautious of rental prices significantly below market rate — this is a common indicator of fraud',
          'Use the DCIP (Deeds search) to verify property ownership before purchasing'
        ]))
      + _s(4, 'Short-Term / Holiday Accommodation', _li([
          'Accurately describe sleeping capacity, amenities, and condition',
          'Clearly state all fees (cleaning fees, tourist levy, security deposit)',
          'Cancellation policy must be stated clearly in the listing',
          'Only list properties you have the right to sub-let or advertise commercially'
        ]))
      + _s(5, 'Prohibited Property Listings', _li([
          'Properties you do not own or are not authorised to sell or let',
          'Listings designed to collect deposits for properties that do not exist or are not available',
          'Listings for illegally sub-divided land without proper council approval',
          'Listings misrepresenting the location or condition of a property'
        ]) + _contactLine());
  }

  function _docVerifiedBiz() {
    return _dateChip('1 January 2026')
      + _p('These rules apply to all businesses that have been granted Verified Business status on PaMarket. Verified status carries additional trust signals and responsibilities.')
      + _s(1, 'How to Get Verified', _p('Business Verification requires:') + _li([
          'Certificate of Incorporation from the Companies and Other Business Entities Act (COBE) registry',
          'Valid ZIMRA Tax Clearance Certificate (not more than 12 months old)',
          'Photo ID of the authorised business representative',
          'Photo of the physical business premises with signage visible',
          'Business name matching ZIMRA and COBE registration exactly'
        ]) + _p('Verification is reviewed within 2 business days. Verified status is displayed as a gold shield badge on your profile and listings.'))
      + _s(2, 'Verified Business Privileges', _li([
          'Gold verified badge on profile and all listings',
          'Ability to post jobs on the PaMarket Jobs platform',
          'Access to Business Dashboard (analytics, lead management)',
          'Priority in search results within your category',
          'Access to Boost and Featured Listing tools',
          'Ability to create a Business Profile page with your brand information'
        ]))
      + _s(3, 'Ongoing Obligations', 'Verified businesses must:' + _li([
          'Maintain a valid ZIMRA Tax Clearance Certificate — expired certificates will trigger automatic review',
          'Keep business information (address, phone, representative) current',
          'Comply with all platform rules with heightened accountability — violations by verified businesses are treated more seriously',
          'Not use the verified badge to deceive customers about the nature, scale, or credibility of your business',
          'Notify PaMarket immediately if the business changes ownership or ceases trading'
        ]))
      + _s(4, 'Revocation of Verified Status', _p('Verified status will be revoked for:') + _li([
          'Allowing Tax Clearance Certificate to expire without renewal',
          'Fraudulent or misleading use of the verified badge',
          'Repeated Terms of Use violations',
          'Business deregistration or insolvency',
          'Confirmed fraud complaints from customers',
          'Submitting false documents at the time of verification'
        ]) + _p('Revocation may be immediate and without prior warning in cases of fraud.') + _contactLine());
  }

  function _docBoosted() {
    return _dateChip('1 January 2026')
      + _p('These rules apply to all PaMarket Boost packages, featured listings, and paid promotional tools. Boosted listings receive greater visibility but must comply with all standard listing requirements.')
      + _s(1, 'What Boosting Does', _li([
          'Moves your listing to the top of search results and category pages',
          'Adds a "Featured" or "Boosted" label to your listing card',
          'Increases visibility in Browse and Home feeds',
          'May include placement in the PaMarket "Top Picks" carousel',
          'Duration and intensity depend on the package purchased'
        ]))
      + _s(2, 'Eligibility', 'Listings must meet all of the following before a boost can be applied:' + _li([
          'Listing must be Active and comply with all Terms of Use',
          'Listing must have at least one real photo',
          'Listing must have an accurate title, description, and price',
          'Listings under review or flagged for policy violations are not eligible',
          'Prohibited items may not be boosted under any circumstances'
        ]))
      + _s(3, 'Payment & Refunds', _li([
          'Boost packages are paid in advance in USD',
          'Boosts begin within 24 hours of payment confirmation',
          'Refunds are available only if PaMarket is unable to deliver the boost due to a technical error',
          'No refund is issued if a listing is removed for policy violations during an active boost period',
          'Unused boost credit expires 90 days after purchase'
        ]))
      + _s(4, 'Boost Limits', _li([
          'Free accounts: maximum 1 boosted listing at a time',
          'Verified businesses: up to 10 boosted listings simultaneously',
          'No listing may be kept permanently at position #1 — rotation applies to ensure fair access',
          'Boosting does not exempt a listing from moderation or user reports'
        ]))
      + _s(5, 'Our Rights', _p('PaMarket reserves the right to:') + _li([
          'Remove or suspend a boost if the listing violates platform policies, even if payment has been made',
          'Adjust the boost algorithm to ensure a fair and diverse marketplace experience',
          'Refuse to boost any listing at our sole discretion',
          'Issue a pro-rata refund for the unused portion of a boost removed for policy violations'
        ]) + _contactLine());
  }

  // ── Document Registry ────────────────────────────────────
  H._legalDocs = {
    terms_of_use:            { title: 'Terms of Use',             updated: '1 January 2026', icon: IC.doc,     content: function() { return typeof H._termsText === 'function' ? H._termsText() : ''; } },
    privacy_policy:          { title: 'Privacy Policy',           updated: '1 January 2026', icon: IC.shield,  content: function() { return typeof H._privacyText === 'function' ? H._privacyText() : ''; } },
    community_guidelines:    { title: 'Community Guidelines',     updated: '1 January 2026', icon: IC.users,   content: function() { return typeof H._guidelinesText === 'function' ? H._guidelinesText() : ''; } },
    acceptable_use_policy:   { title: 'Acceptable Use Policy',    updated: '1 January 2026', icon: IC.ban,     content: _docAUP },
    cookie_data_policy:      { title: 'Cookie & Data Policy',     updated: '1 January 2026', icon: IC.cookie,  content: _docCookie },
    buying_selling_terms:    { title: 'Buying & Selling Terms',   updated: '1 January 2026', icon: IC.cart,    content: _docBuyingSelling },
    refund_dispute_policy:   { title: 'Refund & Dispute Policy',  updated: '1 January 2026', icon: IC.refund,  content: _docRefund },
    job_platform_terms:      { title: 'Job Platform Terms',       updated: '1 January 2026', icon: IC.brief,   content: _docJobsTerms },
    service_platform_terms:  { title: 'Service Platform Terms',   updated: '1 January 2026', icon: IC.check,   content: _docServiceTerms },
    fraud_prevention_policy: { title: 'Fraud & Scam Prevention',  updated: '1 January 2026', icon: IC.warn,    content: _docFraud },
    prohibited_items_policy: { title: 'Prohibited Items Policy',  updated: '1 January 2026', icon: IC.ban,     content: _docProhibited },
    account_suspension_policy:{ title: 'Account Suspension Rules', updated: '1 January 2026', icon: IC.lock,   content: _docSuspension },
    content_moderation_policy:{ title: 'Content Moderation Policy',updated: '1 January 2026', icon: IC.flag,   content: _docModeration },
    reviews_ratings_policy:  { title: 'Reviews & Ratings Policy', updated: '1 January 2026', icon: IC.star,    content: _docReviews },
    vehicle_listing_terms:   { title: 'Vehicle Listing Terms',    updated: '1 January 2026', icon: IC.car,     content: _docVehicle },
    property_listing_terms:  { title: 'Property Listing Terms',   updated: '1 January 2026', icon: IC.home,    content: _docProperty },
    verified_business_rules: { title: 'Verified Business Rules',  updated: '1 January 2026', icon: IC.check,   content: _docVerifiedBiz },
    boosted_listing_rules:   { title: 'Boosted Listings Rules',   updated: '1 January 2026', icon: IC.zap,     content: _docBoosted },
  };

  // ── Hub section config ───────────────────────────────────
  const SECTIONS = [
    {
      id: 'legal_terms',
      title: 'Legal Terms',
      desc: 'Your core agreements with PaMarket',
      color: '#1A3A8F', bg: '#EEF2FF',
      icon: IC.doc,
      docs: ['terms_of_use','privacy_policy','acceptable_use_policy','cookie_data_policy','community_guidelines'],
    },
    {
      id: 'marketplace_rules',
      title: 'Marketplace Rules',
      desc: 'How buying, selling, and services work',
      color: '#059669', bg: '#ECFDF5',
      icon: IC.cart,
      docs: ['buying_selling_terms','refund_dispute_policy','job_platform_terms','service_platform_terms'],
    },
    {
      id: 'trust_safety',
      title: 'Trust & Safety',
      desc: 'How we keep PaMarket safe for everyone',
      color: '#DC2626', bg: '#FEF2F2',
      icon: IC.shield,
      docs: ['fraud_prevention_policy','prohibited_items_policy','account_suspension_policy','content_moderation_policy','reviews_ratings_policy'],
    },
    {
      id: 'platform_extensions',
      title: 'Platform Extensions',
      desc: 'Category-specific rules for listings',
      color: '#D97706', bg: '#FFFBEB',
      icon: IC.zap,
      docs: ['vehicle_listing_terms','property_listing_terms','verified_business_rules','boosted_listing_rules'],
    },
  ];

  // ── Helpers ──────────────────────────────────────────────
  function _docRow(key) {
    const doc = H._legalDocs[key];
    if (!doc) return '';
    return `<button onclick="H.openInner('LegalReader',{doc:'${key}'})" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:transparent;border:none;border-bottom:1px solid var(--border);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">${doc.title}</span>
      <span style="color:var(--sub)">${IC.chevron}</span>
    </button>`;
  }

  const SOCIALS = [
    { name:'Facebook',  url:'https://www.facebook.com/profile.php?id=61591000371129', bg:'#1877F2', svg:'<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z"/></svg>' },
    { name:'Instagram', url:'https://www.instagram.com/pamarketzim/',                  bg:'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', svg:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>' },
    { name:'TikTok',   url:'https://www.tiktok.com/@pamarketzimbabwe',                 bg:'#010101', svg:'<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.07v12.2a2.43 2.43 0 1 1-2.43-2.43c.2 0 .4.02.59.06v-3.13a5.57 5.57 0 0 0-.59-.03 5.56 5.56 0 1 0 5.56 5.56V9.01a7.33 7.33 0 0 0 4.28 1.37V7.3a4.28 4.28 0 0 1-3.3-1.48z"/></svg>' },
    { name:'YouTube',  url:'https://www.youtube.com/@PaMarketZim',                     bg:'#FF0000', svg:'<svg viewBox="0 0 24 24" width="19" height="17" fill="#fff"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7l5.7 3.3z"/></svg>' },
    { name:'X',        url:'https://twitter.com/PaMarketZim',                          bg:'#000', svg:'<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.902-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
    { name:'LinkedIn', url:'https://www.linkedin.com/company/pamarket',                 bg:'#0A66C2', svg:'<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>' },
    { name:'WhatsApp', url:'https://wa.me/971589772645',                                bg:'#25D366', svg:'<svg viewBox="0 0 24 24" width="17" height="17" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>' },
  ];

  // ── Legal Hub Landing ────────────────────────────────────
  pages.LegalHub = function () {
    const sectionCards = SECTIONS.map(function(sec) {
      const rows = sec.docs.map(_docRow).join('');
      return `<div style="margin:0 16px 16px;border-radius:16px;overflow:hidden;border:1.5px solid var(--border);background:var(--card)">
        <div style="padding:14px 16px 12px;border-bottom:1px solid var(--border);background:${sec.bg}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:10px;background:${sec.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff">${sec.icon}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:800;color:${sec.color}">${sec.title}</div>
              <div style="font-size:11px;color:var(--sub);margin-top:1px">${sec.desc}</div>
            </div>
          </div>
        </div>
        ${rows}
      </div>`;
    }).join('');

    const socialLinks = SOCIALS.map(s =>
      `<a href="${s.url}" onclick="event.preventDefault();(window.open('${s.url}','_blank','noopener'))" title="${s.name}"
         style="width:38px;height:38px;border-radius:50%;background:${s.bg};display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 2px 6px -1px rgba(0,0,0,.3);flex-shrink:0">
         ${s.svg}
       </a>`
    ).join('');

    return `<div class="page active">
      ${H.innerTopbar('Legal Hub')}

      <!-- Hero -->
      <div style="margin:0 16px 20px;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#1A3A8F 0%,#2952cc 60%,#1e4db7 100%);padding:26px 20px 22px;position:relative">
        <div style="position:absolute;top:-20px;right:-20px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.05)"></div>
        <div style="position:absolute;bottom:-30px;right:16px;width:90px;height:90px;border-radius:50%;background:rgba(245,166,35,.1)"></div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.55);text-transform:uppercase;margin-bottom:7px">PaMarket Zimbabwe</div>
        <div style="font-size:22px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:7px">Legal Hub</div>
        <div style="font-size:13px;color:rgba(255,255,255,.72);line-height:1.55;margin-bottom:14px">All our policies, terms, and safety guidelines in one place. Transparency is the foundation of trust.</div>
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:5px 10px">
          <div style="width:7px;height:7px;border-radius:50%;background:#4ADE80"></div>
          <span style="font-size:11px;color:rgba(255,255,255,.9);font-weight:600">${Object.keys(H._legalDocs).length} documents available</span>
        </div>
      </div>

      ${sectionCards}

      <!-- Support -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Support</div>
      <div style="margin:0 16px 16px;border-radius:16px;overflow:hidden;border:1.5px solid var(--border);background:var(--card)">
        <a href="mailto:support@pamarket.app" style="display:flex;align-items:center;gap:12px;padding:13px 16px;text-decoration:none;border-bottom:1px solid var(--border);-webkit-tap-highlight-color:transparent">
          <div style="width:34px;height:34px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F">${IC.mail}</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--sub);font-weight:500">General &amp; Terms</div>
            <div style="font-size:13px;font-weight:700;color:#1A3A8F">support@pamarket.app</div>
          </div>
          <span style="color:var(--sub)">${IC.chevron}</span>
        </a>
        <a href="mailto:privacy@pamarket.app" style="display:flex;align-items:center;gap:12px;padding:13px 16px;text-decoration:none;border-bottom:1px solid var(--border);-webkit-tap-highlight-color:transparent">
          <div style="width:34px;height:34px;border-radius:10px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1A3A8F">${IC.shield}</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--sub);font-weight:500">Privacy &amp; Data</div>
            <div style="font-size:13px;font-weight:700;color:#1A3A8F">privacy@pamarket.app</div>
          </div>
          <span style="color:var(--sub)">${IC.chevron}</span>
        </a>
        <button onclick="H.openInner('ReportProblem')" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:transparent;border:none;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent">
          <div style="width:34px;height:34px;border-radius:10px;background:#FEF2F2;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#DC2626">${IC.bug}</div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--sub);font-weight:500">Something wrong?</div>
            <div style="font-size:13px;font-weight:700;color:#DC2626">Report a Problem</div>
          </div>
          <span style="color:var(--sub)">${IC.chevron}</span>
        </button>
      </div>

      <!-- Company & Social -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Company</div>
      <div style="margin:0 16px 16px;border-radius:16px;overflow:hidden;border:1.5px solid var(--border);background:var(--card)">
        <button onclick="H.openInner('About')" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:transparent;border:none;border-bottom:1px solid var(--border);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent">
          <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">About PaMarket</span>
          <span style="color:var(--sub)">${IC.chevron}</span>
        </button>
        <button onclick="H.openInner('Help')" style="display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:transparent;border:none;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent">
          <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">Help Center</span>
          <span style="color:var(--sub)">${IC.chevron}</span>
        </button>
      </div>

      <!-- Social links -->
      <div style="margin:0 16px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)">Follow Us</div>
      <div style="margin:0 16px 24px;display:flex;flex-wrap:wrap;gap:12px">${socialLinks}</div>

      <!-- Footer -->
      <div style="text-align:center;padding:4px 16px 36px">
        <div style="font-size:11px;color:var(--sub)">© ${new Date().getFullYear()} PaMarket Zimbabwe · Made in Zimbabwe</div>
        <div style="font-size:10px;color:var(--sub);margin-top:3px">All rights reserved</div>
      </div>
    </div>`;
  };

  // ── Legal Reader ─────────────────────────────────────────
  pages.LegalReader = function (params) {
    const key = (params && params.doc) || '';
    const doc = H._legalDocs[key];
    if (!doc) {
      return `<div class="page active">${H.innerTopbar('Legal')}<div style="padding:40px 16px;text-align:center;color:var(--sub)">Document not found.</div></div>`;
    }
    const body = doc.content();

    return `<div class="page active" style="display:flex;flex-direction:column;overflow:hidden;height:100%">

      <!-- Sticky header -->
      <div id="legalHeader" style="background:var(--card);border-bottom:1px solid var(--border);z-index:10;flex-shrink:0">
        <div style="display:flex;align-items:center;padding:12px 16px;gap:10px">
          <button onclick="H.goBack()" style="background:var(--bg);border:1.5px solid var(--border);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:var(--text)">${IC.back}</button>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${doc.title}</div>
          </div>
          <button id="legalSearchBtn" onclick="H._legalReader.toggleSearch()" style="background:var(--bg);border:1.5px solid var(--border);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--sub)">${IC.search}</button>
        </div>

        <!-- Scroll progress bar -->
        <div style="height:3px;background:var(--border)">
          <div id="legalProgress" style="height:3px;background:linear-gradient(90deg,#1A3A8F,#2952cc);width:0%;transition:width .08s linear;border-radius:0 2px 2px 0"></div>
        </div>

        <!-- Search bar (hidden by default) -->
        <div id="legalSearchBar" style="display:none;padding:8px 16px 10px;border-top:1px solid var(--border)">
          <input id="legalSearchInput" type="search" placeholder="Search in this document..."
                 oninput="H._legalReader.search(this.value)"
                 style="width:100%;padding:9px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--bg);color:var(--text);font-family:Inter,sans-serif;outline:none">
          <div id="legalSearchCount" style="font-size:11px;color:var(--sub);margin-top:5px;min-height:14px;text-align:right"></div>
        </div>
      </div>

      <!-- Scrollable document content -->
      <div id="legalContent" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 16px 48px">
        <div style="padding:14px 0 0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
          <div style="display:inline-flex;align-items:center;gap:6px;background:#EEF2FF;border:1px solid #C7D7FE;border-radius:8px;padding:5px 10px">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#1A3A8F" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style="font-size:11px;font-weight:700;color:#1A3A8F">Updated ${doc.updated}</span>
          </div>
        </div>
        <div id="legalDocBody" style="font-size:13px;color:var(--sub);line-height:1.7;margin-top:6px">
          ${body}
        </div>
        <!-- Contact footer -->
        <div style="margin-top:24px;padding:14px 16px;background:var(--bg);border:1.5px solid var(--border);border-radius:12px;text-align:center">
          <div style="font-size:12px;color:var(--sub);margin-bottom:6px">Questions about this document?</div>
          <a href="mailto:support@pamarket.app" style="font-size:13px;font-weight:700;color:#1A3A8F;text-decoration:none">support@pamarket.app</a>
        </div>
      </div>
    </div>`;
  };

  // ── Legal Reader _after ──────────────────────────────────
  pages.LegalReader_after = function (params) {
    const content = document.getElementById('legalContent');
    const progress = document.getElementById('legalProgress');
    if (content && progress) {
      content.addEventListener('scroll', function () {
        const max = this.scrollHeight - this.clientHeight;
        const pct = max > 0 ? Math.min(100, (this.scrollTop / max) * 100) : 0;
        progress.style.width = pct + '%';
      }, { passive: true });
    }
    // Store original HTML for search restore
    const body = document.getElementById('legalDocBody');
    if (body) H._legalReader._orig = body.innerHTML;
  };

  // ── Search module ────────────────────────────────────────
  H._legalReader = {
    _orig: '',
    _searchOpen: false,

    toggleSearch: function () {
      const bar = document.getElementById('legalSearchBar');
      if (!bar) return;
      H._legalReader._searchOpen = !H._legalReader._searchOpen;
      bar.style.display = H._legalReader._searchOpen ? 'block' : 'none';
      if (H._legalReader._searchOpen) {
        const inp = document.getElementById('legalSearchInput');
        if (inp) { inp.value = ''; inp.focus(); }
        H._legalReader.search('');
      }
      const btn = document.getElementById('legalSearchBtn');
      if (btn) btn.style.background = H._legalReader._searchOpen ? '#EEF2FF' : 'var(--bg)';
    },

    search: function (val) {
      const body = document.getElementById('legalDocBody');
      const countEl = document.getElementById('legalSearchCount');
      if (!body) return;

      // Restore original content first
      body.innerHTML = H._legalReader._orig;
      if (!val || val.trim().length < 2) {
        if (countEl) countEl.textContent = '';
        return;
      }

      // Walk text nodes and highlight matches
      var count = H._legalReader._highlight(body, val.trim());
      if (countEl) countEl.textContent = count > 0 ? count + ' match' + (count !== 1 ? 'es' : '') : 'No matches found';

      // Scroll to first match
      const first = body.querySelector('mark.lh');
      if (first) {
        const content = document.getElementById('legalContent');
        if (content) {
          const offset = first.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 60;
          content.scrollTo({ top: offset, behavior: 'smooth' });
        }
      }
    },

    _highlight: function (node, term) {
      var count = 0;
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      function walk(n) {
        if (n.nodeType === 3) {
          if (re.test(n.textContent)) {
            re.lastIndex = 0;
            var span = document.createElement('span');
            span.innerHTML = n.textContent.replace(re, function(m) {
              count++;
              return '<mark class="lh" style="background:#FEF08A;color:#1A1A1A;border-radius:2px;padding:0 1px">' + m + '</mark>';
            });
            n.parentNode.replaceChild(span, n);
          }
          re.lastIndex = 0;
        } else if (n.nodeType === 1 && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE' && n.tagName !== 'MARK') {
          Array.from(n.childNodes).forEach(walk);
        }
      }
      walk(node);
      return count;
    }
  };

  // ── Backward compat aliases ──────────────────────────────
  pages.LegalAUP      = function () { return pages.LegalReader({ doc: 'acceptable_use_policy' }); };
  pages.LegalJobsTerms= function () { return pages.LegalReader({ doc: 'job_platform_terms' }); };
  pages.LegalCookies  = function () { return pages.LegalReader({ doc: 'cookie_data_policy' }); };
  pages.LegalAUP_after       = function (p) { pages.LegalReader_after(p); };
  pages.LegalJobsTerms_after = function (p) { pages.LegalReader_after(p); };
  pages.LegalCookies_after   = function (p) { pages.LegalReader_after(p); };

})(window.H = window.H || {});
