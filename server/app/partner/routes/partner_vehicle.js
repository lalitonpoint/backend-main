let partner_vehicle = require('../controller/partner_vehicle');
let list = require('../../admin/controller/list')

let router = require("express").Router()

router.route('/create_partner_vehicle').post(partner_vehicle.create_partner_vehicle);
router.route('/update_vehicle_details').post(partner_vehicle.update_vehicle_details);
router.route('/get_partner_vehicle').post(partner_vehicle.get_partner_vehicle);

router.route('/vehicle_document_list_for_partner').post(partner_vehicle.vehicle_document_list_for_partner);
router.route('/vehicle_documents_update_for_partner').post(partner_vehicle.vehicle_documents_update_for_partner);


router.route('/assign_vehicle_to_provider').post(partner_vehicle.assign_vehicle_to_provider);
router.route('/remove_vehicle_from_provider').post(partner_vehicle.remove_vehicle_from_provider);

router.route('/get_available_vehicle_list').post(partner_vehicle.get_available_vehicle_list)

router.route('/partner_fetch_service_type').post(partner_vehicle.partner_fetch_service_type)

router.route('/fetch_service_types').post(partner_vehicle.fetch_service_types)


module.exports = router