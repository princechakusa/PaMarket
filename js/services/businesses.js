(function(root,factory){var api=factory(root.PMServiceTransport);if(typeof module!=='undefined'&&module.exports)module.exports=factory;if(root)root.PMBusinesses=api;})(typeof self!=='undefined'?self:this,function(transport){
  'use strict';var esc=transport.escape;
  function fetchBusinesses(opts){opts=opts||{};var qp=['status=eq.active'];if(opts.q)qp.push('name=ilike.*'+esc(opts.q)+'*');qp.push('select=id,name,logo,cover,description,category,province,city,verification_level');qp.push('order='+(opts.order||'created_at.desc'));qp.push('limit='+(opts.limit||24));if(opts.offset)qp.push('offset='+opts.offset);return transport.fetchJson('businesses?'+qp.join('&'));}
  function fetchBusinessById(id){var current=transport.session();return transport.fetchJson('businesses?id=eq.'+esc(id)+'&select=*',current&&current.access_token).then(function(rows){return rows[0]||null;});}
  return Object.freeze({fetchBusinesses:fetchBusinesses,fetchBusinessById:fetchBusinessById});
});
