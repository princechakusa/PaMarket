// Ported verbatim from www/js/help.js pages.ReportProblem_after KB array (37 topics).
// Keep tags/answer/chips text identical to the Capacitor source — this is
// real user-facing support content, not paraphrased.

export type KbEntry = {
  tags: string[];
  answer: string;
  chips: string[];
};

export const KB: KbEntry[] = [
  {
    tags: ['sign in','login','log in','signin','forgot password','reset password','locked out','wrong password','account access','cant sign','cannot sign','email not found','not signing','change password'],
    answer: 'To sign in:\nTap "Sign In" on the home screen and enter your email and password.\n\nForgot your password?\n• Tap "Forgot Password" below the sign-in form\n• Check your inbox AND spam folder for the reset link\n• The link expires in 1 hour — request a new one if needed\n\nIf your email is not recognised, you may have registered with a different address or via Google.',
    chips: ['Delete Account', 'Account Banned', 'Talk to a Human'],
  },
  {
    tags: ['post','create listing','add listing','sell','post ad','how to post','new listing','list item','publish listing','upload item','add item'],
    answer: 'To post a listing:\n1. Tap the orange + Post button at the bottom of the screen\n2. Choose the right category\n3. Add 3–5 clear photos, a title, description, and price\n4. Set your location and tap Publish\n\nListings go live within a few minutes after review. Clear photos and honest descriptions get up to 3x more responses.',
    chips: ['Edit a Listing', 'Mark as Sold', 'Get Verified'],
  },
  {
    tags: ['verify','verification','id','identity','badge','blue badge','verified seller','document','selfie','id document','get verified','identity check'],
    answer: 'To earn your verified badge:\n1. Go to Profile (bottom nav)\n2. Tap "Verify Identity"\n3. Upload a clear photo of your national ID or passport\n4. Take a selfie — your face must match the ID\n5. Submit and wait up to 24 hours\n\nVerified sellers rank higher in search and get significantly more enquiries from buyers.',
    chips: ['Edit Profile', 'Post a Listing', 'Talk to a Human'],
  },
  {
    tags: ['message','chat','messaging','inbox','not receiving','send message','conversation','message seller','not syncing','not delivered','no reply','messages disappear','chat not working'],
    answer: 'Troubleshooting messages:\n\n• Make sure you are signed in\n• Check your internet connection\n• Close the app fully and reopen — messages sync on reload\n• Wait 10–15 seconds after sending for delivery\n\nTo start a new chat:\nOpen any listing → tap "Message Seller"\n\nIf the other person cannot see your message, ask them to close and reopen the app.',
    chips: ['Notification Issue', 'Block a User', 'Talk to a Human'],
  },
  {
    tags: ['scam','fraud','fake','suspicious','stolen','illegal','inappropriate','cheat','deceive','fake listing','advance fee','deposit scam','fake job','fake rental','report scam'],
    answer: 'To report a scam or suspicious listing:\n1. Open the listing or user profile\n2. Tap the menu (three dots) → tap "Report"\n3. Select "Fraud / Scam" and describe what happened\n4. Submit — we review within 24 hours\n\nSafety rules:\n• NEVER pay any deposit before physically viewing an item\n• NEVER share your OTP, PIN, or bank password\n• Meet in a safe, busy public place\n• If it feels wrong, walk away immediately',
    chips: ['Block a User', 'Report a User', 'Talk to a Human'],
  },
  {
    tags: ['report user','bad user','bad seller','bad buyer','harass','abusive','threatening','rude','spam'],
    answer: 'To report a user:\n1. Tap their name or profile picture to open their profile\n2. Scroll to the bottom\n3. Tap "Report User"\n4. Select the reason and submit\n\nTo block them immediately:\n• On their profile, tap "Block User"\n• They can no longer message you, see your phone number, or view your listings',
    chips: ['Report a Scam', 'Talk to a Human', 'Ask Another Question'],
  },
  {
    tags: ['payment','pay','ecocash','onemoney','bank transfer','mobile money','zipit','rtgs','how to pay','transaction','cash'],
    answer: "PaMarket uses direct peer-to-peer payments between buyers and sellers.\n\nAccepted methods:\n• EcoCash — send to seller's registered number\n• OneMoney — same process\n• Bank transfer (ZIPIT / RTGS)\n• Cash on delivery (meet in person)\n\nPaMarket does NOT hold or process payments. Always inspect items before paying — never pay sight-unseen.",
    chips: ['Report a Scam', 'Ask Another Question'],
  },
  {
    tags: ['job','apply','application','vacancy','hire','employer','employee','applied','apply for job','job not showing','job listing','find job'],
    answer: 'To apply for a job:\n1. Open the job listing\n2. Tap "Apply Now"\n3. Fill in your name, phone, email, and a short cover message\n4. Submit — the employer contacts you directly\n\nFor employers:\n• Post in the "Jobs" category\n• Tap "Mark as Filled" once the position is taken\n\nTip: Upload your CV in your profile for one-tap applications.',
    chips: ['Upload My CV', 'Post a Listing', 'Talk to a Human'],
  },
  {
    tags: ['cv','resume','upload cv','build cv','my cv','curriculum','work experience','open to work','job seeker'],
    answer: 'To build and upload your CV:\n1. Go to Profile (bottom nav)\n2. Tap "Edit Profile"\n3. Scroll to the CV / Work Experience section\n4. Add your job history, skills, education, and sector\n5. Toggle "Open to Work" ON so employers can find you\n\nYour CV is shared automatically when you apply for any job listing.',
    chips: ['Apply for a Job', 'Get Verified', 'Ask Another Question'],
  },
  {
    tags: ['delete account','remove account','close account','deactivate','leave pamarket','cancel account','erase account','remove my account'],
    answer: 'To permanently delete your account:\n1. Go to Settings (profile icon → Settings)\n2. Scroll to the Security section\n3. Tap "Delete Account"\n4. Enter your password to confirm\n\nThis cannot be undone. All your listings, messages, CV, and personal data are permanently deleted within 30 days.',
    chips: ['Sign In Issue', 'Talk to a Human', 'Ask Another Question'],
  },
  {
    tags: ['crash','not loading','slow','freeze','stuck','error','blank screen','app not working','force close','bug','broken','not opening','keeps crashing','white screen','technical','glitch'],
    answer: 'Step-by-step fix for app issues:\n\n1. Close the app fully and reopen it\n2. Check your internet (try switching between WiFi and mobile data)\n3. Restart your phone\n4. Clear the app cache:\n   Android: Settings → Apps → PaMarket → Storage → Clear Cache\n   iPhone: Settings → General → iPhone Storage → Offload App\n5. Uninstall and reinstall the latest version\n\nStill broken? Submit a bug report and we will fix it quickly.',
    chips: ['Submit a Bug Report', 'Talk to a Human', 'Ask Another Question'],
  },
  {
    tags: ['edit','update listing','change price','modify listing','update ad','change description','change photo','edit my listing'],
    answer: 'To edit a listing:\n1. Tap Profile (bottom nav) → My Listings\n2. Tap the listing you want to change\n3. Tap "Edit Ad"\n4. Update the title, price, photos, description, or location\n5. Tap Save — changes appear live within seconds',
    chips: ['Mark as Sold', 'Delete a Listing', 'Get Verified'],
  },
  {
    tags: ['delete listing','remove listing','take down','delete ad','remove ad','remove my listing'],
    answer: 'To delete a listing:\n1. Go to My Listings (Profile icon)\n2. Tap the listing\n3. Tap "Remove"\n4. Confirm deletion\n\nThe listing is permanently removed from the marketplace.\n\nIf you just sold the item, use "Stop It" instead — it hides the listing while keeping your record.',
    chips: ['Post a Listing', 'Edit a Listing', 'Ask Another Question'],
  },
  {
    tags: ['sold','mark sold','mark filled','filled','listing sold','close listing','item sold','job filled','position filled','stop listing'],
    answer: 'To mark a listing as sold or filled:\n1. Go to My Listings\n2. Tap the listing\n3. Tap "Stop It" (items / rentals) or "Stop It" (job vacancies)\n\nThe listing is hidden from public search but kept in your account records. Tap "Remove" if you want it fully deleted.',
    chips: ['Post a Listing', 'Edit a Listing', 'Ask Another Question'],
  },
  {
    tags: ['notification','alert','push notification','not getting notification','no notification','enable notification','not notified','push not working'],
    answer: 'To fix notifications:\n\nAndroid:\nSettings → Apps → PaMarket → Notifications → Turn ON\n\niPhone:\nSettings → PaMarket → Notifications → Allow Notifications\n\nAlso make sure you are signed in — notifications only work when logged in.\n\nYou will receive alerts for: new messages, job applications, listing status changes, and admin updates.',
    chips: ['Messages Issue', 'Talk to a Human', 'Ask Another Question'],
  },
  {
    tags: ['block','block user','blocked','unwanted messages','spam user','how to block'],
    answer: 'To block a user:\n1. Tap their name or profile photo to open their profile\n2. Scroll to the bottom of their profile\n3. Tap "Block User"\n\nBlocked users cannot message you, call you, or see your contact details. Manage all blocked users in Settings.',
    chips: ['Report a User', 'Messages Issue', 'Ask Another Question'],
  },
  {
    tags: ['free','cost','price','fee','how much','charges','paid feature','subscription','pricing','is it free'],
    answer: 'PaMarket is 100% free for buyers and sellers!\n\nEverything is free:\n• Post unlimited listings\n• Message any seller or buyer\n• Apply for jobs\n• Browse all categories\n• Create your profile and CV\n• Get verified\n\nNo subscription. No hidden fees. No commission on sales.',
    chips: ['Post a Listing', 'Get Verified', 'Ask Another Question'],
  },
  {
    tags: ['profile','update profile','edit profile','change name','change photo','profile picture','bio','city','avatar','update my profile'],
    answer: 'To update your profile:\n1. Tap the Profile icon at the bottom\n2. Tap "Edit Profile"\n3. Change your name, profile photo, bio, city, phone number, or skills\n4. Tap Save\n\nA complete profile with a clear photo gets 3× more responses from buyers and employers.',
    chips: ['Get Verified', 'Upload My CV', 'Ask Another Question'],
  },
  {
    tags: ['rental','rent','house','room','property','accommodation','commercial space','apartment','flat','lodge','bedsit','find room'],
    answer: 'To find a rental:\n• Select the category on the home screen or search by city\n• Filter by price range and province\n• Tap any listing to see full details and contact the landlord directly\n\nTo post a rental:\n• Tap + Post → choose the right category\n• Add real photos of the actual property, monthly rent, and exact location\n\nNEVER pay a deposit before physically viewing a property.',
    chips: ['Post a Listing', 'Report a Scam', 'Ask Another Question'],
  },
  {
    tags: ['category','what can i sell','electronics','cars','vehicles','furniture','clothes','services','animals','farm','what can be sold','categories'],
    answer: 'PaMarket supports all legal categories:\n\nBuy & Sell\nElectronics · Clothing · Furniture · Vehicles · Appliances · Farm equipment\n\nJobs\nAll sectors · Full-time · Part-time · Freelance · Domestic\n\nRentals\nHouses · Rooms · Commercial spaces · Farmland\n\nServices\nPlumbing · Construction · Cleaning · Delivery · Tutoring\n\nAlways choose the most specific category — it gets your listing found faster.',
    chips: ['Post a Listing', 'Get Verified', 'Ask Another Question'],
  },
  {
    tags: ['photo','image upload','add photo','photo not uploading','picture not loading','image not showing','photo failed','upload image'],
    answer: 'Tips for uploading photos:\n• Use JPG or PNG files under 5 MB each\n• Make sure your internet is stable when uploading\n• Try a different photo if one specific image keeps failing\n• Clear app cache if photos will not display\n\nYou can add up to 5 photos per listing. The FIRST photo becomes your thumbnail — make it the best, clearest shot.',
    chips: ['Post a Listing', 'Edit a Listing', 'Submit a Bug Report'],
  },
  {
    tags: ['renew','expired listing','30 days','listing expired','listing removed','disappeared','no longer showing','listing gone','expired'],
    answer: 'Listings stay active for 30 days, then automatically archive.\n\nTo renew an expired listing:\n1. Go to My Listings\n2. Find the expired listing\n3. Tap "Post Again"\n\nThis re-publishes it free for another 30 days.\n\nIf your listing disappeared before 30 days, it may have been reported and removed. Check your notification inbox or contact us.',
    chips: ['Edit a Listing', 'Post a Listing', 'Talk to a Human'],
  },
  {
    tags: ['search','find listing','browse','cant find','not showing up','listing not found','search not working','search results','not appearing'],
    answer: 'How to find listings:\n• Use the search bar at the top — try specific keywords like "iPhone 13 Harare"\n• Browse by category on the home screen\n• Filter by province, price range, or category\n\nIf YOUR listing is not showing in search:\n• It may still be under review (allow a few minutes after posting)\n• Check it has not expired (30-day limit)\n• Try searching for the exact title you used',
    chips: ['Post a Listing', 'Renew a Listing', 'Talk to a Human'],
  },
  {
    tags: ['banned','suspended','account suspended','account banned','why banned','appeal ban','unban','account disabled','account blocked'],
    answer: 'If your account has been suspended:\n\n1. Check your registered email — we send a notification explaining the reason\n2. Common reasons: policy violation, reported content, suspicious activity\n\nTo appeal:\n• Use the "Talk to a Human" option below\n• Include: your account email, reason you believe the ban is an error, any supporting evidence\n• We review all appeals within 7 days\n\nCreating a second account to bypass a ban results in permanent removal.',
    chips: ['Talk to a Human', 'Ask Another Question'],
  },
  {
    tags: ['change phone','phone number','update phone','new number','change number','update contact'],
    answer: 'To update your phone number:\n1. Go to Profile (bottom nav)\n2. Tap "Edit Profile"\n3. Update your phone number field\n4. Save changes\n\nYour phone number is visible to other users when they view your listings — make sure it is a number you actively use.',
    chips: ['Edit Profile', 'Get Verified', 'Ask Another Question'],
  },
  {
    tags: ['privacy','hide number','private','who can see','data','personal info','privacy settings','hide my number'],
    answer: 'To manage your privacy settings:\n1. Go to Profile → Settings\n2. Scroll to Privacy\n3. You can hide your phone number from listings, turn off messaging, and control who sees your profile\n\nYour data is never sold to third parties. We only use your information to operate the PaMarket platform.',
    chips: ['Edit Profile', 'Delete Account', 'Ask Another Question'],
  },
  {
    tags: ['business','shop','local shop','business profile','business account','create business','my shop','business listing'],
    answer: 'To create a business / local shop profile:\n1. Go to Profile (bottom nav)\n2. Tap "My Business" or look for the business option\n3. Set up your shop name, logo, categories, and description\n4. Link your listings to your shop\n\nBusiness profiles appear in the "Local Shops" section on the home screen and give you more visibility.\n\nContact us if you need help setting up a business account.',
    chips: ['Get Verified', 'Post a Listing', 'Talk to a Human'],
  },
  {
    tags: ['boost','sponsored','advertise','promote listing','feature listing','paid ad','promote my listing','boost my listing','boost listing'],
    answer: 'To boost a listing so it ranks higher in search and browse:\n1. Go to My Listings and open the listing you want to boost\n2. Tap "Boost Listing"\n3. Choose a duration — 1 day, 7 days, or 30 days\n4. Pay securely with Google Play Billing (your normal Google account payment method — card, Play balance, or carrier billing)\n\nBoosted listings get priority placement for the duration you choose. Payment is a one-time purchase, not a subscription — it simply expires after the period ends.',
    chips: ['Featured Slot Pack', 'Shop Subscription', 'Ask Another Question'],
  },
  {
    tags: ['shop subscription','shop plan','business plan','shop starter','shop pro','shop premium','upgrade shop','business subscription','shop billing'],
    answer: 'Shop subscriptions unlock extra features for your business profile — more featured slots, higher listing limits, and priority placement, depending on the tier.\n\nAvailable plans (monthly, billed via Google Play):\n• Shop Starter\n• Shop Pro\n• Shop Premium\n\nTo subscribe:\n1. Go to your Business Profile\n2. Tap "Upgrade" or "Manage Subscription"\n3. Pick a plan and confirm through Google Play Billing\n\nSubscriptions renew automatically each month through your Google account until you cancel. You can manage or cancel anytime from Google Play → Subscriptions — PaMarket cannot cancel it for you.',
    chips: ['Featured Slot Pack', 'Boost a Listing', 'Talk to a Human'],
  },
  {
    tags: ['featured slot','slot pack','extra slots','featured slot pack','more featured slots'],
    answer: 'Featured Slot Packs give your shop extra featured-listing slots (on top of what your subscription tier includes).\n\nAvailable packs (one-time purchase via Google Play Billing):\n• +1 slot\n• +3 slots (best value)\n\nTo buy one: go to your Business Profile → Featured Slots → "Buy More Slots" and complete the purchase through Google Play. Slots are added to your account immediately after payment confirms.',
    chips: ['Shop Subscription', 'Boost a Listing', 'Ask Another Question'],
  },
  {
    tags: ['recruiter','recruiter subscription','recruiter plan','recruiter monthly','job posting subscription','unlimited job posts'],
    answer: 'The Recruiter subscription is for employers who post jobs regularly. It gives you a monthly allowance of job posts plus recruiter tools, billed monthly through Google Play Billing.\n\nTo subscribe:\n1. Go to Post → Jobs (or your Recruiter dashboard)\n2. Tap "Subscribe" under Recruiter Plan\n3. Confirm the purchase through Google Play\n\nIt renews automatically each month. Manage or cancel anytime from Google Play → Subscriptions.\n\nPrefer to pay per job instead? Use Job Posting Credits — no subscription required.',
    chips: ['Job Posting Credits', 'Job Boost', 'Talk to a Human'],
  },
  {
    tags: ['job credit','job posting credit','job credits','pay per job post','credit pack','job post credit'],
    answer: 'Job Posting Credits let you pay per job listing instead of subscribing to the Recruiter plan — each credit lets you post one job.\n\nAvailable packs (one-time purchase via Google Play Billing):\n• 1 job post credit\n• 5 job post credits (best value)\n\nTo buy: go to Post → Jobs → "Buy Job Credits" and complete the purchase through Google Play. Credits are added to your account instantly and are spent automatically the next time you post a job.',
    chips: ['Recruiter Subscription', 'Job Boost', 'Ask Another Question'],
  },
  {
    tags: ['job boost','boost job','boost vacancy','promote job listing','feature job'],
    answer: 'To boost a job listing so it appears higher for job seekers:\n1. Go to My Listings and open the job posting\n2. Tap "Boost Job"\n3. Choose 7 days or 30 days (best value)\n4. Pay securely through Google Play Billing\n\nThis is a one-time purchase per boost, separate from the Recruiter subscription and Job Posting Credits.',
    chips: ['Recruiter Subscription', 'Job Posting Credits', 'Ask Another Question'],
  },
  {
    tags: ['rental featured','feature my rental','featured rental','promote rental','rental slot','feature property'],
    answer: 'To feature a rental listing so it stands out to renters:\n1. Go to My Listings and open the rental listing\n2. Tap "Feature This Rental"\n3. Choose 7 days or 30 days (best value)\n4. Pay securely through Google Play Billing\n\nFeatured rentals get priority placement in rental search and browse for the duration purchased.',
    chips: ['Boost a Listing', 'Ask Another Question'],
  },
  {
    tags: ['refund','cancel subscription','cancel purchase','billing issue','charged twice','wrong charge','purchase failed','payment failed','play billing','google play billing','manage subscription','restore purchase'],
    answer: 'All paid features (boosts, featured slots, shop plans, recruiter plans, job credits) are billed through Google Play Billing — PaMarket never sees or stores your card details.\n\nTo manage or cancel a subscription:\nGoogle Play Store → tap your profile icon → Payments & subscriptions → Subscriptions\n\nTo request a refund:\nGoogle Play Store → Order history → find the purchase → Report a problem\n\nIf a purchase completed but the feature did not activate in the app, contact our support team with your order number and we will resolve it manually.',
    chips: ['Talk to a Human', 'Ask Another Question'],
  },
  {
    tags: ['update','version','new version','app update','outdated','install update','latest version'],
    answer: 'To update PaMarket to the latest version:\n\nAndroid:\nOpen Google Play Store → search "PaMarket" → tap Update\n\niPhone:\nOpen App Store → tap your profile icon → scroll to PaMarket → tap Update\n\nAlways keep the app updated for the best performance, bug fixes, and new features.',
    chips: ['App Not Working', 'Ask Another Question'],
  },
  {
    tags: ['password','change password','reset password','update password','forgot password','new password'],
    answer: 'To change your password:\n1. Go to Settings (profile icon → Settings)\n2. Tap "Change Password"\n3. Enter your current password, then your new password\n4. Tap Save\n\nForgot your current password?\n• Sign out, then tap "Forgot Password" on the sign-in screen\n• Check your email for the reset link',
    chips: ['Sign In Issue', 'Delete Account', 'Ask Another Question'],
  },
];

