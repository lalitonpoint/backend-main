let trip = require('../../app/controllers/trip'); // include trip controller ////

module.exports = function (app) {
    
    app.route('/createtrip').post(trip.create);
    app.route('/provider_createtrip').post(trip.provider_create);
    app.route('/send_request').post(trip.send_request_from_dispatcher);
    
    app.route('/gettrips').post(trip.provider_get_trips);
    app.route('/gettripsdetails').post(trip.provider_get_trip_details);
    app.route('/usergettripstatus').post(trip.user_get_trip_status);
    app.route('/respondstrip').post(trip.responds_trip);
    app.route('/canceltrip').post(trip.trip_cancel_by_user);
    app.route('/trip_cancel_by_guest').post(trip.trip_cancel_by_guest);
    app.route('/tripcancelbyprovider').post(trip.trip_cancel_by_provider);
    app.route('/tripcancelbyadmin').post(trip.trip_cancel_by_admin);
    app.route('/scheduledtripcancelbyadmin').post(trip.scheduled_trip_cancel_by_admin);
    app.route('/settripstatus').post(trip.provider_set_trip_status);
    app.route('/settripstopstatus').post(trip.provider_set_trip_stop_status);
    app.route('/completetrip').post(trip.provider_complete_trip);
    


    app.route('/pay_payment').post(trip.pay_payment);
    app.route('/pay_tip_payment').post(trip.pay_tip_payment);
    app.route('/pay_stripe_intent_payment').post(trip.pay_stripe_intent_payment);
    //Old: app.route('/pay_stripe_intent_payment').get(trip.pay_stripe_intent_payment);
    app.route('/fail_stripe_intent_payment').post(trip.fail_stripe_intent_payment);
    //Old Code: app.route('/userhistory').post(trip.user_history);
    app.route('/usertripdetail').post(trip.user_tripdetail);
    app.route('/providertripdetail').post(trip.provider_tripdetail);
    app.route('/providergettripstatus').post(trip.providergettripstatus);

    //Old Code: app.route('/providerhistory').post(trip.provider_history);
    app.route('/usergiverating').post(trip.user_rating);
    app.route('/providergiverating').post(trip.provider_rating);
    app.route('/getuserinvoice').post(trip.user_invoice);

    app.route('/getproviderinvoice').post(trip.provider_invoice);
    app.route('/usersetdestination').post(trip.user_setdestination);
    app.route('/getgooglemappath').post(trip.getgooglemappath);
    app.route('/setgooglemappath').post(trip.setgooglemappath);

    app.route('/check_destination').post(trip.check_destination);

    app.route('/user_submit_invoice').post(trip.user_submit_invoice);
    app.route('/provider_submit_invoice').post(trip.provider_submit_invoice);
    
    app.route('/getnearbyprovider').post(trip.get_near_by_provider);
    app.route('/twilio_voice_call').post(trip.twilio_voice_call);

    app.route('/refund_amount_in_wallet').post(trip.refund_amount_in_wallet);
    app.route('/refund_amount_in_card').post(trip.refund_amount_in_card);
    
    app.route('/pay_by_other_payment_mode').post(trip.pay_by_other_payment_mode);
    app.route('/userchangepaymenttype').post(trip.change_paymenttype);
    app.route('/driver_bids_trip').post(trip.driver_bids_trip);

    app.route('/user_reject_bid').post(trip.user_reject_bid);
    app.route('/user_accept_bid').post(trip.user_accept_bid);

    app.route('/get_cancellation_reason').post(trip.get_cancellation_reason)
    
    app.route('/.well-known/apple-developer-merchantid-domain-association').get(trip.applepay_web_key)

    app.route('/trip_remaning_payment').post(trip.trip_remaning_payment)
    app.route('/apple_pay_webhooks').post(trip.apple_pay_webhooks)
    app.route('/fixed_old_trip').post(trip.fixed_old_trip) // only need to use for temp purpose
    app.route('/fixed_old_trip_history').post(trip.fixed_old_trip_history) // only need to use for temp purpose

    //rental apis
    app.route('/createrentaltrip').post(trip.createrentaltrip);
    app.route('/provider_get_pending_rental_request').post(trip.provider_get_pending_rental_request);
    app.route('/user_get_pending_rental_request').post(trip.user_get_pending_rental_request);
    app.route('/provider_accept_rental_trip').post(trip.provider_accept_rental_trip);
    app.route('/user_rental_request_list').post(trip.user_rental_request_list);
    app.route('/provider_rental_request_list').post(trip.provider_rental_request_list);
    app.route('/user_get_rental_trip_vehicle_detail').post(trip.user_get_rental_trip_vehicle_detail);
    app.route('/provider_get_rental_trip_vehicle_detail').post(trip.provider_get_rental_trip_vehicle_detail);
    app.route('/provider_handover_vehicle').post(trip.provider_handover_vehicle);
    app.route('/user_handover_vehicle').post(trip.user_handover_vehicle);
    app.route('/driver_set_additional_charge').post(trip.driver_set_additional_charge);
    app.route('/cancelrentaltrip').post(trip.cancelrentaltrip);
    app.route('/user_rental_rating').post(trip.user_rental_rating);
    app.route('/provider_rental_rating').post(trip.provider_rental_rating);

};



