// Rental detail availability: real busy dates + pick-up/return selection.
//
// rental_vehicle_availability is owner-only under RLS, so this never reads
// it directly. It calls rental_vehicle_busy_ranges() through
// PMRentals.fetchRentalBusyRanges, which returns only merged inclusive date
// ranges (no reasons, notes or customers). Busy days, and days that would
// make the rental cross a busy period or fall short of the minimum rental,
// cannot be selected. is_available is only the provider's manual pause
// switch; it never decides which dates are free.
(function(root,factory){
  var api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.PMRentalAvailability=api;
})(typeof self!=='undefined'?self:this,function(root){
  'use strict';
  var WINDOW_DAYS=60;
  var DAY_MS=86400000;
  // Zimbabwe is UTC+2 year-round (no DST); the server uses Africa/Harare.
  var HARARE_OFFSET_MS=2*3600000;

  // ── Pure date helpers (YYYY-MM-DD strings, UTC math, no timezone drift) ──
  function today(nowMs){return new Date((nowMs==null?Date.now():nowMs)+HARARE_OFFSET_MS).toISOString().slice(0,10);}
  function parts(iso){var p=iso.split('-');return Date.UTC(+p[0],+p[1]-1,+p[2]);}
  function addDays(iso,n){return new Date(parts(iso)+n*DAY_MS).toISOString().slice(0,10);}
  function daysInclusive(a,b){return Math.round((parts(b)-parts(a))/DAY_MS)+1;}
  function isBusy(iso,ranges){return ranges.some(function(r){return iso>=r.starts_on&&iso<=r.ends_on;});}
  function overlaps(a,b,ranges){return ranges.some(function(r){return r.starts_on<=b&&r.ends_on>=a;});}
  function nextBusyAfter(start,ranges){
    var next=null;
    ranges.forEach(function(r){if(r.ends_on<start)return;var c=r.starts_on>start?r.starts_on:start;if(next===null||c<next)next=c;});
    return next;
  }
  function canStartOn(iso,ranges,minDays,windowEnd){
    if(isBusy(iso,ranges))return false;
    var minEnd=addDays(iso,minDays-1);
    return minEnd<=windowEnd&&!overlaps(iso,minEnd,ranges);
  }
  // Inclusive [min,max] a return date may take, or null when none fits.
  function returnBounds(start,ranges,minDays,windowEnd){
    var nb=nextBusyAfter(start,ranges);
    var max=nb?addDays(nb,-1):windowEnd;
    var min=addDays(start,minDays-1);
    return min<=max?{min:min,max:max}:null;
  }

  // ── Rendering ────────────────────────────────────────────────────────
  var CSS='.ra{margin-top:20px}.ra h3{font-size:15px;font-weight:800;margin-bottom:6px}'+
    '.ra-sub{font-size:13px;color:var(--sub);margin-bottom:12px}'+
    '.ra-busy{background:#FEF2F2;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:13px}'+
    '.ra-busy b{display:block;color:#991B1B;font-size:12px;margin-bottom:2px}'+
    '.ra-months{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}'+
    '.ra-month h4{font-size:13px;font-weight:700;margin-bottom:6px}'+
    '.ra-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}'+
    '.ra-dow{font-size:10.5px;font-weight:700;color:var(--mute);text-align:center;padding:2px 0}'+
    '.ra-day{min-height:34px;border:1px solid transparent;border-radius:8px;background:#F1F5F9;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer}'+
    '.ra-day:hover:not(:disabled){border-color:var(--navy)}'+
    '.ra-day:focus-visible{outline:2px solid var(--navy);outline-offset:1px}'+
    '.ra-day:disabled{cursor:not-allowed;background:transparent;color:var(--mute)}'+
    '.ra-day.busy{background:#FEE2E2;color:#991B1B;text-decoration:line-through}'+
    '.ra-day.inrange{background:#DBEAFE}'+
    '.ra-day.sel{background:var(--navy);color:#fff}'+
    '.ra-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12px;color:var(--sub)}'+
    '.ra-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}'+
    '.ra-summary{margin-top:12px;font-size:13.5px;color:var(--ink);min-height:20px}'+
    '.ra-summary.err{color:#991B1B}'+
    '.ra-actions{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}'+
    '.ra-link{background:none;border:0;color:var(--navy);font-weight:700;font-size:13px;cursor:pointer;padding:0}'+
    // !important on color: Tailwind's CDN preflight resets button{color:inherit}
    // with high effective priority, which otherwise makes this text render as
    // the page's dark ink color on the dark navy background (invisible).
    '.ra-book-btn{background:var(--navy);color:#fff!important;border:0;border-radius:10px;padding:11px 18px;font-size:13.5px;font-weight:700;cursor:pointer;margin-top:12px}'+
    '.ra-book-btn:disabled{opacity:.55;cursor:not-allowed}'+
    '.ra-modal-backdrop{position:fixed;inset:0;background:rgba(10,15,30,.5);display:flex;align-items:flex-end;justify-content:center;z-index:200}'+
    '@media(min-width:640px){.ra-modal-backdrop{align-items:center}}'+
    '.ra-modal{background:#fff;border-radius:16px 16px 0 0;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;padding:22px}'+
    '@media(min-width:640px){.ra-modal{border-radius:16px}}'+
    '.ra-modal h3{font-size:17px;font-weight:800;margin-bottom:4px}'+
    '.ra-modal .ra-modal-sub{font-size:13px;color:var(--sub);margin-bottom:16px}'+
    '.ra-field{margin-top:14px}'+
    '.ra-field label{display:block;font-size:11.5px;font-weight:700;color:var(--sub);text-transform:uppercase;margin-bottom:6px}'+
    '.ra-hour-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}'+
    '.ra-hour-chip{flex-shrink:0;padding:8px 13px;border-radius:20px;background:#F1F5F9;border:1px solid #E4E4E7;font-size:12.5px;font-weight:600;cursor:pointer}'+
    '.ra-hour-chip.sel{background:var(--navy);color:#fff!important;border-color:var(--navy)}'+
    '.ra-segment-row{display:flex;gap:8px}'+
    '.ra-segment{flex:1;padding:9px;border-radius:10px;text-align:center;background:#F1F5F9;border:1px solid #E4E4E7;font-size:13px;font-weight:700;cursor:pointer}'+
    '.ra-segment.sel{background:var(--navy);color:#fff!important;border-color:var(--navy)}'+
    '.ra-input{width:100%;margin-top:8px;padding:10px 12px;border:1px solid #E4E4E7;border-radius:10px;font-size:13.5px;font-family:inherit}'+
    '.ra-driver-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px}'+
    '.ra-breakdown{margin-top:18px;background:#F8FAFC;border-radius:10px;padding:14px}'+
    '.ra-breakdown-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}'+
    '.ra-breakdown-row.total{border-top:1px solid #E4E4E7;margin-top:6px;padding-top:10px;font-weight:800;font-size:15px;color:var(--navy)}'+
    '.ra-modal-close{position:absolute;top:14px;right:14px;background:none;border:0;font-size:20px;cursor:pointer;color:var(--sub)}'+
    '.ra-disclaimer{font-size:11.5px;color:var(--mute);margin-top:12px;line-height:1.5}'+
    '.ra-confirm{text-align:center;padding:20px 0}'+
    '.ra-confirm svg{margin-bottom:10px}';

  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function label(iso,opts){return new Date(iso+'T12:00:00').toLocaleDateString(undefined,opts||{day:'numeric',month:'short'});}
  function rangeLabel(r){return r.starts_on===r.ends_on?label(r.starts_on):label(r.starts_on)+' – '+label(r.ends_on);}
  var PICKUP_HOURS=[7,8,9,10,11,12,13,14,15,16,17,18,19];
  function formatHour(h){var period=h>=12?'PM':'AM',h12=h%12===0?12:h%12;return h12+':00 '+period;}
  function isoToTimestamp(dateIso,hour){var d=new Date(dateIso+'T00:00:00');d.setHours(hour,0,0,0);return d.toISOString();}

  function mount(v,opts){
    var doc=root.document;opts=opts||{};
    var host=doc.getElementById(opts.hostId||'dAvailability');
    var badge=doc.getElementById(opts.badgeId||'dAvail');
    if(!host||!v||!v.id)return;
    if(!doc.getElementById('raStyles')){var st=doc.createElement('style');st.id='raStyles';st.textContent=CSS;doc.head.appendChild(st);}

    var minDays=Math.max(parseInt(v.min_rental_days,10)||1,1);
    var start=today(),end=addDays(start,WINDOW_DAYS-1);
    var state={ranges:[],pickup:null,ret:null,error:null,loading:true};
    var title=opts.title||'this vehicle';
    var rate=Number(v.daily_rate)||0;

    function setBadge(text,ok){if(badge)badge.innerHTML='<span class="d-avail '+(ok?'yes':'no')+'">'+esc(text)+'</span>';}

    function updateWhatsApp(){
      var wa=doc.getElementById('waBtn');if(!wa||!wa.href)return;
      var base=wa.href.split('?')[0];
      var msg=state.pickup&&state.ret
        ?'Hi, I saw your '+title+' rental on PaMarket. Is it available from '+state.pickup+' to '+state.ret+' ('+daysInclusive(state.pickup,state.ret)+' days)?'
        :'Hi, I saw your '+title+' rental on PaMarket. Is it available?';
      wa.href=base+'?text='+encodeURIComponent(msg);
    }

    function dayState(iso){
      if(iso<start||iso>end)return{disabled:true};
      var busy=isBusy(iso,state.ranges);
      if(busy)return{disabled:true,busy:true,why:'unavailable'};
      if(state.pickup&&!state.ret){
        if(iso===state.pickup)return{sel:true,disabled:true};
        var b=returnBounds(state.pickup,state.ranges,minDays,end);
        if(b&&iso>=b.min&&iso<=b.max)return{};
        // Outside the return window: allow restarting with a new pick-up.
        return canStartOn(iso,state.ranges,minDays,end)?{}:{disabled:true,why:'not available for the minimum rental'};
      }
      var sel=iso===state.pickup||iso===state.ret;
      var inr=state.pickup&&state.ret&&iso>state.pickup&&iso<state.ret;
      if(sel||inr)return{sel:sel,inrange:inr};
      return canStartOn(iso,state.ranges,minDays,end)?{}:{disabled:true,why:'not available for the minimum rental'};
    }

    function pick(iso){
      if(state.pickup&&!state.ret){
        var b=returnBounds(state.pickup,state.ranges,minDays,end);
        if(b&&iso>=b.min&&iso<=b.max){state.ret=iso;render();return;}
      }
      state.pickup=iso;state.ret=null;render();
    }

    function monthHtml(y,m){
      var first=new Date(Date.UTC(y,m,1)),lead=(first.getUTCDay()+6)%7;
      var days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
      var html='<div class="ra-month"><h4>'+esc(first.toLocaleDateString(undefined,{month:'long',year:'numeric',timeZone:'UTC'}))+'</h4><div class="ra-grid">';
      ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(function(d){html+='<div class="ra-dow" aria-hidden="true">'+d+'</div>';});
      for(var i=0;i<lead;i++)html+='<div></div>';
      for(var d=1;d<=days;d++){
        var iso=new Date(Date.UTC(y,m,d)).toISOString().slice(0,10),s=dayState(iso);
        var cls='ra-day'+(s.busy?' busy':'')+(s.sel?' sel':'')+(s.inrange?' inrange':'');
        var aria=label(iso,{weekday:'long',day:'numeric',month:'long'})+(s.why?', '+s.why:'')+(s.sel?', selected':'');
        html+='<button type="button" class="'+cls+'" data-iso="'+iso+'"'+(s.disabled?' disabled':'')+' aria-label="'+esc(aria)+'"'+(s.sel?' aria-pressed="true"':'')+'>'+d+'</button>';
      }
      return html+'</div></div>';
    }

    function summaryHtml(){
      if(!state.pickup)return'Select a pick-up date.';
      if(!state.ret){
        var b=returnBounds(state.pickup,state.ranges,minDays,end);
        return 'Pick-up '+esc(label(state.pickup))+'. Now select a return date'+(b&&b.max<end?' (by '+esc(label(b.max))+', the vehicle is booked after that)':'')+'.';
      }
      var n=daysInclusive(state.pickup,state.ret);
      return '<b>'+esc(label(state.pickup))+' → '+esc(label(state.ret))+'</b> · '+n+' day'+(n===1?'':'s')+(rate?' · Est. $'+(n*rate).toLocaleString():'')+'. These dates are available.';
    }

    function render(){
      if(!v.is_available){
        setBadge('Not taking new requests',false);
        host.innerHTML='<div class="ra d-section"><h3>Availability</h3><p class="ra-sub">This company has paused new rental requests for this vehicle. You can still message them.</p></div>';
        return;
      }
      if(state.loading){setBadge('Checking availability…',true);host.innerHTML='<div class="ra d-section"><h3>Check availability</h3><p class="ra-sub">Loading booked dates…</p></div>';return;}
      if(state.error){
        if(badge)badge.innerHTML='';
        host.innerHTML='<div class="ra d-section"><h3>Check availability</h3><p class="ra-summary err" role="alert">We couldn\'t load this vehicle\'s availability. Please ask the company to confirm dates.</p><div class="ra-actions"><button type="button" class="ra-link" id="raRetry">Try again</button></div></div>';
        doc.getElementById('raRetry').onclick=load;
        return;
      }
      var busyToday=isBusy(start,state.ranges);
      setBadge(busyToday?'Booked today':'Available today',!busyToday);
      var upcoming=state.ranges.filter(function(r){return r.ends_on>=start&&r.starts_on<=end;});
      var html='<div class="ra d-section"><h3>Check availability</h3><p class="ra-sub">Choose pick-up and return dates within the next '+WINDOW_DAYS+' days'+(minDays>1?'. Minimum rental: '+minDays+' days':'')+'.</p>';
      html+=upcoming.length?'<div class="ra-busy"><b>Unavailable</b>'+upcoming.map(function(r){return esc(rangeLabel(r));}).join(' · ')+'</div>':'<p class="ra-sub">No booked dates in the next '+WINDOW_DAYS+' days.</p>';
      html+='<div class="ra-months">';
      var k=(+start.slice(0,4))*12+(+start.slice(5,7)-1),last=(+end.slice(0,4))*12+(+end.slice(5,7)-1);
      for(;k<=last;k++)html+=monthHtml(Math.floor(k/12),k%12);
      html+='</div><div class="ra-legend"><span><i style="background:#FEE2E2"></i>Unavailable</span><span><i style="background:var(--navy)"></i>Selected</span><span><i style="background:#F1F5F9"></i>Free</span></div>';
      html+='<div class="ra-summary" aria-live="polite">'+summaryHtml()+'</div>';
      var actions='';
      if(state.pickup)actions+='<button type="button" class="ra-link" id="raClear">Clear dates</button>';
      if(state.pickup&&state.ret)html+='<button type="button" class="ra-book-btn" id="raBookBtn">Request to Book</button>';
      if(actions)html+='<div class="ra-actions">'+actions+'</div>';
      host.innerHTML=html+'</div>';
      host.querySelectorAll('.ra-day:not(:disabled)').forEach(function(b){b.onclick=function(){pick(b.getAttribute('data-iso'));};});
      var clr=doc.getElementById('raClear');if(clr)clr.onclick=function(){state.pickup=state.ret=null;render();};
      var bookBtn=doc.getElementById('raBookBtn');if(bookBtn)bookBtn.onclick=openBookingModal;
      updateWhatsApp();
    }

    // ── Booking modal: options + server-side price breakdown + submit ────
    function openBookingModal(){
      var token=(root.PMServiceTransport&&root.PMServiceTransport.session)?root.PMServiceTransport.session():null;
      if(!token||!token.access_token){
        location.href='auth?return='+encodeURIComponent(location.pathname+location.search);
        return;
      }
      var bs={pickupHour:10,returnHour:10,fulfillment:'pickup',deliveryAddress:'',withDriver:false,note:'',quote:null,quoteError:null,quoting:false,submitting:false};
      var overlay=doc.createElement('div');
      overlay.className='ra-modal-backdrop';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      doc.body.appendChild(overlay);
      doc.body.style.overflow='hidden';

      function close(){doc.body.removeChild(overlay);doc.body.style.overflow='';}
      overlay.addEventListener('click',function(e){if(e.target===overlay)close();});

      function pickupAt(){return isoToTimestamp(state.pickup,bs.pickupHour);}
      function returnAt(){return isoToTimestamp(state.ret,bs.returnHour);}

      function loadQuote(){
        bs.quoting=true;bs.quoteError=null;renderModal();
        var svc=root.PMRentals;
        if(!svc||!svc.quoteRentalBooking){bs.quoting=false;bs.quoteError='Booking is temporarily unavailable.';renderModal();return;}
        svc.quoteRentalBooking(v.id,pickupAt(),returnAt(),bs.withDriver).then(function(q){
          bs.quoting=false;bs.quote=q;renderModal();
        }).catch(function(err){
          bs.quoting=false;bs.quoteError=(err&&err.message)||'Could not calculate the price.';renderModal();
        });
      }

      function breakdownHtml(){
        if(bs.quoting)return'<p class="ra-sub">Calculating…</p>';
        if(bs.quoteError)return'<p class="ra-summary err" role="alert">'+esc(bs.quoteError)+'</p>';
        if(!bs.quote)return'';
        var q=bs.quote,rows='';
        rows+='<div class="ra-breakdown-row"><span>$'+q.daily_rate+'/day × '+q.rental_days+' day'+(q.rental_days===1?'':'s')+'</span><span>$'+Number(q.rate_subtotal).toLocaleString()+'</span></div>';
        if(q.driver_fee>0)rows+='<div class="ra-breakdown-row"><span>Driver</span><span>$'+Number(q.driver_fee).toLocaleString()+'</span></div>';
        if(q.extras_fee>0)rows+='<div class="ra-breakdown-row"><span>Extras</span><span>$'+Number(q.extras_fee).toLocaleString()+'</span></div>';
        if(q.deposit>0)rows+='<div class="ra-breakdown-row"><span>Security deposit</span><span>$'+Number(q.deposit).toLocaleString()+'</span></div>';
        rows+='<div class="ra-breakdown-row total"><span>Total</span><span>$'+Number(q.total_amount).toLocaleString()+'</span></div>';
        return rows;
      }

      function renderModal(){
        var canSubmit=bs.quote&&!bs.quoting&&!bs.submitting&&(bs.fulfillment==='pickup'||bs.deliveryAddress.trim().length>0);
        overlay.innerHTML='<div class="ra-modal" role="document">'+
          '<button type="button" class="ra-modal-close" id="raModalClose" aria-label="Close">×</button>'+
          '<h3>Complete your request</h3>'+
          '<p class="ra-modal-sub">'+esc(title)+' · '+esc(label(state.pickup))+' → '+esc(label(state.ret))+'</p>'+
          '<div class="ra-field"><label>Pick-up time</label><div class="ra-hour-row" id="raPickupHours">'+PICKUP_HOURS.map(function(h){return'<button type="button" class="ra-hour-chip'+(bs.pickupHour===h?' sel':'')+'" data-h="'+h+'">'+formatHour(h)+'</button>';}).join('')+'</div></div>'+
          '<div class="ra-field"><label>Return time</label><div class="ra-hour-row" id="raReturnHours">'+PICKUP_HOURS.map(function(h){return'<button type="button" class="ra-hour-chip'+(bs.returnHour===h?' sel':'')+'" data-h="'+h+'">'+formatHour(h)+'</button>';}).join('')+'</div></div>'+
          '<div class="ra-field"><label>Fulfillment</label><div class="ra-segment-row"><button type="button" class="ra-segment'+(bs.fulfillment==='pickup'?' sel':'')+'" data-f="pickup">Pick up</button><button type="button" class="ra-segment'+(bs.fulfillment==='delivery'?' sel':'')+'" data-f="delivery">Delivery</button></div>'+
          (bs.fulfillment==='delivery'?'<input class="ra-input" id="raDeliveryAddr" placeholder="Delivery address" value="'+esc(bs.deliveryAddress)+'">':'')+
          '</div>'+
          (v.driver_rate!=null?'<div class="ra-driver-row"><div><label style="margin:0">Driver</label><div class="ra-sub" style="margin:2px 0 0">+$'+v.driver_rate+'/day</div></div><input type="checkbox" id="raDriverToggle"'+(bs.withDriver?' checked':'')+' style="width:20px;height:20px"></div>':'')+
          '<div class="ra-field"><label>Note to provider (optional)</label><textarea class="ra-input" id="raNote" rows="3" maxlength="300">'+esc(bs.note)+'</textarea></div>'+
          '<div class="ra-breakdown">'+breakdownHtml()+'</div>'+
          '<button type="button" class="ra-book-btn" id="raSubmitBooking" style="width:100%"'+(canSubmit?'':' disabled')+'>'+(bs.submitting?'Sending…':'Send booking request')+'</button>'+
          '<p class="ra-disclaimer">This sends a request to the provider — you\'re not charged yet. Payment is arranged directly with the company once confirmed.</p>'+
          '</div>';
        doc.getElementById('raModalClose').onclick=close;
        overlay.querySelectorAll('#raPickupHours .ra-hour-chip').forEach(function(b){b.onclick=function(){bs.pickupHour=+b.getAttribute('data-h');loadQuote();};});
        overlay.querySelectorAll('#raReturnHours .ra-hour-chip').forEach(function(b){b.onclick=function(){bs.returnHour=+b.getAttribute('data-h');loadQuote();};});
        overlay.querySelectorAll('.ra-segment').forEach(function(b){b.onclick=function(){bs.fulfillment=b.getAttribute('data-f');renderModal();};});
        var addrInput=doc.getElementById('raDeliveryAddr');if(addrInput)addrInput.oninput=function(){bs.deliveryAddress=addrInput.value;renderModal();};
        var driverToggle=doc.getElementById('raDriverToggle');if(driverToggle)driverToggle.onchange=function(){bs.withDriver=driverToggle.checked;loadQuote();};
        var noteInput=doc.getElementById('raNote');if(noteInput)noteInput.oninput=function(){bs.note=noteInput.value;};
        var submitBtn=doc.getElementById('raSubmitBooking');if(submitBtn)submitBtn.onclick=submit;
      }

      function submit(){
        if(!bs.quote||bs.submitting)return;
        bs.submitting=true;renderModal();
        var svc=root.PMRentals;
        svc.requestRentalBooking({
          listingId:v.id,pickupAt:pickupAt(),returnAt:returnAt(),fulfillment:bs.fulfillment,
          deliveryAddress:bs.fulfillment==='delivery'?bs.deliveryAddress.trim():null,
          withDriver:bs.withDriver,customerNote:bs.note.trim()||null
        }).then(function(bookingId){
          bs.submitting=false;
          overlay.innerHTML='<div class="ra-modal" role="document"><button type="button" class="ra-modal-close" id="raModalClose2" aria-label="Close">×</button>'+
            '<div class="ra-confirm"><svg width="48" height="48" fill="none" stroke="#16A34A" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>'+
            '<h3>Request sent</h3><p class="ra-sub">Your booking request has been sent to the provider. You\'ll be notified as soon as they respond.</p>'+
            '<button type="button" class="ra-book-btn" id="raViewBookings">View My Rentals</button></div></div>';
          doc.getElementById('raModalClose2').onclick=function(){close();state.pickup=state.ret=null;render();};
          doc.getElementById('raViewBookings').onclick=function(){location.href='my-rental-bookings';};
        }).catch(function(err){
          bs.submitting=false;
          if(err&&err.code==='23P01'){
            close();state.pickup=state.ret=null;load();
            if(root.alert)root.alert('Some of those dates are no longer available. Please choose new dates.');
          }else{
            bs.quoteError=(err&&err.message)||'Could not send your request. Please try again.';
            renderModal();
          }
        });
      }

      renderModal();
      loadQuote();
    }

    function load(){
      state.loading=true;state.error=null;render();
      var svc=root.PMRentals;
      if(!svc||!svc.fetchRentalBusyRanges){state.loading=false;state.error='unavailable';render();return;}
      svc.fetchRentalBusyRanges(v.id,start,end).then(function(ranges){
        state.ranges=ranges;state.loading=false;
        // Drop a selection that is no longer valid against fresh data.
        if(state.pickup&&(!canStartOn(state.pickup,ranges,minDays,end)||(state.ret&&overlaps(state.pickup,state.ret,ranges)))){state.pickup=state.ret=null;}
        render();
      }).catch(function(err){
        if(root.console)root.console.warn('rental availability:',err);
        state.loading=false;state.error='failed';render();
      });
    }

    load();
  }

  return Object.freeze({
    mount:mount,
    WINDOW_DAYS:WINDOW_DAYS,
    _test:{today:today,addDays:addDays,daysInclusive:daysInclusive,isBusy:isBusy,overlaps:overlaps,nextBusyAfter:nextBusyAfter,canStartOn:canStartOn,returnBounds:returnBounds}
  });
});
