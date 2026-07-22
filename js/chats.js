(function(){
  'use strict';
  var SB_URL=window.SUPABASE_URL,SB_KEY=window.SUPABASE_ANON_KEY;
  var session=null,me=null;
  var conversations=[],profiles={},listings={};
  var activeTab='personal',unreadOnly=false,activeConvId=null;
  var msgChannel=null,typingChannel=null,typingChannelConvId=null,presenceChannel=null;
  var onlineUsers={};
  var toastTimer=null,typingTimer=null,lastTypingSent=0;
  var shell=document.getElementById('chatShell');

  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]})}
  function initials(name){return String(name||'User').trim().split(/\s+/).slice(0,2).map(function(v){return v.charAt(0)}).join('').toUpperCase()||'U'}
  function headers(extra){return Object.assign({apikey:SB_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},extra||{})}
  function toast(message,isError){var el=document.getElementById('chatToast');if(!el)return;el.textContent=message;el.classList.toggle('error',!!isError);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('show')},2600)}
  function idFrag(id){return String(id||'').replace(/-/g,'')}
  function pairConvId(a,b){var ids=[String(a),String(b)].sort();return 'conv_'+idFrag(ids[0])+'_'+idFrag(ids[1])}
  function otherMember(conv){if(!conv||!Array.isArray(conv.members))return null;return conv.members.find(function(m){return String(m)!==String(me.id)})||null}
  function money(v){var n=Number(v);return Number.isFinite(n)?('$'+n.toLocaleString('en-US',{maximumFractionDigits:0})):''}
  function timeShort(ms){var d=new Date(ms);var now=new Date();var sameDay=d.toDateString()===now.toDateString();if(sameDay)return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});var yest=new Date(now);yest.setDate(now.getDate()-1);if(d.toDateString()===yest.toDateString())return 'Yesterday';return d.toLocaleDateString([], {month:'short',day:'numeric'})}
  function dateLabel(ms){var d=new Date(ms);var now=new Date();if(d.toDateString()===now.toDateString())return 'Today';var yest=new Date(now);yest.setDate(now.getDate()-1);if(d.toDateString()===yest.toDateString())return 'Yesterday';return d.toLocaleDateString([], {month:'long',day:'numeric',year:d.getFullYear()!==now.getFullYear()?'numeric':undefined})}

  // ── Offer encoding — matches www/js/messages.js exactly: an offer is JSON
  // stored directly in the messages.text column, never a separate table.
  // Shape: {"_offer":{k:'offer'|'accept'|'decline'|'counter',price,by,cur,listingId?,listingTitle?}}
  function parseOffer(text){if(typeof text!=='string'||text.charAt(0)!=='{'||text.indexOf('"_offer"')===-1)return null;try{var o=JSON.parse(text);return(o&&o._offer)?o._offer:null}catch(e){return null}}
  function previewText(m){if(m.deleted)return'Message deleted';if(m.image)return'📷 Photo';var of=parseOffer(m.text);if(of)return(of.k==='accept'?'Offer accepted':of.k==='decline'?'Offer declined':of.k==='counter'?'Counter-offer '+money(of.price):'Offer '+money(of.price));return m.text||''}

  function request(path,opts){opts=opts||{};opts.headers=Object.assign(headers(),opts.headers||{});return fetch(SB_URL+path,opts).then(function(res){if(res.status===204)return null;return res.text().then(function(text){var data=null;try{data=text?JSON.parse(text):null}catch(_){data=text}if(!res.ok){var msg=data&&(data.message||data.msg||data.error_description||data.error);throw Object.assign(new Error(msg||('Request failed: '+res.status)),{status:res.status,code:data&&data.code})}return data})})}

  // ── Load conversations + profiles + listing context ────────────────────
  function loadConversations(){
    return request('/rest/v1/conversations?members=cs.{'+encodeURIComponent(me.id)+'}&select=id,members,listing_id,updated_at&order=updated_at.desc.nullslast').then(function(rows){
      conversations=(rows||[]).filter(function(c){return Array.isArray(c.members)&&c.members.length>=2});
      var otherIds=conversations.map(otherMember).filter(Boolean);
      var listingIds=conversations.map(function(c){return c.listing_id}).filter(Boolean);
      return Promise.all([
        loadProfiles(otherIds),
        loadListings(listingIds),
        loadLastMessages()
      ]);
    });
  }
  function loadProfiles(ids){
    var unique=Array.from(new Set(ids.filter(function(id){return !profiles[id]})));
    if(!unique.length)return Promise.resolve();
    return request('/rest/v1/profiles?id=in.('+unique.map(encodeURIComponent).join(',')+')&select=id,name,avatar,verified').then(function(rows){
      (rows||[]).forEach(function(p){profiles[p.id]=p});
    }).catch(function(){});
  }
  function loadListings(ids){
    var unique=Array.from(new Set(ids.filter(function(id){return !listings[id]})));
    if(!unique.length)return Promise.resolve();
    return request('/rest/v1/listings?id=in.('+unique.map(encodeURIComponent).join(',')+')&select=id,title,price,currency,photos,status').then(function(rows){
      (rows||[]).forEach(function(l){listings[l.id]=l});
    }).catch(function(){});
  }
  function loadLastMessages(){
    if(!conversations.length)return Promise.resolve();
    var ids=conversations.map(function(c){return c.id});
    // Pull the most recent 400 messages across all threads in one call, then
    // reduce to the last message + unread count per conversation client-side —
    // avoids one query per conversation.
    return request('/rest/v1/messages?conversation_id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,conversation_id,sender_id,text,image,read,created_at&order=created_at.desc&limit=400').then(function(rows){
      var byConv={};
      (rows||[]).forEach(function(m){(byConv[m.conversation_id]=byConv[m.conversation_id]||[]).push(m)});
      conversations.forEach(function(c){
        var msgs=byConv[c.id]||[];
        c._lastMessage=msgs[0]||null;
        c._unreadCount=msgs.filter(function(m){return !m.read&&String(m.sender_id)!==String(me.id)}).length;
      });
    }).catch(function(){});
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function convKind(conv){
    // Business/rental conversations are id-prefixed exactly like the app
    // (biz_/job_); everything else is a personal 1:1 thread.
    var id=String(conv.id);
    return (id.indexOf('biz_')===0||id.indexOf('job_')===0)?'business':'personal';
  }
  function renderInbox(){
    var list=document.getElementById('conversationList');
    if(!list)return;
    var q=(document.getElementById('conversationSearch')||{}).value||'';
    q=q.trim().toLowerCase();
    var filtered=conversations.filter(function(c){
      if(convKind(c)!==activeTab)return false;
      if(unreadOnly&&!c._unreadCount)return false;
      if(q){var p=profiles[otherMember(c)];var name=(p&&p.name||'').toLowerCase();if(name.indexOf(q)===-1)return false}
      return true;
    }).sort(function(a,b){
      var at=(a._lastMessage&&new Date(a._lastMessage.created_at).getTime())||0;
      var bt=(b._lastMessage&&new Date(b._lastMessage.created_at).getTime())||0;
      return bt-at;
    });
    if(!filtered.length){
      list.innerHTML='<div class="empty-list"><b>No conversations here</b>'+(q?'Try a different name.':'Messages you send or receive will appear here.')+'</div>';
      return;
    }
    list.innerHTML=filtered.map(function(c){
      var otherId=otherMember(c);var p=profiles[otherId]||{};
      var name=esc(p.name||'PaMarket user');
      var avatarHtml=p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initials(p.name));
      var online=onlineUsers[String(otherId)];
      var lm=c._lastMessage;
      var preview=lm?esc(previewText(lm)).slice(0,64):'No messages yet';
      var unreadCls=(lm&&c._unreadCount)?' unread':'';
      var time=lm?timeShort(new Date(lm.created_at).getTime()):'';
      return '<button type="button" class="conv'+(c.id===activeConvId?' active':'')+'" data-id="'+esc(c.id)+'">'
        +'<span class="avatar-wrap"><span class="avatar">'+avatarHtml+'</span>'+(online?'<i class="online-dot"></i>':'')+'</span>'
        +'<span class="conv-main"><span class="conv-name">'+name+(p.verified?' <i class="verified">✓</i>':'')+'</span><span class="conv-preview'+unreadCls+'">'+preview+'</span></span>'
        +'<span class="conv-side"><time>'+esc(time)+'</time>'+(c._unreadCount?'<i class="unread-dot">'+c._unreadCount+'</i>':'')+'</span>'
        +'</button>';
    }).join('');
  }
  function tabCounts(){
    var personal=0,business=0;
    conversations.forEach(function(c){if(!c._unreadCount)return;if(convKind(c)==='business')business++;else personal++});
    var tabs=document.getElementById('chatTabs');
    if(!tabs)return;
    tabs.querySelectorAll('button').forEach(function(b){
      var n=b.dataset.tab==='business'?business:personal;
      b.textContent=(b.dataset.tab==='business'?'Business':'Personal')+(n?' ('+n+')':'');
    });
  }

  function mount(){
    shell.innerHTML='';
    shell.appendChild(document.getElementById('chatTemplate').content.cloneNode(true));
    document.getElementById('chatTabs').addEventListener('click',function(e){
      var btn=e.target.closest('button');if(!btn)return;
      this.querySelectorAll('button').forEach(function(b){b.classList.remove('active')});
      btn.classList.add('active');activeTab=btn.dataset.tab;renderInbox();
    });
    document.getElementById('unreadFilter').addEventListener('click',function(){unreadOnly=!unreadOnly;this.textContent=unreadOnly?'Show all':'Unread only';renderInbox()});
    document.getElementById('conversationSearch').addEventListener('input',renderInbox);
    document.getElementById('conversationList').addEventListener('click',function(e){
      var row=e.target.closest('.conv');if(!row)return;
      openConversation(row.dataset.id);
    });
    renderInbox();
    tabCounts();
  }

  // ── Thread ───────────────────────────────────────────────────────────────
  function openConversation(convId){
    var conv=conversations.find(function(c){return c.id===convId});
    if(!conv)return;
    if(activeConvId&&activeConvId!==convId)leaveTypingChannel();
    activeConvId=convId;
    document.querySelectorAll('.conv').forEach(function(r){r.classList.toggle('active',r.dataset.id===convId)});
    var pane=document.getElementById('threadPane');
    pane.innerHTML='';
    pane.appendChild(document.getElementById('threadTemplate').content.cloneNode(true));
    var otherId=otherMember(conv);var p=profiles[otherId]||{};
    document.getElementById('threadAvatar').innerHTML=p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initials(p.name));
    document.getElementById('threadName').textContent=p.name||'PaMarket user';
    document.getElementById('threadVerified').style.display=p.verified?'':'none';
    document.getElementById('threadOnline').style.display=onlineUsers[String(otherId)]?'':'none';
    document.getElementById('threadStatus').textContent=onlineUsers[String(otherId)]?'Online now':'';
    document.getElementById('threadProfileLink').href='profile?id='+encodeURIComponent(otherId||'');
    var listing=conv.listing_id&&listings[conv.listing_id];
    var dealCard=document.getElementById('dealCard');
    if(listing){
      dealCard.style.display='';
      document.getElementById('dealImg').src=(listing.photos&&listing.photos[0])||'img/icon-512.png';
      document.getElementById('dealTitle').textContent=listing.title||'Listing';
      document.getElementById('dealPrice').textContent=money(listing.price);
      document.getElementById('dealLink').href='detail?id='+encodeURIComponent(listing.id);
    } else { dealCard.style.display='none'; }
    document.getElementById('mobileBack').addEventListener('click',function(){shell.classList.remove('thread-open')});
    document.getElementById('sendButton').addEventListener('click',sendMessage);
    document.getElementById('messageInput').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
    document.getElementById('messageInput').addEventListener('input',notifyTyping);
    document.getElementById('attachButton').addEventListener('click',function(){document.getElementById('photoFile').click()});
    document.getElementById('photoFile').addEventListener('change',sendPhoto);
    document.getElementById('offerButton').addEventListener('click',openOfferPrompt);
    document.getElementById('messageThread').addEventListener('dblclick',function(e){
      var row=e.target.closest('.msg-row[data-msg-id]');
      if(!row||!e.target.closest('.bubble'))return;
      openReactionPicker(row.dataset.msgId,e.clientX,e.clientY);
    });
    shell.classList.add('thread-open');
    loadThreadMessages(convId).then(function(){
      markConversationRead(convId,otherId);
    });
    joinTypingChannel(convId);
  }
  var REACTION_EMOJIS=['👍','❤️','😂','😮','😢','🙏'];
  function openReactionPicker(msgId,x,y){
    var existing=document.getElementById('reactionPicker');
    if(existing)existing.remove();
    var picker=document.createElement('div');
    picker.id='reactionPicker';
    picker.style.cssText='position:fixed;z-index:60;display:flex;gap:4px;padding:6px 8px;border-radius:12px;background:#17213a;box-shadow:0 10px 28px rgba(11,28,77,.28);left:'+Math.max(8,x-90)+'px;top:'+Math.max(8,y-46)+'px';
    picker.innerHTML=REACTION_EMOJIS.map(function(em){return '<button type="button" style="border:0;background:transparent;font-size:17px;padding:3px;cursor:pointer" data-emoji="'+em+'">'+em+'</button>'}).join('');
    document.body.appendChild(picker);
    picker.addEventListener('click',function(e){
      var btn=e.target.closest('[data-emoji]');
      if(btn)window.PMChat.toggleReaction(msgId,btn.dataset.emoji);
      picker.remove();
    });
    setTimeout(function(){document.addEventListener('click',function closePicker(e){if(!picker.contains(e.target)){picker.remove();document.removeEventListener('click',closePicker)}})},0);
  }
  function loadThreadMessages(convId){
    return request('/rest/v1/messages?conversation_id=eq.'+encodeURIComponent(convId)+'&select=id,sender_id,sender_name,text,image,read,edited,deleted,reactions,created_at&order=created_at.asc&limit=200').then(function(rows){
      renderMessages(rows||[]);
    }).catch(function(err){console.warn('loadThreadMessages:',err);toast('Could not load messages',true)});
  }
  function renderMessages(rows){
    var thread=document.getElementById('messageThread');
    if(!thread)return;
    var html='';var lastDate='';
    rows.forEach(function(m){
      var d=dateLabel(new Date(m.created_at).getTime());
      if(d!==lastDate){html+='<div class="date-sep">'+esc(d)+'</div>';lastDate=d}
      html+=messageHtml(m);
    });
    thread.innerHTML=html;
    thread.scrollTop=thread.scrollHeight;
  }
  function messageHtml(m){
    var mine=String(m.sender_id)===String(me.id);
    var rowCls='msg-row'+(mine?' me':'');
    var timeStr=new Date(m.created_at).getTime()?timeShort(new Date(m.created_at).getTime()):'';
    var tick=mine?(m.read?' ✓✓':' ✓'):'';
    var avatarHtml=mine?'':miniAvatarHtml(m.sender_id);
    if(m.deleted){
      return '<div class="'+rowCls+'" data-msg-id="'+esc(m.id)+'">'+avatarHtml+'<div class="bubble" style="font-style:italic;opacity:.6">Message deleted</div></div>';
    }
    var of=parseOffer(m.text);
    if(of){
      return '<div class="'+rowCls+'" data-msg-id="'+esc(m.id)+'">'+offerHtml(of,mine,m.id)+'</div>';
    }
    if(m.image){
      return '<div class="'+rowCls+'" data-msg-id="'+esc(m.id)+'">'+avatarHtml+'<div class="bubble-col"><div class="bubble photo-bubble"><img src="'+esc(m.image)+'" alt="Shared photo" onclick="window.open(this.src,\'_blank\')">'+(m.text?'<p style="margin:7px 6px 2px">'+esc(m.text)+'</p>':'')+'<div class="meta">'+esc(timeStr)+tick+'</div></div>'+reactionsHtml(m)+'</div></div>';
    }
    return '<div class="'+rowCls+'" data-msg-id="'+esc(m.id)+'">'+avatarHtml+'<div class="bubble-col"><div class="bubble">'+esc(m.text||'')+(m.edited?' <span style="opacity:.6;font-size:9px">(edited)</span>':'')+'<div class="meta">'+esc(timeStr)+tick+'</div></div>'+reactionsHtml(m)+'</div></div>';
  }
  function miniAvatarHtml(senderId){
    var p=profiles[senderId]||{};
    return '<span class="mini-avatar">'+(p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initials(p.name)))+'</span>';
  }
  function reactionsHtml(m){
    var r=(m.reactions&&typeof m.reactions==='object')?m.reactions:{};
    var keys=Object.keys(r).filter(function(k){return Array.isArray(r[k])&&r[k].length});
    if(!keys.length)return'';
    return '<div class="reaction-row">'+keys.map(function(e){
      var users=r[e];var mine=users.indexOf(me.id)!==-1;
      return '<span class="react-chip'+(mine?' mine':'')+'" onclick="window.PMChat.toggleReaction(\''+esc(m.id)+'\',\''+e+'\')">'+e+(users.length>1?' '+users.length:'')+'</span>';
    }).join('')+'</div>';
  }
  function offerHtml(of,mine,msgId){
    var label=of.k==='accept'?'Offer accepted':of.k==='decline'?'Offer declined':of.k==='counter'?'Counter-offer':'Offer received';
    if(of.k==='accept'||of.k==='decline'){
      return '<div class="offer"><div class="offer-status">'+esc(label)+' at '+money(of.price)+'</div></div>';
    }
    var actions=mine?'':'<div class="offer-actions"><button type="button" onclick="window.PMChat.respondOffer(\''+esc(msgId)+'\',\'counter\')">Counter</button><button type="button" onclick="window.PMChat.respondOffer(\''+esc(msgId)+'\',\'decline\')">Decline</button><button class="accept" type="button" onclick="window.PMChat.respondOffer(\''+esc(msgId)+'\',\'accept\')">Accept</button></div>';
    return '<div class="offer"><div class="offer-top"><small>'+(mine?'Your offer':'Offer')+'</small><strong>'+money(of.price)+'</strong></div><div class="offer-body">'+(of.listingTitle?esc(of.listingTitle):'Direct offer')+actions+'</div></div>';
  }

  // ── Sending ──────────────────────────────────────────────────────────────
  function insertMessageRow(m){
    var thread=document.getElementById('messageThread');
    if(!thread)return;
    // Guards against the same message being inserted twice — once optimistically
    // from our own send call, once from the messages-rt Realtime echo of our own
    // INSERT — regardless of which one wins the race.
    if(thread.querySelector('[data-msg-id="'+(window.CSS&&CSS.escape?CSS.escape(m.id):m.id)+'"]'))return;
    var d=dateLabel(new Date(m.created_at).getTime());
    var last=thread.querySelector('.date-sep:last-of-type');
    if(!last||last.textContent!==d){var sep=document.createElement('div');sep.className='date-sep';sep.textContent=d;thread.appendChild(sep)}
    thread.insertAdjacentHTML('beforeend',messageHtml(m));
    thread.scrollTop=thread.scrollHeight;
  }
  function sendMessage(){
    var input=document.getElementById('messageInput');
    var text=input.value.trim();
    if(!text||!activeConvId)return;
    var conv=conversations.find(function(c){return c.id===activeConvId});if(!conv)return;
    var msgId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('m'+Date.now()+Math.random().toString(36).slice(2));
    var createdAt=new Date().toISOString();
    var row={id:msgId,conversation_id:activeConvId,sender_id:me.id,sender_name:me.name||'',text:text,read:false,created_at:createdAt};
    input.value='';
    stopTyping();
    insertMessageRow(row);
    request('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)}).then(function(){
      return ensureConversationTimestamp(activeConvId);
    }).then(function(){
      var c=conversations.find(function(x){return x.id===activeConvId});
      if(c)c._lastMessage=row;
      renderInbox();
    }).catch(function(err){
      console.warn('sendMessage:',err);
      toast('Could not send — check your connection',true);
      markMessageFailed(msgId,text);
    });
  }
  function markMessageFailed(msgId,text){
    var rowEl=document.querySelector('[data-msg-id="'+(window.CSS&&CSS.escape?CSS.escape(msgId):msgId)+'"]');
    if(!rowEl)return;
    rowEl.remove();
    var input=document.getElementById('messageInput');
    if(input)input.value=text;
  }
  function ensureConversationTimestamp(convId){
    return request('/rest/v1/conversations?id=eq.'+encodeURIComponent(convId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({updated_at:new Date().toISOString()})}).catch(function(){});
  }
  function sendPhoto(e){
    var file=e.target.files&&e.target.files[0];if(!file)return;
    e.target.value='';
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){toast('Choose a JPG, PNG or WebP image',true);return}
    if(!activeConvId)return;
    toast('Uploading photo…');
    compress(file).then(function(blob){
      return window.PM.uploadListingPhoto?window.PM.uploadListingPhoto(blob,'image/jpeg'):Promise.reject(new Error('Upload unavailable'));
    }).then(function(url){
      if(!url||!/^https:\/\//i.test(url))throw new Error('Invalid photo URL');
      var msgId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('m'+Date.now()+Math.random().toString(36).slice(2));
      var row={id:msgId,conversation_id:activeConvId,sender_id:me.id,sender_name:me.name||'',text:'',image:url,read:false,created_at:new Date().toISOString()};
      insertMessageRow(row);
      return request('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)}).then(function(){
        var c=conversations.find(function(x){return x.id===activeConvId});if(c)c._lastMessage=row;
        renderInbox();
        return ensureConversationTimestamp(activeConvId);
      }).catch(function(err){
        var rowEl=document.querySelector('[data-msg-id="'+(window.CSS&&CSS.escape?CSS.escape(msgId):msgId)+'"]');
        if(rowEl)rowEl.remove();
        throw err;
      });
    }).catch(function(err){console.warn('sendPhoto:',err);toast('Could not send that photo — check your connection',true)});
  }
  function compress(file){return new Promise(function(resolve,reject){var img=new Image(),url=URL.createObjectURL(file);img.onload=function(){try{var scale=Math.min(1,1400/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(function(blob){URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error('Could not compress photo'))},'image/jpeg',.82)}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('Could not read photo'))};img.src=url})}

  // ── Offers (encoded in text, matching www/js/messages.js exactly) ────────
  function openOfferPrompt(){
    if(!activeConvId)return;
    var conv=conversations.find(function(c){return c.id===activeConvId});if(!conv)return;
    var listing=conv.listing_id&&listings[conv.listing_id];
    var amount=window.prompt('Enter your offer amount (USD)'+(listing?' for '+listing.title:''),listing?listing.price:'');
    if(amount==null)return;
    var v=parseFloat(amount);
    if(!v||v<=0){toast('Enter a valid amount',true);return}
    sendOfferMessage({k:'offer',price:v,by:me.id,cur:'USD',listingId:listing?listing.id:undefined,listingTitle:listing?String(listing.title).slice(0,50):undefined});
  }
  window.PMChat=window.PMChat||{};
  window.PMChat.respondOffer=function(msgId,action){
    if(!activeConvId)return;
    fetchMessageText(msgId).then(function(text){
      var of=parseOffer(text);
      if(!of)return;
      if(action==='accept')sendOfferMessage({k:'accept',price:of.price,by:me.id,cur:of.cur||'USD'});
      else if(action==='decline')sendOfferMessage({k:'decline',price:of.price,by:me.id,cur:of.cur||'USD'});
      else if(action==='counter'){
        var amount=window.prompt('Enter your counter-offer amount (USD)',of.price);
        if(amount==null)return;
        var v=parseFloat(amount);
        if(!v||v<=0){toast('Enter a valid amount',true);return}
        sendOfferMessage({k:'counter',price:v,by:me.id,cur:of.cur||'USD'});
      }
    });
  };
  function fetchMessageText(msgId){
    return request('/rest/v1/messages?id=eq.'+encodeURIComponent(msgId)+'&select=text').then(function(rows){return rows&&rows[0]&&rows[0].text});
  }
  function sendOfferMessage(of){
    if(!activeConvId)return;
    var text=JSON.stringify({_offer:of});
    var msgId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('m'+Date.now()+Math.random().toString(36).slice(2));
    var row={id:msgId,conversation_id:activeConvId,sender_id:me.id,sender_name:me.name||'',text:text,read:false,created_at:new Date().toISOString()};
    insertMessageRow(row);
    request('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)}).then(function(){
      return ensureConversationTimestamp(activeConvId);
    }).then(function(){
      var c=conversations.find(function(x){return x.id===activeConvId});if(c)c._lastMessage=row;
      renderInbox();
    }).catch(function(err){
      console.warn('sendOfferMessage:',err);
      toast('Could not send the offer — check your connection',true);
      var rowEl=document.querySelector('[data-msg-id="'+(window.CSS&&CSS.escape?CSS.escape(msgId):msgId)+'"]');
      if(rowEl)rowEl.remove();
    });
  }

  // ── Reactions (jsonb column: {emoji: [userId, ...]}) ──────────────────────
  window.PMChat.toggleReaction=function(msgId,emoji){
    request('/rest/v1/messages?id=eq.'+encodeURIComponent(msgId)+'&select=reactions').then(function(rows){
      var current=(rows&&rows[0]&&rows[0].reactions)||{};
      var users=Array.isArray(current[emoji])?current[emoji].slice():[];
      var idx=users.indexOf(me.id);
      if(idx===-1)users.push(me.id);else users.splice(idx,1);
      var next=Object.assign({},current);
      if(users.length)next[emoji]=users;else delete next[emoji];
      return request('/rest/v1/messages?id=eq.'+encodeURIComponent(msgId),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({reactions:next})});
    }).then(function(){
      return loadThreadMessages(activeConvId);
    }).catch(function(err){console.warn('toggleReaction:',err)});
  };

  // ── Read receipts ─────────────────────────────────────────────────────────
  function markConversationRead(convId,otherId){
    if(!otherId)return;
    request('/rest/v1/messages?conversation_id=eq.'+encodeURIComponent(convId)+'&sender_id=eq.'+encodeURIComponent(otherId)+'&read=eq.false',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({read:true})}).then(function(){
      var c=conversations.find(function(x){return x.id===convId});
      if(c){c._unreadCount=0;renderInbox();tabCounts()}
    }).catch(function(){});
  }

  // ── Realtime: messages-rt (global INSERT/UPDATE), matching www/js/app.js ──
  function initMessageChannel(){
    var sb=window.supabase;
    if(!sb||typeof sb.channel!=='function'){setRtPill(false);return}
    if(msgChannel){try{sb.removeChannel(msgChannel)}catch(e){}msgChannel=null}
    msgChannel=sb.channel('messages-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},function(payload){
        var msg=payload.new;if(!msg)return;
        var conv=conversations.find(function(c){return c.id===msg.conversation_id});
        if(!conv){
          // A brand-new conversation we don't have yet — only matters if we're
          // a member; re-fetch the list to pick it up.
          if(Array.isArray(msg.conversation_id)&&msg.conversation_id.indexOf(me.id)===-1)return;
          loadConversations().then(function(){renderInbox();tabCounts()});
          return;
        }
        if(conv._lastMessage&&conv._lastMessage.id===msg.id)return;
        conv._lastMessage=msg;
        if(String(msg.sender_id)!==String(me.id)&&!msg.read)conv._unreadCount=(conv._unreadCount||0)+1;
        renderInbox();tabCounts();
        if(activeConvId===msg.conversation_id){
          insertMessageRow(msg);
          if(String(msg.sender_id)!==String(me.id))markConversationRead(msg.conversation_id,msg.sender_id);
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},function(payload){
        var msg=payload.new;if(!msg)return;
        if(activeConvId!==msg.conversation_id)return;
        var row=document.querySelector('[data-msg-id="'+(window.CSS&&CSS.escape?CSS.escape(msg.id):msg.id)+'"]');
        if(!row)return;
        var replacement=document.createElement('div');
        replacement.innerHTML=messageHtml(msg);
        row.replaceWith(replacement.firstChild);
      })
      .subscribe(function(status){setRtPill(status==='SUBSCRIBED')});
  }
  function setRtPill(on){
    var pill=document.getElementById('rtPill');
    if(!pill)return;
    pill.classList.toggle('offline',!on);
    pill.lastChild.textContent=on?'Live':'Connecting';
  }

  // ── Realtime: per-conversation typing broadcast, matching realtime-extras.js ──
  function joinTypingChannel(convId){
    var sb=window.supabase;
    if(!sb||typeof sb.channel!=='function')return;
    if(typingChannelConvId===convId&&typingChannel)return;
    leaveTypingChannel();
    typingChannelConvId=convId;
    try{
      typingChannel=sb.channel('chat-'+convId,{config:{broadcast:{self:false}}});
      typingChannel.on('broadcast',{event:'typing'},function(payload){
        var p=(payload&&payload.payload)||{};
        if(String(p.userId)===String(me.id))return;
        renderTyping(!!p.typing);
      });
      typingChannel.subscribe();
    }catch(e){typingChannel=null;typingChannelConvId=null}
  }
  function leaveTypingChannel(){
    clearTimeout(typingTimer);typingTimer=null;
    var sb=window.supabase;
    if(typingChannel&&sb){try{sb.removeChannel(typingChannel)}catch(e){}}
    typingChannel=null;typingChannelConvId=null;
    renderTyping(false);
  }
  function renderTyping(show){
    var thread=document.getElementById('messageThread');
    if(!thread)return;
    var existing=thread.querySelector('.typing-row');
    if(show&&!existing){
      var row=document.createElement('div');
      row.className='typing-row';row.innerHTML='<i></i><i></i><i></i>';
      thread.appendChild(row);thread.scrollTop=thread.scrollHeight;
    } else if(!show&&existing){existing.remove()}
  }
  function notifyTyping(){
    if(!typingChannel)return;
    var now=Date.now();
    if(now-lastTypingSent>1500){
      lastTypingSent=now;
      try{typingChannel.send({type:'broadcast',event:'typing',payload:{userId:me.id,typing:true}})}catch(e){}
    }
    clearTimeout(typingTimer);
    typingTimer=setTimeout(stopTyping,2500);
  }
  function stopTyping(){
    clearTimeout(typingTimer);typingTimer=null;
    if(!typingChannel)return;
    try{typingChannel.send({type:'broadcast',event:'typing',payload:{userId:me.id,typing:false}})}catch(e){}
  }

  // ── Realtime: presence, matching realtime-extras.js's online-users channel ──
  function initPresence(){
    var sb=window.supabase;
    if(!sb||typeof sb.channel!=='function'||presenceChannel)return;
    try{
      presenceChannel=sb.channel('online-users',{config:{presence:{key:String(me.id)}}});
      presenceChannel.on('presence',{event:'sync'},function(){
        var state=presenceChannel.presenceState()||{};
        var map={};Object.keys(state).forEach(function(k){map[String(k)]=true});
        onlineUsers=map;
        renderInbox();
        if(activeConvId){
          var conv=conversations.find(function(c){return c.id===activeConvId});
          var otherId=conv&&otherMember(conv);
          if(otherId){
            var dot=document.getElementById('threadOnline');
            var statusEl=document.getElementById('threadStatus');
            if(dot)dot.style.display=onlineUsers[String(otherId)]?'':'none';
            if(statusEl&&!statusEl.textContent.match(/typing/i))statusEl.textContent=onlineUsers[String(otherId)]?'Online now':'';
          }
        }
      });
      presenceChannel.subscribe(function(status){
        if(status==='SUBSCRIBED')presenceChannel.track({online_at:new Date().toISOString()});
      });
    }catch(e){presenceChannel=null}
  }
  function teardownAllChannels(){
    var sb=window.supabase;
    if(!sb)return;
    if(msgChannel){try{sb.removeChannel(msgChannel)}catch(e){}msgChannel=null}
    if(typingChannel){try{sb.removeChannel(typingChannel)}catch(e){}typingChannel=null}
    if(presenceChannel){try{sb.removeChannel(presenceChannel)}catch(e){}presenceChannel=null}
  }
  window.addEventListener('beforeunload',teardownAllChannels);

  // ── Boot ───────────────────────────────────────────────────────────────
  function showGate(){shell.innerHTML='<section class="gate"><h2>Sign in to view your chats</h2><p>Your PaMarket account keeps every conversation private between you and the other member.</p><a href="auth?return=chats">Sign In</a></section>'}
  function showErrorGate(){shell.innerHTML='<section class="gate"><h2>Could not load your chats</h2><p>Please refresh the page. If the problem continues, contact PaMarket support.</p><a href="chats">Refresh</a></section>'}
  function init(){
    var refresh=window.PMSession&&window.PMSession.maybeRefresh?window.PMSession.maybeRefresh():Promise.resolve();
    Promise.resolve(refresh).catch(function(){}).then(function(){
      session=window.PMSession&&window.PMSession.getSession?window.PMSession.getSession():null;
      if(!session||!session.user||!session.access_token){showGate();return}
      me={id:session.user.id,name:(session.user.user_metadata&&(session.user.user_metadata.full_name||session.user.user_metadata.name))||session.user.email||'You'};
      return loadConversations().then(function(){
        mount();
        initMessageChannel();
        initPresence();
      });
    }).catch(function(err){console.warn('Chats load failed:',err);showErrorGate()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
