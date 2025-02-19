let export_controller = require('../controllers/earning_controller');
const express = require('express');
const router = express.Router();

router.post('/weekly_and_daily_earning',export_controller.weekly_and_daily_earning)
router.post('/trip_earning',export_controller.trip_earning)
router.post('/partner_weekly_earning',export_controller.partner_weekly_earning)
router.post('/wallet_history',export_controller.wallet_history)
router.post('/redeem_point_history',export_controller.redeem_point_history)
router.post('/transaction_history',export_controller.transaction_history)
router.post('/wallet_history_corporate',export_controller.wallet_history_in_corporate)
router.post('/get_wallet_history',export_controller.get_wallet_history)
router.post('/get_redeem_point_history',export_controller.get_redeem_point_history)
router.post('/get_web_provider_weekly_earning_detail',export_controller.get_web_provider_weekly_earning_detail)
router.post("/earning_details",export_controller.earning_details)
router.post('/openride_trip_earning',export_controller.openride_trip_earning)
router.post('/rental_trip_earning',export_controller.rental_trip_earning)

// route transfered from server
router.route('/statement_provider_trip_earning').post(export_controller.statement_provider_trip_earning)
router.route('/statement_provider_daily_and_weekly_earning').post(export_controller.statement_provider_daily_and_weekly_earning)
router.route('/partner_weekly_earning_statement').post(export_controller.partner_weekly_earning_statement)

module.exports = router;

