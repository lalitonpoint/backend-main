let router = require('express').Router()
let hub = require('../controller/hub')
let setting = require('../../admin/controller/settings')
let list = require('../../admin/controller/list')

router.route('/login').post(hub.login)
router.route('/sign_out').post(hub.sign_out)

router.route('/update_password').post(hub.update_password)

router.route('/get_user_setting_detail').post(hub.get_user_setting_details)

router.route('/get_language_list').get(setting.get_language_list)
router.route('/get_hub_vehicle_list').post(list.fetch_admin_vehicles)

router.route('/hub_provider_list').post(list.get_hub_providers);
router.route('/get_hub_vehicle_history').post(list.get_vehicle_history);

module.exports = router