let Trip_history = require('mongoose').model('Trip_history');
let utils = require('./utils');
let Card = require('mongoose').model('Card');
let User = require('mongoose').model('User');
let Trip = require('mongoose').model('Trip');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let Provider = require('mongoose').model('Provider');
let Corporate = require('mongoose').model('Corporate');
let Partner = require('mongoose').model('Partner');
let Users = require('./users');
const https = require('https')
let Settings = require('mongoose').model('Settings');
const axios = require('axios');
const {
    PAYMENT_GATEWAY,
    IS_ADD_CARD,
    PAYMENT_STATUS,
    PROVIDER_TYPE,
} = require('./constant');
//// ADD CARD USING POST SERVICE ///// 

exports.paystack_add_card_callback = async function (req, res_data) {
    let setting_detail = await Settings.findOne({})
    const https = require('https')
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/verify/'+req.query.reference,
      method: 'GET',
      headers: {
        Authorization: 'Bearer '+setting_detail.paystack_secret_key
      }
    }
    let request = https.request(options, res => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      });
      res.on('end', () => {
        let response = JSON.parse(data)
        if(response.status && response.data.status=='success'){

            exports.refund_payment(response.data.reference, PAYMENT_GATEWAY.paystack)

            let type = Number(req.query.type);
            let redirect_url = '';
            let Table
            switch (type) {
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                Table = Provider;
                redirect_url = '/provider_payments';
                break;
                case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
                type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
                Table = Corporate;
                redirect_url = '/corporate_payments';
                break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                Table = Partner;
                redirect_url = '/partner_payments';
                break;
                default:
                type = Number(constant_json.USER_UNIQUE_NUMBER);
                Table = User;
                redirect_url = '/payments';
                break;
            }

            Table.findOne({_id: req.query.user_id}).then(() => { 
                let card = new Card({
                    user_id: req.query.user_id,
                    last_four: response.data.authorization.last4,
                    payment_method: response.data.authorization.authorization_code,
                    card_type: response.data.authorization.card_type,
                    customer_id: response.data.customer.id,
                    type: type,
                    payment_gateway_type: PAYMENT_GATEWAY.paystack,
                    is_default: constant_json.YES
                });
                
                Card.find({user_id: card.user_id,payment_gateway_type: PAYMENT_GATEWAY.paystack, $or :  [{type: card.type}, { type: {$exists: false} }]}).then((card_data) => { 
                    if (card_data.length > 0) {
                        Card.findOneAndUpdate({user_id: req.query.user_id,payment_gateway_type: PAYMENT_GATEWAY.paystack, $or :  [{type: type}, { type: {$exists: false} }], is_default: constant_json.YES}, {is_default: constant_json.NO}).then(() => { 

                        });
                    }
                    if(req.query.is_web=='false'){
                        req.query.is_web = false;
                    } else {
                        req.query.is_web = true;
                    }
                    card.save().then(() => { 
                        if( req.query.is_new != 'false'){
                            res_data.redirect(req.query.is_new)
                            return
                        }
                        if(req.query.is_web){
                            //for ejs Code global.message = admin_messages.success_message_add_card;
                            res_data.redirect(redirect_url);
                        } else {
                            res_data.redirect('/add_card_success');
                        }
                        
                    });
                });
            });
        } else {
            res_data.json({success: false, error_message: response.message})
        }
      })
    }).on('error', error => {
      console.error(error)
    })
    request.end()
        
}

exports.refund_payment = async function (reference, payment_gateway_type) {
    let setting_detail = await Settings.findOne({})
    if (!payment_gateway_type || payment_gateway_type == PAYMENT_GATEWAY.stripe) {
        try {
            let stripe = require("stripe")(setting_detail.stripe_secret_key);
            stripe.setApiVersion('2020-08-27');
            stripe.refunds.create({ payment_intent: reference }, function (err) {
                if (err) {
                    console.error(err);
                }
            });
        } catch (error) {
            console.error(error);
        }
    } else if (payment_gateway_type == PAYMENT_GATEWAY.paystack) {
        try {
            const params = JSON.stringify({
                "transaction": reference
            })
            const options = {
                hostname: 'api.paystack.co',
                port: 443,
                path: '/refund',
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + setting_detail.paystack_secret_key,
                    'Content-Type': 'application/json'
                }
            }
            const req = https.request(options, res => {
                let data = ''
                res.on('data', (chunk) => {
                    data += chunk
                });
                res.on('end', () => {
                    console.log(JSON.parse(data))
                })
            }).on('error', error => {
                console.error(error)
            })
            req.write(params)
            req.end()
        } catch (error) {
            console.error(error);
        }
    } else if (payment_gateway_type == PAYMENT_GATEWAY.payu) {
        try {
            const request = require('request');
            const options = {
                method: 'POST',
                url: 'https://secure.payu.com/pl/standard/user/oauth/authorize',
                form: {
                    'grant_type': 'client_credentials',
                    'client_id': '145227',
                    'client_secret': '12f071174cb7eb79d4aac5bc2f07563f'
                }
            };
            request(options, function (error, response) {
                if (error) throw new Error(error);
                const res = JSON.parse(response.body)
                const params = JSON.stringify({ "refund": { "description": "Refund" } });
                const options = {
                    hostname: 'secure.payu.com',
                    port: 443,
                    path: '/api/v2_1/orders/' + reference + '/refunds',
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + res.access_token,
                        'Content-Type': 'application/json',
                    },
                    maxRedirects: 20
                }
                const req = https.request(options, res => {
                    let data = ''
                    res.on('data', (chunk) => {
                        data += chunk
                    });
                    res.on('end', () => {
                        console.log(JSON.parse(data))
                    })
                }).on('error', error => {
                    console.error(error)
                })
                req.write(params)
                req.end()
            });
        } catch (error) {
            console.error(error);
        }
    } else if( payment_gateway_type == PAYMENT_GATEWAY.paytabs ){
        try {
            const url = 'https://secure-global.paytabs.com/payment/request';

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': setting_detail.paytabs_server_key 
            };
            const body = {
                "profile_id":setting_detail.paytabs_profileId,
                "tran_type":"refund",
                "tran_class":"ecom",
                "cart_description": "Test Description",
                "cart_id": reference.trip_id.toString(),
                "cart_currency":reference.currency_code.toString(),
                "cart_amount":reference.amount,
                "tran_ref": reference.tra_id.toString()
            }
            let res_data = await axios.post(url, body, { headers })
            if(res_data.data){
                console.log(res_data.data);
            }

        } catch (error) {
            console.error(error);
        }
    }
}

