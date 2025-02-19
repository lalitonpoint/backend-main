let partner = require('../controller/partner');
let setting = require('../../admin/controller/settings')

let router = require("express").Router()

router.route('/login').post(partner.partner_login)
router.route('/partner_sign_out').post(partner.partner_sign_out)
router.route('/forgot_password').post(partner.partner_forgot_password)
router.route('/update_password').post(partner.partner_update_password)

// router.route('/partner_url_list').get(partner.partner_url_list)
// router.route('/partner_list').get(partner.partner_list)

router.route('/register').post(partner.add_new_partner)
router.route('/update_partner_details').post(partner.update_partner_details)
router.route('/delete_partner').post(partner.delete_partner)
router.route('/get_partner_details').post(partner.get_partner_details)

router.route('/add_bank_details').post(partner.add_bank_details)
router.route('/get_bank_details').post(partner.get_bank_details)
router.route('/delete_bank_details').post(partner.delete_banke_details)

router.route('/wallet_history').post(partner.wallet_history)
router.route("/add_wallet_amount").post(partner.add_wallet_amount)
router.route("/earning_details").post(partner.earning_details)
router.route("/partner_earning_details").post(partner.partner_earning_details)

router.route('/complete_request').get(partner.complete_request)
router.route('/request_details').post(partner.request_details)
router.route("/statement_earning").post(partner.statement_earning)

router.route("/pranter_document_update").post(partner.pranter_document_update)
router.route('/get_language_list').get(setting.get_language_list)

module.exports = router