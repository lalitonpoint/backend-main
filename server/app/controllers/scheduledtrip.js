let utils = require('./utils');
let Trip = require('mongoose').model('Trip');
let User = require('mongoose').model('User');
let OpenRide = require('mongoose').model('Open_Ride');

/////////////GET FUTURE TRIP///////////
exports.getfuturetrip = function (req, res) {
    User.findOne({_id: req.body.user_id}, function (err, user) {
        if (user)
        {
            if (req.body.token != null && user.token != req.body.token) {
                res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
            } else
            {   
                let mongoose = require('mongoose');
                let Schema = mongoose.Types.ObjectId;
                let Table
                let condition
                let condition1
                let arr = []
                if (req.body.is_open_ride) {
                    Table = OpenRide
                    let unwind1 =  {
                        $unwind: "$user_details",
                    };
                    condition = {
                      $match: { 
                        $and: [
                            {"user_details.user_id": Schema(req.body.user_id)},
                            {"user_details.booking_cancelled":{$eq: 0}},
                            {"user_details.booking_cancelled_by_user":{$eq: 0}},
                            {"user_details.booking_cancelled_by_provider":{$eq: 0}}
                        ]
                      },
                    };
                    condition1 = {$match: {$and: [{is_schedule_trip: {$eq: false}},{ is_provider_status: { $eq: 0 } },{is_trip_cancelled: {$eq: 0}}, {is_trip_completed: {$eq: 0}}, {is_trip_end: {$eq: 0}}]}};
                    arr.push(unwind1)
                } else {
                    Table = Trip
                    condition = {$match: {'user_id': {$eq: Schema(req.body.user_id)}}};
                    condition1 = {$match: {$and: [{is_schedule_trip: {$eq: true}},{is_trip_cancelled: {$eq: 0}}, {is_trip_completed: {$eq: 0}}, {is_trip_end: {$eq: 0}} , {provider_id: {$eq: null}},{find_nearest_provider_time:null}]}};
                }
                let lookup2 = {
                    $lookup:
                        {
                            from: "trip_services",
                            localField: "trip_service_city_type_id",
                            foreignField: "_id",
                            as: "service_type"
                        }
                };
                let unwind2 = {$unwind: "$service_type"};
                arr.push(condition)
                arr.push(condition1)
                arr.push(lookup2,unwind2)

                if (req.body.is_open_ride) {
                    // project optimize query
                    arr.push({ $project: { user_details: 0 } })
                }

                // Trip.find({user_id: req.body.user_id, is_schedule_trip: true, is_trip_cancelled: 0, is_trip_completed: 0, is_trip_end: 0, provider_id: null, current_provider: null}, function (err, scheduledtrip) {
                    Table.aggregate(arr, function (err, scheduledtrip) {
                    if (err || scheduledtrip.length === 0) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_NO_SCHEDULED_TRIP_FOUND});

                    } else {
                        res.json({success: true, message: success_messages.MESSAGE_CODE_GET_YOUR_FUTURE_TRIP_SUCCESSFULLY, scheduledtrip: scheduledtrip});
                    }
                });
            }
        } else
        {
            res.json({success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND});

        }
    });
};


//////////// cancelScheduledtrip////////////

exports.cancelScheduledtrip = function (req, res) {

    utils.check_request_params(req.body, [], function (response) {
        if (response.success) {
            ScheduledTrip.findOneAndUpdate({_id: req.body.scheduledtrip_id}, req.body, {new: true}, function (err, scheduledtrip) {

                if (scheduledtrip) {
                    if (scheduledtrip.is_schedule_trip_cancelled == 0 && scheduledtrip.is_trip_created == 0) {
                        scheduledtrip.is_schedule_trip_cancelled = 1;
                        scheduledtrip.save();
                        res.json({
                            success: true,
                            message: success_messages.MESSAGE_CODE_YOUR_FUTURE_TRIP_CANCELLED_SUCCESSFULLY,
                            is_schedule_trip_cancelled: scheduledtrip.is_schedule_trip_cancelled
                        });
                    } else {
                        res.json({
                            success: false,
                            error_code: error_message.ERROR_CODE_MIS_MATCH_SCHEDULETRIP_ID
                        });
                    }
                } else {
                    res.json({
                        success: false,
                        error_code: error_message.ERROR_CODE_MIS_MATCH_SCHEDULETRIP_ID
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


