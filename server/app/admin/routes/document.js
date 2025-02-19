let router = require('express').Router()
let document = require('../controller/document')

router.route('/get_document_list').get(document.get_document_list)
router.route('/add_document_details').post(document.add_document_details)
router.route('/update_document_details').post(document.update_document_details)

module.exports = router