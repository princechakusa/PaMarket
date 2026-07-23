(function(){
  'use strict';
  var SB_URL=window.SUPABASE_URL,SB_KEY=window.SUPABASE_ANON_KEY;
  var session=null,me=null;
  var conversations=[],profiles={},listings={},businessesByOwner={};
  var activeTab='personal',unreadOnly=false,activeConvId=null;
  var msgChannel=null,typingChannel=null,typingChannelConvId=null,presenceChannel=null;
  var onlineUsers={};
  var toastTimer=null,typingTimer=null,lastTypingSent=0;
  var isSending=false;
  var shell=document.getElementById('chatShell');
  document.body.classList.add('chat-view');

  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]})}
  function initials(name){return String(name||'User').trim().split(/\s+/).slice(0,2).map(function(v){return v.charAt(0)}).join('').toUpperCase()||'U'}
  function currentSession(){
    var latest=window.PMSession&&window.PMSession.getSession?window.PMSession.getSession():null;
    if(latest&&latest.access_token)session=latest;
    return session;
  }
  function headers(extra){var active=currentSession();return Object.assign({apikey:SB_KEY,Authorization:'Bearer '+(active&&active.access_token||''),'Content-Type':'application/json'},extra||{})}
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
  function parseReply(text){if(typeof text!=='string'||text.charAt(0)!=='{'||text.indexOf('"_reply"')===-1)return null;try{var o=JSON.parse(text);if(!o||!o._reply)return null;return{name:o._reply.n||'Reply',quote:o._reply.t||'',text:o.t||''}}catch(e){return null}}
  function previewText(m){if(m.deleted)return'Message deleted';if(m.image)return'📷 Photo';var of=parseOffer(m.text);if(of)return(of.k==='accept'?'Offer accepted':of.k==='decline'?'Offer declined':of.k==='counter'?'Counter-offer '+money(of.price):'Offer '+money(of.price));var reply=parseReply(m.text);return reply?reply.text:(m.text||'')}

  function fitChatPage(){
    var page=document.querySelector('.chat-page');
    if(!page)return;
    var viewport=window.visualViewport?window.visualViewport.height:window.innerHeight;
    var top=Math.max(0,page.getBoundingClientRect().top);
    page.style.setProperty('--chat-page-height',Math.max(280,Math.floor(viewport-top))+'px');
  }
  var fitFrame=0;
  function scheduleChatFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitChatPage)}
  window.addEventListener('resize',scheduleChatFit);
  window.addEventListener('orientationchange',scheduleChatFit);
  window.addEventListener('load',scheduleChatFit);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',scheduleChatFit);
  if(window.ResizeObserver){
    var chromeObserver=new ResizeObserver(scheduleChatFit);
    var siteHeader=document.getElementById('hdr');
    var announcement=document.getElementById('siteAnnouncementBanner');
    if(siteHeader)chromeObserver.observe(siteHeader);
    if(announcement)chromeObserver.observe(announcement);
  }
  fitChatPage();

  function request(path,opts,retried){
    opts=opts||{};
    var requestOpts=Object.assign({},opts,{headers:Object.assign(headers(),opts.headers||{})});
    return fetch(SB_URL+path,requestOpts).then(function(res){
      if(res.status===401&&!retried&&window.PMSession&&window.PMSession.refreshSession){
        return window.PMSession.refreshSession().then(function(renewed){
          if(!renewed||!renewed.access_token)throw Object.assign(new Error('Your session has expired. Please sign in again.'),{status:401});
          session=renewed;
          return request(path,opts,true);
        });
      }
      if(res.status===204)return null;
      return res.text().then(function(text){
        var data=null;
        try{data=text?JSON.parse(text):null}catch(_){data=text}
        if(!res.ok){
          var msg=data&&(data.message||data.msg||data.error_description||data.error||data.details);
          throw Object.assign(new Error(msg||('Request failed: '+res.status)),{status:res.status,code:data&&data.code});
        }
        return data;
      });
    }).catch(function(err){
      if(err&&err.name==='TypeError'&&!err.status)throw Object.assign(new Error('Network unavailable. Check your connection and try again.'),{cause:err});
      throw err;
    });
  }

  // ── Load conversations + profiles + listing context ────────────────────
  function loadConversations(){
    return request('/rest/v1/conversations?members=cs.{'+encodeURIComponent(me.id)+'}&select=id,members,listing_id,updated_at&order=updated_at.desc.nullslast&limit=300').then(function(rows){
      conversations=(rows||[]).filter(function(c){return Array.isArray(c.members)&&c.members.length>=2});
      var otherIds=conversations.map(otherMember).filter(Boolean);
      var listingIds=conversations.map(function(c){return c.listing_id}).filter(Boolean);
      return Promise.all([
        loadProfiles(otherIds),
        loadListings(listingIds),
        loadLastMessages(),
        loadBusinessesForConversations()
      ]);
    });
  }
  // No business_id column exists on conversations (nor does the app's own
  // scheme use one) — a biz_ conversation encodes the business identity in
  // its id (biz_<last8ofBusinessId>_<last6ofBuyerId>), matching
  // www/js/business-messaging.js's H.startBizChat exactly. businesses.id is a
  // native uuid column, so a suffix LIKE match isn't usable through PostgREST
  // without a cast it doesn't expose (confirmed live: "operator does not
  // exist: uuid ~~ unknown"). Instead, fetch every business owned by either
  // member (a plain, cast-free equality filter) and recompute each
  // candidate's id to find the one that produced this exact conversation id.
  function loadBusinessesForConversations(){
    var memberIds=new Set();
    conversations.forEach(function(c){
      if(convKind(c)!=='business'||String(c.id).indexOf('biz_')!==0)return;
      (Array.isArray(c.members)?c.members:[]).forEach(function(m){memberIds.add(String(m))});
    });
    var unresolved=Array.from(memberIds).filter(function(id){return !businessesByOwner[id]});
    if(!unresolved.length)return Promise.resolve();
    return request('/rest/v1/businesses?owner_user_id=in.('+unresolved.map(encodeURIComponent).join(',')+')&select=id,owner_user_id,name,logo').then(function(rows){
      unresolved.forEach(function(id){businessesByOwner[id]=businessesByOwner[id]||[]});
      (rows||[]).forEach(function(b){
        var ownerId=String(b.owner_user_id);
        businessesByOwner[ownerId]=businessesByOwner[ownerId]||[];
        businessesByOwner[ownerId].push(b);
      });
    }).catch(function(){});
  }
  function matchBusinessFor(ownerCandidate,buyerCandidate,convId){
    var list=businessesByOwner[ownerCandidate]||[];
    for(var i=0;i<list.length;i++){
      if('biz_'+String(list[i].id).slice(-8)+'_'+String(buyerCandidate).slice(-6)===convId)return list[i];
    }
    return null;
  }
  // For a business conversation, the buyer should see the shop's identity,
  // not the owner's personal profile (matches the app's stated intent in
  // H.startBizChat). The owner still sees the buyer's personal identity.
  function businessDisplay(conv){
    if(convKind(conv)!=='business'||String(conv.id).indexOf('biz_')!==0)return null;
    var mem=Array.isArray(conv.members)?conv.members.map(String):[];
    if(mem.length!==2)return null;
    var b=matchBusinessFor(mem[0],mem[1],conv.id)||matchBusinessFor(mem[1],mem[0],conv.id);
    if(!b)return null;
    if(String(b.owner_user_id)===String(me.id))return null; // viewer is the owner — show the buyer normally
    return b;
  }
  function loadProfiles(ids){
    var unique=Array.from(new Set(ids.filter(function(id){return !profiles[id]})));
    if(!unique.length)return Promise.resolve();
    // profiles_public, not the base table — cross-user reads of public.profiles
    // are owner-or-staff-only since harden_profiles_owner_or_staff_read.sql.
    return request('/rest/v1/profiles_public?id=in.('+unique.map(encodeURIComponent).join(',')+')&select=id,name,avatar,verified,privacy').then(function(rows){
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
      if(q){var biz=businessDisplay(c);var p=biz||profiles[otherMember(c)];var name=(p&&(p.name)||'').toLowerCase();if(name.indexOf(q)===-1)return false}
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
      var otherId=otherMember(c);
      var biz=businessDisplay(c);
      var p=biz||profiles[otherId]||{};
      var name=esc(p.name||'PaMarket user');
      var avatarHtml=p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initials(p.name));
      var online=!biz&&onlineUsers[String(otherId)];
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
    fitChatPage();
    if(window.matchMedia('(min-width:681px)').matches&&conversations.length){
      var first=conversations.find(function(c){return convKind(c)===activeTab})||conversations[0];
      if(first){
        activeTab=convKind(first);
        document.querySelectorAll('#chatTabs button').forEach(function(button){button.classList.toggle('active',button.dataset.tab===activeTab)});
        renderInbox();
        openConversation(first.id);
      }
    }
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
    var otherId=otherMember(conv);
    var biz=businessDisplay(conv);
    var p=biz||profiles[otherId]||{};
    document.getElementById('threadAvatar').innerHTML=p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(initials(p.name));
    document.getElementById('threadName').textContent=p.name||'PaMarket user';
    document.getElementById('threadVerified').style.display=(!biz&&p.verified)?'':'none';
    document.getElementById('threadOnline').style.display=(!biz&&onlineUsers[String(otherId)])?'':'none';
    document.getElementById('threadStatus').textContent=(!biz&&onlineUsers[String(otherId)])?'Online now':'';
    document.getElementById('threadProfileLink').href=biz?('business?id='+encodeURIComponent(biz.id)):('profile?id='+encodeURIComponent(otherId||''));
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
    document.getElementById('messageComposer').addEventListener('submit',function(e){e.preventDefault();sendMessage()});
    document.getElementById('messageInput').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
    document.getElementById('messageInput').addEventListener('input',function(){resizeComposerInput(this);updateSendButton();notifyTyping()});
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
    updateSendButton();
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
    var reply=parseReply(m.text);
    var body=reply?'<div class="reply-quote"><b>'+esc(reply.name)+'</b>'+esc(reply.quote)+'</div>'+esc(reply.text):esc(m.text||'');
    return '<div class="'+rowCls+'" data-msg-id="'+esc(m.id)+'">'+avatarHtml+'<div class="bubble-col"><div class="bubble">'+body+(m.edited?' <span style="opacity:.6;font-size:9px">(edited)</span>':'')+'<div class="meta">'+esc(timeStr)+tick+'</div></div>'+reactionsHtml(m)+'</div></div>';
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
  function resizeComposerInput(input){
    if(!input)return;
    input.style.height='auto';
    input.style.height=Math.min(90,Math.max(31,input.scrollHeight))+'px';
  }
  function updateSendButton(){
    var input=document.getElementById('messageInput');
    var button=document.getElementById('sendButton');
    if(!button)return;
    button.disabled=isSending||!input||!input.value.trim()||!activeConvId;
    button.classList.toggle('sending',isSending);
    button.setAttribute('aria-label',isSending?'Sending message':'Send message');
  }
  function messageErrorText(err){
    var raw=String(err&&err.message||'');
    if(err&&err.status===401)return'Your session expired. Sign in again to send messages.';
    if(/block exists between these users/i.test(raw))return'You cannot message this user.';
    if(/rate_limited/i.test(raw))return'You\'re sending messages too fast. Please wait a moment.';
    if(/row-level security|permission denied|not a member/i.test(raw))return'This conversation is no longer available to send to.';
    if(/network unavailable|failed to fetch|networkerror/i.test(raw))return'You are offline. Reconnect and try again.';
    return'Could not send this message. Please try again.';
  }
  function sendMessage(){
    var input=document.getElementById('messageInput');
    if(!input||isSending)return Promise.resolve();
    var text=input.value.trim();
    if(!text||!activeConvId){updateSendButton();return Promise.resolve()}
    var convId=activeConvId;
    var conv=conversations.find(function(c){return c.id===convId});
    if(!conv||!Array.isArray(conv.members)||!conv.members.some(function(id){return String(id)===String(me.id)})){
      toast('This conversation is no longer available to send to.',true);
      return Promise.resolve();
    }
    var msgId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('m'+Date.now()+Math.random().toString(36).slice(2));
    var createdAt=new Date().toISOString();
    var row={id:msgId,conversation_id:convId,sender_id:me.id,sender_name:me.name||'',text:text,read:false,created_at:createdAt};
    isSending=true;
    input.value='';
    resizeComposerInput(input);
    updateSendButton();
    stopTyping();
    insertMessageRow(row);
    return request('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)}).then(function(saved){
      if(!Array.isArray(saved)||!saved.length)throw new Error('The server did not confirm the message.');
      return ensureConversationTimestamp(convId);
    }).then(function(){
      var c=conversations.find(function(x){return x.id===convId});
      if(c)c._lastMessage=row;
      renderInbox();
    }).catch(function(err){
      console.warn('sendMessage:',err);
      toast(messageErrorText(err),true);
      markMessageFailed(msgId,text);
    }).then(function(){
      isSending=false;
      updateSendButton();
    });
  }
  function markMessageFailed(msgId,text){
    var rowEl=document.querySelector('[data-msg-id="'+(window.CSS&&CSS.escape?CSS.escape(msgId):msgId)+'"]');
    if(!rowEl)return;
    rowEl.remove();
    var input=document.getElementById('messageInput');
    if(input){input.value=text;resizeComposerInput(input);input.focus()}
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
      .subscribe(function(status){
        setRtPill(status==='SUBSCRIBED');
        if((status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')&&session){
          clearTimeout(reconnectTimer);
          reconnectTimer=setTimeout(function(){if(session)initMessageChannel()},4000);
        }
      });
  }
  var reconnectTimer=null;
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

  // ── Entry points: "Message Seller" (detail.html) / "Message" (profile.html)
  // link here as chats?to=<userId>&listing=<listingId>. Find-or-create the
  // 1:1 conversation for that pair (deterministic id, same scheme the mobile
  // app uses in H.startChatWith) so the listing/profile/chat/notification
  // surfaces all resolve to the SAME thread instead of a disconnected one.
  function stripEntryParams(){
    var url=new URL(location.href);
    url.searchParams.delete('to');url.searchParams.delete('listing');url.searchParams.delete('conv');url.searchParams.delete('biz');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  // "Message Business" (business.html) links here as chats?biz=<businessId>.
  // Conversation id must match www/js/business-messaging.js's H.startBizChat
  // EXACTLY (raw slice, not idFrag-stripped) so a buyer who already messaged
  // this business via the app lands on the same thread on the website.
  function resolveBizEntry(bizId){
    return request('/rest/v1/businesses?id=eq.'+encodeURIComponent(bizId)+'&select=id,owner_user_id,name,logo').then(function(rows){
      var biz=rows&&rows[0];
      if(!biz||!biz.owner_user_id){toast('This business is not available right now.',true);return null}
      var ownerId=String(biz.owner_user_id);
      if(ownerId===String(me.id)){toast('This is your own business.',true);return null}
      businessesByOwner[ownerId]=businessesByOwner[ownerId]||[];
      if(businessesByOwner[ownerId].indexOf(biz)===-1)businessesByOwner[ownerId].push(biz);
      var convId='biz_'+String(bizId).slice(-8)+'_'+String(me.id).slice(-6);
      var existing=conversations.find(function(c){return c.id===convId});
      if(existing)return existing.id;
      var body={id:convId,members:[me.id,ownerId]};
      return request('/rest/v1/conversations',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)}).then(function(rows2){
        var row=(rows2&&rows2[0])||{id:convId,members:[me.id,ownerId]};
        conversations.unshift(Object.assign({_lastMessage:null,_unreadCount:0},row));
        return row.id;
      }).catch(function(err){
        console.warn('resolveBizEntry:',err);
        toast('Could not start this conversation. Please try again.',true);
        return null;
      });
    }).catch(function(err){
      console.warn('resolveBizEntry lookup:',err);
      toast('Could not load this business.',true);
      return null;
    });
  }
  function findExistingPairConversation(otherId,pairKey){
    var match=conversations.filter(function(c){
      var id=String(c.id);
      if(id.indexOf('biz_')===0||id.indexOf('job_')===0)return false;
      var mem=Array.isArray(c.members)?c.members.map(String):[];
      var byMembers=mem.indexOf(String(me.id))!==-1&&mem.indexOf(String(otherId))!==-1;
      var byId=id===pairKey||id.indexOf(pairKey+'_')===0;
      return byMembers||byId;
    }).sort(function(a,b){
      var at=(a._lastMessage&&new Date(a._lastMessage.created_at).getTime())||0;
      var bt=(b._lastMessage&&new Date(b._lastMessage.created_at).getTime())||0;
      return bt-at;
    });
    return match[0]||null;
  }
  function resolveEntryConversation(){
    var params=new URLSearchParams(location.search);
    var convId=params.get('conv');
    var otherId=params.get('to');
    var bizId=params.get('biz');
    var listingId=params.get('listing')||null;
    if(convId){
      stripEntryParams();
      // Notification deep-link: only open if we're actually a member (the
      // conversations list above is already scoped to `members cs. {me}`,
      // so a conversation the user doesn't belong to simply won't be found).
      var known=conversations.find(function(c){return c.id===convId});
      if(!known)toast('That conversation is not available.',true);
      return Promise.resolve(known?known.id:null);
    }
    if(bizId){
      stripEntryParams();
      return resolveBizEntry(bizId);
    }
    if(!otherId)return Promise.resolve(null);
    stripEntryParams();
    if(String(otherId)===String(me.id)){toast('You cannot message yourself',true);return Promise.resolve(null)}
    var pairKey=pairConvId(me.id,otherId);
    var existing=findExistingPairConversation(otherId,pairKey);
    if(existing)return Promise.resolve(existing.id);
    return loadProfiles([otherId]).then(function(){
      var target=profiles[otherId];
      if(target&&target.privacy&&target.privacy.allowMessages===false){
        toast('This user has turned off direct messages',true);
        return null;
      }
      var body={id:pairKey,members:[me.id,otherId]};
      if(listingId)body.listing_id=listingId;
      return request('/rest/v1/conversations',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)}).then(function(rows){
        var row=(rows&&rows[0])||{id:pairKey,members:[me.id,otherId],listing_id:listingId};
        conversations.unshift(Object.assign({_lastMessage:null,_unreadCount:0},row));
        return (row.listing_id?loadListings([row.listing_id]):Promise.resolve()).then(function(){return row.id});
      }).catch(function(err){
        console.warn('resolveEntryConversation:',err);
        toast('Could not start this conversation. Please try again.',true);
        return null;
      });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  function returnParam(){return encodeURIComponent('chats'+location.search+location.hash)}
  function showGate(){shell.innerHTML='<section class="gate"><h2>Sign in to view your chats</h2><p>Your PaMarket account keeps every conversation private between you and the other member.</p><a href="auth?return='+returnParam()+'">Sign In</a></section>'}
  function showErrorGate(){shell.innerHTML='<section class="gate"><h2>Could not load your chats</h2><p>Please refresh the page. If the problem continues, contact PaMarket support.</p><a href="chats">Refresh</a></section>'}
  function init(){
    var refresh=window.PMSession&&window.PMSession.maybeRefresh?window.PMSession.maybeRefresh():Promise.resolve();
    Promise.resolve(refresh).catch(function(){}).then(function(){
      session=window.PMSession&&window.PMSession.getSession?window.PMSession.getSession():null;
      if(!session||!session.user||!session.access_token){showGate();return}
      me={id:session.user.id,name:(session.user.user_metadata&&(session.user.user_metadata.full_name||session.user.user_metadata.name))||session.user.email||'You'};
      return loadConversations().then(resolveEntryConversation).then(function(entryConvId){
        mount();
        initMessageChannel();
        initPresence();
        if(entryConvId){
          activeTab=convKind({id:entryConvId});
          document.querySelectorAll('#chatTabs button').forEach(function(button){button.classList.toggle('active',button.dataset.tab===activeTab)});
          renderInbox();
          openConversation(entryConvId);
          if(window.matchMedia('(max-width:680px)').matches)shell.classList.add('thread-open');
        }
      });
    }).catch(function(err){console.warn('Chats load failed:',err);showErrorGate()});
  }
  window.addEventListener('online',function(){if(session)initMessageChannel()});
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'&&session&&(!msgChannel||msgChannel.state!=='joined')){
      var pill=document.getElementById('rtPill');
      if(pill)initMessageChannel();
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