exports.get_stripe_add_card_intent = async function (req, res_data) {
    let setting_detail = await Settings.findOne({})
    if(!req.body.payment_gateway_type || req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe){
        let stripe = require("stripe")(setting_detail.stripe_secret_key);
        stripe.setApiVersion('2020-08-27');
        stripe.setupIntents.create({
            usage: 'on_session'
        }, function(error, paymentIntent){
            res_data.json({success: true, client_secret: paymentIntent.client_secret})
        });
    } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paystack){
        let type = Number(req.body.type);
        if(!req.body.is_web){
            req.body.is_web = false;
        }
        if( !req.body.is_new){
            req.body.is_new = false;
        }
        let is_web = req.body.is_web 
        let Table;
        switch (type) {
            case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
            Table = Provider;
            break;
            case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
            Table = Corporate;
            break;
            case Number(constant_json.PARTNER_UNIQUE_NUMBER):
            Table = Partner;
            break;
            default:
            Table = User;
            break;
        }
        Table.findOne({_id: req.body.user_id}).then((detail) => { 
            if(detail){
                const params = JSON.stringify({
                  "email": detail.email,
                  "phone": detail.country_phone_code + detail.phone,
                  "amount": "100",
                  callback_url: req.protocol + '://' + req.get('host') + "/paystack_add_card_callback?user_id="+req.body.user_id+'&&type='+type+'&&is_web='+is_web+'&&is_new='+req.body.is_new
                })
                const options = {
                  hostname: 'api.paystack.co',
                  port: 443,
                  path: '/transaction/initialize',
                  method: 'POST',
                  headers: {
                    Authorization: 'Bearer '+setting_detail.paystack_secret_key,
                    'Content-Type': 'application/json'
                  }
                }
                const request= https.request(options, res => {
                  let data = ''
                  res.on('data', (chunk) => {
                    data += chunk
                  });
                  res.on('end', () => {
                    let response = JSON.parse(data)
                    if(response.status && response.data){
                        res_data.json({success: true, authorization_url: response.data.authorization_url, access_code: response.data.access_code })
                    } else {
                        res_data.json({success: false, error_message: response.message})
                    }
                  })
                }).on('error', error => {
                  console.error(error)
                })
                request.write(params)
                request.end()
            } else {
                res_data.json({success: false, error_code: error_message.ERROR_CODE_FOR_PORBLEM_IN_FETCHIN_CARD}); // 
            }
        });

    } else {
        res_data.json({success: false});
    }
}

exports.send_paystack_required_detail = async function (req, res) {
    let setting_detail = await Settings.findOne({})
    let body_params = {
        "reference": req.body.reference
    }
    let is_main_user = true;
    let split_payment_index = null;

    let url = ''
    switch(req.body.required_param){
        case 'send_otp': 
            body_params.otp = req.body.otp;
            url = '/charge/submit_otp'
            break;
        case 'send_phone': 
            body_params.phone = req.body.phone;
            url = '/charge/submit_phone'
            break;
        case 'send_birthday': 
            body_params.birthday = req.body.birthday;
            url = '/charge/submit_birthday'
            break;
        case 'send_address': 
            body_params.address = req.body.address;
            url = '/charge/submit_address'
            break;
        case 'default':
            body_params.pin = req.body.pin;
            url = '/charge/submit_pin'
            break;
    }

    const params = JSON.stringify(body_params)
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: url,
      method: 'POST',
      headers: {
        Authorization: 'Bearer '+setting_detail.paystack_secret_key,
        'Content-Type': 'application/json'
      }
    }
    const request = https.request(options, response => {
      let data = ''
      response.on('data', (chunk) => {
        data += chunk
      });
      response.on('end', () => {
        let payment_response = JSON.parse(data);
        if(payment_response.status){
            if(!req.body.trip_id){
                if(payment_response.data.status == 'success'){
                    req.body.paystack_data = payment_response.data;
                    Users.add_wallet_amount(req, res)
                } else if(payment_response.data.status == 'open_url'){
                    let json_response = {success: false, error_message: 'Please Try Another Card', url: payment_response.data.url}
                    res.json(json_response)
                } else {
                    let json_response = {success: false, reference: payment_response.data.reference, required_param: payment_response.data.status}
                    json_response[payment_response.data.status] = true;
                    res.json(json_response)
                }
            } else {

                Trip.findOne({ _id: req.body.trip_id}).then((trip) => {
                    Trip_history.findOne({ _id: req.body.trip_id}).then((trip_history) => {
                        if (!trip) {
                            trip = trip_history;
                        }
                        if (trip) {
                            trip.split_payment_users.forEach((split_payment_user_detail, index)=>{
                                if(split_payment_user_detail.user_id.toString()==trip.user_id.toString()){
                                    is_main_user = false;
                                    split_payment_index = index;
                                }
                            })
                            if(!req.body.is_payment_for_tip){
                                if(payment_response.data.status == 'success'){
                                    utils.update_request_status_socket(trip._id);
                                    if(is_main_user){
                                        trip.payment_status = PAYMENT_STATUS.COMPLETED;
                                        trip.remaining_payment = 0;
                                        trip.is_paid = 1;
                                        trip.is_pending_payments = 0;
                                        trip.card_payment = payment_response.data.amount / 100;
                                    } else {
                                        trip.split_payment_users[split_payment_index].card_payment = payment_response.data.amount / 100;
                                        trip.split_payment_users[split_payment_index].remaining_payment = 0;
                                        trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                        trip.card_payment = trip.card_payment + (payment_response.data.amount / 100);
                                    }
                                    if (trip.is_trip_cancelled == 1) {
                                        User.findOne({ _id: trip.user_id }).then((user) => {
                                            user.current_trip_id = null;
                                            user.save();
                                        });
                                    }
                                    trip.markModified('split_payment_users');
                                    trip.save().then(() => {
                                        User.findOne({ _id: trip.user_id }, function (error, user) {
                                            user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                            user.save();
                                        })
                                        if (trip.payment_status == PAYMENT_STATUS.COMPLETED) {
                                            Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                                if (deleted_trip) {
                                                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                    trip_history_data.save(function () {
                                                        res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                                    });
                                                } else {
                                                    res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                                }
                                            });
                                        } else {
                                            res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                        }
                                    });
                                } else if(payment_response.data.status == 'open_url'){
                                    let json_response = {success: false, url: payment_response.data.url}
                                    res.json(json_response)
                                } else {
                                    let json_response = {success: false, reference: payment_response.data.reference, required_param: payment_response.data.status}
                                    json_response[payment_response.data.status] = true;
                                    res.json(json_response)
                                }
                            } else {
                                if(payment_response.data.status == 'success'){
                                    trip.tip_amount = payment_response.data.amount/100;
                                    trip.total = trip.total + trip.tip_amount;
                                    trip.provider_service_fees = +trip.provider_service_fees + +trip.tip_amount;
                                    trip.pay_to_provider = trip.pay_to_provider + +trip.tip_amount;
                                    trip.card_payment = trip.card_payment + trip.tip_amount;

                                    Provider.findOne({_id: trip.confirmed_provider}, function(error, provider){
                                        City.findOne({_id: trip.city_id}).then((city) => {
                                            if (city.is_provider_earning_set_in_wallet_on_other_payment){
                                                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                                        provider.wallet_currency_code, trip.currencycode,
                                                        1, trip.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                                                    
                                                    provider.wallet = total_wallet_amount;
                                                    provider.save();
                                                } else {
                                                    Partner.findOne({_id: trip.provider_type_id}).then((partner) => {
                                                        let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                                            partner.wallet_currency_code, trip.currencycode,
                                                            1, trip.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                                                        partner.wallet = total_wallet_amount;
                                                        partner.save();
                                                    });
                                                }

                                                trip.is_provider_earning_set_in_wallet = true;
                                                trip.provider_income_set_in_wallet = trip.provider_income_set_in_wallet + Math.abs(trip.tip_amount);
                                            }

                                            trip.save().then(() => {
                                                res.json({success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                            });
                                        });
                                    });
                                }else if(payment_response.data.status == 'open_url'){
                                    let json_response = {success: false, url: payment_response.data.url}
                                    res.json(json_response)
                                } else {
                                    let json_response = {success: false, reference: payment_response.data.reference, required_param: payment_response.data.status}
                                    res.json(json_response)
                                }
                            }
                        } else {
                            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
                        }
                    });
                });

            }
        } else {
            if(payment_response.data){
                res.json({success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING, error_message: payment_response.data.message})
            } else {
                res.json({success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING, error_message: payment_response.message})
            }
        }
      })
    }).on('error', error => {
      console.error(error)
    })
    request.write(params)
    request.end()

}

