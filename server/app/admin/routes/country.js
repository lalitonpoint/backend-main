let admin = require('../controller/country');
let router = require('express').Router()

router.route('/get_country_json_list').get(admin.get_country_json_list);
router.route('/get_country_timezone').get(admin.get_country_timezone)
router.route('/fetch_country_timezone').post(admin.fetch_country_timezone);
router.route('/fetch_country_details').get(admin.fetch_country_details)
router.route('/add_country_details').post(admin.add_country_details)
router.route('/update_country_details').post(admin.update_country_details)
router.route('/check_country_exists').post(admin.check_country_exists)
router.route('/get_country_code').post(admin.get_country_code)

module.exports = router