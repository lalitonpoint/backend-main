let router = require('express').Router()
let price = require('../controller/price')

router.route('/fetch_service_price').post(price.fetch_service_price)
router.route('/fetch_unique_types').post(price.fetch_unique_types)
router.route('/add_service_price').post(price.add_service_price)
router.route('/update_surge_hour').post(price.update_surge_hour)
router.route('/fetch_zone_price').post(price.fetch_zone_price)
router.route('/fetch_airport_price').post(price.fetch_airport_price)
router.route('/fetch_city_price').post(price.fetch_city_price)
router.route('/fetch_car_rental').post(price.fetch_car_rental)
router.route('/fetch_rich_surge').post(price.fetch_rich_surge)
router.route('/update_service_price').post(price.update_service_price)
router.route('/check_zone_price_exist').post(price.check_zone_price_exist)
router.route('/add_zone_queue').post(price.add_zone_queue)
router.route('/get_zone_provider_list').post(price.get_zone_provider_list)

module.exports = router