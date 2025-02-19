let router = require('express').Router()
let hotel = require('../controller/hotel')
let setting = require('../../admin/controller/settings')

router.route('/login').post(hotel.login)
router.route('/sign_out').post(hotel.sign_out)
router.route('/forgot_password').post(hotel.forgot_password)
router.route('/update_password').post(hotel.update_password)
router.route('/delete').post(hotel.delete)
router.route('/get_user_setting_detail').post(hotel.get_user_setting_details)
router.route('/get_language_list').get(setting.get_language_list)
router.route('/get_country_code').post(hotel.get_country_code)

module.exports = router