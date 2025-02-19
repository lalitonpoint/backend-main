let router = require('express').Router()
let dispatcher_request = require('../controller/dispatcher_request')

// trip api
router.route('/create_trip_details').post(dispatcher_request.details)
router.route('/search_dispatcher_user').post(dispatcher_request.search_dispatcher_user)
router.route('/select_city_service').post(dispatcher_request.select_city_service)
router.route('/check_user').post(dispatcher_request.check_user)
router.route('/getfareestimate').post(dispatcher_request.getfareestimate)
router.route('/get_near_by_provider').post(dispatcher_request.getnearbyprovider)
router.route('/get_server_time').post(dispatcher_request.get_server_time)
router.route('/canceltrip').post(dispatcher_request.canceltrip)
router.route('/createtrip').post(dispatcher_request.create)
router.route('/send_request').post(dispatcher_request.send_request)
router.route('/getgooglemappath').post(dispatcher_request.getgooglemappath)
router.route('/assign_trip_to_provider').post(dispatcher_request.assign_trip_to_provider)
// map
router.route('/service_list').post(dispatcher_request.service_list)
router.route('/get_new_request').post(dispatcher_request.get_new_request)
router.route("/get_all_provider").post(dispatcher_request.get_all_provider)

// history data
router.route('/history').post(dispatcher_request.history)
router.route('/history_excel').post(dispatcher_request.history_excel)
router.route('/future').post(dispatcher_request.future_request)
router.route('/future_excel').post(dispatcher_request.future_excel)

// set trip status
router.route('/set_trip_status_by_dispatcher').post(dispatcher_request.set_trip_status_by_dispatcher)
router.route('/trip_complete_by_dispatcher').post(dispatcher_request.trip_complete_by_dispatcher)
router.route('/trip_payment_by_dispatcher').post(dispatcher_request.trip_payment_by_dispatcher)

module.exports = router