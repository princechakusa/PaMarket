(function(root,factory){var api=factory(root,root.PMServiceTransport,root.PMSupabaseClient);if(typeof module!=='undefined'&&module.exports)module.exports=factory;if(root)root.PMInstitutions=api;})(typeof self!=='undefined'?self:this,function(root,transport,clientProvider){
  'use strict';
  var esc=transport.escape;
  var client=clientProvider&&clientProvider.get();
  var url=client?client.url:root.SUPABASE_URL;
  var key=client?client.publishableKey:root.SUPABASE_ANON_KEY;

  var TYPE_LABEL={university:'University',high_school:'High School',organization:'Organization'};
  var TYPES=['university','high_school','organization'];

  // Institution rows joined to province/city names -- mirrors the embed
  // mobile's app/institutions/index.tsx & [id].tsx use
  // (provinces!inner(name), cities!inner(name)/cities(name)). Only active
  // institutions are ever readable by anon per RLS ("institutions: public
  // read active"), so is_active=true here is defense-in-depth, not the real
  // boundary.
  var BASE_COLUMNS='id,type,official_name,short_name,search_aliases,province_id,city_id,suburb,logo_url,cover_image,founded_year,description,is_active,sort_order';
  var SELECT=BASE_COLUMNS+',provinces(name),cities(name)';

  function resolveName(v){return Array.isArray(v)?(v[0]&&v[0].name):(v&&v.name);}

  function normalize(row){
    if(!row)return null;
    row.province_name=resolveName(row.provinces);
    row.city_name=resolveName(row.cities);
    return row;
  }

  // opts: { type, province, q, limit }
  function fetchInstitutions(opts){
    opts=opts||{};
    var qp=['is_active=eq.true'];
    // provinces!inner is required for the embedded filter below to actually
    // exclude non-matching rows (a plain to-one embed filter only narrows
    // the embedded object, not the parent row) -- matches the mobile
    // screen's own use of provinces!inner(name) when a location filter is set.
    var select=opts.province?(BASE_COLUMNS+',provinces!inner(name),cities(name)'):SELECT;
    if(opts.type)qp.push('type=eq.'+esc(opts.type));
    if(opts.province)qp.push('provinces.name=eq.'+esc(opts.province));
    if(opts.q){
      var q=esc(opts.q);
      qp.push('or=(official_name.ilike.*'+q+'*,short_name.ilike.*'+q+'*)');
    }
    qp.push('select='+select);
    qp.push('order=sort_order.asc');
    qp.push('limit='+(opts.limit||100));
    return transport.fetchJson('institutions?'+qp.join('&')).then(function(rows){return (rows||[]).map(normalize);});
  }

  function fetchInstitutionById(id){
    return transport.fetchJson('institutions?id=eq.'+esc(id)+'&is_active=eq.true&select='+SELECT).then(function(rows){return normalize(rows&&rows[0])||null;});
  }

  // Real per-type counts (active institutions only) -- same head:true count
  // approach as app/institutions/index.tsx; the table is tens of rows, not
  // a scale that justifies a dedicated aggregate RPC.
  function fetchInstitutionTypeCounts(){
    return Promise.all(TYPES.map(function(t){
      return transport.exactCount('institutions?is_active=eq.true&type=eq.'+esc(t)).then(function(count){return [t,count];});
    })).then(function(pairs){
      var out={};
      pairs.forEach(function(p){out[p[0]]=p[1];});
      return out;
    });
  }

  // Organizations (businesses) tagged to an institution via
  // businesses.institution_id -- same table/columns the mobile app and
  // admin already read, direct .from('businesses') query (not the
  // institution_only-listings RPC, which is only about listings).
  function fetchInstitutionOrganizations(institutionId){
    var select='id,owner_user_id,name,logo,cover,photos,description,biz_type,category,status,institution_id,province,city,verification_level';
    return transport.fetchJson('businesses?institution_id=eq.'+esc(institutionId)+'&status=eq.active&select='+select+'&order=name.asc');
  }

  // Listings tagged to this institution -- MUST go through
  // get_institution_listings (Postgres RPC), never a plain
  // .from('listings') query: that RPC is the only path allowed to return
  // institution_only-visibility listings (see
  // supabase/migrations/20260916160000_institution_only_access_boundary.sql).
  // A raw table query here would silently miss institution_only listings,
  // exactly the bug fixed on mobile 2026-09-19 ("Institution Only listings
  // 404 for everyone but the seller").
  // opts.extraQuery: optional array of raw "column=op.value" PostgREST
  // filter strings applied on top of the RPC's returned rows (PostgREST
  // horizontally filters a `returns setof listings` function's result the
  // same way it filters a table) -- lets the fixed category-filter chips on
  // the institution detail page narrow the RPC output, exactly as the
  // mobile screen chains applyInstitutionListingFilter() onto the same rpc().
  function fetchInstitutionListings(institutionId,opts){
    opts=opts||{};
    var body={
      p_institution_id:String(institutionId),
      p_limit:opts.limit||20,
      p_offset:opts.offset||0,
      p_sort:opts.sort||'newest',
      p_min_price:(opts.minPrice===undefined||opts.minPrice===null)?null:opts.minPrice,
      p_max_price:(opts.maxPrice===undefined||opts.maxPrice===null)?null:opts.maxPrice,
    };
    var qs=(opts.extraQuery&&opts.extraQuery.length)?('?'+opts.extraQuery.join('&')):'';
    return root.fetch(url+'/rest/v1/rpc/get_institution_listings'+qs,{
      method:'POST',
      headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    }).then(function(res){
      if(!res.ok)throw new Error('get_institution_listings failed: '+res.status);
      return res.json();
    });
  }

  // Real per-institution ACTIVE listing counts in one round trip -- used by
  // the institution hub's "Active Peer Listings" stat and the High Schools
  // Quick Switch chip row, neither of which can use the get_institution_listings
  // RPC directly (that RPC is a single-institution setof-listings function,
  // not an aggregate). The live listings table is small (order of hundreds
  // of active rows total), so one select of institution_id is cheap and
  // avoids firing one exactCount request per institution (40 rows today).
  // Mirrors the RPC's own visibility rules (status=active only) so counts
  // shown in the UI can never exceed what get_institution_listings would
  // actually return for that institution.
  function fetchInstitutionListingCounts(){
    return transport.fetchJson('listings?institution_id=not.is.null&status=eq.active&select=institution_id&limit=1000').then(function(rows){
      var out={};
      (rows||[]).forEach(function(r){ if(r.institution_id) out[r.institution_id]=(out[r.institution_id]||0)+1; });
      return out;
    });
  }

  // Listings tagged to any institution, for the directory's "Campus
  // Listings" feed. Institution-only listings are excluded (they stay on
  // their institution's own page), same rule as the mobile directory.
  // opts: { type, q, sort: 'newest'|'price_asc'|'price_desc', limit, offset }
  // Resolves { rows, total }. type/q filter by the listing's institution via
  // an inner embed so pagination and the total stay correct.
  var CAMPUS_COLUMNS='id,title,price,currency,category,province,city,suburb,photos,created_at,institution_id';
  function fetchCampusListings(opts){
    opts=opts||{};
    var inner=!!(opts.type||opts.q);
    var qp=['status=eq.active','institution_id=not.is.null',
      'or=(attributes->>institution_visibility.is.null,attributes->>institution_visibility.neq.institution_only)'];
    if(opts.type)qp.push('institutions.type=eq.'+esc(opts.type));
    if(opts.q){var q=esc(opts.q.replace(/[(),*]/g,' ').trim());if(q)qp.push('institutions.or=(official_name.ilike.*'+q+'*,short_name.ilike.*'+q+'*)');}
    var filters=qp.join('&');
    var embed='institutions'+(inner?'!inner':'')+'(id,official_name,short_name,type)';
    var order=opts.sort==='price_asc'?'price.asc.nullslast,created_at.desc':opts.sort==='price_desc'?'price.desc.nullslast,created_at.desc':'created_at.desc';
    var page='listings?'+filters+'&select='+CAMPUS_COLUMNS+','+embed+'&order='+order+'&limit='+(opts.limit||12)+'&offset='+(opts.offset||0);
    var count='listings?'+filters+'&select=id'+(inner?',institutions!inner(id)':'');
    return Promise.all([transport.fetchJson(page),transport.exactCount(count).catch(function(){return null;})])
      .then(function(r){return {rows:r[0]||[],total:r[1]};});
  }

  return Object.freeze({
    TYPE_LABEL:TYPE_LABEL,
    fetchCampusListings:fetchCampusListings,
    TYPES:TYPES,
    fetchInstitutions:fetchInstitutions,
    fetchInstitutionById:fetchInstitutionById,
    fetchInstitutionTypeCounts:fetchInstitutionTypeCounts,
    fetchInstitutionOrganizations:fetchInstitutionOrganizations,
    fetchInstitutionListings:fetchInstitutionListings,
    fetchInstitutionListingCounts:fetchInstitutionListingCounts,
  });
});
