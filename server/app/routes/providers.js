let providers = require('../../app/controllers/providers'); // include Provider controller ////
let setting = require('../../app/admin/controller/settings')

module.exports = function (app) {
    app.route('/providerregister').post(providers.provider_register);
    app.route('/providerupdatedetail').post(providers.provider_update);
    app.route('/provider_location').post(providers.update_location);
    app.route('/providerslogin').post(providers.provider_login);
    app.route('/getprovidersloginotp').post(providers.getprovidersloginotp);
    app.route('/providerlogout').post(providers.logout);
    app.route('/togglestate').post(providers.change_provider_status);
    app.route('/toggle_go_home').post(providers.change_go_home_status);
    app.route('/get_provider_detail').post(providers.get_provider_detail);
    app.route('/get_provider_info').post(providers.get_provider_info);
    app.route('/getproviderlatlong').post(providers.getproviderlatlong);
    app.route('/providerupdatetype').post(providers.provider_updatetype);
    app.route('/updateproviderdevicetoken').post(providers.update_device_token);
    app.route('/provider_heat_map').post(providers.provider_heat_map);
    app.route('/apply_provider_referral_code').post(providers.apply_provider_referral_code);
    app.route('/update_provider_setting').post(providers.update_provider_setting);
    app.route('/get_provider_referal_credit').post(providers.get_provider_referal_credit);
    app.route('/get_provider_terms_and_condition').get(providers.get_provider_terms_and_condition);
    app.route('/get_provider_privacy_policy').get(providers.get_provider_privacy_policy);
    app.route('/provider_add_vehicle').post(providers.provider_add_vehicle);
    app.route('/upload_vehicle_document').post(providers.upload_vehicle_document);
    app.route('/get_provider_vehicle_detail').post(providers.get_provider_vehicle_detail);
    app.route('/get_provider_vehicle_list').post(providers.get_provider_vehicle_list);
    app.route('/change_current_vehicle').post(providers.change_current_vehicle);
    app.route('/provider_update_vehicle_detail').post(providers.provider_update_vehicle_detail);
    app.route('/get_provider_setting_detail').post(providers.get_provider_setting_detail);
    app.route('/delete_provider').post(providers.delete_provider);
    app.route('/get_provider_list_for_dispatcher').post(providers.get_provider_list_for_dispatcher);
    app.route('/get_trip_detail_for_provider').post(providers.get_trip_detail_for_provider);
    app.route('/accept_reject_dispatcher_schedule_trip').post(providers.accept_reject_dispatcher_schedule_trip)
    app.route('/get_pending_schedule_trip').post(providers.get_pending_schedule_trip)
    app.route('/get_language_list').get(setting.get_language_list);

    // Hub
    app.route('/get_provider_hub_list').post(providers.get_provider_hub_list);
    app.route('/get_provider_hub_vehicle_list').post(providers.get_provider_hub_vehicle_list);
    app.route('/provider_pick_hub_vehicle').post(providers.provider_pick_hub_vehicle);
    app.route('/provider_drop_hub_vehicle').post(providers.provider_drop_hub_vehicle);

    //car Rent
    app.route('/get_car_rent_setting_detail').post(providers.get_car_rent_setting_detail);
    app.route('/get_car_rent_brand_list').post(providers.get_car_rent_brand_list);
    app.route('/get_car_rent_model_list').post(providers.get_car_rent_model_list);
    app.route('/get_car_rent_specification_feature_list').post(providers.get_car_rent_specification_feature_list);
    app.route('/provider_add_rent_vehicle').post(providers.provider_add_rent_vehicle);
    app.route('/provider_update_rent_vehicle').post(providers.provider_update_rent_vehicle);
    app.route('/provider_delete_rent_vehicle').post(providers.provider_delete_rent_vehicle);
    app.route('/rent_vehicle_list').post(providers.rent_vehicle_list);
    app.route('/get_rent_vehicle_availability').post(providers.get_rent_vehicle_availability);
    app.route('/add_rent_vehicle_availability').post(providers.add_rent_vehicle_availability);
    app.route('/provider_get_rent_vehicle_detail').post(providers.provider_get_rent_vehicle_detail);
    app.route('/delete_rent_vehicle_availability').post(providers.delete_rent_vehicle_availability);
    app.route('/update_rent_delivery_info').post(providers.update_rent_delivery_info);
};