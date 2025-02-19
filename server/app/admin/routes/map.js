let map = require('../controller/map')
let router = require('express').Router()

router.route('/provider_list_for_map').post(map.provider_list_for_map)
router.route('/fetch_provider_list').post(map.fetch_provider_list)
router.route('/fetch_provider_detail').post(map.fetch_provider_detail)
router.route('/fetch_all_city').post(map.fetch_all_city)
router.route('/fetch_vehicle_type_list').post(map.fetch_vehicle_type_list)
router.route('/fetch_heat_map').post(map.fetch_heat_map)

module.exports = router