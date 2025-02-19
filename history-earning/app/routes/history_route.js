let export_controller = require('../controllers/history_controller.js');
const express = require('express');
const router = express.Router();

router.get('/get_trip_list', export_controller.get_trip_list);
router.post('/get_export_history_list', export_controller.get_export_history_list);
router.post('/delete_export_file', export_controller.delete_export_file);
router.post('/userhistory',export_controller.user_history);
router.post('/getfuturetrip',export_controller.getfuturetrip);
router.post('/providerhistory',export_controller.provider_history);
router.get('/complete_request',export_controller.complete_request);
router.post('/history',export_controller.history_in_corporate)
router.post('/future_request',export_controller.future_request_in_corporate)
router.get('/service_type_trip_list',export_controller.service_type_trip_list)
router.get('/get_trip_report',export_controller.get_trip_report)
// open ride apis
router.post('/openrideuserhistory',export_controller.openride_user_history);
router.post('/openrideproviderhistory',export_controller.openrideproviderhistory);
router.get('/openride_get_trip_list', export_controller.openride_get_trip_list);
router.get('/openride_get_trip_report', export_controller.openride_get_trip_report);
//rental trip apis
router.get('/get_rental_trip_list', export_controller.get_rental_trip_list);
router.get('/get_rental_trip_report',export_controller.get_rental_trip_report);

module.exports = router;

