(function(root,factory){
  var api=factory(root.PMServiceTransport);
  if(typeof module!=='undefined'&&module.exports)module.exports=factory;
  if(root)root.PMListings=api;
})(typeof self!=='undefined'?self:this,function(transport){
  'use strict';
  var esc=transport.escape;
  var SELECT='select=id,title,price,currency,category,province,city,suburb,photos,created_at,boost,featured_until,expires_at';
  function filters(opts){var qp=['status=eq.active','expires_at=gt.'+esc(new Date().toISOString())];if(opts.category)qp.push('category=eq.'+esc(opts.category));if(opts.province)qp.push('province=ilike.*'+esc(opts.province)+'*');if(opts.city)qp.push('city=ilike.*'+esc(opts.city)+'*');if(opts.q)qp.push('title=ilike.*'+esc(opts.q)+'*');if(opts.businessId)qp.push('business_id=eq.'+esc(opts.businessId));if(opts.sellerId)qp.push('seller_id=eq.'+esc(opts.sellerId));if(opts.subcat)qp.push('attributes->>subcat=eq.'+esc(opts.subcat));return qp;}
  function fetchListings(opts){opts=opts||{};var limit=opts.limit||24,qp=filters(opts);qp.push(SELECT,'order='+(opts.order||'created_at.desc'),'limit='+limit);if(opts.offset)qp.push('offset='+opts.offset);var base=transport.fetchJson('listings?'+qp.join('&'));if(!opts.featuredFirst||opts.order||opts.offset)return base;var fqp=filters(opts);fqp.push('featured_until=gt.'+encodeURIComponent(new Date().toISOString()),SELECT,'order=featured_until.desc','limit='+limit);return Promise.all([transport.fetchJson('listings?'+fqp.join('&')).catch(function(){return[];}),base]).then(function(results){var featured=results[0]||[],rest=results[1]||[],seen={};featured.forEach(function(row){seen[row.id]=true;});return featured.concat(rest.filter(function(row){return!seen[row.id];})).slice(0,limit);});}
  function fetchListingById(id){return transport.fetchJson('listings?id=eq.'+esc(id)+'&status=eq.active&expires_at=gt.'+esc(new Date().toISOString())+'&select=*').then(function(rows){return rows[0]||null;});}
  function fetchSimilarListings(category,excludeId,limit){return transport.fetchJson('listings?status=eq.active&expires_at=gt.'+esc(new Date().toISOString())+'&category=eq.'+esc(category)+'&id=neq.'+esc(excludeId)+'&select=id,title,price,currency,category,province,city,photos,created_at&order=created_at.desc&limit='+(limit||4));}
  function fetchListingCount(category){var qp=['status=eq.active','expires_at=gt.'+esc(new Date().toISOString()),'select=id'];if(category)qp.push('category=eq.'+esc(category));return transport.exactCount('listings?'+qp.join('&'));}
  return Object.freeze({fetchListings:fetchListings,fetchListingById:fetchListingById,fetchSimilarListings:fetchSimilarListings,fetchListingCount:fetchListingCount});
});
