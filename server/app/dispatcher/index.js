let router = require('express').Router() 

//dispatcher details
router.use('',require('./router/dispatcher'))

// dispatcher request and history
router.use('',require('./router/dispatcher_request'))

module.exports = router