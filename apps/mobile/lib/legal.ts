export type LegalSection = { heading: string; body: string };
export type LegalDoc = { title: string; updated: string; sections: LegalSection[] };
export type LegalDocKey =
  | "terms_of_use"
  | "privacy_policy"
  | "community_guidelines"
  | "acceptable_use_policy"
  | "cookie_data_policy"
  | "buying_selling_terms"
  | "refund_dispute_policy"
  | "job_platform_terms"
  | "service_platform_terms"
  | "fraud_prevention_policy"
  | "prohibited_items_policy"
  | "account_suspension_policy"
  | "content_moderation_policy"
  | "reviews_ratings_policy"
  | "vehicle_listing_terms"
  | "property_listing_terms"
  | "verified_business_rules"
  | "boosted_listing_rules";

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  updated: "Last updated: July 2026",
  sections: [
    {
      heading: "",
      body: 'These Terms of Service ("Terms") form a legally binding agreement between you ("User", "you") and PaMarket Zimbabwe ("PaMarket", "we", "us", "our"). By accessing or using the PaMarket mobile application or website you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must stop using the platform immediately.',
    },
    {
      heading: "1. Changes to These Terms",
      body: "We may update these Terms at any time. We will notify you of material changes by in-app notification or by posting the updated Terms with a new effective date. Your continued use of PaMarket after changes are posted constitutes your acceptance of the revised Terms. If you disagree with any change, your only remedy is to stop using the platform and delete your account.",
    },
    {
      heading: "2. Eligibility",
      body: "You must be at least 18 years old and have full legal capacity to enter into binding contracts under the laws of Zimbabwe. By creating an account you represent and warrant that you meet these requirements. We reserve the right to terminate any account we have reason to believe belongs to a person under 18, without notice or liability.",
    },
    {
      heading: "3. Account Registration and Security",
      body: "You may register using a valid email address, phone number, or a supported third-party sign-in provider (e.g. Google). You are solely responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must notify us immediately at info@pamarketzw.com if you become aware of any unauthorised access. We will not be liable for any loss caused by someone else using your account with or without your knowledge. You may hold only one account; duplicate accounts will be removed.",
    },
    {
      heading: "4. Nature of the Platform — PaMarket Is a Marketplace Only",
      body: "PaMarket is an online classifieds and services marketplace. We provide technology that enables users to list goods, services, jobs, and business profiles, and to communicate with each other. PaMarket is not a buyer, seller, employer, employee, broker, agent, or auctioneer. We do not own, inspect, store, or ship any item listed on the platform. We do not employ, represent, endorse, or guarantee any user, business, or job poster. Any contract for the purchase or sale of any item or service is made directly between the buyer and the seller. PaMarket is not a party to any such contract.",
    },
    {
      heading: "5. Licence You Grant PaMarket",
      body: "By submitting content to PaMarket (including photos, text, videos, business names, and descriptions) you grant PaMarket a worldwide, non-exclusive, royalty-free, sublicensable, and transferable licence to use, reproduce, modify, adapt, publish, translate, distribute, and display that content across all media formats, including within the app, on our website, and for promotional purposes, for as long as the content remains on our platform. You represent and warrant that you own or have the necessary rights to grant this licence and that your content does not infringe the rights of any third party.",
    },
    {
      heading: "6. Listing Rules",
      body: "All listings must meet the following requirements: you must own the item or have verifiable legal authority to sell it; the title, description, photos, price, and location must accurately represent the item, with no misleading statements, omissions of known defects, or inflated valuations; all prices must be quoted in United States Dollars (USD) — listings in any other currency will be removed; photos must be real images of the actual item — stock images, watermarked images, or images of a different item are not permitted; do not post duplicate listings for the same item across multiple categories or provinces; listings must be placed in the correct category — miscategorised listings will be moved or removed; remove or mark your listing as sold as soon as the item is no longer available. PaMarket reserves the right to edit, reclassify, reject, or remove any listing at any time, with or without notice, for any reason including but not limited to violation of these Terms.",
    },
    {
      heading: "7. Prohibited Items and Content",
      body: "The following are strictly prohibited: stolen goods or goods obtained through fraud or deception; counterfeit, fake, or unauthorised copies of branded goods; goods requiring ZIMRA import permits, licences, or customs clearance that the seller does not hold; illegal drugs, narcotics, controlled substances, or drug paraphernalia; unlicensed firearms, weapons, ammunition, explosives, or related accessories; wildlife, live animals, animal parts, or products protected under CITES or the Zimbabwe Parks and Wildlife Act; tobacco products, alcohol, or spirits sold without the required ZIMRA/Government of Zimbabwe retail licence; pornographic, sexually explicit, or adult content of any kind; content that promotes or incites violence, hatred, discrimination, or terrorism; pyramid schemes, MLM recruitment, advance fee fraud (419), Ponzi schemes, or any deceptive financial offer; impersonation of any individual, business, government body, or official institution; personal data or private information of third parties without their consent; human beings, human organs, or any service that constitutes human trafficking; prescription medicines or medical devices sold without a valid licence; hazardous chemicals, flammable materials, or radioactive substances; and any item or service whose listing, sale, or purchase is prohibited under the laws of Zimbabwe. This list is non-exhaustive. PaMarket retains sole discretion to determine what constitutes prohibited content and to remove any content we consider harmful, illegal, or contrary to the spirit of these Terms.",
    },
    {
      heading: "8. Business Shops",
      body: "Business accounts may create a verified Shop profile with a product catalogue and a dedicated business inbox. You must be the legitimate owner or an authorised representative of the business entity named in the Shop. All business details must be accurate and kept up to date. PaMarket may request proof of business registration at any time and reserves the right to downgrade or remove verification, suspend, or permanently close any Business Shop that provides false information or violates these Terms. PaMarket does not guarantee or warrant the legitimacy, quality, or delivery of any product or service offered by a Business Shop.",
    },
    {
      heading: "9. Hire Talent",
      body: "Employers may post job openings subject to admin review, typically completed within 24 hours. All job postings must be for genuine, existing vacancies at a real organisation operating lawfully within Zimbabwe. Charging job seekers any registration, application, training, or placement fee is strictly prohibited and will result in immediate permanent account suspension and may be reported to the Zimbabwe Republic Police. PaMarket is not an employment agency and is not responsible for the accuracy of job descriptions, the conduct of employers, or any employment relationship that arises from a listing.",
    },
    {
      heading: "10. Transactions — No Involvement by PaMarket",
      body: "PaMarket does not facilitate, guarantee, insure, or supervise any transaction between users. We do not process payments, hold escrow funds, or provide buyer or seller protection of any kind. All agreements, payments, and deliveries are arranged directly between the buyer and the seller. PaMarket expressly disclaims any liability for non-payment or delayed payment, non-delivery or late delivery of goods, defective or misdescribed or counterfeit or stolen goods, fraud or deceptive conduct by any user, loss/damage/injury arising from a meeting between users, and any dispute arising from a transaction conducted through or discovered on the platform.",
    },
    {
      heading: "10A. Paid Features and Google Play Billing",
      body: "Separately from peer-to-peer marketplace transactions, PaMarket offers optional paid platform features — listing boosts, featured slot packs, Business Shop subscriptions, Recruiter subscriptions, job posting credit packs, job boosts, and featured rental slots — sold by PaMarket directly to you and processed exclusively through Google Play Billing. All paid features are purchased and billed through Google Play Billing; PaMarket does not receive, process, or store your card or payment details. Subscriptions renew automatically until cancelled via Google Play Store; PaMarket cannot cancel a Google Play subscription on your behalf. One-time purchases do not renew automatically. Refund requests are handled through Google Play's refund process. Posting listings, applying for jobs, messaging, and browsing remain entirely free.",
    },
    {
      heading: "11. Messaging and User Conduct",
      body: "PaMarket's in-app messaging is provided to facilitate legitimate transactions. You agree not to use messaging to send spam, unsolicited bulk messages, harassment, threats, sexually explicit content, or any content that violates these Terms. We do not read your private messages as a matter of course; however, we may review messages if they are reported to us for abuse. Do not share your bank account details, national ID numbers, passwords, or other sensitive personal information through the messaging system.",
    },
    {
      heading: "12. Third-Party Links and Services",
      body: "The platform may contain links to third-party websites, services, or resources. PaMarket has no control over the content, privacy practices, or availability of such third-party sites. A link to a third-party site does not constitute an endorsement, sponsorship, or recommendation by PaMarket. You access any third-party links entirely at your own risk.",
    },
    {
      heading: "13. Our Intellectual Property",
      body: "The PaMarket name, logo, app design, user interface, proprietary software, written content, and all other intellectual property on the platform are owned by PaMarket or its licensors and are protected by copyright, trademark, and other intellectual property laws. You may not copy, reproduce, modify, distribute, create derivative works from, publicly display, or commercially exploit any part of our intellectual property without our prior written permission.",
    },
    {
      heading: "14. Copyright and IP Infringement — Takedown Requests",
      body: "If you believe that content on PaMarket infringes your copyright or other intellectual property rights, please contact us in writing at info@pamarketzw.com with a description of the work, the location of the allegedly infringing content, your contact details, and the required good-faith statements. We will review all valid takedown requests and act in accordance with applicable law.",
    },
    {
      heading: "15. Disclaimers — No Warranties",
      body: 'To the fullest extent permitted by Zimbabwean law, PaMarket provides the platform "as is" and "as available" without any representation or warranty of any kind, whether express, implied, or statutory. We do not warrant that the platform will be uninterrupted, error-free, secure, or free of viruses; that any listing is accurate, complete, legal, or genuine; that the identity or creditworthiness of any user has been verified; or that any item or service listed is fit for its purpose. You use the platform entirely at your own risk.',
    },
    {
      heading: "16. Limitation of Liability",
      body: "To the fullest extent permitted by Zimbabwean law, PaMarket and its officers, directors, employees, agents, and licensors shall not be liable to you for any indirect, incidental, special, consequential, punitive, or exemplary damages arising out of or in connection with your use of or inability to use the platform. Our total aggregate liability to you for any claim shall not exceed the greater of the amount you paid to PaMarket in the 12 months preceding the claim, or USD 10.",
    },
    {
      heading: "17. Indemnification",
      body: "You agree to defend, indemnify, and hold harmless PaMarket and its officers, directors, employees, contractors, agents, licensors, and service providers from and against any claims, liabilities, damages, judgments, losses, costs, and fees arising out of or relating to your violation of these Terms, content you post, your conduct towards other users, your violation of any third-party right, any transaction facilitated by the platform, or your violation of applicable law.",
    },
    {
      heading: "18. Termination",
      body: "PaMarket reserves the right to suspend, restrict, or permanently terminate your access to the platform at any time, with or without notice, for any reason, including violation of these Terms, fraudulent activity, or conduct harmful to other users or to PaMarket. You may delete your account at any time via Settings.",
    },
    {
      heading: "19. Force Majeure",
      body: "PaMarket shall not be liable for any failure or delay in performance caused by circumstances beyond our reasonable control, including internet or telecommunications failures, power outages, natural disasters, civil unrest, government actions, cyberattacks, pandemics, or acts of God.",
    },
    {
      heading: "20. Governing Law and Dispute Resolution",
      body: "These Terms are governed by and construed in accordance with the laws of the Republic of Zimbabwe. Any dispute shall be subject to the exclusive jurisdiction of the courts of Zimbabwe. Before commencing formal proceedings, you agree to contact us in good faith to attempt to resolve the dispute informally.",
    },
    {
      heading: "21. Miscellaneous",
      body: "These Terms, together with our Privacy Policy and Community Guidelines, constitute the entire agreement between you and PaMarket. If any provision is found unenforceable, it will be limited or eliminated to the minimum extent necessary. Our failure to enforce any right is not a waiver. You may not assign your rights under these Terms without our prior written consent. By using PaMarket you consent to receive communications from us electronically.",
    },
    {
      heading: "22. Contact",
      body: "PaMarket Zimbabwe · Email: info@pamarketzw.com · WhatsApp: +971 589 772 645",
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  updated: "Last updated: July 2026",
  sections: [
    {
      heading: "",
      body: 'PaMarket Zimbabwe ("PaMarket", "we", "us", "our") is committed to protecting your privacy and handling your personal information responsibly. This Privacy Policy explains what data we collect, why we collect it, how we use and protect it, who we share it with, how long we keep it, and what rights you have over it. By using PaMarket you agree to the practices described in this Policy.',
    },
    {
      heading: "1. Who Is the Data Controller",
      body: "PaMarket Zimbabwe is the data controller responsible for your personal information collected through the PaMarket mobile application and website. This Policy is governed by the Zimbabwe Cyber Security and Data Protection Act [Chapter 12:07] and applicable Zimbabwean data protection law. Contact us at info@pamarketzw.com for any privacy-related enquiry.",
    },
    {
      heading: "2. Information We Collect",
      body: "Account and identity data (name, email, phone, profile photo); verification data (national ID/passport copy for verified badge requests, deleted within 30 days of review); listing data (photos, titles, descriptions, prices, categories, locations); business data (business name, type, description, logo, catalogue); job and CV data; message and communication data; push notification device tokens; usage and behavioural data; device and technical data (model, OS version, app version, IP address, crash logs); and purchase data (purchase token, product ID, purchase/subscription status from Google Play Billing — we never receive your card number, bank details, or Google account password).",
    },
    {
      heading: "3. Legal Basis for Processing",
      body: "We process your personal data under: contract performance (registering your account, delivering core features); legitimate interests (fraud/abuse prevention, platform improvement, security monitoring); consent (push notifications, verification documents — withdrawable at any time); and legal obligation (complying with lawful requests from Zimbabwean authorities, including the Zimbabwe Republic Police and POTRAZ).",
    },
    {
      heading: "4. How We Use Your Information",
      body: "To create and manage your account and verify your identity; display your listings, Business Shop, candidate profile, or job postings; deliver in-app and push notifications; moderate listings and enforce our Terms and Community Guidelines; investigate reports of abuse, fraud, or illegal content; improve the app based on aggregated usage analytics; detect and prevent security threats; and comply with legal obligations.",
    },
    {
      heading: "5. Sharing and Service Providers",
      body: "We do not sell, rent, or trade your personal information. We share data only with trusted sub-processors: Supabase Inc. (database, auth, storage, realtime — hosted on AWS eu-west-1/Ireland); Google LLC/Firebase (Android push notifications via FCM); Apple Inc. (iOS push via APNS); Google LLC Sign in with Google (name/email shared if you choose Google login); Google LLC Google Play Billing (purchase token, product ID, subscription status for paid features). All sub-processors are bound by data processing agreements. We may disclose data if required by a court order, warrant, or lawful request from a competent Zimbabwean authority.",
    },
    {
      heading: "6. Push Notifications",
      body: "We send push notifications to alert you to new messages, listing approvals, business enquiries, and account activity. You can disable push notifications at any time in your device's notification settings.",
    },
    {
      heading: "7. Camera, Photos, and Media",
      body: "The app requests camera/photo library access only when you choose to upload photos for a listing, profile picture, or Business Shop images. We do not scan your photo library beyond images you explicitly select. Uploaded photos are stored in our file storage and are publicly accessible via the listing or profile where they appear.",
    },
    {
      heading: "8. Location Data",
      body: "PaMarket does not request or collect your precise GPS location automatically. Province and suburb information is entered manually. You may optionally share a location pin within in-app messaging, shared only with the specific recipient.",
    },
    {
      heading: "9. Cookies and Analytics",
      body: "The PaMarket web version may use strictly necessary cookies to maintain your session. We do not use advertising cookies or cross-site tracking. Aggregated, anonymised usage analytics are collected within the app; no analytics data is linked to your name or contact details.",
    },
    {
      heading: "10. Data Retention",
      body: "Account data: retained while active, deleted within 30 days of a deletion request. Listings: retained until deleted, may remain in server logs up to 90 days after removal. Messages: retained 24 months from last activity, then purged. Verification documents: deleted within 30 days of review outcome. Push tokens: deleted on logout/uninstall. Server/security logs: retained 90 days.",
    },
    {
      heading: "11. Security",
      body: "All data is transmitted using HTTPS/TLS encryption. Passwords are never stored in plain text; authentication is managed by Supabase Auth using industry-standard hashing. Our database tables are protected by row-level security (RLS) policies. We conduct periodic security reviews and apply patches promptly. If you become aware of a security vulnerability, report it to info@pamarketzw.com.",
    },
    {
      heading: "12. Your Rights and Choices",
      body: "Access: request a copy of your data by emailing us — we respond within 30 days. Correction: update your details via Settings at any time. Deletion: delete your account and all data via Settings — irreversible. Notification opt-out: disable push notifications in device Settings. Portability: request a machine-readable export by emailing us. Withdraw consent: where processing is based on consent, withdraw at any time without affecting prior processing lawfulness.",
    },
    {
      heading: "13. International Data Transfers",
      body: "Your data is stored and processed by Supabase on AWS infrastructure located in Ireland (EU). By using PaMarket you consent to this transfer, subject to appropriate contractual safeguards including Supabase's standard data processing agreement.",
    },
    {
      heading: "14. Children's Privacy",
      body: "PaMarket is intended for users aged 18 and over. We do not knowingly collect personal information from anyone under 18. If we become aware that a user is under 18, we will delete their account and all associated data without notice.",
    },
    {
      heading: "15. Marketing Communications",
      body: "We may occasionally send in-app notifications about new features, platform updates, or promotional offers. We do not send marketing emails or SMS without your explicit opt-in. You can opt out of in-app promotional notifications in Settings.",
    },
    {
      heading: "16. Changes to This Policy",
      body: 'We may update this Privacy Policy to reflect changes in our practices, technology, legal requirements, or business operations. We will notify you of significant changes via in-app notification. The "Last updated" date always reflects the most recent revision.',
    },
    {
      heading: "17. Contact",
      body: "PaMarket Zimbabwe · Email: info@pamarketzw.com · WhatsApp: +971 589 772 645",
    },
  ],
};

export const COMMUNITY_GUIDELINES: LegalDoc = {
  title: "Community Guidelines",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "PaMarket is a community marketplace built on trust. These guidelines set the standards of behaviour we expect from every user — buyers, sellers, business owners, job seekers, and employers. Violating these guidelines may result in your listing being removed, your account being suspended, or a permanent ban. Serious violations may be reported to law enforcement authorities in Zimbabwe.",
    },
    {
      heading: "1. Listing Honesty",
      body: "Every listing must be honest and complete: only list items you physically have in your possession and have the legal right to sell; your title, description, and photos must accurately represent the actual condition, age, brand, model, and any known defects of the item; do not use manufacturer stock photos or images downloaded from the internet — take real photos of the actual item under good lighting; clearly disclose any damage, scratches, faults, missing parts, or prior repairs in the description; remove or update your listing immediately when the item is sold, rented, or no longer available; do not repost the same item repeatedly to push it to the top of search results.",
    },
    {
      heading: "2. Prohibited Items and Services",
      body: "The following are never permitted on PaMarket, regardless of context or claimed purpose: stolen goods of any kind; counterfeit goods — fake branded clothing, replica watches, pirated software, unauthorised copies of any product; drugs and narcotics — any illegal substance, controlled drug, or drug paraphernalia; weapons — unlicensed firearms, illegal knives, ammunition, explosives, or weapons parts; wildlife — live wild animals, ivory, rhino horn, skins, or any product protected under the Zimbabwe Parks and Wildlife Act or CITES; adult content — pornographic images, videos, or services of any kind; unlicensed alcohol and tobacco sold without a valid government retail licence; prescription medicine sold without a valid pharmacist licence; financial scams — pyramid schemes, chain letters, MLM recruitment, Ponzi schemes, advance fee fraud (419), investment opportunities with guaranteed returns; counterfeit currency or any instrument used to commit fraud; rental or property listings for properties that do not exist or that the poster has no right to let; human trafficking or any offer of persons for sale, labour exploitation, or sexual services; personal data of third parties, including phone number lists, email databases, or identity documents; hazardous materials including toxic chemicals, flammable gases, or radioactive items.",
    },
    {
      heading: "3. Listing Quality Standards",
      body: 'Title: be specific. Include brand, model, year, size, or condition where relevant. "2019 Samsung Galaxy S10 128GB - Excellent Condition" is better than "Samsung phone for sale". Description: write at least 3-4 sentences. Include why you are selling, the history of the item, any accessories included, and your preferred contact method. Price: set a realistic market price in USD. Check similar listings to calibrate. "Price negotiable" is acceptable as a note but every listing must have a price. Photos: upload at least 2 clear photos. Show multiple angles, include any damage, and photograph serial numbers on electronics. A listing with 5+ photos gets significantly more enquiries. Category: choose the most specific correct category. If your item fits multiple categories, choose the primary one. Location: select the actual province and suburb where the item is located. Do not list in a different area to attract more views.',
    },
    {
      heading: "4. Pricing Standards",
      body: "All prices on PaMarket must be in United States Dollars (USD). This is a platform-wide rule. Do not list items at deliberately misleading prices to attract clicks, then refuse to sell at that price. If your price changes, update your listing immediately. Do not attempt to collect payment in cryptocurrency, mobile money from a stranger before meeting, or any form that removes buyer protection, unless both parties have agreed in full knowledge of the risks.",
    },
    {
      heading: "5. Respectful Communication",
      body: "Treat every user with courtesy, even if a negotiation does not go your way. Do not send bulk or unsolicited messages. Do not use PaMarket messaging to advertise to strangers. Do not threaten, bully, harass, intimidate, or discriminate against any user on the basis of race, ethnicity, gender, religion, sexual orientation, disability, or any other characteristic. Do not share your bank account number, national ID, passport, or PIN through the chat. PaMarket will never ask for this information through chat. If someone is rude, threatening, or suspicious, use the Block and Report functions. Do not engage or retaliate.",
    },
    {
      heading: "6. Business Shop Standards",
      body: "Your Business Shop must represent a real, lawfully operating business registered or operating in Zimbabwe. Your business name, description, logo, contact details, and product listings must all be accurate. Do not impersonate another business, brand, or organisation. Do not use another company's logo, name, or trademarks without written permission. If your business changes address, phone number, or closes, update or remove your Business Shop immediately. Featured listings in your Shop must represent products you actually stock and are ready to sell. Do not use your Business Shop to promote pyramid schemes, MLM downlines, or financial products without appropriate licensing.",
    },
    {
      heading: "7. Hire Talent Standards — Employers",
      body: "Job postings must be for genuine, existing vacancies at a real organisation. Fake job listings are fraud. Never charge candidates any fee to apply, register, train, or be placed. This is illegal under Zimbabwean labour law and is grounds for immediate permanent account suspension and referral to the Zimbabwe Republic Police. Job descriptions must be accurate regarding the role, responsibilities, remuneration, and required qualifications. Do not post the same job multiple times to appear at the top of search results. Mark your job as filled as soon as the vacancy is no longer open.",
    },
    {
      heading: "8. Hire Talent Standards — Job Seekers",
      body: "Your candidate profile must be accurate. Do not misrepresent your qualifications, experience, or skills. Do not create multiple profiles to increase visibility. Never pay any fee to apply for a job, attend an interview, or receive a job offer. Genuine employers do not charge candidates. If asked for money, report the listing immediately.",
    },
    {
      heading: "9. Fraud and Scam Awareness",
      body: "PaMarket is a free platform and we cannot screen every user. Protect yourself: advance fee fraud — if a buyer asks you to send an item before receiving payment, or offers to overpay by cheque and asks you to refund the difference, this is a scam — decline and report; fake rental deposits — never pay a deposit for a property before physically viewing it and verifying the landlord owns or manages it; too-good-to-be-true prices — a brand new iPhone for USD 50 is not a bargain, it is stolen or non-existent — walk away; urgency pressure — scammers create false urgency (\"I leave the country today, pay now\") — take your time, legitimate sellers will wait; impersonation — if someone claims to be a PaMarket employee or admin asking for your password or payment, this is a scam — PaMarket will never contact you through chat asking for payment or credentials.",
    },
    {
      heading: "10. Safe Transactions",
      body: "Always meet in a busy, public location during daylight hours. Shopping malls, filling station forecourts, and bank lobbies are recommended. Bring a friend or family member when meeting a stranger for a high-value transaction. Never invite a stranger to your home or travel alone to a stranger's home for a first meeting. Inspect and verify goods before handing over any money. For vehicle sales, insist on a test drive and verify the log book matches the seller's ID before paying. For electronics, test the device fully before payment — power it on, check IMEI against the box, verify the screen, camera, and ports work. Trust your instincts. If something feels wrong, walk away.",
    },
    {
      heading: "11. Reporting Violations",
      body: 'If you see content that violates these guidelines: tap the "..." or Report icon on the listing, profile, or message and select a reason; for urgent safety or fraud concerns, email info@pamarketzw.com directly with as much detail as possible; for criminal matters (stolen goods, fraud, weapons), contact the Zimbabwe Republic Police and share the listing URL with them. All reports are reviewed by our moderation team. We may not be able to share the outcome of every report with the reporter, but we act on all valid reports.',
    },
    {
      heading: "12. How We Enforce These Guidelines",
      body: "We apply a graduated enforcement approach based on the severity and frequency of violations: warning — first minor violation (e.g. mislabelled category, missing price); listing is removed or corrected and you receive an in-app warning; temporary suspension (7-30 days) — repeated minor violations or first moderate violation (e.g. misleading description, duplicate listings, disrespectful messaging); permanent ban — serious violations including fraud, listing illegal items, charging job seekers fees, sharing prohibited content, or any criminal activity — permanent bans are not reversed and all listings and data are removed; law enforcement referral — where there is evidence of criminal activity (fraud, stolen goods, drugs, weapons, human trafficking), we will cooperate fully with the Zimbabwe Republic Police, POTRAZ, and other competent authorities, including providing user data under valid legal process.",
    },
    {
      heading: "13. Appeals",
      body: "If you believe your listing was removed or your account was actioned in error, you may appeal by emailing info@pamarketzw.com within 14 days of the action, stating your account details and the reason you believe the action was incorrect. We will review your appeal and respond within 14 business days. Appeals against permanent bans for serious violations (fraud, illegal content, criminal activity) will not be considered.",
    },
    {
      heading: "14. Contact",
      body: "PaMarket Zimbabwe · Email: info@pamarketzw.com · WhatsApp: +971 589 772 645",
    },
  ],
};

