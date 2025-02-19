let Trip = require('mongoose').model('Trip')
let Trip_history = require('mongoose').model('Trip_history')
let User = require('mongoose').model('User')
let Corporate = require('mongoose').model('Corporate')
let moment = require('moment')
let utils = require('../../controllers/utils')
let xl = require('excel4node')
let fs = require("fs")
let trips = require('../../controllers/trip')
let cards = require('../../controllers/card')
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let Trip_Location = require('mongoose').model('trip_location');
let Settings = require('mongoose').model('Settings');
const path = require('path');
const ejs = require('ejs');
let OpenRide = require('mongoose').model('Open_Ride');
let open_ride = require('../../controllers/open_rides');
let Rental_Trip = require('mongoose').model("Rental_Trip");
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");
const {
    TYPE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    PAYMENT_GATEWAY,
    TYPE_VALUE,
    TRIP_LIST,
    PROVIDER_STATUS,
    HIDE_DETAILS,
    RENTAL_TRIP_STATUS
} = require('../../controllers/constant');

exports.get_trip_list = async function (req, res) {
    try {
        let type = req.query.type
        let params_array = [{ name: "type", type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1
        let search_by = req.query.search_by
        let search_value = req.query.search_value

        // pagination query 
        let condition = {}
        let user_type_condition = { $match: {} };
        let status_condition = { $match: {} };
        let table;
        let start_date = req.query.start_date;
        let end_date = req.query.end_date;
        let payment_mode = Number(req.query.payment_mode)
        let payment_condition = { $match: { payment_mode: { $eq: payment_mode } } }

        if (type == TRIP_LIST.RUNNING_TRIP) {
            table = Trip;
            status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
            status_condition['$match']['is_trip_completed'] = { $eq: 0 }
            status_condition['$match']['is_schedule_trip'] = { $eq: false }
        }
        else if (type == TRIP_LIST.SCHEDULED_TRIP) {
            table = Trip;
            status_condition['$match']['is_trip_cancelled'] = { $eq: 0 }
            status_condition['$match']['is_trip_completed'] = { $eq: 0 }
            status_condition['$match']['is_schedule_trip'] = { $eq: true }
        }
        else if (type == TRIP_LIST.COMPLETED_TRIP) {
            table = Trip_history;
            if (req.query.user_type_id || req.query.provider_type_id) {
                let query1 = {}
                let query2 = {}
                if (req.query.user_type_id && req.query.user_type != '1') {
                    user_type_condition['$match']['user_type_id'] = { $eq: Schema(req.query.user_type_id) }
                }
                if (req.query.user_type_id && req.query.user_type == '1') {
                    user_type_condition['$match']['user_id'] = { $eq: Schema(req.query.user_type_id) }
                }
                query1['is_trip_completed'] = { $eq: 1 }
                query2['is_trip_cancelled'] = { $eq: 0 }
                status_condition = { "$match": { $or: [query1, query2] } }
            } else {
                status_condition = { $match: { $or: [{ is_trip_completed: 1 }, { is_trip_cancelled: 0 }] } }
            }
        }
        else if(type == 0){
            table = Trip_history;
            if (req.query.user_type_id || req.query.provider_type_id) {
                let query1 = {}
                let query2 = {}
                if (req.query.user_type_id && req.query.user_type != '1') {
                    user_type_condition['$match']['user_type_id'] = { $eq: Schema(req.query.user_type_id) }
                }
                if (req.query.user_type_id && req.query.user_type == '1') {
                    user_type_condition['$match']['user_id'] = { $eq: Schema(req.query.user_type_id) }
                }
                query1['is_trip_completed'] = { $eq: 1 }
                query2['is_trip_cancelled'] = { $eq: 1}
                status_condition = { "$match": { $or: [query1, query2] } }
            } else {
                status_condition = { $match: { $or: [{ is_trip_completed: 1 }, { is_trip_cancelled: 0 }] } }
            }
        }
        else {
            table = Trip_history;
            status_condition['$match']['is_trip_cancelled'] = { $eq: 1 }
        }
        if (req.query.provider_type_id) {
            user_type_condition['$match']['provider_type_id'] = { $eq: Schema(req.query.provider_type_id) }
        }
        if (req.query.provider_id) {
            user_type_condition['$match']['provider_id'] = { $eq: Schema(req.query.provider_id) }
        }
        let date_filter = { "$match": {} }
        if (start_date != '' && start_date != undefined && end_date != '' && end_date != undefined) {
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
            date_filter = { "$match": { 'created_at': { $gte: start_date, $lt: end_date } } };
        }

        if (payment_mode == undefined || payment_mode == 2) {
            payment_condition = { $match: {} }
        }

        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1 } }],
                as: 'user_detail'
            }
        }
        let user_unwind = {
            $unwind: {
                path: "$user_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let provider_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'current_provider',
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1 } }],
                foreignField: '_id',
                as: 'provider_details'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: "$provider_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let vehicle_type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'type_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, typename: 1, unique_id: 1 } }],
                as: 'vehicle_type_details'
            }
        }
        let vehicle_unwind = {
            $unwind: {
                path: "$vehicle_type_details",
                preserveNullAndEmptyArrays: true
            }
        };
        // project optimize query
        let Project = {
            $project: { provider_id: 1, unique_id: 1, total: 1, is_provider_status: 1, payment_mode: 1, is_trip_completed: 1, complete_date_in_city_timezone: 1, user_create_time: 1, is_trip_cancelled: 1, is_trip_cancelled_by_user: 1, is_trip_cancelled_by_provider: 1, is_provider_accepted: 1, payment_status: 1, user_details: '$user_detail', provider_details: '$provider_details', vehicle_details: '$vehicle_type_details', server_start_time_for_schedule: 1, provider_trip_end_time: 1 , fixed_price : 1}
        }

        if (search_by && search_value) {
            if (search_by == 'unique_id' || search_by == 'payment_mode') {
                search_value = Number(req.query.search_value)
                condition[search_by] = search_value
            } else {
                condition[search_by] = { $regex: search_value, $options: 'i' }
                let value = search_value.split(' ')
                let name = !search_by.includes("typename")
                if (value.length > 1 && name) {
                    condition[search_by] = { $regex: value[0], $options: 'i' }
                    let diff_search = search_by.split('.')
                    condition[diff_search[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
                }
            }
        }
        // sorting
        let sort = {}
        let sort_item = req.query.sort_item
        let sort_order = Number(req.query.sort_order)
        if (sort_item && sort_order) {
            sort = {
                $sort: {
                    [sort_item]: sort_order
                }
            }
        } else {
            sort = { $sort: { unique_id: -1 } }
        }
        if (req.query.is_excel_sheet) {
            page = null
            Project = { $project: { payment_status: 1, total: 1, payment_mode: 1, is_provider_status: 1, is_trip_cancelled: 1, provider_details: 1, user_detail: 1, unique_id: 1, created_at: 1, refund_amount: 1, is_amount_refund: 1, server_start_time_for_schedule: 1 } }
        }

        // total count login
        let count;
        let pagination;
        if (page !== null) {
            let number_of_rec = limit;
            let start = ((page + 1) * number_of_rec) - number_of_rec;
            let end = number_of_rec;
            count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
            pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } } }
        } else {
            count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
            pagination = { $project: { total: 1, data: '$result' } }
        }

        // apply query for particular type
        let trip_list = await table.aggregate([payment_condition, date_filter, status_condition, user_type_condition, user_lookup, provider_lookup, vehicle_type_lookup, user_unwind, provider_unwind, vehicle_unwind, { $match: condition }, Project, sort, count, pagination])
        if (req.query.is_excel_sheet) {
            generate_excel(req, res, trip_list[0].data, type , req.query.header)
            return
        }
        res.json({ success: true, trip_list: trip_list })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_trip_detail = async function (req, res) {
    try {
        let params_array = [{ name: "trip_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                pipeline:[{$project:{first_name:1,last_name:1,rate:1,email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1,phone:!req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, country_phone_code:!req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1}}],
                foreignField: '_id',
                as: 'user_details'
            }
        }
        let user_unwind = {
            $unwind: {
                path: "$user_details",
                preserveNullAndEmptyArrays: true
            }
        };

        let provider_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'provider_id',
                pipeline:[{$project:{first_name:1,last_name:1,rate:1,email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1,phone:!req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, country_phone_code:!req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1}}],
                foreignField: '_id',
                as: 'provider_details'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: "$provider_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let vehicle_type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'type_id',
                foreignField: '_id',
                as: 'vehicle_type_details'
            }
        }
        let vehicle_unwind = {
            $unwind: {
                path: "$vehicle_type_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let service_lookup = {
            $lookup: {
                from: 'trip_services',
                localField: 'trip_service_city_type_id',
                foreignField: '_id',
                as: 'service'
            }
        }
        let service_unwind = {
            $unwind: {
                path: "$service",
                preserveNullAndEmptyArrays: true
            }
        };
        let promo_lookup = {
            $lookup: {
                from: 'promo_codes',
                localField: 'promo_id',
                foreignField: '_id',
                as: 'promo_detail'
            }
        }
        let promo_unwind = {
            $unwind: {
                path: "$promo_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let lookup = {
                    $lookup: {
                      from: "providers",
                      let: {
                        rejectedTripProviderId: "$providers_id_that_rejected_trip",
                        scheduleRejectedTripProviderId: "$providers_id_that_rejected_trip_for_schedule"
                      },
                      pipeline: [
                        {
                            $match: {
                                $expr: {
                                  $or: [
                                    { $in: ["$_id", "$$rejectedTripProviderId"] },
                                    { $in: ["$_id", "$$scheduleRejectedTripProviderId"] }
                                  ]
                                }
                            }
                        },
                        {
                          $project: {
                            _id: 1,
                            first_name: 1,
                            last_name: 1,
                            email: 1,
                            phone: 1,
                            rate: 1,
                            picture: 1
                          }
                        }
                      ],
                      as: "Rejected_provider_detail"
                    }
                  
            };

        let trip_location_data=await Trip_Location.findOne({tripID:req.body.trip_id});
        let trip_condition = { "$match": { '_id': { $eq: mongoose.Types.ObjectId(req.body.trip_id) } } };
        let trip_detail = await Trip.aggregate([trip_condition, user_lookup, user_unwind, provider_lookup, provider_unwind, vehicle_type_lookup, vehicle_unwind, service_lookup, service_unwind,lookup, promo_lookup, promo_unwind])
        if (trip_detail.length == 0) {
            trip_detail = await Trip_history.aggregate([trip_condition, user_lookup, user_unwind, provider_lookup, provider_unwind, vehicle_type_lookup, vehicle_unwind, service_lookup, service_unwind,lookup, promo_lookup, promo_unwind])
            if (trip_detail.length == 0) {
                return res.json({ success: false , error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND})
            }
            res.json({ success: true, trip_detail: trip_detail,trip_location_data:trip_location_data })
        } else {
            res.json({ success: true, trip_detail: trip_detail,trip_location_data:trip_location_data })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.trip_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }, { name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }
        trips.trip_cancel_by_admin(req, res)
        return
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.scheduled_trip_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }, { name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }
        trips.scheduled_trip_cancel_by_admin(req, res)
        return
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.set_trip_status_by_admin = async function (req, res, next) {
    try {        
        req.body.user_type = TYPE_VALUE.ADMIN;
        if (req.body.is_open_ride) {
            await open_ride.openride_provider_set_trip_status(req,res)
        } else {
            await trips.provider_set_trip_status(req,res)
        }
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_complete_by_admin = async function (req, res, next) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }
        if (req.body.is_open_ride) {
            open_ride.openride_provider_complete_trip(req,res)
        } else {
            trips.provider_complete_trip(req,res)
        }
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_pay_payment = async function (req, res, next) {
    try {        
        if (req.body.is_open_ride) {
            await open_ride.openride_pay_payment(req,res)
        } else {
            await trips.pay_payment(req,res)
        }
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.chat_history = async function (req, res) {
    try {
        let trip_id = req.body.trip_id;
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return res.json(response);

        }

        let condition = { $match: { _id: Schema(trip_id) } }
        let lookup = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };
        let unwind = { $unwind: "$user_detail" };

        let lookup1 = {
            $lookup:
            {
                from: "providers",
                localField: "current_provider",
                foreignField: "_id",
                as: "provider_detail"
            }
        };
        let unwind1 = {
            $unwind: {
                path: "$provider_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let trip_data = await Trip.aggregate([condition, lookup, unwind, lookup1, unwind1])
        if (trip_data.length == 0) {
            trip_data = await Trip_history.aggregate([condition, lookup, unwind, lookup1, unwind1])
            if (trip_data.length == 0) {
                res.json({ success: false });
                return;
            }
            res.json({ success: true, trip_data: trip_data[0] })
        } else {
            res.json({ success: true, trip_data: trip_data[0] })
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.refund_trip_amount = async function (req, res) {
    try {
        let trip_id = req.body.trip_id;
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return res.json(response);

        }
        let Table
        let Table1
        let userId
        if (req.body.user_id) {
            Table = OpenRide
            Table1 = OpenRide
            userId = req.body.user_id
        } else {
            Table = Trip
            Table1 = Trip_history
        }
        let setting_detail = await Settings.findOne()
        let trip = await Table.findOne({ _id: trip_id });
        let amount = Number(req.body.amount);
        let type = req.body.type;
        if (!trip) {
            trip = await Table1.findOne({ _id: trip_id });
        }
        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }

        let allowedRefundAmount;
        if(!req.body.user_id) {
            userId = trip.user_id
            allowedRefundAmount = trip.total
        } else {
            const index = trip.user_details.findIndex((user) => user.user_id.toString() === userId.toString())
            if(index != -1) {
                allowedRefundAmount = trip.user_details[index].total
            } else {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
        }
        
        if (amount > allowedRefundAmount) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_CAN_NOT_REFUND_MORE_THAN_TRIP_AMOUNT });
        }

        // wallet
        
        if (type === 1) {
            let user, user_type, currencyCode, walletCurrencyCode
            const isCorporateTrip = trip.trip_type == constant_json.TRIP_TYPE_CORPORATE

            if (isCorporateTrip) {
                user = await Corporate.findById(trip.user_type_id)

                if (!user) {
                    return res.json({ success: false, error_code: TYPE_ERROR_CODE.DETAIL_NOT_FOUND })
                }

                user_type = constant_json.CORPORATE_UNIQUE_NUMBER
                currencyCode = trip.currencycode
                walletCurrencyCode = user.wallet_currency_code
            } else {
                user = await User.findById(userId)

                if (!user) {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND})
                }

                user_type = constant_json.USER_UNIQUE_NUMBER
                currencyCode = user.wallet_currency_code
                walletCurrencyCode = user.wallet_currency_code
            }

            const status = constant_json.ADD_WALLET_AMOUNT
            walletCurrencyCode = user.wallet_currency_code ? user.wallet_currency_code : 1

            const total_wallet_amount = utils.addWalletHistory(
                user_type,
                user.unique_id,
                user._id,
                user.country_id,
                currencyCode,
                walletCurrencyCode,
                trip.wallet_current_rate,
                Math.abs(amount),
                user.wallet,
                status,
                constant_json.ADDED_BY_ADMIN,
                "Refund Of This Trip : " + trip.unique_id
            )
    
            user.wallet = total_wallet_amount
            await user.save()

            if (trip.openride) {
                let userdetails_index = trip.user_details.findIndex(item => item.user_id.toString() == req.body.user_id.toString())
                trip.user_details[userdetails_index].refund_amount += amount;
                trip.user_details[userdetails_index].is_amount_refund = true;
            } else {
                trip.refund_amount += amount;
                trip.is_amount_refund = true;
            }
            
            await trip.save()

            let message = admin_messages.success_message_refund
            res.json({ success: true, message: message })
        }
        // card
        // ###payment
        if (type == 2) {
            if (!trip.payment_gateway_type || trip.payment_gateway_type == PAYMENT_GATEWAY.stripe) {
                cards.refund_payment(trip.payment_intent_id, PAYMENT_GATEWAY.stripe);
            } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.paystack) {
                cards.refund_payment(trip.payment_intent_id, PAYMENT_GATEWAY.paystack);
            } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.payu) {
                cards.refund_payment(trip._id, PAYMENT_GATEWAY.payu);
            } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.paytabs) {
                let user_data = await User.findById(trip.user_id);
                try {
                    const params = JSON.stringify({
                        "profile_id": setting_detail.paytabs_profileId,
                        "tran_type": "refund",
                        "tran_class": "ecom",
                        "tran_ref":  user_data.transaction_reference,
                        "cart_id": "Unique order reference",
                        "cart_description": "Add card refund",
                        "cart_currency": 'INR',
                        "cart_amount": Number( trip.total)
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
                    const req = https.request(options, response => {
                        let data = ''
                        response.on('data', (chunk) => {
                            data += chunk
                        });
                        response.on('end', async () => {
                            let response_data = JSON.parse(data)
                            if(response_data?.payment_result?.response_status == 'E' || response_data?.message){
                                res.json({ success: false, error_message: response_data.message || response_data.payment_result.response_message });
                            }else {
                            trip.refund_amount += trip.card_payment;
                            trip.is_amount_refund = true;
                            await trip.save();

                            let message = admin_messages.success_message_refund;
                            res.json({ success: true, message: message });
                            }
                        })
                    }).on('error', error => {
                        console.error(error)
                    })
                    req.write(params)
                    req.end()
                    return response
                } catch (error) {
                    console.error(error);
                }
                // cards.refund_payment(json, PAYMENT_GATEWAY.paytabs)
            }else if(trip.payment_gateway_type == PAYMENT_GATEWAY.paypal){
                const paypal = require('paypal-rest-sdk');
                paypal.configure({
                    mode: setting_detail.paypal_environment, // Set to 'live' for production
                    client_id: setting_detail.paypal_client_id,
                    client_secret: setting_detail.paypal_secret_key
                });
                const paymentId = trip.payment_intent_id;
                const refund = {
                    amount: {
                        total:(trip.total).toString(),
                        currency: trip.currencycode
                    }
                }
                let payment_promise =  new Promise((resolve, reject) => {
                      paypal.sale.refund(paymentId, refund, (error, refundResponse) => {
                        if (error) {
                            resolve(false);
                        } else {
                          resolve(true);
                        }
                      });
                    });

               let payment_response =  await payment_promise
               if(!payment_response){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
               }
                 
            }else if(trip.payment_gateway_type == PAYMENT_GATEWAY.razorpay){

                let payment_promise =  new Promise((resolve, reject) => {
                    const Razorpay = require('razorpay');
                    const key_id = setting_detail.razorpay_client_id
                    const key_secret = setting_detail.razorpay_secret_key
                    const razorpay = new Razorpay({
                    key_id: key_id,
                    key_secret: key_secret,
                    });
                    const paymentId = trip.payment_intent_id;
                    const refundAmount = (trip.total * 100)

                    razorpay.payments.refund(paymentId, { amount: refundAmount }, (error, refund) => {
                    if (error) {
                        resolve(error)
                    } else {
                        resolve(refund);
                    }
                    });
                  });

             let payment_response =  await payment_promise
             if(payment_response?.error?.code !== undefined){
              return res.json({ success: false,error_message:payment_response.error.description });
             }
            }
            trip.refund_amount += trip.card_payment;
            trip.is_amount_refund = true;
            await trip.save();

            let message = admin_messages.success_message_refund;
            res.json({ success: true, message: message });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
}

// excel sheet download
async function generate_excel(req, res, array, type , header) {
    const setting_detail = await Settings.findOne({})
    let date = new Date()
    let time = date.getTime()

    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let typename;
    switch (type) {
        case '1':
            typename = 'Running_Trip';
            break;
        case '2':
            typename = 'Scheduled_Trip';
            break;
        case '3':
            typename = 'Completed_Trip';
            break;
        case 4:
            typename = 'Trip_history';
            break;
        default:
            typename = 'Canclled_Trip';
            break;
    }
    let title = JSON.stringify(header)

    ws.cell(1, col++).string(title.id);
    ws.cell(1, col++).string(title.user_id);
    ws.cell(1, col++).string(title.user);
    ws.cell(1, col++).string(title.driver_id);
    ws.cell(1, col++).string(title.driver);
    ws.cell(1, col++).string(title.date);
    ws.cell(1, col++).string(title.status);
    ws.cell(1, col++).string(title.amount);
    ws.cell(1, col++).string(title.payment);
    ws.cell(1, col++).string(title.payment_status);

    array.forEach(function (data, index) {
        col = 1;
        ws.cell(index + 2, col++).number(data.unique_id);
        ws.cell(index + 2, col++).number(data.user_detail.unique_id);
        ws.cell(index + 2, col++).string(data.user_detail.first_name + ' ' + data.user_detail.last_name);
        if (data.provider_details) {
            ws.cell(index + 2, col++).number(data.provider_details.unique_id);
            ws.cell(index + 2, col++).string(data.provider_details.first_name + ' ' + data.provider_details.last_name);
        } else {
            col += 2;
        }
        ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));

        if (data.is_trip_cancelled == 1) {
            if (data.is_trip_cancelled_by_provider == 1) {
                ws.cell(index + 2, col++).string(title.title_total_cancelled_by_provider);
            } else if (data.is_trip_cancelled_by_user == 1) {
                ws.cell(index + 2, col++).string(title.title_total_cancelled_by_user);
            } else {
                ws.cell(index + 2, col++).string(title.title_total_cancelled);
            }
        } else {
            if (data.is_provider_status == PROVIDER_STATUS.COMING) {
                ws.cell(index + 2, col++).string(title.title_trip_status_coming);
            } else if (data.is_provider_status == PROVIDER_STATUS.ARRIVED) {
                ws.cell(index + 2, col++).string(title.title_trip_status_arrived);
            } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
            } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_COMPLETED) {
                ws.cell(index + 2, col++).string(title.title_trip_status_completed);
            } else if (data.is_provider_status == PROVIDER_STATUS.ACCEPTED || data.is_provider_status == PROVIDER_STATUS.WAITING) {
                if (data.is_provider_accepted == 1) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_accepted);
                } else {
                    ws.cell(index + 2, col++).string(title.title_trip_status_waiting);
                }
            }
        }


        ws.cell(index + 2, col++).number(data.total);

        if (data.payment_mode == 1) {
            ws.cell(index + 2, col++).string(title.title_pay_by_cash);
        } else {
            ws.cell(index + 2, col++).string(title.title_pay_by_card);
        }

        if (data.payment_status == 0) {
            ws.cell(index + 2, col++).string(title.title_pending);
        } else {
            if (data.payment_status == 1) {
                ws.cell(index + 2, col++).string(title.title_paid);
            } else {
                ws.cell(index + 2, col++).string(title.title_not_paid);
            }
        }

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + typename + '_' + time + '.xlsx', function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + typename + '_' + time + '.xlsx';
                    res.json(url);
                    setTimeout(function () {
                        fs.unlink('data/xlsheet/' + typename + '_' + time + '.xlsx', function () {
                        });
                    }, 10000)
                }
            });
        }
    })
}


