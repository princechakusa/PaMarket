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
  return Object.freeze({escape:encodeURIComponent,fetchJson:fetchJson,exactCount:exactCount,session:session});
});
