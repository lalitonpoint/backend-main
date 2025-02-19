
let router = require('express').Router()

// service router
router.use('', require('./routes/admin'))
router.use('', require('./routes/service_type'))
router.use('', require('./routes/country'))
router.use('', require('./routes/city'))
router.use('', require('./routes/price'))

// setting router
router.use('', require('./routes/settings'))
router.use('', require('./routes/promo_code'))
router.use('', require('./routes/document'))

// list router
router.use('', require('./routes/list'))

// request router
router.use('', require('./routes/request'))

//map_view router
router.use('', require('./routes/map'))

//open ride router
router.use('', require('./routes/open_ride'))

module.exports = router