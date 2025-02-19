let utils = require('./utils');
let crypto = require('crypto')
let City = require('mongoose').model('City');
let moment = require('moment');
let moment_timezone = require('moment-timezone');
let nodemailer = require('nodemailer');
let fs = require("fs");
let twilio = require('twilio');
let SmsDetail = require('mongoose').model('sms_detail');
let Settings = require('mongoose').model('Settings');
let Wallet_history = require('mongoose').model('Wallet_history');
let Document = require('mongoose').model('Document');
let User_Document = require('mongoose').model('User_Document');
let Provider_Document = require('mongoose').model('Provider_Document');
let Transfer_History = require('mongoose').model('transfer_history');
let CityZone = require('mongoose').model('CityZone');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let AWS = require('aws-sdk');
let console = require('./console');
let config_json = require('../../config/strings/admin_panel_string.json');
let constant_json = require('../../config/strings/constants.json');
let Provider = require('mongoose').model('Provider');
let FCM = require('fcm-node');
let jwt = require('jsonwebtoken')
let path = require('path');
let apn = require("apn")
let Partner = require('mongoose').model('Partner');
let Admin = require('mongoose').model('admin');
let Corporate = require('mongoose').model('Corporate');
let Dispatcher = require('mongoose').model('Dispatcher');
let Hotel = require('mongoose').model('Hotel');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Country = require('mongoose').model('Country');
let allemails = require('../controllers/emails');
let Redeem_point_history = require('mongoose').model('redeem_point_history');
let webpush = require('web-push')
const Admin_Profit = require('mongoose').model('admin_profit');
let Hub_User = require('mongoose').model('Hub_User');
let request = require('request')
const User_promo_use = require('mongoose').model('User_promo_use');
const Promo_Code = require('mongoose').model('Promo_Code');
const fetch = require('node-fetch');
const { google } = require('googleapis');
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");
let error_handler = require('./error_handler');
const {
    ERROR_CODE,
} = require('../utils/error_code')
const {
    TOKEN_SECRET,
    PAYMENT_GATEWAY,
    PAYMENT_STATUS,
    TYPE_VALUE,
    DOCUMENT_TYPE,
    COLLECTION,
    UPDATE_LOG_OPERATION,
    TRIP_TYPE,
    PROFIT_TYPE,
    PROVIDER_TYPE,
    VEHICLE_HISTORY_TYPE,
    DEFAULT_VALUE,
} = require('./constant');

exports.error_response = function (err, req, res, options = {}) {
    console.log(err);
    const statusCode = err.statusCode || 500;

    const errorResponse = {
        success: false,
        error_code: err.code || ERROR_CODE.SOMETHING_WENT_WRONG,
        message: err.message || "Internal Server Error",
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
            response({ success: false, error_code: error_message.ERROR_CODE_PARAMETER_MISSING, error_message: missing_param + ' parameter missing' });
        } else if (is_invalid_param) {
            response({ success: false, error_code: error_message.ERROR_CODE_PARAMETER_INVALID, error_message: invalid_param + ' parameter invalid' });
        }
        else {
            response({ success: true });
        }
    }
    else {
        response({ success: true });
    }
}

exports.check_request_params_for_web = function (request_data_body, params_array, response) {
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
            response({ success: false, error_code: error_message.PARAMETER_MISSING, error_message: missing_param + ' parameter missing' });
        } else if (is_invalid_param) {
            response({ success: false, error_code: error_message.PARAMETER_INVALID, error_message: invalid_param + ' parameter invalid' });
        }
        else {
            response({ success: true });
        }
    }
    else {
        response({ success: true });
    }
}

exports.generate_token = function () {
    try {
        let token = jwt.sign({}, TOKEN_SECRET, { expiresIn: 120 });
        return {
            success: true,
            data: token
        }
    } catch (err) {
        return {
            success: false,
            data: null
        };
    }
}

exports.sendSMS = function (to, msg) {
    Settings.findOne({}, function (err, setting) {
        if (setting) {

            let twilio_account_sid = setting.twilio_account_sid;
            let twilio_auth_token = setting.twilio_auth_token;
            let twilio_number = setting.twilio_number;
            if (twilio_account_sid != "" && twilio_auth_token != "" && twilio_number != "") {
                let client = new twilio(twilio_account_sid, twilio_auth_token);

                client.messages.create({
                    body: msg,
                    to: to, // Text this number
                    from: twilio_number // From a valid Twilio number
                }, function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log("here send sms ... ... ...");
                    }
                });
            }
        }
    });
}

exports.sendWhatsapp = async function (to, msg, config = null) {
    let settings = await Settings.findOne({})
    if (settings) {
        // settings.whatsapp_base_url = "http://localhost:5004/whatsapp"
        const request = require('request');
        const data = {
            url: settings.whatsapp_base_url + '/send_message',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                number: to,
                content: msg,
                config: config,
            }),
        };

        request.post(data, (error, response, body) => {
            
            if (error) {
                console.error(error);
            }
        });
    }
}

exports.sendSmsForOTPVerificationAndForgotPassword = function (phoneWithCode, smsID, extraParam) {
    
    SmsDetail.findOne({ smsUniqueId: smsID }, function (err, sms_data) {
        
        let smsContent = sms_data.smsContent;
        if (smsID == 1 || smsID == 2 || smsID == 3 || smsID == 9) {
            
            smsContent = smsContent.replace("XXXXXX", extraParam);
        } else if (smsID == 7) {
            smsContent = smsContent.replace("%USERNAME%", extraParam[0]).replace("%PROVIDERNAME%", extraParam[1]).replace("%PICKUPADD%", extraParam[2]).replace("%DESTINATIONADD%", extraParam[3]);
        }

        if(sms_data.isSendSMS){
            utils.sendSMS(phoneWithCode, smsContent);
        }
        if(sms_data.isSendWhatsapp){

            utils.sendWhatsapp(phoneWithCode, smsContent);
        }
    });
};

exports.sendSmsForOTPVerificationAndLogin = function (phoneWithCode, smsID, extraParam) {
    SmsDetail.findOne({ smsUniqueId: smsID }, function (err, sms_data) {
        let smsContent = sms_data.smsContent;
        smsContent = smsContent.replace("XXXXXX", extraParam);

        if(sms_data.isSendSMS){
            utils.sendSMS(phoneWithCode, smsContent);
        }
        if(sms_data.isSendWhatsapp){
            utils.sendWhatsapp(phoneWithCode, smsContent);
        }
    });
};

exports.sendOtherSMS = function (phoneWithCode, smsID) {
    SmsDetail.findOne({ smsUniqueId: smsID }, function (err, sms_data) {
        if(sms_data.isSendSMS){
            utils.sendSMS(phoneWithCode, sms_data.smsContent);
        }
        if(sms_data.isSendWhatsapp){
            utils.sendWhatsapp(phoneWithCode, sms_data.smsContent);
        }
    });
};

///////////////// SEND SMS TO EMERGENCY  CONTACT///////
exports.sendSmsToEmergencyContact = function (phoneWithCode, smsID, extraParam, url, location) {
    SmsDetail.findOne({ smsUniqueId: smsID }, function (err, sms_data) {
        let smsContent = sms_data.smsContent;
        if (smsID == 8) {
            smsContent = smsContent.replace("%USERNAME%", extraParam);
            smsContent = smsContent + " " + url;
        }

        if(sms_data.isSendSMS){
            utils.sendSMS(phoneWithCode, smsContent);
        }
        if(sms_data.isSendWhatsapp){
            utils.sendWhatsapp(phoneWithCode, smsContent);
            utils.sendWhatsapp(phoneWithCode, url, {type: "LOCATION",  location: location, url: url});
        }
    });
};


/////////////////////////////////////////////////////

exports.mail_notification = function (to, sub, text, html) {

    try {
        html = html.replace(/&lt;/g, "<");
        html = html.replace(/&gt;/g, ">");
        html = html.replace(/&#34;/g, '"');

        Settings.findOne({}, function (err, setting) {

            let email = setting.email;
            let password = setting.password;
            let smtp_configuration = {}
            let secure = false;

            if (setting.domain == 'gmail') {
                smtp_configuration = {
                    service: 'gmail',
                    auth: {
                        user: email, // Your email id
                        pass: password // Your password
                    }
                }
            } else {
                secure = setting.smtp_port == 465;
                smtp_configuration = {
                    host: setting.smtp_host,
                    port: setting.smtp_port,
                    secure: secure,
                    auth: {
                        user: email,
                        pass: password
                    }
                }
            }
            let transporter = nodemailer.createTransport({...smtp_configuration, secure});
            let mailOptions = {
                from: email,
                to: to,
                subject: sub,
                text: text,
                html: html
            }

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log(info.response);
                }
            });
        });

    } catch (error) {
        console.error(error);
    }
};

////////////// TOKEN GENERATE ////////
exports.tokenGenerator = function (length) {
    if (typeof length == "undefined")
        length = 32;
    let token = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++){
        const randomIndex = crypto.randomInt(0, possible.length);
        token += possible.charAt(randomIndex);
    }
    return token;

};

