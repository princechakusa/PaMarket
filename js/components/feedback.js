(function(root,factory){
  var api=factory(root&&root.PMEscape);
  if(typeof module!=='undefined'&&module.exports)module.exports=factory(require('../utils/escape.js'));
  if(root)root.PMFeedback=api;
})(typeof self!=='undefined'?self:this,function(escape){
  'use strict';
  function state(message,options){
    options=options||{};
    var style=options.style?' style="'+escape.attribute(options.style)+'"':'';
    var action=options.actionHref&&options.actionLabel?'<br><br><a href="'+escape.attribute(options.actionHref)+'">'+escape.html(options.actionLabel)+'</a>':'';
    return '<div class="empty-state"'+style+'>'+escape.html(message)+action+'</div>';
  }
  return Object.freeze({empty:state,error:state});
});