exports.service_type_trip_list = async function (req, res) {
    try {
        let params_array = [{ name: 'user_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1
        let search_by = req.query.search_by
        let search_value = req.query.search_value
        let user_type_id = req.query.user_type_id
        let type = req.query.type
        let start_date = req.query.start_date
        let end_date = req.query.end_date
        let sort_item = req.query.sort_item
        let sort_order = Number(req.query.sort_order)

        let condition = {}
        condition = {
            $match: { $or: [{ user_type_id: Schema(user_type_id) }, { provider_type_id: Schema(user_type_id) }, { user_id: Schema(user_type_id) }, { provider_id: Schema(user_type_id) }] }
        }

        let lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                pipeline: [{ $project: { first_name: 1, last_name: 1, email: 1, phone: 1, unique_id: 1 } }],
                as: 'user_detail'
            }
        }
        let unwind = {
            $unwind: {
                path: '$user_detail',
                preserveNullAndEmptyArrays: true
            }
        }

        let lookup_1 = {
            $lookup: {
                from: 'providers',
                localField: 'provider_id',
                foreignField: '_id',
                pipeline: [{ $project: { first_name: 1, last_name: 1, email: 1, phone: 1, unique_id: 1 } }],
                as: 'provider_detail'
            }
        }
        let unwind_1 = {
            $unwind: {
                path: '$provider_detail',
                preserveNullAndEmptyArrays: true
            }
        }

        let lookup_2 = {
            $lookup: {
                from: 'types',
                localField: 'type_id',
                foreignField: '_id',
                pipeline: [{ $project: { typename: 1 } }],
                as: 'vehicle_type_detail'
            }
        }
        let unwind_2 = {
            $unwind: {
                path: '$vehicle_type_detail',
                preserveNullAndEmptyArrays: true
            }
        }

        let search = {}
        if (search_by && search_value) {
            let searches = search_by.split('.')
            if (search_by == 'unique_id') {
                search_value = Number(req.query.search_value)
                search[search_by] = search_value
            } else {
                search[search_by] = { $regex: search_value, $options: 'i' }
                let search_name = !search_by.includes('typename')
                if (search_name) {
                    search = {
                        $or: [
                            {
                                [search_by]: { $regex: search_value, $options: 'i' },
                            },
                            {
                                [searches[0] + '.last_name']: { $regex: search_value, $options: 'i' },
                            }
                        ]
                    }
                }
                let value = search_value.split(' ')
                if (type != 4 && type != 5 && value.length > 1 && search_name) {
                    search = {}
                    search[search_by] = { $regex: value[0], $options: 'i' }
                    search[searches[0] + '.last_name'] = { $regex: value[1], $options: 'i' }
                }
            }
        }
        let date_filter = { $match: {} }
        if (start_date && end_date) {
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
            date_filter = { "$match": { 'created_at': { $gte: start_date, $lt: end_date } } };
        }

        let Project = {
            $project: { provider_id: 1, unique_id: 1, total: 1, is_provider_status: 1, payment_mode: 1, is_trip_completed: 1, complete_date_in_city_timezone: 1, user_create_time: 1, is_trip_cancelled: 1, is_trip_cancelled_by_user: 1, is_trip_cancelled_by_provider: 1, is_provider_accepted: 1, payment_status: 1, user_detail: '$user_detail', provider_details: '$provider_detail', vehicle_details: '$vehicle_type_detail', server_start_time_for_schedule: 1, provider_trip_end_time: 1, created_at: 1 }
        }

        let sort = {}
        if (sort_item && sort_order) {
            sort = {
                $sort: {
                    [sort_item]: sort_order
                }
            }
        } else {
            sort = { $sort: { unique_id: -1 } }
        }

        let count;
        let pagination;
        if (page !== null) {
            let number_of_rec = limit;
            let start = ((page + 1) * number_of_rec) - number_of_rec;
            let end = number_of_rec;
            count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
            pagination = { $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } } }
        } else {
            count = { $group: { _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" } } };
            pagination = { $project: { total: 1, data: '$result' } }
        }

        let trip_list = await Trip_history.aggregate([condition, lookup, unwind, lookup_1, unwind_1, lookup_2, unwind_2, Project, { $match: search }, date_filter, sort, count, pagination])
        if (req.query.is_excel_sheet) {
            let type = 4
            generate_excel(req, res, trip_list[0].data, type , req.query.header)
            return
        }

        res.json({ success: true, trip_list: trip_list })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}





exports.send_invoice_mail = async function (req, res) {

    try {

        if(!req.body.receiverMail || req.body.receiverMail == ''){
            return res.json({success:false,error_code: error_message.ERROR_CODE_FAIL_TO_SEND_MAIL})
        }

        let query = { $match: {} };
        query["$match"]['_id'] = { $eq: Schema(req.body.trip_id) }

        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1 } }],
                as: 'user_detail'
            }
        }

        let user_unwind = {
            $unwind: {
                path: "$user_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let trip_service_lookup = {
            $lookup: {
                from: 'trip_services',
                localField: 'trip_service_city_type_id',
                foreignField: '_id',
                as: 'trip_service_detail'
            }
        }
        let trip_service_unwind = {
            $unwind: {
                path: "$trip_service_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let city_type_lookup = {
            $lookup: {
                from: 'city_types',
                localField: 'service_type_id',
                foreignField: '_id',
                as: 'city_type_detail'
            }
        }
        let city_type_unwind = {
            $unwind: {
                path: "$city_type_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'typeid',
                foreignField: '_id',
                as: 'type_detail'
            }
        }
        let type_unwind = {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let provider_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'current_provider',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1,email : 1 } }],
                as: 'providers_detail'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: "$providers_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let trip;
        if(req.body.is_mail_for_open_ride){
            trip = await OpenRide.aggregate([query, trip_service_lookup, trip_service_unwind, city_type_lookup, city_type_unwind, type_lookup, type_unwind, provider_lookup, provider_unwind]);
        } else {
            trip = await Trip_history.aggregate([query, user_lookup, user_unwind, trip_service_lookup, trip_service_unwind, city_type_lookup, city_type_unwind, type_lookup, type_unwind, provider_lookup, provider_unwind]);
            if (!trip) {
                trip = await Trip.aggregate([query, user_lookup, user_unwind, trip_service_lookup, trip_service_unwind, city_type_lookup, city_type_unwind, type_lookup, type_unwind, provider_lookup, provider_unwind]);
            }
        }

        if(!trip || trip.length <= 0){
            return res.json({success:false,error_code: error_message.ERROR_CODE_FAIL_TO_SEND_MAIL})
        }
        
        trip = trip[0]

        let is_show_total;
        let case_number;
        let totalcharge = 0;

        let filePath = path.join(__dirname, "../../views/email/email_invoice_templete.html");
        let  emailTemplate = fs.readFileSync(filePath, 'utf-8');

        if(trip?.trip_type == constant_json.TRIP_TYPE_AIRPORT){
            is_show_total = false;
            case_number = 1;
        }else if(trip?.trip_type == constant_json.TRIP_TYPE_ZONE){
            is_show_total = false;
            case_number = 2;
        }else if(trip?.trip_type == constant_json.TRIP_TYPE_CITY){
            is_show_total = false;
            case_number = 3;
        }else if(trip?.is_fixed_fare == 1){
            is_show_total = false;
            case_number = 4;
        }else if(trip?.is_min_fare_used == 1){
            is_show_total = true;
            case_number = 5;
        }else{
            is_show_total = true;
            case_number = 0;
        }
        if(is_show_total && case_number == 0){
            if (trip?.base_distance_cost > 0) {
                totalcharge += Number(trip.base_distance_cost);
            }//done
            if (trip?.time_cost > 0) {
                totalcharge += Number(trip.time_cost);
            }//done
            if (trip?.distance_cost > 0) {
                totalcharge += Number(trip.distance_cost);
            }//done
            if (trip?.waiting_time_cost > 0) {
                totalcharge += Number(trip.waiting_time_cost);
            }//done
            if (trip?.stop_waiting_time_cost > 0) {
                totalcharge += Number(trip.stop_waiting_time_cost);
            }//done

            if (trip?.surge_fee > 0) {
                totalcharge += Number(trip.surge_fee);
            }//done
        }

        if(!is_show_total || case_number != 0){
            totalcharge = trip.total_after_surge_fees;
        }

        let split_total = 0;
        let split_data = [];
        let split_count = 0;

        if(!req.body.is_mail_for_open_ride){
            trip?.split_payment_users.forEach((data) => {
                split_data.push(data)
                split_total += data.total;
            })
        }
              
        const context = {
            trip:trip,
            currency:trip?.currency,
            unique_id: trip?.unique_id,
            distance: trip?.total_distance?.toFixed(2), 
            time :trip?.total_time?.toFixed(2),
            waiting_time: trip?.total_waiting_time?.toFixed(2),
            ride_charge: totalcharge?.toFixed(2),
            base_price: trip?.trip_service_detail.base_price+'/'+trip?.trip_service_detail.base_price_distance,
            base_distance_cost:trip?.base_distance_cost?.toFixed(2),
            distance_price:trip?.trip_service_detail.price_per_unit_distance?.toFixed(2),
            distance_cost:trip?.distance_cost?.toFixed(2),
            price_for_total_time:trip?.trip_service_detail.price_for_total_time,
            time_price:trip?.time_cost?.toFixed(2),
            waiting_time_cost:trip?.waiting_time_cost?.toFixed(2) ,
            stop_waiting_time_cost: trip?.stop_waiting_time_cost?.toFixed(2),
            surge_multiplier: trip?.surge_multiplier,
            surge_fee:trip?.surge_fee?.toFixed(2),
            total_after_surge_fees:trip?.total_after_surge_fees?.toFixed(2),
            user_tax :trip?.trip_service_detail.user_tax,
            user_tax_fee: trip?.user_tax_fee?.toFixed(2),
            tax_fee: trip?.tax_fee,
            user_miscellaneous_fee:trip?.user_miscellaneous_fee?.toFixed(2),
            tip_amount:trip?.tip_amount?.toFixed(2),
            toll_amount:trip?.toll_amount?.toFixed(2),
            totalcharge:totalcharge?.toFixed(2),
            totalTax: (trip?.user_tax_fee + trip?.tax_fee + trip?.user_miscellaneous_fee).toFixed(2),
            totalOtherCharge : (trip?.tip_amount + trip?.toll_amount).toFixed(2),
            promo_payment:trip?.promo_payment?.toFixed(2),
            total:trip?.total?.toFixed(2),  
            userpayment:(trip?.wallet_payment + trip?.cash_payment + trip?.card_payment + trip?.remaining_payment).toFixed(2),
            cash_payment:(trip?.cash_payment)?.toFixed(2),
            wallet_payment:(trip?.wallet_payment)?.toFixed(2),
            remaining_payment:(trip?.remaining_payment)?.toFixed(2),
            total_split_payment : split_total?.toFixed(2),
            split_payment_users:trip?.split_payment_users,
            provider_service_fees:trip?.provider_service_fees?.toFixed(2),
            provider_profit_fees: trip?.provider_profit_fees?.toFixed(2),
            provider_tax_fee:trip?.provider_tax_fee?.toFixed(2),
            provider_miscellaneous_fee:trip?.provider_miscellaneous_fee?.toFixed(2),
            split_data:split_data,
            split_count:split_count,
            case_number:case_number,
            is_show_total:is_show_total
        };
        
        let compiledTmpl = await ejs.compile(emailTemplate, { filename: filePath });
        let htmls = compiledTmpl(context);

        let html_to_pdf = require('html-pdf');
        let configs = {
            "childProcessOptions": {
                "detached": true,
                env: {
                    OPENSSL_CONF: '/dev/null',
                },
            },
            orientation: 'portrait',
            type: 'pdf',
            timeout: '50000',
            format: "A4",
            height: "24.5in",
            width: "10in",

        }

        req.body.receiverMail = 'hbariya.elluminati@gmail.com'

        let path__ =  `data/xlsheet/Trip Invoice_${trip?.unique_id}.pdf`;

        html_to_pdf.create(htmls, configs).toFile(path__, async function(err, res) {

            if (!err) {
                setTimeout(function() {
                    fs.unlink(path__, function() {});
                }, 60000)

                let pdfBuffer = { 
                    filename:  `Trip Invoice_${trip?.unique_id}.pdf`,
                    content: fs.createReadStream(path__)
                }

                await utils.invoice_pdf_mail_notification(req.body.receiverMail, "Trip Invoice", trip?.unique_id, pdfBuffer)

            }
            
        });
        if (res) {
            return res.json({success:true,message:success_messages.MESSAGE_CODE_SEND_INVOICE_IN_MAIL_SUCCESSFULLY})
        } else {
            return res.json({success:false,error_code: error_message.ERROR_CODE_FAIL_TO_SEND_MAIL})
        }

    } catch (error) {
        console.error(error);
    }
};