export const INIT_CHIPS = [
  'App Not Working', 'Sign In Issue', 'Post a Listing', 'Get Verified',
  'Messages Issue', 'Report a Scam', 'Job / CV Help', 'Account Banned',
  'Pricing Info', 'Shop Subscription', 'Recruiter Subscription', 'Boost a Listing',
  'Submit a Bug Report', 'Talk to a Human',
];

export const CHIP_MAP: Record<string, string> = {
  'Sign In Issue': 'sign in login forgot password',
  'Post a Listing': 'post create listing sell publish',
  'Get Verified': 'verify verification badge identity',
  'Messages Issue': 'message chat not working inbox',
  'Messaging Issue': 'message chat not working inbox',
  'Report a Scam': 'scam fraud fake suspicious',
  'Job / CV Help': 'job apply cv resume vacancy',
  'App Not Working': 'crash not loading freeze error bug technical glitch',
  'Pricing Info': 'free cost price fee subscription',
  'Account Banned': 'banned suspended appeal account',
  'Edit a Listing': 'edit update listing change price',
  'Delete a Listing': 'delete remove listing',
  'Mark as Sold': 'sold filled close listing',
  'Upload My CV': 'cv resume upload build',
  'Apply for a Job': 'job apply application vacancy',
  'Payment Methods': 'payment pay ecocash onemoney bank transfer',
  'Block a User': 'block user blocked harass',
  'Report a User': 'report user bad seller harass',
  'Notification Issue': 'notification alert push not getting',
  'Edit Profile': 'profile photo bio city update',
  'Renew a Listing': 'renew expired listing 30 days',
  'Change Password': 'password change reset forgot',
  'Privacy Settings': 'privacy hide number personal data',
  'Business Profile': 'business shop local profile account',
  'Boost a Listing': 'boost my listing promote feature listing',
  'Shop Subscription': 'shop subscription plan starter pro premium upgrade',
  'Featured Slot Pack': 'featured slot pack extra slots',
  'Recruiter Subscription': 'recruiter subscription plan monthly job posting',
  'Job Posting Credits': 'job credit posting pay per job post',
  'Job Boost': 'job boost promote vacancy feature job',
  'Rental Featured': 'rental featured feature my rental promote rental',
  'Billing Help': 'refund cancel subscription billing issue play billing manage',
};

// Mirrors www/js/help.js bestMatch(): count tag hits per KB entry, return the
// entry with the most hits (ties keep the first found), or null if no hits.
export function bestMatch(text: string): KbEntry | null {
  const lower = text.toLowerCase();
  let best: KbEntry | null = null;
  let top = 0;
  for (const entry of KB) {
    let hits = 0;
    for (const tag of entry.tags) {
      if (lower.indexOf(tag) !== -1) hits++;
    }
    if (hits > top) {
      top = hits;
      best = entry;
    }
  }
  return top > 0 ? best : null;
}
