let utils = require('./utils');
let Wallet_history = require('mongoose').model('Wallet_history');
let Provider = require('mongoose').model('Provider');
let City = require('mongoose').model('City');
let Settings = require('mongoose').model('Settings');
const Car_Rent_Vehicle = require("mongoose").model("Car_Rent_Vehicle");
let moment = require('moment');
let moment_timezone = require('moment-timezone');
let request = require('request');
let fs = require("fs");
let path = require('path');
let crypto = require('crypto')
const {
    ERROR_CODE,
    PROVIDER_TYPE
} = require('./constant');

exports.check_request_params = function (request_data_body, params_array, response) {
    // .
    let missing_param = '';
    let is_missing = false;
    let invalid_param = '';
    let is_invalid_param = false;
    if (request_data_body) {
        params_array.forEach(function (param) {
            if (request_data_body[param.name] == undefined) {
                missing_param = param.name;
                is_missing = true;
            } else {
                if (typeof request_data_body[param.name] !== param.type) {
                    is_invalid_param = true;
                    invalid_param = param.name;
                }
            }
        });

        if (is_missing) {
            response({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_MISSING), error_message: missing_param + ' parameter missing' });
        } else if (is_invalid_param) {
            response({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_INVALID), error_message: invalid_param + ' parameter invalid' });
        }
        else {
            response({ success: true });
        }
    }
    else {
        response({ success: true });
    }
}

exports.check_request_params_async = function (request_data_body, params_array) {
    return new Promise((resolve, reject) => {
        let missing_param = '';
        let is_missing = false;
        let invalid_param = '';
        let is_invalid_param = false;
        if (request_data_body) {
            params_array.forEach(function (param) {
                if (request_data_body[param.name] == undefined) {
                    missing_param = param.name;
                    is_missing = true;
                } else {
                    if (typeof request_data_body[param.name] !== param.type) {
                        is_invalid_param = true;
                        invalid_param = param.name;
                    }
                }
            });
            if (is_missing) {
                resolve({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_MISSING), error_message: missing_param + ' parameter missing' });
            } else if (is_invalid_param) {
                resolve({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_INVALID), error_message: invalid_param + ' parameter invalid' });
            } else {
                resolve({ success: true });
            }
        } else {
            resolve({ success: true });
        }
    })
}

let error_handler = require('./error_handler');
exports.error_response = function (err, req, res, options = {}) {
    const statusCode = err.statusCode || 500;

    const errorResponse = {
        success: false,
        error_code: err.code || ERROR_CODE.SOMETHING_WENT_WRONG,
        error_message: err.message || "Internal Server Error",
    };

    if (setting_detail.activity_logs) {
        errorResponse.metadata = error_handler.extractRequestData(req, options)
        errorResponse.metadata.timestamp = new  Date();
        errorResponse.metadata.stack = err.stack;
    
        let depth = 3;
        const codeSnippets = error_handler.extractCodeSnippetsFromStack(err.stack, depth);
        errorResponse.codeSnippets = codeSnippets;
    }

    // Append errorResponse to error_log.json
   
    const logFile = path.join( __dirname ,'../../log_files/error_log.json');
    const logData = JSON.stringify(errorResponse) + ",\n";

    const logDirectory = path.dirname(logFile);
    console.log(logDirectory);

    fs.appendFile(logFile, logData,{ flag: 'a+' }, (err) => {
        if (err) {
            console.error('Error appending to error_log.json:', err);
        }
    });

    res.status(statusCode).json(errorResponse);
};