////////FOR Distance
exports.getDistanceFromTwoLocation = function (fromLocation, toLocation) {

    let lat1 = fromLocation[0];
    let lat2 = toLocation[0];
    let lon1 = fromLocation[1];
    let lon2 = toLocation[1];

    ///////  TOTAL DISTANCE ////

    let R = 6371; // km (change this constant to get miles)
    let dLat = (lat2 - lat1) * Math.PI / 180;
    let dLon = (lon2 - lon1) * Math.PI / 180;
    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

///////////// FOR IOS CERTIFICATE //////

exports.getIosCertiFolderName = function (id) {
    if(id == 1){
        return 'ios_push/'
    }
};

exports.saveIosCertiFolderPath = function (id) {
    return './app/' + utils.getIosCertiFolderName(id);
};

exports.saveIosCertiFromBrowser = function (local_image_path, image_name, id) {
    let file_new_path = utils.saveIosCertiFolderPath(id) + image_name;
    // start 31 march 
    fs.readFile(local_image_path, function (err, data) {
        fs.writeFile(file_new_path, data, 'binary', function (err) {
            if (err) {
                console.log(err)
            } else {
                fs.unlink(local_image_path, function (error) {
                    if (error) {
                        console.log(error);
                    }
                });
            }
        });
    });
};
/////////////////////////////////

exports.getImageFolderName = function (id) {
    switch (id) {
        case 1: // user
            return 'user_profile/';
        case 2: // provider
            return 'provider_profile/';
        case 3: // provider
            return 'provider_document/';
        case 4: // provider
            return 'service_type_images/';
        case 5: // provider
            return 'service_type_map_pin_images/';
        case 6: //  web_images
            return 'web_images/';
        case 7: // partner
            return 'partner_profile/';
        case 8: // partner
            return 'partner_document/';
        case 9: // partner
            return 'user_document/';
        case 10: // language
            return 'language/';
        case 11: //user_panel_images
            return 'user_panel_images/'
        case 12: //rent_vehicle_images
            return 'rent_vehicle_images/'
        default:
            break;
    }
};

exports.getImageFolderPath = function (req, id) {
    //// return req.protocol + '://' + req.get('host') + utils.getImageFolderName(id);
    return utils.getImageFolderName(id);
};

exports.saveImageFolderPath = async function (id) {
    const setting_detail = await Settings.findOne({});


    if (setting_detail.is_use_aws_bucket) {
        return utils.getImageFolderName(id);
    } else {
        return './data/' + utils.getImageFolderName(id);
    }
};

exports.saveImageFromBrowser = async function (local_image_path, image_name, id) {
    const setting_detail = await Settings.findOne({});

    let file_new_path = await utils.saveImageFolderPath(id) + image_name;

    if (setting_detail.is_use_aws_bucket) {
        AWS.config.update({ accessKeyId: setting_detail.access_key_id, secretAccessKey: setting_detail.secret_key_id });
        fs.readFile(local_image_path, function (err, data) {
            let s3 = new AWS.S3();
            let base64data = Buffer.from(data, 'binary');
            s3.putObject({
                Bucket: setting_detail.aws_bucket_name,
                Key: file_new_path,
                Body: base64data,
                ACL: 'public-read'
            }, function () {
            });
        });
    } else {
        fs.readFile(local_image_path, function (err, data) {
            fs.writeFile(file_new_path, data, 'binary', function (err) {
                if (err) {
                    console.log(err)
                }
            });
        });
    }
};


exports.saveImageAndGetURL = async function (imageID, req, res, id) {
    const setting_detail = await Settings.findOne({});
    let pictureData = req.body.pictureData;
    function decodeBase64Image(dataString) {
        res.pictureData = Buffer.from(pictureData, 'base64');
        return res;
    }
    let urlSavePicture = utils.saveImageFolderPath(id);
    urlSavePicture = urlSavePicture + imageID + '.jpg';
    let imageBuffer = decodeBase64Image(pictureData);

    if (setting_detail.is_use_aws_bucket) {

        AWS.config.update({ accessKeyId: setting_detail.access_key_id, secretAccessKey: setting_detail.secret_key_id });

        let s3 = new AWS.S3();
        s3.putObject({
            Bucket: setting_detail.aws_bucket_name,
            Key: urlSavePicture,
            Body: imageBuffer.pictureData,
            ACL: 'public-read'
        }, function () {
        });

    } else {
        pictureData = pictureData.replace(/^data:image\/png;base64,/, "");
        fs.writeFile(urlSavePicture, pictureData, 'base64', function () {
        });
    }

};

exports.deleteImageFromFolder = async function (old_img_path, id) {
    const setting_detail = await Settings.findOne({});

    if (old_img_path != "" || old_img_path != null) {
        let old_file_name = old_img_path.split('/');

        let fs = require('fs');
        let old_file_path = await utils.saveImageFolderPath(id) + old_file_name[1];

        if (setting_detail.is_use_aws_bucket) {
            AWS.config.update({ accessKeyId: setting_detail.access_key_id, secretAccessKey: setting_detail.secret_key_id });
            let s3 = new AWS.S3();
            s3.deleteObject({
                Bucket: setting_detail.aws_bucket_name,
                Key: old_file_path
            }, function () { })
        } else {
            fs.unlink(old_file_path, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('successfully remove image');
                }
            });
        }
    }

};

// OTHER
exports.getTimeDifferenceInSecond = function (endDate, startDate) {

    let difference = 0;
    let startDateFormat = moment(startDate, constant_json.DATE_FORMAT);
    let endDateFormat = moment(endDate, constant_json.DATE_FORMAT);
    difference = endDateFormat.diff(startDateFormat, 'seconds')
    difference = (difference.toFixed(2));

    return difference;
};

exports.getTimeDifferenceInMinute = function (endDate, startDate) {

    let difference = 0;
    let startDateFormat = moment(startDate, constant_json.DATE_FORMAT);
    let endDateFormat = moment(endDate, constant_json.DATE_FORMAT);
    difference = endDateFormat.diff(startDateFormat, 'minutes', true)
    difference = Math.ceil(difference.toFixed(2));

    return difference;
};

exports.sendMassPushNotification = function (app_type, device_type, device_token, messageCode) {
    try {
        if (device_type == constant_json.PUSH_DEVICE_TYPE_ANDROID) {
            Settings.findOne({}, function (err, setting_data) {
                let android_provider_app_gcm_key = setting_data.android_provider_app_gcm_key;
                let android_user_app_gcm_key = setting_data.android_user_app_gcm_key;

                let sender_key;
                let regTokens = device_token;

                if (app_type == constant_json.PROVIDER_UNIQUE_NUMBER) {

                    sender_key = android_provider_app_gcm_key;
                } else {
                    sender_key = android_user_app_gcm_key;
                }

                let fcm = new FCM(sender_key);

                let message = {
                    registration_ids: regTokens, // required
                    data: {
                        id: messageCode,
                    }
                };

                try {
                    fcm.send(message, function (err, messageId) {
                        if (err) {
                            console.log(err)
                        }
                    });
                } catch (error) {

                    //throw error
                    console.error(error);
                }

            });

        }

        ///////////// IOS PUSH NOTIFICATION ///////////
        if (device_type == constant_json.PUSH_DEVICE_TYPE_IOS) {
            if (device_token == "" || device_token == null) {
                console.log("IOS PUSH NOTIFICATION NOT SENT");
            } else {
                console.log("IOS PUSH NOTIFICATION");

                Settings.findOne({}, function (error, setting) {

                    let ios_certificate_mode = setting.ios_certificate_mode;
                    let ios_push_certificate_path = constant_json.PUSH_CERTIFICATE_PATH;
                    let teamId = setting.team_id;
                    let keyId = setting.key_id;
                    let bundle_id;
                    let cert_file_name = constant_json.IOS_CERT_FILE_NAME;
                    cert_file_name = path.join(ios_push_certificate_path, cert_file_name)

                    if (app_type == constant_json.PROVIDER_UNIQUE_NUMBER) {
                        bundle_id = setting.provider_bundle_id;
                    } else {
                        bundle_id = setting.user_bundle_id;
                    }

                    try {
                        let is_production = false
                        if (ios_certificate_mode == "production") {
                            is_production = true;
                        }

                        let options = {
                            token: {
                                key: cert_file_name,
                                keyId: keyId,
                                teamId: teamId
                            },
                            production: is_production
                        };

                        let apnProvider = new apn.Provider(options);
                        let note = new apn.Notification();
                        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
                        note.badge = 1;
                        note.sound = 'default';
                        note.alert = { "loc-key": messageCode, "id": messageCode };
                        note.payload = { 'messageFrom': 'Caroline' };
                        note.topic = bundle_id;
                        apnProvider.send(note, device_token).then(() => {
                        });

                    } catch (err) {
                        console.log(err);
                    }

                });

            }
        }
    } catch (err) {
        console.log(err)
    }
};

exports.sendPushNotification = async function (device_type, device_token, messageCode, extraParam, webpush_config = null, lang_code = null) {
    try {
        const setting_detail = await Settings.findOne({});
        if (device_type == "web" && webpush_config && Object.keys(webpush_config).length > 0) {
            let langLanguage = JSON.parse(fs.readFileSync(path.join(__dirname + '../../../data/language/en.json'),'utf8'))
            if(lang_code){
                langLanguage = require(`../../data/language/${lang_code}.json`)
            }
            if(langLanguage['push-code'] && langLanguage['push-code'][(messageCode).toString()]){
                const subscription = webpush_config
                const payload = {
                    notification: {
                        title: `${setting_detail.app_name} Notification`,
                        body:  langLanguage['push-code'][(messageCode).toString()],
                        icon: setting_detail.api_base_url + '/web_images/mail_title_image.png',
                    },
                };
                const options = {
                    vapidDetails: {
                        subject: 'mailto:' + setting_detail.admin_email,
                        publicKey: setting_detail.webpush_public_key,
                        privateKey: setting_detail.webpush_private_key,
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
        let message;
        let message_string = await utils.get_push_string(messageCode, lang_code);
        if(messageCode == 264 || messageCode == 265){
            message_string = message_string.replace("BOOKING_ID", extraParam.trip_id);
        }
        if(messageCode == 266 || messageCode == 267){
            message_string = message_string.replace("BOOKING_ID", extraParam.trip_id);
            message_string = message_string.replace("PICKUP_TIME", extraParam.pickup_time);
        }
        if(messageCode == 268){
            message_string = message_string.replace("BOOKING_ID", extraParam.trip_id);
            message_string = message_string.replace("END_TIME", extraParam.end_time);
        }
        const PROJECT_ID = setting_detail.firebase_projectId; 
        const accessToken = await getAccessToken();
        const fetch = require('node-fetch')
        message = {
            message: {
                token: device_token, // required
                data: {
                    id: messageCode,
                    message_string: message_string
                },
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                body: message_string
                            },
                            sound: "default"
                        }
                    }
                },
                android: {
                    priority: 'high'
                },
            },
        };

        if ((messageCode).toString() == (push_messages.PUSH_CODE_FOR_PROVIDER_LOGIN_IN_OTHER_DEVICE).toString()) {
            delete message.message.notification;
        }

        if((messageCode).toString() == (push_messages.PUSH_CODE_FOR_ADMIN_APPROVED_RENTAL_VEHICLE).toString() ||
            (messageCode).toString() == (push_messages.PUSH_CODE_FOR_ADMIN_REJECT_RENTAL_VEHICLE).toString()){
            message = {
                message: {
                    token: device_token, // required
                    data: {
                        id: messageCode,
                        message_string: message_string,
                        vehicle_id: (extraParam.vehicle_id).toString()
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    body: message_string
                                },
                                sound: "default"
                            }
                        }
                    },
                    android: {
                        priority: 'high'
                    },
                },
            };
        }

        if ((messageCode).toString() == (push_messages.PUSH_CODE_FOR_NEW_TRIP).toString() ||
            (messageCode).toString() == (push_messages.PUSH_CODE_FOR_NEW_NEAREST_TRIP).toString()) {
            message = {
                message: {
                    token: device_token,
                    android: {
                        priority: 'high'
                    },
                    data: {
                        id: messageCode,
                        extraParam: extraParam,
                        sound: 'request_sound'
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    body: message_string
                                },
                                sound: "request_sound.caf"
                            }
                        }
                    }
                }
            }
        }

        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
        if (!response.ok) {
           console.log("error")
        }

        const data = await response.json();
        console.log({"notification send" : data});
    } catch (err) {
        console.log(err)
    }
};


