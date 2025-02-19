const Trip = require('mongoose').model('Trip');
const Trip_history = require('mongoose').model('Trip_history');
const User = require('mongoose').model('User');
const Provider = require('mongoose').model('Provider');
const Card = require('mongoose').model('Card');
const City = require('mongoose').model('City');
const Partner = require('mongoose').model('Partner');
const utils = require('./utils');
const Corporate = require('mongoose').model('Corporate');
const https = require('https')
const Settings = require('mongoose').model('Settings')
const Country = require('mongoose').model('Country');
const Wallet_history = require('mongoose').model('Wallet_history');
const fs = require('fs');
const Rental_Trip = require('mongoose').model('Rental_Trip');
const Car_Rent_Vehicle = require("mongoose").model("Car_Rent_Vehicle");
const {
    PAYMENT_GATEWAY,
    IS_ADD_CARD,
    PAYMENT_STATUS,
    ERROR_CODE,
} = require('./constant');
const { TYPE_VALUE, RENTAL_TRIP_STATUS } = require('../../../server/app/controllers/constant');

exports.fail_payment = async function (req, res) {
    
    const setting_detail = await Settings.findOne({})
    if(req.query?.is_new){
        return res.redirect(req.query.is_new)
    }else{
        //for ejs Code global.message = "Payment Fail";
        utils.payment_fail_socket(req.body.udf3);
        if (req.body.udf4) {
            if (req.body.udf4 === "/payments" || req.body.udf4 === "/provider_payments") {
                return res.redirect(setting_detail.payments_base_url + "/fail_payment")
            } else {
                return res.redirect(req.body.udf4)
            }
        } else {
            return res.json({ 
                success: true, 
                success_message: "",
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE)
            });
        }
    }
}

exports.success_payment = function (req, res) {
    if(req.query.url){
        res.redirect(req.query.url);
    } else {
        return res.json({ 
            success: true, 
            success_message: "",
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE)
        });
    }
}

