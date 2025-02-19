let payments = require('../controllers/payments_controller');
const express = require('express');
const router = express.Router();

//paystack
router.get('/fail_payment', payments.fail_payment);
router.post('/fail_payment', payments.fail_payment);
router.get('/payment_fail', payments.fail_payment);
router.get('/success_payment', payments.success_payment);
router.post('/success_payment', payments.success_payment);
router.get('/paystack_add_card_callback', payments.paystack_add_card_callback);
router.post('/send_paystack_required_detail', payments.send_paystack_required_detail);


// payment intent
router.post('/get_stripe_payment_intent', payments.get_stripe_payment_intent);
router.post('/retrieve_payment_intent', payments.retrieve_payment_intent);
router.post('/create_payment_intent', payments.create_payment_intent);

router.get('/paytabs_add_card_callback', payments.paytabs_add_card_callback);
router.get('/paytabs_add_wallet_callback', payments.paytabs_add_wallet_callback);

// refund and transfer
router.post('/create_refund', payments.create_refund);
router.post('/create_transfer', payments.create_transfer);


// card operations
router.post('/get_stripe_add_card_intent', payments.get_stripe_add_card_intent);
router.post('/addcard', payments.add_card);
router.post('/cards', payments.card_list);
router.post('/delete_card', payments.delete_card);
router.post('/card_selection', payments.card_selection);


// change payment gateway type
router.post('/change_payment_gateway_type',payments.change_payment_gateway_type);

//Bank account
router.post('/create_bank_account', payments.create_bank_account);
router.post('/paypal_supported_currency', payments.paypal_supported_currency);


module.exports = router;