async function getAccessToken() {
    return new Promise( async function (resolve, reject) {
        let setting_detail = await Settings.findOne({});
        const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
        const SCOPES = [MESSAGING_SCOPE];
        const client_email = setting_detail.client_email;
        const private_key = setting_detail.private_key;
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

let PAYMENT_TYPES = [
    { id: 10, name: "Stripe" }

];

exports.PAYMENT_TYPES = function () {
    return PAYMENT_TYPES;
}
/////////////////////////////////////////

exports.getSmoothPath = function (main_path_location, response) {

    let size = main_path_location.length;
    let main_gap = 100;
    let new_result = '';

    if (size > 2) {

        if (size > main_gap) {
            let pre_point = main_path_location[0];
            let result = [];
            result.push(pre_point);
            let point = [];

            let start_index = 5;
            let end_index = size - start_index;

            for (let i = 0; i < size; i++) {
                point = main_path_location[i];

                if (i < start_index || i > end_index) {
                    result.push(point);
                } else if (utils.getDistanceFromTwoLocation(point, pre_point) > 0.01) {
                    pre_point = main_path_location[i];
                    result.push(point);
                }
            }

            size = result.length;

            let gap = (size / main_gap);
            let gap2 = Math.ceil(gap);
            let gap1 = Math.floor(gap);
            let x = (gap - gap1) * main_gap;
            let k = 0;

            for (let i = 0; i < size;) {

                new_result = new_result + result[i][0] + "," + result[i][1] + "|";
                if (k <= x) {
                    // console.log(k + " " + gap2)
                    i = i + gap2;
                } else {
                    // console.log(k + " " + gap1)
                    i = i + gap1;
                }
                k++;
            }
            new_result = new_result.substring(0, new_result.length - 1);
            response(new_result);

            // return new_result
        } else if (size > 2) {
            for (let i = 0; i < size; i++) {
                new_result = new_result + main_path_location[i][0] + "," + main_path_location[i][1] + "|";
            }
            new_result = new_result.substring(0, new_result.length - 1);
            response(new_result);
        } else {
            response(new_result);
        }

    } else {
        response('');
    }
};

exports.bendAndSnap = function (points_in_string, location_length, bendAndSnapresponse) {


    let request = require('request');
    let base_url = "https://roads.googleapis.com/v1/snapToRoads?";

    if (points_in_string !== '' && location_length > 2) {
        Settings.findOne({}, function (err, setting_detail) {
            let google_key = setting_detail.road_api_google_key;
            if (google_key !== '' && google_key !== null && google_key !== undefined) {

                let path_cord = "path=" + points_in_string;
                let url = base_url + path_cord + "&interpolate=true&key=" + google_key;

                request(url, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        utils.processSnapToRoadResponse(body, function (finalRoadCoordinates) {

                            let cord_size = finalRoadCoordinates.length;
                            let temp_array = [];
                            let distance = 0;
                            let d = 0;
                            for (let i = 0; i < cord_size; i++) {
                                if (i != 0) {
                                    d = utils.getDistanceFromTwoLocation(finalRoadCoordinates[i - 1], finalRoadCoordinates[i]);
                                }
                                distance = +distance + +d;
                                temp_array.push(finalRoadCoordinates[i]);
                                if (i == cord_size - 1) {
                                    bendAndSnapresponse({ temp_array: temp_array, distance: distance })

                                }
                            }
                        });
                    } else {
                        bendAndSnapresponse(null)
                    }
                });
            } else {
                bendAndSnapresponse(null)
            }
        })
    } else {
        bendAndSnapresponse(null)
    }
};

exports.processSnapToRoadResponse = function (data, SnapRoadResponse) {
    let finalRoadCoordinates = [];
    let snappedPoints = [];
    try {
        snappedPoints = (JSON.parse(data)).snappedPoints;
        let size = snappedPoints.length;
        for (let i = 0; i < size; i++) {

            finalRoadCoordinates.push([snappedPoints[i].location.latitude, snappedPoints[i].location.longitude]);

            if (i == size - 1) {
                SnapRoadResponse(finalRoadCoordinates)
            }
        }
    } catch (exception) {
        snappedPoints = [];
        SnapRoadResponse(snappedPoints)
    }

};


exports.precisionRoundTwo = function (number) {
    return utils.precisionRound(number, 2);
};

exports.precisionRound = function (number, precision) {
    let factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
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
exports.add_redeem_point_history = (user_type,user_unique_id,user_id,country_id,redeem_point_type,redeem_point_currency,redeem_point_description,added_redeem_point,previous_total_redeem_point,wallet_status) => {
    let total_redeem_point
    if(wallet_status == 1) {
        total_redeem_point = previous_total_redeem_point + added_redeem_point
    } else {
        total_redeem_point = previous_total_redeem_point - added_redeem_point
    }
    let redeem_point_history_data = new Redeem_point_history({
        user_type: user_type,
        user_unique_id: user_unique_id,
        user_id: user_id,
        country_id: country_id,
        redeem_point_type: redeem_point_type,
        redeem_point_currency: redeem_point_currency,
        redeem_point_description: redeem_point_description,
        added_redeem_point: added_redeem_point,
        total_redeem_point: total_redeem_point,
        wallet_status: wallet_status
    });
    redeem_point_history_data.save();
    return total_redeem_point;
}



exports.get_date_in_city_timezone = function (date, timezone) {
    let convert_date = new Date(date);
    let zone_time_diff = moment_timezone.tz.zone(timezone).utcOffset(moment_timezone.utc());

    convert_date.setMinutes(convert_date.getMinutes() + zone_time_diff);
    convert_date = new Date(convert_date);
    return convert_date;
};

exports.get_date_now_at_city = function (date, timezone) { // use when you convert date now to city timezone
    let convert_date = new Date(date);
    let zone_time_diff = moment_timezone.tz.zone(timezone).utcOffset(moment_timezone.utc());
    zone_time_diff = -1 * zone_time_diff;
    convert_date.setMinutes(convert_date.getMinutes() + zone_time_diff);
    convert_date = new Date(convert_date);
    return convert_date;
};

exports.get_date_filter = async (start_date, end_date, timezone = null) => {

    return new Promise(async (resolve, reject) => {
        const setting_detail = await Settings.findOne({});

        if(!timezone){
            timezone = setting_detail.timezone_for_display_date;
        }
    
        // start_date
        start_date = new Date(start_date);
        start_date = exports.get_date_in_city_timezone(start_date, timezone);
        start_date = moment_timezone(moment_timezone(start_date).startOf('day')).format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
        start_date = new Date(start_date);

        // end_date
        end_date = new Date(end_date);
        end_date = exports.get_date_in_city_timezone(end_date,timezone);
        end_date = moment_timezone(moment_timezone(end_date).endOf('day')).format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
        end_date = new Date(end_date);

        resolve({
            new_start_date: start_date,
            new_end_date: end_date
        })
    })
}




exports.set_google_road_api_locations = function (tripLocation) {
    Settings.findOne({}, function (err, setting_detail) {

        let google_key = setting_detail.road_api_google_key;
        if (google_key !== '' && google_key !== null && google_key !== undefined) {

            let index = tripLocation.index_for_that_covered_path_in_google;
            let startTripToEndTripLocations = tripLocation.startTripToEndTripLocations;
            let size = startTripToEndTripLocations.length;
            let gap = 95;

            let end_index = (index + 1) * gap; // 95 , 190 , 285
            let start_index = end_index - gap - 1; // -1 , 94  , 189
            if (start_index < 0) {
                start_index = 0;
            }

            if (size >= end_index) {
                let new_result = "";

                for (; start_index < end_index; start_index++) {
                    new_result = new_result + startTripToEndTripLocations[start_index][0] + "," + startTripToEndTripLocations[start_index][1] + "|";
                }
                new_result = new_result.substring(0, new_result.length - 1);

                utils.bendAndSnap(new_result, gap, function (response) {
                    if (response) {
                        utils.save_google_path_locations(tripLocation, response, gap);
                    }
                });
            }
        }
    });
};

exports.save_google_path_locations = function (tripLocation, response, gap) {
    let index = tripLocation.index_for_that_covered_path_in_google;
    let google_start_trip_to_end_trip_locations = tripLocation.google_start_trip_to_end_trip_locations;
    google_start_trip_to_end_trip_locations = google_start_trip_to_end_trip_locations.concat(response.temp_array);
    tripLocation.google_start_trip_to_end_trip_locations = google_start_trip_to_end_trip_locations;
    tripLocation.google_total_distance = +tripLocation.google_total_distance + +response.distance;
    index++;
    tripLocation.index_for_that_covered_path_in_google = index;
    tripLocation.save(function (err) {
        if (err) {
            utils.save_google_path_locations(tripLocation, response, gap);
        } else {
            let end_index = (index + 1) * gap;
            if (tripLocation.startTripToEndTripLocations.length >= end_index) {
                utils.set_google_road_api_locations(tripLocation);
            }
        }
    });
};


exports.getCurrencyConvertRate = function (from_amount, from_currency, to_currency, return_data) {
    return return_data({ success: true, current_rate: 1 });

    //Paid API Code:
    // let request = require('request');
    // if (from_currency == to_currency) {
    //     return_data({ success: true, current_rate: 1 });
    //     return;
    // }
    // let base_url = "http://free.currencyconverterapi.com/api/v5/convert?";
    // let tag = from_currency + "_" + to_currency;
    // let url = base_url + "q=" + tag + "&compact=y&apiKey=sample-key-do-not-use";
    // request(url, function (error, response, body) {
    //     if (!error && response.statusCode == 200) {
    //         try {
    //             let json_obj = JSON.parse(body);
    //             let value = json_obj[tag]["val"];
    //             if (from_amount != 1) {
    //                 value = value * from_amount;
    //             }
    //             return_data({ success: true, current_rate: utils.precisionRound(Number(value), 4) });
    //         } catch (err) {
    //             return_data({ success: true, current_rate: 1 });
    //         }
    //     } else {
    //         return_data({ success: false });
    //     }
    // });
};

exports.insert_documets_for_new_users = function (user, document_for, country_id, response) {

    Document.find({ countryid: country_id, type: document_for }, function (err, document) {
        let is_document_uploaded = 1;
        let document_size = document.length;

        if (document_size !== 0) {
            for (let i = 0; i < document_size; i++) {
                if (document[i].option == 1 && document[i].is_visible) {
                    is_document_uploaded = 0;
                }
            }
            console.log(is_document_uploaded + '-----------------');
            document.forEach(function (entry) {
                let userdocument = new User_Document({
                    user_id: user._id,
                    document_id: entry._id,
                    name: entry.title,
                    option: entry.option,
                    document_picture: "",
                    unique_code: "",
                    expired_date: null,
                    is_unique_code: entry.is_unique_code,
                    is_expired_date: entry.is_expired_date,
                    is_uploaded: 0,
                    is_visible: entry.is_visible
                });
                userdocument.save(function (err) {
                    if (err) {
                        throw err;
                    }
                });
            });
        }
        console.log(is_document_uploaded + '+++++++++++++');
        user.is_document_uploaded = is_document_uploaded;
        user.save();
        response({ is_document_uploaded: is_document_uploaded })

    });
};

exports.insert_documets_for_new_providers = function (provider, document_for, country_id) {
    return new Promise((resolve, reject) => {
        Document.find({ countryid: country_id, type: document_for }, function (err, document) {
            let is_document_uploaded = 1;
            let document_size = document.length;
            if (document_size !== 0) {
                for (let i = 0; i < document_size; i++) {
                    if (document[i].option == 1) {
                        is_document_uploaded = 0;
                    }
                }
                document.forEach(function (entry) {
                    let providerdocument = new Provider_Document({
                        provider_id: provider._id,
                        document_id: entry._id,
                        name: entry.title,
                        option: entry.option,
                        document_picture: "",
                        unique_code: "",
                        expired_date: null,
                        is_unique_code: entry.is_unique_code,
                        is_expired_date: entry.is_expired_date,
                        is_uploaded: 0,
                        is_visible: entry.is_visible
                    });
                    providerdocument.save(function () {
                    });
                });
            }

            resolve({ is_document_uploaded: is_document_uploaded })
        });
    })
};


exports.saveImageFromBrowserStripe = function (local_image_path, image_name, id, response) {

    let file_new_path = utils.saveImageFolderPath(id) + image_name;

    fs.readFile(local_image_path, function (err, data) {
        fs.writeFile(file_new_path, data, 'binary', function (err) {
            if (err) {
                console.log(err)
            } else {
                fs.unlink(local_image_path);
                let message = 'File uploaded successfully';
                response(message);
            }
        });
    });
};

exports.encryptPassword = function (password) {
    let crypto = require('crypto');
    try {
        return crypto.createHash('md5').update(password).digest('hex');
    } catch (error) {
        console.error(error);
    }

};



exports.generatePassword = function (length) {
    try {
        if (typeof length === "undefined")
            length = 6;
        let password = "";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < length; i++){
            const randomIndex = crypto.randomInt(0, possible.length);
            password += possible.charAt(randomIndex);
        }
        return password;
    } catch (error) {
        console.error("error" + error);
    }
};


exports.generateOtp = function (length) {
    try {
        process.env.NODE_ENV = process.env.NODE_ENV || 'development';
        if (process.env.NODE_ENV == 'development') {
            return DEFAULT_VALUE.OTP;
        }
        if (typeof length === "undefined")
            length = 32;
        let otpCode = "";
        let possible = "0123456789";
        for (let i = 0; i < length; i++){
            const randomIndex = crypto.randomInt(0, possible.length);
            otpCode += possible.charAt(randomIndex);
        }
        return otpCode;
    } catch (error) {
        console.error(error);
    }
};

exports.add_transfered_history = function (type, type_id, country_id, amount, currency_code, transfer_status, transfer_id, transfered_by, error) {
    let transfer_history = new Transfer_History({
        user_type: type,
        user_id: type_id,
        country_id: country_id,
        amount: amount,
        currency_code: currency_code,
        transfer_status: transfer_status,
        transfer_id: transfer_id,
        transfered_by: transfered_by,
        error: error
    });
    transfer_history.save();
};

// #PAYMENT_MODULE_CHANGE
exports.stripe_auto_transfer = async function (amount, detail, currencycode, payment_gateway_type, return_data) {
    const setting_detail = await Settings.findOne({});


    if (!payment_gateway_type || payment_gateway_type == PAYMENT_GATEWAY.stripe) {
        // let stripe_secret_key = setting_detail.stripe_secret_key;
        // let stripe = require("stripe")(stripe_secret_key);
        // if (amount > 0) {
        //     stripe.transfers.create({
        //         amount: Math.round(amount * 100),
        //         currency: currencycode,
        //         destination: detail.account_id

        //     }, function (error, transfer) {
        //         if (error) {
        //             return_data({ success: false, error_message:error });
        //         } else {
        //             return_data({ success: true, transfer_id: transfer.id });
        //         }
        //     });
        // }



        let url = setting_detail.payments_base_url + "/create_transfer"
        let data = {
            amount: Math.round(amount * 100),
            currency: currencycode,
            destination: detail.account_id
        }

        const request = require('request');
        request.post(
            {
                url: url,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            }, (error, response, body) => {
                if (error) {
                    console.error(error);
                    return_data({ success: false, error_message:error });
                } else {
                    body = JSON.parse(body);
                    let transfer = body.transfer;

                    console.log(" *** transfer *** ");
                    console.log(transfer);
                    if (transfer) {
                        return_data({ success: true, transfer_id: transfer.id });
                    } else {
                        return_data({ success: false, error_message:error });
                    }
                }
            });
    } else if (payment_gateway_type == PAYMENT_GATEWAY.paystack) {
        const https = require('https')
        const params = JSON.stringify({
            "type": "nuban",
            "name": detail.first_name + ' ' + detail.last_name,
            "description": "Transfer",
            "account_number": detail.account_number,
            "bank_code": detail.bank_code,
            "currency": currencycode
        })
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transferrecipient',
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
                if (JSON.parse(data).status) {
                    const params = JSON.stringify({
                        "source": "balance",
                        "reason": "Transfer",
                        "amount": Math.round(amount * 100),
                        "recipient": JSON.parse(data).data.recipient_code
                    })
                    const options = {
                        hostname: 'api.paystack.co',
                        port: 443,
                        path: '/transfer',
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
                            if (JSON.parse(data).status) {
                                return_data({ success: true, transfer_id: JSON.parse(data).data.transfer_code });
                            } else {
                                return_data({ success: false, error_message:JSON.parse(data).message });
                            }
                        })
                    }).on('error', error => {
                        console.error(error)
                    })
                    req.write(params)
                    req.end()
                } else {
                    return_data({ success: false, error_message:JSON.parse(data).message });
                }
            })
        }).on('error', error => {
            console.error(error)
        })
        req.write(params)
        req.end()
    } else {
        return_data({ success: false, error_message:"PAYOUT_NOT_SUPPORT" });
    }
};
exports.wsal_status_socket = function () {
    socket_object.emit("wsal_scocket", {});
}