exports.get_stripe_payment_intent = async function (req, res) {
    console.log("get_stripe_payment_intent");
    console.log(req.body);
    
    let setting_detail = await Settings.findOne({});
    let amount = Number(req.body.amount);
    let user_id = req.body.user_id;
    const is_rental_trip_payment = req.body.is_rental_trip_payment ? req.body.is_rental_trip_payment : false;
    const is_rental_trip_additional_payment = req.body.is_rental_trip_additional_payment ? req.body.is_rental_trip_additional_payment : false;
    let trip_detail;
    let trip_history_detail;
    let is_main_user = true;
    let split_payment_index = null;

    if(!is_rental_trip_payment && !is_rental_trip_additional_payment){
        trip_detail = await Trip.findOne({_id: req.body.trip_id});
        trip_history_detail = await Trip_history.findOne({_id: req.body.trip_id});
        if(!trip_detail){
            trip_detail = trip_history_detail;
        }
    } else {
        trip_detail = await Rental_Trip.findOne({_id: req.body.trip_id});
    }

    // for normal trips
    if(trip_detail && !is_rental_trip_payment && !is_rental_trip_additional_payment){
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
        if(req.body.is_for_retry){
            let user_country = await Country.findById(trip_detail ? trip_detail.country_id : trip_history_detail.country_id)
            req.body.payment_gateway_type = Number(user_country?.payment_gateways[0])
            trip_detail.payment_gateway_type = req.body.payment_gateway_type
            await trip_detail.save()
        }
    }

    // for rental trips
    if((is_rental_trip_payment || is_rental_trip_additional_payment)){
        if(trip_detail){
            amount = Number(trip_detail.total);
            if(is_rental_trip_additional_payment){
                amount = Number(trip_detail.total_additional_charge);
            }
            user_id = trip_detail.user_id;          
            if(trip_detail.payment_gateway_type){
                req.body.payment_gateway_type = trip_detail.payment_gateway_type;
            }
            if(req.body.is_for_retry){
                let user_country = await Country.findById(trip_detail ? trip_detail.country_id : trip_history_detail.country_id)
                req.body.payment_gateway_type = Number(user_country?.payment_gateways[0])
                trip_detail.payment_gateway_type = req.body.payment_gateway_type
                await trip_detail.save()
            }
        } else {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_TRIP_NOT_FOUND),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_TRIP_NOT_FOUND),
            });
        }
    }

    if(req.body.is_apple_pay){
        req.body.payment_gateway_type = PAYMENT_GATEWAY.stripe;
    }

    let type = Number(req.body.type);
    let redirect_url = '';
    let Table = User;
    let wallet_currency_code;

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
    
    Table.findOne({_id: user_id}).then(async(detail) => {
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
                // For apple pay wallet amount
                if(req.body.is_apple_pay){
                    let data = {
                        body: {
                            amount: Math.round((amount * 100)),
                            currency: detail?.wallet_currency_code,
                            customer: detail?._id,
                            metadata: {
                                is_apple_pay: req.body?.is_apple_pay,
                                is_wallet_amount: req.body?.is_wallet_amount,
                                type: req.body?.type,
                                payment_gateway_type: req.body?.payment_gateway_type,
                                user_id: user_id
                            }
                        }
                    }
                    let paymentIntent = null;
                    let error = null;
                    let payment_res = await exports.create_payment_intent(data, null)
                    if (payment_res.success) {
                        paymentIntent = payment_res.paymentIntent
                    } else {
                        error = payment_res.error;
                    }
                    if(error){
                        return res.json({ success: false, error_message:error.raw.message, error_code: String(error_message.DEFAULT_ERROR_CODE) });
                    }
                    return res.json({ 
                        success: true,
                        client_secret: paymentIntent?.client_secret, 
                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                        success_message: "",  
                    });
                }
                if(!req.body.payment_method){
                    let card_detail = await Card.findOne({user_id: detail._id, payment_gateway_type: PAYMENT_GATEWAY.stripe, is_default: true});
                    if(!card_detail){
                        return res.json({ 
                            success: false,
                            payment_gateway_type: req.body.payment_gateway_type,
                            error_code: String(error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST),
                        });
                    }
                    let data = {
                        body: {
                            amount: Math.round((amount * 100)),
                            currency: wallet_currency_code,
                            customer: detail.customer_id,
                            payment_method: card_detail.payment_method
                        }
                    }
                    let paymentIntent = null;
                    let error = null;
                    let payment_res;
                    if(trip_detail && trip_detail?.payment_intent_id != ''){
                        let stripe_secret_key = setting_detail.stripe_secret_key;
                        let stripe = require("stripe")(stripe_secret_key);
                        payment_res = await stripe.paymentIntents.retrieve(trip_detail.payment_intent_id);
                        if(payment_res.status == 'succeeded' || payment_res.status == 'canceled'){
                            payment_res = await exports.create_payment_intent(data, null)
                        }
                    }else{
                        payment_res = await exports.create_payment_intent(data, null)
                    }
                    if(payment_res.success){
                        paymentIntent = payment_res.paymentIntent;
                    }else if(payment_res.success == undefined){
                        paymentIntent = payment_res;
                    }else{
                        error = payment_res.error;
                    }
                    if(paymentIntent){
                        if(trip_detail){
                            if(!is_rental_trip_payment && !is_rental_trip_additional_payment){
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
                            } else {
                                if(is_rental_trip_payment){
                                    trip_detail.payment_intent_id = paymentIntent.id;
                                } else {
                                    trip_detail.additional_payment_intent_id = paymentIntent.id;
                                }
                                trip_detail.save();
                            }
                        }
                        return res.json({ 
                            success: true,
                            payment_method: card_detail.payment_method, 
                            client_secret: paymentIntent.client_secret, 
                            payment_gateway_type: req.body.payment_gateway_type, 
                            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                            success_message: "",  
                        });
                    } else {
                        
                        if (trip_detail && !req.body.is_payment_for_tip && error.raw.code == "amount_too_small") {
                            // for rental trip
                            if(is_rental_trip_payment){

                                let total_wallet_amount = utils.addWalletHistory(
                                    constant_json.USER_UNIQUE_NUMBER, 
                                    detail.unique_id, 
                                    detail._id, 
                                    null,
                                    detail.wallet_currency_code, 
                                    trip_detail.currencycode,
                                    1, 
                                    trip_detail.total, 
                                    detail.wallet, 
                                    constant_json.DEDUCT_WALLET_AMOUNT, 
                                    constant_json.PAID_TRIP_AMOUNT, 
                                    "Charge Of This Rental Trip : " + trip_detail.unique_id
                                );
                                detail.wallet = total_wallet_amount;    
                                detail.save();

                                trip_detail.is_paid = 1;
                                trip_detail.remaining_payment = 0;
                                trip_detail.wallet_payment = total;
                                trip_detail.is_pending_payments = 0;
                                trip_detail.user_payment_time = new Date();
                                trip_detail.total_after_wallet_payment = 0;
                                trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                                trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                                
                                let user_type = TYPE_VALUE.USER;
                                let trip_status = trip_detail.trip_status;
                                const newStatus = {
                                    status: RENTAL_TRIP_STATUS.PAYMENT,
                                    timestamp: new Date(),
                                    user_type: user_type,
                                    username: detail.first_name + " " + detail.last_name,
                                    user_id: detail._id
                                };
                                trip_status.push(newStatus);
                                trip_detail.trip_status = trip_status;

                                trip_detail.save(() => {
                                    return res.json({ 
                                        success: true,
                                        payment_gateway_type: req.body.payment_gateway_type,
                                        success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                        success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                    });
                                })

                            } else if(is_rental_trip_additional_payment){

                                let total_wallet_amount = utils.addWalletHistory(
                                    constant_json.USER_UNIQUE_NUMBER, 
                                    detail.unique_id, 
                                    detail._id, 
                                    null,
                                    detail.wallet_currency_code, 
                                    trip_detail.currencycode,
                                    1, 
                                    trip_detail.total_additional_charge, 
                                    detail.wallet, 
                                    constant_json.DEDUCT_WALLET_AMOUNT, 
                                    constant_json.PAID_TRIP_AMOUNT, 
                                    "Additional Charge Of This Rental Trip : " + trip_detail.unique_id
                                );
                                detail.wallet = total_wallet_amount;    
                                detail.save();

                                let user_type = TYPE_VALUE.USER;
                                let trip_status = trip_detail.trip_status;
                                let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                                trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                                trip_detail.wallet_payment = total + total_wallet_amount;                                
                                rental_trip.provider_completed_time = new Date();
                                rental_trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
                                rental_trip.is_trip_completed = 1;
                                rental_trip.is_trip_end = 1;

                                const newStatus = {
                                    status: RENTAL_TRIP_STATUS.COMPLETED,
                                    timestamp: new Date(),
                                    user_type: user_type,
                                    username: detail.first_name + " " + detail.last_name,
                                    user_id: detail._id
                                };
                                trip_status.push(newStatus);
                                trip_detail.trip_status = trip_status;

                                trip_detail.save(async() => {
                                    await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id)
                                    await Car_Rent_Vehicle.updateOne(
                                        { _id: trip_detail.vehicle_id },
                                        { $inc: { completed_request: 1 } }
                                    );
                                    await User.updateOne(
                                        { _id: trip_detail.user_id },
                                        { $inc: { rental_completed_request: 1 } }
                                    );
                                    await Provider.updateOne(
                                        { _id: trip_detail.provider_id },
                                        { $inc: { rental_completed_request: 1 } }
                                    );
                                    return res.json({ 
                                        success: true,
                                        payment_gateway_type: req.body.payment_gateway_type,
                                        success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                        success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                    });
                                })

                            } else {
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
                                    trip_detail.is_paid = 1;
                                    trip_detail.is_pending_payments = 0;
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
                                                return res.json({ 
                                                    success: true,
                                                    payment_gateway_type: req.body.payment_gateway_type,
                                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                                });
                                            });
                                        } else {
                                            return res.json({ 
                                                success: true,
                                                payment_gateway_type: req.body.payment_gateway_type,
                                                success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                            });
                                        }
                                    });
                                })
                            }
                        } else {
                            return res.json({ 
                                success: false, 
                                error_message: error.raw.message, 
                                error_code: String(error_message.DEFAULT_ERROR_CODE)
                            });
                        }                                    
                    }
                } else {
                    stripe.customers.create({
                        payment_method: req.body.payment_method,
                        email: detail.email,
                        name: detail.name,
                        phone: detail.phone
                    }, async function (err, customer) {
                        if(wallet_currency_code == ""){
                            wallet_currency_code = setting_detail.adminCurrencyCode
                        }

                        let data = {
                            body: {
                                amount: Math.round((amount * 100)),
                                currency: wallet_currency_code,
                                customer: customer.id,
                                payment_method: req.body.payment_method
                            }
                        }
                        let paymentIntent = null;
                        let error = null;
                        let payment_res = await exports.create_payment_intent(data, null)
                        if(payment_res.success){
                            paymentIntent = payment_res.paymentIntent
                        }else{
                            error = payment_res.error;
                        }
                        if(paymentIntent){
                            if(trip_detail){
                                if(!is_rental_trip_payment){
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
                                } else {
                                    trip_detail.payment_intent_id = paymentIntent.id;
                                    trip_detail.save();
                                }
                            }
                            return res.json({ 
                                success: true, 
                                payment_method: req.body.payment_method, 
                                client_secret: paymentIntent.client_secret, 
                                payment_gateway_type: req.body.payment_gateway_type, 
                                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                success_message: ""  
                            });
                        } else {
                            if (trip_detail && !req.body.is_payment_for_tip && error.raw.code == "amount_too_small") {
                                // for rental trip
                                if(is_rental_trip_payment){

                                    let total_wallet_amount = utils.addWalletHistory(
                                        constant_json.USER_UNIQUE_NUMBER, 
                                        detail.unique_id, 
                                        detail._id, 
                                        null,
                                        detail.wallet_currency_code, 
                                        trip_detail.currencycode,
                                        1, 
                                        trip_detail.total, 
                                        detail.wallet, 
                                        constant_json.DEDUCT_WALLET_AMOUNT, 
                                        constant_json.PAID_TRIP_AMOUNT, 
                                        "Charge Of This Rental Trip : " + trip_detail.unique_id
                                    );
                                    detail.wallet = total_wallet_amount;    
                                    detail.save();
    
                                    trip_detail.is_paid = 1;
                                    trip_detail.remaining_payment = 0;
                                    trip_detail.wallet_payment = total;
                                    trip_detail.is_pending_payments = 0;
                                    trip_detail.user_payment_time = new Date();
                                    trip_detail.total_after_wallet_payment = 0;
                                    trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                                    trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                                    
                                    let user_type = TYPE_VALUE.USER;
                                    let trip_status = trip_detail.trip_status;
                                    const newStatus = {
                                        status: RENTAL_TRIP_STATUS.PAYMENT,
                                        timestamp: new Date(),
                                        user_type: user_type,
                                        username: detail.first_name + " " + detail.last_name,
                                        user_id: detail._id
                                    };
                                    trip_status.push(newStatus);
                                    trip_detail.trip_status = trip_status;
    
                                    trip_detail.save(() => {
                                        return res.json({ 
                                            success: true,
                                            payment_gateway_type: req.body.payment_gateway_type,
                                            success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                        });
                                    })
    
                                } else if(is_rental_trip_additional_payment){
    
                                    let total_wallet_amount = utils.addWalletHistory(
                                        constant_json.USER_UNIQUE_NUMBER, 
                                        detail.unique_id, 
                                        detail._id, 
                                        null,
                                        detail.wallet_currency_code, 
                                        trip_detail.currencycode,
                                        1, 
                                        trip_detail.total_additional_charge, 
                                        detail.wallet, 
                                        constant_json.DEDUCT_WALLET_AMOUNT, 
                                        constant_json.PAID_TRIP_AMOUNT, 
                                        "Additional Charge Of This Rental Trip : " + trip_detail.unique_id
                                    );
                                    detail.wallet = total_wallet_amount;    
                                    detail.save();
    
                                    let user_type = TYPE_VALUE.USER;
                                    let trip_status = trip_detail.trip_status;
                                    let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                                    trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                                    trip_detail.wallet_payment = total + total_wallet_amount;                                
                                    trip_detail.provider_completed_time = new Date();
                                    trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                                    trip_detail.is_trip_completed = 1;
                                    trip_detail.is_trip_end = 1;

                                    const newStatus = {
                                        status: RENTAL_TRIP_STATUS.COMPLETED,
                                        timestamp: new Date(),
                                        user_type: user_type,
                                        username: detail.first_name + " " + detail.last_name,
                                        user_id: detail._id
                                    };
                                    trip_status.push(newStatus);
                                    trip_detail.trip_status = trip_status;
    
                                    trip_detail.save(async() => {
                                        await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id)
                                        await Car_Rent_Vehicle.updateOne(
                                            { _id: trip_detail.vehicle_id },
                                            { $inc: { completed_request: 1 } }
                                        );
                                        await User.updateOne(
                                            { _id: trip_detail.user_id },
                                            { $inc: { rental_completed_request: 1 } }
                                        );
                                        await Provider.updateOne(
                                            { _id: trip_detail.provider_id },
                                            { $inc: { rental_completed_request: 1 } }
                                        );
                                        return res.json({ 
                                            success: true,
                                            payment_gateway_type: req.body.payment_gateway_type,
                                            success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                        });
                                    })
    
                                } else {
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
                                        trip_detail.is_paid = 1;
                                        trip_detail.is_pending_payments = 0;
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
                                                    return res.json({ 
                                                        success: true,
                                                        payment_gateway_type: req.body.payment_gateway_type,
                                                        success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                        success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                                    });
                                                });
                                            } else {
                                                return res.json({ 
                                                    success: true,
                                                    payment_gateway_type: req.body.payment_gateway_type,
                                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                                });
                                            }
                                        });
                                    })
                                }
                            } else {
                                return res.json({ 
                                    success: false, 
                                    error_message: error.raw.message, 
                                    error_code: String(error_message.DEFAULT_ERROR_CODE)
                                });
                            }  
                        }
                    });
                }
            } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paystack){
                let card_detail = await Card.findOne({user_id: detail._id, payment_gateway_type: PAYMENT_GATEWAY.paystack, is_default: true});
                if(card_detail){
                    console.log(amount);
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
                            console.log(payment_response);
                            if(payment_response.status){
                                if(!trip_detail){
                                    if(payment_response.data.status == 'success'){
                                        req.body.paystack_data = payment_response.data;
                                        let url = setting_detail.api_base_url + "/add_wallet_amount"
                                        const request = require('request');
                                        request.post(
                                        {
                                            url: url,
                                            headers: {
                                                "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify(req.body),
                                        }, (error, response, body) => {
                                            if (error) {
                                                console.error(error);
                                                return error
                                            } else {
                                                body = JSON.parse(body);
                                                return res.json(body)
                                            }
                                        });
                                    } else if(payment_response.data.status == 'open_url'){
                                        return res.json({success: false, error_message: 'Please Try Another Card', url: payment_response.data.url, error_code: String(error_message.DEFAULT_ERROR_CODE) })
                                    } else {
                                        return res.json({success: false, reference: payment_response.data.reference, required_param: payment_response.data.status, error_code: String(error_message.DEFAULT_ERROR_CODE)})
                                    }
                                } else {
                                    // rental trip payment
                                    if(is_rental_trip_payment){
                                        if(payment_response.data.status == 'success'){
                                            console.log("738");
                                            trip_detail.is_paid = 1;
                                            trip_detail.remaining_payment = 0;
                                            trip_detail.is_pending_payments = 0;
                                            trip_detail.user_payment_time = new Date();
                                            trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                                            trip_detail.payment_intent_id = payment_response.data.reference;
                                            trip_detail.card_payment = payment_response.data.amount / 100;
                                            
                                            let user_type = TYPE_VALUE.USER;
                                            let trip_status = trip_detail.trip_status;
                                            const newStatus = {
                                                status: RENTAL_TRIP_STATUS.PAYMENT,
                                                timestamp: new Date(),
                                                user_type: user_type,
                                                username: detail.first_name + " " + detail.last_name,
                                                user_id: detail._id
                                            };
                                            trip_status.push(newStatus);
                                            trip_detail.trip_status = trip_status;
                                            trip_detail.save().then(() => {
                                                return res.json({ 
                                                    success: true,
                                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY ),
                                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY )  
                                                });
                                            });
                                        } else if(payment_response.data.status == 'open_url'){
                                            console.log("767");
                                            return res.json({ 
                                                success: false,
                                                url: payment_response.data.url, 
                                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                error_message: ""  
                                            })
                                        } else {
                                            console.log("775");
                                            trip_detail.payment_intent_id = payment_response.data.reference;
                                            trip_detail.save().then(async () => {
                                                return res.json({ 
                                                    success: false,
                                                    reference: payment_response.data.reference, 
                                                    required_param: payment_response.data.status, 
                                                    error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                    error_message: ""
                                                });
                                            })
                                        }
                                    } else if(is_rental_trip_additional_payment){
                                        if(payment_response.data.status == 'success'){
                                            let user_type = TYPE_VALUE.USER;
                                            let trip_status = trip_detail.trip_status;
                                            let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                                            trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                                            trip_detail.additional_payment_intent_id = payment_response.data.reference;
                                            trip_detail.card_payment = trip_detail.card_payment + payment_response.data.amount / 100;
                                            trip_detail.provider_completed_time = new Date();
                                            trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                                            trip_detail.is_trip_completed = 1;
                                            trip_detail.is_trip_end = 1;

                                            const newStatus = {
                                                status: RENTAL_TRIP_STATUS.COMPLETED,
                                                timestamp: new Date(),
                                                user_type: user_type,
                                                username: detail.first_name + " " + detail.last_name,
                                                user_id: detail._id
                                            };
                                            trip_status.push(newStatus);
                                            trip_detail.trip_status = trip_status;

                                            trip_detail.save().then(async() => {
                                                await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id)
                                                await Car_Rent_Vehicle.updateOne(
                                                    { _id: trip_detail.vehicle_id },
                                                    { $inc: { completed_request: 1 } }
                                                );
                                                await User.updateOne(
                                                    { _id: trip_detail.user_id },
                                                    { $inc: { rental_completed_request: 1 } }
                                                );
                                                await Provider.updateOne(
                                                    { _id: trip_detail.provider_id },
                                                    { $inc: { rental_completed_request: 1 } }
                                                );
                                                return res.json({ 
                                                    success: true,
                                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY ),
                                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY )  
                                                });
                                            });
                                        } else if(payment_response.data.status == 'open_url'){
                                            return res.json({ 
                                                success: false,
                                                url: payment_response.data.url, 
                                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                error_message: ""  
                                            })
                                        } else {
                                            trip_detail.additional_payment_intent_id = payment_response.data.reference;
                                            trip_detail.save().then(async () => {
                                                return res.json({ 
                                                    success: false,
                                                    reference: payment_response.data.reference, 
                                                    required_param: payment_response.data.status, 
                                                    error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                    error_message: ""
                                                });
                                            })
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
                                                                        return res.json({ 
                                                                            success: true,
                                                                            payment_status: trip_detail.payment_status,
                                                                            payment_gateway_type: req.body.payment_gateway_type,
                                                                            success_code: String(success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY),
                                                                            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY)  
                                                                        });
                                                                    });
                                                                } else {
                                                                    return res.json({ 
                                                                        success: true,
                                                                        payment_status: trip_detail.payment_status,
                                                                        payment_gateway_type: req.body.payment_gateway_type,
                                                                        success_code: String(success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY),
                                                                        success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY)  
                                                                    });
                                                                }
                                                            });
                                                        } else {
                                                            return res.json({ 
                                                                success: true,
                                                                payment_status: trip_detail.payment_status,
                                                                payment_gateway_type: req.body.payment_gateway_type,
                                                                success_code: String(success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY),
                                                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY)  
                                                            });
                                                        }
                                                            
                                                    }, (err) => {
                                                        return res.json({ 
                                                            success: false,
                                                            error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                                                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                                                        });
                                                    });
    
    
                                                } else if(payment_response.data.status == 'open_url'){
                                                    trip_detail.payment_status = PAYMENT_STATUS.FAILED;
                                                    trip_detail.save().then(() => {
                                                        return res.json({ 
                                                            success: true, 
                                                            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                                            success_message: "",
                                                            payment_status: trip_detail.payment_status, url: payment_response.data.url  
                                                        })
                                                    });
                                                } else {
                                                    trip_detail.payment_status = PAYMENT_STATUS.FAILED;
                                                    trip_detail.save().then(() => {
                                                        return res.json({ 
                                                            success:false,
                                                            error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                            error_message : "",
                                                            reference: payment_response.data.reference, required_param: payment_response.data.status
                                                        })
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
                                                            if (provider.provider_type != Number(constant_json.PROVIDER_TYPE_PARTNER)) {
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
                                                            return res.json({ 
                                                                success: true,
                                                                success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY ),
                                                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY )  
                                                            });
                                                        });
                                                    });
                                                });
                                            } else if(payment_response.data.status == 'open_url'){
                                                return res.json({ 
                                                    success: false,
                                                    url: payment_response.data.url, 
                                                    error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                    error_message: ""  
                                                })
                                            } else {
                                                return res.json({ 
                                                    success: false,
                                                    reference: payment_response.data.reference, required_param: payment_response.data.status, 
                                                    error_code: String(error_message.DEFAULT_ERROR_CODE),
                                                    error_message: ""
                                                });
                                            }
                                        }
                                    }
                                }
                            } else {
                                if(payment_response.data){
                                    return res.json({ 
                                        success: false,
                                        error_code: String(error_message.DEFAULT_ERROR_CODE),
                                        error_message: payment_response.data.message,
                                    });
                                } else {
                                    return res.json({ 
                                        success: false,
                                        error_code: String(error_message.DEFAULT_ERROR_CODE),
                                        error_message: payment_response.message,
                                    });
                                }
                            }
                        })
                    }).on('error', error => {
                        console.error(error)
                    })
                    request.write(params)
                    request.end()
                } else {
                    return res.json({ 
                        success: false,
                        payment_gateway_type: req.body.payment_gateway_type,
                        error_code: String(error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST),
                    });
                }
            } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.payu){
                let txnid = '';
                let success_url = setting_detail.api_base_url;
                let fail_url = setting_detail.payments_base_url;
                let udf5 = '';
                if(req.body.trip_id){
                    udf5 = req.body.trip_id;
                    if(!req.body.is_payment_for_tip){
                        fail_url = setting_detail.api_base_url
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
                let udf4 = success_url+redirect_url;                    
                if(req.body.is_new){
                    redirect_url = req.body.is_new
                }
                
                udf4 = redirect_url;       
                let udf1 = req.body.payment_gateway_type;
                let udf2 = type;
                let udf3 = user_id;
                udf4 = redirect_url;

                udf5 = `${udf5}/${req.body?.is_rental_trip_payment}/${req.body?.is_rental_trip_additional_payment}`;

                let crypto = require('crypto');
                let productinfo = 'trip payment';
                let x = `${setting_detail.payu_key}|${txnid}|${amount}|${productinfo}|${detail.first_name} ${detail.last_name}|${detail.email}|${req.body.payment_gateway_type}|${type}|${user_id}|${udf4}|${udf5}||||||${setting_detail.payu_salt}`;
                let hash = crypto.createHash('sha512').update(x).digest('hex');

                let html = '<form action="https://test.payu.in/_payment" id="myForm" method="post"><input type="hidden" name="key" value="'+setting_detail.payu_key+'" /><input type="hidden" name="txnid" value="'+txnid+'" /><input type="hidden" name="udf1" value="'+udf1+'" /><input type="hidden" name="udf2" value="'+udf2+'" /><input type="hidden" name="udf3" value="'+udf3+'" /><input type="hidden" name="udf4" value="'+udf4+'" /><input type="hidden" name="udf5" value="'+udf5+'" /><input type="hidden" name="productinfo" value="'+productinfo+'" /><input type="hidden" name="amount" value="'+amount+'" /><input type="hidden" name="email" value="'+detail.email+'" /><input type="hidden" name="firstname" value="'+detail.first_name + ' ' + detail.last_name+'" /><input type="hidden" name="surl" value="'+success_url+'" /><input type="hidden" name="furl" value="'+fail_url+'" /><input type="hidden" name="phone" value="'+detail.phone+'" /><input type="hidden" name="hash" value="'+hash+'" /><input type="submit" varalue="submit"></form><script>document.getElementById("myForm").submit();</script>'

                return res.json({ 
                    success: true, 
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",
                    html_form: html, 
                    payment_gateway_type: req.body.payment_gateway_type  
                });
            } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paytabs){
                let trip = ''
                let amount = trip.remaining_payment;
                if(req.body.is_trip){
                    trip =  await Trip.findOne({_id:req.body.trip_id}) || await Trip_history.findOne({_id:req.body.trip_id})
                }else if(req.body.is_tip){
                    trip =  await Trip_history.findOne({_id:req.body.trip_id})   
                }

                if(is_rental_trip_payment || is_rental_trip_additional_payment){
                    trip = await Rental_Trip.findOne({_id:req.body.trip_id})
                    amount = trip.total;
                    if(is_rental_trip_additional_payment){
                        amount = trip.total_additional_charge;
                    }
                }

                let cards = await Card.findOne({user_id:req.body.user_id,is_default:1,payment_gateway_type:req.body.payment_gateway_type})
                if(!cards) {
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST),
                    });
                }
                Table.findOne({ _id: req.body.user_id }).then((user_details) => {
                    if (user_details) {
                        if (!req.body.is_web) {
                            req.body.is_web = false;
                        }
                        let is_web = req.body.is_web;
                        const params = JSON.stringify({
                            "profile_id": setting_detail.paytabs_profileId,
                            "tran_type": "sale",
                            "tran_class": "ecom",
                            "cart_id": user_details._id + Date.now(),
                            "cart_description": "add_wallet_amount",
                            "cart_currency":req.body.is_trip ? trip.currencycode : user_details.wallet_currency_code,
                            "cart_amount":(req.body.is_trip && !req.body.is_split_payment)? amount : req.body.amount,
                            "tran_ref": user_details.transaction_reference,
                           
                            "callback": req.protocol + '://' + req.headers.host  + "/payments/paytabs_add_wallet_callback?user_id=" + req.body.user_id + '&&is_web=' + is_web + '&&type=' + type + '&&payment_id=' + req.body.payment_gateway_type + '&&redirect_url=' + req.body.url + '&&wallet=' + req.body.amount + '&&last_four=' + req.body.last_four + '&&is_new=' + req.body.is_new + '&&is_trip=' + req.body.is_trip + '&&trip_id=' + trip._id  + '&&is_tip=' + req.body.is_tip + '&&is_split_payment=' + req.body.is_split_payment + '&&is_rental_trip_payment=' + is_rental_trip_payment + '&&is_rental_trip_additional_payment=' + is_rental_trip_additional_payment,


                            "return": req.protocol + '://' + req.headers.host  + "/payments/paytabs_add_wallet_callback?user_id=" + req.body.user_id + '&&is_web=' + is_web + '&&type=' + type + '&&payment_id=' + req.body.payment_gateway_type + '&&redirect_url=' + req.body.url + '&&wallet=' + req.body.amount + '&&last_four=' + req.body.last_four + '&&is_new=' + req.body.is_new + '&&is_trip=' + req.body.is_trip + '&&trip_id=' + trip._id + '&&is_tip=' + req.body.is_tip + '&&is_split_payment=' + req.body.is_split_payment + '&&is_rental_trip_payment=' + is_rental_trip_payment + '&&is_rental_trip_additional_payment=' + is_rental_trip_additional_payment,
        
                            "customer_details": {
                                "name": (user_details.first_name ? user_details.first_name: user_details.name ) + " " + (user_details.last_name ? user_details.last_name:""),
                                "email": user_details.email,
                            },
                            "hide_shipping": true,
                            "token": cards.payment_method,
                            "show_save_card": true
                        })

                        console.log(params);
                        
                        const options = {
                            hostname: 'secure-global.paytabs.com',
                            port: 443,
                            path: '/payment/request',
                            method: 'POST',
                            headers: {
                                authorization: setting_detail.paytabs_server_key,
                                'Content-Type': 'application/json'
                            }
                        }
                        const https = require("https");
                        const request = https.request(options, response => {
                            let data = ''
                            response.on('data', (chunk) => {
                                data += chunk
                            });
                            response.on('end', async () => {
                                let response = JSON.parse(data)
                                if (response.redirect_url) {
                                    await Table.findByIdAndUpdate(req.body.user_id, { transaction_reference: response.tran_ref },{new:true})
                                    return res.json({ 
                                        success: true, 
                                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                        success_message: "",
                                        authorization_url: response.redirect_url, access_code: response.trace, payment_gateway_type: req.body.payment_gateway_type  
                                    });
                                } else {
                                    return res.json({ 
                                        success: false,
                                        error_code: String(error_message.DEFAULT_ERROR_CODE),
                                        error_message: response.message,
                                    });
                                }
                            })
                        }).on('error', error => {
                            console.error(error)
                        })
                        request.write(params)
                        request.end()
                    } else {
                        return res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                        });
                    }
        
                })
            } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.razorpay){
                let trip = ''
                if(req.body.is_trip){
                    trip =  await Trip.findOne({_id:req.body.trip_id}) || await Trip_history.findOne({_id:req.body.trip_id})
                }else if(req.body.is_tip){
                    trip =  await Trip_history.findOne({_id:req.body.trip_id})   
                }

                if(is_rental_trip_payment || is_rental_trip_additional_payment){
                    trip = await Rental_Trip.findOne({_id:req.body.trip_id})
                }
                const Razorpay = require('razorpay')
                let razorpay_client_id = setting_detail.razorpay_client_id
                let razorpay_secret_key = setting_detail.razorpay_secret_key
                let instance = new Razorpay({ key_id: razorpay_client_id, key_secret: razorpay_secret_key })
                let amount;
                if (req.body.is_trip && !req.body.is_split_payment) {
                    amount = (Number(trip.remaining_payment).toFixed(2)) * 100;
                } else if (req.body.is_tip) {
                    amount = (Number(req.body.amount).toFixed(2)) * 100;
                } else {
                    amount = (Number(req.body.amount).toFixed(2)) * 100;
                }

                if (is_rental_trip_payment){
                    amount = (Number(trip.total).toFixed(2)) * 100;
                } else if (is_rental_trip_additional_payment){
                    amount = (Number(trip.total_additional_charge).toFixed(2)) * 100;
                }

                let response = await instance.orders.create({
                    amount:amount,
                    currency: detail.wallet_currency_code,
                    receipt: 'receipt#1',
                    notes: {
                        key1: 'order',
                        key2: 'creation'
                    }
                })
                if(response.id){
                    let success_url = setting_detail.api_base_url;
                    // let success_url = "http://192.168.0.153:5000";

                    let fail_url = setting_detail.payments_base_url;
                    // let fail_url = "http://192.168.0.153:5002/payment";

                    if(req.body.trip_id){
                        if(!req.body.is_payment_for_tip || is_rental_trip_payment || is_rental_trip_additional_payment){
                            success_url = success_url + '/pay_stripe_intent_payment?trip_id='+req.body.trip_id + '&&user_id=' + req.body.user_id + '&&is_rental_trip_payment=' + is_rental_trip_payment + '&&is_rental_trip_additional_payment=' + is_rental_trip_additional_payment ;
                            fail_url = fail_url + '/payment_fail?payment_gateway_type='+req.body.payment_gateway_type;
                        } else {
                            success_url = success_url + '/pay_tip_payment?amount='+req.body.amount + '&&trip_id=' + req.body.trip_id;
                            fail_url = fail_url + '/payment_fail?payment_gateway_type='+req.body.payment_gateway_type;
                        }
                    } else {
                        success_url = success_url  + '/add_wallet_amount?payment_gateway_type='+req.body.payment_gateway_type +  '&&amount='+req.body.amount + '&&user_id=' + req.body.user_id + '&&type=' + req.body.type;
                        fail_url = fail_url + '/payment_fail?payment_gateway_type='+req.body.payment_gateway_type;
                    }
                    if(req.body.is_new){
                        success_url = success_url + '&&is_new='+ req.body.is_new 
                        fail_url = fail_url + '&&is_new='+ req.body.is_new
                    }
                 
                    let html = `<h5>Redirecting to Payment Gateway</h5><br><button id="rzp-button1" style="visibility: hidden;">Pay</button>
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <script>
                    let options = {
                        "key": "`+ razorpay_client_id + `",
                        "amount": "`+ response.amount + `",
                        "currency": "INR",
                        "name": "`+ setting_detail.app_name + `",
                        "description": "`+ setting_detail.app_name + `",
                        "image": "`+ setting_detail.api_base_url + `/web_images/user_logo.png",
                        "order_id": "`+ response.id + `",
                        "callback_url": "`+ success_url + `",
                        "cancel_url": "`+ fail_url + `",
                        "prefill": {
                            "name": "`+ (detail.first_name + " " + detail.last_name) + `",
                            "email": "`+ detail?.email + `",
                            "contact": "`+ (detail?.phone) + `"
                        },
                        "notes": {
                            "address": "`+ detail?.address + `"
                        },
                        "theme": {
                            "color": "#000000"
                        }
                    };
                    let rzp1 = new Razorpay(options);
                    document.getElementById('rzp-button1').onclick = function(e){
                        rzp1.open();
                        e.preventDefault();
                    }
                    </script>
                    <script>document.getElementById('rzp-button1').click();</script>`

                   let options = {
                        "key": razorpay_client_id ,
                        "amount": response.amount,
                        "currency": "INR",
                        "name": setting_detail.app_name,
                        "description": setting_detail.app_name,
                        "image": setting_detail.api_base_url + "/web_images/user_logo.png",
                        "order_id": response.id,
                        "callback_url": success_url,
                        "cancel_url": fail_url,
                        "prefill": {
                            "name": (detail.first_name + " " + detail.last_name),
                            "email": detail?.email,
                            "contact": (detail?.phone)
                        },
                        "notes": {
                            "address": detail?.address
                        },
                        "theme": {
                            "color": "#000000"
                        }
                    }

                    return res.json({ 
                        success: true, 
                        success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                        success_message: "",
                        html_form: html, 
                        payment_gateway_type: req.body.payment_gateway_type,options 
                    });
                }else{
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_PAYMENT_FAILED),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_PAYMENT_FAILED),
                    });
                }
                
            } else {
                return res.json({ 
                    success: true, 
                    success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                    success_message: "",
                    payment_gateway_type: req.body.payment_gateway_type  
                });
            }
        } catch (error) {
            if(error.raw){
                return res.json({ 
                    success: false,
                    error_code: String(error_message.DEFAULT_ERROR_CODE),
                    error_message: error.raw.message,
                });
            } else {
                return res.json({ 
                    success: false,
                    error_code: String(error_message.DEFAULT_ERROR_CODE),
                    error_message: error.message,
                });
            }
        }
    });
}

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
            let Table;
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
                            //for ejs Code global.message =   _messages.success_message_add_card;
                            res_data.redirect(redirect_url);
                        } else {
                            res_data.redirect('/add_card_success');
                        }
                        
                    });
                });
            });
        } else {
            return res.json({ 
                success: false,
                error_code: String(error_message.DEFAULT_ERROR_CODE),
                error_message: response.message,
            });
        }
      })
    }).on('error', error => {
      console.error(error)
    })
    request.end()
        
}

