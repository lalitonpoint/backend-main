let router = require('express').Router()
let dispatcher = require('../controller/dispatcher')
let setting = require('../../admin/controller/settings')

router.route('/login').post(dispatcher.login)
router.route('/sign_out').post(dispatcher.sign_out)
router.route('/forgot_password').post(dispatcher.forgot_password)
router.route('/update_password').post(dispatcher.update_password)
router.route('/delete').post(dispatcher.delete)
router.route('/get_user_setting_detail').post(dispatcher.get_user_setting_details)
router.route('/get_language_list').get(setting.get_language_list)
router.route('/get_country_code').post(dispatcher.get_country_code)

module.exports = router