exports.send_socket_request = async function (trip_id, provider_id, is_schedule_started = false) {
    const setting_detail = await Settings.findOne({});

    provider_id = "'get_new_request_" + provider_id + "'";
    socket_object.to(provider_id).emit(provider_id, {
        trip_id: trip_id,
        time_left_to_responds_trip: setting_detail.provider_timeout,
        get_new_request_: trip_id,
        is_schedule_started
    });
}

exports.update_zone_queue_socket = function (zone_queue_id, is_new_added) {
    socket_object.emit("'" + zone_queue_id + "'", {
        is_new_added: is_new_added
    });
}

exports.update_request_status_socket = function (trip_id, near_destination_trip_id = null, provider_trip_status = 0, is_for_first_time = false) {
    trip_id = "'" + trip_id + "'";
    socket_object.to(trip_id).emit(trip_id, {
        is_trip_updated: true, is_for_first_time: is_for_first_time, trip_id: trip_id, near_destination_trip_id, provider_trip_status
    });
}

// socket for dispatcher corporate get request
exports.get_service_id_socket = function (service_id) {
    let services_id = service_id
    socket_object.emit(services_id, { service_id: services_id })
}

// socket for user and corprate request and split payment req
exports.req_type_id_socket = function (id) {
    let type_id = id
    socket_object.emit(type_id, { type_id: type_id })
}

