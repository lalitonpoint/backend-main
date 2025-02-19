let router = require('express').Router() 

//hotel details
router.use('',require('./router/hotel'))

// hotel request and history
router.use('',require('./router/hotel_request'))

module.exports = router