let openrides = require('../controller/open_ride')
let router = require('express').Router()

router.route('/openride_get_trip_detail').post(openrides.openride_get_trip_detail)
router.route('/scheduled_open_ride_cancel_by_admin').post(openrides.scheduled_open_ride_cancel_by_admin)
router.route('/open_ride_cancel_by_admin').post(openrides.open_ride_cancel_by_admin)
router.route('/open_ride_statement_provider_trip_earning').post(openrides.open_ride_statement_provider_trip_earning)

module.exports = router