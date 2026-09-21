(function(root,factory){
  var api=factory(root,root.PMServiceTransport);
  if(typeof module!=='undefined'&&module.exports)module.exports=factory;
  if(root)root.PMHomepageStats=api;
})(typeof self!=='undefined'?self:this,function(root,transport){
  'use strict';
  var esc=transport.escape;
  var nowIso=function(){return esc(new Date().toISOString());};

  // Real, live-queried counts for the homepage ecosystem pillars + category
  // pills. Mirrors the exactCount pattern already used by
  // js/services/institutions.js (fetchInstitutionTypeCounts) and
  // js/services/listings.js (fetchListingCount) -- no new query shape.
  function fetchHomepageCounts(){
    var activeFilter='status=eq.active&expires_at=gt.'+nowIso();
    var jobs='listings?'+activeFilter+'&category=eq.jobs';
    var vehicles='listings?'+activeFilter+'&category=eq.vehicles';
    var property='listings?'+activeFilter+'&category=in.(property,rooms)';
    var electronics='listings?'+activeFilter+'&category=eq.electronics';
    var agriculture='listings?'+activeFilter+'&category=eq.agriculture';
    var services='listings?'+activeFilter+'&category=eq.services';
    var allActive='listings?'+activeFilter;
    var businesses='businesses?status=eq.active';
    var institutions='institutions?is_active=eq.true';

    return Promise.all([
      transport.exactCount(allActive),
      transport.exactCount(jobs),
      transport.exactCount(businesses),
      transport.exactCount(institutions),
      transport.exactCount(vehicles),
      transport.exactCount(property),
      transport.exactCount(electronics),
      transport.exactCount(agriculture),
      transport.exactCount(services)
    ]).then(function(r){
      return {
        activeListings:r[0],
        jobs:r[1],
        businesses:r[2],
        institutions:r[3],
        vehicles:r[4],
        property:r[5],
        electronics:r[6],
        agriculture:r[7],
        services:r[8]
      };
    });
  }

  return Object.freeze({fetchHomepageCounts:fetchHomepageCounts});
});