exports.send_paystack_required_detail = async function (req, res) {
    console.log("send_paystack_required_detail");
    console.log(req.body);
    
    let setting_detail = await Settings.findOne({})
    let body_params = {
        "reference": req.body.reference
    }
    let is_main_user = true;
    let split_payment_index = null;
    const is_rental_trip_payment = req.body.is_rental_trip_payment ? req.body.is_rental_trip_payment : false;
    const is_rental_trip_additional_payment = req.body.is_rental_trip_additional_payment ? req.body.is_rental_trip_additional_payment : false;

    let url;
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
        default:
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
        console.log(payment_response);
        if(payment_response.status){
            if(!req.body.trip_id){
                if(payment_response.data.status == 'success'){
                    req.body.paystack_data = payment_response.data;
                    let url = setting_detail.api_base_url + "/add_wallet_amount"
                    const request = require('request');
                    request.post(
                    {
                        url: url,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(req.body),
                    }, (error, response, body) => {
                        if (error) {
                            console.error(error);
                            return error
                        } else {
                            body = JSON.parse(body);
                            return res.json(body)
                        }
                    });
                } else if(payment_response.data.status == 'open_url'){
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.DEFAULT_ERROR_CODE),
                        error_message: 'Please Try Another Card',
                        url: payment_response.data.url
                    });
                } else {
                    return res.json({ success: false, error_code: String(error_message.DEFAULT_ERROR_CODE), reference: payment_response.data.reference, required_param: payment_response.data.status })
                }
            } else {
                if(is_rental_trip_payment){
                    Rental_Trip.findOne({ _id: req.body.trip_id}).then((trip_detail) => {

                        if(!trip_detail){
                            return res.json({ 
                                success: false,
                                error_code: String(error_message.ERROR_CODE_TRIP_NOT_FOUND),
                                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_TRIP_NOT_FOUND),
                            });
                        }

                        if(payment_response.data.status == 'success'){

                            trip_detail.is_paid = 1;
                            trip_detail.remaining_payment = 0;
                            trip_detail.is_pending_payments = 0;
                            trip_detail.user_payment_time = new Date();
                            trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                            trip_detail.card_payment = payment_response.data.amount / 100;
                            
                            let user_type = TYPE_VALUE.USER;
                            let trip_status = trip_detail.trip_status;
                            const newStatus = {
                                status: RENTAL_TRIP_STATUS.PAYMENT,
                                timestamp: new Date(),
                                user_type: user_type,
                                username: trip_detail.user_first_name + " " + trip_detail.user_last_name,
                                user_id: trip_detail.user_id
                            };
                            trip_status.push(newStatus);
                            trip_detail.trip_status = trip_status;
    
                            trip_detail.save().then(() => {
                                return res.json({ 
                                    success: true,
                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY ),
                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY )  
                                });
                            });
                        } else if(payment_response.data.status == 'open_url'){
                            return res.json({ 
                                success: false,
                                url: payment_response.data.url, 
                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                error_message: "Please Try Another Card"
                            })
                        } else {
                            return res.json({ 
                                success: false,
                                reference: payment_response.data.reference, 
                                required_param: payment_response.data.status, 
                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                error_message: ""
                            });
                        }
                    })
                } else if(is_rental_trip_additional_payment){
                    Rental_Trip.findOne({ _id: req.body.trip_id}).then(async(trip_detail) => {

                        if(!trip_detail){
                            return res.json({ 
                                success: false,
                                error_code: String(error_message.ERROR_CODE_TRIP_NOT_FOUND),
                                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_TRIP_NOT_FOUND),
                            });
                        }

                        if(payment_response.data.status == 'success'){
                            let user_type = TYPE_VALUE.USER;
                            let trip_status = trip_detail.trip_status;
                            let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                            trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                            trip_detail.card_payment = trip_detail.card_payment + payment_response.data.amount / 100;
                            trip_detail.provider_completed_time = new Date();
                            trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                            trip_detail.is_trip_completed = 1;
                            trip_detail.is_trip_end = 1;
                            
                            const newStatus = {
                                status: RENTAL_TRIP_STATUS.COMPLETED,
                                timestamp: new Date(),
                                user_type: user_type,
                                username: trip_detail.user_first_name + " " + trip_detail.user_last_name,
                                user_id: trip_detail.user_id
                            };
                            trip_status.push(newStatus);
                            trip_detail.trip_status = trip_status;
    
                            trip_detail.save().then(async() => {
                                await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id)
                                await Car_Rent_Vehicle.updateOne(
                                    { _id: trip_detail.vehicle_id },
                                    { $inc: { completed_request: 1 } }
                                );
                                await User.updateOne(
                                    { _id: trip_detail.user_id },
                                    { $inc: { rental_completed_request: 1 } }
                                );
                                await Provider.updateOne(
                                    { _id: trip_detail.provider_id },
                                    { $inc: { rental_completed_request: 1 } }
                                );
                                return res.json({ 
                                    success: true,
                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY ),
                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY )  
                                });
                            });
                        } else if(payment_response.data.status == 'open_url'){
                            return res.json({ 
                                success: false,
                                url: payment_response.data.url, 
                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                error_message: "Please Try Another Card"
                            })
                        } else {
                            return res.json({ 
                                success: false,
                                reference: payment_response.data.reference, 
                                required_param: payment_response.data.status, 
                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                error_message: ""
                            });
                        }
                    })
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
                                                            return res.json({ 
                                                                success: true,
                                                                success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY ),
                                                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY )  
                                                            });
                                                        });
                                                    } else {
                                                        return res.json({ 
                                                            success: true,
                                                            success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                                        });
                                                    }
                                                });
                                            } else {
                                                return res.json({ 
                                                    success: true,
                                                    success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                                });
                                            }
                                        });
                                    } else if(payment_response.data.status == 'open_url'){
                                        return res.json({ 
                                            success: false,
                                            error_code: String(error_message.DEFAULT_ERROR_CODE),
                                            error_message: 'Please Try Another Card',
                                            url: payment_response.data.url
                                        });
                                    } else {
                                        return res.json({ success: false, error_code: String(error_message.DEFAULT_ERROR_CODE), reference: payment_response.data.reference, required_param: payment_response.data.status })
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
                                                    if (provider.provider_type != Number(constant_json.PROVIDER_TYPE_PARTNER)) {
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
                                                    return res.json({ 
                                                        success: true,
                                                        success_code: String(success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY),
                                                        success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYMENT_PAID_FROM_WALLET_SUCCESSFULLY)  
                                                    });
                                                });
                                            });
                                        });
                                    } else if(payment_response.data.status == 'open_url'){
                                        return res.json({ 
                                            success: false,
                                            error_code: String(error_message.DEFAULT_ERROR_CODE),
                                            error_message: 'Please Try Another Card',
                                            url: payment_response.data.url
                                        });
                                    } else {
                                        return res.json({ success: false, error_code: String(error_message.DEFAULT_ERROR_CODE), reference: payment_response.data.reference, required_param: payment_response.data.status })
                                    }
                                }
                            } else {
                                return res.json({ 
                                    success: false,
                                    error_code: String(error_message.ERROR_CODE_TRIP_NOT_FOUND),
                                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_TRIP_NOT_FOUND),
                                });
                            }
                        });
                    });
                }
            }
        } else {
            if(payment_response.data){
                return res.json({success: false, error_code: String(error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING), error_message: payment_response.data.message})
            } else {
                return res.json({success: false, error_code: String(error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING), error_message: payment_response.message})
            }
        }
      })
    }).on('error', error => {
      console.error(error)
    })
    request.write(params)
    request.end()

}

