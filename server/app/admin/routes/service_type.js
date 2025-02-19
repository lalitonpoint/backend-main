let admin = require('../controller/service_type');
let router = require('express').Router()

router.route('/get_type_list').get(admin.service_type_list)
router.route('/add_service_type').post(admin.add_service_type)
router.route('/edit_service_type').post(admin.edit_service_type)

module.exports =  router