exports.get_stripe_payment_intent = async function (req, res) {
    let setting_detail = await Settings.findOne({})
    let amount = Number(req.body.amount);
    let user_id = req.body.user_id;
    let trip_detail = await Trip.findOne({_id: req.body.trip_id})
    let trip_history_detail = await Trip_history.findOne({_id: req.body.trip_id});
    if(!trip_detail){
        trip_detail = trip_history_detail;
    }
    let is_main_user = true;
    let split_payment_index = null;
    if(trip_detail){
        if(!req.body.is_payment_for_tip){
            amount = trip_detail.remaining_payment;
            trip_detail.split_payment_users.forEach((split_payment_user_detail, index)=>{
                if(split_payment_user_detail.user_id.toString()==user_id){
                    is_main_user = false;
                    split_payment_index = index;
                    amount = split_payment_user_detail.remaining_payment;
                }
            })
        } else {
            user_id = trip_detail.user_id;
        }

        if(trip_detail.payment_gateway_type){
            req.body.payment_gateway_type = trip_detail.payment_gateway_type;
        }
    }
    let type = Number(req.body.type);
    let redirect_url = '';
    let Table;
    switch (type) {
        case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
        type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
        redirect_url = '/provider_payments';
        Table = Provider;
        break;
        case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
        type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
        redirect_url = '/corporate_payments';
        Table = Corporate;
        break;
        case Number(constant_json.PARTNER_UNIQUE_NUMBER):
        type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
        redirect_url = '/partner_payments';
        Table = Partner;
        break;
        default:
        type = Number(constant_json.USER_UNIQUE_NUMBER);
        redirect_url = '/payments';
        Table = User;
        break;
    }
    let wallet_currency_code;
    Table.findOne({_id: user_id}).then((detail) => { 
        (async () => {
            if (!trip_detail) {
                wallet_currency_code = detail.wallet_currency_code
                if (wallet_currency_code == "") {
                    wallet_currency_code = setting_detail.adminCurrencyCode
                }
            } else {
                wallet_currency_code = trip_detail.currencycode;
                if (wallet_currency_code == "") {
                    wallet_currency_code = setting_detail.adminCurrencyCode
                }
            }
            let stripe = require("stripe")(setting_detail.stripe_secret_key);
            stripe.setApiVersion('2020-08-27');
            try {
                if(!req.body.payment_gateway_type || req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe){
                    if(!req.body.payment_method){
                        let card_detail = await Card.findOne({user_id: detail._id, payment_gateway_type: PAYMENT_GATEWAY.stripe, is_default: true});
                        if(card_detail){
                            stripe.paymentIntents.create({
                                amount: Math.round((amount * 100)),
                                currency: wallet_currency_code,
                                customer: detail.customer_id,
                                payment_method: card_detail.payment_method
                            }, function(error, paymentIntent){
                                if(paymentIntent){
                                    if(trip_detail){
                                        console.log(paymentIntent.id)
                                        if(!req.body.is_payment_for_tip){
                                            if(is_main_user){
                                                trip_detail.payment_intent_id = paymentIntent.id;
                                            } else {
                                                trip_detail.split_payment_users[split_payment_index].payment_intent_id = paymentIntent.id;
                                            }
                                        } else {
                                            trip_detail.tip_payment_intent_id = paymentIntent.id;
                                        }
                                        trip_detail.markModified('split_payment_users');
                                        trip_detail.save();
                                    }
                                    res.json({ success: true, payment_method: card_detail.payment_method, client_secret: paymentIntent.client_secret });
                                } else {
                                    if (trip_detail && !req.body.is_payment_for_tip && error.raw.code == "amount_too_small") {
                                        if (!trip_detail.wallet_current_rate) {
                                            trip_detail.wallet_current_rate = 1;
                                        }
                                        let remaining_payment = trip_detail.remaining_payment;
                                        if(!is_main_user){
                                            remaining_payment = trip_detail.split_payment_users[split_payment_index].remaining_payment;
                                        }
                                        let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, detail.unique_id, detail._id, null,
                                            detail.wallet_currency_code, trip_detail.currencycode,
                                            trip_detail.wallet_current_rate, remaining_payment, detail.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip_detail.unique_id);
                                        detail.wallet = total_wallet_amount;
                                        if (trip_detail.is_trip_cancelled == 1) {
                                            detail.current_trip_id = null;
                                        }
                                        detail.save();

                                        if(is_main_user){
                                            trip_detail.wallet_payment = remaining_payment;
                                            trip_detail.total_after_wallet_payment = 0;
                                            trip_detail.remaining_payment = 0;
                                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                                        } else {
                                            trip_detail.split_payment_users[split_payment_index].wallet_payment = remaining_payment;
                                            trip_detail.split_payment_users[split_payment_index].remaining_payment = 0;
                                            trip_detail.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                        }
                                        trip_detail.markModified('split_payment_users');

                                        trip_detail.save(() => {
                                            utils.update_request_status_socket(trip_detail._id);
                                            Trip.findOneAndRemove({ _id: trip_detail._id }).then((deleted_trip) => {
                                                if (deleted_trip) {
                                                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                    trip_history_data.save(function () {
                                                        res.json({
                                                            success: true,
                                                            message: success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY
                                                        });
                                                    });
                                                } else {
                                                    res.json({
                                                        success: true,
                                                        message: success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY
                                                    });
                                                }
                                            });
                                        })
                                    } else {
                                        res.json({ success: false, error_message:error.raw.message });
                                    }                                    
                                }
                            });
                        } else {
                            res.json({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
                        }
                    } else {
                        stripe.customers.create({
                            payment_method: req.body.payment_method,
                            email: detail.email,
                            name: detail.name,
                            phone: detail.phone
                        }, function (err, customer) {
                            if(wallet_currency_code==""){
                                wallet_currency_code = setting_detail.adminCurrencyCode
                            }
                            stripe.paymentIntents.create({
                                amount: Math.round((amount * 100)),
                                currency: wallet_currency_code,
                                customer: customer.id,
                                payment_method: req.body.payment_method
                            }, function(error, paymentIntent){
                                if(paymentIntent){
                                    if(trip_detail){
                                        if(!req.body.is_payment_for_tip){
                                            if(is_main_user){
                                                trip_detail.payment_intent_id = paymentIntent.id;
                                            } else {
                                                trip_detail.split_payment_users[split_payment_index].payment_intent_id = paymentIntent.id;
                                            }
                                        } else {
                                            trip_detail.tip_payment_intent_id = paymentIntent.id;
                                        }
                                        trip_detail.markModified('split_payment_users');
                                        trip_detail.save();
                                    }
                                    res.json({ success: true, payment_method: req.body.payment_method, client_secret: paymentIntent.client_secret });
                                } else {
                                    if (trip_detail && !req.body.is_payment_for_tip && error.raw.code == "amount_too_small") {
                                        if (!trip_detail.wallet_current_rate) {
                                            trip_detail.wallet_current_rate = 1;
                                        }
                                        let remaining_payment = trip_detail.remaining_payment;
                                        if(!is_main_user){
                                            remaining_payment = trip_detail.split_payment_users[split_payment_index].remaining_payment;
                                        }
                                        let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, detail.unique_id, detail._id, null,
                                            detail.wallet_currency_code, trip_detail.currencycode,
                                            trip_detail.wallet_current_rate, remaining_payment, detail.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip_detail.unique_id);
                                        detail.wallet = total_wallet_amount;
                                        if (trip_detail.is_trip_cancelled == 1) {
                                            detail.current_trip_id = null;
                                        }
                                        detail.save();

                                        if(is_main_user){
                                            trip_detail.wallet_payment = remaining_payment;
                                            trip_detail.total_after_wallet_payment = 0;
                                            trip_detail.remaining_payment = 0;
                                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                                        } else {
                                            trip_detail.split_payment_users[split_payment_index].wallet_payment = remaining_payment;
                                            trip_detail.split_payment_users[split_payment_index].remaining_payment = 0;
                                            trip_detail.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                            trip_detail.wallet_payment = trip_detail.wallet_payment + remaining_payment;
                                        }

                                        trip_detail.markModified('split_payment_users');
                                        trip_detail.save(() => {
                                            utils.update_request_status_socket(trip_detail._id);
                                            Trip.findOneAndRemove({ _id: trip_detail._id }).then((deleted_trip) => {
                                                if (deleted_trip) {
                                                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                    trip_history_data.save(function () {
                                                        res.json({
                                                            success: true,
                                                            message: success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY
                                                        });
                                                    });
                                                } else {
                                                    res.json({
                                                        success: true,
                                                        message: success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY
                                                    });
                                                }
                                            });
                                        })
                                    } else {
                                        res.json({ success: false, error_message:error.raw.message });
                                    }  
                                }
                            });
                        });
                    }
                }else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paystack){
                        let card_detail = await Card.findOne({user_id: detail._id, payment_gateway_type: PAYMENT_GATEWAY.paystack, is_default: true});
                        if(card_detail){
                            const params = JSON.stringify({
                                "email": detail.email,
                                "amount": Math.round((amount * 100)),
                                authorization_code: card_detail.payment_method
                            })
                            const options = {
                              hostname: 'api.paystack.co',
                              port: 443,
                              path: '/charge',
                              method: 'POST',
                              headers: {
                                Authorization: 'Bearer '+setting_detail.paystack_secret_key,
                                'Content-Type': 'application/json'
                              }
                            }
                            const request = https.request(options, res_data => {
                                let data = ''
                                res_data.on('data', (chunk) => {
                                    data += chunk
                                });
                                res_data.on('end', () => {
                                    let payment_response = JSON.parse(data);
                                    if(payment_response.status){
                                        if(!trip_detail){
                                            if(payment_response.data.status == 'success'){
                                                req.body.paystack_data = payment_response.data;
                                                Users.add_wallet_amount(req, res)
                                            } else if(payment_response.data.status == 'open_url'){
                                                let json_response = {success: false, error_message: 'Please Try Another Card', url: payment_response.data.url}
                                                res.json(json_response)
                                            } else {
                                                let json_response = {success: false, reference: payment_response.data.reference, required_param: payment_response.data.status}
                                                res.json(json_response)
                                            }
                                        } else {

                                            if(!req.body.is_payment_for_tip){
                                                if(is_main_user){
                                                    trip_detail.payment_intent_id = payment_response.reference;
                                                } else {
                                                    trip_detail.split_payment_users[split_payment_index].payment_intent_id = payment_response.reference;
                                                }
                                                trip_detail.save().then(async () => {
                                                    if(payment_response.data.status == 'success'){

                                                        if(is_main_user){
                                                            trip_detail.is_paid = 1;
                                                            trip_detail.is_pending_payments = 0;
                                                            trip_detail.card_payment = 0;
                                                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                                                            trip_detail.remaining_payment = 0;
                                                            trip_detail.card_payment = payment_response.data.amount / 100;
                                                        } else {
                                                            trip_detail.split_payment_users[split_payment_index].card_payment = payment_response.data.amount / 100;
                                                            trip_detail.split_payment_users[split_payment_index].remaining_payment = 0;
                                                            trip_detail.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                                            trip_detail.card_payment = trip_detail.card_payment + (payment_response.data.amount / 100);
                                                        }

                                                        // start provider profit after card payment done
                                                        await utils.trip_provider_profit_card_wallet_settlement(trip_detail);
                                                        // end of provider profit after card payment done

                                                        trip_detail.markModified('split_payment_users');
                                                        trip_detail.save().then(() => {
                                                            if (trip_detail.is_trip_cancelled == 1) {
                                                                User.findOne({ _id: trip_detail.user_id }).then((user) => {
                                                                    user.current_trip_id = null;
                                                                    user.save();
                                                                });
                                                            }
                                                            if (trip_detail.payment_status == PAYMENT_STATUS.COMPLETED) {
                                                                Trip.findOneAndRemove({ _id: trip_detail._id }).then((deleted_trip) => {
                                                                    if (deleted_trip) {
                                                                        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                                        trip_history_data.save(function () {
                                                                            res.json({
                                                                                success: true,
                                                                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                                                                payment_status: trip_detail.payment_status
                                                                            });
                                                                        });
                                                                    } else {
                                                                        res.json({
                                                                            success: true,
                                                                            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                                                            payment_status: trip_detail.payment_status
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                res.json({
                                                                    success: true,
                                                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                                                    payment_status: trip_detail.payment_status
                                                                });
                                                            }
                                                                
                                                        }, (err) => {
                                                            console.log(err);
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                            });
                                                        });


                                                    } else if(payment_response.data.status == 'open_url'){
                                                        trip_detail.payment_status = PAYMENT_STATUS.FAILED;
                                                        trip_detail.save().then(() => {
                                                            let json_response = {success: false, payment_status: trip_detail.payment_status,url: payment_response.data.url}
                                                            res.json(json_response)
                                                        });
                                                    } else {
                                                        trip_detail.payment_status = PAYMENT_STATUS.FAILED;
                                                        trip_detail.save().then(() => {
                                                            let json_response = {success: false, reference: payment_response.data.reference, required_param: payment_response.data.status}
                                                            res.json(json_response)
                                                        });
                                                    }
                                                });
                                            } else {
                                                if(payment_response.data.status == 'success'){
                                                    trip_detail.tip_payment_intent_id = payment_response.reference;
                                                    trip_detail.tip_amount = payment_response.data.amount/100;
                                                    trip_detail.total = trip_detail.total + trip_detail.tip_amount;
                                                    trip_detail.provider_service_fees = +trip_detail.provider_service_fees + +trip_detail.tip_amount;
                                                    trip_detail.pay_to_provider = trip_detail.pay_to_provider + +trip_detail.tip_amount;
                                                    trip_detail.card_payment = trip_detail.card_payment + trip_detail.tip_amount;

                                                    Provider.findOne({_id: trip_detail.confirmed_provider}, function(error, provider){
                                                        City.findOne({_id: trip_detail.city_id}).then((city) => {
                                                            if (city.is_provider_earning_set_in_wallet_on_other_payment){
                                                                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                                                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                                                        provider.wallet_currency_code, trip_detail.currencycode,
                                                                        1, trip_detail.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip_detail.unique_id);
                                                                    
                                                                    provider.wallet = total_wallet_amount;
                                                                    provider.save();
                                                                } else {
                                                                    Partner.findOne({_id: trip_detail.provider_type_id}).then((partner) => {
                                                                        let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                                                            partner.wallet_currency_code, trip_detail.currencycode,
                                                                            1, trip_detail.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip_detail.unique_id);

                                                                        partner.wallet = total_wallet_amount;
                                                                        partner.save();
                                                                    });
                                                                }

                                                                trip_detail.is_provider_earning_set_in_wallet = true;
                                                                trip_detail.provider_income_set_in_wallet = trip_detail.provider_income_set_in_wallet + Math.abs(trip_detail.tip_amount);
                                                            }

                                                            trip_detail.save().then(() => {
                                                                res.json({success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                                            });
                                                        });
                                                    });
                                                } else if(payment_response.data.status == 'open_url'){
                                                    let json_response = {success: false, url: payment_response.data.url}
                                                    res.json(json_response)
                                                } else {
                                                    let json_response = {success: false, reference: payment_response.data.reference, required_param: payment_response.data.status}
                                                    res.json(json_response)
                                                }
                                            }

                                        }
                                    } else {
                                        if(payment_response.data){
                                            res.json({success: false, error_message: payment_response.data.message})
                                        } else {
                                            res.json({success: false, error_message: payment_response.message})
                                        }
                                    }
                                })
                            }).on('error', error => {
                              console.error(error)
                            })
                            request.write(params)
                            request.end()
                        } else {
                            res.json({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
                        }
                    // }
                } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.payu){

                    let txnid = '';
                    let success_url = req.protocol + '://' + req.get('host');
                    let fail_url = req.protocol + '://' + req.get('host');
                    let udf5 = '';
                    if(req.body.trip_id){
                        udf5 = req.body.trip_id;
                        if(!req.body.is_payment_for_tip){
                            txnid = req.body.trip_id;
                            success_url = success_url + '/pay_stripe_intent_payment';
                            fail_url = fail_url + '/fail_stripe_intent_payment';
                        } else {
                            txnid = utils.tokenGenerator(24);
                            success_url = success_url + '/pay_tip_payment';
                            fail_url = fail_url + '/fail_payment';
                        }
                    } else {
                        txnid = utils.tokenGenerator(24);
                        success_url = success_url  + '/add_wallet_amount';
                        fail_url = fail_url + '/fail_payment';
                    }
                    if(req.body.is_new){
                        redirect_url = req.body.is_new
                    }
                    let crypto = require('crypto');
                    let productinfo = 'trip payment';
                    let x = setting_detail.payu_key+'|'+txnid+'|'+amount+'|'+productinfo+'|'+detail.first_name + ' ' + detail.last_name+'|'+detail.email+'|'+req.body.payment_gateway_type+'|'+type+'|'+user_id+'|'+redirect_url+'|'+udf5+'||||||'+setting_detail.payu_salt
                    let hash = crypto.createHash('sha512').update(x).digest('hex');

                    let udf1 = req.body.payment_gateway_type;
                    let udf2 = type;
                    let udf3 = user_id;
                    let udf4 = redirect_url;                    
                    let html = '<form action="https://test.payu.in/_payment" id="myForm" method="post"><input type="hidden" name="key" value="'+setting_detail.payu_key+'" /><input type="hidden" name="txnid" value="'+txnid+'" /><input type="hidden" name="udf1" value="'+udf1+'" /><input type="hidden" name="udf2" value="'+udf2+'" /><input type="hidden" name="udf3" value="'+udf3+'" /><input type="hidden" name="udf4" value="'+udf4+'" /><input type="hidden" name="udf5" value="'+udf5+'" /><input type="hidden" name="productinfo" value="'+productinfo+'" /><input type="hidden" name="amount" value="'+amount+'" /><input type="hidden" name="email" value="'+detail.email+'" /><input type="hidden" name="firstname" value="'+detail.first_name + ' ' + detail.last_name+'" /><input type="hidden" name="surl" value="'+success_url+'" /><input type="hidden" name="furl" value="'+fail_url+'" /><input type="hidden" name="phone" value="'+detail.phone+'" /><input type="hidden" name="hash" value="'+hash+'" /><input type="submit" letalue="submit"></form><script>document.getElementById("myForm").submit();</script>'

                    res.json({ success: true, html_form: html});
                }
            } catch (error) {
                if(error.raw){
                    res.json({ success: false, message: error.raw.message  });
                } else {
                    res.json({ success: false, message: error.message });
                }
            }
        })();
    });
}

exports.add_card = async function (req, res) {
    let setting_detail = await Settings.findOne({})
    utils.check_request_params(req.body, [{name: 'user_id', type: 'string'},{name: 'payment_method', type: 'string'},
        {name: 'token', type: 'string'}], function (response) {
        if (response.success) {
            let type = Number(req.body.type);
            let Table;
            switch (type) {
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                Table = Provider;
                break;
                case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
                type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
                Table = Corporate;
                break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                Table = Partner;
                break;
                default:
                type = Number(constant_json.USER_UNIQUE_NUMBER);
                Table = User;
                break;
            }

            Table.findOne({_id: req.body.user_id}).then((detail) => { 

                let stripe_secret_key = setting_detail.stripe_secret_key;
                let stripe = require("stripe")(stripe_secret_key);
                stripe.setApiVersion('2020-08-27');
                if(!detail.customer_id){
                    stripe.customers.create({
                        payment_method: req.body.payment_method,
                        email: detail.email,
                        name: detail.name,
                        phone: detail.phone
                    }, function (err, customer) {
                        detail.customer_id = customer.id;
                        detail.save();
                    });
                } else {
                    stripe.paymentMethods.attach(req.body.payment_method,
                        {
                            customer: detail.customer_id,
                        }, function () {
                        
                    });
                }
                stripe.paymentMethods.retrieve(
                    req.body.payment_method,
                (err, paymentMethod)=> {
                    Card.find({user_id: req.body.user_id, payment_gateway_type: PAYMENT_GATEWAY.stripe, $or :  [{type: type}, { type: {$exists: false} }]}).then((card_data) => { 

                        let card = new Card({
                            payment_id: req.body.payment_id,
                            user_id: req.body.user_id,
                            token: req.body.token,
                            payment_gateway_type: PAYMENT_GATEWAY.stripe,
                            last_four: paymentMethod.card.last4,
                            payment_method: req.body.payment_method,
                            card_type: paymentMethod.card.brand,
                            type: type,
                            is_default: constant_json.YES
                        });
                        if (card_data.length > 0) {
                            Card.findOneAndUpdate({user_id: req.body.user_id, payment_gateway_type: PAYMENT_GATEWAY.stripe, $or :  [{type: type}, { type: {$exists: false} }], is_default: constant_json.YES}, {is_default: constant_json.NO}).then(() => { 

                            });
                        }
                        card.save().then(() => { 
                            res.json({
                                success: true,
                                message: success_messages.MESSAGE_CODE_YOUR_CARD_ADDED_SUCCESSFULLY,
                                _id: card._id,
                                payment_method: card.payment_method,
                                user_id: card.user_id,
                                last_four: card.last_four,
                                card_type: card.card_type,
                                is_default: card.is_default,
                                payment_id: card.payment_id,
                                type: card.type

                            });
                        }, (err) => {
                            console.log(err)
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });

                    });
                });
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};
//// LIST OF INDIVIDUAL USER  CARD SERVICE ////
exports.card_list = async function (req, res) {
    let setting_detail = await Settings.findOne({})
    utils.check_request_params(req.body, [{name: 'user_id', type: 'string'}], function (response) {
        if (response.success) {
            let type = Number(req.body.type);
            let Table;
            switch (type) {
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                Table = Provider;
                break;
                case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
                type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
                Table = Corporate;
                break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                Table = Partner;
                break;
                default:
                type = Number(constant_json.USER_UNIQUE_NUMBER);
                Table = User;
                break;
            }

            Table.findOne({_id: req.body.user_id}).then((detail) => { 
                if (!detail) {
                    res.json({success: false, error_code: error_message.ERROR_CODE_FOR_PORBLEM_IN_FETCHIN_CARD}); // 
                } else {

                    let country_query = {countryphonecode: detail.country_phone_code}
                    if (type == Number(constant_json.PROVIDER_UNIQUE_NUMBER)) {
                        country_query = {_id: detail.country_id}
                    }
                    Country.findOne(country_query, function(error, country_detail){
                        let payment_gateway_type = setting_detail.payment_gateway_type;
                        if(country_detail && country_detail.payment_gateways && country_detail.payment_gateways.length>0){
                            payment_gateway_type = country_detail.payment_gateways[0];
                        }

                        let query = {};
                        query = {$or:[{user_id: req.body.user_id, type: type, payment_gateway_type: payment_gateway_type},{user_id: req.body.user_id, type: {$exists: false}, payment_gateway_type: payment_gateway_type}]};
                        
                        Card.find(query).then((card) => { 
                            let PAYMENT_TYPES = [{
                                id: Number(payment_gateway_type),
                                name: '',
                                is_add_card: IS_ADD_CARD[payment_gateway_type]
                            }];
                            let wallet = 0;
                            let wallet_currency_code = "";
                            let is_use_wallet = false;
                            try {
                                wallet = detail.wallet;
                                wallet_currency_code = detail.wallet_currency_code;
                                is_use_wallet = detail.is_use_wallet;
                            } catch (error) {
                                console.error(error);

                            }
                            if (type == Number(constant_json.USER_UNIQUE_NUMBER)) {
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_GET_ALL_CARD_SUCCESSFULLY,
                                    wallet: wallet,
                                    wallet_currency_code: wallet_currency_code,
                                    is_use_wallet: is_use_wallet,
                                    payment_gateway: PAYMENT_TYPES,
                                    payment_gateway_type: Number(payment_gateway_type),
                                    card: card
                                });
                            } else
                            {
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_GET_ALL_CARD_SUCCESSFULLY,
                                    wallet: wallet,
                                    wallet_currency_code: wallet_currency_code,
                                    payment_gateway: PAYMENT_TYPES,
                                    payment_gateway_type: Number(payment_gateway_type),
                                    card: card
                                });
                            }

                            

                        });
                    });
                }
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};


exports.fail_payment = function (req, res) {
    // For ejs code let message = "Payment Fail";
    res.redirect(req.body.udf4);
}
exports.delete_card = async function (req, res) {
    let setting_detail = await Settings.findOne({})
    utils.check_request_params(req.body, [{name: 'user_id', type: 'string'},{name: 'card_id', type: 'string'},
        {name: 'token', type: 'string'}], function (response) {
        if (response.success) {
            let type = Number(req.body.type);
            let Table;
            switch (type) {
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                Table = Provider;
                break;
                case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
                type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
                Table = Corporate;
                break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                Table = Partner;
                break;
                default:
                type = Number(constant_json.USER_UNIQUE_NUMBER);
                Table = User;
                break;
            }
            Table.findOne({_id: req.body.user_id}).then((detail) => { 
                if (detail) {
                    if (req.body.token !== null && detail.token !== req.body.token)
                    {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else
                    {
                        if (type == Number(constant_json.USER_UNIQUE_NUMBER)) {
                            let query = {$or:[{_id :detail.current_trip_id ,payment_mode:Number(constant_json.PAYMENT_MODE_CARD)},{user_id: detail._id, is_pending_payments: 1 }]};
                            
                            Trip.find(query).then((trips) => { 

                                if (trips.length > 0) {
                                    res.json({success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING});
                                } else {
                                    Card.findOneAndRemove({ _id: req.body.card_id, $or: [{ type: type }, { type: { $exists: false } }], user_id: req.body.user_id }).then((deleted_card) => { 
                                        let stripe_secret_key = setting_detail.stripe_secret_key;
                                        let stripe = require("stripe")(stripe_secret_key);
                                        stripe.setApiVersion('2020-08-27');
                                        stripe.paymentMethods.detach(deleted_card.payment_method, function () {
                                            res.json({ success: true, message: success_messages.MESSAGE_CODE_YOUR_CARD_DELETED_SUCCESSFULLY });
                                        });
                                    });
                                }
                            });
                        } else
                        {
                            Card.findOneAndRemove({ _id: req.body.card_id, $or: [{ type: type }, { type: { $exists: false } }], user_id: req.body.user_id }).then((deleted_card) => { 
                                let stripe_secret_key = setting_detail.stripe_secret_key;
                                let stripe = require("stripe")(stripe_secret_key);
                                stripe.setApiVersion('2020-08-27');
                                stripe.paymentMethods.detach(deleted_card.payment_method, function () {
                                    res.json({ success: true, message: success_messages.MESSAGE_CODE_YOUR_CARD_DELETED_SUCCESSFULLY });
                                });
                            });
                        }
                    }
                } else
                {
                    res.json({success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND});
                }
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};


////////////// CARD SELECTION  //////////////
exports.card_selection = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'card_id', type: 'string' }], function (response) {
        if (response.success) {
            let type = Number(req.body.type);
            switch (type) {
                case Number(constant_json.USER_UNIQUE_NUMBER):
                    type = Number(constant_json.USER_UNIQUE_NUMBER);
                    break;
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                    type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                    break;
                case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
                    type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
                    break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                    type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                    break;
                default:
                    type = Number(constant_json.USER_UNIQUE_NUMBER);
                    break;
            }

            let payment_gateway_type = req.body.payment_gateway_type;
            if(!payment_gateway_type){
                payment_gateway_type = PAYMENT_GATEWAY.stripe;
            }

            Card.findOne({_id: req.body.card_id, $or :  [{type: type}, { type: {$exists: false} }], user_id: req.body.user_id, payment_gateway_type: payment_gateway_type}).then((card) => { 

                if (!card) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_CARD_NOT_FOUND });
                } else {
                    card.is_default = constant_json.YES;
                    card.save().then(() => {

                        Card.findOneAndUpdate({ _id: { $nin: req.body.card_id }, $or: [{ type: type }, { type: { $exists: false } }], user_id: req.body.user_id, payment_gateway_type: payment_gateway_type, is_default: constant_json.YES }, { is_default: constant_json.NO }).then(() => {


                            res.json({ success: true, message: success_messages.MESSAGE_CODE_YOUR_GET_YOUR_SELECTED_CARD, card: card });

                        });
                    }, (err) => {
                        console.log(err)
                        res.json({
                            success: false,
                            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                        });
                    });
                }
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

/////////////// USER CHANGE PAYMENT TYPE  
exports.change_paymenttype = function (req, res) {

    utils.check_request_params(req.body, [{name: 'trip_id', type: 'string'}], function (response) {
        if (response.success) {
            User.findOne({_id: req.body.user_id}).then((user) => { 
                if (user)
                {
                    if (req.body.token != null && user.token != req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else
                    {
                        let payment_type = req.body.payment_type;
                        if (payment_type == Number(constant_json.PAYMENT_MODE_CARD)) {
                            Trip.findOne({_id: req.body.trip_id}).then((trip) => { 
                                let user_id = trip.user_id;
                                if(trip.trip_type == constant_json.TRIP_TYPE_CORPORATE){
                                    user_id = trip.user_type_id;
                                }
                                Card.find({user_id: user_id, payment_gateway_type: trip.payment_gateway_type}).then((card) => { 

                                    if (card.length == 0 && trip.payment_gateway_type !== PAYMENT_GATEWAY.payu) {  
                                        res.json({success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST});
                                    } else {


                                            trip.payment_mode = req.body.payment_type;
                                            trip.save();
                                            Provider.findOne({_id: trip.confirmed_provider}).then((provider) => { 

                                                let device_token = provider.device_token;
                                                let device_type = provider.device_type;
                                                utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PAYMENT_MODE_CARD, "", null, provider.lang_code);
                                                utils.update_request_status_socket(trip._id);
                                                res.json({success: true, message: success_messages.MESSAGE_CODE_YOUR_PAYMEMT_MODE_CHANGE_SUCCESSFULLY});
                                            });
                                    }
                                });

                            });
                        } else {
                            Trip.findOne({_id: req.body.trip_id}).then((trip) => { 
                                City.findOne({_id: trip.city_id}).then((city_detail) => {
                                    Provider.findOne({_id: trip.confirmed_provider}).then((provider) => { 
                                        if(provider && city_detail && city_detail.is_check_provider_wallet_amount_for_received_cash_request && city_detail.provider_min_wallet_amount_set_for_received_cash_request > provider.wallet){
                                            return res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_CAN_NOT_CHANGE_PAYMENT_MODE
                                            })
                                        }
                                        trip.payment_mode = req.body.payment_type;
                                        trip.save();
                                        let device_token = provider.device_token;
                                        let device_type = provider.device_type;
                                        utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PAYMENT_MODE_CASH, "", null, provider.lang_code);
                                        utils.update_request_status_socket(trip._id);
                                        res.json({success: true, message: success_messages.MESSAGE_CODE_YOUR_PAYMEMT_MODE_CHANGE_SUCCESSFULLY});
                                    });
                                });
                            });
                        }
                    }
                } else
                {
                    res.json({success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND});
                }

            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });

};

// rental refund
exports.refund_rental_payment = async function (trip, intent_id, payment_gateway_type, amount = 0) {
    let setting_detail = await Settings.findOne({});
    const request = require('request');
    
    try {
        if (!payment_gateway_type || payment_gateway_type == PAYMENT_GATEWAY.stripe) {
            const stripe = require("stripe")(setting_detail.stripe_secret_key);
            stripe.setApiVersion('2020-08-27');

            let body = { payment_intent: intent_id };
            if (amount > 0) body.amount = amount;

            const refund = await stripe.refunds.create(body);
            return { success: true, data: refund };

        } else if (payment_gateway_type == PAYMENT_GATEWAY.paystack) {
            let params = {
                transaction: intent_id,
                ...(amount > 0 && {
                    amount: amount,
                    currency: trip.currencycode,
                    customer_note: `Refund of Trip ID: ${trip.unique_id}`
                })
            };

            const options = {
                hostname: 'api.paystack.co',
                port: 443,
                path: '/refund',
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + setting_detail.paystack_secret_key,
                    'Content-Type': 'application/json'
                }
            };

            const refund = await new Promise((resolve, reject) => {
                const req = https.request(options, res => {
                    let data = '';
                    res.on('data', chunk => (data += chunk));
                    res.on('end', () => resolve(JSON.parse(data)));
                }).on('error', reject);
                req.write(JSON.stringify(params));
                req.end();
            });

            return { success: true, data: refund };

        } else if (payment_gateway_type == PAYMENT_GATEWAY.payu) {
            const authOptions = {
                method: 'POST',
                url: 'https://secure.payu.com/pl/standard/user/oauth/authorize',
                form: {
                    grant_type: 'client_credentials',
                    client_id: '145227',
                    client_secret: '12f071174cb7eb79d4aac5bc2f07563f'
                }
            };

            const refund = await new Promise((resolve, reject) => {
                request(authOptions, (error, response) => {
                    if (error) return reject(error);
                    const access_token = JSON.parse(response.body).access_token;

                    const params = {
                        refund: { description: 'Refund', ...(amount > 0 && { amount }) }
                    };

                    const reqOptions = {
                        hostname: 'secure.payu.com',
                        port: 443,
                        path: `/api/v2_1/orders/${intent_id}/refunds`,
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + access_token,
                            'Content-Type': 'application/json'
                        }
                    };

                    const req = https.request(reqOptions, res => {
                        let data = '';
                        res.on('data', chunk => (data += chunk));
                        res.on('end', () => resolve(JSON.parse(data)));
                    }).on('error', reject);
                    req.write(JSON.stringify(params));
                    req.end();
                });
            });

            return { success: true, data: refund };

        } else if (payment_gateway_type == PAYMENT_GATEWAY.paytabs) {
            const params = JSON.stringify({
                profile_id: setting_detail.paytabs_profileId,
                tran_type: 'refund',
                tran_class: 'ecom',
                tran_ref: intent_id,
                cart_id: 'Unique order reference',
                cart_description: `Refund of Trip ID: ${trip.unique_id}`,
                cart_currency: trip.currencycode,
                cart_amount: Number(amount)
            });

            const options = {
                hostname: 'secure-global.paytabs.com',
                port: 443,
                path: '/payment/request',
                method: 'POST',
                headers: {
                    authorization: setting_detail.paytabs_server_key,
                    'Content-Type': 'application/json'
                }
            };

            const refund = await new Promise((resolve, reject) => {
                const req = https.request(options, res => {
                    let data = '';
                    res.on('data', chunk => (data += chunk));
                    res.on('end', () => resolve(JSON.parse(data)));
                }).on('error', reject);
                req.write(params);
                req.end();
            });

            return { success: true, data: refund };

        } else if (payment_gateway_type == PAYMENT_GATEWAY.paypal) {
            const paypal = require('paypal-rest-sdk');
            paypal.configure({
                mode: setting_detail.paypal_environment,
                client_id: setting_detail.paypal_client_id,
                client_secret: setting_detail.paypal_secret_key
            });

            const refund = {
                amount: { total: amount.toString(), currency: trip.currencycode }
            };

            const response = await new Promise((resolve, reject) => {
                paypal.sale.refund(intent_id, refund, (error, refundResponse) => {
                    if (error) return reject(error);
                    resolve(refundResponse);
                });
            });

            return { success: true, data: response };

        } else if (payment_gateway_type == PAYMENT_GATEWAY.razorpay) {
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({
                key_id: setting_detail.razorpay_client_id,
                key_secret: setting_detail.razorpay_secret_key
            });

            const refundAmount = amount * 100;

            const response = await new Promise((resolve, reject) => {
                razorpay.payments.refund(intent_id, { amount: refundAmount }, (error, refund) => {
                    if (error) return reject(error);
                    resolve(refund);
                });
            });

            return { success: true, data: response };

        } else {
            return { success: false };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
};