export const ACCEPTABLE_USE_POLICY: LegalDoc = {
  title: "Acceptable Use Policy",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: 'This Acceptable Use Policy ("AUP") defines what you may and may not do on PaMarket. It applies to all users — buyers, sellers, employers, and visitors. Violations may result in content removal, account suspension, or referral to law enforcement.',
    },
    {
      heading: "1. Prohibited Listings",
      body: "You may not list, offer, or facilitate the sale of: illegal drugs, controlled substances, or drug paraphernalia; unlicensed firearms, weapons, ammunition, or explosives of any kind; stolen goods or items obtained through fraud or theft; counterfeit, pirated, or trademark-infringing products; human beings, human organs, or exploitation services; protected wildlife, endangered species, or their products; prescription medicines or medical devices without proper authority; alcohol or tobacco products sold to anyone under 18; any item whose sale is prohibited under Zimbabwean law.",
    },
    {
      heading: "2. Prohibited Conduct",
      body: "You may not: post false, misleading, or deceptive listings or descriptions; impersonate any person, business, government official, or authority; harvest, scrape, or collect other users' personal data without consent; send spam, unsolicited commercial messages, or bulk automated messages; attempt to bypass, disable, or circumvent any security or verification feature; use PaMarket to facilitate money laundering, hawala transfers, or financial fraud; create multiple accounts to circumvent a ban or platform restrictions; interfere with, disrupt, or place excessive load on PaMarket servers; charge job seekers any fee to apply, register, train, or be placed — this is illegal under Zimbabwean labour law.",
    },
    {
      heading: "3. Content Standards",
      body: "All content you post must: be accurate and not misleading in any material way; not contain hate speech, discriminatory language, or incitement to violence; not contain pornographic, explicit, or violent material; not infringe any third-party intellectual property, copyright, or trademark; not contain malware, viruses, phishing links, or harmful code; not reference or advertise external competitor platforms to poach users.",
    },
    {
      heading: "4. Fraud Prevention",
      body: "PaMarket takes fraud seriously. The following are automatic grounds for permanent suspension and police referral: accepting payment for goods you do not intend to deliver; requesting advance payment for a job or service without delivery; posing as a landlord or property agent to steal rental deposits; creating fake listings to collect contact details; identity theft or impersonation of another verified user.",
    },
    {
      heading: "5. Enforcement Actions",
      body: "Violations of this AUP may result in any combination of the following: warning — for minor or first-time violations; content removal — listing removed without notice; temporary suspension — 7 to 30 days for repeated violations; permanent ban — for serious, intentional, or criminal violations; law enforcement referral — for fraud, illegal items, or criminal activity, including full cooperation with the Zimbabwe Republic Police and POTRAZ.",
    },
    {
      heading: "6. Reporting Violations",
      body: "Use the flag icon on any listing or user profile to report. Our moderation team reviews reports 7 days a week, typically within 24 hours for urgent cases. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const COOKIE_DATA_POLICY: LegalDoc = {
  title: "Cookie & Data Policy",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "This Cookie & Data Policy explains what data PaMarket stores on your device, how we use it, and the controls you have. PaMarket is a mobile-first app — we primarily use device local storage rather than browser cookies.",
    },
    {
      heading: "1. What We Store Locally",
      body: "Auth session token — keeps you signed in — stored until sign out or expiry. App preferences (theme, language, notification settings) — stored until changed. Recently viewed listings — stored until cleared. Recent searches — stored until cleared. Cached listing data (faster loading, reduced data use) — stored until app restart.",
    },
    {
      heading: "2. Analytics & Performance",
      body: "We collect anonymised usage data to understand how the app is used and where we can improve. This includes: screen views and navigation paths (no personal data attached); error logs to diagnose app crashes and failures; performance metrics — load times, network latency; feature usage counts — e.g. how many times the search is used. This data is aggregated and cannot identify individual users.",
    },
    {
      heading: "3. Session Management",
      body: "Your authentication session is managed by Supabase, our backend provider. Sessions automatically expire after 7 days of inactivity. You can end your session at any time by signing out. For security, we may terminate sessions that show signs of compromise without notice.",
    },
    {
      heading: "4. Third-Party Services",
      body: "We use these services that may process data: Supabase — authentication, database, and file storage (ISO 27001 compliant); Cloudflare R2 — image and document storage (encrypted at rest); Firebase Cloud Messaging — push notifications on Android (optional); Cloudflare CDN — content delivery and DDoS protection. Each service operates under its own privacy policy. We select providers that comply with GDPR and modern data protection standards.",
    },
    {
      heading: "5. What We Do Not Do",
      body: "We never: sell your data to advertisers or data brokers; use third-party advertising trackers or retargeting pixels; share your personal information with other PaMarket users without your consent; use fingerprinting, cross-device tracking, or behavioural profiling for advertising.",
    },
    {
      heading: "6. Your Controls",
      body: "Clear recently viewed: Account → My Activity → Clear. Clear search history: Account → My Activity → Clear all. Sign out: ends your session and clears local auth token. Delete account: Settings → Security → Delete Account — permanently removes all your data from our servers within 30 days.",
    },
    {
      heading: "7. User Consent",
      body: "By continuing to use PaMarket you consent to the local storage practices described in this policy. For significant changes to how we handle your data, we will notify you via an in-app notification before the change takes effect. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const BUYING_SELLING_TERMS: LegalDoc = {
  title: "Buying & Selling Terms",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "These Buying & Selling Terms govern all marketplace transactions on PaMarket. By posting a listing or contacting a seller you agree to these terms.",
    },
    {
      heading: "1. Seller Responsibilities",
      body: "All sellers must: own the item outright or have legal authority to sell it; list only genuine items that are physically available and in your possession; provide an accurate description including condition (new, used, damaged); upload real photos of the actual item — not stock photos or images from the internet; set a fair and honest price in USD or ZiG; disclose any known defects, damage, or faults clearly in the description; respond to buyer enquiries within a reasonable time; remove listings immediately once an item is sold; meet buyers only in a safe, public place for in-person exchanges.",
    },
    {
      heading: "2. Buyer Responsibilities",
      body: "All buyers must: inspect items thoroughly before paying — all sales are final unless otherwise agreed; never send money before seeing and verifying the item in person; negotiate respectfully — do not harass sellers with unreasonable offers; report suspicious listings using the flag icon rather than proceeding with a risky transaction; understand that PaMarket does not process or hold payments on your behalf.",
    },
    {
      heading: "3. Payment",
      body: "PaMarket does not process, hold, or guarantee any payment. All payments are arranged directly between buyer and seller. Common methods include: cash on collection (recommended for in-person meetups); EcoCash or OneMoney (verify receipt before releasing item); bank transfer (verify cleared funds before releasing item); Zipit or RTGS. Never use Western Union, gift cards, or cryptocurrency to pay for PaMarket listings. These are almost always scams.",
    },
    {
      heading: "4. Prohibited Items in Listings",
      body: "See our Acceptable Use Policy and Prohibited Items Policy for the full list. Key items you may not sell include: illegal drugs, weapons, stolen goods, counterfeit products, and any item prohibited under Zimbabwean law.",
    },
    {
      heading: "5. Price & Currency",
      body: "Listings may be priced in USD or ZiG. PaMarket displays an approximate ZiG equivalent using our published exchange rate, which is updated regularly but may not reflect the exact interbank or market rate at time of transaction. The agreed price between buyer and seller governs — PaMarket's displayed rate is for reference only.",
    },
    {
      heading: "6. Listing Duration & Renewal",
      body: "Listings remain active for 30 days from the date of posting. You may renew any listing at any time from My Listings — this resets the 30-day timer and moves your listing back to the top. PaMarket may remove listings that violate our policies without notice or prior warning. Listings that have been inactive for 90 days may be archived automatically.",
    },
    {
      heading: "7. Platform Role & Liability",
      body: "PaMarket is a classified advertising platform. We do not inspect items, guarantee descriptions, mediate disputes, or take responsibility for the quality, legality, or safety of any item listed. All transactions are between private parties. Use good judgement and always inspect before you pay. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const REFUND_DISPUTE_POLICY: LegalDoc = {
  title: "Refund & Dispute Policy",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "PaMarket is a free classified advertising platform — we do not process payments or hold funds. This policy explains how to handle disputes and what PaMarket can and cannot do.",
    },
    {
      heading: "1. PaMarket's Role in Disputes",
      body: "PaMarket is not a party to any transaction between a buyer and a seller. We do not hold escrow, process payments, or guarantee delivery. As a result, we cannot: force a seller to issue a refund; retrieve money paid to another user; guarantee that a transaction will be completed; act as an arbitrator in a payment dispute.",
    },
    {
      heading: "2. When a Deal Goes Wrong",
      body: "If you believe you have been defrauded: report the listing — use the flag icon on the listing; we will investigate and may remove the seller's account; block the user — prevent further contact from the seller; contact support — email support@pamarketzw.com with full details including screenshots; report to police — for fraud involving money or goods, file a report with the Zimbabwe Republic Police, PaMarket will cooperate fully with law enforcement; contact your bank or mobile money provider — for EcoCash/OneMoney disputes, contact the provider directly as soon as possible.",
    },
    {
      heading: "3. Seller Refund Obligations",
      body: "While PaMarket cannot legally compel a seller to refund, sellers who: take payment and do not deliver goods; deliver goods materially different from their listing description; accept deposits for items they do not own or cannot deliver — are in breach of our Terms of Use and Zimbabwean consumer protection law. Confirmed cases will result in permanent account suspension and may be referred to the Zimbabwe Republic Police.",
    },
    {
      heading: "4. PaMarket Boost & Subscription Refunds",
      body: "For paid services within the PaMarket app (boosted listings, business subscriptions): refund requests must be submitted within 7 days of payment to support@pamarketzw.com; refunds are processed within 10 business days if approved; services already delivered (e.g. a completed boost campaign) are non-refundable; technical issues or errors that prevented delivery of a paid service qualify for a full refund.",
    },
    {
      heading: "5. Safety Tips to Avoid Disputes",
      body: "Always inspect the item before paying — even a partial inspection helps. Never pay a deposit for an item you have not seen unless you know the seller personally. Use in-person cash transactions where possible for high-value items. If a deal feels too good to be true, report it and walk away. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const JOB_PLATFORM_TERMS: LegalDoc = {
  title: "Job Platform Terms",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "These Job Platform Terms govern use of the PaMarket jobs feature by all employers and job seekers. They supplement our main Terms of Use and are binding on all users of the jobs module.",
    },
    {
      heading: "1. Employer Verification",
      body: "Before posting a job, your company or sole trader profile must be verified. Verification requires: Certificate of Incorporation (companies) or National ID (sole traders); current ZIMRA Tax Clearance Certificate; valid photo ID of the business owner or authorised representative; a photo of the physical business premises; company name matching your ZIMRA and CRBZ registration. Verification is reviewed within 2 business days. Submitting false or doctored documents is a criminal offence and will result in permanent suspension and referral to the Zimbabwe Republic Police.",
    },
    {
      heading: "2. Employer Obligations",
      body: "As a verified employer you agree to: post only genuine vacancies that exist within your organisation; never charge job seekers any fee to apply, register, attend an interview, complete a test, purchase equipment, or be placed — this is unlawful recruitment under the Labour Act [Chapter 28:01] and grounds for immediate permanent ban and police referral; provide an honest job title, accurate salary range or \"competitive\", correct location, and clear role description; not post the same vacancy more than once in the same 30-day period; respond to applicants within a reasonable timeframe; remove or mark any vacancy as \"Filled\" within 3 days of hiring; comply with all applicable Zimbabwean employment, health and safety, and anti-discrimination law.",
    },
    {
      heading: "3. Job Seeker Obligations",
      body: "As a job seeker you agree to: provide honest and accurate information in your CV, profile, and applications; apply only for roles you genuinely intend to pursue; not submit false qualifications, certifications, or work history; not use automated bots or scripts to mass-apply to listings; treat employers with professional respect in all communications.",
    },
    {
      heading: "4. Anti-Scam Protection",
      body: "PaMarket prohibits: any job listing that directly or indirectly requests money from applicants; multi-level marketing, pyramid schemes, or commission-only recruitment disguised as employment; work-from-home schemes requiring upfront equipment or registration fees; fake company listings designed to harvest personal data; listings offering unusually high salaries for unskilled roles (a common fraud indicator). If an employer requests money from you at any stage, report it immediately using the flag icon. Do not pay. PaMarket will never contact you asking for money.",
    },
    {
      heading: "5. Data Handling for Job Applications",
      body: "When you apply for a job, your CV and contact details are shared only with the verified employer who posted the vacancy. PaMarket does not sell applicant data. Employers must not use applicant data for any purpose other than the specific vacancy applied for.",
    },
    {
      heading: "6. Platform Liability",
      body: "PaMarket is a platform connecting employers and job seekers. We do not screen candidates, guarantee employment outcomes, or act as a recruitment agency. PaMarket is not a party to any employment contract formed between an employer and a job seeker, and is not liable for any hiring decision, employment dispute, workplace injury, or loss arising from use of the jobs feature. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const SERVICE_PLATFORM_TERMS: LegalDoc = {
  title: "Service Platform Terms",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "These Service Platform Terms apply to all users who advertise or hire services on PaMarket, including domestic services, professional services, repairs, transport, and freelance work.",
    },
    {
      heading: "1. For Service Providers",
      body: "By advertising a service on PaMarket you agree to: provide services honestly matching your advertised description and pricing; hold any required licences, certifications, or registrations for regulated services (e.g. electrical, plumbing, medical); not quote one price and charge another without prior agreement; meet clients in a safe, agreed location for any in-person service; protect client privacy and not share personal information obtained through PaMarket; not sub-contract services to a third party without the client's knowledge.",
    },
    {
      heading: "2. For Service Clients",
      body: "When hiring a service through PaMarket you agree to: clearly communicate your requirements before agreeing to a price; not demand services beyond what was agreed without additional payment; provide a safe working environment for service providers visiting your premises; pay in full upon satisfactory completion unless otherwise agreed in writing.",
    },
    {
      heading: "3. Regulated & Professional Services",
      body: "For services regulated under Zimbabwean law (medical, legal, financial, electrical, plumbing, security), service providers must: hold and display their relevant professional registration or licence number in their listing; ensure they have valid professional indemnity insurance where applicable; comply with all applicable professional conduct standards. PaMarket does not verify professional licences. Clients are responsible for verifying credentials before engaging any regulated service provider.",
    },
    {
      heading: "4. Platform Liability",
      body: "PaMarket provides a space for service providers and clients to connect. We do not vet, endorse, or take responsibility for the quality, legality, or safety of any service advertised. We are not liable for any loss, injury, property damage, or dispute arising from services arranged through the platform.",
    },
    {
      heading: "5. Prohibited Service Listings",
      body: "You may not advertise: illegal services of any kind; services constituting employment (use the Jobs section instead); pyramid scheme recruitment or MLM onboarding; services that violate our Acceptable Use Policy. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const FRAUD_PREVENTION_POLICY: LegalDoc = {
  title: "Fraud & Scam Prevention",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "PaMarket is committed to being a safe platform for Zimbabweans to buy, sell, and find work. This policy explains how we detect and prevent fraud, and how you can protect yourself.",
    },
    {
      heading: "1. Common Scams on Classified Platforms",
      body: "Be alert to: non-delivery fraud — seller takes payment and disappears without delivering goods; advance fee fraud — buyer or seller asks you to pay a fee upfront to \"release\" payment or goods; overpayment scam — buyer sends more than the asking price and asks for change back; fake job scams — employer requests fees from job seekers disguised as training, uniforms, or background checks; rental deposit theft — fake landlords collect deposits for properties they do not own; vehicle scams — low prices for cars that do not exist or are heavily encumbered.",
    },
    {
      heading: "2. Warning Signs",
      body: "Price is significantly below market value without a clear reason. Seller or employer requests payment via Western Union, gift cards, crypto, or wire transfer. Seller refuses to meet in person or provide verification of ownership. Communication switches quickly to WhatsApp or personal email to avoid platform oversight. Employer promises very high salary for unskilled or vague work. Any party asks you to act urgently or secretly.",
    },
    {
      heading: "3. PaMarket's Detection Measures",
      body: "Automated detection of patterns associated with fraudulent listings. Employer verification before job postings are approved. Identity verification (blue badge) for user trust signals. AI-assisted moderation flagging suspicious listing content. Community reporting — user flags reviewed within 24 hours. Cooperation with POTRAZ and Zimbabwe Republic Police on active investigations.",
    },
    {
      heading: "4. Your Protections",
      body: "Verified badges (blue) on user profiles indicate identity verification. Business verified badges indicate company registration and ZIMRA compliance. Report any suspicious listing or user immediately using the flag icon. Block any user who contacts you inappropriately.",
    },
    {
      heading: "5. If You Have Been Scammed",
      body: "Do not pay any more money — stop all further contact. Screenshot all messages, listings, and payment receipts. Email support@pamarketzw.com immediately with full details. Report to Zimbabwe Republic Police (ZRP) — bring all evidence. Contact your bank or mobile money provider (EcoCash, OneMoney) immediately for a possible chargeback. Report the user in-app using the flag icon.",
    },
    {
      heading: "6. PaMarket's Commitment",
      body: "We will: investigate all fraud reports within 24-48 hours; permanently ban confirmed fraudulent accounts; cooperate fully with the Zimbabwe Republic Police and POTRAZ; share relevant user data with law enforcement under valid legal process; continue improving our detection systems to stay ahead of new fraud techniques. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const PROHIBITED_ITEMS_POLICY: LegalDoc = {
  title: "Prohibited Items Policy",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "This policy lists items that may not be bought, sold, or advertised on PaMarket under any circumstances. This list reflects Zimbabwean law, our platform values, and widely accepted marketplace standards.",
    },
    {
      heading: "1. Absolutely Prohibited (Zero Tolerance)",
      body: "These items result in immediate permanent ban and possible law enforcement referral: illegal drugs, narcotics, controlled substances, or drug paraphernalia of any kind; unlicensed firearms, prohibited weapons, ammunition, or explosives; any item related to human trafficking, forced labour, or exploitation; child sexual abuse material or any content involving minors in a sexual context; stolen goods or items obtained through criminal means; counterfeit currency, forged documents, or fake identification.",
    },
    {
      heading: "2. Regulated Items (Require Licence or Authority)",
      body: "These may be listed only if you hold the required Zimbabwean licence or authority: licensed firearms and ammunition (firearms licence required, certificate of transfer required); prescription medicines and medical devices (pharmacy or medical licence required); alcohol and tobacco products (liquor licence or trade authority required); certain agricultural chemicals and pesticides (ZAA approval required); financial products and investment schemes (SEC Zimbabwe registration required); land and property (estate agent registration with REIVAZ required for agents).",
    },
    {
      heading: "3. Counterfeit & Intellectual Property Violations",
      body: "Counterfeit branded goods (fake Nike, Adidas, Apple, Samsung, etc.). Pirated software, films, music, or games on any media. Products using another brand's trademarked logos or marks without authorisation. Replica luxury goods presented as genuine.",
    },
    {
      heading: "4. Animals & Wildlife",
      body: "Protected wildlife and endangered species, or their parts/derivatives. Live animals without proof of legal breeding, vaccination records, and health certificates. Ivory, rhino horn, or any product derived from protected CITES-listed animals. Pets that were obtained through illegal trapping or import.",
    },
    {
      heading: "5. Digital & Online Items",
      body: "Hacking tools, malware, exploit kits, or stolen account credentials. Fake social media accounts, followers, likes, or engagement services. Personal data dumps, email lists obtained without consent. Virtual currency or in-game items from games that prohibit real-money trading.",
    },
    {
      heading: "6. Reporting Prohibited Items",
      body: "If you see a prohibited item listed on PaMarket, tap the flag icon on the listing to report it. Our moderation team reviews reports 7 days a week. For urgent cases involving illegal weapons or human trafficking, contact the Zimbabwe Republic Police directly. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const ACCOUNT_SUSPENSION_POLICY: LegalDoc = {
  title: "Account Suspension Rules",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "This policy explains when and how PaMarket may suspend or permanently ban accounts, what options you have if you believe an action was taken in error, and how reinstatement works.",
    },
    {
      heading: "1. Grounds for Account Action",
      body: "PaMarket may take action on your account for: violation of our Terms of Use, Acceptable Use Policy, or Community Guidelines; posting prohibited or illegal listings; fraudulent activity or attempts to defraud other users; impersonating another person or business; creating multiple accounts to circumvent a previous ban; abusing, threatening, or harassing other users or PaMarket staff; submitting false verification documents; accumulation of confirmed complaints from other users.",
    },
    {
      heading: "2. Types of Account Action",
      body: "Warning (1st offence, minor violation) — email and in-app notification; no access restriction; listing may be removed. Listing removal — specific content removed; account remains active. Temporary suspension (7–30 days) — account locked; user cannot post, message, or apply for jobs; lifted automatically. Permanent ban — account permanently closed; all listings and data removed; user may not create a new account. Law enforcement referral — for criminal activity, PaMarket will cooperate fully with the Zimbabwe Republic Police, POTRAZ, and other competent authorities.",
    },
    {
      heading: "3. How We Notify You",
      body: "When your account is actioned, we will: send an email to your registered address explaining the reason; display an in-app notification if your account allows it; for permanent bans, send a detailed explanation by email within 48 hours.",
    },
    {
      heading: "4. Appealing an Account Action",
      body: "If you believe your account was suspended in error: email support@pamarketzw.com within 14 days of the action; include your registered email address, the date of the action, and why you believe it was incorrect; provide any relevant evidence (screenshots, receipts, communications); we will review your appeal and respond within 14 business days.",
    },
    {
      heading: "5. Non-Appealable Actions",
      body: "The following account actions cannot be appealed: permanent bans for fraud, illegal content, or criminal activity; bans for human trafficking or child exploitation material; bans for accounts confirmed by law enforcement as criminal; bans for users who have previously had a successful appeal and re-violated.",
    },
    {
      heading: "6. Reinstatement",
      body: "Temporary suspensions are lifted automatically on the stated date. No action is required from you. For temporary suspensions where the underlying violation has been resolved (e.g. a removed listing), you may contact support to request early reinstatement, which is at PaMarket's sole discretion. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const CONTENT_MODERATION_POLICY: LegalDoc = {
  title: "Content Moderation Policy",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "This policy explains how PaMarket moderates content, how decisions are made, and how you can engage with the moderation process.",
    },
    {
      heading: "1. What We Moderate",
      body: "PaMarket moderates: all new listings before or shortly after they go live; user-reported listings and user profiles; profile photos, business logos, and verification documents; messages flagged by our automated systems for prohibited content; job postings before activation for verified employers; reviews and ratings for fake or abusive content.",
    },
    {
      heading: "2. How Moderation Works",
      body: "Automated screening — AI-assisted systems scan listings for prohibited keywords, images, and patterns before they go live. Human review — our moderation team reviews flagged content, reported listings, and complex cases. Community reporting — users can flag any listing using the flag icon; all reports are reviewed within 24 hours. Proactive monitoring — we regularly audit categories with higher fraud rates (vehicles, property, jobs).",
    },
    {
      heading: "3. Moderation Decisions",
      body: "When content is reviewed, we may: approve the content — no action taken; edit the listing (e.g. remove a prohibited category or correct pricing currency); request additional information from the seller; remove the listing with or without warning; suspend or permanently ban the account.",
    },
    {
      heading: "4. Appeals",
      body: "If your listing or content was removed and you believe this was incorrect, email support@pamarketzw.com within 14 days. Include the listing details and your reason for appeal. We will review and respond within 7 business days.",
    },
    {
      heading: "5. Transparency",
      body: "PaMarket publishes moderation statistics quarterly to give users insight into the health of our marketplace. These include number of listings removed per category, number of accounts banned, and fraud reports processed. Statistics are published on our website at pamarket.app. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const REVIEWS_RATINGS_POLICY: LegalDoc = {
  title: "Reviews & Ratings Policy",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "Reviews and ratings on PaMarket help buyers and sellers make informed decisions. This policy governs how reviews work, what is and isn't allowed, and how disputes are handled.",
    },
    {
      heading: "1. Who Can Leave a Review",
      body: "Any registered user who has had a genuine interaction with the reviewee (buyer/seller/employer/job seeker). Reviews should reflect your honest, first-hand experience. You may not review yourself or arrange for friends or associates to leave reviews on your behalf.",
    },
    {
      heading: "2. Review Standards",
      body: "Reviews must: be based on a genuine, direct transaction or interaction on PaMarket; be honest and reflect your actual experience; not contain personal attacks, hate speech, or discriminatory language; not include links, contact details, or promotional content; not be left in exchange for payment, a discount, or any incentive.",
    },
    {
      heading: "3. Prohibited Review Content",
      body: "Reviews will be removed if they: are fake, fabricated, or arranged by the reviewee; contain offensive, abusive, or threatening language; include defamatory statements that are untrue; are retaliatory reviews left with the intent to damage rather than inform; are duplicates of a review already left for the same transaction.",
    },
    {
      heading: "4. Star Rating System",
      body: "PaMarket uses a 1–5 star rating system: 5 stars — excellent experience, highly recommend; 4 stars — good experience with minor issues; 3 stars — average, met basic expectations; 2 stars — below expectations, significant issues; 1 star — very poor experience or suspected fraud. Your overall rating is a rolling average of all verified reviews on your profile.",
    },
    {
      heading: "5. Disputing a Review",
      body: "If you believe a review violates this policy: tap the flag icon on the review to report it; our team will review within 7 business days; reviews that violate policy will be removed — genuine honest reviews will remain even if negative; you may respond publicly to any review on your profile — responses must also comply with our content standards.",
    },
    {
      heading: "6. Review Manipulation",
      body: "Creating fake reviews, incentivising reviews, or using multiple accounts to inflate ratings is a serious violation. Confirmed manipulation will result in: removal of all manipulated reviews; reset or adjustment of the overall rating; temporary or permanent account suspension. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const VEHICLE_LISTING_TERMS: LegalDoc = {
  title: "Vehicle Listing Terms",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "These Vehicle Listing Terms apply to all listings in the Motors & Vehicles category on PaMarket, including cars, trucks, minibuses, motorcycles, tractors, and other motorised vehicles.",
    },
    {
      heading: "1. Seller Requirements",
      body: "To list a vehicle you must: be the registered owner of the vehicle, or have written authority from the owner to sell; ensure the vehicle is not encumbered by an unresolved finance agreement (hire purchase, bank loan) without disclosing this clearly; upload clear, real photos of the actual vehicle — minimum 4 photos including front, rear, interior, and odometer; list the accurate mileage (odometer tampering is a criminal offence); disclose all known mechanical faults, accident history, and chassis or engine modifications; hold a valid ZRP Change of Ownership (Form MVA1) or be ready to process one at sale.",
    },
    {
      heading: "2. Required Information",
      body: "Each vehicle listing must include: make, model, and year of manufacture; engine size, fuel type (petrol/diesel/electric/hybrid); transmission type (manual/automatic); accurate mileage; right-hand or left-hand drive; current condition (excellent/good/fair/for parts); price in USD (or ZiG equivalent); province and city of the vehicle's location.",
    },
    {
      heading: "3. Buyer Protections",
      body: "Always inspect the vehicle in person before paying any deposit. Request a ZINARA (Zimbabwe National Road Administration) search to verify registration and outstanding fees. Request a police clearance to check if the vehicle is stolen. Never pay a full amount before inspecting and test-driving the vehicle. Insist on a written receipt and change of ownership form (ZRP Form MVA1) at point of sale.",
    },
    {
      heading: "4. Finance & Encumbered Vehicles",
      body: "Sellers must clearly disclose if a vehicle is under active hire purchase, bank loan, or any other financial encumbrance. Selling an encumbered vehicle without disclosure is fraud. Buyers who unknowingly purchase an encumbered vehicle may lose both the vehicle and their money.",
    },
    {
      heading: "5. Prohibited Vehicle Listings",
      body: "Vehicles with altered or removed chassis numbers (VIN/chassis tampering). Vehicles confirmed as stolen. Vehicles with tampered odometers. Write-offs presented as roadworthy without disclosure. Unlicensed vehicles being sold as roadworthy. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const PROPERTY_LISTING_TERMS: LegalDoc = {
  title: "Property Listing Terms",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "These Property Listing Terms apply to all listings in the Property & Accommodation category, including properties for sale, residential rentals, commercial lets, and short-term accommodation.",
    },
    {
      heading: "1. Seller & Landlord Requirements",
      body: "To list a property you must: be the property owner, a legally appointed agent, or have written authority from the owner; estate agents must be registered with the Real Estate Institute of Zimbabwe (REIVAZ); provide accurate photos of the actual property — not stock images or photos of a different property; disclose the accurate size, number of bedrooms/bathrooms, and all known structural or legal issues; list the correct suburb, city, and province; not list the same property multiple times simultaneously.",
    },
    {
      heading: "2. Rental Listings",
      body: "For residential and commercial rentals: state the monthly rental in USD or ZiG clearly; disclose any deposit requirements upfront (typically 1–3 months rental); specify what is and is not included (water, electricity, garden, security); specify lease duration and minimum rental period; do not collect deposits from prospective tenants until a written lease agreement is signed.",
    },
    {
      heading: "3. Buyer / Tenant Protections",
      body: "Never pay a deposit to a landlord or agent you have not met in person at the actual property. Request proof of ownership (title deeds) or the agent's REIVAZ licence before paying anything. Insist on a written lease or sale agreement before any payment is made. Be cautious of rental prices significantly below market rate — this is a common indicator of fraud. Use the DCIP (Deeds search) to verify property ownership before purchasing.",
    },
    {
      heading: "4. Short-Term / Holiday Accommodation",
      body: "Accurately describe sleeping capacity, amenities, and condition. Clearly state all fees (cleaning fees, tourist levy, security deposit). Cancellation policy must be stated clearly in the listing. Only list properties you have the right to sub-let or advertise commercially.",
    },
    {
      heading: "5. Prohibited Property Listings",
      body: "Properties you do not own or are not authorised to sell or let. Listings designed to collect deposits for properties that do not exist or are not available. Listings for illegally sub-divided land without proper council approval. Listings misrepresenting the location or condition of a property. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const VERIFIED_BUSINESS_RULES: LegalDoc = {
  title: "Verified Business Rules",
  updated: "Last updated: June 2026",
  sections: [
    {
      heading: "",
      body: "These rules apply to all businesses that have been granted Verified Business status on PaMarket. Verified status carries additional trust signals and responsibilities.",
    },
    {
      heading: "1. How to Get Verified",
      body: "Business Verification requires: Certificate of Incorporation from the Companies and Other Business Entities Act (COBE) registry; valid ZIMRA Tax Clearance Certificate (not more than 12 months old); photo ID of the authorised business representative; photo of the physical business premises with signage visible; business name matching ZIMRA and COBE registration exactly. Verification is reviewed within 2 business days. Verified status is displayed as a gold shield badge on your profile and listings.",
    },
    {
      heading: "2. Verified Business Privileges",
      body: "Gold verified badge on profile and all listings. Ability to post jobs on the PaMarket Jobs platform. Access to Business Dashboard (analytics, lead management). Priority in search results within your category. Access to Boost and Featured Listing tools. Ability to create a Business Profile page with your brand information.",
    },
    {
      heading: "3. Ongoing Obligations",
      body: "Verified businesses must: maintain a valid ZIMRA Tax Clearance Certificate — expired certificates will trigger automatic review; keep business information (address, phone, representative) current; comply with all platform rules with heightened accountability — violations by verified businesses are treated more seriously; not use the verified badge to deceive customers about the nature, scale, or credibility of your business; notify PaMarket immediately if the business changes ownership or ceases trading.",
    },
    {
      heading: "4. Revocation of Verified Status",
      body: "Verified status will be revoked for: allowing Tax Clearance Certificate to expire without renewal; fraudulent or misleading use of the verified badge; repeated Terms of Use violations; business deregistration or insolvency; confirmed fraud complaints from customers; submitting false documents at the time of verification. Revocation may be immediate and without prior warning in cases of fraud. Questions? Email support@pamarketzw.com",
    },
  ],
};