exports.reject_split_request_socket = (id) => {
    let type_id = id
    socket_object.emit(type_id, { type_id: type_id })
}
// get driver created trip for user 
exports.user_get_trip = function (id) {
    let type_id = id
    socket_object.emit(type_id, { type_id: type_id, is_provider_create: true })
}

// admin decline corporate and partner then logout to panel 
exports.decline_socket_id = function (id) {
    let type_id = id
    socket_object.emit(type_id, { type_id: type_id, is_admin_decline: true })
}

// paytabs socket 
exports.paytabs_status_socket = function (id, boolean, action, msg = '') {
    setTimeout(() => {
        let type_id = "'paytabs_" + id + "'";
        socket_object.emit(type_id, { payment_status: boolean, action: action, msg: msg })
    }, 7000);
}

exports.payu_status_fail_socket = function (user_id, boolean = false) {
    setTimeout(() => {
        let event_name = "'payu_fail_payment_" + user_id + "'"
        socket_object.emit(event_name, { payment_status: boolean })
    }, 2000);
}

// open ride created trip for user 
exports.user_get_trip_for_openride = function (id) {
    let type_id = id
    socket_object.emit(type_id, { type_id: type_id, open_ride: true })
}

exports.dateWithTimeZone = function (timeZone, param_date) {
    let year = param_date.getFullYear()
    let month = param_date.getMonth()
    let day = param_date.getDate()
    let hour = param_date.getHours()
    let minute = param_date.getMinutes()
    let second = param_date.getSeconds()
    let date = new Date(Date.UTC(year, month, day, hour, minute, second));

    let utcDate = new Date(date.toLocaleString('en-US', { timeZone: "UTC" }));
    let tzDate = new Date(date.toLocaleString('en-US', { timeZone: timeZone }));
    let offset = utcDate.getTime() - tzDate.getTime();

    date.setTime(date.getTime() + offset);

    return date;
};

exports.create_firebase_user = function (user, user_type, response, is_retry = false) {
    try {
        let user_email = user.email;
        if (user_email == "" || user_email == null || is_retry) {
            user_email = exports.get_random_email()
        }
        let email = ''
        switch (user_type) {
            case Number(constant_json.USER_UNIQUE_NUMBER):
                email = 'user_' + user_email
                break;
            case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                email = 'provider_' + user_email
                break;
            case Number(constant_json.ADMIN_UNIQUE_NUMBER):
                email = 'admin_' + user_email
                break;
            default:
                email = 'default_' + user_email
                break;
        }

        email = email.toString().trim()
        fireUser.createUser({ email: email }).then(user => {
            response({ success: true, user })
        }).catch(error => {
            if (is_retry) {
                console.log(error)
                response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
            } else {
                exports.create_firebase_user(user, user_type, response, true);
            }
        })
    } catch (error) {
        console.log(error)
        response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
    }
}

exports.create_firebase_user_token = function (user, user_type, response) {
    try {
        if (user.uid) {
            fireUser.createCustomToken(user.uid).then(firebase_token => {
                response({ success: true, firebase_token })
            }).catch(error => {
                console.log(error)
                response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
            })
        } else {
            exports.create_firebase_user(user, user_type, response_data => {
                if (response_data.success) {
                    user.uid = response_data.user.uid
                    user.save().then(() => {
                        fireUser.createCustomToken(user.uid).then(firebase_token => {
                            response({ success: true, firebase_token })
                        }).catch(error => {
                            console.log(error)
                            response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
                        })
                    }).catch(error => {
                        console.log(error)
                        response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
                    })
                } else {
                    response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
                }
            })
        }
    } catch (error) {
        console.log(error)
        response({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG })
    }
}

exports.delete_firebase_user = function (uid = null) {
    try {
        if (uid) {
            fireUser.deleteUser(uid).then(() => {
                console.log('Successfully deleted user');
            }).catch(error => {
                console.log(error)
            })
        }
    } catch (error) {
        console.log(error)
    }
}

exports.get_random_email = function () {
    let chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
    let string = '';
    for (let ii = 0; ii < 15; ii++) {
        let randomIndex = crypto.randomInt(0, chars.length);
        string += chars[randomIndex];
    }
    return (string + '@domain.com');
}

exports.add_in_zone_queue_new = function (city_zone_id, provider) {
    return new Promise(async (resolve, reject) => {
        await CityZone.updateOne({ _id: city_zone_id }, { $push: { total_provider_in_zone_queue: provider._id } });
        let updated_provider = await Provider.findByIdAndUpdate(provider._id, { zone_queue_id: city_zone_id }, { new: true });
        if (updated_provider) {
            utils.update_zone_queue_socket(city_zone_id, true)
            resolve(updated_provider);
        } else {
            reject(provider);
        }
    })
}

exports.remove_from_zone_queue_new = function (provider) {
    return new Promise(async (resolve, reject) => {
        await CityZone.updateOne({ _id: provider.zone_queue_id }, { $pull: { total_provider_in_zone_queue: provider._id } });
        let updated_provider = await Provider.findByIdAndUpdate(provider._id, { zone_queue_id: null }, { new: true });
        if (updated_provider) {
            utils.update_zone_queue_socket(provider.zone_queue_id, false)
            resolve(updated_provider);
        } else {
            reject(provider);
        }
    })
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
            (payment_mode == Number(constant_json.PAYMENT_MODE_CARD) && is_provider_earning_set_in_wallet_on_other_payment) || (payment_mode == Number(constant_json.PAYMENT_MODE_APPLE_PAY) && is_provider_earning_set_in_wallet_on_other_payment)) {
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
            await Trip.updateOne({ _id: trip._id }, trip.getChanges())
        }
    }
}
exports.trip_payment_failed = async function (trip, city = null, provider = null) {
    if (!provider) {
        provider = await Provider.findOne({ _id: trip.confirmed_provider });
    }
    if (!city) {
        city = await City.findOne({ _id: trip.city_id });
    }
    if (city.is_payment_mode_cash == 1) {
        utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_PAYMENT_FAILED_CASH, "", null, provider.lang_code);
    } else {
        utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_PAYMENT_FAILED_WALLET, "", null, provider.lang_code);
    }
}
exports.get_reverse_service_fee = function (min_fare, tax_per) {
    return ((100 * min_fare) / ((tax_per * 100 * 0.01) + 100)).toFixed(2)
}

exports.remove_is_trip_from_provider = function (provider, trip_id, destinationLocation = null) {
    provider.is_trip = provider.is_trip.filter((is_trip) => String(is_trip) != String(trip_id));
    provider.is_near_trip = provider.is_near_trip.filter((is_trip) => String(is_trip) != String(trip_id));
    if (provider.is_trip.length == 0) {
        provider.is_available = 1;
        provider.is_ride_share = 0;
        provider.destinationLocation = [];
    }
    if (!provider.destinationLocation) {
        provider.destinationLocation = [];
    }
    if (destinationLocation) {
        let idx = provider.destinationLocation.findIndex(i => i == destinationLocation);
        if (idx != -1) {
            provider.destinationLocation.splice(idx, 1);
        }
        provider.markModified("destinationLocation");
    }
    return provider;
}

exports.move_trip_to_completed = async function (trip_id) {
    let deleted_trip = await Trip.findOneAndRemove({ _id: trip_id })
    if (deleted_trip) {
        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
        if (deleted_trip.split_payment_users) {
            trip_history_data.split_payment_users = deleted_trip.split_payment_users;
        }
        await trip_history_data.save()
    }
}

exports.trip_response = async function (req, trip, user, provider, res) {
    if (trip.is_tip) {      
        utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_PROVIDER_TRIP_END, "", null, provider.lang_code);
    }
    if (trip.payment_status == PAYMENT_STATUS.COMPLETED) {
        utils.move_trip_to_completed(trip._id)
    }
    
    trip.payment_status == PAYMENT_STATUS.FAILED ? utils.update_request_status_socket(trip._id, null, 0, true) : utils.update_request_status_socket(trip._id);
    
    utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", user.webpush_config, user.langCode);
    res.json({
        success: true,
        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
        payment_status: trip.payment_status
    });
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
                resolve({ success: false, error_code: error_message.ERROR_CODE_PARAMETER_MISSING, error_message: missing_param + ' parameter missing' });
            } else if (is_invalid_param) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_PARAMETER_INVALID, error_message: invalid_param + ' parameter invalid' });
            } else {
                resolve({ success: true });
            }
        } else {
            resolve({ success: true });
        }
    })
}

exports.getCurrencyConvertRateAsync = function (from_amount, from_currency, to_currency) {
    return new Promise((resolve, reject) => {
        
        return resolve({ success: true, current_rate: 1 });
        //Paid API Code:
        // let request = require('request');
        // if (from_currency == to_currency) {
        //     resolve({ success: true, current_rate: 1 });
        //     return;
        // }
        // let base_url = "http://free.currencyconverterapi.com/api/v5/convert?";
        // let tag = from_currency + "_" + to_currency;
        // let url = base_url + "q=" + tag + "&compact=y&apiKey=sample-key-do-not-use";
        // request(url, function (error, response, body) {
        //     if (!error && response.statusCode == 200) {
        //         try {
        //             let json_obj = JSON.parse(body);
        //             let value = json_obj[tag]["val"];
        //             if (from_amount != 1) {
        //                 value = value * from_amount;
        //             }
        //             resolve({ success: true, current_rate: utils.precisionRound(Number(value), 4) });
        //         } catch (err) {
        //             resolve({ success: true, current_rate: 1 });
        //         }
        //     } else {
        //         resolve({ success: false });
        //     }
        // });
    });
};

