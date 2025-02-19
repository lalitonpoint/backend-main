let OpenRide = require('mongoose').model('Open_Ride');
let TripLocation = require('mongoose').model('trip_location');
let utils = require('../../controllers/utils')
let mongoose = require('mongoose');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let moment = require('moment');
let Settings = require('mongoose').model('Settings')
const {
    TYPE_VALUE,
    TRIP_STATUS_TIMELIME
} = require('../../controllers/constant');

exports.openride_get_trip_detail = async function (req, res) {
    try {
        let params_array = [{ name: "trip_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
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
        let trip_location_data=await TripLocation.findOne({tripID:req.body.trip_id});
        let trip_condition = { "$match": { '_id': { $eq: mongoose.Types.ObjectId(req.body.trip_id) } } };
            let trip_detail = await OpenRide.aggregate([trip_condition,   vehicle_type_lookup, vehicle_unwind, service_lookup, service_unwind ])
            if (trip_detail.length == 0) {
                return res.json({ success: false }, error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND)
            }
            res.json({ success: true, trip_detail: trip_detail,trip_location_data:trip_location_data })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.scheduled_open_ride_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let trip_detail = await OpenRide.findOne({
            _id: req.body.trip_id,
            is_trip_cancelled: 0,
            is_trip_cancelled_by_provider: 0,
        })
        if (!trip_detail) {
            res.json({ success: false });
            return;
        }
       
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);

        if (req.body.user_id) {
            let userdetails_index = trip_detail.user_details.findIndex(item => item.user_id.toString() == req.body.user_id.toString())

            if (userdetails_index != -1) {
                trip_detail.user_details[userdetails_index].booking_cancelled = 1 
                trip_detail.user_details[userdetails_index].payment_status = 1
                trip_detail.cancel_reason = req.body?.cancel_reason;

                // Set trip status
                const openride_username = trip_detail.user_details[userdetails_index].first_name + " " + trip_detail.user_details[userdetails_index].last_name
                const openride_user_id = trip_detail.user_details[userdetails_index]._id

                trip_detail.trip_status =
                    await utils.addTripStatusTimeline(
                        trip_detail,
                        TRIP_STATUS_TIMELIME.TRIP_CANCELLED,
                        TYPE_VALUE.ADMIN, 
                        req.headers.username, 
                        req.headers.admin_id,
                        openride_username,
                        openride_user_id
                    )
            }
            let user = await User.findOne({ _id: req.body.user_id })
            if (String(trip_detail._id) == String(user.current_trip_id)) {
                user.current_trip_id = null;
                await User.updateOne({ _id: user._id }, user.getChanges())
            }
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", user.webpush_config, user.lang_code);
            
        } else {
            const updatedUserDetails = trip_detail.user_details.filter(userDetail =>
                userDetail.booking_cancelled !== 1 && userDetail.booking_cancelled_by_user !== 1 && userDetail.booking_cancelled_by_provider !== 1 
            );      

            for (const userDetails of updatedUserDetails) {
                let user = await User.findOne({ _id: userDetails.user_id });
                if (String(trip_detail._id) === String(user.current_trip_id)) {
                    user.current_trip_id = null;
                    await User.updateOne({ _id: user._id }, user.getChanges());
                }
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", user.webpush_config, user.lang_code);
                let userDetailsIndex = trip_detail.user_details.findIndex(item => item.user_id.toString() === userDetails.user_id.toString());
            
                if (userDetailsIndex !== -1) {
                    trip_detail.user_details[userDetailsIndex].booking_cancelled = 1;
                    trip_detail.user_details[userDetailsIndex].payment_status = 1;
                    trip_detail.cancel_reason = req.body?.cancel_reason;
                }
            }

            let provider = await Provider.findOne({ _id: trip_detail.confirmed_provider })
            if (provider) {
                provider = utils.remove_is_trip_from_provider(provider, trip_detail._id, trip_detail.initialDestinationLocation)
                if (!provider.is_near_trip) { provider.is_near_trip = [] }
    
                if ((String(provider.is_trip[0]) == String(trip_detail._id))) {
                    provider.is_near_available = 1;
                    provider.is_near_trip = [];
                    provider.is_trip = [];
                    provider.is_available = 1;
                }
                await Provider.updateOne({ _id: provider._id }, provider.getChanges())
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", null, provider.lang_code);
            }

            trip_detail.is_trip_end = 1;
            trip_detail.is_trip_cancelled = 1;
            trip_detail.is_trip_cancelled_by_admin = 1
            trip_detail.cancel_reason = '';
            trip_detail.payment_status = 1
            trip_detail.provider_trip_end_time = new Date();
            trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
            trip_detail.complete_date_tag = complete_date_tag;
        }

        await OpenRide.updateOne({ _id: trip_detail._id }, trip_detail.getChanges())

        let message = admin_messages.success_message_trip_cancelled;
        utils.update_request_status_socket(trip_detail._id);

        res.json({ success: true,message:message });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.open_ride_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let trip = await OpenRide.findOne({
            _id: req.body.trip_id,
            is_trip_cancelled: 0,
            is_trip_cancelled_by_provider: 0,
        })
        if (!trip) {
            res.json({ success: false });
            return;
        }
        
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        

        if (req.body.user_id) {
            let userdetails_index = trip.user_details.findIndex(item => item.user_id.toString() == req.body.user_id.toString())

            if (userdetails_index != -1) {
                trip.user_details[userdetails_index].booking_cancelled = 1 
                trip.user_details[userdetails_index].payment_status = 1
                trip.cancel_reason = req.body?.cancel_reason;

                // Set trip status
                const openride_username = trip.user_details[userdetails_index].first_name + " " + trip.user_details[userdetails_index].last_name
                const openride_user_id = trip.user_details[userdetails_index]._id

                trip.trip_status =
                    await utils.addTripStatusTimeline(
                        trip,
                        TRIP_STATUS_TIMELIME.TRIP_CANCELLED,
                        TYPE_VALUE.ADMIN,
                        req.headers.username,
                        req.headers.admin_id,
                        openride_username,
                        openride_user_id
                    )
            }
            let user = await User.findOne({ _id: req.body.user_id })
            if (String(trip._id) == String(user.current_trip_id)) {
                user.current_trip_id = null;
                await User.updateOne({ _id: user._id }, user.getChanges())
            }
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", user.webpush_config, user.lang_code);
            
        } else {
            const updatedUserDetails = trip.user_details.filter(userDetail =>
                userDetail.booking_cancelled !== 1 && userDetail.booking_cancelled_by_user !== 1 && userDetail.booking_cancelled_by_provider !== 1 
            );      
    
            for (const userDetails of updatedUserDetails) {
                let user = await User.findOne({ _id: userDetails.user_id });
                if (String(trip._id) === String(user.current_trip_id)) {
                    user.current_trip_id = null;
                    await User.updateOne({ _id: user._id }, user.getChanges());
                }
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", user.webpush_config, user.lang_code);
                let userDetailsIndex = trip.user_details.findIndex(item => item.user_id.toString() === userDetails.user_id.toString());
            
                if (userDetailsIndex !== -1) {
                    trip.user_details[userDetailsIndex].booking_cancelled = 1;
                    trip.user_details[userDetailsIndex].payment_status = 1;
                    trip.cancel_reason = req.body?.cancel_reason;
                }
            }


            let provider = await Provider.findOne({ _id: trip.confirmed_provider })
            if (provider) {
                provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
                if (!provider.is_near_trip) { provider.is_near_trip = [] }
    
                if ((String(provider.is_trip[0]) == String(trip._id))) {
                    provider.is_near_available = 1;
                    provider.is_near_trip = [];
                    provider.is_trip = [];
                    provider.is_available = 1;
                }
                await Provider.updateOne({ _id: provider._id }, provider.getChanges())
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", null, provider.lang_code);
            }


            trip.is_trip_end = 1;
            trip.is_trip_cancelled = 1;
            trip.is_trip_cancelled_by_admin = 1
            trip.cancel_reason = '';
            trip.payment_status = 1
            trip.provider_trip_end_time = new Date();
            trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
            trip.complete_date_tag = complete_date_tag;
        }
        
       

        await OpenRide.updateOne({ _id: trip._id }, trip.getChanges())

        let message = admin_messages.success_message_trip_cancelled;
        utils.update_request_status_socket(trip._id);

        res.json({ success: true, message: message });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

//api for get statement  for trip earning
exports.open_ride_statement_provider_trip_earning = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({})
        let params_trips = [{ name: "trip_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_trips)
        if (!response.success) {
            res.json(response)
            return;
        }
        let timezone_for_display_date = setting_detail.timezone_for_display_date;
        let query = { $match: {} };
        let Schema = mongoose.Types.ObjectId
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
        let Trip_service_lookup = {
            $lookup: {
                from: 'trip_services',
                localField: 'trip_service_city_type_id',
                foreignField: '_id',
                as: 'trip_service_detail'
            }
        }
        let Trip_service_unwind = {
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
        let Type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'typeid',
                foreignField: '_id',
                as: 'type_detail'
            }
        }
        let Type_unwind = {
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
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1 } }],
                as: 'providers_detail'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: "$providers_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let trip = await OpenRide.aggregate([query, user_lookup, user_unwind, Trip_service_lookup, Trip_service_unwind, city_type_lookup, city_type_unwind, Type_lookup, Type_unwind, provider_lookup, provider_unwind]);
        let rental_package;
        if (trip.car_rental_id) {
            rental_package = await City_type.findById(trip.car_rental_id);
        }
        res.json({ success: true, rental_package, detail: trip, type: req.body.type, timezone_for_display_date: timezone_for_display_date, provider_detail: "$providers_detail", user_detail: "$user_detail", type_detail: "$type_detail", service_detail: "$city_type_detail", moment: moment, tripservice: "$trip_service_detail" });
    } catch (err) {
        utils.error_response(err, req, res)
    }
}