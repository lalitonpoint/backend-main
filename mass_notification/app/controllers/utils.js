let utils = require('./utils');
let Settings = require('mongoose').model('Settings');
let FCM = require('fcm-node');
let path = require('path');
let Admin = require('mongoose').model('admin');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let webpush = require('web-push')
let fs = require("fs");
let error_handler = require('./error_handler');
const {
    COLLECTION
} = require('./constant')
const {
    ERROR_CODE
} = require('../utils/error_code')
const fetch = require('node-fetch');
const { google } = require('googleapis');

exports.error_response = function (err, req, res, options = {}) {
    console.log(err);
    const statusCode = err.statusCode || 500;
    //Useless Code: const params = req.method == "POST" ? req.body : req.query;

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
        } else {
            console.log('Appended errorResponse to error_log.json');
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
        } else {
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

exports.sendMassPushNotification = async function (app_type, device_type, device_token, messageCode,ios_sound_file,webpush_config) {
    try {
        let setting_data = await Settings.findOne({})

        if (device_type == constant_json.PUSH_DEVICE_TYPE_ANDROID || device_type == constant_json.PUSH_DEVICE_TYPE_IOS) {
            const accessToken = await getAccessToken();
            let regTokens = device_token;
            let projectId = setting_data.firebase_projectId;
            for (let i = 0; i < regTokens.length; i++) {
                const message = {
                    message: {
                        token: regTokens[i],
                        data: {
                            id: messageCode,
                        },
                        apns: {
                            payload: {
                                aps: {
                                    alert: {
                                        "loc-key": messageCode,
                                    },
                                    sound: "default"
                                }
                            }
                        },
                        android: {
                            priority: 'high'
                        }
                    }
                };

                try {
                    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    });

                    if (!response.ok) {
                        console.error("Notification Not Sent", await response.json());
                    } else {
                        console.log("Notification Sent Successfully");
                    }
                } catch (error) {
                    console.error("Error sending notification: ", error);
                }
            }
        }
        if (device_type == "web" &&  webpush_config && webpush_config.length > 0) {
            for (const config of webpush_config) {
                if (Object.keys(config).length > 0){
                    const subscription = config
                    const payload = {
                        notification: {
                            title: `${setting_data.app_name} Notification`,
                            body: messageCode,
                            icon: setting_data.api_base_url + '/web_images/mail_title_image.png',
                        },
                    };
                    const options = {
                        vapidDetails: {
                            subject: 'mailto:' + setting_data.admin_email,
                            publicKey: setting_data.webpush_public_key,
                            privateKey: setting_data.webpush_private_key,
                        },
                        TTL: 60,
                    };
                    webpush.sendNotification(subscription, JSON.stringify(payload), options)
                        .then((_) => {
                            console.log('SENT!!!');
                        })
                        .catch((_) => {
                        console.log(_);
                    });
                }
            }
        }
    } catch (err) {
        console.log(err)
    }
}

async function getAccessToken() {
    return new Promise(async function (resolve, reject) {
        let setting_detail = await Settings.findOne({});
        const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
        const SCOPES = [MESSAGING_SCOPE];
        const client_email = setting_detail.client_email
        const private_key = setting_detail.private_key
        const jwtClient = new google.auth.JWT(
            client_email,
            null,
            private_key,
            SCOPES,
            null
        );
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                reject(err);
                return;
            }
            resolve(tokens.access_token);
        });
    });
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

exports.get_country_city_condition = function (type, headers) {
    return new Promise((resolve, reject) => {
        
        let country_city_condition = {}
        let country_param = null
        let city_param = null
        let is_check_absolute_name = false

        if(type == COLLECTION.MASS_NOTIFICATION){
            country_param = "country"
        }

        if(headers.is_country_based_access_control_enabled && country_param){
            country_city_condition[country_param] = {$in: is_check_absolute_name ? headers.countries : headers.allowed_countries };
        }
        if(headers.is_city_based_access_control_enabled && city_param){
            country_city_condition[city_param] = {$in: is_check_absolute_name ? headers.cities : headers.allowed_cities};
        }
        
        resolve(country_city_condition);
    })
}

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