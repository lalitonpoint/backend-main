let router = require('express').Router()
let city = require('../controller/city')

router.route('/fetch_city_list').post(city.fetch_city_list)
router.route('/fetch_destination_city').post(city.fetch_destination_city)
router.route('/check_city_avaliable').post(city.check_city_avaliable)
router.route('/add_city_details').post(city.add_city_details)
router.route('/update_city_details').post(city.update_city_details)

router.route('/fetch_airport_details').post(city.fetch_airport_details)
router.route('/update_airport_details').post(city.update_airport_details)

router.route('/fetch_cityzone_details').post(city.fetch_cityzone_details)
router.route('/update_zone_details').post(city.update_zone_details)
router.route('/fetch_redzone_details').post(city.fetch_redzone_details)
router.route('/update_redzone_details').post(city.update_redzone_details)

module.exports = router