// add_wallet_history
exports.addWalletHistory = function (user_type, user_unique_id, user_id, country_id, from_currency_code, to_currency_code,
    current_rate, from_amount, wallet_amount, wallet_status, wallet_comment_id, wallet_description,trans_ref) {
    let wallet_payment_in_user_currency = 0;
    let total_wallet_amount = 0;

    if (wallet_status % 2 == 0) {
        wallet_payment_in_user_currency = utils.precisionRoundTwo(from_amount / current_rate);

        total_wallet_amount = wallet_amount - wallet_payment_in_user_currency;
    } else {
        current_rate = 1 / current_rate;
        wallet_payment_in_user_currency = utils.precisionRoundTwo(from_amount * current_rate);

        total_wallet_amount = +wallet_amount + +wallet_payment_in_user_currency;

    }
    total_wallet_amount = utils.precisionRoundTwo(total_wallet_amount);
    let wallet_data = new Wallet_history({
        user_type: user_type,
        user_unique_id: user_unique_id,
        user_id: user_id,
        country_id: country_id,

        from_currency_code: from_currency_code,
        from_amount: from_amount,
        to_currency_code: to_currency_code,
        current_rate: utils.precisionRound(current_rate, 4),

        wallet_amount: wallet_amount,
        added_wallet: wallet_payment_in_user_currency,
        total_wallet_amount: total_wallet_amount,
        wallet_status: wallet_status,
        wallet_comment_id: wallet_comment_id,
        wallet_description: wallet_description,
        trans_ref: trans_ref != undefined ? trans_ref : null
    });
    wallet_data.save();
    return total_wallet_amount;
};


// add_redeem_point_history
exports.add_redeem_point_history = (user_type,user_unique_id,user_id,country_id,redeem_point_type,redeem_point_currency,redeem_point_description,added_redeem_point,previous_total_redeem_point) => {
    let redeem_point_history_data = new Redeem_point_history({
        user_type: user_type,
        user_unique_id: user_unique_id,
        user_id: user_id,
        country_id: country_id,
        redeem_point_type: redeem_point_type,
        redeem_point_currency: redeem_point_currency,
        redeem_point_description:redeem_point_description,
        added_redeem_point:added_redeem_point,
        total_redeem_point:previous_total_redeem_point + added_redeem_point
    });
    redeem_point_history_data.save();
    return total_redeem_point;
}


exports.precisionRoundTwo = function (number) {
    return utils.precisionRound(number, 2);
};

exports.precisionRound = function (number, precision) {
    let factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
};

exports.update_request_status_socket = async function (trip_id, near_destination_trip_id = null) {
    trip_id = "'" + trip_id + "'";
    // console.trace('update_request_status_socket: ' + trip_id)

    // below 3 lines are commited by me because socket_object is not defined in code right now
    // socket_object.emit(trip_id, {
    //     is_trip_updated: true, trip_id: trip_id, near_destination_trip_id
    // });

    let settings = await Settings.findOne({})
    let url = settings.api_base_url + '/socket_call'

    let options = {
        'method': 'POST',
        'url': url,
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "trip_id": trip_id,
            "near_destination_trip_id": near_destination_trip_id
        })

    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
    });


}

exports.payment_fail_socket = async function(user_id){
    let settings = await Settings.findOne({})
    let url = settings.api_base_url + '/socket_call_for_fail_payment'

    let options = {
        'method': 'POST',
        'url': url,
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "user_id":user_id
        })

    };
    request(options, function (error, response) {
        if (error) {
            console.log(error)
            throw new Error(error);
        }
    });
} 

