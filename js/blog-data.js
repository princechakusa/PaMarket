// Blog post content data, driving blog.html (index) and blog-post.html (?slug=).
// Adding a new post = adding an entry here. No new HTML files needed.
(function (global) {
  var POSTS = [
    {
      slug: 'how-to-sell-a-car-in-zimbabwe',
      title: 'How to Sell Your Car Fast in Zimbabwe',
      description: 'A step-by-step guide to selling your car quickly and safely on PaMarket, from pricing it right to meeting a buyer.',
      category: 'Selling Guides',
      datePublished: '2026-07-01',
      dateModified: '2026-07-01',
      readTime: '5 min read',
      keyword: 'how to sell a car in Zimbabwe',
      heroIntro: 'Selling a car privately in Zimbabwe is faster and more profitable than trading it in — if you price it right, photograph it well, and know what buyers actually check before they pay.',
      isHowTo: true,
      steps: [
        { name: 'Gather your documents', text: 'Have your registration book, valid insurance, and service history ready. Buyers ask for these before they commit, and having them upfront speeds up the sale.' },
        { name: 'Price it correctly', text: 'Check similar vehicles listed on PaMarket to see what comparable cars are actually selling for. Price 5-10% above your minimum to leave room for negotiation.' },
        { name: 'Take clear photos', text: 'Photograph the exterior from all four angles, the interior, the odometer, and the engine bay. Listings with 5 or more photos get significantly more enquiries.' },
        { name: 'Write an honest description', text: 'State the year, mileage, condition, and any known issues. Mention why you are selling. Honest listings build trust and reduce time-wasting enquiries.' },
        { name: 'Post your listing free on PaMarket', text: 'List under the Vehicles category with your price in USD and your province. Your ad reviews and typically goes live within 24 hours.' },
        { name: 'Meet buyers safely', text: 'Meet in a public location during daylight hours. Let a buyer test-drive with you in the car, and only hand over the keys and log book after payment clears.' }
      ],
      body: [
        'Selling a car privately in Zimbabwe usually gets you a better price than trading it in to a dealer, but it takes a bit more effort upfront. The biggest factor in how fast your car sells is price — list it too high and it sits for weeks; list it fairly and serious buyers reach out within days.',
        'Before you post anything, gather your registration book, a valid insurance certificate, and any service records you have. Buyers in Zimbabwe are increasingly cautious about stolen or cloned vehicles, and being able to produce clean documents immediately is often what separates a quick sale from a stalled one.',
        'Photos matter more than most sellers expect. Take pictures in daylight, from all four exterior angles, plus the interior, dashboard, odometer reading, and engine bay. Listings with several clear photos consistently get more enquiries than those with just one or two.',
        'Write a description that states the facts plainly: year, mileage, engine size, transmission, and condition, including anything that needs attention. Buyers who feel misled after driving out to view a car rarely come back — an honest listing filters in the buyers who are actually ready to purchase.',
        'When you meet a buyer, always choose a public, well-lit location and bring someone with you if possible. Let them inspect the car and take it for a test drive with you present. Only hand over the vehicle and documents once payment has fully cleared — never before.'
      ],
      faqs: [
        { q: 'How much does it cost to sell a car on PaMarket?', a: 'Selling a car on PaMarket is completely free — there are no listing fees or commission on the sale. You keep 100% of the agreed price.' },
        { q: 'What documents do I need to sell my car in Zimbabwe?', a: 'You need your vehicle registration book (log book), a valid insurance certificate, and ideally your service history. Buyers will typically ask to see these before finalizing a purchase.' },
        { q: 'How long does it take for a car listing to go live?', a: 'Vehicle listings are reviewed by the PaMarket team and typically go live within 24 hours of submission.' },
        { q: 'Should I accept a deposit before meeting the buyer?', a: 'Only accept a deposit from a buyer you trust and ideally after some verified contact. Never hand over the vehicle or documents until the full agreed payment has cleared.' }
      ],
      internalLinks: [
        { label: 'Browse vehicles for sale in Zimbabwe', href: 'browse?cat=vehicles' },
        { label: 'Post your vehicle listing free', href: 'post-ad?type=vehicles' }
      ]
    },
    {
      slug: 'how-to-buy-a-used-car-safely-in-zimbabwe',
      title: 'How to Buy a Used Car Safely in Zimbabwe',
      description: 'What to check, what to ask, and how to avoid common scams when buying a used car privately in Zimbabwe.',
      category: 'Buying Guides',
      datePublished: '2026-07-01',
      dateModified: '2026-07-01',
      readTime: '5 min read',
      keyword: 'how to buy a used car Zimbabwe',
      heroIntro: 'Buying a used car privately in Zimbabwe can save you thousands compared to a dealer — as long as you verify ownership, inspect the vehicle properly, and avoid the most common scam patterns.',
      isHowTo: true,
      steps: [
        { name: 'Verify the seller and ownership', text: 'Ask to see the registration book and confirm the name matches the seller\'s ID. If it does not match, ask why — there may be a legitimate reason, but proceed carefully.' },
        { name: 'Inspect the vehicle in daylight', text: 'Check the bodywork for mismatched paint (a sign of accident repair), inspect tyres for even wear, and check under the vehicle for leaks or rust.' },
        { name: 'Check the engine and take a test drive', text: 'Listen for unusual noises at idle and while driving. Test the brakes, air conditioning, and all electronics. Take it on a road with some bumps to check the suspension.' },
        { name: 'Verify the mileage matches wear', text: 'Compare the odometer reading against the general condition of the pedals, seat, and steering wheel — heavy wear with low mileage can indicate odometer tampering.' },
        { name: 'Agree on price and payment method', text: 'Negotiate based on comparable listings on PaMarket. Avoid cash-only deals for high-value vehicles where possible; use a traceable payment method.' },
        { name: 'Complete the transfer of ownership', text: 'Ensure the registration book is properly signed over to you and register the change of ownership as required by law.' }
      ],
      body: [
        'The single biggest risk when buying a used car privately in Zimbabwe is dealing with a vehicle that is stolen, has a cloned registration, or has undisclosed accident damage. None of these are difficult to screen for if you take a few deliberate steps before handing over any money.',
        'Start by verifying the seller. Ask to see the vehicle registration book and check that the name matches their national ID. If someone is selling on behalf of a relative or employer, ask for an explanation and, if the deal is large, ask for some form of written authorization.',
        'Inspect the car in daylight, never at night or in the rain. Walk around it slowly and look for panels that do not quite match in colour or texture — a common sign of prior accident repair. Check the tyres for even wear across all four, and look underneath for oil leaks or excessive rust.',
        'Take it for a proper test drive, not just around the block. Listen for knocking or grinding noises, test the brakes at a safe speed, and try every electrical feature — windows, air conditioning, lights, and infotainment. Problems here are expensive to fix and are useful negotiating points if the seller has not disclosed them.',
        'Finally, compare the mileage on the odometer against the general wear of the seats, pedals, and steering wheel. A very low mileage reading on a car that shows heavy wear is a red flag for tampering. Once you are satisfied, agree a price informed by similar listings on PaMarket, and make sure the registration book is properly transferred into your name.'
      ],
      faqs: [
        { q: 'How do I know if a car has a clean title in Zimbabwe?', a: 'Check that the registration book name matches the seller\'s ID, and ask directly whether the vehicle has ever been in an accident or reported stolen. You can also request the vehicle be checked against ZINARA records where available.' },
        { q: 'Is it safe to pay a deposit before viewing a car?', a: 'No. Never pay a deposit or any money before physically viewing and inspecting the vehicle in person. This is one of the most common scam patterns reported by buyers.' },
        { q: 'What is a fair price for a used car in Zimbabwe?', a: 'Compare the specific make, model, year and condition against similar active listings on PaMarket to judge a fair market price before negotiating.' },
        { q: 'Should I bring someone with me to view a car?', a: 'Yes. Bring a friend or family member, meet in a public location, and avoid viewing vehicles alone, especially for high-value purchases.' }
      ],
      internalLinks: [
        { label: 'Browse vehicles for sale in Zimbabwe', href: 'browse?cat=vehicles' },
        { label: 'Read our safety guide for meeting buyers and sellers', href: 'blog-post?slug=how-to-avoid-online-scams-zimbabwe' }
      ]
    },
    {
      slug: 'how-to-avoid-online-scams-zimbabwe',
      title: 'How to Avoid Online Marketplace Scams in Zimbabwe',
      description: 'The most common online marketplace scams targeting Zimbabwean buyers and sellers, and how to protect yourself.',
      category: 'Safety & Trust',
      datePublished: '2026-06-28',
      dateModified: '2026-06-28',
      readTime: '4 min read',
      keyword: 'how to avoid online scams Zimbabwe',
      heroIntro: 'Most online marketplace scams in Zimbabwe follow a handful of predictable patterns — advance-fee fraud, fake rental deposits, and too-good-to-be-true pricing. Knowing the patterns is the best defence.',
      isHowTo: false,
      body: [
        'Online marketplace scams in Zimbabwe tend to follow recognizable patterns rather than being entirely random. Once you know what to look for, most attempts become obvious before any money changes hands.',
        'Advance-fee fraud is the most common: a buyer offers to pay more than your asking price, then asks you to refund the difference before their payment has actually cleared. By the time you discover their payment was fake or reversed, the refund you sent is already gone. The rule is simple — never refund money on a payment that has not fully and irreversibly cleared.',
        'Fake rental deposits target people searching for property. A "landlord" who cannot show you the property in person, always has an excuse to be traveling, and asks for a deposit before any viewing is almost always a scam. Never pay any deposit for a property you have not physically viewed and verified.',
        'Prices that are dramatically below market value are the third major pattern — a brand-new iPhone at a fraction of its normal price, or a car priced well under every comparable listing. These are either stolen goods, non-existent items designed to collect a deposit, or bait to get you into an unsafe meeting.',
        'Scammers often create false urgency: "I am leaving the country today, you need to pay now" is a common line designed to stop you from thinking it through. Legitimate sellers and landlords will always give you reasonable time to verify and decide.',
        'If someone contacting you through PaMarket claims to be a PaMarket employee or administrator and asks for your password or a payment, this is always a scam — PaMarket staff will never ask for this information through chat.'
      ],
      faqs: [
        { q: 'What is advance-fee fraud and how do I avoid it?', a: 'Advance-fee fraud is when a buyer overpays you and asks for a refund of the difference before their original payment has cleared. Avoid it by never refunding money until a payment is fully and irreversibly confirmed.' },
        { q: 'Is it safe to pay a deposit for a rental property I have not seen?', a: 'No. Never pay a deposit for a property before physically viewing it and confirming the landlord actually owns or manages it.' },
        { q: 'How can I tell if a listing price is too good to be true?', a: 'Compare the price against several similar listings on PaMarket. If it is dramatically below every comparable listing, treat it as a strong warning sign rather than a lucky find.' },
        { q: 'How do I report a suspicious listing on PaMarket?', a: 'Tap the Report button on the listing or profile and select a reason. Our moderation team reviews all reports within 24 hours.' }
      ],
      internalLinks: [
        { label: 'View PaMarket Help Center and safety tips', href: 'help' },
        { label: 'Read our guide to buying a used car safely', href: 'blog-post?slug=how-to-buy-a-used-car-safely-in-zimbabwe' }
      ]
    },
    {
      slug: 'pamarket-vs-facebook-marketplace-zimbabwe',
      title: 'PaMarket vs Facebook Marketplace: Which Is Better for Zimbabwe?',
      description: 'A direct comparison of PaMarket and Facebook Marketplace for buying and selling in Zimbabwe.',
      category: 'Comparisons',
      datePublished: '2026-06-25',
      dateModified: '2026-06-25',
      readTime: '4 min read',
      keyword: 'Facebook marketplace Zimbabwe alternative',
      heroIntro: 'Facebook Marketplace and PaMarket both let Zimbabweans buy and sell, but they solve different problems — here is how they actually compare for someone selling in Harare or Bulawayo today.',
      isHowTo: false,
      body: [
        'Facebook Marketplace piggybacks on an app most Zimbabweans already have installed, which makes it a low-effort starting point. But it was not built specifically for Zimbabwe, and that shows in a few important ways once you actually try to use it to buy or sell something locally.',
        'Search and filtering is the first difference. Facebook Marketplace mixes local listings with irrelevant results from other regions and struggles with granular filtering by Zimbabwean province or city. PaMarket is built around Zimbabwe\'s actual provinces and cities from the ground up, so filtering by "vehicles in Harare" or "property for rent in Bulawayo" returns exactly that.',
        'Categories designed for Zimbabwe are the second difference. PaMarket has dedicated flows for property (sale vs rent), vehicle rental companies, and a full Hire Talent job board — none of which Facebook Marketplace was designed around. If you are a rental car company or hiring for a role, PaMarket has a structured way to do that; Facebook Marketplace does not.',
        'Contact and privacy also differ. On PaMarket, your phone number is never shown publicly — buyers reach out through the listing and you choose whether to share contact details. Facebook Marketplace ties your listing to your personal Facebook profile, which many sellers are not comfortable exposing to strangers.',
        'Cost is the same on both — Facebook Marketplace and PaMarket are both free to post on. The real difference is fit: Facebook Marketplace works fine for a casual one-off sale to someone in your existing network; PaMarket is built for people who want structured search, categories built for Zimbabwe, and privacy while doing it regularly.'
      ],
      faqs: [
        { q: 'Is PaMarket free like Facebook Marketplace?', a: 'Yes. Posting and browsing on PaMarket is completely free, with no listing fees or commission on sales — the same as Facebook Marketplace.' },
        { q: 'Does PaMarket show my phone number publicly like Facebook Marketplace?', a: 'No. PaMarket never displays your phone number publicly. Buyers contact you through the listing, and you choose when to share contact details directly.' },
        { q: 'Can I filter listings by city on PaMarket?', a: 'Yes. PaMarket lets you filter listings by Zimbabwean province and city, including Harare, Bulawayo, Mutare, Gweru and more — a feature Facebook Marketplace does not offer with the same precision locally.' },
        { q: 'Does PaMarket have a jobs section like Facebook Marketplace groups?', a: 'Yes. PaMarket has a dedicated Hire Talent section for posting and finding jobs across Zimbabwe, separate from general classifieds.' }
      ],
      internalLinks: [
        { label: 'Browse all listings on PaMarket', href: 'browse' },
        { label: 'See how PaMarket works', href: 'help' }
      ]
    },
    {
      slug: 'how-pamarket-works',
      title: 'How PaMarket Works: A Complete Guide',
      description: 'Everything you need to know about buying, selling, hiring and finding jobs on PaMarket, Zimbabwe\'s free marketplace.',
      category: 'Platform Education',
      datePublished: '2026-06-20',
      dateModified: '2026-06-20',
      readTime: '4 min read',
      keyword: 'how does PaMarket work',
      heroIntro: 'PaMarket is Zimbabwe\'s free online marketplace — here is exactly how posting, browsing, messaging and hiring work, from your first listing to your first sale.',
      isHowTo: true,
      steps: [
        { name: 'Create a free account', text: 'Sign up with your email, phone number or Google account in the PaMarket app or website. No fees or subscriptions are required at any point.' },
        { name: 'Post a listing', text: 'Choose a category — Property, Vehicles, Electronics, Jobs and more — add a title, description, price in USD, photos and your location.' },
        { name: 'Get reviewed and go live', text: 'Listings are reviewed by the PaMarket team, usually within 24 hours, to keep scams and prohibited items off the platform.' },
        { name: 'Receive enquiries', text: 'Interested buyers contact you directly through WhatsApp or PaMarket\'s messaging, without your phone number being shown publicly.' },
        { name: 'Negotiate and complete the sale', text: 'Agree on price and arrange a safe, public meeting. PaMarket does not process payments — all transactions happen directly between buyer and seller.' },
        { name: 'Mark your listing as sold', text: 'Once your item is sold, mark the listing as sold or remove it so other buyers do not keep contacting you about it.' }
      ],
      body: [
        'PaMarket exists to solve one problem: buying and selling in Zimbabwe has traditionally relied on word of mouth, scattered Facebook groups, or paying a commission to a middleman. PaMarket brings that into one free platform covering all ten provinces.',
        'Getting started takes under two minutes. Create a free account, choose a category for what you are selling — Property, Vehicles, Electronics, Furniture, Jobs, and eight more — and fill in a title, description, price in USD, and your province and suburb.',
        'Every listing is reviewed by the PaMarket team before it goes live, typically within 24 hours. This review step exists specifically to keep prohibited items, scams, and fake listings off the platform, which is part of why buyers trust listings enough to reach out.',
        'When a buyer is interested, they contact you directly — your phone number is never shown publicly on your listing. You choose when and how to share contact details, usually through the WhatsApp button on your own listing once you are ready to talk to a specific buyer.',
        'PaMarket does not process payments or take any commission on your sale. Every transaction happens directly between buyer and seller, in person, the same way it always has in Zimbabwe — PaMarket\'s role is simply to help you find each other safely and quickly.',
        'Beyond general classifieds, PaMarket also supports business shops for verified companies, a Hire Talent section for posting jobs and finding candidates, and a Vehicle Rental section for rental car companies — all under the same free, no-commission model.'
      ],
      faqs: [
        { q: 'Is PaMarket really free to use?', a: 'Yes. Posting and browsing on PaMarket is always 100% free, with no listing fees or commission on any sale. Optional paid promotions exist for extra visibility but are never required.' },
        { q: 'How long does it take for a listing to go live?', a: 'Listings are reviewed by the PaMarket team and typically go live within 24 hours of submission.' },
        { q: 'Does PaMarket handle payments between buyers and sellers?', a: 'No. PaMarket does not process payments or hold funds. All payments are arranged and completed directly between the buyer and seller.' },
        { q: 'Can businesses sell on PaMarket, not just individuals?', a: 'Yes. Businesses can create a free verified Shop with a product catalogue and dedicated business inbox, in addition to individual listings.' }
      ],
      internalLinks: [
        { label: 'Read the full FAQ', href: 'help' },
        { label: 'Post your first listing free', href: 'post-ad' }
      ]
    }
  ];

  var CATEGORIES = ['Buying Guides', 'Selling Guides', 'Safety & Trust', 'Comparisons', 'Platform Education'];

  function getAllPosts() { return POSTS; }
  function getPostBySlug(slug) { return POSTS.filter(function (p) { return p.slug === slug; })[0] || null; }
  function getPostsByCategory(cat) { return POSTS.filter(function (p) { return p.category === cat; }); }
  function getCategories() { return CATEGORIES; }

  global.PMBlog = {
    getAllPosts: getAllPosts,
    getPostBySlug: getPostBySlug,
    getPostsByCategory: getPostsByCategory,
    getCategories: getCategories
  };
})(window);
