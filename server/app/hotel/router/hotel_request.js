let router = require('express').Router()
let hotel_request = require('../controller/hotel_request')

// trip api
router.route('/create_trip_details').post(hotel_request.details)
router.route('/search_hotel_user').post(hotel_request.search_hotel_user)
router.route('/select_city_service').post(hotel_request.select_city_service)
router.route('/check_user').post(hotel_request.check_user)
router.route('/getfareestimate').post(hotel_request.getfareestimate)
router.route('/get_near_by_provider').post(hotel_request.getnearbyprovider)
router.route('/get_server_time').post(hotel_request.get_server_time)
router.route('/canceltrip').post(hotel_request.canceltrip)
router.route('/createtrip').post(hotel_request.create)
router.route('/send_request').post(hotel_request.send_request)
router.route('/getgooglemappath').post(hotel_request.getgooglemappath)

// map
router.route('/service_list').post(hotel_request.service_list)
router.route('/get_new_request').post(hotel_request.get_new_request)

// set trip status
router.route('/set_trip_status_by_hotel').post(hotel_request.set_trip_status_by_hotel)
router.route('/trip_complete_by_hotel').post(hotel_request.trip_complete_by_hotel)
router.route('/trip_payment_by_hotel').post(hotel_request.trip_payment_by_hotel)


module.exports = router