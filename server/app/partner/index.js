let router = require('express').Router() 

//partner router
router.use('',require('./routes/partner'))

//partner provider router
router.use('',require('./routes/partner_provider'))

// partner vehicle
router.use('',require('./routes/partner_vehicle'))

module.exports = router