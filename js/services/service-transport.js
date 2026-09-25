(function(root,factory){
  var api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=factory;
  if(root)root.PMServiceTransport=api;
})(typeof self!=='undefined'?self:this,function(root){
  'use strict';
  var sharedClient=root.PMSupabaseClient&&root.PMSupabaseClient.get();
  var url=sharedClient?sharedClient.url:root.SUPABASE_URL;
  var key=sharedClient?sharedClient.publishableKey:root.SUPABASE_ANON_KEY;
  function session(){return root.PMSession&&typeof root.PMSession.getSession==='function'?root.PMSession.getSession():null;}
  function fetchJson(path,token){return root.fetch(url+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+(token||key)}}).then(function(res){if(!res.ok)throw new Error('Supabase request failed: '+res.status);return res.json();});}
  function exactCount(path){return root.fetch(url+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact',Range:'0-0'}}).then(function(res){var range=res.headers.get('content-range');var total=range&&range.indexOf('/')>-1?parseInt(range.split('/')[1],10):0;return total||0;});}
  // On failure, throws an Error carrying .code and .details from
  // PostgREST's error body (e.g. code '23P01'/'22023' from a RAISE
  // EXCEPTION ... USING errcode = '...' in an RPC) so callers can branch on
  // the same codes the RN app does, and show the server's actual message
  // (e.g. "This vehicle has a minimum rental of 3 days") instead of a
  // generic HTTP-status string.
  function rpcJson(fn,args,token){
    return root.fetch(url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json'},body:JSON.stringify(args||{})})
      .then(function(res){
        if(res.ok)return res.json();
        return res.json().catch(function(){return null;}).then(function(body){
          var err=new Error((body&&(body.message||body.hint))||('Supabase RPC failed: '+res.status));
          err.code=body&&body.code;
          err.details=body&&body.details;
          throw err;
        });
      });
  }
  return Object.freeze({escape:encodeURIComponent,fetchJson:fetchJson,exactCount:exactCount,rpcJson:rpcJson,session:session});
});
