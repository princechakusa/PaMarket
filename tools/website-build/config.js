'use strict';
const ROOT_PAGES = ['404.html','about.html','account-settings.html','advertise.html','applications.html','auth-callback.html','auth.html','blog-post.html','blog.html','boost-return.html','browse.html','business.html','chats.html','community-guidelines.html','contact.html','cookie-policy.html','dashboard.html','delete-account.html','detail.html','faq.html','favourites.html','help.html','index.html','jobs.html','notifications.html','open-shop.html','plans.html','post-ad.html','post-job.html','privacy.html','profile.html','rental-detail.html','rental-fleet.html','rentals.html','saved-searches.html','services.html','terms.html'];
const ROOT_FILES = ['.nojekyll','CNAME','auth.js','favicon.ico','icon-192.png','manifest.json','og.png','robots.txt','sitemap.xml','splash_preview.png','tiktok1mCasP5b4G2Y26Jw2yIiyOlbhxA7lxpw.txt','tiktokSUza2eSJJ8O29BUe1mO4ADek6dL2dLTc.txt'];
const PUBLIC_TREES = [
  {dir:'css',extensions:['.css']},{dir:'js',extensions:['.js']},
  {dir:'img',extensions:['.png','.jpg','.jpeg','.gif','.webp','.svg','.avif']},
  {dir:'l',extensions:['.html']},{dir:'b',extensions:['.html']},{dir:'r',extensions:['.html']},
];
const PROHIBITED_SEGMENTS = new Set(['www','apps','android','ios','supabase','tools','scripts','docs','.github','qa-system','node_modules','.git']);
module.exports={ROOT_PAGES,ROOT_FILES,PUBLIC_TREES,PROHIBITED_SEGMENTS,GENERATED_ROUTE_DIRS:['l','b','r']};
