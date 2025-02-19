let users = require('../../app/controllers/users'); // include user controller ////
let setting = require('../../app/admin/controller/settings');
let utils = require('../../app/controllers/utils')
const dispatcher_request = require('../dispatcher/controller/dispatcher_request')
const promo_code = require('../admin/controller/promo_code')

module.exports = function (app) {
    app.route('/check_user_registered').post(users.check_user_registered);
    app.route('/get_otp').post(users.get_otp);
    app.route('/check_sms_otp').post(users.check_sms_otp);
    app.route('/update_password').post(users.update_password);
    app.route('/user_social_login_web').post(users.user_social_login_web)
    
    app.route('/verification').post(users.verification);
    app.route('/verify_email_phone').post(users.verify_email_phone);
    app.route('/userregister').post(users.user_register);
    app.route('/userupdate').post(users.user_update);
    app.route('/userslogin').post(users.user_login);
    app.route('/check_user').post(dispatcher_request.check_user)
    app.route('/add_wallet_amount').post(users.add_wallet_amount);
    app.route('/change_user_wallet_status').post(users.change_user_wallet_status);
    app.route('/logout').post(users.logout);
    app.route('/apply_referral_code').post(users.apply_referral_code);
    app.route('/getuserdetail').post(users.get_user_detail);
    
    app.route('/getfareestimate').post(users.getfareestimate);
    app.route('/apply_promo_code').post(users.apply_promo_code);
    app.route('/remove_promo_code').post(users.remove_promo_code);
    app.route('/get_promo_code_list').post(users.get_promo_code_list);
    app.route('/updateuserdevicetoken').post(users.update_device_token);
    app.route('/get_user_referal_credit').post(users.get_user_referal_credit);
    app.route('/forgotpassword').post(users.forgotpassword);

    app.route('/get_user_setting_detail').post(users.get_user_setting_detail);
    app.route('/get_user_privacy_policy').get(users.get_user_privacy_policy);
    app.route('/terms_and_condition').get(users.terms_and_condition);
    app.route('/get_user_setting_detail').post(users.get_user_setting_detail);
    
    app.route('/set_home_address').post(users.set_home_address);
    app.route('/get_home_address').post(users.get_home_address);

    app.route('/user_accept_reject_corporate_request').post(users.user_accept_reject_corporate_request);

    app.route('/withdraw_redeem_point_to_wallet').post(users.withdraw_redeem_point_to_wallet);


    /* ELLUMINATI - AD 13 May 2019  for add, remove and get favourite driver */
    app.route('/add_favourite_driver').post(users.add_favourite_driver);
    app.route('/get_favourite_driver').post(users.get_favourite_driver);
    app.route('/remove_favourite_driver').post(users.remove_favourite_driver);
    app.route('/get_all_driver_list').post(users.get_all_driver_list);

    app.route('/search_user_for_split_payment').post(users.search_user_for_split_payment);
    app.route('/send_split_payment_request').post(users.send_split_payment_request);
    app.route('/accept_or_reject_split_payment_request').post(users.accept_or_reject_split_payment_request);
    app.route('/remove_split_payment_request').post(users.remove_split_payment_request);
    app.route('/update_split_payment_payment_mode').post(users.update_split_payment_payment_mode);
    app.route('/delete_user').post(users.delete_user);
    /*  end */
    app.route('/get_language_list').get(setting.get_language_list)
    app.route('/socket_call').post(utils.socket_call_by_payment)
    app.route('/socket_call_for_fail_payment').post(utils.socket_call_for_fail_payment)
    app.route('/socket_call_for_paytab_add_card').post(utils.socket_call_for_add_card_paytab)
    app.route('/socket_call_for_export_history').post(utils.socket_call_for_export_history)

    app.route('/update_webpush_config').post(users.update_webpush_config)
    app.route('/search_user_to_send_money').post(users.search_user_to_send_money)
    app.route('/send_money_to_friend').post(users.send_money_to_friend)
    app.route('/get_server_time').post(users.get_server_time);

    app.route('/get_fare_estimate_all_type').post(users.get_fare_estimate_all_type);
    app.route('/get_nearby_provider').post(users.get_nearby_provider);
    app.route('/generate_user_history_export_excel').post(users.generate_user_history_export_excel);    
    app.route('/userReviews').get(users.userReviews);
    app.route('/fetch_mass_notification_for_user').post(users.fetch_mass_notification_for_user)

    app.route('/get_banner_list').post( promo_code.get_banner_list);
    app.route('/change_user_language').post(users.change_user_language);

    //car rent
    app.route('/user_get_car_rent_setting_detail').post(users.user_get_car_rent_setting_detail);
    app.route('/get_available_rent_vehicle').post(users.get_available_rent_vehicle);
    app.route('/get_rent_vehicle_detail').post(users.get_rent_vehicle_detail);
    app.route('/get_filter_data').post(users.get_filter_data);
    app.route('/user_get_car_rent_model_list').post(users.user_get_car_rent_model_list);
    //favourite rent vehicle
    app.route('/add_remove_favourite_rent_vehicle').post(users.add_remove_favourite_rent_vehicle);
    app.route('/get_favourite_rent_vehicle').post(users.get_favourite_rent_vehicle);

};