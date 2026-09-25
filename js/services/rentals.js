(function(root,factory){var api=factory(root.PMServiceTransport);if(typeof module!=='undefined'&&module.exports)module.exports=factory;if(root)root.PMRentals=api;})(typeof self!=='undefined'?self:this,function(transport){
  'use strict';var esc=transport.escape;
  // Web and mobile share this date-aware RPC. Its availability flag includes
  // provider blocks and confirmed/active rentals, not just the manual switch.
  function fetchRentalListings(opts){opts=opts||{};return transport.rpcJson('rental_search_listings',{
    p_category_slug:opts.category||null,p_city:opts.city||null,p_brand_slug:opts.brand||null,
    p_price_min:opts.priceMin==null?null:opts.priceMin,p_price_max:opts.priceMax==null?null:opts.priceMax,
    p_transmission:opts.transmission||null,p_fuel_type:opts.fuelType||null,p_drive_type:opts.driveType||null,
    p_available_only:!!opts.availableOnly,p_featured_first:opts.featuredFirst!==false,
    p_limit:opts.limit||12,p_offset:opts.offset||0,p_start_date:opts.startDate||null,p_end_date:opts.endDate||null
  }).then(function(rows){return Array.isArray(rows)?rows:[];});}
  // Explicit columns only: registration (listings) and vin/engine_number
  // (specs) are not readable by anon/authenticated, so select=* is refused.
  var DETAIL_COLUMNS='id,company_id,model,year,daily_rate,weekly_rate,monthly_rate,deposit,min_rental_days,driver_rate,pickup_suburb,description,is_available,created_at';
  var SPEC_COLUMNS='transmission,fuel_type,drive_type,seats,doors,mileage_km';
  function fetchRentalListingById(id){return transport.fetchJson('rental_vehicle_listings?id=eq.'+esc(id)+'&status=eq.active&admin_status=eq.approved&deleted_at=is.null&select='+DETAIL_COLUMNS+',rental_brands(label),rental_categories(label),rental_locations(city,province),rental_vehicle_media(url,is_cover,sort_order),rental_vehicle_specs('+SPEC_COLUMNS+'),rental_vehicle_features(feature),rental_companies(business_id,trading_name,rental_phone,rental_whatsapp,rental_email,year_established,deposit_policy,driver_available,cross_border,insurance_included,min_rental_days,avg_rating,review_count,businesses(owner_user_id))').then(function(rows){return rows[0]||null;});}
  // Merged busy date ranges only (no reasons/notes/customers); the
  // availability table itself is owner-only.
  function fetchRentalBusyRanges(id,from,to){return transport.rpcJson('rental_vehicle_busy_ranges',{p_listing_id:id,p_from:from||null,p_to:to||null}).then(function(rows){return Array.isArray(rows)?rows:[];});}

  // ── Phase 1: bookings ──────────────────────────────────────────────────
  // Every call below requires a real signed-in session (request_rental_
  // booking/accept/decline/etc. are all `to authenticated` only server
  // side) — callers must check transport.session() themselves before
  // calling and prompt sign-in if it's null, same as the RN app does.
  function authToken(){var s=transport.session();return s&&s.access_token?s.access_token:null;}

  function quoteRentalBooking(listingId,pickupAt,returnAt,withDriver){
    var token=authToken();if(!token)return Promise.reject(new Error('Sign in required'));
    return transport.rpcJson('rental_quote_booking',{p_listing_id:listingId,p_pickup_at:pickupAt,p_return_at:returnAt,p_with_driver:!!withDriver},token)
      .then(function(rows){return (Array.isArray(rows)&&rows[0])||null;});
  }

  function requestRentalBooking(opts){
    var token=authToken();if(!token)return Promise.reject(new Error('Sign in required'));
    return transport.rpcJson('request_rental_booking',{
      p_listing_id:opts.listingId,p_pickup_at:opts.pickupAt,p_return_at:opts.returnAt,
      p_fulfillment:opts.fulfillment||'pickup',p_delivery_address:opts.deliveryAddress||null,
      p_with_driver:!!opts.withDriver,p_customer_note:opts.customerNote||null,p_conversation_id:opts.conversationId||null
    },token);
  }

  // opts.limit/opts.offset are optional — omitting them calls the 1-arg RPC
  // overload (list_my_rental_bookings(p_status)), defaulting to 50 rows.
  function listMyRentalBookings(status,opts){
    var token=authToken();if(!token)return Promise.reject(new Error('Sign in required'));
    var args={p_status:status||null};opts=opts||{};if(opts.limit!=null)args.p_limit=opts.limit;if(opts.offset!=null)args.p_offset=opts.offset;
    return transport.rpcJson('list_my_rental_bookings',args,token).then(function(rows){return Array.isArray(rows)?rows:[];});
  }

  // Full detail row (customer OR provider viewer — RLS scopes it) with the
  // vehicle/company/provider display fields needed for the detail page,
  // via PostgREST embeds in one request rather than N sequential ones.
  var BOOKING_DETAIL_COLUMNS='id,listing_id,company_id,customer_id,status,pickup_at,return_at,fulfillment,delivery_address,with_driver,daily_rate,rental_days,rate_subtotal,driver_fee,extras_fee,deposit,total_amount,currency,customer_note,decline_reason,cancellation_reason,cancelled_by,created_at,conversation_id';
  function fetchRentalBookingDetail(id){
    var token=authToken();if(!token)return Promise.reject(new Error('Sign in required'));
    return transport.fetchJson(
      'rental_bookings?id=eq.'+esc(id)+'&select='+BOOKING_DETAIL_COLUMNS+
      ',rental_vehicle_listings(model,year,pickup_suburb,rental_brands(slug),rental_vehicle_media(url,is_cover)),'+
      'rental_companies(trading_name,businesses(name,phone,whatsapp,owner_user_id))',
      token
    ).then(function(rows){return rows[0]||null;});
  }

  function listCompanyRentalBookings(companyId,status,opts){
    var token=authToken();if(!token)return Promise.reject(new Error('Sign in required'));
    var args={p_company_id:companyId,p_status:status||null};opts=opts||{};if(opts.limit!=null)args.p_limit=opts.limit;if(opts.offset!=null)args.p_offset=opts.offset;
    return transport.rpcJson('list_company_rental_bookings',args,token).then(function(rows){return Array.isArray(rows)?rows:[];});
  }

  function bookingTransition(fn,bookingId,reason){
    var token=authToken();if(!token)return Promise.reject(new Error('Sign in required'));
    var args={p_booking_id:bookingId};if(reason!==undefined)args.p_reason=reason||null;
    return transport.rpcJson(fn,args,token);
  }
  function acceptRentalBooking(id){return bookingTransition('accept_rental_booking',id);}
  function declineRentalBooking(id,reason){return bookingTransition('decline_rental_booking',id,reason);}
  function cancelRentalBooking(id,reason){return bookingTransition('cancel_rental_booking',id,reason);}
  function markRentalPickedUp(id){return bookingTransition('mark_rental_picked_up',id);}
  function markRentalReturned(id){return bookingTransition('mark_rental_returned',id);}
  function completeRentalBooking(id){return bookingTransition('complete_rental_booking',id);}

  return Object.freeze({
    fetchRentalListings:fetchRentalListings,fetchRentalListingById:fetchRentalListingById,fetchRentalBusyRanges:fetchRentalBusyRanges,
    quoteRentalBooking:quoteRentalBooking,requestRentalBooking:requestRentalBooking,
    listMyRentalBookings:listMyRentalBookings,listCompanyRentalBookings:listCompanyRentalBookings,fetchRentalBookingDetail:fetchRentalBookingDetail,
    acceptRentalBooking:acceptRentalBooking,declineRentalBooking:declineRentalBooking,cancelRentalBooking:cancelRentalBooking,
    markRentalPickedUp:markRentalPickedUp,markRentalReturned:markRentalReturned,completeRentalBooking:completeRentalBooking
  });
});
