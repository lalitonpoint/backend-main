let mass_notification = require('../controllers/mass_notification_controller');
const express = require('express');
const router = express.Router();

router.post('/fetch_notification_list', mass_notification.fetch_notification_list);
router.post('/send_mass_notification', mass_notification.send_mass_notification);

module.exports = router;
