let partner_provider = require('../controller/partner_provider');
let list = require('../../admin/controller/list')

let router = require("express").Router()

router.route('/partner_provider_list').get(list.fetch_type_list);
router.route('/create_partner_provider').post(partner_provider.create_partner_provider);

router.route('/get_provider_details').post(partner_provider.get_provider_details);

router.route('/update_provider_details').post(partner_provider.update_provider_details);
router.route('/delete_provider_details').post(partner_provider.delete_provider_details)

router.route('/partner_provider_documents_list').post(partner_provider.partner_provider_documents_list);
router.route('/partner_provider_documents_update').post(partner_provider.partner_provider_documents_update);

router.route('/partner_documents_list').post(partner_provider.partner_documents_list);


module.exports = router