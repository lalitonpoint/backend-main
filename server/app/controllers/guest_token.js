let Country = require('mongoose').model('Country');
let Setting = require('mongoose').model('Settings');
let Guest_Token = require('mongoose').model('guest_token');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let TripLocation = require('mongoose').model('trip_location');
const Trip_Service = require('mongoose').model('trip_service');

exports.track_trip_new = async function (req, res) {
    let guest_user_token = req.query.token;
    let trip_id = req.query.trip_id;
    let trip_unique_id = req.query.trip_unique_id;
    let now = new Date();
    let guest_token = await Guest_Token.findOne({ token_value: guest_user_token, state: true, start_date: { $lte: now }, code_expiry: { $gte: now } });
    if (!guest_token) {
        return res.json({ success: false });
    }
    let condition = { unique_id: trip_unique_id, user_type_id: guest_token._id };
    if (trip_id) {
        condition = { _id: trip_id, user_type_id: guest_token._id };
    }
    let trip_data = await Trip.findOne(condition);
    let trip_path_data = null;
    if (!trip_data) {
        trip_data = await Trip_history.findOne(condition);
    }

    if (!trip_data) {
        res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
        return;
    }
    
    let tripservice
    let cancellation_fee = 0
    if(trip_data.trip_service_city_type_id) {
        tripservice = await Trip_Service.findOne({ _id: trip_data.trip_service_city_type_id })
        if (!tripservice) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
            return;
        }
        cancellation_fee = tripservice.cancellation_fee;
    }

    if (trip_data) {
        trip_path_data = await TripLocation.findOne({ tripID: trip_data._id });
    }

    return res.json({ success: true, guest_token, trip_data, trip_path_data, cancellation_fee  });
}



