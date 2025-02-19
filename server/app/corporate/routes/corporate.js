let corporate = require('../controller/corporate');
let country = require('../../controllers/country');
let trip = require('../../controllers/trip');
let card = require('../../controllers/card');
let users = require('../../controllers/users');
let cityType = require('../../controllers/citytype')
let dispatcher = require('../../dispatcher/controller/dispatcher_request')
let setting = require('../../admin/controller/settings')

let router = require("express").Router()

router.route('/register').post(corporate.register)
router.route('/login').post(corporate.login)
router.route('/sign_out').post(corporate.sign_out)
router.route('/forgot_password').post(corporate.forgot_password)
router.route('/update_password').post(corporate.update_password)
router.route('/delete').post(corporate.delete)
router.route('/get_user_setting_detail').post(corporate.get_user_setting_details)

router.route('/profile').post(corporate.profile)
router.route('/edit').post(corporate.edit)

router.route('/history').post(corporate.history)
router.route('/future_request').post(corporate.future_request)

router.route('/users').post(corporate.users)
router.route('/send_request').post(corporate.send_request)
router.route('/add_limit').post(corporate.add_limit)
router.route('/remove_user').post(corporate.remove_user)

router.route('/wallet_history').post(corporate.wallet_history)
router.route('/generate_request_excel').post(corporate.generate_request_excel);

router.route('/trip_user_list').post(corporate.trip_user_list)

router.route('/get_country_city_list').post(country.get_country_city_list);



router.route('/cards').post(card.card_list);
router.route('/card_selection').post(card.card_selection);
router.route('/addcard').post(card.add_card);
router.route('/get_stripe_add_card_intent').post(card.get_stripe_add_card_intent);
router.route('/get_stripe_payment_intent').post(card.get_stripe_payment_intent);
router.route('/send_paystack_required_detail').post(card.send_paystack_required_detail);
router.route('/add_wallet_amount').post(users.add_wallet_amount);
router.route('/delete_card').post(card.delete_card); 
router.route('/pay_stripe_intent_payment').post(trip.pay_stripe_intent_payment);

router.route('/canceltrip').post(trip.trip_cancel_by_user);
router.route('/createtrip').post(trip.create);

router.route('/typelist_selectedcountrycity').post(cityType.list);

router.route('/getfareestimate').post(users.getfareestimate);

router.route('/get_server_time').post(dispatcher.get_server_time);
router.route('/typelist_for_dispatcher').post(cityType.disptcher_city_type_list);
router.route('/get_all_provider').post(dispatcher.get_all_provider);
router.route('/getnearbyprovider').post(trip.get_near_by_provider);

router.route('/dispatcher_new_request').post(dispatcher.get_new_request);
router.route('/getgooglemappath').post(trip.getgooglemappath);
router.route('/get_language_list').get(setting.get_language_list);



module.exports = router