exports.retrieve_payment_intent = async function (req, res) {
    let stripe_secret_key = setting_detail.stripe_secret_key;
    let stripe = require("stripe")(stripe_secret_key);
    stripe.setApiVersion('2020-08-27');
    stripe.paymentIntents.retrieve(req.body.payment_intent_id, function (error, intent) {
        if(error){
            return res.json({ 
                success:false,
                error_code:String(error_message.DEFAULT_ERROR_CODE),
                error_message : error
            })
        }
        return res.json({ 
            success: true,
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message : "",
            intent: intent
        })
    })
}

exports.create_refund = async function (req, res) {
    let stripe_secret_key = setting_detail.stripe_secret_key;
    let stripe = require("stripe")(stripe_secret_key);
    stripe.setApiVersion('2020-08-27');
    let charge_id = req.body.payment_intent_id;
    stripe.refunds.create({
        payment_intent: charge_id
    }, function (err, refund) {
        if (refund) {
            return res.json({ 
                success:true,
                error_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message : "",
                refund: refund
            })
        } else {
            return res.json({ 
                success:false,
                error_code: String(error_message.DEFAULT_ERROR_CODE),
                error_message : err
            })
        }
    });
}

exports.refund_payment = async function (reference, payment_gateway_type,currency, amount) {
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
    }else if(payment_gateway_type == PAYMENT_GATEWAY.paytabs){
        const params = JSON.stringify({
            "profile_id": setting_detail.paytabs_profileId,
            "tran_type": "refund",
            "tran_class": "ecom",
            "tran_ref": reference,
            "cart_id": "Unique order reference",
            "cart_description": "Add card refund",
            "cart_currency": currency,  
            "cart_amount": Number(amount)
        })
        const options = {
            hostname: 'secure-global.paytabs.com',
            port: 443,
            path: '/payment/request',
            method: 'POST',
            headers: {
                authorization: setting_detail.paytabs_server_key,
                'Content-Type': 'application/json'
            }
        }
        const https = require('https')  
        const req = https.request(options, res => {
            let data = ''
            res.on('data', (chunk) => {
                data += chunk
            });
            res.on('end', () => {
                JSON.parse(data)
            })
        }).on('error', error => {
            console.error(error)
        })
        req.write(params)
        req.end()
    }
}

