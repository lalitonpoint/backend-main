const Admin = require('mongoose').model('admin');
let Country = require('mongoose').model('Country');
const City = require('mongoose').model('City');
const moment_timezone = require('moment-timezone');
const Settings = require('mongoose').model('Settings');
const request = require('request');
const fs = require("fs");
const path = require('path');
const {
    COLLECTION
} = require('./constant.js')
const {
    ERROR_CODE
}= require('../utils/error_code.js')
const error_handler = require('./error_handler');

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
                resolve({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_PARAMETER_MISSING),
                    error_message: missing_param + ' parameter missing',
                });
            } else if (is_invalid_param) {
                resolve({ 
                    success: false,
                    error_code: String(error_message.ERROR_CODE_PARAMETER_INVALID),
                    error_message: invalid_param + ' parameter invalid',
                });
            } else {
                resolve({ success: true });
            }
        } else {
            resolve({ success: true });
        }
    })
}

exports.error_response = function (err, req, res, options = {}) {
    console.log(err);
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


exports.check_request_params = function (request_data_body, params_array, response) {
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

exports.get_date_in_city_timezone = function (date, timezone) {
    let convert_date = new Date(date);
    let zone_time_diff = moment_timezone.tz.zone(timezone).utcOffset(moment_timezone.utc());

    convert_date.setMinutes(convert_date.getMinutes() + zone_time_diff);
    convert_date = new Date(convert_date);
    return convert_date;
};

exports.get_date_filter = async (start_date, end_date) => {

    return new Promise(async (resolve, reject) => {
        const setting_detail = await Settings.findOne({});
    
        // start_date
        start_date = new Date(start_date);
        start_date = exports.get_date_in_city_timezone(start_date, setting_detail.timezone_for_display_date);
        start_date = moment_timezone(moment_timezone(start_date).startOf('day')).format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
        start_date = new Date(start_date);

        // end_date
        end_date = new Date(end_date);
        end_date = exports.get_date_in_city_timezone(end_date,setting_detail.timezone_for_display_date);
        end_date = moment_timezone(moment_timezone(end_date).endOf('day')).format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
        end_date = new Date(end_date);

        resolve({
            new_start_date: start_date,
            new_end_date: end_date
        })
    })
}

exports.check_auth_middleware = async function (id, token) {
    return new Promise(async (resolve, reject) => {
       
        let check_type = await Admin.findOne({ _id: id, token: token })
        if (!check_type) {
            resolve({ success: false })
            return
        }
        let is_show_email = ("is_show_email" in check_type) ? check_type.is_show_email : true
        let is_show_phone = ("is_show_phone" in check_type) ? check_type.is_show_phone : true

        // Country and city based restrictions
        let is_country_based_access_control_enabled = ("is_country_based_access_control_enabled" in check_type) ? check_type.is_country_based_access_control_enabled : false
        let allowed_countries = ("allowed_countries" in check_type) ? check_type.allowed_countries : []
        let is_city_based_access_control_enabled = ("is_city_based_access_control_enabled" in check_type) ? check_type.is_city_based_access_control_enabled : false
        let allowed_cities = ("allowed_cities" in check_type) ? check_type.allowed_cities : []
        
        let countries = [];
        let cities = [];

        if(is_country_based_access_control_enabled){
            countries = await Country.aggregate([{$match: {_id: {$in: allowed_countries}}}, {$group: {_id: null, countries: {$push: "$countryname"}}}])
            if(countries.length > 0){
                countries = countries[0].countries
            }
        }
        if(is_city_based_access_control_enabled){
            cities = await City.aggregate([{$match: {_id: {$in: allowed_cities}}}, {$group: {_id: null, cities: {$push: "$cityname"}}}])
            if(cities.length > 0){
                cities = cities[0].cities
            }
        }

        resolve({ success: true, 
            is_show_email: is_show_email, 
            is_show_phone: is_show_phone,
            is_country_based_access_control_enabled: is_country_based_access_control_enabled,
            allowed_countries: allowed_countries,
            is_city_based_access_control_enabled: is_city_based_access_control_enabled,
            allowed_cities: allowed_cities,
            countries: countries,
            cities: cities
        })
    })
}

exports.get_country_city_condition = function (types, headers = null) {
    return new Promise((resolve, reject) => {
        
        let country_city_condition = {}
        let country_param = null
        let city_param = null
        let is_check_absolute_name = false

        if(!Array.isArray(types)){
            types = [types]
        }

        types.forEach((type) => {
            is_check_absolute_name = false
            country_param = null
            city_param = null
            switch (type) {
                case COLLECTION.TRIP:
                    country_param = "country_id"
                    city_param = "city_id"
                    break;
                case COLLECTION.WALLET_HISTORY:
                case COLLECTION.TRANSFER_HISTORY:
                    country_param = "country_id"
                    break;
                default:
                    break;
            }
            country_city_condition[type] = {}
            
            if(headers && headers.is_country_based_access_control_enabled && country_param){
                country_city_condition[type][country_param] = {$in: is_check_absolute_name ? headers.countries : headers.allowed_countries };
            }
            if(headers && headers.is_city_based_access_control_enabled && city_param){
                country_city_condition[type][city_param] = {$in: is_check_absolute_name ? headers.cities : headers.allowed_cities};
            }
        });
        
        if(types.length == 1){
            country_city_condition = country_city_condition[types[0]]
        }
        resolve(country_city_condition);
    })
}


exports.export_file_socket = async function(json){
    let settings = await Settings.findOne({})
    let url = settings.api_base_url + '/socket_call_for_export_history'

    let options = {
        'method': 'POST',
        'url': url,
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(json)

    };
    request(options, function (error, response) {
        if (error) {
            console.log(error)
            throw new Error(error);
        }
    });
} 

exports.precisionRoundTwo = function (number) {
    return utils.precisionRound(number, 2);
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