export const BOOSTED_LISTING_RULES: LegalDoc = {
  title: "Boosted Listings Rules",
  updated: "Last updated: July 2026",
  sections: [
    {
      heading: "",
      body: "These rules apply to all PaMarket paid platform features: listing boosts, featured slot packs, Business Shop subscriptions, Recruiter subscriptions, job posting credits, job boosts, and featured rental slots. All of these are purchased through Google Play Billing and must comply with all standard listing requirements.",
    },
    {
      heading: "1. What Boosting Does",
      body: 'Moves your listing to the top of search results and category pages. Adds a "Featured" or "Boosted" label to your listing card. Increases visibility in Browse and Home feeds. May include placement in the PaMarket "Top Picks" carousel. Duration depends on the package purchased (1, 7, or 30 days).',
    },
    {
      heading: "2. Eligibility",
      body: "Listings must meet all of the following before a boost can be applied: listing must be Active and comply with all Terms of Use; listing must have at least one real photo; listing must have an accurate title, description, and price; listings under review or flagged for policy violations are not eligible; prohibited items may not be boosted under any circumstances.",
    },
    {
      heading: "3. Payment & Refunds — Google Play Billing",
      body: "All paid features (boosts, featured slot packs, Business Shop and Recruiter subscriptions, job credits, job boosts, featured rental slots) are purchased and billed through Google Play Billing using the payment method on your Google account — PaMarket never receives or stores your card details. One-time purchases (boosts, slot packs, job credits, job boosts, featured rental slots) activate immediately after payment confirms and expire automatically at the end of the purchased duration or once the credits are used. Subscriptions (Business Shop and Recruiter plans) renew automatically each billing period until cancelled via Google Play Store > Payments and subscriptions > Subscriptions — PaMarket cannot cancel a subscription on your behalf. Refunds are requested through Google Play (Order history > Report a problem) and are subject to Google Play's refund policy. No refund is issued if a listing is removed for policy violations during an active boost or subscription period. If a purchase completes but the feature does not activate in the app, contact support with your Google Play order number and we will investigate and correct it.",
    },
    {
      heading: "4. Boost Limits",
      body: "Free accounts: maximum 1 boosted listing at a time. Verified businesses: additional featured slots depend on your Shop subscription tier plus any featured slot packs purchased. No listing may be kept permanently at position #1 — rotation applies to ensure fair access. Boosting does not exempt a listing from moderation or user reports.",
    },
    {
      heading: "5. Our Rights",
      body: "PaMarket reserves the right to: remove or suspend a boost or featured placement if the listing violates platform policies, even if payment has been made; adjust the boost algorithm to ensure a fair and diverse marketplace experience; refuse to boost or feature any listing at our sole discretion; direct you to Google Play for refund processing on any paid feature removed for policy violations. Questions? Email support@pamarketzw.com",
    },
  ],
};