exports.create_transfer = async function (req, res) {
    let stripe_secret_key = setting_detail.stripe_secret_key;
    let stripe = require("stripe")(stripe_secret_key);
    stripe.setApiVersion('2020-08-27');
    stripe.transfers.create(req.body, function (error, transfer) {
        if (transfer) {
            return res.json({ 
                success: true, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "" ,
                transfer: transfer 
            });
        } else {
            return res.json({ 
                success: false,
                error_code: String(error_message.DEFAULT_ERROR_CODE),
                error_message : error
            })
        }
    });

}

exports.create_payment_intent = async function (req, res) {
    console.log(" ****** create_payment_intent ****** ");
    return new Promise(async (resolve, reject) => {
        try {
            let stripe_secret_key = setting_detail.stripe_secret_key;
            let stripe = require("stripe")(stripe_secret_key);
            stripe.setApiVersion('2020-08-27');
            stripe.paymentIntents.create(req.body, function (error, paymentIntent) {
                if (paymentIntent) {
                    if(res){
                        return res.json({ 
                            success: true,
                            paymentIntent: paymentIntent, 
                            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                            success_message: ""  
                        });
                    }
                    resolve({success: true, paymentIntent: paymentIntent})
                } else {
                    if(res){
                        return res.json({ 
                            success:false,
                            error_code: String(error_message.DEFAULT_ERROR_CODE),
                            error_message : error
                        })
                    }
                    resolve({success: false, error: error})
                }
            })
        } catch (error) {
            resolve({success: false, error: error})
        }
    })
}

