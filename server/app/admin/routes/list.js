let router = require('express').Router()
let list = require('../controller/list')

router.route('/fetch_type_list').get(list.fetch_type_list)
router.route('/fetch_type_details').post(list.fetch_type_details)
router.route('/fetch_document_list').post(list.fetch_document_list)
router.route('/fetch_referral_list').post(list.fetch_referral_list)
router.route('/fetch_service_type').post(list.fetch_service_type)
router.route('/reviews_list').post(list.reviews_list)
router.route('/update_type_details').post(list.update_type_details)
router.route('/delete_type_details').post(list.delete_type_details)
router.route('/type_update_document').post(list.type_update_document)
router.route('/type_update_vehicle').post(list.type_update_vehicle)
router.route('/type_is_approved').post(list.type_is_approved)
router.route('/unfreeze_provider').post(list.unfreeze_provider)
router.route('/add_wallet_amount').post(list.add_wallet_amount)
router.route('/add_new_type').post(list.add_new_type)
router.route('/add_provider_vehicle').post(list.add_provider_vehicle)
router.route('/referral_list').get(list.referral_list)
router.route('/referral_details').post(list.referral_details)
router.route('/is_document_uploaded').post(list.is_document_uploaded)

// Vehicle
router.route('/get_admin_vehicles').get(list.get_admin_vehicles)
router.route('/add_admin_vehicle').post(list.add_admin_vehicle)
router.route('/fetch_vehicle_admin_types').get(list.fetch_vehicle_admin_types)
router.route('/fetch_admin_vehicles').post(list.fetch_admin_vehicles)
router.route('/assign_unassign_vehicle_to_hub').post(list.assign_unassign_vehicle_to_hub)
router.route('/fetch_service_type_for_hub').post(list.fetch_service_type_for_hub)
router.route('/add_edit_vehicle_model_brand').post(list.add_edit_vehicle_model_brand)
router.route('/get_vehicle_brand_model').post(list.get_vehicle_brand_model)
router.route('/get_vehicle_history').post(list.get_vehicle_history)

// Provider
router.route('/admin_add_provider').post(list.admin_add_provider)
router.route('/get_hub_providers').post(list.get_hub_providers)
router.route('/get_hub_users').post(list.get_hub_users)

// Hub
router.route('/add_hub_user').post(list.add_hub_user)
router.route('/update_hub_user').post(list.update_hub_user)
router.route('/delete_hub_user').post(list.delete_hub_user)
router.route('/get_all_hub_list').post(list.get_all_hub_list)
router.route('/get_hub_list').post(list.get_hub_list)

// Wsal
router.route('/check_wsal_status').post(list.check_wsal_status);

// Rent Car
router.route('/fetch_rent_car_owner_list').get(list.fetch_rent_car_owner_list)
router.route('/add_edit_car_rent_type').post(list.add_edit_car_rent_type)
router.route('/fetch_car_rent_type').post(list.fetch_car_rent_type)
router.route('/add_edit_car_rent_brand_model').post(list.add_edit_car_rent_brand_model)
router.route('/fetch_car_rent_brand_model').post(list.fetch_car_rent_brand_model)
router.route('/add_edit_car_rent_feature').post(list.add_edit_car_rent_feature)
router.route('/fetch_car_rent_feature').get(list.fetch_car_rent_feature)
router.route('/add_edit_car_rent_spedification').post(list.add_edit_car_rent_spedification)
router.route('/fetch_car_rent_specification').get(list.fetch_car_rent_specification)
router.route('/admin_get_rent_vehicle_list').post(list.admin_get_rent_vehicle_list)
router.route('/admin_get_rent_vehicle_detail').post(list.admin_get_rent_vehicle_detail)
router.route('/admin_approve_reject_rent_vehicle').post(list.admin_approve_reject_rent_vehicle)
router.route('/admin_approve_reject_rental_driver').post(list.admin_approve_reject_rental_driver)

module.exports = router