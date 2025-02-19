let utils = require('./utils');
let Settings = require('mongoose').model('Settings');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Language = require('mongoose').model('language');
let admin = require('mongoose').model('admin');
let Corporate = require('mongoose').model('Corporate')
let Partner = require('mongoose').model('Partner')
const fetch = require('node-fetch');
const { google } = require('googleapis');



exports.getlanguages = function (req, res) {
    Language.find({}).then((languages) => { 
        if (languages.length == 0)
        {
            res.json({success: false, error_code: error_message.ERROR_CODE_LANGUAGES_NOT_FOUND});
        } else
        {
            res.json({success: true, message: success_messages.MESSAGE_CODE_LANGUAGES_GET_SUCCESSFULLY, languages: languages});
        }
    });
}

//// getsettingdetail /////
exports.getsettingdetail = function (req, res) {
    Settings.findOne({}).then((setting) => { 
        if (!setting) {
            res.json({success: false, error_code: error_message.ERROR_CODE_SETTING_DETAIL_NOT_FOUND});
        } else {
            res.json({
                success: true,
                userEmailVerification: setting.userEmailVerification,
                providerEmailVerification: setting.providerEmailVerification,
                userSms: setting.userSms,
                providerSms: setting.providerSms,
                admin_phone: setting.admin_phone,
                contactUsEmail: setting.contactUsEmail,
                scheduledRequestPreStartMinute: setting.scheduled_request_pre_start_minute,
                userPath: setting.userPath,
                providerPath: setting.providerPath,
                is_tip: setting.is_tip,
                android_user_app_version_code: setting.android_user_app_version_code,
                android_user_app_force_update: setting.android_user_app_force_update,
                android_provider_app_version_code: setting.android_provider_app_version_code,
                android_provider_app_force_update: setting.android_provider_app_force_update,
                ios_user_app_version_code: setting.ios_user_app_version_code,
                ios_user_app_force_update: setting.ios_user_app_force_update,
                ios_provider_app_version_code: setting.ios_provider_app_version_code,
                ios_provider_app_force_update: setting.ios_provider_app_force_update,
                is_provider_initiate_trip: false
            });
        }

    });
};

exports.generate_firebase_access_token = async function (req, res) {
    let type = Number(req.body.type);
    let Table;
    switch (type) {
        case Number(constant_json.USER_UNIQUE_NUMBER):
            Table = User;
            break;
        case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
            Table = Provider;
            break;
        case Number(constant_json.ADMIN_UNIQUE_NUMBER):
            Table = admin;
            break;
        default:
            Table = User;
            break;
    }
    let detail = await Table.findOne({ _id: req.body.user_id })
    if (detail) {
        if (detail.token != req.body.token && type != Number(constant_json.ADMIN_UNIQUE_NUMBER)) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        } else {
            utils.create_firebase_user_token(detail, type, response_data => {
                res.json(response_data)
            })
        }
    } else {
        res.json({
            success: false,
            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
        });
    }
}

exports.update_unapprove_status = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, { name: 'token', type: 'string' }], function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
    })

    try {
        let type = Number(req.body.type);
        let Table = User;
        if(type == Number(constant_json.PROVIDER_UNIQUE_NUMBER)){
            Table = Provider;
        }
        let detail = await Table.findOne({ _id: req.body.user_id })
        if (!detail) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        if (detail.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }
        detail.is_approved = 0;
        await detail.save();

        return res.json({ success: true, message: success_messages.MESSAGE_CODE_UNAPPROVED_SUCCESSFULLY });

    } catch (e) {
        return res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
    }
};

exports.new_chat_notification = async function (req, res) {
    // to check required params
    try {
        console.log(req.body);
        utils.check_request_params(req.body, [{ name: 'from_user_id', type: 'string' }, { name: 'to_user_id', type: 'string' }, { name: 'token', type: 'string' }], async function (response) {
            if (!response.success) {
                return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
            }

            let type = Number(req.body.type);
            let Table = User;
            if(type == Number(constant_json.PROVIDER_UNIQUE_NUMBER)){
                Table = Provider;
            }
            let detail = await Table.findOne({ _id: req.body.from_user_id })
            if (!detail) {
                return res.json({ success: false });
            }
            if (detail.token != req.body.token) {
                return res.json({ success: false });
            }
    
            let To_Table = Provider;
            if(type == Number(constant_json.PROVIDER_UNIQUE_NUMBER)){
                To_Table = User
            }
            
            let to_detail = await To_Table.findOne({ _id: req.body.to_user_id })
            if(to_detail){
                const setting_detail = await Settings.findOne({});
                const PROJECT_ID = setting_detail.firebase_projectId;
                const accessToken = await getAccessToken();
                const device_token = to_detail.device_token;
                const messageCode = req.body.message;
                
                const message = {
                    message: {
                        token: device_token,
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
        
                await response.json();
                console.log("notification send...");
        
                return res.json({ success: true });
            }else{
                return res.json({ success: false });
            }
        })

    } catch (e) {
        return res.json({ success: false });
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
