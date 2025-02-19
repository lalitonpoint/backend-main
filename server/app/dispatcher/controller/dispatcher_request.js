let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails')
let Dispatcher = require('mongoose').model('Dispatcher');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Trip = require('mongoose').model('Trip');
let moment = require('moment');
let Trip_Location = require('mongoose').model('trip_location');
let Country = require('mongoose').model('Country')
let crypto = require('crypto');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let xl = require('excel4node');
let fs = require("fs");
let Trip_history = require('mongoose').model('Trip_history');
let city_type = require('../../controllers/citytype')
let Setting = require('mongoose').model('Settings')
let user = require('../../controllers/users')
let trips = require('../../controllers/trip');
const { stringify } = require('querystring');
const country_list = require('../../../country_list.json')
const {
    TYPE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    PROVIDER_STATUS,
    ADMIN_NOTIFICATION_TYPE,
    DEFAULT_VALUE,
} = require('../../controllers/constant');

exports.details = async function async(req, res) {
    try {
        let setting_detail = await Setting.findOne({})

        let params_array = [{ name: '_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let dispatcher = await Dispatcher.findById(req.body._id)
        let server_date = new Date(Date.now());
        let country_data = await Country.findOne({ countryname: dispatcher.country })
        res.json({
            server_date: server_date, scheduled_request_pre_start_minute: setting_detail.scheduled_request_pre_start_minute,
            country_code: country_data.countrycode,
            phone_number_min_length: setting_detail.minimum_phone_number_length,
            phone_number_length: setting_detail.maximum_phone_number_length,
            dispatchers: dispatcher, country: dispatcher.country
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.search_dispatcher_user = async function(req,res){
    try{
        let params_array = [{ name: '_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let search = req.body.search_value
        if(!search){
            search = ''
        }

        const dispatcher = await Dispatcher.findById(req.body._id)
        const condition = { country: dispatcher.country, phone: search }
        const searched_user = await User.findOne(condition)
        // We have to show dispatcher that user is not approved
        if(searched_user && searched_user.is_approved != 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED })
            return
        }
        
        res.json({
            success: true,
            user_list: searched_user
        });
    }catch(error){
        utils.error_response(error, req, res)
    }
}

exports.select_city_service = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        city_type.list(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.service_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        city_type.disptcher_city_type_list(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.get_new_request = async function (req, res) {
    try {
        
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code
        let setting_detail = await Setting.findOne({})

        let provider_timeout = setting_detail.provider_timeout;
        let end_time = new Date(Date.now());
        let accepted_request_list = [];
        let started_request_list = [];
        let arrived_request_list = [];
        let assigned_request_list = [];
        let lookup = {
            $lookup:
            {
                from: "providers",
                localField: "confirmed_provider",
                foreignField: "_id",
                as: "provider_detail"
            }
        };
        let unwind = {
            $unwind: {
                path: "$provider_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let lookup1 = {
            $lookup:
            {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_detail"
            }
        };
        let unwind1 = {
            $unwind: {
                path: "$user_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let lookup2 = {
            $lookup:
            {
                from: "city_types",
                localField: "service_type_id",
                foreignField: "_id",
                as: "city_type_detail"
            }
        };

        let unwind2 = { $unwind: "$city_type_detail" };

        let lookup3 = {
            $lookup:
            {
                from: "types",
                localField: "city_type_detail.typeid",
                foreignField: "_id",
                as: "type_detail"
            }
        };

        let unwind3 = { $unwind: "$type_detail" };
        let triplocation = {
            $lookup:
            {
                from: "trip_locations",
                localField: "_id",
                foreignField: "tripID",
                as: "location_detail"
            }
        }
        let triplocationunwind = {
            $unwind: {
                path: "$location_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let start_date 
        let end_date

        let match_date = {}
        let sort = {
            $sort: { unique_id : -1}
        }
        if(req.body.is_schedule_trip) {
            if(req.body.start_date != '' && req.body.start_date != undefined && req.body.start_date != null) {
                start_date = req.body.start_date;
                start_date = new Date(start_date);
                start_date = start_date.setHours(0, 0, 0, 0);
                start_date = new Date(start_date);
        
                end_date = req.body.end_date;
                end_date = new Date(end_date);
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
                match_date = { 'server_start_time_for_schedule': {$gte: start_date, $lt: end_date}}
            }
            sort = {
                $sort: { server_start_time_for_schedule: 1 }
            }
        }

        let main_condition = {}

        let schedule_trip_condition = { $match: {is_schedule_trip : req.body.is_schedule_trip || false}};

        if(req.body.type == constant_json.CORPORATE_UNIQUE_NUMBER) {
            main_condition = { user_type_id:  Schema(req.body.dispatcher_id)}
        } else {
            let dispatcher = await Dispatcher.findById({_id : req.body.dispatcher_id}, {city_ids : 1}).lean(true);
            if (dispatcher.city_ids.length > 0) {
                let city_ids = []
                dispatcher.city_ids.forEach(element => {
                    city_ids.push({city_id : Schema(element)})
                });
                main_condition = {$or: city_ids}
            }
        }

        let condition = { $match: { $and: [main_condition, { is_trip_completed: { $eq: 0 } }, { is_trip_cancelled: { $eq: 0 } }, { is_provider_accepted: { $eq: 1 } }, { is_provider_status: { $lt: 4 } }] } }
        let accepted_request = await Trip.aggregate([condition,schedule_trip_condition, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])
        accepted_request_list = accepted_request;

        let condition1 = { $match: { $and: [main_condition, { is_trip_completed: { $eq: 0 } }, { is_trip_cancelled: { $eq: 0 } }, { is_provider_accepted: { $eq: 1 } }, { is_provider_status: { $eq: 4 } }] } }
        let arrived_request = await Trip.aggregate([condition1,schedule_trip_condition, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])
        arrived_request_list = arrived_request;

        let condition2 = { $match: { $and: [main_condition, { is_provider_accepted: { $eq: 1 } }, { is_provider_status: { $eq: 6 } }] } }
        let started_request = await Trip.aggregate([condition2,schedule_trip_condition, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])
        started_request_list = started_request;
        
        let assigned_request_condition = { $match: { $and: [main_condition,  { is_provider_accepted : { $eq:  1 }}, match_date ]} }
        let assigned_request = await Trip.aggregate([assigned_request_condition, schedule_trip_condition, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3, sort , triplocation , triplocationunwind])
        assigned_request_list = assigned_request;
        let condition3 = {
            $match: {
                $and: [
                    main_condition,
                    { is_trip_completed: { $eq: 0 } },
                    { is_trip_cancelled: { $eq: 0 } },
                    {
                        $or:
                            [
                                { is_provider_accepted: { $eq: 0 } },
                                { is_provider_accepted: { $eq: 3 } }
                            ]
                    },
                    match_date
                ]
            }
        }

        let lookup4 = {
            $lookup:
            {
                from: "providers",
                localField: "current_provider",
                foreignField: "_id",
                as: "provider_detail"
            }
        };
        let unwind4 = {
            $unwind: {
                path: "$provider_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let lookup5 = {
            $lookup:
            {
                from: "cities",
                localField: "city_id",
                foreignField: "_id",
                as: "city_detail"
            }
        }
        let unwind5 = {
            $unwind: {
                path: "$city_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let lookup6 = {
            $lookup:
            {
                from: "trip_locations",
                localField: "_id",
                foreignField: "tripID",
                as: "location_detail"
            }
        }
        let unwind6 = {
            $unwind: {
                path: "$location_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let request_list = await Trip.aggregate([condition3,schedule_trip_condition, lookup4, unwind4, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3,lookup5, unwind5, lookup6, unwind6, sort])
        let array = [];
        request_list.forEach(function (trip) {
            let start_time = trip.updated_at;
            let res_sec = utils.getTimeDifferenceInSecond(end_time, start_time);

            let time_left_to_responds_trip = provider_timeout - res_sec;
            array.push({
                _id: trip._id,
                time_left_to_responds_trip: time_left_to_responds_trip,
                unique_id: trip.unique_id,
                invoice_number: trip.invoice_number,
                is_provider_accepted: trip.is_provider_accepted,
                provider_detail: trip.provider_detail,
                user_detail: trip.user_detail,
                user_id: trip.user_id,
                timezone: trip.timezone,
                source_address: trip.source_address,
                destination_address: trip.destination_address,
                sourceLocation: trip.sourceLocation,
                destinationLocation: trip.destinationLocation,
                service_type_id: trip.service_type_id,
                created_at: trip.created_at,
                trip_type: trip.trip_type,
                is_schedule_trip: trip.is_schedule_trip,
                server_start_time_for_schedule: trip.server_start_time_for_schedule,
                typename: trip.type_detail.typename,
                initialDestinationLocation: trip.initialDestinationLocation,
                confirmed_provider:trip.confirmed_provider,
                providers_id_that_rejected_trip:trip.providers_id_that_rejected_trip,
                current_providers:trip.current_providers,
                fixed_price:trip.fixed_price,
                provider_service_fees:trip.provider_service_fees,
                estimate_time: trip.estimate_time,
                estimate_distance: trip.estimate_distance,
                currency: trip.currency,
                current_provider: trip.current_provider,
                unit: trip.city_detail.unit,
                googlePickUpLocationToDestinationLocation: trip?.location_detail?.googlePickUpLocationToDestinationLocation,
                destination_addresses: trip.destination_addresses,
            })
        });
        res.json({ success: true, moment: moment, request_list: array, arrived_request_list: arrived_request_list, accepted_request_list: accepted_request_list, started_request_list: started_request_list , assigned_request_list : assigned_request_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.get_all_provider = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let default_Search_radious = Number(req.body.default_Search_radious);
        let distance = default_Search_radious / constant_json.DEGREE_TO_KM;
        let provider_query = { $match: { 'is_vehicle_document_uploaded': true } };
        let provider_query2 = {
            $geoNear: {
                near: [Number(req.body.latitude), Number(req.body.longitude)],
                distanceField: "distance",
                uniqueDocs: true,
                maxDistance: distance
            }
        }
        let provider_admin_type_query = {
            $and: [
                {
                    "provider_type": Number(constant_json.PROVIDER_TYPE_NORMAL)
                }, {
                    "is_approved": 1
                }
            ]
        };
        let provider_partner_type_query = {
            $and: [{
                "provider_type": Number(constant_json.PROVIDER_TYPE_PARTNER)
            }, {
                "is_approved": 1
            }, {
                "is_partner_approved_by_admin": 1
            }
            ]
        };
        let provider_query1 = { $match: { $or: [provider_admin_type_query, provider_partner_type_query] } };
        let city_type_lookup = {
            $lookup:
            {
                from: "city_types",
                localField: "service_type",
                foreignField: "_id",
                as: "city_type_detail"
            }
        };
        let city_type_unwind = { $unwind: "$city_type_detail" };
        let type_lookup = {
            $lookup:
            {
                from: "types",
                localField: "city_type_detail.typeid",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let type_unwind = { $unwind: "$type_detail" };
        let trip_lookup = {
            $lookup:
            {
                from: "trips",
                localField: "is_trip",
                foreignField: "_id",
                as: "trip_detail"
            }
        };

        // The below code is commented out as it was causing an issue in the dispatcher panel.
        // Specifically, it displayed the same driver name multiple times due to the unwind operator for ride share.
        // let trip_unwind = {
        //     $unwind: {
        //         path: "$trip_detail",
        //         preserveNullAndEmptyArrays: true
        //     }
        // };
        let country_condition = { $match: { 'country': req.body.country } }

        let current_location_service_type_id_query = { $match: {} };
        if (req.body.current_location_service_type_id != '') {
            current_location_service_type_id_query = { $match: { service_type: Schema(req.body.current_location_service_type_id) } }
        }

        let providers = await Provider.aggregate([provider_query2, current_location_service_type_id_query, country_condition, provider_query, provider_query1, city_type_lookup, city_type_unwind, type_lookup, type_unwind, trip_lookup])
        if (providers.length == 0) {
            res.json({
                success: false,
                error_code: TYPE_ERROR_CODE.PROVIDER_NOT_FOUND
            });
            return
        }
        res.json({
            success: true,
            providers: providers
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.check_user = async function (req, res) {
    let setting_detail = await Setting.findOne({})
    // console.log(req.body)
    let gender = req.body.gender;
    if (gender != undefined) {
        gender = ((gender).trim()).toLowerCase();
    }
    let first_name = req.body.first_name;
    let last_name = req.body.last_name;
    let email = req.body.email;

    if (email == undefined || email == null || email == "") {
        email = null;
    } else {
        email = ((req.body.email).trim()).toLowerCase();
    }
    let referral_code = (utils.tokenGenerator(8)).toUpperCase();
    let token = utils.tokenGenerator(32);
    let password = DEFAULT_VALUE.PASSWORD;
    let encrypt_password = crypto.createHash('md5').update(password).digest('hex');
    if (req.body.user_id == "" || req.body.user_id == null) {
        let user_email = await User.findOne({ email: email })
        let query = { phone: req.body.phone };
        if (req.body.country_phone_code) {
            query = { phone: req.body.phone, country_phone_code: req.body.country_phone_code };
        }
        let user_phone = await User.findOne(query)
        if (!user_email && !user_phone) {
            if (email == null) {
                email = "";
            }

            if (first_name.length > 0) {
                first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);
            } else {
                first_name = "";
            }

            if (last_name.length > 0) {
                last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);
            } else {
                last_name = "";
            }

            const alpha2 = req.body.alpha2
            let country_phone_code = req.body.country_phone_code;
            let match = { countryphonecode: country_phone_code }
            
            if(alpha2) {
                match = {  alpha2: alpha2 }
            }
        
            let country = await Country.findOne(match)
            let wallet_currency_code = "";

            if (country) {
                wallet_currency_code = country.currencycode;
                if (!req.body.country) {
                    req.body.country = country.countryname;
                }
            } else {
                let index = country_list.findIndex(i => i.alpha2 == alpha2);
                if (index != -1) {
                    wallet_currency_code = country_list[index].currency_code;
                    if (!req.body.country) {
                        req.body.country = country_list[index].name
                    }
                }
            }
            let user = new User({
                first_name: first_name,
                user_type: constant_json.USER_TYPE_NORMAL,
                user_type_id: null,
                password: encrypt_password,
                last_name: last_name,
                email: email,
                country_phone_code: req.body.country_phone_code,
                phone: req.body.phone,
                device_token: '',
                device_type: '',
                gender: gender,
                bio: '',
                address: '',
                zipcode: '',
                social_unique_id: '',
                login_by: '',
                device_timezone: '',
                city: req.body.city,
                token: token,
                wallet_currency_code: wallet_currency_code,
                country: req.body.country,
                referral_code: referral_code,
                promo_count: 0,
                is_referral: 1,
                rate: 0,
                rate_count: 0,
                totalReferrals: 0,
                refferalCredit: 0,
                wallet: 0,
                is_approved: 1,
                picture: "",
                current_trip_id: null,
                alpha2: alpha2
            })
            if (req.files != undefined && req.files.length > 0) {
                let url = utils.getImageFolderPath(req, 1) + user._id + '.jpg';
                user.picture = url;
                let pictureData = req.body.pictureData;
                if (pictureData != null) {
                    utils.saveImageAndGetURL(user._id, req, res, 1);
                }
            }
            await user.save()

            if(country?._id) {
                // FOR ADD DOCUEMNTS
                utils.insert_documets_for_new_users(user, Number(constant_json.USER_TYPE_NORMAL), country._id, function (document_response) {})
            }

            let email_notification = setting_detail.email_notification;
            if (email_notification) {
                allemails.sendUserRegisterEmail(req, user);
            }
            res.json({ success: true, user: user });
            // Trigger admin notification
            utils.addNotification({
                type: ADMIN_NOTIFICATION_TYPE.USER_REGISTERED,
                user_id: user._id,
                username: user.first_name + " " + user.last_name,
                picture: user.picture,
                country_id: (country?._id) ? country._id : null,
                user_unique_id: user.unique_id,
            })
            return
        } else {
            if (user_email) {
                if (user_email.current_trip_id) {
                    res.json({ success: false, user: user_email, error_code: TYPE_ERROR_CODE.TRIP_ALREADY_RUNNING })
                    return
                } else if(user_email.is_approved != 1) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED })
                    return
                } else {
                    res.json({ success: true, user: user_email })
                    return
                }
            } else if (user_phone) {
                if (user_phone.current_trip_id) {
                    res.json({ success: false, user: user_phone, error_code: TYPE_ERROR_CODE.TRIP_ALREADY_RUNNING })
                    return
                } else if(user_phone.is_approved != 1) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED })
                    return
                } else {
                    res.json({ success: true, user: user_phone })
                    return
                }
            }
        }
    }
    let userdata = await User.findOne({ _id: Schema(req.body.user_id) })
    if (userdata.current_trip_id) {
        return res.json({ success: false, user: userdata, error_code: TYPE_ERROR_CODE.TRIP_ALREADY_RUNNING })
    } else if(userdata.is_approved != 1) {
        res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED })
        return
    }
    res.json({ success: true, user: userdata })
};

exports.getfareestimate = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        user.getfareestimate(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.getnearbyprovider = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        trips.get_near_by_provider(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_server_time = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let server_date = new Date();
        res.json({server_date: server_date})
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.canceltrip = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        trips.trip_cancel_by_user(req,res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.create = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        trips.create(req,res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.send_request = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        trips.send_request_from_dispatcher(req,res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
} 

exports.getgooglemappath = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        trips.getgooglemappath(req,res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
} 

// tirp history future
exports.history = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let page
        let filter_start_date
        let filter_end_date
        let sort_field
        let sort_order
        let start_date
        let end_date
        let search_item
        let search_value

        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }

        if (req.body.search_item == undefined) {
            sort_field = 'unique_id'
            sort_order = -1
                start_date = ''
            end_date = ''
                filter_start_date = ''
            filter_end_date = ''
            search_item = 'user_detail.first_name'
            search_value = ''
        } else {
            sort_field = req.body.sort_item[0]
            sort_order = req.body.sort_item[1]
            filter_start_date = req.body.start_date
            filter_end_date = req.body.end_date
            search_item = req.body.search_item
            search_value = req.body.search_value
        }

        // date query
        if (filter_start_date == '' || filter_end_date == '') {
            if (filter_start_date == '' && filter_end_date == '') {
                start_date = new Date(0);
                end_date = new Date(Date.now());
            } else if (filter_start_date != '' && filter_end_date == '') {
                start_date = new Date(filter_start_date)
                start_date = start_date.setHours(0, 0, 0, 0)
                start_date = new Date(start_date)
                end_date = new Date(Date.now())
            } else {
                end_date = new Date(filter_end_date)
                end_date = end_date.setHours(23, 59, 59, 999)
                end_date = new Date(end_date)
                start_date = new Date(0)
            }
        } else if (filter_start_date == undefined || filter_end_date == undefined) {
            start_date = new Date(0);
            end_date = new Date(Date.now());
        } else {
            start_date = new Date(req.body.start_date)
            start_date = start_date.setHours(0, 0, 0, 0)
            start_date = new Date(start_date)
            end_date = new Date(req.body.end_date)
            end_date = end_date.setHours(23, 59, 59, 999)
            end_date = new Date(end_date)
        }

        // search query
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let search

        if (search_item == "user_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['provider_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['provider_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { 'unique_id': parseInt(search_value) } };
        }
        // for user
        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                as: 'user_detail'
            }
        }
        let user_unwind = {
            $unwind: {
                path: '$user_detail',
                preserveNullAndEmptyArrays: true
            }
        }

        // for provider
        let proivder_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'confirmed_provider',
                foreignField: '_id',
                as: 'provider_detail'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: '$provider_detail',
                preserveNullAndEmptyArrays: true
            }
        }
        // date filter 
        let filter = { $match: { 'created_at': { $gte: start_date, $lt: end_date } } }
        // match condition
        let condition = { $match: { 'user_type_id': Schema(req.body.dispatcher_id) } }
        // page limit skip sort done
        let limit = { $limit: 10 }
        let skip = { $skip: req.body.page * 10 }
        let sort = { $sort: { [sort_field]: parseInt(sort_order) } }

        let total_trip = await Trip_history.aggregate([filter, condition, user_lookup, user_unwind, proivder_lookup, provider_unwind, search])
        let total_page = Math.ceil(total_trip.length / 10)
        let trip_details = await Trip_history.aggregate([filter, condition, user_lookup, user_unwind, proivder_lookup, provider_unwind, search, sort, skip, limit])

        res.json({ success: true, detail: trip_details, 'current_page': page, 'total_pages': total_page });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.history_excel = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        //Old code: 
        // if (req.body.page == undefined) {
        //     page = 0;
        //     next = 1;
        //     pre = 0;
        // } else {
        //     page = req.body.page;
        //     next = parseInt(req.body.page) + 1;
        //     pre = req.body.page - 1;
        // }

        let request;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let start_date
        let end_date
        if (req.body.search_item == undefined) {
            request = req.path.split('/')[1];
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
        } else {
            request = req.body.request;
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }
        if (req.body.start_date == '' || req.body.end_date == '') {
            if (req.body.start_date == '' && req.body.end_date == '') {
                start_date = new Date(0);
                end_date = new Date(Date.now());
            } else if (req.body.start_date == '') {
                start_date = new Date(0);
                end_date = req.body.end_date;
                end_date = new Date(end_date);
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
            } else {
                start_date = req.body.start_date;
                start_date = new Date(start_date);
                start_date = start_date.setHours(0, 0, 0, 0);
                start_date = new Date(start_date);
                end_date = new Date(Date.now());
            }
        } else if (req.body.start_date == undefined || req.body.end_date == undefined) {
            start_date = new Date(0);
            end_date = new Date(Date.now());
        } else {
            start_date = req.body.start_date;
            end_date = req.body.end_date;
            start_date = new Date(start_date);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }
        let Table = Trip_history
        if (request == 'dispatcher_request') {
            Table = Trip;
        }
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
                localField: "confirmed_provider",
                foreignField: "_id",
                as: "provider_detail"
            }
        };
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let search = {}
        if (search_item == "user_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['provider_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['provider_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['provider_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        let filter = { "$match": {} };
        filter["$match"]['created_at'] = { $gte: start_date, $lt: end_date };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let condition = { $match: { 'user_type_id': { $eq: Schema(req.body.dispatcher_id) } } };

        let array = await Table.aggregate([condition, lookup, unwind, lookup1, search, filter, sort])

        let date = new Date()
        let time = date.getTime()
        let wb = new xl.Workbook();
        let ws = wb.addWorksheet('sheet1');
        let col = 1;

        let title
        if(req.body.header){
           title = req.body.header
        }else{
            title = {
                id : 'Id',
                user_id : 'UserId',
                user : 'User',
                driver_id : 'DriverId',
                driver : 'Driver',
                date : 'Date',
                status : 'Status',
                amout : 'Amount',
                payment : 'Payment',
                payment_status : 'Payment Status',
                title_status_cancel_by_provider : 'Cancelled By Provider',
                title_status_cancel_by_user : 'Cancelled By User',
                title_trip_status_coming : 'Coming',
                title_trip_status_arrived : 'Arrived',
                title_trip_status_trip_started : 'Started',
                title_trip_status_completed : 'Compeleted',
                title_trip_status_accepted : 'Accepted',
                title_trip_status_waiting : 'Waiting',
                title_pay_by_cash : 'Cash',
                title_pay_by_card : 'Card',
                title_pending : 'Pending',
                title_paid : 'Paid',
                title_not_paid : 'Not Paid'
            }
        }

        ws.cell(1, col++).string(title.id);
        ws.cell(1, col++).string(title.user_id);
        ws.cell(1, col++).string(title.user);
        ws.cell(1, col++).string(title.driver_id);
        ws.cell(1, col++).string(title.driver);
        ws.cell(1, col++).string(title.driver_id);
        ws.cell(1, col++).string(title.status);
        ws.cell(1, col++).string(title.amount);
        ws.cell(1, col++).string(title.payment);
        ws.cell(1, col++).string(title.payment_status);


        array.forEach(function (data, index) {
            col = 1;
            ws.cell(index + 2, col++).number(data.unique_id);
            ws.cell(index + 2, col++).number(data.user_detail.unique_id);
            ws.cell(index + 2, col++).string(data.user_detail.first_name + ' ' + data.user_detail.last_name);

            if (data.provider_detail.length > 0) {
                ws.cell(index + 2, col++).number(data.provider_detail[0].unique_id);
                ws.cell(index + 2, col++).string(data.provider_detail[0].first_name + ' ' + data.provider_detail[0].last_name);
            } else {
                col += 2;
            }
            ws.cell(index + 2, col++).string(moment(data.created_at).format("DD MMM 'YY") + ' ' + moment(data.created_at).format("hh:mm a"));

            if (data.is_trip_cancelled == 1) {
                if (data.is_trip_cancelled_by_provider == 1) {
                    ws.cell(index + 2, col++).string(title.title_status_cancel_by_provider);
                } else if (data.is_trip_cancelled_by_user == 1) {
                    ws.cell(index + 2, col++).string(title.title_status_cancel_by_user);
                } else {
                    ws.cell(index + 2, col++).string(title.title_trip_status_cancelled);
                }
            } else {
                if (data.is_provider_status == PROVIDER_STATUS.COMING) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_coming );
                } else if (data.is_provider_status == PROVIDER_STATUS.ARRIVED) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_arrived );
                } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
                } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_COMPLETED) {
                    ws.cell(index + 2, col++).string(title.title_trip_status_completed);
                } else if (data.is_provider_status == PROVIDER_STATUS.ACCEPTED || data.is_provider_status == PROVIDER_STATUS.WAITING) {
                    if (data.is_provider_accepted == 1) {
                        ws.cell(index + 2, col++).string(title.title_trip_status_accepted );
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
                wb.write('data/xlsheet/' + time + '_dispatcher_request.xlsx', function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_dispatcher_request.xlsx";
                        res.json(url);
                        setTimeout(function () {
                            fs.unlink('data/xlsheet/' + time + '_dispatcher_request.xlsx', function () {
                            });
                        }, 10000)
                    }
                });
            }
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.future_request = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let page;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let value;
        let start_date
        let end_date
        let search

        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }

        if (req.body.search_item == undefined) {
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';

        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }

        if (req.body.start_date == '' || req.body.end_date == '') {
            if (req.body.start_date == '' && req.body.end_date == '') {
                start_date = new Date(0);
                end_date = new Date(Date.now());
            } else if (req.body.start_date == '') {
                start_date = new Date(0);
                end_date = req.body.end_date;
                end_date = new Date(end_date);
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
            } else {
                start_date = req.body.start_date;
                start_date = new Date(start_date);
                start_date = start_date.setHours(0, 0, 0, 0);
                start_date = new Date(start_date);
                end_date = new Date(Date.now());
            }
        } else if (req.body.start_date == undefined || req.body.end_date == undefined) {
            start_date = new Date(0);
            end_date = new Date(Date.now());
        } else {
            start_date = req.body.start_date;
            end_date = req.body.end_date;
            start_date = new Date(start_date);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }

        let number_of_rec = 10;

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

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        if (search_item == "user_detail.first_name") {
            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;

        let condition = { $match: { 'is_schedule_trip': { $eq: true } } };
        let condition1 = { $match: { 'is_trip_cancelled': { $eq: 0 } } };
        let condition2 = { $match: { 'is_trip_completed': { $eq: 0 } } };
        let condition3 = { $match: { 'is_trip_end': { $eq: 0 } } };
        let condition4 = { $match: { 'provider_id': { $eq: null } } };
        let dispatcher_type_condition = { $match: { 'user_type_id': { $eq: Schema(req.body._id) } } };
        let vehicle_type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'type_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, typename: 1, unique_id: 1 } }],
                as: 'vehicle_type_details'
            }
        }
        let vehicle_unwind = { $unwind: "$vehicle_type_details"}
        let array = await Trip.aggregate([dispatcher_type_condition, condition, condition1, condition2, condition3, condition4, lookup, unwind , vehicle_type_lookup, vehicle_unwind, search, filter, count])

        if (array.length == 0) {
            res.json({ success: true, detail: array });
            return
        }
        let pages = Math.ceil(array[0].total / number_of_rec);
        let arrays = await Trip.aggregate([dispatcher_type_condition, condition, condition1, condition2, condition3, condition4, lookup,vehicle_type_lookup, vehicle_unwind, unwind, search, filter, sort, skip, limit])
        res.json({ success: true, detail: arrays, pages: pages });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.future_excel = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let page;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let value;
        let start_date
        let end_date
        let search

        console.log(req.body);
        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }

        if (req.body.search_item == undefined) {
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }

        if (req.body.start_date == '' || req.body.end_date == '') {
            if (req.body.start_date == '' && req.body.end_date == '') {
                start_date = new Date(0);
                end_date = new Date(Date.now());
            } else if (req.body.start_date == '') {
                start_date = new Date(0);
                end_date = req.body.end_date;
                end_date = new Date(end_date);
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
            } else {
                start_date = req.body.start_date;
                start_date = new Date(start_date);
                start_date = start_date.setHours(0, 0, 0, 0);
                start_date = new Date(start_date);
                end_date = new Date(Date.now());
            }
        } else if (req.body.start_date == undefined || req.body.end_date == undefined) {
            start_date = new Date(0);
            end_date = new Date(Date.now());
        } else {
            start_date = req.body.start_date;
            end_date = req.body.end_date;
            start_date = new Date(start_date);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }

        let number_of_rec = 10;

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

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        if (search_item == "user_detail.first_name") {
            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);


        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let condition = { $match: { 'is_schedule_trip': { $eq: true } } };
        let condition1 = { $match: { 'is_trip_cancelled': { $eq: 0 } } };
        let condition2 = { $match: { 'is_trip_completed': { $eq: 0 } } };
        let condition3 = { $match: { 'is_trip_end': { $eq: 0 } } };
        let condition4 = { $match: { 'provider_id': { $eq: null } } };
        let dispatcher_type_condition = { $match: { 'user_type_id': { $eq: Schema(req.body.dispatcher_id) } } };
        let array = await Trip.aggregate([dispatcher_type_condition, condition, condition1, condition2, condition3, condition4, lookup, unwind, search, filter, sort])
        let date = new Date();
        let time = date.getTime();
        let wb = new xl.Workbook();
        let ws = wb.addWorksheet('sheet1');
        let col = 1;

        ws.cell(1, col++).string("ID");
        ws.cell(1, col++).string("USER");
        ws.cell(1, col++).string("PICKUP ADDRESS");
        ws.cell(1, col++).string("DESTINATION ADDRESS");
        ws.cell(1, col++).string("TIME ZONE");
        ws.cell(1, col++).string("REQUEST CREATION TIME");
        ws.cell(1, col++).string("STATUS");
        ws.cell(1, col++).string("PAYMENT");
        if (array.length == 0) {
            res.json({ success: true, array: array })
            return
        }
        array.forEach(function (data, index) {
            col = 1;
            ws.cell(index + 2, col++).number(data.unique_id);
            ws.cell(index + 2, col++).string(data.user_detail.first_name + ' ' + data.user_detail.last_name);
            ws.cell(index + 2, col++).string(data.source_address);
            ws.cell(index + 2, col++).string(data.destination_address);
            ws.cell(index + 2, col++).string(data.timezone);
            ws.cell(index + 2, col++).string(moment(data.created_at).format("DD MMM 'YY") + ' ' + moment(data.created_at).format("hh:mm a"));

            if (data.is_trip_created == 1) {
                ws.cell(index + 2, col++).string("Created");
            } else {
                ws.cell(index + 2, col++).string("Pending");
            }

            if (data.payment_mode == 1) {
                ws.cell(index + 2, col++).string(req.__('title_pay_by_cash'));
            } else {
                ws.cell(index + 2, col++).string(req.__('title_pay_by_card'));
            }

            if (index == array.length - 1) {
                wb.write('data/xlsheet/' + time + '_dispatcher_future_request.xlsx', function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_dispatcher_future_request.xlsx";
                        res.json(url);
                        setTimeout(function () {
                            fs.unlink('data/xlsheet/' + time + '_dispatcher_future_request.xlsx', function () {
                            });
                        }, 10000)
                    }
                });
            }
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.set_trip_status_by_dispatcher = async function (req, res, next) {
    try {        
        await trips.provider_set_trip_status(req,res)
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_complete_by_dispatcher = async function (req, res, next) {
    try {
        await trips.provider_complete_trip(req,res)
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_payment_by_dispatcher = async function (req, res, next) {
    try {
        await trips.pay_payment(req,res)
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.assign_trip_to_provider = async function(req, res) {
    try{
        let params_array = [{ name: 'trip_id', type: 'string' }, { name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        
        const provider = await Provider.findOne({ _id: req.body.provider_id})
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND})

        const trip = await Trip.findOne({ _id: req.body.trip_id })
        if(!trip) return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND})

        if(provider.admintypeid.toString() != trip.type_id.toString()) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_TYPE_NOT_MATCH})
            return
        }
            
        if (trip.is_provider_accepted >= PROVIDER_STATUS.ACCEPTED) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED})
        }

        if (trip.current_providers.length != 0) {
            const assigned_provider = await Provider.find({ _id: { $in: trip.current_providers} })
            //Old Code: if(!assigned_provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND})
            for await (let provider of assigned_provider) {
                await Provider.findOneAndUpdate({ _id: provider._id }, { $pull: { schedule_trip: trip._id }})
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_REQUEST_CANCELLED_BY_PROVIDER, "", null, provider.lang_code);
            }
        }
        await Trip.findOneAndUpdate({ _id: trip._id  }, { current_provider: provider._id, current_providers: [provider._id], is_provider_accepted: 0, is_provider_assigned_by_dispatcher: true}, { new: true })
        await Provider.findOneAndUpdate({ _id: provider._id }, { $addToSet: { schedule_trip: trip._id }})

        utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_NEW_TRIP, "", null, provider.lang_code);

        if(provider.is_trip.length > 0) utils.update_request_status_socket(provider.is_trip[0], trip._id);
        else utils.send_socket_request(trip._id, provider._id);
        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_PROVIDER_ASSIGNED_SUCCESSFULLY
        })

    } catch(error) {
        utils.error_response(error, req, res)
    }
}