exports.card_list = async function (req, res) { 
    let setting_detail = await Settings.findOne({})
    utils.check_request_params(req.body, [{name: 'user_id', type: 'string'}], function (response) {
        if (response.success) {
            let type = Number(req.body.type)
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

            Table.findOne({_id: req.body.user_id}).then(async (detail) => { 
                if (!detail) {
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_FOR_PORBLEM_IN_FETCHIN_CARD),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_FOR_PORBLEM_IN_FETCHIN_CARD)
                    });
                } else {

                    let country_query = { _id: detail.country_id }
                    if(type == Number(constant_json.USER_UNIQUE_NUMBER)) {
                        country_query = { alpha2: detail.alpha2 }
                    }

                /* The following code was causing an issue while finding country, particularly in cases where the country code was identical which lead to inconsistency"  
                    
                    // there are multiples countries with same phone code so added other condition
                    let new_country_query = { countryphonecode: detail.country_phone_code, countryname: detail.country };
                    if ([constant_json.PROVIDER_UNIQUE_NUMBER, constant_json.CORPORATE_UNIQUE_NUMBER, constant_json.PARTNER_UNIQUE_NUMBER].includes(String(type))) {
                        new_country_query = { _id: detail.country_id }
                    }
                    // kept old condition if any old user don't have new existing data due to old db mis match
                    let country_query = {countryphonecode: detail.country_phone_code}
                    if (type == Number(constant_json.PROVIDER_UNIQUE_NUMBER)) {
                        country_query = {_id: detail.country_id}
                    }

                */

                    let country_detail = await Country.findOne(country_query);
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
                                return res.json({ 
                                    success: true,
                                    success_code: String(success_messages.MESSAGE_CODE_GET_ALL_CARD_SUCCESSFULLY),
                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_GET_ALL_CARD_SUCCESSFULLY),
                                    wallet: wallet,
                                    wallet_currency_code: wallet_currency_code,
                                    is_use_wallet: is_use_wallet,
                                    payment_gateway: PAYMENT_TYPES,
                                    payment_gateway_type: Number(payment_gateway_type),
                                    card: card
                                });
                            } else {
                                return res.json({ 
                                    success: true,
                                    success_code: String(success_messages.MESSAGE_CODE_GET_ALL_CARD_SUCCESSFULLY),
                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_GET_ALL_CARD_SUCCESSFULLY),
                                    wallet: wallet,
                                    wallet_currency_code: wallet_currency_code,
                                    payment_gateway: PAYMENT_TYPES,
                                    payment_gateway_type: Number(payment_gateway_type),
                                    card: card 
                                });
                            }
                        });
                }
            });
        } else {
            return res.json({
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message
            });
        }
    });
};

exports.get_stripe_add_card_intent = async function (req, res_data) {
    let setting_detail = await Settings.findOne({})
    if(!req.body.payment_gateway_type || req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe){
        let stripe = require("stripe")(setting_detail.stripe_secret_key);
        stripe.setApiVersion('2020-08-27');
        stripe.setupIntents.create({
            usage: 'on_session'
        }, function(error, paymentIntent){
            return res_data.json({ 
                success: true, 
                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                success_message: "",
                client_secret: paymentIntent.client_secret 
            });
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
            if(detail){
                const params = JSON.stringify({
                  "email": detail.email,
                  "phone": detail.country_phone_code + detail.phone,
                  "amount": "100",
                  callback_url: req.protocol + '://' + req.get('host') + "/payments/paystack_add_card_callback?user_id="+req.body.user_id+'&&type='+type+'&&is_web='+is_web+'&&is_new='+req.body.is_new
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
                        return res_data.json({ 
                            success: true, 
                            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                            success_message: "",
                            authorization_url: response.data.authorization_url, access_code: response.data.access_code  
                        });
                    } else {
                        return res_data.json({ 
                            success:false,
                            error_message : response.message,
                            error_code: String(error_message.DEFAULT_ERROR_CODE)
                        })
                    }
                  })
                }).on('error', error => {
                  console.error(error)
                })
                request.write(params)
                request.end()
            } else {
                return res_data.json({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_FOR_PORBLEM_IN_FETCHIN_CARD),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_FOR_PORBLEM_IN_FETCHIN_CARD)
                });
            }
        });

    }else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paytabs){
        let type = Number(req.body.type)
        let Table = User;
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
        Table.findOne({ _id: req.body.user_id }).then((user_details) => {
            if (user_details) {
                if (!req.body.is_web) {
                    req.body.is_web = false;
                }
                console.log(req.body);
                let is_web = req.body.is_web
                const params = JSON.stringify({
                    "profile_id": setting_detail.paytabs_profileId,
                    "tran_type": "sale",
                    "tran_class": "ecom",
                    "cart_id": user_details._id + Date.now(),
                    "cart_description": "add card =>" + (user_details.first_name ? user_details.first_name: user_details.name ) + " " + (user_details.last_name ? user_details.last_name:"") + " " + user_details.email + " " + user_details.country_phone_code + " " + user_details.phone,
                    "cart_currency": user_details.wallet_currency_code,
                    "cart_amount": 1,
                    "callback": req.protocol + '://' + req.headers.host + "/payments/paytabs_add_card_callback?user_id=" + req.body.user_id + '&&is_web=' + is_web + '&&type=' + type + '&&payment_id=' + req.body.payment_gateway_type + '&&redirect_url=' + req.body.url + '&&is_new=' + req.body.is_new,
                    "return": req.protocol + '://' + req.headers.host + "/payments/paytabs_add_card_callback?user_id=" + req.body.user_id + '&&is_web=' + is_web + '&&type=' + type + '&&payment_id=' + req.body.payment_gateway_type + '&&redirect_url=' + req.body.url + '&&is_new=' + req.body.is_new,

                    "customer_details": {
                        "name": (user_details.first_name ? user_details.first_name: user_details.name ) + " " + (user_details.last_name ? user_details.last_name:""),
                        "email": user_details.email,
                    },
                    "hide_shipping": true,
                    "tokenise": 2,
                    "show_save_card": true
                })
                const options = {
                    hostname: 'secure-global.paytabs.com',
                    port: 443,
                    path: '/payment/request',
                    method: 'POST',
                    headers: {
                        authorization: setting_detail.paytabs_server_key,
                        'Content-Type': 'application/json'
                    }
                }
                const https = require("https");
                const request = https.request(options, res => {
                    let data = ''
                    res.on('data', (chunk) => {
                        data += chunk
                    });
                    res.on('end', async () => {
                        let response = JSON.parse(data)
                        if (response.redirect_url) {
                            await Table.findByIdAndUpdate(user_details._id, { transaction_reference: response.tran_ref },{new:true})
                            return res_data.json({ 
                                success: true, 
                                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                success_message: "",
                                authorization_url: response.redirect_url, 
                                access_code: response.trace 
                            });
                        } else {
                            return res_data.json({ 
                                success: false,
                                error_code: String(error_message.DEFAULT_ERROR_CODE),
                                error_message : response.message
                            })
                        }
                    })
                }).on('error', error => {
                    console.error(error)
                })
                request.write(params)
                request.end()
            } else {
                return res_data.json({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND)
                });

            }

        })
    } else {
        return res_data.json({ 
            success:false,
            error_code: String(error_message.DEFAULT_ERROR_CODE),
            error_message : ""
        })
    }
}

exports.paytabs_add_card_callback = async function (request_data, response_data) {
    let Table;
    let type = Number(request_data.query.type);
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
    Settings.findOne({}).then((setting_detail) => {
            Table.findOne({ _id: request_data.query.user_id }).then((user_details) => {
                if (user_details) {
                    const params = JSON.stringify({
                        "profile_id": setting_detail.paytabs_profileId,
                        "tran_ref": user_details.transaction_reference,
                    })
                    const options = {
                        hostname: 'secure-global.paytabs.com',
                        port: 443,
                        path: '/payment/query',
                        method: 'POST',
                        headers: {
                            authorization: setting_detail.paytabs_server_key ,
                            'Content-Type': 'application/json'
                        }
                    }
                    const https = require("https");
                    const request = https.request(options, res => {
                        let data = ''
                        res.on('data', (chunk) => {
                            data += chunk
                        });
                        res.on('end', async () => {
                            let response = JSON.parse(data)
                            if (response.payment_result.response_status === 'A') {
                                let already_added_card = await Card.find({customer_id:response.tran_ref,payment_gateway_type:PAYMENT_GATEWAY.paytabs,user_id:user_details._id})
                                if(already_added_card.length > 0 ){
                                    if (request_data.query.is_new != 'undefined') {
                                        response_data.redirect(request_data.query.is_new + '?open_modal=true');
                                    } else {
                                        response_data.redirect(setting_detail.payments_base_url + '/add_card_success');
                                    }
                                }else{
                                    exports.refund_payment(user_details.transaction_reference,PAYMENT_GATEWAY.paytabs,user_details.wallet_currency_code,1)
                                    let card = new Card({
                                        user_type: user_details.admin_type,
                                        user_id: request_data.query.user_id,
                                        last_four: (response.payment_info.payment_description).split(' ')[3],
                                        card_type: response.payment_info.card_type,
                                        payment_gateway_type: PAYMENT_GATEWAY.paytabs,
                                        customer_id: response.tran_ref,
                                        type:type,
                                        is_default: false,
                                        payment_method: response.token
                                    })
                                    let cards = await Card.findOne({user_id: request_data.query.user_id, payment_gateway_type: PAYMENT_GATEWAY.paytabs, is_default: true});
                                    if(!cards){
                                        card.is_default = true  
                                    }
                                    card.save().then(async () => {
                                        let base_URL = setting_detail.api_base_url
                                        let url = base_URL + '/socket_call_for_paytab_add_card'
                                        data = {
                                            id: request_data.query.user_id
                                        }
                                        
                                        const request = require("request");   
                                        request.post(
                                            {
                                                url: url,
                                                headers: {
                                                    "Content-Type": "application/json"
                                                },
                                                body: JSON.stringify(data),
                                            },
                                            (error, response, body) => {
                                                
                                                if (error) {
                                                    console.error(error);
                                                    
                                                } else {
                                                    console.log('SUCCESS');
                                                }}
                                        )
                                        if (request_data.query.is_new != 'undefined') {
                                            response_data.redirect(request_data.query.is_new + '?open_modal=true');
                                        } else {
                                            response_data.redirect(setting_detail.payments_base_url + '/add_card_success');
                                        }
                                    })
                                }
                               
                            } else if (response.payment_result.response_status === 'D') {
                                let base_URL = setting_detail.api_base_url
                                let url = base_URL + '/socket_call_for_paytab_add_card'
                                data = {
                                    id: request_data.query.user_id,
                                    msg: response.payment_result.response_message
                                }
                                if (request_data.query.is_new) {
                                    const request = require("request");   
                                    request.post(
                                        {
                                            url: url,
                                            headers: {
                                                "Content-Type": "application/json"
                                            },
                                            body: JSON.stringify(data),
                                        },
                                        (error, response, body) => {
                                            
                                            if (error) {
                                                console.error(error);
                                              
                                            } else {
                                                console.log('SUCCESS');
                                            }}
                                            )
                                }

                                if (request_data.query.is_new != 'undefined') {
                                    response_data.redirect(request_data.query.is_new + '?open_modal=true');
                                } else {
                                    response_data.redirect(setting_detail.payments_base_url + '/fail_stripe_intent_payment');
                                }

                            } else {
                                if(request_data.query.is_new != 'undefined'){
                                response_data.redirect(request_data.query.is_new);
                                }else{
                                    response_data.redirect(setting_detail.payments_base_url + '/fail_stripe_intent_payment');
                                }
                            }
                        })
                    }).on('error', error => {
                        console.error(error)
                    })
                    request.write(params)
                    request.end()
                } else {
                    return response_data.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND)
                    });
                }
            })
    })
}

