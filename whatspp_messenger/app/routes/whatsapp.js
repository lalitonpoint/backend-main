let whatsapp = require('../controllers/whatsapp');
const express = require('express');
const router = express.Router();

//paystack
router.post('/send_message', whatsapp.send_message);
router.post('/logout', whatsapp.logout);
router.post('/delete_chat', whatsapp.delete_chat);

module.exports = router;
