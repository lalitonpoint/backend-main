let request = require('../controller/request')
let router = require('express').Router()

router.route('/get_trip_list').get(request.get_trip_list)
router.route('/service_type_trip_list').get(request.service_type_trip_list)
router.route('/get_trip_detail').post(request.get_trip_detail)
router.route('/trip_cancel_by_admin').post(request.trip_cancel_by_admin)
router.route('/scheduled_trip_cancel_by_admin').post(request.scheduled_trip_cancel_by_admin)
router.route('/trip_complete_by_admin').post(request.trip_complete_by_admin)
router.route('/chat_history').post(request.chat_history)
router.route('/refund_trip_amount').post(request.refund_trip_amount)
router.route('/set_trip_status_by_admin').post(request.set_trip_status_by_admin)
router.route('/trip_pay_payment').post(request.trip_pay_payment)
router.route('/send_invoice_mail').post(request.send_invoice_mail)
// for rental
router.route('/get_rental_trip_detail').post(request.get_rental_trip_detail)
router.route('/rental_trip_cancel_by_admin').post(request.rental_trip_cancel_by_admin)
router.route('/refund_rental_trip_amount').post(request.refund_rental_trip_amount)

module.exports = router