let admin = require('../controller/admin');
let router = require("express").Router();

//for auth and permission
router.route('/login').post(admin.login)
router.route('/forgot_password').post(admin.forgot_password)
router.route('/update_password').post(admin.update_password)
router.route('/sign_out').post(admin.sign_out)
router.route('/url_list').get(admin.url_list)
router.route('/list').get(admin.list)
router.route('/add_new_admin').post(admin.add_new_admin)
router.route('/update_admin_details').post(admin.update_admin_details)
router.route('/delete_admin').post(admin.delete_admin)
router.route('/get_permissions').post(admin.get_permissions)
router.route('/get_details_country_city_wise').post(admin.get_details_country_city_wise)

//for dashboard
router.route('/dashboard_detail').post(admin.dashboard_detail)
router.route('/get_six_month_earning').post(admin.get_six_month_earning)
router.route('/get_six_month_trip').post(admin.get_six_month_trip)

//for notification
router.route('/add_new_admin_details').post(admin.add_new_admin_details)
router.route('/get_admin_notifications').post(admin.get_admin_notifications)
router.route('/remove_notification').post(admin.remove_notification)

//for subscriptions
router.route('/check_subscription').post(admin.check_subscription)
router.route('/create_subscription_session').post(admin.create_subscription_session)
router.route('/subscription_webhook').post(admin.webhook)

module.exports = router