exports.trip_provider_profit_card_wallet_settlement = async function (trip, city = null, provider = null) {
    if (!trip.is_provider_earning_set_in_wallet) {
        if (!provider) {
            provider = await Provider.findOne({ _id: trip.confirmed_provider });
        }
        if (!city) {
            city = await City.findOne({ _id: trip.city_id });
        }
        let payment_mode = trip.payment_mode;
        let is_provider_earning_set_in_wallet_on_other_payment = false;
        let is_provider_earning_set_in_wallet_on_cash_payment = false;
        if (city) {
            is_provider_earning_set_in_wallet_on_other_payment = city.is_provider_earning_set_in_wallet_on_other_payment;
            is_provider_earning_set_in_wallet_on_cash_payment = city.is_provider_earning_set_in_wallet_on_cash_payment;
        }
        let total_wallet_amount = 0
        if ((payment_mode == Number(constant_json.PAYMENT_MODE_CASH) && is_provider_earning_set_in_wallet_on_cash_payment) ||
            (payment_mode == Number(constant_json.PAYMENT_MODE_CARD) && is_provider_earning_set_in_wallet_on_other_payment)) {
            if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                if (trip.pay_to_provider < 0) {
                    total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                        provider.wallet_currency_code, trip.currencycode,
                        1, Math.abs(trip.pay_to_provider), provider.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                } else {
                    total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                        provider.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                }
                provider.wallet = total_wallet_amount;
                await provider.save();
            } else {
                let partner = await Partner.findOne({ _id: provider.provider_type_id })
                if (trip.pay_to_provider < 0) {
                    total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, Math.abs(trip.pay_to_provider), partner.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                } else {
                    total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                }
                partner.wallet = total_wallet_amount;
                await partner.save();
            }
            trip.is_provider_earning_set_in_wallet = true;
            if (trip.pay_to_provider >= 0) {
                trip.is_provider_earning_added_in_wallet = true;
            } else {
                trip.is_provider_earning_added_in_wallet = false;
            }
            trip.provider_income_set_in_wallet = Math.abs(trip.pay_to_provider);
            await trip.save();
        }
    }
}

////////////// TOKEN GENERATE ////////
exports.tokenGenerator = function (length) {

    if (typeof length == "undefined")
        length = 32;
    let token = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++){
        const randomIndex = crypto.randomInt(0, possible.length)
        token += possible.charAt(randomIndex)
    }
    return token;

};

exports.get_response_message = (language, action, code) => {
    let status = 'success-code';
    if(!action){
        status = 'error-code';
    }
    if (language) {
        try {
            let message_string = require(`../../../server/data/language/${language}.json`);
            return message_string[status][code] || "String Not Found";
        } catch (error) {
            let message_string = require(`../../../server/data/language/en.json`);
            return message_string[status][code] || "String Not Found";
        }
    } else {
        let message_string = require(`../../../server/data/language/en.json`);
        return message_string[status][code] || "String Not Found";
    }
};

exports.driver_non_availability_for_trip = async function (trip, vehicle_id) {
    let vehicle_detail = await Car_Rent_Vehicle.findOne({ _id: vehicle_id });
    
    // Remove non-availability from vehicle
    vehicle_detail.non_availability = vehicle_detail.non_availability.filter((availability) => {
        return availability?.trip_id?.toString() !== trip?._id.toString();
    });

    // Update the vehicle with filtered non_availability first
    await Car_Rent_Vehicle.findByIdAndUpdate(
        vehicle_id,
        { $set: { non_availability: vehicle_detail.non_availability } }
    );

    // Now set vehicle unavailable for trip buffer duration
    let now_time = new Date();
    const buffer_end_time = new Date(now_time.getTime() + vehicle_detail.buffer_time * 60 * 60 * 1000); // Buffer time in hours
    const nonAvailability = {
        start_date: moment.utc(now_time).toDate(),
        end_date: moment.utc(buffer_end_time).toDate(),
        trip_id: trip._id,
        availability_type: 3
    };

    // Push the new non-availability record
    await Car_Rent_Vehicle.findByIdAndUpdate(
        vehicle_id,
        { $push: { non_availability: nonAvailability } },
        { new: true }
    );
};

exports.get_date_now_at_city = function (date, timezone) { // use when you convert date now to city timezone
    let convert_date = new Date(date);
    let zone_time_diff = moment_timezone.tz.zone(timezone).utcOffset(moment_timezone.utc());
    zone_time_diff = -1 * zone_time_diff;
    convert_date.setMinutes(convert_date.getMinutes() + zone_time_diff);
    convert_date = new Date(convert_date);
    return convert_date;
};