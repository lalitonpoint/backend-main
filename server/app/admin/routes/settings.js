let router = require('express').Router()
let setting = require('../controller/settings')

router.route('/get_setting_details').post(setting.get_setting_details)
router.route('/update_setting_details').post(setting.update_setting_details)
router.route('/upload_logo_images').post(setting.upload_logo_images)
router.route('/get_email_title').get(setting.get_email_title)
router.route('/fetch_email_detail').post(setting.fetch_email_detail)
router.route('/update_email_detail').post(setting.update_email_detail)
router.route('/fetch_sms_details').post(setting.fetch_sms_details)
router.route('/update_sms_details').post(setting.update_sms_details)
router.route('/get_guest_token').get(setting.get_guest_token)
router.route('/get_language_list').get(setting.get_language_list)
router.route('/add_new_language').post(setting.add_new_language)
router.route('/edit_language').post(setting.edit_language)
router.route('/delete_language').post(setting.delete_language)
router.route('/uplodad_user_panel_images').post(setting.uplodad_user_panel_images)
router.route('/add_cancellation_reason').post(setting.add_cancellation_reason)
router.route('/update_cancellation_reason').post(setting.update_cancellation_reason)
router.route('/get_cancellation_reason').post(setting.get_cancellation_reason)
router.route('/delete_cancellation_reason').post(setting.delete_cancellation_reason)
router.route('/get_change_logs').post(setting.get_change_logs)

router.route('/get_mongoose_models').post(setting.get_mongoose_models)
router.route('/add_string').post(setting.add_string)

router.route('/fetch_guest_tokens_list').post(setting.fetch_guest_tokens_list)
router.route('/add_update_guest_token_new').post(setting.add_update_guest_token_new);
router.route('/get_admin_setting_detail').get(setting.get_admin_setting_detail);

module.exports = router