exports.paytabs_add_wallet_callback = async function (request_data, response_data) {

    console.log("paytabs_add_wallet_callback");
    console.log(request_data.body);
    console.log(request_data.query);

    let Table;
    let type = Number(request_data.query.type);
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
    Settings.findOne({}).then((setting_detail) => {
        Table.findOne({ _id: request_data.query.user_id }).then((user_details) => {
            if (user_details) {
                const params = JSON.stringify({
                    "profile_id": setting_detail.paytabs_profileId,
                    "tran_ref": user_details.transaction_reference,
                })
                const options = {
                    hostname: 'secure-global.paytabs.com',
                    port: 443,
                    path: '/payment/query',
                    method: 'POST',
                    headers: {
                        authorization: setting_detail.paytabs_server_key ,
                        'Content-Type': 'application/json'
                    }
                }
                const https = require("https");
                const request = https.request(options, res => {
                    let data = ''
                    res.on('data', (chunk) => {
                        data += chunk
                    });
                    res.on('end', async () => {
                        let response = JSON.parse(data)
                        if (response.payment_result.response_status === 'A') {
                            let already_added_wallet_data = await Wallet_history.find({user_id:user_details._id, trans_ref:response.tran_ref})
                            if(already_added_wallet_data.length > 0){
                                    if (request_data.query.is_new != 'undefined') {
                                    return response_data.redirect(request_data.query.is_new + '?open_modal=true');
                                } else {
                                    return response_data.redirect(setting_detail.payments_base_url + '/fail_payment');
                                }
                            }else{
                                let success_url =  setting_detail.api_base_url;
                                // let success_url = "http://192.168.0.153:5000"
                                let url;
                                if (request_data.query.is_trip == 'true' || request_data.query.is_split_payment == 'true' || request_data.query.is_rental_trip_payment == 'true' || request_data.query.is_rental_trip_additional_payment == 'true') {
                                    url = success_url + "/pay_stripe_intent_payment";
                                } else if (request_data.query.is_tip == 'true') {
                                    url = success_url + "/pay_tip_payment";
                                } else {
                                    url = success_url + "/add_wallet_amount";
                                }

                                let data;
                                if (request_data.query.is_trip == 'true' || request_data.query.is_split_payment == 'true' || request_data.query.is_rental_trip_payment == 'true' || request_data.query.is_rental_trip_additional_payment == 'true') {
                                    data = {
                                        type: type,
                                        user_id: user_details._id,
                                        trip_id: request_data.query.trip_id,
                                        token: user_details.token,
                                        payment_gateway_type: 13,
                                        tran_ref: user_details.transaction_reference,
                                        is_rental_trip_payment : request_data.query?.is_rental_trip_payment ? request_data.query.is_rental_trip_payment : false,
                                        is_rental_trip_additional_payment : request_data.query?.is_rental_trip_additional_payment ? request_data.query.is_rental_trip_additional_payment : false
                                    };
                                } else if (request_data.query.is_tip == 'true') {
                                    data = {
                                        type: type,
                                        user_id: user_details._id,
                                        trip_id: request_data.query.trip_id,
                                        token: user_details.token,
                                        payment_gateway_type: 13,
                                        tran_total: request_data.query.wallet,
                                        tran_ref: user_details.transaction_reference
                                    };
                                } else {
                                    data = {
                                        type: type,
                                        wallet: request_data.query.wallet,
                                        user_id: user_details._id,
                                        token: user_details.token,
                                        payment_gateway_type: 13,
                                        tran_ref: user_details.transaction_reference
                                    };
                                }

                                const request = require('request')
                                request.post({
                                    url: url,
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify(data),
                                },(error, response, body) => {
                                    if (error) {
                                        console.error(error);
                                    } else {
                                        if (request_data.query.is_new != 'undefined') {
                                            return response_data.redirect(request_data.query.is_new + '?open_modal=true');
                                        } else {
                                            return response_data.redirect(setting_detail.payments_base_url + '/success_payment_paytabs');
                                        }
                                    }
                                })
                            }
                            
                        } else if (response.payment_result.response_status === 'D' || response.payment_result.response_status === 'C' ) {

                            let url = setting_detail.api_base_url + "/socket_call_for_paytab_add_card";
                            let data = {
                                id: request_data.query.user_id,
                                msg: response.payment_result.response_message
                            };

                            const request = require("request");
                            request.post(
                                {
                                    url: url,
                                    headers: {
                                    "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(data),
                                },
                                (error, response, body) => {
                                if (error) {
                                    console.error(error);
                                } else {
                                    console.log("SUCCESS");
                                }
                            });

                            let message = response?.payment_result?.response_message ? '_paytabs/'+response?.payment_result?.response_message : '';

                            if (request_data.query.is_new != "undefined") {
                                return response_data.redirect(request_data.query.is_new + "?open_modal=true" );
                            } else {
                                return response_data.redirect(setting_detail.payments_base_url + "/fail_payment" + message );
                            }

                        } else {
                            if(request_data.query.is_new != 'undefined'){
                                return response_data.redirect(request_data.query.is_new)
                            }else{
                                return response_data.redirect(setting_detail.payments_base_url + '/fail_payment');
                            }
                        }
                    })
                }).on('error', error => {
                    console.error(error)
                })
                request.write(params)
                request.end()
            } else {
                return response_data.json({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                    error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND)
                });
            }
        })
    })
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
                            return res.json({
                                success: true,
                                success_code: String(success_messages.MESSAGE_CODE_YOUR_CARD_ADDED_SUCCESSFULLY),
                                message: utils.get_response_message(req.headers.lang_code, true,success_messages.MESSAGE_CODE_YOUR_CARD_ADDED_SUCCESSFULLY),
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
                            return res.json({ 
                                success: false,
                                error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG)
                            });
                        });

                    });
                });
            });
        } else {
            return res.json({
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message
            });
        }
    });
};

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
                    if (req.body.token !== null && detail.token !== req.body.token) {
                        return res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN)
                        });
                    } else {
                        if (type == Number(constant_json.USER_UNIQUE_NUMBER)) {
                            let query = {$or:[{_id :detail.current_trip_id ,payment_mode:Number(constant_json.PAYMENT_MODE_CARD)},{user_id: detail._id, is_pending_payments: 1 }]};
                            
                            Trip.find(query).then((trips) => { 

                                if (trips.length > 0) {
                                    return res.json({ 
                                        success: false,
                                        error_code: String(error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING),
                                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING)
                                    });
                                } else {
                                    Card.findOneAndRemove({ _id: req.body.card_id, $or: [{ type: type }, { type: { $exists: false } }], user_id: req.body.user_id }).then((deleted_card) => { 
                                        let stripe_secret_key = setting_detail.stripe_secret_key;
                                        let stripe = require("stripe")(stripe_secret_key);
                                        stripe.setApiVersion('2020-08-27');
                                        stripe.paymentMethods.detach(deleted_card.payment_method, function () {
                                            return res.json({ 
                                                success: true,
                                                success_code: String(success_messages.MESSAGE_CODE_YOUR_CARD_DELETED_SUCCESSFULLY),
                                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_YOUR_CARD_DELETED_SUCCESSFULLY)  
                                            });
                                        });
                                    });
                                }
                            });
                        } else {
                            Card.findOneAndRemove({ _id: req.body.card_id, $or: [{ type: type }, { type: { $exists: false } }], user_id: req.body.user_id }).then((deleted_card) => { 
                                let stripe_secret_key = setting_detail.stripe_secret_key;
                                let stripe = require("stripe")(stripe_secret_key);
                                stripe.setApiVersion('2020-08-27');
                                stripe.paymentMethods.detach(deleted_card.payment_method, function () {
                                    return res.json({ 
                                        success: true,
                                        success_code: String(success_messages.MESSAGE_CODE_YOUR_CARD_DELETED_SUCCESSFULLY),
                                        success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_YOUR_CARD_DELETED_SUCCESSFULLY)  
                                    });
                                });
                            });
                        }
                    }
                } else {
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND)
                    });

                }
            });
        } else {
            return res.json({
                success: false,
                error_code: String(response.error_code),
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
                    return res.json({ 
                        success: false,
                        error_code: String(error_message.ERROR_CODE_CARD_NOT_FOUND),
                        error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_CARD_NOT_FOUND)
                    });
                } else {
                    card.is_default = constant_json.YES;
                    card.save().then(() => {

                        Card.findOneAndUpdate({ _id: { $nin: req.body.card_id }, $or: [{ type: type }, { type: { $exists: false } }], user_id: req.body.user_id, payment_gateway_type: payment_gateway_type, is_default: constant_json.YES }, { is_default: constant_json.NO }).then(() => {
                            return res.json({ 
                                success: true,
                                success_code: String(success_messages.MESSAGE_CODE_GET_YOUR_SELECTED_CARD),
                                success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_GET_YOUR_SELECTED_CARD),
                                card: card  
                            });

                        });
                    }, (err) => {
                        return res.json({ 
                            success: false,
                            error_code: String(error_message.ERROR_CODE_SOMETHING_WENT_WRONG),
                            error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_SOMETHING_WENT_WRONG)
                        });
                    });
                }
            });
        } else {
            return res.json({
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message
            });
        }
    });
};