exports.get_rental_trip_detail = async function (req, res) {
    try {
        let params_array = [{ name: "trip_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                pipeline:[{$project:{first_name:1, last_name:1, rental_rate:1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, phone:!req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, country_phone_code:!req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1}}],
                foreignField: '_id',
                as: 'user_details'
            }
        }
        let user_unwind = {
            $unwind: {
                path: "$user_details",
                preserveNullAndEmptyArrays: true
            }
        };

        let provider_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'provider_id',
                pipeline:[{$project:{first_name:1, last_name:1, rental_rate:1, email: !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, phone:!req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, country_phone_code:!req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1}}],
                foreignField: '_id',
                as: 'provider_details'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: "$provider_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let type_lookup = {
            $lookup: {
                from: 'car_rent_types',
                localField: 'type_id',
                foreignField: '_id',
                as: 'type_details'
            }
        }
        let type_unwind = {
            $unwind: {
                path: "$type_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let vehicle_lookup = {
            $lookup: {
                from: 'car_rent_vehicles',
                localField: 'vehicle_id',
                foreignField: '_id',
                as: 'vehicle_details'
            }
        }
        let vehicle_unwind = {
            $unwind: {
                path: "$vehicle_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let brand_lookup = {
            $lookup: {
                from: 'car_rent_brands',
                localField: 'vehicle_details.brand_id',
                foreignField: '_id',
                as: 'brand_details'
            }
        }
        let brand_unwind = {
            $unwind: {
                path: "$brand_details",
                preserveNullAndEmptyArrays: true
            }
        };
        let model_lookup = {
            $lookup: {
                from: 'car_rent_models',
                localField: 'vehicle_details.model_id',
                foreignField: '_id',
                as: 'model_details'
            }
        }
        let model_unwind = {
            $unwind: {
                path: "$model_details",
                preserveNullAndEmptyArrays: true
            }
        };

        let trip_condition = { "$match": { '_id': { $eq: mongoose.Types.ObjectId(req.body.trip_id) } } };
        let trip_detail = await Rental_Trip.aggregate([trip_condition, user_lookup, user_unwind, provider_lookup, provider_unwind, type_lookup, type_unwind, vehicle_lookup, vehicle_unwind, brand_lookup, brand_unwind, model_lookup, model_unwind ])
        if (trip_detail.length == 0) {
            return res.json({ success: false , error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND})
        } else {
            res.json({ success: true, trip_detail: trip_detail })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.rental_trip_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let rental_trip = await Rental_Trip.findById(req.body.trip_id);         
        if (!rental_trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
        }

        if (rental_trip.is_trip_completed == 1) {
            return res.json({
                success: true,
                error_code: error_message.ERROR_CODE_BOOKING_ALREADY_COMPLETED
            });
        }

        if (rental_trip.is_trip_cancelled == 1 ) {
            return res.json({
                success: true,
                error_code: error_message.ERROR_CODE_BOOKING_ALREADY_CANCELLED
            });
        }

        if(rental_trip.status >= RENTAL_TRIP_STATUS.DRIVER_HANDOVER){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_CAN_NOT_BE_CANCELLED });
        }

        let cancel_reason = "";
        let status = rental_trip.status;
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), rental_trip.timezone);
        rental_trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        rental_trip.provider_completed_time = new Date();
        rental_trip.cancel_reason = cancel_reason;
        rental_trip.is_trip_cancelled = 1;
        rental_trip.cancelled_by = TYPE_VALUE.ADMIN;
        rental_trip.status = RENTAL_TRIP_STATUS.CANCELLED;
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.CANCELLED, TYPE_VALUE.ADMIN, req.headers.username, req.headers.admin_id);

        // refund payment if paid
        if (status == RENTAL_TRIP_STATUS.PAYMENT) {
            await cards.refund_rental_payment(rental_trip, rental_trip.payment_intent_id, rental_trip.payment_gateway_type, rental_trip.total);
            rental_trip.refund_amount += rental_trip.card_payment;
            rental_trip.is_amount_refund = true;
        }
        
        await Rental_Trip.updateOne({ _id: rental_trip._id }, rental_trip.getChanges())
        // Remove non-availability from vehicle
        let vehicle_detail = await Car_Rent_Vehicle.findOne({ _id: rental_trip.vehicle_id });
        vehicle_detail.non_availability = vehicle_detail.non_availability.filter((availability) => {
            return availability?.trip_id?.toString() !== rental_trip?._id?.toString();
        });

        // Update the vehicle with filtered non_availability first
        await Car_Rent_Vehicle.findByIdAndUpdate(
            rental_trip.vehicle_id,
            { $set: { non_availability: vehicle_detail.non_availability } }
        );
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_BOOKING_CANCELLED_SUCCESSFULLY
        });

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.refund_rental_trip_amount = async function (req, res) {
    try {
        let trip_id = req.body.trip_id;
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return res.json(response);
        }

        let rental_trip = await Rental_Trip.findOne({ _id: trip_id });
        if (!rental_trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }

        let user = await User.findOne({_id: rental_trip.user_id});
        if(!user){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }

        let amount = Number(req.body.amount);
        let type = req.body.type;
        let allowedRefundAmount = rental_trip.total;
        
        if (amount > allowedRefundAmount) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_CAN_NOT_REFUND_MORE_THAN_TRIP_AMOUNT });
        }

        // wallet
        if (type === 1) {

            let user_type = constant_json.USER_UNIQUE_NUMBER;
            let currencyCode = user.wallet_currency_code;
            let walletCurrencyCode = user.wallet_currency_code;
            const status = constant_json.ADD_WALLET_AMOUNT;
            walletCurrencyCode = user.wallet_currency_code ? user.wallet_currency_code : 1

            const total_wallet_amount = utils.addWalletHistory(
                user_type,
                user.unique_id,
                user._id,
                null,
                currencyCode,
                walletCurrencyCode,
                1,
                Math.abs(amount),
                user.wallet,
                status,
                constant_json.ADDED_BY_ADMIN,
                "Refund Of This Rental Trip : " + rental_trip.unique_id
            )
    
            user.wallet = total_wallet_amount
            await user.save()

            rental_trip.refund_amount += amount;
            rental_trip.is_amount_refund = true;
            
            await rental_trip.save()
            return res.json({ success: true, message: admin_messages.success_message_refund })
        }

        // card
        if (type == 2) {
            if(rental_trip.payment_gateway_type == PAYMENT_GATEWAY.stripe || rental_trip.payment_gateway_type == PAYMENT_GATEWAY.paystack || rental_trip.payment_gateway_type == PAYMENT_GATEWAY.payu){
                await cards.refund_rental_payment(rental_trip, rental_trip.payment_intent_id, rental_trip.payment_gateway_type);
                if(rental_trip.additional_payment_intent_id != ""){
                    await cards.refund_rental_payment(rental_trip, rental_trip.additional_payment_intent_id, rental_trip.payment_gateway_type);
                }
            } else {
                await cards.refund_rental_payment(rental_trip, rental_trip.payment_intent_id, rental_trip.payment_gateway_type, Number(rental_trip.total - rental_trip.total_additional_charge));
                if(rental_trip.additional_payment_intent_id != ""){
                    await cards.refund_rental_payment(rental_trip, rental_trip.additional_payment_intent_id, rental_trip.payment_gateway_type, Number(rental_trip.total_additional_charge));
                }
            }
            rental_trip.refund_amount += rental_trip.card_payment;
            rental_trip.is_amount_refund = true;
            await rental_trip.save();
            return res.json({ success: true, message: admin_messages.success_message_refund });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
}

