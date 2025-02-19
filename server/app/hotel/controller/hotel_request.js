let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails')
let Hotel = require('mongoose').model('Hotel');
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
let trips = require('../../controllers/trip')
const country_list = require('../../../country_list.json')
const {
    TYPE_ERROR_CODE,
} = require('../../utils/error_code')
const {
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
        let hotel = await Hotel.findById(req.body._id)
        let server_date = new Date(Date.now());
        let country_data = await Country.findOne({ countryname: hotel.country })
        res.json({
            server_date: server_date, scheduled_request_pre_start_minute: setting_detail.scheduled_request_pre_start_minute,
            country_code: country_data.countrycode,
            phone_number_min_length: setting_detail.minimum_phone_number_length,
            phone_number_length: setting_detail.maximum_phone_number_length,
            hotel: hotel, country: hotel.country
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.search_hotel_user = async function(req,res){
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

        const hotel = await Hotel.findById(req.body._id)
        const condition = { is_approved: 1 ,
                            country: hotel.country, 
                            $or:[{email:search},{phone:search}]
                        }
        const searched_user = await User.find(condition)
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

        let condition = { $match: { $and: [{ user_type_id: Schema(req.body.hotel_id) }, { is_trip_completed: { $eq: 0 } }, { is_trip_cancelled: { $eq: 0 } }, { is_provider_accepted: { $eq: 1 } }, { is_provider_status: { $lt: 4 } }] } }
        let accepted_request = await Trip.aggregate([condition, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])
        accepted_request_list = accepted_request;

        let condition1 = { $match: { $and: [{ user_type_id: Schema(req.body.hotel_id) }, { is_trip_completed: { $eq: 0 } }, { is_trip_cancelled: { $eq: 0 } }, { is_provider_accepted: { $eq: 1 } }, { is_provider_status: { $eq: 4 } }] } }
        let arrived_request = await Trip.aggregate([condition1, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])
        arrived_request_list = arrived_request;

        let condition2 = { $match: { $and: [{ user_type_id: Schema(req.body.hotel_id) }, { is_provider_accepted: { $eq: 1 } }, { is_provider_status: { $eq: 6 } }] } }
        let started_request = await Trip.aggregate([condition2, lookup, unwind, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])
        started_request_list = started_request;

        let condition3 = {
            $match: {
                $and: [
                    { user_type_id: Schema(req.body.hotel_id) },
                    { is_trip_completed: { $eq: 0 } },
                    { is_trip_cancelled: { $eq: 0 } },
                    {
                        $or:
                            [
                                { is_provider_accepted: { $eq: 0 } },
                                { is_provider_accepted: { $eq: 3 } }
                            ]
                    }
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
        let request_list = await Trip.aggregate([condition3, lookup4, unwind4, lookup1, unwind1, lookup2, unwind2, lookup3, unwind3])

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
                destination_addresses: trip.destination_addresses
            })
        });
        res.json({ success: true, moment: moment, request_list: array, arrived_request_list: arrived_request_list, accepted_request_list: accepted_request_list, started_request_list: started_request_list })
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
        let trip_unwind = {
            $unwind: {
                path: "$trip_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let country_condition = { $match: { 'country': req.body.country } }

        let current_location_service_type_id_query = { $match: {} };
        if (req.body.current_location_service_type_id != '') {
            current_location_service_type_id_query = { $match: { service_type: Schema(req.body.current_location_service_type_id) } }
        }

        let providers = await Provider.aggregate([provider_query2, current_location_service_type_id_query, country_condition, provider_query, provider_query1, city_type_lookup, city_type_unwind, type_lookup, type_unwind, trip_lookup, trip_unwind])
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
                country_id: (country && country._id) ? country._id : null,
                user_unique_id: user.unique_id,
            })
            return
        } else {
            if (user_email) {
                if (user_email.current_trip_id) {
                    res.json({ success: false, user: user_email, error_code: TYPE_ERROR_CODE.TRIP_ALREADY_RUNNING })
                    return
                } else {
                    res.json({ success: true, user: user_email })
                    return
                }
            } else if (user_phone) {
                if (user_phone.current_trip_id) {
                    res.json({ success: false, user: user_phone, error_code: TYPE_ERROR_CODE.TRIP_ALREADY_RUNNING })
                    return
                } else {
                    res.json({ success: true, user: user_phone })
                    return
                }
            }
        }
    }
    let userdata = await User.findOne({ _id: req.body.user_id })
    if (userdata.current_trip_id) {
        res.json({ success: false, user: userdata, error_code: TYPE_ERROR_CODE.TRIP_ALREADY_RUNNING })
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

exports.set_trip_status_by_hotel = async function (req, res, next) {
    try {        
        await trips.provider_set_trip_status(req,res)
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_complete_by_hotel = async function (req, res, next) {
    try {
        await rips.provider_complete_trip(req,res)
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_payment_by_hotel = async function (req, res, next) {
    try {
        await trips.pay_payment(req,res)
        return
    }
    catch (err) {
        utils.error_response(err, req, res)
    }
};