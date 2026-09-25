// Shared header behaviour, loaded right after the header in partials/header.html.
(function(){
  // Underline the current section in the shared header and bring it into
  // view on narrow screens, where the nav scrolls sideways.
  var header=document.currentScript&&document.currentScript.previousElementSibling;
  var nav=header&&header.querySelector('nav');
  if(nav&&!nav.querySelector('a[aria-current]')){
    var p=location.pathname.replace(/^\/+/,'').replace(/\.html$/,'').replace(/\/$/,'');
    var key=p===''||p==='index'?'market'
      :/^(jobs?|post-job|applications)$/.test(p)?'jobs'
      :/^(businesses|business|open-shop)$|^b\//.test(p)?'biz'
      :/^c\/cars-for-sale|^vehicles$/.test(p)?'cars'
      :/^(rentals|rental-[a-z-]+|my-rental-bookings)$|^r\//.test(p)?'rent'
      :/^(institutions?|post-campus-ad)$/.test(p)?'inst'
      :/^(browse|detail)$|^[lc]\//.test(p)?'all':null;
    var a=key&&nav.querySelector('a[data-nav="'+key+'"]');
    if(a){
      a.setAttribute('aria-current','page');
      a.classList.remove('text-on-surface-variant','hover:text-on-surface');
      a.classList.add('text-primary','font-bold','border-b-2','border-primary');
      if(nav.scrollWidth>nav.clientWidth)nav.scrollLeft=Math.max(0,a.offsetLeft-nav.offsetLeft-16);
    }
  }
  if(!window.doHeaderSearch)window.doHeaderSearch=function(){
    var i=document.getElementById('headerSearchInput'),q=i&&i.value?i.value.trim():'';
    location.href='/browse'+(q?'?q='+encodeURIComponent(q):'');
  };
  if(!window.setCurrency)window.setCurrency=function(cur){
    var on='px-2 py-1 rounded bg-primary text-on-primary font-bold shadow-sm',off='px-2 py-1 rounded text-on-surface-variant hover:text-on-surface transition-colors font-medium';
    var u=document.getElementById('currencyUsdBtn'),z=document.getElementById('currencyZigBtn');
    if(u&&z){u.className=cur==='USD'?on:off;z.className=cur==='ZiG'?on:off;}
  };
  // A photo that fails (slow network, or a file missing from storage) is
  // retried once, then replaced with a neutral placeholder instead of the
  // browser's broken-image icon.
  var PH='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#eef1f6"/><path d="M14 32l7-9 5 6 4-5 6 8z" fill="#b7c0cf"/><circle cx="19" cy="18" r="3" fill="#b7c0cf"/></svg>');
  document.addEventListener('error',function(e){
    var img=e.target;
    if(!img||img.tagName!=='IMG'||img.src.indexOf('data:')===0)return;
    if(!img.getAttribute('data-pm-retry')){
      img.setAttribute('data-pm-retry','1');
      var src=img.src;
      setTimeout(function(){img.src=src+(src.indexOf('?')<0?'?':'&')+'retry=1';},1200);
      return;
    }
    img.removeAttribute('srcset');
    img.src=PH;
    img.alt=img.alt||'Photo unavailable';
  },true);
})();