export type LegalHubSection = {
  id: string;
  title: string;
  docs: LegalDocKey[];
};

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms_of_use: TERMS,
  privacy_policy: PRIVACY,
  community_guidelines: COMMUNITY_GUIDELINES,
  acceptable_use_policy: ACCEPTABLE_USE_POLICY,
  cookie_data_policy: COOKIE_DATA_POLICY,
  buying_selling_terms: BUYING_SELLING_TERMS,
  refund_dispute_policy: REFUND_DISPUTE_POLICY,
  job_platform_terms: JOB_PLATFORM_TERMS,
  service_platform_terms: SERVICE_PLATFORM_TERMS,
  fraud_prevention_policy: FRAUD_PREVENTION_POLICY,
  prohibited_items_policy: PROHIBITED_ITEMS_POLICY,
  account_suspension_policy: ACCOUNT_SUSPENSION_POLICY,
  content_moderation_policy: CONTENT_MODERATION_POLICY,
  reviews_ratings_policy: REVIEWS_RATINGS_POLICY,
  vehicle_listing_terms: VEHICLE_LISTING_TERMS,
  property_listing_terms: PROPERTY_LISTING_TERMS,
  verified_business_rules: VERIFIED_BUSINESS_RULES,
  boosted_listing_rules: BOOSTED_LISTING_RULES,
};

export const LEGAL_SECTIONS: LegalHubSection[] = [
  {
    id: "legal_terms",
    title: "Legal Terms",
    docs: ["terms_of_use", "privacy_policy", "acceptable_use_policy", "cookie_data_policy", "community_guidelines"],
  },
  {
    id: "marketplace_rules",
    title: "Marketplace Rules",
    docs: ["buying_selling_terms", "refund_dispute_policy", "job_platform_terms", "service_platform_terms"],
  },
  {
    id: "trust_safety",
    title: "Trust & Safety",
    docs: [
      "fraud_prevention_policy",
      "prohibited_items_policy",
      "account_suspension_policy",
      "content_moderation_policy",
      "reviews_ratings_policy",
    ],
  },
  {
    id: "platform_extensions",
    title: "Platform Extensions",
    docs: ["vehicle_listing_terms", "property_listing_terms", "verified_business_rules", "boosted_listing_rules"],
  },
];