exports.create_bank_account = function (req, res) {
    utils.check_request_params(req.body, [{name: 'payment_gateway_type', type: 'number'}], function (response) {
        if (response.success) {
            if(req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe){
                let pictureData_buffer1 = fs.readFileSync(req.body.files[0].path);
                let pictureData_buffer2 = fs.readFileSync(req.body.files[1].path);
                let pictureData_buffer3 = fs.readFileSync(req.body.files[2].path);
                let stripe = require("stripe")(setting_detail.stripe_secret_key);
                stripe.setApiVersion('2020-08-27');
                stripe.tokens.create({
                    bank_account: {
                        country: req.body.country_detail.alpha2, // country_detail.alpha2
                        currency: req.body.provider.wallet_currency_code ? req.body.provider.wallet_currency_code : undefined,
                        account_holder_name: req.body.account_holder_name,
                        account_holder_type: req.body.account_holder_type,
                        routing_number: req.body.routing_number,
                        account_number: req.body.account_number
                    }
                }, function (err, token) {
                    console.log(err)
                    if (err) {
                        return res.json({
                            success: false,
                            error_message: err.message,
                            error_code: String(error_message.ERROR_CODE_FOR_ACCOUNT_DETAIL_NOT_VALID)
                        });
                    } else {
                        
                        stripe.files.create({
                            file: {
                                data: pictureData_buffer1,
                                name: "front.jpg",
                                type: "application/octet-stream",
                            },
                            purpose: "identity_document",
                        }, (err, fileUpload) => {
                            console.log(err)
                            stripe.files.create({
                                file: {
                                    data: pictureData_buffer2,
                                    name: "back.jpg",
                                    type: "application/octet-stream",
                                },
                                purpose: "identity_document",
                            }, (err, fileUpload1) => {
                                console.log(err)
                                stripe.files.create({
                                    file: {
                                        data: pictureData_buffer3,
                                        name: "back.jpg",
                                        type: "application/octet-stream",
                                    },
                                    purpose: "identity_document",
                                }, (err, fileUpload2) => {
                                    console.log(err)
                                    let dob = req.body.dob;
                                    dob = dob.split('-');
                                      
                                    let phone_number = req.body.provider.country_phone_code + req.body.provider.phone ;
    
                                    let individualjson =  {
                                        first_name: req.body.provider.first_name,
                                        last_name: req.body.provider.last_name,
                                        email: req.body.provider.email,
                                        ssn_last_4: req.body.personal_id_number,
                                        phone : phone_number,
                                        gender: req.body.gender,
                                        dob: {
                                            day: dob[0],
                                            month: dob[1],
                                            year: dob[2]
                                        },
                                        address: {
                                            city: req.body.provider.city,
                                            country: req.body.country_detail.alpha2,
                                            line1: req.body.address,
                                            line2: req.body.address,
                                            postal_code: req.body.postal_code
                                        },
                                        verification: {
                                            document : {
                                                front : fileUpload.id,
                                                back : fileUpload1.id
                                            },
                                            additional_document: {
                                                front: fileUpload2.id
                                            }
                                        }
                                    }
    
                                    if(req.body.country_detail.alpha2 == "AU" && req.body.personal_id_number){
                                        delete individualjson['ssn_last_4']
                                    }

                                    stripe.accounts.create({
                                        type: 'custom',
                                        country: req.body.country_detail.alpha2, // country_detail.alpha2
                                        email: req.body.provider.email,
                                        requested_capabilities: [
                                          'card_payments',
                                          'transfers',
                                        ],
                                        business_profile: {
                                            mcc: "4789",
                                            name: req.body.provider.first_name + ' ' + req.body.provider.last_name,
                                            product_description: "We sell transportation services to passengers, and we charge once the job is complete",
                                            support_email: setting_detail.admin_email
                                        },
                                        business_type: 'individual',
                                        individual:individualjson
                                    },
                                    
                                    function (err, account) {
                                        console.log(err)
                                        if (err || !account) {
                                            return res.json({
                                                success: false,
                                                error_code: String(error_message.ERROR_CODE_FOR_ACCOUNT_DETAIL_NOT_VALID),
                                                error_message: err.message
                                            });
                                        } else {
                                            stripe.accounts.createExternalAccount(
                                                account.id,
                                                {
                                                    external_account: token.id,
                                                    default_for_currency: true
                                                },
                                                async function  (err, bank_account) {
                                                    console.log(err)
                                                    if (err || !bank_account) {
                                                        return res.json({
                                                            success: false,
                                                            error_code: String(error_message.ERROR_CODE_FOR_PROBLEM_IN_ADD_BANK_DETAIL_PLEASE_RETRY),
                                                            error_message: err.message
                                                        });
    
                                                    } else {
                                                        req.body.provider.account_id = account.id;
                                                        req.body.provider.bank_id = bank_account.id;
                                                        let provider_id = req.body.provider._id
                                                        let update = { account_id: account.id, bank_id: bank_account.id }
                                                        await Provider.findByIdAndUpdate(provider_id, update) || await Partner.findByIdAndUpdate(provider_id, update);
                                                        stripe.accounts.update(
                                                        account.id,
                                                        {
                                                            tos_acceptance: {
                                                                date: Math.floor(Date.now() / 1000),
                                                                ip: req.connection.remoteAddress // Assumes you're not using a proxy
                                                            }
                                                        }, function (err, update_bank_account) {
                                                            console.log(err)
                                                            if (err || !update_bank_account) {
                                                                return res.json({
                                                                    success: false,
                                                                    error_code: String(error_message.ERROR_CODE_FOR_PROVIDER_BANK_DETAIL_ARE_NOT_VERIFIED),
                                                                    error_message: err.message
                                                                });
                                                            } else {
                                                                return res.json({ 
                                                                    success: true,
                                                                    success_code: String(success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_ADDED_SUCCESSFULLY),
                                                                    success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_ADDED_SUCCESSFULLY)  
                                                                });
                                                            }
                                                        });
                                                    }
                                                }
                                            );
                                        }
                                    });
                                });
                            });
                        });
                    }
    
                });
            }else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paystack){
                const https = require('https')
                const options = {
                  hostname: 'api.paystack.co',
                  port: 443,
                  path: '/bank/resolve?account_number='+req.body.account_number+'&bank_code='+req.body.bank_code+'&currency=NGN',
                  method: 'GET',
                  headers: {
                    Authorization: 'Bearer '+setting_detail.paystack_secret_key
                  }
                }
                let request = https.request(options, res_data => {
                    let data = ''     
                    res_data.on('data', (chunk) => {
                        data += chunk
                    });
                    res_data.on('end', async () => {
                        let bank_account_response = JSON.parse(data);
                        if(bank_account_response.status){
                            let provider_id = req.body.provider._id
                            let update = {
                                account_id: bank_account_response.data.bank_id,
                                bank_id: bank_account_response.data.bank_id,
                                account_number: bank_account_response.data.account_number,
                                bank_code: req.body.bank_code
                            }
                            await Provider.findByIdAndUpdate(provider_id, update) || await Partner.findByIdAndUpdate(provider_id, update);

                            return res.json({ 
                                success: true, 
                                success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
                                success_message: "",
                                account_id: bank_account_response.data.bank_id,
                                bank_id: bank_account_response.data.bank_id,
                                account_number: bank_account_response.data.account_number,
                                bank_code: req.body.bank_code, 
                            });
                        } else {
                            return res.json({
                                success: false,
                                error_code: String(error_message.ERROR_CODE_FOR_ACCOUNT_DETAIL_NOT_VALID),
                                error_message: bank_account_response.message
                            });
                        }
                    })
                }).on('error', error => {
                  console.error(error)
                });
                request.end()
            }else{
                return res.json({ 
                    success:false,
                    error_code:String(error_message.DEFAULT_ERROR_CODE),
                    error_message : ""
                })
            }
        } else {
            return res.json({
                success: false,
                error_code: String(response.error_code),
                error_message: response.error_message
            });
        }
    });
};

exports.paypal_supported_currency = function (req, res) {
    try {
        let paypal_supported_currency =  ["AUD","BRL", "CNY","CZK","DKK","EUR","HKD","HUF","ILS","JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD","SEK","CHF","THB","USD"]
        return res.json({ 
            success: true,
            success_code: String(success_messages.MESSAGE_CODE_PAYPAL_SUPPORTED_CURRENCY_LIST_SUCCEED),
            success_message: utils.get_response_message(req.headers.lang_code, true, success_messages.MESSAGE_CODE_PAYPAL_SUPPORTED_CURRENCY_LIST_SUCCEED),
            response_data: paypal_supported_currency  
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.change_payment_gateway_type = async (req,res) => {
    try {
        let params_array = [{ name: 'use_id', type: 'string' },{ name: 'token', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return res.json(response);
        }
        let user = await User.findById(req.body.use_id)
        if(!user){
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND)
            });
        }
        if (req.body.token != null && user.token != req.body.token) {
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_INVALID_TOKEN),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_INVALID_TOKEN)
            });
        }
        let country = await Country.findOne({"countryname":user.country})
        if(!country){
            return res.json({ 
                success: false,
                error_code: String(error_message.ERROR_CODE_COUNTRY_NOT_FOUND),
                error_message: utils.get_response_message(req.headers.lang_code, false, error_message.ERROR_CODE_COUNTRY_NOT_FOUND)
            });
        }
        let payment_gateway_type = country.payment_gateways[0]
        return res.json({ 
            success: true, 
            success_code: String(success_messages.DEFUALT_SUCCESS_CODE),
            success_message: "",
            response_data:{payment_gateway_type: Number(payment_gateway_type)}  
        });
    }catch (error) {
        utils.error_response(error, req, res)
    }
   
}