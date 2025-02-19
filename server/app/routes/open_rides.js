let openrides = require('../../app/controllers/open_rides'); // include trip controller ////

module.exports = function (app) {
    app.route('/create_open_ride').post(openrides.create_open_ride)
    app.route('/get_open_ride_users_detail').post(openrides.get_open_ride_users_list)
    app.route('/get_list_of_created_open_ride').post(openrides.get_list_of_created_open_ride)
    app.route('/open_ride_list_for_user').post(openrides.open_ride_list_for_user)
    app.route('/user_book_ride').post(openrides.user_book_ride)
    app.route('/cancel_ride').post(openrides.cancel_ride_by_user)
    app.route('/provider_accept_reject_cancel_ride').post(openrides.provider_accept_reject_cancel_ride)
    app.route('/provider_cancel_ride').post(openrides.provider_cancel_ride)

    app.route('/openridesettripstatus').post(openrides.openride_provider_set_trip_status);
    app.route('/openridecompletetrip').post(openrides.openride_provider_complete_trip);
    app.route('/openride_pay_payment').post(openrides.openride_pay_payment);

    app.route('/get_open_ride_provider_daily_earning_detail').post(openrides.get_open_ride_provider_daily_earning_detail);
    app.route('/get_open_ride_provider_weekly_earning_detail').post(openrides.get_open_ride_provider_weekly_earning_detail);

    
}