exports.check_auth_middleware = async function (type, id, token) {
    return new Promise(async (resolve, reject) => {
        let Type;
        switch (type) {
            case '1':
                Type = Admin
                break;
            case '2':
                Type = Provider
                break;
            case '3':
                Type = Partner
                break;
            case '4':
                Type = Corporate
                break;
            case '5':
                Type = Hotel
                break;
            case '6':
                Type = Dispatcher
                break;
            case '9':
                Type = Hub_User
                break;
        }
        let check_type = await Type.findOne({ _id: id, token: token })
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
        let username = ("username" in check_type) ? check_type.username : ""

        let countries = [];
        let cities = [];

        if (is_country_based_access_control_enabled) {
            countries = await Country.aggregate([{ $match: { _id: { $in: allowed_countries } } }, { $group: { _id: null, countries: { $push: "$countryname" } } }])
            if (countries.length > 0) {
                countries = countries[0].countries
            }
        }
        if (is_city_based_access_control_enabled) {
            cities = await City.aggregate([{ $match: { _id: { $in: allowed_cities } } }, { $group: { _id: null, cities: { $push: "$cityname" } } }])
            if (cities.length > 0) {
                cities = cities[0].cities
            }
        }

        resolve({
            success: true,
            username: username,
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

// added for testing, how app behave on time consuming action
exports.delay = async function (ms) {
    // sample code
    // if (provider.unique_id == 43) {
    //     await utils.delay(4000)
    // }
    // if (provider.unique_id == 44) {
    //     await utils.delay(6000)
    // }
    // if (provider.unique_id == 45) {
    //     await utils.delay(8000)
    // }
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

exports.checkNewDocumentsAdded = async function (user, type) {
    try {
        if (type == DOCUMENT_TYPE.PROVIDER) {
            let is_documents_expired = user?.is_documents_expired ? user?.is_documents_expired : false;
            let is_document_uploaded = user?.is_document_uploaded ? user?.is_document_uploaded : false;
            let provider = user;
            let country_data = await Country.findOne({ countryname: provider.country }).select({ _id: 1 });
            let { timezone } = await City.findOne({ _id: provider.cityid }).select({ timezone: 1 });
            let date = new Date().toLocaleString("en-US", { timeZone: timezone });

            // current added docs
            let provider_documents = await Provider_Document.find({ provider_id: provider._id }).select({ document_id: 1 });
            let provider_document_ids = provider_documents.map(document => document.document_id);

            // missing docs
            let documents = await Document.find({ type, countryid: country_data._id, _id: { $nin: provider_document_ids } });

            if (documents.length) {
                // if any docs is missing in Provider_Document collection
                let remaining_documents = [];
                for (const document of documents) {
                    remaining_documents.push({
                        provider_id: provider._id,
                        document_id: document._id,
                        name: document.title,
                        option: document.option,
                        document_picture: "",
                        unique_code: "",
                        expired_date: null,
                        is_unique_code: document.is_unique_code,
                        is_expired_date: document.is_expired_date,
                        is_uploaded: 0,
                        is_visible: document.is_visible
                    });
                }
                await Provider_Document.insertMany(remaining_documents);
            }

            // test if document is upload or not with admin update
            let not_uploaded_documents = await Provider_Document.count({ provider_id: provider._id, is_visible: true, option: 1, is_uploaded: 0 });
            provider.is_document_uploaded = not_uploaded_documents ? 0 : 1;

            // update expired document to true
            let condition = {
                provider_id: provider._id,
                expired_date: { $lt: date },
                is_document_expired: false,
                is_uploaded: 1,
                is_expired_date: true
            };
            let update = { is_document_expired: true };
            await Provider_Document.updateMany(condition, update);

            // update provider expired document param
            let expired_documents = await Provider_Document.count({
                provider_id: provider._id,
                is_document_expired: true,
                is_expired_date: true,
                is_uploaded: 1,
                is_visible: true,
                option: 1,
            });
            provider.is_documents_expired = expired_documents ? true : false;

            if (is_documents_expired != provider.is_documents_expired && is_document_uploaded != provider.is_document_uploaded) {
                await Provider.updateOne(
                    { _id: provider._id },
                    {
                        is_documents_expired: provider.is_documents_expired,
                        is_document_uploaded: provider.is_document_uploaded
                    }
                );
            } else if (is_documents_expired != provider.is_documents_expired) {
                await Provider.updateOne(
                    { _id: provider._id },
                    {
                        is_documents_expired: provider.is_documents_expired,
                    }
                );
            } else if (is_document_uploaded != provider.is_document_uploaded) {
                await Provider.updateOne(
                    { _id: provider._id },
                    {
                        is_document_uploaded: provider.is_document_uploaded
                    }
                );
            }

            return provider;
        } else if (type == DOCUMENT_TYPE.USER) {
            // Add New Document in User
        } else if (type == DOCUMENT_TYPE.VEHICLE) {
            if (user.provider_type_id) {
                return user;
            }
            let provider = user;
            let old_vehicle_detail = await Vehicle.find({ provider_id: user._id })

            let country_data = await Country.findOne({ countryname: provider.country }).select({ _id: 1 });
            let { timezone } = await City.findOne({ _id: provider.cityid }).select({ timezone: 1 });
            let date = new Date().toLocaleString("en-US", { timeZone: timezone });

            for await (const vehicle_detail of old_vehicle_detail) {
                // current added docs
                let provider_vehicle_documents = await Provider_Vehicle_Document
                    .find({ provider_id: provider._id, vehicle_id: vehicle_detail._id })
                    .select({ document_id: 1 });
                let provider_vehicle_document_ids = provider_vehicle_documents.map(document => document.document_id);

                // missing docs
                let documents = await Document.find({ type, countryid: country_data._id, _id: { $nin: provider_vehicle_document_ids } });

                if (documents.length) {
                    // if any docs is missing in Provider_Document collection
                    let remaining_documents = [];
                    for (const document of documents) {
                        remaining_documents.push({
                            vehicle_id: vehicle_detail._id,
                            provider_id: provider._id,
                            document_id: document._id,
                            name: document.title,
                            option: document.option,
                            document_picture: "",
                            unique_code: document.unique_code,
                            expired_date: "",
                            is_unique_code: document.is_unique_code,
                            is_expired_date: document.is_expired_date,
                            is_document_expired: false,
                            is_uploaded: 0,
                            is_visible: document.is_visible
                        });
                    }
                    await Provider_Vehicle_Document.insertMany(remaining_documents);
                }

                // test if document is upload or not with admin update
                let not_uploaded_documents = await Provider_Vehicle_Document.count({
                    provider_id: provider._id,
                    vehicle_id: vehicle_detail._id,
                    is_visible: true,
                    option: 1,
                    is_uploaded: 0
                });
                vehicle_detail.is_document_uploaded = not_uploaded_documents ? false : true;

                // update expired document to true
                let condition = {
                    provider_id: provider._id,
                    vehicle_id: vehicle_detail._id,
                    expired_date: { $lt: date },
                    is_document_expired: false,
                    is_uploaded: 1,
                    is_expired_date: true
                };
                let update = { is_document_expired: true };
                await Provider_Vehicle_Document.updateMany(condition, update);

                // update provider expired document param
                let expired_documents = await Provider_Vehicle_Document.count({
                    provider_id: provider._id,
                    vehicle_id: vehicle_detail._id,
                    is_document_expired: true,
                    is_expired_date: true,
                    is_uploaded: 1,
                    is_visible: true,
                    option: 1,
                });
                vehicle_detail.is_documents_expired = expired_documents ? true : false;
                await vehicle_detail.save();
                if (vehicle_detail.is_selected) {
                    provider.is_vehicle_document_uploaded = vehicle_detail.is_document_uploaded;
                    await Provider.updateOne({ _id: provider._id }, { is_vehicle_document_uploaded: provider.is_vehicle_document_uploaded })
                }
            }
            return provider;
        }
    } catch (e) {
        console.log(e);
        return user;
    }
}

exports.socket_call_by_payment = async (req, res) => {
    let trip_id = req.body.trip_id
    let near_destination_trip_id = req.body.near_destination_trip_id
    if (trip_id.charAt(0) === "'" && trip_id.charAt(trip_id.length - 1) === "'") {
        trip_id = trip_id.slice(1, -1);
    }
    exports.update_request_status_socket(trip_id, near_destination_trip_id)
}

exports.socket_call_for_add_card_paytab = async (req, res) => {
    let type_id = req.body.id
    if (req.body.msg !== undefined) {
        utils.paytabs_status_socket(type_id, false, 2, req.body.msg)
    } else {
        utils.paytabs_status_socket(type_id, true, 2)
    }
}

exports.socket_call_for_export_history = async (req, res) => {
    let url = req.body.url
    socket_object.emit('export_history_socket', { download_url: url, type: req.body.type })
}

exports.socket_call_for_fail_payment = async (req, res) => {
    let user_id = req.body.user_id
    utils.payu_status_fail_socket(user_id)
}

exports.apple_pay_socket = async (user_id) => {
    user_id = "'applepay_" + user_id + "'";
    socket_object.emit(user_id, { success: true });
}

exports.get_country_city_condition = function (types, headers) {
    return new Promise((resolve, reject) => {

        let country_city_condition = {}
        let country_param = null
        let city_param = null
        let is_check_absolute_name = false

        if (!Array.isArray(types)) {
            types = [types]
        }
        types.forEach((type) => {
            is_check_absolute_name = false
            country_param = null
            city_param = null
            switch (type) {
                case COLLECTION.PROVIDER:
                    country_param = "country_id"
                    city_param = "cityid"
                    break;
                case COLLECTION.PARTNER:
                case COLLECTION.TRIP:
                case COLLECTION.ADMIN_NOTIFICATION:
                case COLLECTION.HUB:
                    country_param = "country_id"
                    city_param = "city_id"
                    break;
                case COLLECTION.CORPORATE:
                    country_param = "country_id"
                    break;
                case COLLECTION.HOTEL:
                    country_param = "country"
                    city_param = "city"
                    is_check_absolute_name = true
                    break;
                case COLLECTION.DISPATCHER:
                case COLLECTION.USER:
                    country_param = "country"
                    is_check_absolute_name = true
                    break;
                case COLLECTION.COUNTRY:
                    country_param = "_id"
                    break;
                case COLLECTION.CITY:
                    country_param = "countryid"
                    city_param = "_id"
                    break;
                case COLLECTION.CITY_TYPE:
                case COLLECTION.PROMO:
                    country_param = "countryid"
                    city_param = "cityid"
                    break;
                case COLLECTION.DOCUMENT:
                    country_param = "countryid"
                    break;
                case COLLECTION.VEHICLE:
                    country_param = "country_id"
                    break;
                default:
                    break;
            }
            country_city_condition[type] = {}
            if (headers.is_country_based_access_control_enabled && country_param) {
                country_city_condition[type][country_param] = { $in: is_check_absolute_name ? headers.countries : headers.allowed_countries };
            }
            if (headers.is_city_based_access_control_enabled && city_param) {
                country_city_condition[type][city_param] = { $in: is_check_absolute_name ? headers.cities : headers.allowed_cities };
            }
        });


        if (types.length == 1) {
            country_city_condition = country_city_condition[types[0]]
        }
        resolve(country_city_condition);
    })
}

exports.getModifiedFields = function (oldSettings, newSettings, ignoreFields = []) {
    const modifiedFields = [];

    oldSettings = JSON.parse(JSON.stringify(oldSettings));
    newSettings = JSON.parse(JSON.stringify(newSettings));

    const compareArrays = function (arr1, arr2, parentKey) {
        const maxLength = Math.max(arr1.length, arr2.length);

        for (let i = 0; i < maxLength; i++) {
            const oldVal = arr1[i];
            const newVal = arr2[i];
            const fieldKey = `${parentKey}[${i}]`;

            if (typeof oldVal === 'object' && typeof newVal === 'object') {
                modifiedFields.push(...utils.getModifiedFields(oldVal, newVal, ignoreFields, fieldKey));
            } else if (oldVal !== newVal && !ignoreFields.includes(fieldKey)) {
                modifiedFields.push({
                    field: fieldKey,
                    oldValue: oldVal,
                    newValue: newVal
                });
            }
        }
    };

    const compareObjects = function (obj1, obj2, parentKey = '') {
        for (const key in obj2) {
            if (Object.prototype.hasOwnProperty.call(obj2, key)) {
                const oldVal = obj1[key];
                const newVal = obj2[key];
                const fieldKey = parentKey ? `${parentKey}.${key}` : key;
    
                if (Array.isArray(oldVal) && Array.isArray(newVal)) {
                    compareArrays(oldVal, newVal, fieldKey);
                } else if (typeof oldVal === 'object' && typeof newVal === 'object') {
                    compareObjects(oldVal, newVal, fieldKey);
                } else if (oldVal !== newVal && !ignoreFields.includes(fieldKey)) {
                    modifiedFields.push({
                        field: fieldKey,
                        oldValue: oldVal,
                        newValue: newVal
                    });
                }
            }
        }
    };
    

    compareObjects(oldSettings, newSettings);

    return modifiedFields;
};

let Change_log = require('mongoose').model("change_log")
exports.addChangeLog = async function (setting_type, headers, changes, info = "", info_detail = "", meta_data = {}) {
    console.log({ "🚀 ~ file: utils.js:2202 ~ setting_type:": setting_type })
    let admin = await Admin.findById(headers.admin_id)
    let log_type;
    switch (info_detail) {
        case "ADDED":
            log_type = UPDATE_LOG_OPERATION.ADDED;
            break;
        case "UPDATED":
            log_type = UPDATE_LOG_OPERATION.UPDATED;
            break;
        case "DELETED":
            log_type = UPDATE_LOG_OPERATION.DELETED;
            break;
        default:
            log_type = UPDATE_LOG_OPERATION.UPDATED;
            break;
    }

    let change_log = new Change_log({
        setting_type: setting_type,
        log_type: log_type,
        user_id: headers.admin_id,
        username: admin.username,
        email: admin.email,
        changes: changes,
        info: info,
        info_detail: info_detail,
        ip: headers['x-real-ip'],
        meta_data: meta_data
    })
    change_log.save();
};

let Admin_notification = require('mongoose').model("admin_notification")
exports.addNotification = async function (notification) {
    try {
        let admin_notification = new Admin_notification({
            type: notification.type,
            user_id: notification.user_id,
            username: notification.username,
            picture: notification.picture,
            city_id: notification.city_id || null,
            country_id: notification.country_id || null,
            user_unique_id: notification.user_unique_id,
            is_read: false
        })
        await admin_notification.save();

        let new_notifications = await Admin_notification.count({ is_read: false })
        socket_object.to("admin_panel").emit("new_admin_notification", {
            new_notifications: new_notifications
        });
    } catch (error) {
        return console.log(error)
    }
};


exports.generate_admin_profit = async function (trip, user) {
    try {

        if (trip.trip_type != constant_json.TRIP_TYPE_CORPORATE && trip.trip_type != constant_json.TRIP_TYPE_HOTEL) {
            return;
        }
        let user_type
        let country_id
        let table_data
        switch (Number(trip.trip_type)) {
            case Number(constant_json.TRIP_TYPE_CORPORATE): // user
                user_type = constant_json.USER_TYPE_CORPORATE
                table_data = await Corporate.findOne({ _id: trip.user_type_id }).
                    select({
                        admin_profit_type: 1,
                        admin_profit_value: 1,
                        country_id: 1
                    }).lean()
                country_id = table_data.country_id
                break;
            case Number(constant_json.TRIP_TYPE_HOTEL): // provider
                user_type = constant_json.USER_TYPE_HOTEL
                table_data = await Hotel.findOne({ _id: trip.user_type_id }).
                    select({
                        admin_profit_type: 1,
                        admin_profit_value: 1,
                        countryid: 1
                    }).lean()
                country_id = table_data.countryid
                break;
            default:
                break;
        }



        let profit = 0;
        const profit_type = table_data.admin_profit_type
        const profit_value = table_data.admin_profit_value
        if (profit_type == PROFIT_TYPE.ABSOLUTE) {
            profit = profit_value;
        } else if (profit_type == PROFIT_TYPE.PERCENTAGE) {
            profit = (profit_value / 100) * trip.total;
        } else {
            return;
        }

        let admin_profit = new Admin_Profit({
            user_type_id: user.user_type_id,
            user_type: user_type,
            profit_type: profit_type,
            profit_value: profit_value,
            profit: profit,
            trip_id: trip._id,
            trip_unique_id: trip.unique_id,
            country_id: country_id
        })
        await admin_profit.save()
    } catch (e) {
        console.log(e)
    }
}

exports.getTripBookingTypes = async function (trip) {
    return new Promise(async (resolve, rejects) => {
        let booking_type = JSON.parse(JSON.stringify(trip.booking_type))
        booking_type = booking_type.filter(function (type) { return type == TRIP_TYPE.RIDE_NOW || type == TRIP_TYPE.SCHEDULED});

        if (booking_type.length == 0) {
            booking_type.push(trip.is_schedule_trip ? TRIP_TYPE.SCHEDULED : TRIP_TYPE.RIDE_NOW)
        }
        switch (trip.trip_type.toString()) {
            case constant_json.TRIP_TYPE_CITY:
                booking_type.push(TRIP_TYPE.CITY_TO_CITY)
                break;
            case constant_json.TRIP_TYPE_AIRPORT:
                booking_type.push(TRIP_TYPE.AIRPORT)
                break;
            case constant_json.TRIP_TYPE_ZONE:
                booking_type.push(TRIP_TYPE.ZONE)
                break;
            case constant_json.TRIP_TYPE_GUEST_TOKEN:
                booking_type.push(TRIP_TYPE.GUEST)
                break;
            default:
                break;
        }

        if (trip.car_rental_id) {
            booking_type.push(TRIP_TYPE.RENTAL)
        }

        if (trip.is_trip_bidding) {
            booking_type.push(TRIP_TYPE.BIDDING)
        }

        if (trip.is_ride_share) {
            booking_type.push(TRIP_TYPE.RIDE_SHARE)
        }

        if (trip.is_fixed_fare && !trip.is_trip_bidding) {
            booking_type.push(TRIP_TYPE.FIXED)
        }

        // booking_type.push(111)
        resolve(booking_type);
    })
}

exports.addTripStatusTimeline = async function (trip, status, user_type, user_name = null, user_id = null, openride_username = null, openride_user_id = null) {
    return new Promise(async (resolve, rejects) => {
        let trip_status = trip.trip_status

        user_type = (user_type == 0) ? 1 : user_type

        // Always pass username and userid for open ride
        let username = user_name || "";
        let userid = user_id || null;
        switch (Number(user_type)) {
            case TYPE_VALUE.USER:
                if (!trip.openride) {
                    username = trip.user_first_name + " " + trip.user_last_name
                    userid = trip.user_id
                }
                break

            case TYPE_VALUE.PROVIDER:
                let provider = await Provider.findOne({ _id: trip.provider_id }, { first_name: 1, last_name: 1 })
                username = provider?.first_name + " " + provider?.last_name;
                userid = provider?._id;
                break;

            case TYPE_VALUE.DISPATCHER:
                let dispatcher = await Dispatcher.findOne({ _id: trip.user_type_id }, { first_name: 1, last_name: 1 })
                username = dispatcher.first_name + " " + dispatcher.last_name;
                userid = dispatcher._id;
                break;

            case TYPE_VALUE.CORPORATE:
                let corporate = await Corporate.findOne({ _id: trip.user_type_id }, { name: 1 })
                username = corporate.name;
                userid = corporate._id;
                break;

            case TYPE_VALUE.HOTEL:
                let hotel = await Hotel.findOne({ _id: trip.provider_id }, { hotel_name: 1 })
                username = hotel.hotel_name;
                userid = hotel._id;
                break;

            default:
                break;
        }

        const newStatus = {
            status: status,
            timestamp: new Date(),
            user_type: user_type,
            username: username,
            user_id: userid
        };

        // Set trip status
        if(!trip.openride) {
            let index = trip_status.findIndex((x) => x.status == status);
            if (index == -1) {
                trip_status.push(newStatus);
            } else {
                trip_status[index].timestamp = new Date();
            }
        } else {
            if(openride_username || openride_user_id) {
                newStatus.openride_username = openride_username;
                newStatus.openride_user_id = openride_user_id;
                trip_status.push(newStatus);
            } else {
                trip_status.push(newStatus);
            }
        }

        resolve(trip_status);
    })
}

let Vehicle = require('mongoose').model('Vehicle');
let Vehicle_History = require('mongoose').model('Vehicle_History');
exports.addVehicle = async function (vehicle_detail, headers = null) {
    console.log(vehicle_detail);
    return new Promise(async (resolve, rejects) => {
        let vehicle = new Vehicle(vehicle_detail)
        await vehicle.save()
        if (headers) {
            let admin = await Admin.findById(headers.admin_id)
            let vehicle_detail = await Vehicle.findById(vehicle._id)

            let log = [{
                type: VEHICLE_HISTORY_TYPE.ADDED,
                by: TYPE_VALUE.ADMIN,
                user_id: headers.admin_id,
                username: admin.username,
                email: admin.email,
                at: Date.now()
            }]

            let vehicle_history = await new Vehicle_History({
                vehicle_id: vehicle_detail._id,
                vehicle_unique_id: vehicle_detail.unique_id,
                logs: log
            })
            vehicle_history.save();

        }

        resolve(vehicle);
    })
}

exports.add_vehicle_history = async function (vehicle, type, meta_data, headers = null, user_type = TYPE_VALUE.ADMIN) {
    let vehicle_history = await Vehicle_History.findOne({ vehicle_id: vehicle._id })
    let user_id = null;
    let username = null;
    let email = null;

    if (headers) {
        let admin = await Admin.findById(headers.admin_id)
        if (admin) {
            user_id = headers.admin_id;
            username = admin.username;
            email = admin.email;
        }
    } else {
        user_id = meta_data.user_id;
        username = meta_data.name;
        email = meta_data.email;
    }

    let log = {
        type: type,
        by: user_type,
        user_id: user_id,
        username: username,
        email: email,
        meta_data: meta_data,
        at: Date.now()
    }

    if (!vehicle_history) {
        vehicle_history = new Vehicle_History({
            vehicle_id: vehicle._id,
            vehicle_unique_id: vehicle.unique_id,
            logs: [log]
        })
        vehicle_history.save();
    } else {
        vehicle_history.logs.push(log);
        vehicle_history.save();
    }
}

exports.invoice_pdf_mail_notification = async function (to, sub, trip_id, pdfBuffer, res) {

    try {

        await Settings.findOne({}, async function (err, setting) {

            let email = setting.email;
            let password = setting.password;
            let smtp_configuration = {}
            let secure = false;

            if (setting.domain == 'gmail') {
                smtp_configuration = {
                    service: 'gmail',
                    auth: {
                        user: email,
                        pass: password
                    }
                }
            } else {
                secure = setting.smtp_port == 465;
                smtp_configuration = {
                    host: setting.smtp_host,
                    port: setting.smtp_port,
                    secure: secure,
                    auth: {
                        user: email,
                        pass: password
                    }
                }
            }
            let transporter = nodemailer.createTransport({...smtp_configuration, secure});
            let mailOptions = {
                from: email,
                to: to,
                subject: sub,
                attachments:
                {
                    filename: pdfBuffer.filename,
                    content: pdfBuffer.content,
                },

            }

            await transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error)
                } else {
                    console.log(info.response)
                }
            });
        });

    } catch (error) {
        console.error(error);
    }
};

exports.socket_provider_location_update = async function (trip_id, provider_Location) {
    trip_id = "'update_location_request_" + trip_id + "'";
    socket_object.emit(trip_id, {
        providerLocation: provider_Location
    });
}

exports.removeDuplicateCoordinates = async function (coordinates) {
    const uniqueCoordinates = [];
    const coordinateSet = new Set();
    for (const coordinate of coordinates) {
        const latitude = coordinate[0];
        const longitude = coordinate[1];
        const coordinateString = `${latitude},${longitude}`;
        if (!coordinateSet.has(coordinateString)) {
            uniqueCoordinates.push(coordinate);
            coordinateSet.add(coordinateString);
        }
    }
    return uniqueCoordinates;
}

exports.calculateDistanceFromCoordinates = async function (coordinates) {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const currentCoord = coordinates[i];
        const nextCoord = coordinates[i + 1];
        const distanceInKilometers = utils.getDistanceFromTwoLocation(currentCoord, nextCoord);
        totalDistance += distanceInKilometers;
    }
    return totalDistance;
}

exports.verify_captcha = async function (token, device_type) {
    return new Promise(async (resolve, reject) => {
    let setting_data = await Settings.findOne({})
        if (setting_data.is_use_captcha) {
            if (device_type === 'web') {
                //  In web we are using v3
                request
                    .post({
                        url: 'https://www.google.com/recaptcha/api/siteverify',
                        form: {
                            secret: setting_data.recaptcha_secret_key_for_web,
                            response: token
                        }
                    }, function (err, httpResponse, body) {
                        let response_data = JSON.parse(body)
                        if (response_data.success) {
                            resolve ({ success: true })
                        } else {
                            resolve({ success: false })

                        }
                    })
            } else if (device_type === "android") {
                //  In android we are using v2
                // request
                //     .post({
                //         url: 'https://www.google.com/recaptcha/api/siteverify',
                //         form: {
                //             secret: setting_data.recaptcha_secret_key_for_android,
                //             response: token
                //         }
                //     }, function (err, httpResponse, body) {
                //         let response_data = JSON.parse(body)
                //         if (response_data.success) {
                //             resolve({ success: true }) 
                //         } else {
                //             resolve({ success: false })

                //         }
                //     })
                resolve ({ success: true })
            } else if (device_type === 'ios') {
                //  In ios we are using v2
                // request
                // .post({
                //     url: 'https://www.google.com/recaptcha/api/siteverify',
                //     form: {
                //         secret: setting_data.recaptcha_secret_key_for_ios,
                //         response: token
                //     }
                // }, function (err, httpResponse, body) {
                //     let response_data = JSON.parse(body)
                //     if (response_data.success) {
                //         resolve({ success: true }) 
                //     } else {
                //         resolve({ success: false })

                //     }
                // })

                resolve ({ success: true })
            }else if (device_type === 'demo_panel') {
                resolve ({ success: true })
            }
        } else {
            resolve({ success: true }) 
        }
    })

}
exports.remove_trip_promo_code = async function (trip_detail){
    try{
        
        if(trip_detail && trip_detail.promo_id){
            await User_promo_use.findOneAndRemove({ trip_id: trip_detail._id });
            await Promo_Code.updateOne({ _id: trip_detail.promo_id }, { $inc: { user_used_promo: -1 } })
        }
        
    }catch(e){
        console.log(e)

    }
}

exports.get_provider_type_name =  function (type){

    switch (type) {
        case 0:
            return "Normal"
    
        case 1:
            return "Partner"
    
        case 2:
            return "Admin"
    
        default: 
            return "None"
    }

}

exports.get_push_string = (push_code, lang_code) => {
    if (lang_code) {
        try { 
            let message_string = require(`../../data/language/${lang_code}.json`);
            return message_string["push-code"][push_code];
        } catch (error) {
            let message_string = require(`../../data/language/en.json`);
            return message_string["push-code"][push_code];
        }
    } else {
        let message_string = require(`../../data/language/en.json`);
        return message_string["push-code"][push_code];
    }
}

exports.getPushCodeString = function (push_code_string) {
    return new Promise(async (resolve, reject) => {
        push_code_string = push_code_string.toUpperCase()
        var push_code = await push_messages["PUSH_CODE_FOR_WSAL_" + push_code_string]
        var sms_string = await WSAL_SMS_STRING[push_code_string]
        resolve({push_code, sms_string})
    })
}
exports.getAddressDataFromLatLng = async function (latitude, longitude) {
    return new Promise(async (resolve, rejects) => {
        try {
            const setting_detail = await Settings.findOne({});
            let url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + latitude + "," + longitude + "&key=" + setting_detail.admin_panel_google_key;
            let request_data = require('request');
            request_data(url, function (error, response, body) {
                if (error) {
                    return resolve({ success: false });
                }
                let parsedBody;
                try {
                    parsedBody = JSON.parse(body);
                } catch (e) {
                    return resolve({ success: false });
                }

                if (parsedBody.status === 'OK') {
                    let countryInfo = { success: true };

                    parsedBody.results[0].address_components.forEach(component => {
                        if (component.types.includes('country')) {
                            countryInfo.country_name = component.long_name;
                            countryInfo.country_code = component.short_name;
                        }
                        if (component.types.includes('locality')) {
                            countryInfo.city_name = component.long_name;
                        }
                    });

                    if (countryInfo.country_name && countryInfo.country_code) {
                        return resolve(countryInfo);
                    } else {
                        return resolve({ success: false });
                    }
                } else {
                    return resolve({ success: false });
                }
            });
        } catch (err) {
            return resolve({ success: false });
        }
    })
}

exports.driver_non_availability_for_trip = async function (trip, vehicle_id) {
    let vehicle_detail = await Car_Rent_Vehicle.findOne({ _id: vehicle_id });
    
    // Remove non-availability from vehicle
    vehicle_detail.non_availability = vehicle_detail.non_availability.filter((availability) => {
        return availability?.trip_id?.toString() !== trip?._id?.toString();
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
