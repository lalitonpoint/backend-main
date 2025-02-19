let Trip_history = require('mongoose').model('Trip_history');
let utils = require('./utils');
let allemails = require('./emails');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Promo_Code = require('mongoose').model('Promo_Code');
let Citytype = require('mongoose').model('city_type');
let User_promo_use = require('mongoose').model('User_promo_use');
let Trip = require('mongoose').model('Trip');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let CityZone = require('mongoose').model('CityZone');
let ZoneValue = require('mongoose').model('ZoneValue');
let Airport = require('mongoose').model('Airport');
let AirportCity = require('mongoose').model('Airport_to_City');
let CitytoCity = require('mongoose').model('City_to_City');
let Partner = require('mongoose').model('Partner');
let geolib = require('geolib');
let Corporate = require('mongoose').model('Corporate');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let crypto = require('crypto');
let country_list = require('../../country_list.json');
const { json } = require('body-parser');
let Card = require('mongoose').model('Card');
let User_Document = require('mongoose').model('User_Document');
let Wallet_history = require('mongoose').model('Wallet_history');
let Redeem_point_history = require('mongoose').model('redeem_point_history')
let Otps = require('mongoose').model('Otps');
let Settings = require('mongoose').model('Settings')
let Admin_notification = require('mongoose').model("admin_notification")
let country_json = require('../../country_list.json')
let OpenRide = require('mongoose').model('Open_Ride');
let Reviews = require('mongoose').model('Reviews')
let MassNotification = require('mongoose').model('mass_notification')
let Banner = require('mongoose').model('banner');
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");
let Car_Rent_Brand = require('mongoose').model("Car_Rent_Brand");
let Car_Rent_Model = require('mongoose').model("Car_Rent_Model");
let Car_Rent_Type = require('mongoose').model("Car_Rent_Type");
let Car_Rent_Feature = require('mongoose').model("Car_Rent_Feature");

const {
    ERROR_CODE,
    RENT_CAR_ERROR_CODE
} = require('../utils/error_code')
const {
    CAR_RENT_MESSAGE_CODE,
} = require('../utils/success_code')
const {
    PAYMENT_GATEWAY,
    PAYMENT_STATUS,
    SPLIT_PAYMENT,
    TYPE_VALUE,
    PROVIDER_STATUS,
    ADMIN_NOTIFICATION_TYPE,
    OTP_TYPE,
    PROVIDER_TYPE,
    SMS_TEMPLATE,
} = require('./constant');

exports.update_password = async function (req, res) {
    try {
        let params_array = [{ name: 'phone', type: 'string' }, { name: 'password', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let phone = req.body.phone;
        let country_phone_code = req.body.country_phone_code;
        let password = req.body.password;
        let query = { phone: phone }
        if (country_phone_code) {
            query = { phone: phone, country_phone_code: country_phone_code };
        }
        let user = await User.findOne(query)
        if (user) {
            user.password = utils.encryptPassword(password);
            user.save();    
            const setting_detail = await Settings.findOne({}).select({ sms_notification: 1 });
            
            if (setting_detail.sms_notification) {
                utils.sendSmsForOTPVerificationAndForgotPassword( user.country_phone_code + user.phone, SMS_TEMPLATE.FORGOT_PASSWORD, password )
            }
            res.json({ success: true, message: success_messages.MESSAGE_CODE_PASSWORD_RESET_SUCCESSFULLY });
        } else {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_USER });
        }

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.get_otp = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = [{ name: 'phone', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let phone = req.body.phone;
        let country_phone_code = req.body.country_phone_code;
        let phoneWithCode = phone;

        let otpForSMS = utils.generateOtp(6);
        let user = await User.findOne({ phone: phone, country_phone_code: req.body.country_phone_code })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_USER });
        }
        if (setting_detail.userSms || setting_detail.sms_notification) {
          if (country_phone_code) {
                phoneWithCode = country_phone_code + phoneWithCode;
            } else {
                phoneWithCode = user.country_phone_code + phoneWithCode;
            }
            console.log(req.body.type);
            switch (req.body.type) {
                case OTP_TYPE.OTP_LOGIN:
                    utils.sendSmsForOTPVerificationAndLogin(phoneWithCode, SMS_TEMPLATE.OTP_VERIFICATION, otpForSMS);
                    break;
                case OTP_TYPE.FORGOT_PASSWORD:
                    utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, SMS_TEMPLATE.FORGOT_PASSWORD_OTP, otpForSMS);
                    break;
                default:
                    utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, SMS_TEMPLATE.USER_OTP_VERIFICATION, otpForSMS);
                    break;
            }
        }
        user.otp_sms = otpForSMS
        await User.findByIdAndUpdate({_id : user._id}, {otp_sms : otpForSMS}, { new: true});
        res.json({ success: true});
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.check_sms_otp = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let phone = req.body.phone;
        let country_phone_code = req.body.country_phone_code;
        let email = req.body.email;
        if (req.body.type == 2) {
            if (req.body.otp_sms && req.body.otp_mail) {
                let otp = await Otps.findOne({ email: email}).select({otp_sms : 1,otp_mail : 1}).sort( { "created_at": -1 } ).lean()
                if (otp?.otp_mail == req.body.otp_mail && req.body.otp_sms == otp?.otp_sms) {
                    await Otps.deleteOne({_id : otp._id})
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_OTP_VERIFIED_SUCCESSFULLY});
                }else if (otp?.otp_mail == req.body.otp_mail ) {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_SMS_OTP ,  smsError: true  });
                }else if (req.body?.otp_sms == otp?.otp_sms) {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_MAIL_OTP  ,emailError : true });
                }else{
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_OTP , emailError : true ,smsError : true });
                }
            }else if(req.body.otp_sms){
                let otp = await Otps.findOne({ phone: phone , country_phone_code : country_phone_code}).select({otp_sms : 1}).sort( { "created_at": -1 } ).lean()
                if (req.body.otp_sms == otp?.otp_sms) {
                    await Otps.deleteOne({_id : otp._id})
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_OTP_VERIFIED_SUCCESSFULLY });
                }
            }else if (req.body.otp_mail) {
                let otp = await Otps.findOne({ email: email ,phone: phone , country_phone_code : country_phone_code}).select({otp_mail : 1}).sort( { "created_at": -1 } ).lean()
                if (otp?.otp_mail == req.body.otp_mail) {
                    await Otps.deleteOne({_id : otp._id})
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_OTP_VERIFIED_SUCCESSFULLY});
                }else{
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_MAIL_OTP , emailError : true });
                }
            }
        } else {
            if(req.body.is_register){
                let otp = await Otps.findOne({ phone: phone , country_phone_code : country_phone_code}).select({otp_sms : 1}).sort( { "created_at": -1 } ).lean()
                console.log(otp);
                if ( req.body.otp_sms == otp?.otp_sms) {
                    await Otps.deleteOne({_id : otp._id})
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_OTP_VERIFIED_SUCCESSFULLY});
                }else{
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_OTP });
                }
            }else{
                let user = await User.findOne({ phone: phone , country_phone_code : country_phone_code}).select({otp_sms : 1}).lean()
                if ( req.body.otp_sms == user?.otp_sms) {
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_OTP_VERIFIED_SUCCESSFULLY});
                }else{
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_USER });
                }
            }
        }
        return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_OTP , emailError : true ,smsError : true });
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.check_user_registered = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = [{ name: 'country_phone_code', type: 'string' }, { name: 'phone', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let phone = req.body.phone;
        let country_phone_code = req.body.country_phone_code;
        let phoneWithCode = country_phone_code + phone;
        // generate otp //
        let otpForSMS = utils.generateOtp(6);
        let user = await User.findOne({ phone: phone, country_phone_code: country_phone_code })
        console.log(otpForSMS);
        if (user) {
            res.json({ success: true, message: success_messages.MESSAGE_CODE_USER_EXIST });
        } else {
            let userSms = setting_detail.userSms;
            if (userSms) {
                let otpOld = Otps.findOne({ phone: phone, country_phone_code: country_phone_code })
                if (otpOld?._id) {
                    await Otps.findByIdAndUpdate({_id : otpOld._id}, {otp_sms : otpForSMS})
                }else{
                    let otp = new Otps({
                        phone: phone, 
                        country_phone_code: country_phone_code,
                        otp_sms : otpForSMS
                    })
                    otp.save()
                }
                res.json({ success: true, otpForSMS: otpForSMS, userSms: userSms });
                utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, 1, otpForSMS);
            } else {
                res.json({ success: true, userSms: userSms });
            }
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }

};

// forgotpassword
exports.forgotpassword = async function (req, res) {
    try {
        let params_array = [{ name: 'email', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let type = req.body.type; //1 = user  0 = Provider 
        if (type == 1) {
            let user = await User.findOne({ email: req.body.email })
            if (!user) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_REGISTERED_OR_INVALID_EMAIL_ID });
            }
            let new_password = utils.generatePassword(6);
            user.password = utils.encryptPassword(new_password);
            user.save().then(() => {
            });
            let phoneWithCode = user.country_phone_code + user.phone;
            utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, 3, new_password);
            allemails.userForgotPassword(req, user, new_password);
            res.json({ success: true, message: success_messages.MESSAGE_CODE_RESET_PASSWORD_SUCCESSFULLY });
        } else {
            let provider = await Provider.findOne({ email: req.body.email })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_REGISTERED_OR_INVALID_EMAIL_ID });
            }
            let new_password = utils.generatePassword(6);
            provider.password = utils.encryptPassword(new_password);
            provider.save().then(() => {
            });
            let phoneWithCode = provider.country_phone_code + provider.phone;
            utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, 3, new_password);
            allemails.providerForgotPassword(req, provider, new_password);
            res.json({ success: true, message: success_messages.MESSAGE_CODE_RESET_PASSWORD_SUCCESSFULLY });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }

};

// OTP verification
exports.verification = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = [{ name: 'phone', type: 'string' }, { name: 'country_phone_code', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let type = req.body.type;
        let email = req.body.email;
        let phone = req.body.phone;
        let phoneWithCode = req.body.country_phone_code + phone;
        // generate otp //
        let otpForSMS = utils.generateOtp(6);
        let otpForEmail = utils.generateOtp(6);
        if (type == 1) {
            let user = await User.findOne({ email: req.body.email })

            if (user && email != "") {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED });
            }

            user = await User.findOne({ phone: req.body.phone })
            if (user) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED });
            }

            let userEmailVerification = setting_detail.userEmailVerification;
            let userSms = setting_detail.userSms;
            if (userSms) {
                utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, 1, otpForSMS);
            }

            if (userEmailVerification) {
                allemails.emailForOTPVerification(req, email, otpForEmail, 2);
            }
            let otpOld = Otps.findOne({ phone: phone, country_phone_code: req.body.country_phone_code })
            if (otpOld?._id) {
                await Otps.findByIdAndUpdate({_id : otpOld._id}, {otp_sms : otpForSMS})
            }else{
                let otpOld = Otps.findOne({ phone: phone, country_phone_code: req.body.country_phone_code })
                if (otpOld?._id) {
                    await Otps.findByIdAndUpdate({_id : otpOld._id}, {otp_sms : otpForSMS})
                }else{
                    let otp = new Otps({
                        phone: phone, 
                        country_phone_code: req.body.country_phone_code,
                        otp_sms : otpForSMS,
                        type : TYPE_VALUE.USER
                    })
                    otp.save()
                }
            }

            res.json({ success: true, otpForSMS: otpForSMS, otpForEmail: otpForEmail });

        } else {
            let provider = await Provider.findOne({ email: req.body.email })
            if (provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED });
            }

            provider = await Provider.findOne({ phone: req.body.phone })
            if (provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED });
            }

            let providerEmailVerification = setting_detail.providerEmailVerification;
            let providerSms = setting_detail.providerSms;
            ///////////// GENERATE OTP ///////////
            if (providerSms) {
                utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, 2, otpForSMS);
            }
            if (providerEmailVerification) {
                allemails.emailForOTPVerification(req, email, otpForEmail, 2);
            }

            let otpOld = Otps.findOne({ phone: req.body.phone, country_phone_code: req.body.country_phone_code , email : req.body.email})
                if (otpOld?._id) {
                    await Otps.findByIdAndUpdate({_id : otpOld._id}, {otp_sms : otpForSMS ,otp_mail :otpForEmail})
                }else{
                    let otp = new Otps({
                        phone: req.body.phone, 
                        country_phone_code: req.body.country_phone_code,
                        email : req.body.email ,
                        otp_mail :otpForEmail,
                        otp_sms : otpForSMS, 
                        type : TYPE_VALUE.PROVIDER
                    })
                    otp.save()
                }

            res.json({ success: true, otpForSMS: otpForSMS, otpForEmail: otpForEmail });

        }
    } catch (err) {
        utils.error_response(err, req, res)
    }

};

exports.verify_email_phone = async function (req, res) {
    try {
        let params_array = [{ name: 'phone', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return res.json(response)

        }
        let type = req.body.type;
        let Table;
        switch (type) {
            case '1':
                Table = User
                break;
            case '2':
                Table = Provider
                break;
        }
        let user = await Table.findOne({ email: req.body.email })
        if (user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED });
        }
        user = await Table.findOne({ phone: req.body.phone, country_phone_code: req.body.country_phone_code })
        if (!user) {
            return res.json({ success: true });
        }
        res.json({ success: false, error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED });

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

// user_register_new //
exports.user_register = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = [{ name: 'first_name', type: 'string' }, { name: 'last_name', type: 'string' }, { name: 'email', type: 'string' },
        { name: 'phone', type: 'string' }, { name: 'country_phone_code', type: 'string' }, { name: 'alpha2', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }

        let social_id = req.body.social_unique_id;
        let social_id_array = [];
        if (social_id == undefined || social_id == null || social_id == "") {
            social_id = null;
        } else {
            social_id_array.push(social_id);
        }

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
        let user_email = await User.findOne({ email: email })
        let user_phone = await User.findOne({ phone: req.body.phone, country_phone_code: req.body.country_phone_code })
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

            let alpha2 = req.body.alpha2
            let user = new User({
                first_name: first_name,
                last_name: last_name,
                email: email,
                country_phone_code: req.body.country_phone_code,
                alpha2: alpha2,
                phone: req.body.phone,
                gender: gender,
                device_token: req.body.device_token,
                device_type: req.body.device_type,
                address: req.body.address,
                social_ids: social_id_array,
                social_unique_id: req.body.social_unique_id,
                login_by: req.body.login_by,
                device_timezone: req.body.device_timezone,
                city: req.body.city,
                token: token,
                country: req.body.country,
                referral_code: referral_code,
                user_type: Number(constant_json.USER_TYPE_NORMAL),
                app_version: req.body.app_version
            });

            // FOR PASSWORD
            if (social_id == null) {
                user.password = utils.encryptPassword(req.body.password);
            }

            // for web push
            if(req.body.device_type == "web" && req.body.webpush_config && Object.keys(req.body.webpush_config).length > 0){
                user.webpush_config = JSON.parse(req.body.webpush_config)
            }

            // FOR PROFILE IMAGE 
            if (req.files != undefined && req.files.length > 0) {
                let image_name = user._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 1) + image_name + '.jpg';
                user.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 1);

            }

            let country_phone_code = user.country_phone_code;
            let match = {countryphonecode: country_phone_code}
            
            if(alpha2) {
                match = {  alpha2: alpha2 }
            }

            if(req.body.country_id){
                match = {_id: req.body.country_id}
            }
            let country = await Country.findOne(match)
            if (country) {
                user.wallet_currency_code = country.currencycode;
                user.country = country.countryname;
                user.save().then(() => {
                    let email_notification = setting_detail.email_notification;
                    if (email_notification) {
                        allemails.sendUserRegisterEmail(req, user, user.first_name + " " + user.last_name);
                    }
                    // FOR ADD DOCUEMNTS
                    utils.insert_documets_for_new_users(user, Number(constant_json.USER_TYPE_NORMAL), country._id, function (document_response) {
                        let response = {};
                        response.first_name = user.first_name;
                        response.last_name = user.last_name;
                        response.email = user.email;
                        response.country_phone_code = user.country_phone_code;
                        response.is_document_uploaded = user.is_document_uploaded;
                        response.address = user.address;
                        response.is_approved = user.is_approved;
                        response.user_id = user._id;
                        response.social_ids = user.social_ids;
                        response.social_unique_id = user.social_unique_id;
                        response.login_by = user.login_by;
                        response.city = user.city;
                        response.country = user.country;
                        response.referral_code = user.referral_code;
                        response.rate = user.rate;
                        response.rate_count = user.rate_count;
                        response.is_referral = user.is_referral;
                        response.token = user.token;
                        response.phone = user.phone;
                        response.wallet_currency_code = user.wallet_currency_code;
                        response.alpha2 = country.alpha2


                        response.country_detail = { "is_referral": country.is_referral }

                        // Trigger admin notification
                        utils.addNotification({
                            type: ADMIN_NOTIFICATION_TYPE.USER_REGISTERED,
                            user_id: user._id,
                            username: user.first_name + " " + user.last_name,
                            picture: user.picture,
                            country_id: country._id,
                            user_unique_id: user.unique_id,
                        })

                        return res.json({
                            success: true,
                            message: success_messages.MESSAGE_CODE_USER_REGISTERED_SUCCESSFULLY,
                            user_detail: response
                        });
                        
                    });
                });

            } else {
                let index = country_list.findIndex(i => i.alpha2 == alpha2);
                if (index != -1) {
                    user.wallet_currency_code = country_list[index].currency_code;
                } else {
                    user.wallet_currency_code = "";
                }
                user.is_document_uploaded = 1;
                await user.save();
                let email_notification = setting_detail.email_notification;
                if (email_notification) {
                    allemails.sendUserRegisterEmail(req, user, user.first_name + " " + user.last_name);
                }

                response.first_name = user.first_name;
                response.last_name = user.last_name;
                response.email = user.email;
                response.country_phone_code = user.country_phone_code;
                response.is_document_uploaded = user.is_document_uploaded;
                response.address = user.address;
                response.is_approved = user.is_approved;
                response.user_id = user._id;
                response.social_ids = user.social_ids;
                response.social_unique_id = user.social_unique_id;
                response.login_by = user.login_by;
                response.city = user.city;
                response.country = user.country;
                response.referral_code = user.referral_code;
                response.rate = user.rate;
                response.rate_count = user.rate_count;
                response.is_referral = user.is_referral;
                response.token = user.token;
                response.country_detail = { "is_referral": false }
                response.phone = user.phone;
                response.picture = user.picture;
                response.wallet_currency_code = user.wallet_currency_code;
                response.alpha2 = alpha2
                // Trigger admin notification
                utils.addNotification({
                    type: ADMIN_NOTIFICATION_TYPE.USER_REGISTERED,
                    user_id: user._id,
                    username: user.first_name + " " + user.last_name,
                    picture: user.picture,
                    country_id: country?._id,
                    user_unique_id: user.unique_id,
                })
                return res.json({
                    success: true,
                    message: success_messages.MESSAGE_CODE_USER_REGISTERED_SUCCESSFULLY,
                    user_detail: response
                });
                
            }
        } else {

            if (social_id == null) {
                if (user_phone) {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED });
                } else {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED });
                }
            } else {

                if (user_email && user_email.phone == req.body.phone) {
                    user_email.social_ids.push(social_id);
                    await user_email.save()
                    response.first_name = user_email.first_name;
                    response.last_name = user_email.last_name;
                    response.email = user_email.email;
                    response.country_phone_code = user_email.country_phone_code;
                    response.is_document_uploaded = user_email.is_document_uploaded;
                    response.address = user_email.address;
                    response.is_approved = user_email.is_approved;
                    response.user_id = user_email._id;
                    response.social_ids = user_email.social_ids;
                    response.social_unique_id = user_email.social_unique_id;
                    response.login_by = user_email.login_by;
                    response.city = user_email.city;
                    response.country = user_email.country;
                    response.referral_code = user_email.referral_code;
                    response.rate = user_email.rate;
                    response.rate_count = user_email.rate_count;
                    response.is_referral = user_email.is_referral;
                    response.token = user_email.token;
                    response.country_detail = { "is_referral": false }
                    response.phone = user_email.phone;
                    response.picture = user_email.picture;
                    response.wallet_currency_code = user_email.wallet_currency_code;
                    response.alpha2 = req.body.alpha2
                    return res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_USER_REGISTERED_SUCCESSFULLY,
                        user_detail: response
                    });
                } else if (user_phone && (user_phone.email == email || user_phone.email == "")) {
                    user_phone.social_ids.push(social_id);
                    user_phone.email = email;
                    await user_phone.save();
                    response.first_name = user_phone.first_name;
                    response.last_name = user_phone.last_name;
                    response.email = user_phone.email;
                    response.country_phone_code = user_phone.country_phone_code;
                    response.is_document_uploaded = user_phone.is_document_uploaded;
                    response.address = user_phone.address;
                    response.is_approved = user_phone.is_approved;
                    response.user_id = user_phone._id;
                    response.social_ids = user_phone.social_ids;
                    response.social_unique_id = user_phone.social_unique_id;
                    response.login_by = user_phone.login_by;
                    response.city = user_phone.city;
                    response.country = user_phone.country;
                    response.referral_code = user_phone.referral_code;
                    response.rate = user_phone.rate;
                    response.rate_count = user_phone.rate_count;
                    response.is_referral = user_phone.is_referral;
                    response.token = user_phone.token;
                    response.country_detail = { "is_referral": false }
                    response.phone = user_phone.phone;
                    response.wallet_currency_code = user_phone.wallet_currency_code;
                    response.alpha2 = alpha2
                    return res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_USER_REGISTERED_SUCCESSFULLY,
                        user_detail: response
                    });
                } else {
                    return res.json({
                        success: false,
                        error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED_WITH_SOCIAL
                    });
                }
            }
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.user_login = async function (req, res) {
    try {
        let params_array = [{ name: 'email', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let email = req.body.email;
        if (email != undefined) {
            email = ((req.body.email).trim()).toLowerCase();
        }

        let social_id = req.body.social_unique_id;

        let encrypted_password = req.body.password;
        if (social_id == undefined || social_id == null || social_id == "") {
            social_id = "";
        }
        if (encrypted_password == undefined || encrypted_password == null || encrypted_password == "") {
            encrypted_password = "";
        } else {
            encrypted_password = utils.encryptPassword(encrypted_password);
        }

        let query = { $or: [{ 'phone': email, 'country_phone_code': req.body.country_phone_code }, { social_ids: { $all: [social_id] } }] };

        let user_detail = await User.findOne(query)
        if (social_id == undefined || social_id == null || social_id == "") {
            social_id = null;
        }
        if ((social_id == null && email == "")) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_USER });
        } else if (user_detail) {
            if (social_id == null && (encrypted_password != "" || req.body.otp_sms != user_detail.otp_sms) && encrypted_password != user_detail.password ) {
                if((req.body.otp_sms != user_detail.otp_sms) && !req.body.password){
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_OTP });
                }
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_PASSWORD });
            } else if (social_id != null && user_detail.social_ids.indexOf(social_id) < 0) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_YOU_ARE_NOT_REGISTERED_WITH_THIS_SOCIAL });
            } else {
                if (user_detail.device_token != "" && user_detail.device_token != req.body.device_token) {
                    utils.sendPushNotification(user_detail.device_type, user_detail.device_token, push_messages.PUSH_CODE_FOR_USER_LOGIN_IN_OTHER_DEVICE, "", null, user_detail.lang_code);
                }
                user_detail.device_token = req.body.device_token;
                user_detail.device_type = req.body.device_type;
                user_detail.login_by = req.body.login_by;
                user_detail.app_version = req.body.app_version;
                // Commented out below code which changes 'user_type' on every login to prevent issues for corporate or dispatcher users
                    // user_detail.user_type = Number(constant_json.USER_TYPE_NORMAL);   
                user_detail.token = utils.tokenGenerator(32);

                if(req.body.device_type == "web" && req.body.webpush_config && Object.keys(req.body.webpush_config).length > 0){
                    user_detail.webpush_config = JSON.parse(req.body.webpush_config)
                }
                let document = await User_Document.find({user_id: user_detail._id, option: 1, is_visible: true, is_uploaded: 0})

                if(document.length > 0) {
                    user_detail.is_document_uploaded = 0
                } else { 
                    user_detail.is_document_uploaded = 1
                }

                await user_detail.save();
                let alpha2 = country_json.filter((country) => country.name == user_detail.country) || null
                response.alpha2 = alpha2[0]?.alpha2

                response.first_name = user_detail.first_name;
                response.last_name = user_detail.last_name;
                response.email = user_detail.email;
                response.country_phone_code = user_detail.country_phone_code;
                response.is_document_uploaded = user_detail.is_document_uploaded;
                response.address = user_detail.address;
                response.is_approved = user_detail.is_approved;
                response.user_id = user_detail._id;
                response.social_ids = user_detail.social_ids;
                response.social_unique_id = user_detail.social_unique_id;
                response.login_by = user_detail.login_by;
                response.city = user_detail.city;
                response.country = user_detail.country;
                response.referral_code = user_detail.referral_code;
                response.rate = user_detail.rate;
                response.rate_count = user_detail.rate_count;
                response.is_referral = user_detail.is_referral;
                response.token = user_detail.token;
                response.phone = user_detail.phone;
                response.picture = user_detail.picture;
                response.wallet_currency_code = user_detail.wallet_currency_code;

                let corporate_id = null;
                if (user_detail.corporate_ids && user_detail.corporate_ids.length > 0) {
                    corporate_id = user_detail.corporate_ids[0].corporate_id;
                }

                let corporate_detail = await Corporate.findOne({ _id: corporate_id })

                if (corporate_detail) {
                    response.corporate_detail = {
                        name: corporate_detail.name,
                        phone: corporate_detail.phone,
                        country_phone_code: corporate_detail.country_phone_code,
                        status: user_detail.corporate_ids[0].status,
                        _id: corporate_detail._id
                    }
                }

                let country = await Country.findOne({ countryphonecode: user_detail.country_phone_code })
                if (country) {
                    response.country_detail = { "is_referral": country.is_referral }
                } else {
                    response.country_detail = { "is_referral": false }
                }

                let pipeline = [
                    { $match: { 'split_payment_users.user_id': user_detail._id } },
                    { $match: { 'is_trip_cancelled': 0 } },
                    {
                        $project: {
                            trip_id: '$_id',
                            is_trip_end: 1,
                            currency: 1,
                            user_id: 1,
                            split_payment_users: {
                                $filter: {
                                    input: "$split_payment_users",
                                    as: "item",
                                    cond: { $eq: ["$$item.user_id", user_detail._id] }
                                }
                            }
                        }
                    },
                    { $unwind: "$split_payment_users" },
                    {
                        $match: {
                            $or: [
                                { 'split_payment_users.status': SPLIT_PAYMENT.WAITING },
                                {
                                    $and: [
                                        { 'split_payment_users.status': SPLIT_PAYMENT.ACCEPTED },
                                        { 'split_payment_users.payment_status': { $ne: PAYMENT_STATUS.COMPLETED } },
                                        { 'is_trip_end': 1 }
                                    ]
                                },
                                {
                                    $and: [
                                        { 'split_payment_users.status': SPLIT_PAYMENT.ACCEPTED },
                                        { 'split_payment_users.payment_status': { $ne: PAYMENT_STATUS.COMPLETED } },
                                        { 'split_payment_users.payment_mode': null }
                                    ]
                                }
                            ]
                        }
                    },
                    {
                        $lookup:
                        {
                            from: "users",
                            localField: "user_id",
                            foreignField: "_id",
                            as: "user_detail"
                        }
                    },
                    { $unwind: "$user_detail" },
                    {
                        $project: {
                            trip_id: 1,
                            first_name: '$user_detail.first_name',
                            last_name: '$user_detail.last_name',
                            phone: '$user_detail.phone',
                            country_phone_code: '$user_detail.country_phone_code',
                            user_id: '$user_detail._id',
                            is_trip_end: 1,
                            currency: 1,
                            status: '$split_payment_users.status',
                            payment_mode: '$split_payment_users.payment_mode',
                            payment_status: '$split_payment_users.payment_status',
                            payment_intent_id: '$split_payment_users.payment_intent_id',
                            total: '$split_payment_users.total',
                        }
                    },
                ]
                let split_payment_request = await Trip.aggregate(pipeline);
                if (split_payment_request.length == 0) {
                    split_payment_request = await Trip_history.aggregate(pipeline);
                }

                if (user_detail.current_trip_id) {
                    let trip_detail = await Trip.findOne({ _id: user_detail.current_trip_id }) || await Trip_history.findOne({ _id: user_detail.current_trip_id });
                    if(!trip_detail){
                        trip_detail = OpenRide.findOne({ _id: user_detail.current_trip_id })
                    }
                    response.trip_id = user_detail.current_trip_id;
                    response.provider_id = trip_detail?.current_provider;
                    response.is_provider_accepted = trip_detail?.is_provider_accepted;
                    response.is_provider_status = trip_detail?.is_provider_status;
                    response.is_trip_end = trip_detail?.is_trip_end;
                    response.is_trip_completed = trip_detail?.is_trip_completed;
                    response.is_user_invoice_show = trip_detail?.is_user_invoice_show;
                    res.json({ success: true, message: 3, split_payment_request: split_payment_request[0], user_detail: response });
                } else {
                    res.json({ success: true, message: 3, split_payment_request: split_payment_request[0], user_detail: response });
                }
            }
        } else {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_USER });
        }

    } catch (err) {
        utils.error_response(err, req, res)
    }
};


////////// GET  USER DETAIL ///////
exports.get_user_detail = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        console.log(req.body.user_id)
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_GET_YOUR_DETAIL });
        }
        let country = await Country.findOne({ countryphonecode: user.country_phone_code })
        let country_detail = { "is_referral": false };
        if (country) {
            country_detail = { "is_referral": country.is_referral };
        }

        res.json({
            success: true, message: success_messages.MESSAGE_CODE_GET_YOUR_DETAIL,

            user_id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            country_phone_code: user.country_phone_code,
            phone: user.phone,
            email: user.email,
            wallet: user.wallet,
            wallet_currency_code: user.wallet_currency_code,
            picture: user.picture,
            bio: user.bio,
            address: user.address,
            city: user.city,
            country: user.country,
            zipcode: user.zipcode,
            login_by: user.login_by,
            gender: user.gender,
            social_unique_id: user.social_unique_id,
            social_ids: user.social_ids,
            device_token: user.device_token,
            device_type: user.device_type,
            device_timezone: user.device_timezone,
            referral_code: user.referral_code,
            token: user.token,
            is_approved: user.is_approved,
            app_version: user.app_version,
            is_referral: user.is_referral,
            is_document_uploaded: user.is_document_uploaded,
            country_detail: country_detail,
            rate: user.rate,
            rate_count: user.rate_count
        });

    } catch (err) {
        utils.error_response(err, req, res)
    }
};


exports.user_update = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }, { name: 'phone', type: 'string' },
        { name: 'first_name', type: 'string' }, { name: 'last_name', type: 'string' }, { name: 'country_phone_code', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let user_id = req.body.user_id;
        let old_password = req.body.old_password;
        let social_id = req.body.social_unique_id;
        if (social_id == undefined || social_id == null || social_id == "") {
            social_id = null;
        }
        if (old_password == undefined || old_password == null || old_password == "") {
            old_password = "";
        } else {
            old_password = utils.encryptPassword(old_password);
        }
        let user = await User.findOne({ _id: user_id })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        if (req.body.token !== null && user.token !== req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        } else if (social_id == null && old_password != "" && old_password != user.password) {
            res.json({
                success: false,
                error_code: error_message.ERROR_CODE_YOUR_PASSWORD_IS_NOT_MATCH_WITH_OLD_PASSWORD
            });

        } else if (social_id != null && user.social_ids.indexOf(social_id) < 0) {
            res.json({ success: false, error_code: 111 });
        } else {
            let country = await Country.findOne({ _id: user.country_id })
            let new_email = req.body.email;
            let new_phone = req.body.phone;

            if (req.body.new_password != "") {
                let new_password = utils.encryptPassword(req.body.new_password);
                req.body.password = new_password;
            }
            if (!new_email) {
                new_email = null;
            }

            req.body.social_ids = user.social_ids;

            let user_details = await User.findOne({ _id: { '$ne': user_id }, email: new_email })

            if (user_details) {

                return res.json({ success: false, error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED });

            }
            let user_phone_details = await User.findOne({ _id: { '$ne': user_id }, country_phone_code: req.body.country_phone_code, phone: new_phone })
            if (user_phone_details) {
                return res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED
                });
            }
            let social_id_array = [];
            if (social_id != null) {
                social_id_array.push(social_id);
            }
            let user_update_query = { $or: [{ 'password': old_password }, { social_ids: { $all: social_id_array } }] };
            user_update_query = { $and: [{ '_id': user_id }, user_update_query] };


            user = await User.findOneAndUpdate(user_update_query, req.body, { new: true })
            if (!user) {
                return res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND
                });
            }
            if (req.files != undefined && req.files.length > 0) {
                utils.deleteImageFromFolder(user.picture, 1);
                let image_name = user._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 1) + image_name + '.jpg';
                user.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 1);
            }

            let first_name = (req.body.first_name).trim();
            if (first_name != "" && first_name != undefined && first_name != null) {
                first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);
            } else {
                first_name = "";
            }
            let last_name = (req.body.last_name).trim();
            if (last_name != "" && last_name != undefined && last_name != null) {
                last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);
            } else {
                last_name = "";
            }
            user.first_name = first_name;
            user.last_name = last_name;
            user.email = req.body.email;
            user.country_phone_code = req.body.country_phone_code;
            user.phone = req.body.phone;
            user.bio = req.body.bio;
            user.gender = req.body.gender;
            user.address = req.body.address;
            user.zipcode = req.body.zipcode;
            user.city = req.body.city;
            await user.save();

            response.first_name = user.first_name;
            response.last_name = user.last_name;
            response.email = user.email;
            response.country_phone_code = user.country_phone_code;
            response.is_document_uploaded = user.is_document_uploaded;
            response.address = user.address;
            response.is_approved = user.is_approved;
            response.user_id = user._id;
            response.social_ids = user.social_ids;
            response.social_unique_id = user.social_unique_id;
            response.login_by = user.login_by;
            response.city = user.city;
            response.country = user.country;
            response.referral_code = user.referral_code;
            response.rate = user.rate;
            response.rate_count = user.rate_count;
            response.is_referral = user.is_referral;
            response.token = user.token;
            response.country_detail = { "is_referral": false }
            response.phone = user.phone;
            response.picture = user.picture;
            response.wallet_currency_code = user.wallet_currency_code;
            response.alpha2 = country?.alpha2

            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_PROFILE_UPDATED_SUCCESSFULLY,
                user_detail: response
            });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

//// LOGOUT USER  SERVICE /////
exports.logout = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user = await User.findOne({ _id: req.body.user_id })
        if(req.body.is_admin_decline){
            let message = ERROR_CODE.DECLINE_BY_ADMIN
            user.webpush_config = {}
            user.device_token = "";
            await user.save()
            res.json({ success: true, error_code: message })
            return
        }
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        } else {
            user.webpush_config = {}
            user.device_token = "";
            await user.save()
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_LOGOUT_SUCCESSFULLY
            });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

///////////////////////////////// UPDATE DEVICE TOKEN //////////////////////
exports.update_device_token = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        if (user.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        user.device_token = req.body.device_token;
        user.save().then(() => {
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_DEVICE_TOKEN_UPDATE_SUCCESSFULLY
            });
        });
    } catch (err) {
        utils.error_response(err, req, res)
    }
};


//////////////APPLY REFERAL CODE-//
exports.apply_referral_code = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }, { name: 'referral_code', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        if (req.body.token != null && user.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }
        let is_skip = req.body.is_skip;
        
        if (is_skip == 0) {
            if(user.referral_code == req.body.referral_code) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_OWN_REFERRAL})
            }
            let referral_code = req.body.referral_code;
            let userData = await User.findOne({ referral_code: referral_code })
            if (!userData) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_REFERRAL_CODE_INVALID });
            }
            if (userData.country != user.country) {
                return res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_YOUR_FRIEND_COUNTRY_NOT_MATCH_WITH_YOU
                });
            }
            if (user.is_referral == 1) {
                return res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_YOU_HAVE_ALREADY_APPLY_REFERRAL_CODE
                });
            }
            let country = await Country.findOne({ countryname: user.country })

            let userRefferalCount = userData.total_referrals;

            if (userRefferalCount >= country.userreferral) {
                return res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_REFERRAL_LIMIT_REACHED
                });
            }

            let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, userData.unique_id, userData._id, null,
                userData.wallet_currency_code, userData.wallet_currency_code,
                1, country.bonus_to_userreferral, userData.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_REFERRAL, "User used your referral code, User id : " + user.unique_id);

            userData.total_referrals = +userData.total_referrals + 1;
            userData.wallet = total_wallet_amount;
            await userData.save()
            user.is_referral = 1;
            user.referred_by = userData._id;

            total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id, null,
                user.wallet_currency_code, user.wallet_currency_code,
                1, country.referral_bonus_to_user, user.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_REFERRAL, "Using refferal code : " + referral_code + " of User id : " + userData.unique_id);

            let total_redeem_point = '';
            if (country?.user_redeem_settings[0]?.is_user_redeem_point_reward_on && (country?.user_redeem_settings[0]?.referring_redeem_point_to_users_friend > 0)) {
                total_redeem_point = utils.add_redeem_point_history(
                constant_json.USER_UNIQUE_NUMBER,
                user.unique_id,
                user._id,
                country._id,
                constant_json.REFERRAL_REDEEM_POINT,
                user.wallet_currency_code,
                'Get redeem point via referral',
                country.user_redeem_settings[0]
                    ?.referring_redeem_point_to_users_friend,
                user.total_redeem_point,
                constant_json.ADD_REDEEM_POINT
                )
                user.total_redeem_point = total_redeem_point;
            }


            if (country?.user_redeem_settings[0]?.is_user_redeem_point_reward_on && (country?.user_redeem_settings[0]?.referring_redeem_point_to_user > 0)) {

                total_redeem_point = utils.add_redeem_point_history(
                constant_json.USER_UNIQUE_NUMBER,
                userData.unique_id,
                userData._id,
                country._id,
                constant_json.REFERRAL_REDEEM_POINT,
                userData.wallet_currency_code,
                'Get redeem point using referral',
                country.user_redeem_settings[0]?.referring_redeem_point_to_user,
                userData.total_redeem_point,
                constant_json.ADD_REDEEM_POINT
                )

                userData.total_redeem_point = total_redeem_point;
           
            }
            user.wallet = total_wallet_amount;
            await user.save()
            await userData.save()
            
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_REFERRAL_PROCESS_SUCCESSFULLY_COMPLETED,
                user_id: user._id,
                is_referral: user.is_referral,
                first_name: user.first_name,
                last_name: user.last_name,
                country_phone_code: user.country_phone_code,
                phone: user.phone,
                email: user.email,
                picture: user.picture,
                bio: user.bio,
                address: user.address,
                city: user.city,
                country: user.country,
                zipcode: user.zipcode,
                login_by: user.login_by,
                social_unique_id: user.social_unique_id,
                device_token: user.device_token,
                device_type: user.device_type,
                referral_code: user.referral_code,
                device_timezone: user.device_timezone
            });
        } else {
            user.is_referral = 1;
            await user.save()
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOU_HAVE_SKIPPED_FOR_REFERRAL_PROCESS,
                user_id: user._id,
                is_referral: user.is_referral,
                first_name: user.first_name,
                last_name: user.last_name,
                country_phone_code: user.country_phone_code,
                phone: user.phone,
                email: user.email,
                picture: user.picture,
                bio: user.bio,
                address: user.address,
                city: user.city,
                country: user.country,
                zipcode: user.zipcode,
                login_by: user.login_by,
                social_unique_id: user.social_unique_id,
                device_token: user.device_token,
                device_type: user.device_type,
                referral_code: user.referral_code,
                device_timezone: user.device_timezone
            });
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }

};
///////////////FARE CALCULATOR FOR ESTIMATE FARE///////

exports.getfareestimate = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'service_type_id', type: 'string' }], function (response) {
        if (response.success) {
            Citytype.findOne({ _id: req.body.service_type_id }).then((citytype) => {
                let geo = false;
                let geo2 = false
                let zone1, zone2, k = 0;
                if (!citytype) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_NO_SERVICE_TYPE_FOUND });
                } else {
                    let city_id = citytype.cityid;
                    City.findOne({ _id: city_id }).then(async (city) => {

                        if (!city) {
                            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_SERVICE_TYPE_FOUND });
                        } else {        
                            let distance = req.body.distance;
                            let distanceKmMile = distance;
                            let unit_set = city.unit;
                            if (unit_set == 1) {
                                distanceKmMile = distance * 0.001;
                            } else {
                                distanceKmMile = distance * 0.000621371;
                            }

                            let time = req.body.time;
                            let timeMinutes;
                            timeMinutes = time * 0.0166667;
                            timeMinutes = Math.round(timeMinutes)
                            if (req.body.is_open_ride) {
                                let citytypeforopenride = await Citytype.findOne({ typeid: citytype.typeid,"is_ride_share" : 2 })
                                if (!citytypeforopenride) {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_NO_SERVICE_TYPE_FOUND });
                                    return
                                }else{
                                    other(citytypeforopenride.cityid, citytypeforopenride, req.body, timeMinutes, distanceKmMile, res)
                                    return
                                }
                            }
                            if (req.body.is_multiple_stop == 1) {
                                other(city_id, citytype, req.body, timeMinutes, distanceKmMile, res);
                            } else if (city.zone_business == 1) {
                                CityZone.find({ cityid: city_id }).then((cityzone) => {
                                    if (citytype.is_zone == 1 && cityzone !== null && cityzone.length > 0) {
                                        let zone_count = cityzone.length;
                                        cityzone.forEach(function (cityzoneDetail) {

                                            geo = geolib.isPointInside(
                                                { latitude: req.body.pickup_latitude, longitude: req.body.pickup_longitude },
                                                cityzoneDetail.kmlzone
                                            );
                                            geo2 = geolib.isPointInside(
                                                {
                                                    latitude: req.body.destination_latitude,
                                                    longitude: req.body.destination_longitude
                                                },
                                                cityzoneDetail.kmlzone
                                            );
                                            if (geo) {
                                                zone1 = cityzoneDetail.id;

                                            }
                                            if (geo2) {
                                                zone2 = cityzoneDetail.id;

                                            }
                                            k++;
                                            if (k == zone_count) {
                                                ZoneValue.findOne({
                                                    service_type_id: req.body.service_type_id,
                                                    $or: [{ from: zone1, to: zone2 }, {
                                                        from: zone2,
                                                        to: zone1
                                                    }]
                                                }).then((zonevalue) => {

                                                    if (zonevalue) {
                                                        let estimated_fare = (zonevalue.amount).toFixed(2);
                                                        let trip_type = constant_json.TRIP_TYPE_ZONE;

                                                        res.json({
                                                            success: true,
                                                            message: success_messages.MESSAGE_CODE_YOU_GET_FARE_ESTIMATE,
                                                            trip_type: trip_type,
                                                            time: timeMinutes,
                                                            distance: (distanceKmMile).toFixed(2),
                                                            estimated_fare: Number(estimated_fare),
                                                            unit_set: city.unit
                                                        });

                                                    } else {
                                                        airport(city_id, citytype, req.body, timeMinutes, distanceKmMile, res);
                                                    }
                                                })

                                            }

                                        });

                                    } else {
                                        airport(city_id, citytype, req.body, timeMinutes, distanceKmMile, res);
                                    }

                                });
                            } else {
                                airport(city_id, citytype, req.body, timeMinutes, distanceKmMile, res);
                            }
                        }
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


function airport(cityid, citytype, body, timeMinutes, distanceKmMile, res) {


    Airport.find({ city_id: cityid }).then((airport_data) => {
        if (airport_data != null && airport_data.length > 0) {
            City.findOne({ '_id': cityid, airport_business: 1 }).then((city) => {
                if (city) {

                    let pickup_airport;
                    let dest_airport;
                    let airport_id;
                    airport_data.forEach(function (airportDetail) {

                        pickup_airport = geolib.isPointInside(
                            {
                                latitude: body.pickup_latitude,
                                longitude: body.pickup_longitude
                            },
                            airportDetail.kmlzone
                        );

                        dest_airport = geolib.isPointInside(
                            {
                                latitude: body.destination_latitude,
                                longitude: body.destination_longitude
                            },
                            airportDetail.kmlzone
                        );

                        if (pickup_airport) {
                            let city_distance = utils.getDistanceFromTwoLocation([body.destination_latitude, body.destination_longitude], city.cityLatLong);

                            if (city.is_use_city_boundary) {
                                let inside_city = geolib.isPointInside(
                                    {
                                        latitude: body.pickup_latitude,
                                        longitude: body.pickup_longitude
                                    },
                                    city.city_locations
                                );
                                if (inside_city) {
                                    airport_id = airportDetail._id;
                                }
                            } else {
                                if (city_distance < city.cityRadius) {
                                    airport_id = airportDetail._id;
                                }
                            }
                        }
                        if (dest_airport) {
                            let city_distance = utils.getDistanceFromTwoLocation([body.pickup_latitude, body.pickup_longitude], city.cityLatLong);
                            if (city.is_use_city_boundary) {
                                let inside_city = geolib.isPointInside(
                                    {
                                        latitude: body.destination_latitude,
                                        longitude: body.destination_longitude
                                    },
                                    city.city_locations
                                );
                                if (inside_city) {
                                    airport_id = airportDetail._id;
                                }
                            } else {
                                if (city_distance < city.cityRadius) {
                                    airport_id = airportDetail._id;
                                }
                            }
                        }
                    });

                    if (airport_id) {
                        AirportCity.findOne({
                            airport_id: airport_id,
                            service_type_id: citytype._id
                        }).then((airportcity) => {
                            if (airportcity && airportcity.price > 0) {
                                let estimated_fare = (airportcity.price).toFixed(2);
                                let trip_type = constant_json.TRIP_TYPE_AIRPORT;
                                res.json({
                                    success: true,
                                    trip_type: trip_type,
                                    message: success_messages.MESSAGE_CODE_YOU_GET_FARE_ESTIMATE,
                                    time: timeMinutes,
                                    distance: (distanceKmMile).toFixed(2),
                                    estimated_fare: Number(estimated_fare),
                                    unit_set: city.unit
                                });

                            } else {
                                cityCheck(cityid, citytype, body, timeMinutes, distanceKmMile, res)
                            }

                        })


                    } else {
                        cityCheck(cityid, citytype, body, timeMinutes, distanceKmMile, res);
                    }


                } else {
                    cityCheck(cityid, citytype, body, timeMinutes, distanceKmMile, res)
                }
            })
        } else {
            cityCheck(cityid, citytype, body, timeMinutes, distanceKmMile, res)
        }

    });
}

function cityCheck(cityid, citytype, body, timeMinutes, distanceKmMile, res) {
    let flag = 0;
    let k = 0;
    City.findOne({ '_id': cityid, city_business: 1 }).then((city) => {
        
        if (city) {
            CitytoCity.find({ city_id: cityid, service_type_id: citytype._id, destination_city_id: { $in: city.destination_city } }).then((citytocity) => {

                if (citytocity !== null && citytocity.length > 0) {

                    citytocity.forEach(function (citytocity_detail) {

                        City.findById(citytocity_detail.destination_city_id).then((city_detail) => {
                            if (flag == 0) {

                                let city_radius = city_detail.cityRadius;
                                let destination_city_radius = utils.getDistanceFromTwoLocation([body.destination_latitude, body.destination_longitude], city_detail.cityLatLong);

                                let inside_city;
                                if (city_detail.city_locations && city_detail.city_locations.length > 2) {
                                    inside_city = geolib.isPointInside(
                                        {
                                            latitude: body.destination_latitude,
                                            longitude: body.destination_longitude
                                        },
                                        city_detail.city_locations
                                    );
                                }

                                if (citytocity_detail.price > 0 && ((!city_detail.is_use_city_boundary && city_radius > destination_city_radius) || (city_detail.is_use_city_boundary && inside_city))) {
                                    let estimated_fare = (citytocity_detail.price).toFixed(2);
                                    let trip_type = constant_json.TRIP_TYPE_CITY;
                                    flag = 1;
                                    res.json({
                                        success: true,
                                        trip_type: trip_type,
                                        message: success_messages.MESSAGE_CODE_YOU_GET_FARE_ESTIMATE,
                                        time: timeMinutes,
                                        distance: (distanceKmMile).toFixed(2),
                                        estimated_fare: Number(estimated_fare),
                                        unit_set: city.unit
                                    })

                                } else if (citytocity.length - 1 == k) {
                                    other(cityid, citytype, body, timeMinutes, distanceKmMile, res)
                                } else {
                                    k++;
                                }
                            }
                        });
                    });
                } else {
                    other(cityid, citytype, body, timeMinutes, distanceKmMile, res)
                }
            });
        } else {
            other(cityid, citytype, body, timeMinutes, distanceKmMile, res)
        }
    });
}

function other(cityid, citytype, body, timeMinutes, distanceKmMile, res) {
    City.findOne({ _id: cityid }).then((city) => {

        let base_distance = citytype.base_price_distance;
        let base_price = citytype.base_price;
        let price_per_unit_distance1 = citytype.price_per_unit_distance;
        let price_for_total_time1 = citytype.price_for_total_time;
        let tax = citytype.tax;
        let min_fare = citytype.min_fare;
        let surge_multiplier = citytype.surge_multiplier;

        if (body.surge_multiplier) {
            surge_multiplier = Number(body.surge_multiplier);
        }
        let price_per_unit_distance;
        if (distanceKmMile <= base_distance) {
            price_per_unit_distance = 0;
        } else {
            price_per_unit_distance = (price_per_unit_distance1 * (distanceKmMile - base_distance)).toFixed(2);
        }

        let price_for_total_time = Number((price_for_total_time1 * timeMinutes).toFixed(2));

        let total = 0;
        total = +base_price + +price_per_unit_distance + +price_for_total_time;
        try {
            if (Number(body.is_surge_hours) == 1) {
                total = total * surge_multiplier;
            }
        } catch (error) {

        }
        // tax cal
        total = total + total * 0.01 * tax;
        let is_min_fare_used = 0;
        if (total < min_fare) {
            total = min_fare;
            is_min_fare_used = 1;
        }
        let estimated_fare = Number(total.toFixed(2));
        let trip_type = constant_json.TRIP_TYPE_NORMAL;
        res.json({
            success: true,
            trip_type: trip_type,
            user_tax_fee: 0,
            user_miscellaneous_fee: 0,
            message: success_messages.MESSAGE_CODE_YOU_GET_FARE_ESTIMATE,
            time: timeMinutes,
            distance: (distanceKmMile).toFixed(2),
            is_min_fare_used: is_min_fare_used,
            base_price: base_price,
            price_per_unit_distance: price_per_unit_distance,
            price_per_unit_time: price_for_total_time,
            estimated_fare: estimated_fare,
            unit_set: city.unit
        });


    });
}


////APPLY PROMO CODE///

exports.remove_promo_code = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, { name: 'trip_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {

                if (user) {
                    if (req.body.token != null && user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        User_promo_use.findOneAndRemove({ user_id: req.body.user_id, trip_id: req.body.trip_id }, function () {
                            Trip.findOne({ _id: req.body.trip_id }, function (error, trip) {

                                Promo_Code.findOne({ _id: trip.promo_id }, function (error, promocode_data) {
                                    trip.promo_id = null;
                                    trip.save();
                                    if (promocode_data) {
                                        promocode_data.user_used_promo--;
                                        promocode_data.save();
                                    }
                                    res.json({ success: true, message: success_messages.MESSAGE_CODE_PROMOCODE_REMOVE_SUCCESSFULLY });
                                })
                            })
                        })
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });

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

exports.apply_promo_code = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, { name: 'promocode', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {
                    if (req.body.token != null && user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let now = new Date();
                        if (req.body.trip_id) {
                            Trip.findOne({ _id: req.body.trip_id }).then((trip) => {
                                if (trip) {
                                    let country_id = trip.country_id;
                                    Promo_Code.findOne({
                                        promocode: req.body.promocode,
                                        state: 1,
                                        countryid: country_id
                                        // start_date: { $lte: now },
                                        // code_expiry: { $gte: now }
                                    }).then((promocode) => {
                                        if (promocode) {
                                           //check promo code is expiry or not
                                            if(promocode.start_date <= now && promocode.code_expiry >= now ){
                                                if (promocode.user_used_promo < promocode.code_uses) {
                                                    User_promo_use.findOne({
                                                        user_id: req.body.user_id,
                                                        promo_id: promocode._id
                                                    }).then((used_promo_data) => {
                                                        if (used_promo_data) {
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_PROMOTIONAL_CODE_ALREADY_USED
                                                            });
                                                        } else {
                                                            Citytype.findOne({ _id: trip.service_type_id }).then((citytypedetail) => {
                                                                if (citytypedetail) {
                                                                    let cityid = citytypedetail.cityid;
                                                                    let countryid = citytypedetail.countryid;
                                                                    City.findOne({ _id: cityid }).then(async (citydetail) => {

                                                                        let promo_apply_for_cash = citydetail.isPromoApplyForCash;
                                                                        let promo_apply_for_card = citydetail.isPromoApplyForCard;
                                                                        let is_promo_apply = 0;
                                                                        if ((trip.payment_mode == constant_json.PAYMENT_MODE_CASH && promo_apply_for_cash == constant_json.YES) ||
                                                                            (trip.payment_mode == constant_json.PAYMENT_MODE_CARD && promo_apply_for_card == constant_json.YES)) {
                                                                            is_promo_apply = 1;
                                                                        }
                                                                        const trips = await Trip_history.find({ user_id: req.body.user_id, is_trip_completed: 1, is_trip_cancelled: 0})
                                                                        let trip_count = trips.length
                                                                        let is_promo_code_valid = false;
                                                                        if (!promocode.completed_trips_type) {
                                                                            promocode.completed_trips_type = 2;
                                                                        }
                                                                        if (!promocode.completed_trips_value) {
                                                                            promocode.completed_trips_value = 0;
                                                                        }
                                                                        if (promocode.completed_trips_type == 1) {
                                                                            is_promo_code_valid = (promocode.completed_trips_value == trip_count);
                                                                        } else if (promocode.completed_trips_type == 2) {
                                                                            is_promo_code_valid = (trip_count >= promocode.completed_trips_value);
                                                                        }
                                                                        if (is_promo_code_valid) {
                                                                            if (is_promo_apply) {

                                                                                if (promocode.cityid.indexOf(cityid) !== -1 && promocode.countryid.equals(countryid)) {
                                                                                    trip.promo_id = promocode._id;
                                                                                    trip.promo_code = promocode.promocode;
                                                                                    trip.save();
                                                                                    promocode.user_used_promo = promocode.user_used_promo + 1;
                                                                                    promocode.save();
                                                                                    let userpromouse = new User_promo_use({
                                                                                        promo_id: promocode._id,
                                                                                        promocode: promocode.promocode,
                                                                                        user_id: req.body.user_id,
                                                                                        promo_type: promocode.code_type,
                                                                                        promo_value: promocode.code_value,
                                                                                        trip_id: trip._id,
                                                                                        user_used_amount: 0

                                                                                    });
                                                                                    userpromouse.save().then(() => {
                                                                                        res.json({
                                                                                            success: true, promo_id: promocode._id,
                                                                                            message: success_messages.MESSAGE_CODE_PROMOTIONAL_CODE_APPLIED_SUCCESSFULLY
                                                                                        });
                                                                                    });
                                                                                } else {

                                                                                    res.json({
                                                                                        success: false,
                                                                                        error_code: error_message.ERROR_CODE_PROMO_CODE_NOT_FOR_YOUR_AREA
                                                                                    });
                                                                                }
                                                                            } else {
                                                                                res.json({
                                                                                    success: false,
                                                                                    error_code: error_message.ERROR_CODE_PROMO_CODE_NOT_APPLY_ON_YOUR_PAYMENT_MODE
                                                                                });
                                                                            }
                                                                        } else {
                                                                            res.json({
                                                                                success: false,
                                                                                error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE
                                                                            });
                                                                        }
                                                                    });
                                                                } else {
                                                                    res.json({
                                                                        success: false,
                                                                        error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE
                                                                    });
                                                                }
                                                            });

                                                        }
                                                    });
                                                } else {
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_PROMO_CODE_EXPIRED_OR_INVALID
                                                    });
                                                }
                                            }else{
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_PROMO_CODE_EXPIRED_OR_INVALID
                                                });  
                                            }
                                        } else {
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE
                                            });
                                        }

                                    });
                                } else {
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE
                                    });
                                }
                            });
                        } else {
                            let country_id = req.body.country_id;
                            Promo_Code.findOne({
                                promocode: req.body.promocode,
                                state: 1,
                                countryid: country_id
                                // start_date: { $lte: now },
                                // code_expiry: { $gte: now }
                            }).then((promocode) => {

                                if (promocode) {
                                    //check promo code is expiry or not
                                    if(promocode.start_date <= now && promocode.code_expiry >= now ){
                                        if (promocode.user_used_promo < promocode.code_uses) {
                                            User_promo_use.findOne({
                                                user_id: req.body.user_id,
                                                promo_id: promocode._id
                                            }).then((used_promo_data) => {
                                                if (used_promo_data) {
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_PROMOTIONAL_CODE_ALREADY_USED
                                                    });
                                                } else {

                                                    City.findOne({ _id: req.body.city_id }).then(async (citydetail) => {

                                                        let promo_apply_for_cash = citydetail.isPromoApplyForCash;
                                                        let promo_apply_for_card = citydetail.isPromoApplyForCard;
                                                        let is_promo_apply = 0;
                                                        if ((req.body.payment_mode == constant_json.PAYMENT_MODE_CASH && promo_apply_for_cash == constant_json.YES) ||
                                                            (req.body.payment_mode == constant_json.PAYMENT_MODE_CARD && promo_apply_for_card == constant_json.YES)) {
                                                            is_promo_apply = 1;
                                                        }

                                                        const trips = await Trip_history.find({ user_id: req.body.user_id, is_trip_completed: 1, is_trip_cancelled: 0})
                                                        let trip_count = trips.length
                                                        let is_promo_code_valid = false;
                                                        if (!promocode.completed_trips_type) {
                                                            promocode.completed_trips_type = 2;
                                                        }
                                                        if (!promocode.completed_trips_value) {
                                                            promocode.completed_trips_value = 0;
                                                        }
                                                        if (promocode.completed_trips_type == 1) {
                                                            is_promo_code_valid = (promocode.completed_trips_value == trip_count);
                                                        } else if (promocode.completed_trips_type == 2) {
                                                            is_promo_code_valid = (trip_count >= promocode.completed_trips_value);
                                                        }
                                                        if (is_promo_code_valid) {
                                                            if (is_promo_apply) {

                                                                if (promocode.cityid.indexOf(req.body.city_id) !== -1 && promocode.countryid.equals(country_id)) {
                                                                    res.json({
                                                                        success: true,
                                                                        promo_id: promocode._id,
                                                                        promocode_name: promocode.name,
                                                                        promo_apply_for_cash: promo_apply_for_cash,
                                                                        promo_apply_for_card: promo_apply_for_card,
                                                                        message: success_messages.MESSAGE_CODE_PROMOTIONAL_CODE_APPLIED_SUCCESSFULLY
                                                                    });
                                                                } else {

                                                                    res.json({
                                                                        success: false,
                                                                        error_code: error_message.ERROR_CODE_PROMO_CODE_NOT_FOR_YOUR_AREA
                                                                    });
                                                                }
                                                            } else {
                                                                res.json({
                                                                    success: false,
                                                                    error_code: error_message.ERROR_CODE_PROMO_CODE_NOT_APPLY_ON_YOUR_PAYMENT_MODE
                                                                });
                                                            }
                                                        } else {
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE
                                                            });
                                                        }

                                                    });

                                                }
                                            });
                                        } else {
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_PROMO_CODE_EXPIRED_OR_INVALID
                                            });
                                        }
                                    }else{
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_PROMO_CODE_EXPIRED_OR_INVALID
                                        });                              
                                    }
                                } else {
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE
                                    });
                                }

                            });
                        }
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });

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

exports.get_promo_code_list = function(req, res) {
    utils.check_request_params(req.body, [{ name: 'country_id', type: 'string' }, { name: 'city_id', type: 'string' }], function (response) {
        if (response.success) {
            const request_data_body = req.body
            let date = new Date()
            let country_filter = {
                $match: {
                    $and: [
                        { countryid: { $eq: mongoose.Types.ObjectId(request_data_body.country_id) } },
                        { cityid:  mongoose.Types.ObjectId(request_data_body.city_id) },
                        { code_expiry: { $gte: date } },
                        { start_date: { $lte: date } },
                        { state: 1 },
                        { $expr:
                            {
                                $ne: ['$code_uses', '$user_used_promo']
                            }
                        }
                    ]
                }
            }
            Promo_Code.aggregate([country_filter]).then((promos) => {
                if(promos.length > 0) {
                    res.json({
                        success: true,
                        promo_codes: promos
                    });
                } else {
                    res.json({
                        success: false,
                        error_code: error_message.ERROR_CODE_PROMO_CODE_NOT_FOUND
                    });
                }
            })
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
}

//////////////// USER REFERAL CREDIT////////

exports.get_user_referal_credit = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {
                    if (req.body.token != null && user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {

                        let condition = { $match: { user_id: { $eq: Schema(req.body.user_id) } } }
                        let referral_condition = { $match: { wallet_comment_id: { $eq: Number(constant_json.ADDED_BY_REFERRAL) } } }
                        let group = {
                            $group: {
                                _id: null,
                                total_referral_credit: { $sum: '$added_wallet' }
                            }
                        }

                        Wallet_history.aggregate([condition, referral_condition, group]).then((wallet_history_count) => {
                            if (wallet_history_count.length > 0) {
                                res.json({ success: true, total_referral_credit: wallet_history_count[0].total_referral_credit })
                            } else {
                                res.json({ success: true, total_referral_credit: 0 });
                            }
                        })
                    }

                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });

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

//////// ADD WALLET AMOUNT ///

exports.add_wallet_amount = async function (req, res) {
    utils.check_request_params(req.body, [], async function (response) {
        try {
            const setting_detail = await Settings.findOne({})
            if (response.success) {
                if (req.body.udf2) {
                    req.body.type = req.body.udf2;
                }else if(req.body?.user_defined?.udf2){
                    req.body.type = req.body.user_defined.udf2
                    req.body.udf2 = req.body.user_defined.udf2
                }
                if (req.body?.udf3) {
                    req.body.user_id = req.body.udf3;
                }else if(req.body?.user_defined?.udf3){
                    req.body.user_id = req.body.user_defined.udf3
                }
                let type = Number(req.body.type);
                if(req.query?.payment_gateway_type){
                    req.body.payment_gateway_type = req.query?.payment_gateway_type
                    type = Number(req.query?.type)
                    req.body.user_id = req.query?.user_id
                    req.body.amount = req.query?.amount
                }
                if (req.body?.udf1) {
                    req.body.payment_gateway_type = req.body.udf1;
                }else if(req.body?.user_defined?.udf1){
                    req.body.payment_gateway_type = req.body.user_defined.udf1
                }
                let Table;
                switch (type) {
                    case Number(constant_json.PROVIDER_UNIQUE_NUMBER): // 11
                        type = Number(constant_json.PROVIDER_UNIQUE_NUMBER);
                        Table = Provider;
                        break;
                    case Number(constant_json.CORPORATE_UNIQUE_NUMBER):
                        type = Number(constant_json.CORPORATE_UNIQUE_NUMBER);
                        Table = Corporate;
                        break;
                    case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                        type = Number(constant_json.PARTNER_UNIQUE_NUMBER);
                        Table = Partner;
                        break;
                    default:
                        type = Number(constant_json.USER_UNIQUE_NUMBER); // 10
                        Table = User;
                        break;
                }
                Table.findOne({ _id: req.body.user_id }).then(async(detail) => {
                    if (req.body.token && detail.token != req.body.token && !req.body.udf2) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let payment_id = Number(constant_json.PAYMENT_BY_STRIPE);
                        try {
                            payment_id = req.body.payment_id;
                        } catch (error) {
                            console.error(err);
                        }
    
                        switch (payment_id) {
                            case Number(constant_json.PAYMENT_BY_STRIPE):
                                break;
                            case Number(constant_json.PAYMENT_BY_PAYPAL):
                                break;
                        }
                        if (!req.body.payment_gateway_type || req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe || req.body?.is_apple_pay) {
                            
                            let url = setting_detail.payments_base_url + "/retrieve_payment_intent"
                            let data = {
                                payment_intent_id: req.body.payment_intent_id
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
                                    return error
                                } else {
                                    body = JSON.parse(body);
                                    let intent = body.intent;
    
                                    if (intent && intent.charges && intent.charges.data && intent.charges.data.length > 0) {
    
                                        let total_wallet_amount = utils.addWalletHistory(type, detail.unique_id, detail._id, detail.country_id, detail.wallet_currency_code, detail.wallet_currency_code,
                                            1, (intent.charges.data[0].amount / 100), detail.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Card : " + intent.charges.data[0].payment_method_details.card.last4)
                                        detail.wallet = total_wallet_amount;
                                        if(req.body?.is_apple_pay){
                                            utils.apple_pay_socket(req.body?.user_id)
                                        }
                                        detail.save().then(() => {
                                            res.json({
                                                success: true,
                                                message: success_messages.MESSAGE_CODE_WALLET_AMOUNT_ADDED_SUCCESSFULLY,
                                                wallet: detail.wallet,
                                                wallet_currency_code: detail.wallet_currency_code
            
                                            });
                                        });
            
                                    }
                                }
                            });
                        } else if (req.body.payment_gateway_type == PAYMENT_GATEWAY.paystack) {
                            let total_wallet_amount = utils.addWalletHistory(type, detail.unique_id, detail._id, detail.country_id, detail.wallet_currency_code, detail.wallet_currency_code,
                                1, (req.body.paystack_data.amount / 100), detail.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Card : " + req.body.paystack_data.authorization.last4)
    
                            detail.wallet = total_wallet_amount;
                            detail.save().then(() => {
                                //for ejs Code global.message = "Wallet Amount Added Sucessfully.";
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_WALLET_AMOUNT_ADDED_SUCCESSFULLY,
                                    wallet: detail.wallet,
                                    wallet_currency_code: detail.wallet_currency_code
    
                                });
                            });
                        } else if (req.body.payment_gateway_type == PAYMENT_GATEWAY.razorpay) {
                            const key_secret = setting_detail.razorpay_secret_key
                            const crypto = require("crypto");
                            const generated_signature = crypto.createHmac("SHA256",key_secret).update(req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id).digest("hex");  
                            let is_signature_valid = generated_signature == req.body.razorpay_signature;
                            if (is_signature_valid) {
                                let total_wallet_amount = utils.addWalletHistory(type, detail.unique_id, detail._id, detail.country_id, detail.wallet_currency_code, detail.wallet_currency_code,
                                    1, (req.body.amount), detail.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Card : razorpay" )
        
                                detail.wallet = total_wallet_amount;
                                utils.paytabs_status_socket(detail._id, true, 1)
                                detail.save().then(() => {
                                    if (req.query?.is_new) {
                                        return res.redirect(req.query?.is_new);
                                    } else {
                                        return res.redirect(setting_detail.payments_base_url + '/success_payment_razor');
                                    }
                                });
                            }else{
                                if (req.query?.is_new) {
                                    utils.payu_status_fail_socket(detail._id)
                                    return res.redirect(req.query?.is_new);
                                } else {
                                    utils.payu_status_fail_socket(detail._id)
                                    return res.redirect(setting_detail.payments_base_url +  '/fail_payment');
                                }
                            }
                        } else if (req.body.payment_gateway_type == PAYMENT_GATEWAY.payu) {

                            let total_wallet_amount = utils.addWalletHistory(type, detail.unique_id, detail._id, detail.country_id, detail.wallet_currency_code, detail.wallet_currency_code,
                                1, (req.body.amount), detail.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Card : Payu", req.body?.mihpayid )
    
                            detail.wallet = total_wallet_amount;
                            detail.save().then(() => {
                                if (req.body.udf4) {
                                    if (req.body.udf4 === "/payments" || req.body.udf4 === "/provider_payments") {
                                        return res.redirect(setting_detail.payments_base_url + "/success_payment_payu");
                                    } else {
                                        return res.redirect(req.body.udf4);
                                    }
                                } else {
                                    return res.json({
                                        success: true,
                                        message: success_messages.MESSAGE_CODE_WALLET_AMOUNT_ADDED_SUCCESSFULLY,
                                        wallet: detail.wallet,
                                        wallet_currency_code: detail.wallet_currency_code
                                    });
                                }
                            });
                        } else if (req.body.payment_gateway_type == PAYMENT_GATEWAY.paytabs){
                            
                            let total_wallet_amount = utils.addWalletHistory(type, detail.unique_id, detail._id, detail.country_id, detail.wallet_currency_code, detail.wallet_currency_code,
                                1, Number(req.body.wallet), detail.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Card : paytabs", req.body.tran_ref)
    
                            detail.wallet = total_wallet_amount;
                            utils.paytabs_status_socket(detail._id, true, 1);
                            detail.save().then(() => {
                                return res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_WALLET_AMOUNT_ADDED_SUCCESSFULLY,
                                    wallet: detail.wallet,
                                    wallet_currency_code: detail.wallet_currency_code
                                });
                            });
                        } else if (req.body.payment_gateway_type == PAYMENT_GATEWAY.paypal) {
                            let total_wallet_amount = utils.addWalletHistory(type, detail.unique_id, detail._id, detail.country_id, detail.wallet_currency_code, detail.wallet_currency_code,
                                1, (req.body.wallet), detail.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Card : " + req.body.last_four ,req.body.tran_ref)
                            detail.wallet = total_wallet_amount;
                            detail.save().then(() => {
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_WALLET_AMOUNT_ADDED_SUCCESSFULLY,
                                    wallet: detail.wallet,
                                    wallet_currency_code: detail.wallet_currency_code
    
                                });
                            });
                        } 
    
                    }
                });
            } else {
                res.json({
                    success: false,
                    error_code: response.error_code,
                    error_message: response.error_message
                });
            }
        } catch (error) {
            console.log(error)
        }
    });
};

exports.change_user_wallet_status = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }, function (err, user) {

                if (user.token != req.body.token) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                } else {
                    let status = req.body.is_use_wallet;
                    user.is_use_wallet = status;
                    user.save().then((user) => {
                        res.json({
                            success: true,
                            message: success_messages.MESSAGE_CODE_CHANGE_WALLET_STATUS_SUCCESSFULLY,
                            is_use_wallet: user.is_use_wallet
                        });
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

exports.set_home_address = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            if (req.body.home_address !== undefined) {
                req.body.home_location = [req.body.home_latitude, req.body.home_longitude]
            }

            if (req.body.work_address !== undefined) {
                req.body.work_location = [req.body.work_latitude, req.body.work_longitude]
            }

            User.findOne({ _id: req.body.user_id }).then((user) => {

                if (!user) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                } else {
                    if (user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        User.findByIdAndUpdate(req.body.user_id, req.body).then(() => {
                            res.json({ success: true, message: success_messages.MESSAGE_CODE_SET_ADDRESS_SUCCESSFULLY });

                        })
                    }
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

exports.get_home_address = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }, {
                token: 1,
                home_address: 1,
                work_address: 1,
                home_location: 1,
                work_location: 1
            }).then((user) => {
                if (!user) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                } else {
                    if (user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {

                        res.json({ success: true, user_address: user });
                    }
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

exports.get_user_privacy_policy = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    res.send(setting_detail.user_privacy_policy)
};

exports.get_user_terms_and_condition = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    res.send(setting_detail.user_terms_and_condition)
};

exports.terms_and_condition = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    res.json({ "success": true, "user_terms_and_condition": setting_detail.user_terms_and_condition, "user_privacy_policy": setting_detail.user_privacy_policy, "provider_terms_and_condition": setting_detail.provider_terms_and_condition, "provider_privacy_policy": setting_detail.provider_privacy_policy ,"user_delete_policy":setting_detail.user_delete_policy,"provider_delete_policy":setting_detail.provider_delete_policy})
};


    
    
exports.get_user_setting_detail = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    let terms_and_condition_url = `${setting_detail.user_panel_url}/legal/user-terms-conditions`
    let privacy_policy_url = `${setting_detail.user_panel_url}/legal/user-privacy-policy`

    let setting_response = {};
    setting_response.terms_and_condition_url = terms_and_condition_url
    setting_response.privacy_policy_url = privacy_policy_url
    setting_response.is_user_social_login = setting_detail.is_user_social_login
    setting_response.is_user_login_using_otp = setting_detail.is_user_login_using_otp
    setting_response.is_allow_multiple_stop = setting_detail.is_allow_multiple_stop;
    setting_response.multiple_stop_count = setting_detail.multiple_stop_count;
    setting_response.web_app_google_key = setting_detail.web_app_google_key
    setting_response.firebase_apiKey = setting_detail.firebase_apiKey
    setting_response.firebase_databaseURL = setting_detail.firebase_databaseURL
    setting_response.firebase_projectId = setting_detail.firebase_projectId
    setting_response.firebase_storageBucket = setting_detail.firebase_storageBucket
    setting_response.firebase_messagingSenderId = setting_detail.firebase_messagingSenderId
    setting_response.is_allow_ride_share = setting_detail.is_allow_ride_share
    setting_response.paypal_client_id = setting_detail.paypal_client_id
    setting_response.paypal_secret_key = setting_detail.paypal_secret_key
    setting_response.paypal_client_id = setting_detail.paypal_client_id
    setting_response.paypal_environment = setting_detail.paypal_environment
    setting_response.webpush_public_key = setting_detail.webpush_public_key
    setting_response.decimal_point_value = setting_detail.decimal_point_value
    setting_response.android_user_app_gcm_key = setting_detail.android_user_app_gcm_key

    setting_response.android_client_app_url = setting_detail.android_client_app_url
    setting_response.ios_client_app_url = setting_detail.ios_client_app_url
    setting_response.is_use_captcha = setting_detail.is_use_captcha;
    setting_response.recaptcha_site_key_for_web = setting_detail.recaptcha_site_key_for_web;
    setting_response.recaptcha_secret_key_for_web = setting_detail.recaptcha_secret_key_for_web;
    setting_response.recaptcha_site_key_for_android = setting_detail.recaptcha_site_key_for_android;
    setting_response.recaptcha_secret_key_for_android = setting_detail.recaptcha_secret_key_for_android;
    setting_response.recaptcha_site_key_for_ios = setting_detail.recaptcha_site_key_for_ios;
    setting_response.recaptcha_secret_key_for_ios = setting_detail.recaptcha_secret_key_for_ios;
    setting_response.location = setting_detail.location

    setting_response.user_panel_google_key = setting_detail.user_panel_google_key;
    setting_response.dispatcher_panel_google_key = setting_detail.dispatcher_panel_google_key;
    setting_response.corporate_panel_google_key = setting_detail.corporate_panel_google_key;
    setting_response.hotel_panel_google_key = setting_detail.hotel_panel_google_key

    setting_response.flutter_user_app_google_places_autocomplete_key = setting_detail.flutter_user_app_google_places_autocomplete_key
    setting_response.flutter_driver_app_google_places_autocomplete_key = setting_detail.flutter_driver_app_google_places_autocomplete_key
    setting_response.driver_panel_url = setting_detail.driver_panel_url
    setting_response.is_banner_visible = setting_detail.is_banner_visible
    setting_response.scheduled_request_pre_booking_days = setting_detail.scheduled_request_pre_booking_days
    
    if (req.body.device_type == 'android') {
        setting_response.admin_phone = setting_detail.admin_phone;
        setting_response.contactUsEmail = setting_detail.contactUsEmail;
        setting_response.android_user_app_google_key = setting_detail.android_user_app_google_key;
        setting_response.android_user_app_version_code = setting_detail.android_user_app_version_code;
        setting_response.android_user_app_force_update = setting_detail.android_user_app_force_update;
        setting_response.is_tip = setting_detail.is_tip;
        setting_response.scheduled_request_pre_start_minute = setting_detail.scheduled_request_pre_start_minute;
        setting_response.stripe_publishable_key = setting_detail.stripe_publishable_key;
        setting_response.userPath = setting_detail.userPath;
        setting_response.userSms = setting_detail.userSms;
        setting_response.is_otp_verification_start_trip = setting_detail.is_otp_verification_start_trip;
        setting_response.userEmailVerification = setting_detail.userEmailVerification;
        setting_response.twilio_call_masking = setting_detail.twilio_call_masking;
        setting_response.is_show_estimation_in_provider_app = setting_detail.is_show_estimation_in_provider_app;
        setting_response.is_show_estimation_in_user_app = setting_detail.is_show_estimation_in_user_app;
        setting_response.android_places_autocomplete_key = setting_detail.android_places_autocomplete_key;
        setting_response.recaptcha_site_key_for_android = setting_detail.recaptcha_site_key_for_android;
        
        setting_response.android_user_app_google_map_key = setting_detail.android_user_app_google_map_key;
        setting_response.android_user_app_google_places_autocomplete_key = setting_detail.android_user_app_google_places_autocomplete_key;
        setting_response.android_user_app_google_geocoding_key = setting_detail.android_user_app_google_geocoding_key;
        setting_response.android_user_app_google_distance_matrix_key = setting_detail.android_user_app_google_distance_matrix_key;
        setting_response.android_user_app_google_direction_matrix_key = setting_detail.android_user_app_google_direction_matrix_key;
 
        
        
    } else {
        setting_response.admin_phone = setting_detail.admin_phone;
        setting_response.contactUsEmail = setting_detail.contactUsEmail;
        setting_response.ios_user_app_google_key = setting_detail.ios_user_app_google_key;
        setting_response.ios_user_app_version_code = setting_detail.ios_user_app_version_code;
        setting_response.ios_user_app_force_update = setting_detail.ios_user_app_force_update;
        setting_response.is_tip = setting_detail.is_tip;
        setting_response.scheduled_request_pre_start_minute = setting_detail.scheduled_request_pre_start_minute;
        setting_response.stripe_publishable_key = setting_detail.stripe_publishable_key;
        setting_response.userPath = setting_detail.userPath;
        setting_response.userSms = setting_detail.userSms;
        setting_response.is_otp_verification_start_trip = setting_detail.is_otp_verification_start_trip;
        setting_response.twilio_call_masking = setting_detail.twilio_call_masking;
        setting_response.is_show_estimation_in_provider_app = setting_detail.is_show_estimation_in_provider_app;
        setting_response.is_show_estimation_in_user_app = setting_detail.is_show_estimation_in_user_app;
        setting_response.ios_places_autocomplete_key = setting_detail.ios_places_autocomplete_key;
        setting_response.userEmailVerification = setting_detail.userEmailVerification;
        setting_response.recaptcha_site_key_for_ios = setting_detail.recaptcha_site_key_for_ios

        setting_response.ios_user_app_google_map_key = setting_detail.ios_user_app_google_map_key;
        setting_response.ios_user_app_google_places_autocomplete_key = setting_detail.ios_user_app_google_places_autocomplete_key;
        setting_response.ios_user_app_google_geocoding_key = setting_detail.ios_user_app_google_geocoding_key;
        setting_response.ios_user_app_google_distance_matrix_key = setting_detail.ios_user_app_google_distance_matrix_key;
        setting_response.ios_user_app_google_direction_matrix_key = setting_detail.ios_user_app_google_direction_matrix_key;
 
    }
       
    setting_response.image_base_url = setting_detail.image_base_url;
    setting_response.minimum_phone_number_length = setting_detail.minimum_phone_number_length;
    setting_response.maximum_phone_number_length = setting_detail.maximum_phone_number_length;
    setting_response.is_split_payment = setting_detail.is_split_payment;
    setting_response.max_split_user = setting_detail.max_split_user;
    setting_response.is_guest_token = setting_detail.is_guest_token;
    setting_response.active_guest_token = setting_detail.active_guest_token;

    let user_id = req.body.user_id;
    if (user_id == '') {
        user_id = null;
    }
    User.findOne({ _id: user_id }).then(async (user_detail) => {
        if (user_detail && user_detail.token !== req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN, setting_detail: setting_response });
        } else {
            let corporate_id = null;
            let response = {};
            if (user_detail) {

                if (req.body.app_version && req.body.app_version != user_detail.app_version) {
                    user_detail.app_version = req.body.app_version
                    user_detail.device_token = req.body.device_type
                    await user_detail.save()
                }

                let alpha2 = country_json.filter((country) => country.name == user_detail.country)
                if (user_detail.corporate_ids && user_detail.corporate_ids.length > 0) {
                    corporate_id = user_detail.corporate_ids[0].corporate_id;
                }

                response.first_name = user_detail.first_name;
                response.last_name = user_detail.last_name;
                response.email = user_detail.email;
                response.country_phone_code = user_detail.country_phone_code;

                let document = await User_Document.find({user_id: user_detail._id, option: 1, is_visible: true, is_uploaded: 0})

                if(document.length > 0) {
                    user_detail.is_document_uploaded = 0
                    await user_detail.save()
                } else { 
                    user_detail.is_document_uploaded = 1
                    await user_detail.save()
                }
                response.is_document_uploaded = user_detail.is_document_uploaded;
                response.address = user_detail.address;
                response.is_approved = user_detail.is_approved;
                response.user_id = user_detail._id;
                response.social_ids = user_detail.social_ids;
                response.social_unique_id = user_detail.social_unique_id;
                response.phone = user_detail.phone;
                response.login_by = user_detail.login_by;
                response.city = user_detail.city;
                response.country = user_detail.country;
                response.referral_code = user_detail.referral_code;
                response.refferal_credit = user_detail.refferal_credit
                response.rate = user_detail.rate;
                response.rate_count = user_detail.rate_count;
                response.is_referral = user_detail.is_referral;
                response.token = user_detail.token;
                response.picture = user_detail.picture;
                response.wallet_currency_code = user_detail.wallet_currency_code;
                response.created_at = user_detail.created_at;
                response.alpha2 = alpha2[0]?.alpha2
                response.is_documents_expired =  user_detail.is_documents_expired 

                if (user_detail.corporate_ids && user_detail.corporate_ids.length > 0) {
                    corporate_id = user_detail.corporate_ids[0].corporate_id;
                }

                Corporate.findOne({ _id: corporate_id }).then(async (corporate_detail) => {

                    if (corporate_detail) {
                        response.corporate_detail = {
                            name: corporate_detail.name,
                            phone: corporate_detail.phone,
                            country_phone_code: corporate_detail.country_phone_code,
                            status: user_detail.corporate_ids[0].status,
                            _id: corporate_detail._id
                        }
                    }

                    Country.findOne({ countryphonecode: user_detail.country_phone_code }).then(async (country) => {
                        if (country) {
                            response.country_detail = { "is_referral": country.is_referral }
                            response.total_redeem_point = user_detail.total_redeem_point
                            response.user_redeem_point_value = country?.user_redeem_settings[0]?.user_redeem_point_value
                            response.user_minimum_point_require_for_withdrawal = country?.user_redeem_settings[0]?.user_minimum_point_require_for_withdrawal
                            setting_response.payment_gateway_type = country.payment_gateways[0]
                            response.is_send_money_for_user = country.is_send_money_for_user ? country.is_send_money_for_user : false
                        } else {
                            response.country_detail = { "is_referral": false }
                        }

                        let pipeline = [
                            { $match: { 'split_payment_users.user_id': user_detail._id } },
                            { $match: { 'is_trip_cancelled': 0 } },
                            {
                                $project: {
                                    trip_id: '$_id',
                                    is_trip_end: 1,
                                    currency: 1,
                                    user_id: 1,
                                    currencycode:1,
                                    split_payment_users: {
                                        $filter: {
                                            input: "$split_payment_users",
                                            as: "item",
                                            cond: { $eq: ["$$item.user_id", user_detail._id] }
                                        }
                                    }
                                }
                            },
                            { $unwind: "$split_payment_users" },
                            {
                                $match: {
                                    $or: [
                                        { 'split_payment_users.status': SPLIT_PAYMENT.WAITING },
                                        {
                                            $and: [
                                                { 'split_payment_users.status': SPLIT_PAYMENT.ACCEPTED },
                                                { 'split_payment_users.payment_status': { $ne: PAYMENT_STATUS.COMPLETED } },
                                                { 'is_trip_end': 1 }
                                            ]
                                        },
                                        {
                                            $and: [
                                                { 'split_payment_users.status': SPLIT_PAYMENT.ACCEPTED },
                                                { 'split_payment_users.payment_status': { $ne: PAYMENT_STATUS.COMPLETED } },
                                                { 'split_payment_users.payment_mode': null }
                                            ]
                                        }
                                    ]
                                }
                            },
                            {
                                $lookup:
                                {
                                    from: "users",
                                    localField: "user_id",
                                    foreignField: "_id",
                                    as: "user_detail"
                                }
                            },
                            { $unwind: "$user_detail" },
                            {
                                $project: {
                                    trip_id: 1,
                                    first_name: '$user_detail.first_name',
                                    last_name: '$user_detail.last_name',
                                    phone: '$user_detail.phone',
                                    country_phone_code: '$user_detail.country_phone_code',
                                    user_id: '$user_detail._id',
                                    is_trip_end: 1,
                                    currency: 1,
                                    status: '$split_payment_users.status',
                                    payment_mode: '$split_payment_users.payment_mode',
                                    payment_status: '$split_payment_users.payment_status',
                                    payment_intent_id: '$split_payment_users.payment_intent_id',
                                    total: '$split_payment_users.total',
                                    currency_code:"$currencycode"
                                }
                            },
                        ]
                        let split_payment_request = await Trip.aggregate(pipeline);
                        if (split_payment_request.length == 0) {
                            split_payment_request = await Trip_history.aggregate(pipeline);
                        }
                        if (user_detail.current_trip_id) {
                            Trip.findOne({ _id: user_detail.current_trip_id }).then((trip_detail) => {
                                Trip_history.findOne({ _id: user_detail.current_trip_id }).then(async (trip_history_detail) => {
                                    if (!trip_detail) {
                                        trip_detail = trip_history_detail;
                                    }
                                    if(!trip_detail){
                                        trip_detail = await OpenRide.findOne({ _id: user_detail.current_trip_id })
                                    }
                                    response.trip_id = user_detail.current_trip_id;
                                    if(trip_detail){
                                        if (trip_detail.openride) {
                                            response.provider_id = trip_detail.provider_id;

                                            const index = trip_detail.user_details.findIndex((user) => user.user_id.toString() == user_detail._id.toString())
                                            if(index != -1) {
                                                response.is_user_invoice_show = trip_detail.user_details[index].is_user_invoice_show;
                                            }
                                        } else {
                                            response.provider_id = trip_detail.current_provider;
                                            response.is_user_invoice_show = trip_detail.is_user_invoice_show;
                                        }
                                        
                                        response.is_provider_accepted = trip_detail.is_provider_accepted;
                                        response.is_provider_status = trip_detail.is_provider_status;
                                        response.is_trip_end = trip_detail.is_trip_end;
                                        response.is_trip_completed = trip_detail.is_trip_completed;
                                    }
                                    res.json({ success: true, setting_detail: setting_response, user_detail: response, split_payment_request: split_payment_request[0] });
                                });
                            });
                        } else {
                            res.json({ success: true, setting_detail: setting_response, user_detail: response, split_payment_request: split_payment_request[0] });
                        }
                    });
                });
            } else {
                res.json({ success: true, setting_detail: setting_response })
            }
        }
    })

}


exports.user_accept_reject_corporate_request = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (!user) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                } else {
                    if (user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        if (req.body.is_accepted) {
                            if (user.corporate_wallet_limit < 0) {
                                let wallet = utils.precisionRoundTwo(Number(user.corporate_wallet_limit));
                                let status = constant_json.DEDUCT_WALLET_AMOUNT
                                let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id, user.country_id, user.wallet_currency_code, user.wallet_currency_code,
                                    1, Math.abs(wallet), user.wallet, status, constant_json.ADDED_BY_ADMIN, "Corporate Wallet Settlement")
                                user.wallet = total_wallet_amount;
                                user.corporate_wallet_limit = 0;
                            }

                            let index = user.corporate_ids.findIndex((x) => x.corporate_id.toString() == req.body.corporate_id.toString());
                            if (index != -1) {
                                user.user_type_id = req.body.corporate_id;
                                user.user_type = Number(constant_json.USER_TYPE_CORPORATE)
                                user.corporate_ids[index].status = Number(constant_json.CORPORATE_REQUEST_ACCEPTED);
                            } else {
                                user.save().then(() => {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_CORPORATE_REQUEST_REVOKED })
                                })
                                return
                            }
                            utils.req_type_id_socket(req.body.corporate_id)
                            user.markModified('corporate_ids');
                            user.save().then(() => {
                                res.json({ success: true, message: success_messages.MESSAGE_CODE_CORPORATE_REQUEST_ACCEPT_SUCCESSFULLY });
                            })
                        } else {
                            let index = user.corporate_ids.findIndex((x) => x.corporate_id == req.body.corporate_id);
                            if (index != -1) {
                                user.corporate_ids.splice(index, 1);
                            } else {
                                user.save().then(() => {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_CORPORATE_REQUEST_REVOKED })
                                })
                                return
                            }
                            utils.req_type_id_socket(req.body.corporate_id)
                            user.markModified('corporate_ids');
                            user.save().then(() => {
                                res.json({ success: true, message: success_messages.MESSAGE_CODE_CORPORATE_REQUEST_REJECT_SUCCESSFULLY });
                            })
                        }
                    }
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
}

exports.add_favourite_driver = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {

                    user.favourite_providers.push(req.body.provider_id);
                    user.save(() => {
                        res.json({ success: true, message: success_messages.MESSAGE_CODE_ADD_FAVOURITE_DRIVER_SUCCESSFULLY });
                    }, () => {

                    });
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                }
            });
        }
    });
}

exports.get_favourite_driver = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {

                    let condition = { $match: { _id: { $in: user.favourite_providers } } }
                    let project = {
                        $project: {
                            first_name: 1,
                            last_name: 1,
                            picture: 1
                        }
                    }
                    Provider.aggregate([condition, project], function (error, provider_list) {
                        if (error) {
                            res.json({ success: true, provider_list: [] });
                        } else {
                            res.json({ success: true, provider_list: provider_list });
                        }
                    })

                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                }
            });
        }
    });
}

exports.remove_favourite_driver = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then(async (user) => {
                if (user) {

                    let index = user.favourite_providers.findIndex((x) => (x).toString() == req.body.provider_id);
                    if (index !== -1) {
                        user.favourite_providers.splice(index, 1);
                    }
                    if(user.current_trip_id != null) {
                        const trip = await Trip.findOne({ _id: user.current_trip_id})
                        console.log(trip.provider_id);

                        // console.log((req.body.provider_id).equals(trip.provider_id))

                        if((trip.provider_id).toString() == req.body.provider_id) {
                            await Trip.findOneAndUpdate({ _id: trip._id}, {is_favourite_provider: false}, { new: true})
                        }
                    }
                    user.save(() => {
                        res.json({ success: true, message: success_messages.MESSAGE_CODE_REMOVE_FAVOURITE_DRIVER_SUCCESSFULLY });
                    }, () => {

                    });

                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                }
            });
        }
    });
}

exports.get_all_driver_list = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let provider_list = await Provider
            .find({
                is_approved: 1,
                country_phone_code: user.country_phone_code,
                _id: { $nin: user.favourite_providers },
                $or: [
                    { email: req.body.search_value },
                    { phone: req.body.search_value }
                ]
            })
            .select({
                first_name: 1,
                last_name: 1,
                picture: 1
            })
            .lean();

        res.json({ success: true, provider_list: provider_list });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.search_user_for_split_payment = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'search_user', type: 'string' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        if (!req.body.search_user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        let trip_detail = await Trip.findOne({ _id: user.current_trip_id }, { split_payment_users: 1 });
        if (!trip_detail) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });
        }

        let phones = [];
        let emails = [];
        trip_detail.split_payment_users.forEach((split_payment_user_detail) => {
            phones.push(split_payment_user_detail.phone);
            emails.push(split_payment_user_detail.email);
        })

        let search_user_detail = await User
            .findOne({
                _id: { $ne: req.body.user_id },
                phone: { $nin: phones },
                email: { $nin: emails },
                country_phone_code: user.country_phone_code,
                $or: [
                    { phone: req.body.search_user },
                    { email: req.body.search_user }
                ]
            })
            .select({
                first_name: 1,
                last_name: 1,
                email: 1,
                phone: 1,
                country_phone_code: 1,
                picture: 1,
                wallet: 1
            });

        if (!search_user_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_FOUND });
            return;
        }

        res.json({ success: true, search_user_detail: search_user_detail });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.send_split_payment_request = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'split_request_user_id', type: 'string' },
            { name: 'trip_id', type: 'string' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let search_user_detail = await User
            .findOne({
                country_phone_code: user.country_phone_code,
                _id: req.body.split_request_user_id
            })
            .select({
                unique_id: 1,
                first_name: 1,
                split_payment_requests: 1,
                last_name: 1,
                email: 1,
                phone: 1,
                device_token: 1,
                device_type: 1,
                country_phone_code: 1,
                picture: 1,
                wallet: 1
            });

        if (!search_user_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
            return;
        }

        if (search_user_detail.wallet < 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INSUFFICIENT_WALLET_AMOUNT })
            return
        }

        let detail = {
            user_id: req.body.split_request_user_id,
            first_name: search_user_detail.first_name,
            last_name: search_user_detail.last_name,
            phone: search_user_detail.phone,
            country_phone_code: search_user_detail.country_phone_code,
            email: search_user_detail.email,
            picture: search_user_detail.picture,
            payment_intent_id: "",
            status: 0,
            payment_mode: null,
            payment_status: 0,
            total: 0,
            remaining_payment: 0,
            cash_payment: 0,
            card_payment: 0,
            wallet_payment: 0,
            unique_id : search_user_detail.unique_id,
        }
        let trip_detail = await Trip.findOneAndUpdate({ _id: user.current_trip_id, 'split_payment_users.user_id': search_user_detail._id },
            { 'split_payment_users.$.status': 0 });
        if (!trip_detail) {
            trip_detail = await Trip.findOneAndUpdate({ _id: user.current_trip_id }, { '$push': { 'split_payment_users': detail } });
        }

        if (!trip_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });
            return;
        }

        let split_payment_request = {
            "_id": trip_detail._id,
            "is_trip_end": 0,
            "trip_id": trip_detail._id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "country_phone_code": user.country_phone_code,
            "user_id": user._id,
            "status": 0,
            "payment_mode": null,
            "payment_status": 0,
            "payment_intent_id": "",
            "total": 0
        }
        utils.update_request_status_socket(trip_detail._id);
        utils.sendPushNotification(search_user_detail.device_type, search_user_detail.device_token, push_messages.PUSH_CODE_FOR_SPLIT_PAYMENT_REQUEST, split_payment_request, null, search_user_detail.lang_code);
        utils.req_type_id_socket(req.body.split_request_user_id)
        res.json({ success: true, message: success_messages.MESSAGE_CODE_ADD_SPLIT_REQUEST_SEND_SUCCESSFULLY });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.accept_or_reject_split_payment_request = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' },
            { name: 'status', type: 'number' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        if (!(req.body.status == SPLIT_PAYMENT.ACCEPTED || req.body.status == SPLIT_PAYMENT.REJECTED)) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        let trip_detail = await Trip.findOneAndUpdate({ _id: req.body.trip_id, 'split_payment_users.user_id': user._id },
            { 'split_payment_users.$.status': req.body.status });

        if (!trip_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });
            return;
        }

        let trip_user = await User.findOne({ _id: trip_detail.user_id })
        if (trip_user) {
            if (req.body.status == SPLIT_PAYMENT.ACCEPTED) {
                utils.sendPushNotification(trip_user.device_type, trip_user.device_token, push_messages.PUSH_CODE_FOR_ACCEPT_SPLIT_PAYMENT_REQUEST, "", trip_user.webpush_config, trip_user.lang_code);
            } else {
                utils.sendPushNotification(trip_user.device_type, trip_user.device_token, push_messages.PUSH_CODE_FOR_REJECT_SPLIT_PAYMENT_REQUEST, "", trip_user.webpush_config, trip_user.lang_code);
            }
        }
        utils.update_request_status_socket(trip_detail._id);

        if (req.body.status == SPLIT_PAYMENT.ACCEPTED) {
            res.json({ success: true, message: success_messages.MESSAGE_CODE_ADD_SPLIT_REQUEST_ACCEPTED_SUCCESSFULLY });
            return;
        }

        res.json({ success: true, message: success_messages.MESSAGE_CODE_ADD_SPLIT_REQUEST_REJECTED_SUCCESSFULLY });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.remove_split_payment_request = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'split_request_user_id', type: 'string' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let trip_detail = await Trip.findOneAndUpdate({ _id: user.current_trip_id, 'split_payment_users.user_id': req.body.split_request_user_id },
            { $pull: { split_payment_users: { user_id: req.body.split_request_user_id } } });

        if (!trip_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });
            return;
        }

        let split_request_user = await User.findOne({ _id: req.body.split_request_user_id })
        if (split_request_user) {
            utils.sendPushNotification(split_request_user.device_type, split_request_user.device_token, push_messages.PUSH_CODE_FOR_REMOVE_SPLIT_PAYMENT_REQUEST, "", split_request_user.webpush_config, split_request_user.lang_code);
        }
        utils.update_request_status_socket(trip_detail._id);
        utils.reject_split_request_socket( req.body.split_request_user_id)
        res.json({ success: true, message: success_messages.MESSAGE_CODE_ADD_SPLIT_REQUEST_CANCELLED_SUCCESSFULLY });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.update_split_payment_payment_mode = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'payment_mode', type: 'number' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        if (req.body.payment_mode == Number(constant_json.PAYMENT_MODE_CARD)) {
            let trip = await Trip.findOne({ _id: req.body.trip_id });
            if (!trip) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });
                return;
            }
            if((trip.payment_gateway_type !== PAYMENT_GATEWAY.payu) && (trip.payment_gateway_type !== PAYMENT_GATEWAY.paypal) && (trip.payment_gateway_type !== PAYMENT_GATEWAY.razorpay)){
                let card_detail = await Card.findOne({ user_id: req.body.user_id, payment_gateway_type: trip.payment_gateway_type });
            if (!card_detail) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
                return;
            }
            }
            
        }
        let trip_detail = await Trip.findOneAndUpdate({ _id: req.body.trip_id, 'split_payment_users.user_id': user._id },
            { 'split_payment_users.$.payment_mode': req.body.payment_mode });

        if (!trip_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });
            return;
        }
        res.json({ success: true, message: success_messages.MESSAGE_CODE_ADD_SPLIT_REQUEST_PAYMENT_MODE_SET_SUCCESSFULLY });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.delete_user = async function (req, res) {

    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, { name: 'token', type: 'string' }], async function (response) {
        if (response.success) {
            let user = await User.findOne({ _id: req.body.user_id })
            if (user) {
                if (user.wallet < 0) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING })
                    return
                }

                if (req.body.token != null && user.token != req.body.token) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    return
                } else {
                    let password = utils.encryptPassword(req.body.password ? req.body.password : '');
                    let social_index = user.social_ids.indexOf(req.body.social_id);

                    if (social_index !== -1 || user.password == password) {
                        if (user.current_trip_id != null) {
                            let message = error_message.ERROR_CODE_TRIP_RUNNING
                            return res.json({ success: false, error_code: message })
                        }
                        let ride_details = await OpenRide.countDocuments({
                            $and: [
                                {
                                    user_details: {
                                        $elemMatch: { 
                                            user_id: user._id,
                                            booking_cancelled : 0,
                                            booking_cancelled_by_user : 0,
                                            booking_cancelled_by_provider : 0,
                                         }
                                    }
                                },
                                {is_trip_end: 0},
                                {is_trip_completed: 0},
                                {is_trip_cancelled: 0}
                            ]
                           
                        })
                        console.log(ride_details)
                        if (ride_details > 0) {
                            let message = error_message.ERROR_CODE_PLEASE_DELETE_YOUR_FUTURE_RIDE_FIRST
                            return res.json({ success: false, error_code: message })
                        }
                        let user_detail = await User.findOne({ phone: '0000000000' });
                        if (!user_detail) {
                            user_detail = new User({
                                _id: Schema('000000000000000000000000'),
                                first_name: 'anonymous',
                                last_name: 'user',
                                email: 'anonymoususer@gmail.com',
                                phone: '0000000000',
                                country_phone_code: '',
                            })
                            await user_detail.save();
                        }
                        await Admin_notification.deleteOne({user_id : user._id });
                        await Trip_history.updateMany({ user_id: user._id }, { user_id: user_detail._id });
                        await Trip.deleteMany({ is_schedule_trip: true, user_id: user._id })
                        await OpenRide.updateMany({ 'user_details.user_id': user._id },{ $set: { 'user_details.$.user_id': user_detail._id } });
                        await Wallet_history.updateMany({ user_id: user._id }, { user_id: user_detail._id });
                        await Card.deleteMany({ user_id: user._id });
                        await User_Document.deleteMany({ user_id: user._id });
                        await User.deleteOne({ _id: user._id });
                        await User.updateMany({referred_by:req.body.user_id},{referred_by:user_detail._id})
                        await Redeem_point_history.updateMany(
                            { user_id: user._id },
                            { user_id: user_detail._id }
                        )
                        utils.delete_firebase_user(user.uid);

                        res.json({
                            success: true,
                            message: success_messages.MESSAGE_CODE_DELETE_SUCCESSFULLY
                        });

                    } else {
                        res.json({
                            success: false,
                            error_code: error_message.ERROR_CODE_YOUR_PASSWORD_IS_NOT_MATCH_WITH_OLD_PASSWORD
                        });
                    }

                }
            } else {
                res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
        } else {
            res.json(response);
        }
    });
}
exports.withdraw_redeem_point_to_wallet = async (req, res) => {
    try {
        utils.check_request_params(req.body,[{ name: 'user_id', type: 'string' },{ name: 'token', type: 'string' },{ name: 'redeem_point', type: 'number' },],async function (response) {
                if (response.success) {
                    let type = Number(req.body.type)
                    let Table = '';
                    switch (type) {
                        case Number(constant_json.USER_UNIQUE_NUMBER):
                            type = Number(constant_json.USER_UNIQUE_NUMBER)
                            Table = User;
                            break;
                        case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                            type = Number(constant_json.PROVIDER_UNIQUE_NUMBER)
                            Table = Provider;
                            break;
                        case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                            type = Number(constant_json.PARTNER_UNIQUE_NUMBER)
                            Table = Partner;
                            break;
                    }
                    let user = await Table.findById(req.body.user_id)
                    if (!user) {
                        res.json({success: false,error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND})
                        return
                    }
                    let country = ''
                        if(type == Number(constant_json.USER_UNIQUE_NUMBER)){
                            country = await Country.findOne({countryname : user?.country})
                        }else{
                            country = await Country.findById(user?.country_id)
                        }
                        if(!country){
                            res.json({success: false, error_code: error_message.ERROR_CODE_NO_COUNTRY_FOUND});
                        }

                    if (req.body.token !== null && user.token !== req.body.token) {
                        res.json({success: false,error_code: error_message.ERROR_CODE_INVALID_TOKEN})
                        return
                    } else {
                        if ((req.body.type == Number(constant_json.PROVIDER_UNIQUE_NUMBER) && Number(req.body.redeem_point) < country?.driver_redeem_settings[0]?.driver_minimum_point_require_for_withdrawal)||(req.body.type == Number(constant_json.USER_UNIQUE_NUMBER) && Number(req.body.redeem_point) < country?.user_redeem_settings[0]?.user_minimum_point_require_for_withdrawal)|| (req.body.type == Number(constant_json.PARTNER_UNIQUE_NUMBER) && Number(req.body.redeem_point) < country?.driver_redeem_settings[0]?.driver_minimum_point_require_for_withdrawal) ||(user.total_redeem_point < Number(req.body.redeem_point))) {

                        res.json({success: false,error_code: error_message.ERROR_CODE_INSUFFICIENT_REDEEM_POINT})
                        return
                        }
                        else {
                            // user.total_redeem_point -= Number(req.body.redeem_point)
                            if (
                                req.body.type == Number(constant_json.PROVIDER_UNIQUE_NUMBER)
                            ) {
                                utils.addWalletHistory(
                                    constant_json.PROVIDER_UNIQUE_NUMBER,
                                    user.unique_id,
                                    user._id,
                                    country._id,
                                    user.wallet_currency_code,
                                    user.wallet_currency_code,
                                    1,
                                    Number(req.body.redeem_point) * country?.driver_redeem_settings[0]?.driver_redeem_point_value,
                                    user.wallet,
                                    constant_json.ADD_WALLET_AMOUNT,
                                    constant_json.ADDED_BY_REDEEM_WITHDRAWAL,
                                    'Withdrawal Redeem Points'
                                    )
                                user.wallet += Number(req.body.redeem_point) * country?.driver_redeem_settings[0]?.driver_redeem_point_value;
                                    
                                let total_point = utils.add_redeem_point_history(constant_json.PROVIDER_UNIQUE_NUMBER, user.unique_id, user._id,country._id,constant_json.REVIEW_REDEEM_POINT,user.wallet_currency_code,'Redeem point Withdrawals',Number(req.body.redeem_point), user?.total_redeem_point,constant_json.DEDUCT_REDEEM_POINT)
                                user.total_redeem_point = total_point
                            } else if(req.body.type == Number(constant_json.PARTNER_UNIQUE_NUMBER)) {
                                utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER,user.unique_id,user._id,country._id,user.wallet_currency_code,user.wallet_currency_code,1,Number(req.body.redeem_point) * country?.driver_redeem_settings[0]?.driver_redeem_point_value,user.wallet,constant_json.ADD_WALLET_AMOUNT,constant_json.ADDED_BY_REDEEM_WITHDRAWAL,'Withdrawal Redeem Points')
                                user.wallet += Number(req.body.redeem_point) * country?.driver_redeem_settings[0]?.driver_redeem_point_value;
                                
                                let total_point = utils.add_redeem_point_history(constant_json.PARTNER_UNIQUE_NUMBER, user.unique_id, user._id,country._id,constant_json.REVIEW_REDEEM_POINT,user.wallet_currency_code,'Redeem point Withdrawals',Number(req.body.redeem_point), user?.total_redeem_point,constant_json.DEDUCT_REDEEM_POINT)
                                user.total_redeem_point = total_point
                            } else {
                                utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER,user.unique_id,user._id,country._id,user.wallet_currency_code,user.wallet_currency_code,1,Number(req.body.redeem_point) * country?.user_redeem_settings[0]?.user_redeem_point_value,user.wallet,constant_json.ADD_WALLET_AMOUNT,constant_json.ADDED_BY_REDEEM_WITHDRAWAL,'Withdrawal Redeem Points')
                                user.wallet += Number(req.body.redeem_point) * country?.user_redeem_settings[0]?.user_redeem_point_value;

                                let total_point = utils.add_redeem_point_history(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id,country._id,constant_json.REVIEW_REDEEM_POINT,user.wallet_currency_code,'Redeem point Withdrawals',Number(req.body.redeem_point), user?.total_redeem_point,constant_json.DEDUCT_REDEEM_POINT)
                                user.total_redeem_point = total_point
                            }

                            await user.save()
                            res.json({success: true,message:success_messages.MESSAGE_CODE_REDEEM_POINT_WITHDRAWAL_SUCCESSFULLY,total_redeem_point:user.total_redeem_point})
                        }
                    }
                } else {
                    res.json({success: false,error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG})
                }
            }
        )
    } catch (error) {
        utils.error_response(error, req, res)
    }
};
exports.update_webpush_config = async (req, res) => {
    try {
        let params_array = [{ name: "user_id", type: "string" }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if(!response.success){
            return res.json(response)
        }
        let table = User;
        if(req.body.type == 1){
            table = Provider
        }
        let user = await table.findOne({ _id: req.body.user_id })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND })
        }
        await table.findOneAndUpdate({_id:req.body.user_id},{webpush_config:req.body.webpush_config})
        res.json({success:true})
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.search_user_to_send_money = async (req, res) => {
    try {
        let params_array = [{ name: "user_id", type: "string" }, { name: "type", type: "number" }, { name: "phone", type: "string" }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if(!response.success){
            return res.json(response)
        }
        let Table;
        switch (req.body.type) {
            case 1:
                Table = User
                break;
            case 2:
                Table = Provider
                break;
            default:
                Table = User
                break;
        }
        let user = await Table.findOne({ _id: req.body.user_id })
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND })
        }
        const search_user = await Table.findOne({ _id: {$ne: req.body.user_id}, phone: req.body.phone, wallet_currency_code: user.wallet_currency_code })
        if (!search_user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND })
        }
        if (req.body.type == 2 && search_user.provider_type_id && search_user.provider_type == PROVIDER_TYPE.PARTNER) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_IT_IS_PARTNER_PROVIDER_PLEASE_CONTACT_PARTNER_FIRST })
        }
        res.json({success:true, user_detail: { first_name: search_user.first_name, last_name: search_user.last_name, phone: search_user.phone, country_phone_code: search_user.country_phone_code, picture: search_user.picture, email: search_user.email, _id: search_user._id }})
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.send_money_to_friend = async (req, res) => {
    try {
        let params_array = [{ name: "user_id", type: "string" }, { name: "type", type: "number" }, { name: "friend_id", type: "string" }, { name: "amount", type: "number" }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if(!response.success){
            return res.json(response)
        }
        let Table = User;
        let uniuqe_value = constant_json.USER_UNIQUE_NUMBER
        if(req.body.type == 2){
            Table = Provider
            uniuqe_value = constant_json.PROVIDER_UNIQUE_NUMBER
        }
        let user = await Table.findOne({ _id: req.body.user_id })
        if (!user) return res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND })
        
        let friend_user = await Table.findOne({ _id: req.body.friend_id })

        if(req.body.amount > user.wallet) return res.json({ success: false, error_code: error_message.ERROR_CODE_INSUFFICIENT_WALLET_AMOUNT })

        let total_wallet_amount_of_user = utils.addWalletHistory(uniuqe_value, user.unique_id, user._id, user.country_id, user.wallet_currency_code, user.wallet_currency_code, 1, Math.abs(req.body.amount), user.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.SEND_TO_FRIEND, `Send to ${friend_user.first_name} ${friend_user.last_name}`)
        user.wallet = total_wallet_amount_of_user

        let total_wallet_amount_of_friend = utils.addWalletHistory(uniuqe_value, friend_user.unique_id, friend_user._id, friend_user.country_id, friend_user.wallet_currency_code, friend_user.wallet_currency_code, 1, Math.abs(req.body.amount), friend_user.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_FRIEND, `Added by ${user.first_name} ${user.last_name}`)
        friend_user.wallet = total_wallet_amount_of_friend

        await friend_user.save()
        await user.save()
        res.json({success:true, message: success_messages.MESSAGE_CODE_MONEY_SEND_SUCCESSFULLY})
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_server_time = function (req, res) {
    let server_date = new Date();
    res.json({server_date: server_date})
};

exports.get_fare_estimate_all_type = function (req, res, next){
    let currentCityLatLong = [req.body.pickup_latitude, req.body.pickup_longitude];
    let server_time = new Date();
	City.find({isBusiness: constant_json.YES}).then((cityList) => { 
        let size = cityList.length;
        let count = 0;
        if (size == 0) {
            return res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY});
        } else {
            let finalCityId = null;
            let finalCityDetail = null;
            let finalDistance = 1000000;
            let city_unit = null;
            cityList.forEach(function (city_detail) {
                count++;
                let cityLatLong = city_detail.cityLatLong;
                let distanceFromSubAdminCity = utils.getDistanceFromTwoLocation(currentCityLatLong, cityLatLong);
                let cityRadius = city_detail.cityRadius;

                if (!city_detail.is_use_city_boundary) {
                    if (distanceFromSubAdminCity < cityRadius) {
                        if (distanceFromSubAdminCity < finalDistance) {
                            finalCityDetail = city_detail;
                            finalDistance = distanceFromSubAdminCity;
                            finalCityId = city_detail._id;
                            city_unit = city_detail.unit;
                        }
                    }
                } else {
                    let city_zone = geolib.isPointInside(
                        {
                            latitude: Number(req.body.pickup_latitude),
                            longitude: Number(req.body.pickup_longitude)
                        },
                        city_detail.city_locations);
                    if (city_zone) {
                        if (distanceFromSubAdminCity < finalDistance) {
                            finalDistance = distanceFromSubAdminCity;
                            finalCityDetail = city_detail;

                            finalCityId = city_detail._id;
                            city_unit = city_detail.unit;
                        }
                    }
                }
                if (count == size) {
                    if (finalCityId != null) {
                        let city_id = finalCityId;
                        let time = req.body.time;
                        let timeMinutes;
                        timeMinutes = time * 0.0166667;

                        let distance = req.body.distance;
                        let distanceKmMile = distance;
                        if (city_unit == 1) {
                            distanceKmMile = distance * 0.001;
                        } else {
                            distanceKmMile = distance * 0.000621371;
                        }

                        let lookup = {
                            $lookup:
                                {
                                    from: "types",
                                    localField: "typeid",
                                    foreignField: "_id",
                                    as: "type_detail"
                                }
                        };
                        let unwind = {$unwind: "$type_detail"};
                        let condition = { $match: {
                            $and : [
                                {'cityid': {$eq: Schema(city_id)}},
                                {'is_business': {$eq: 1}},
                                {$or : [  { 'is_ride_share': { $eq: null }} , { 'is_ride_share': { $ne: 1 }}]}
                            ]}
                          }
						Citytype.aggregate([condition, lookup, unwind]).then((city_type_list) => { 
							if(city_type_list.length == 0){
                                res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY});
							} else {
								let array = [];
                                let count = 0;
                                city_type_list.forEach(function (citytype) {
                                    count++;
                                    let base_distance = citytype.base_price_distance;
                                    let base_price = citytype.base_price;
                                    let price_per_unit_distance1 = citytype.price_per_unit_distance;
                                    let price_for_total_time1 = citytype.price_for_total_time;
                                    let tax = citytype.tax;
                                    let min_fare = citytype.min_fare;
                                    let surge_multiplier = citytype.surge_multiplier;
                                    let user_tax = citytype.user_tax;
                                    let user_miscellaneous_fee = citytype.user_miscellaneous_fee;
                                    let price_per_unit_distance;
                                    if (distanceKmMile <= base_distance) {
                                        price_per_unit_distance = 0;
                                    } else {
                                        price_per_unit_distance = (price_per_unit_distance1 * (distanceKmMile - base_distance)).toFixed(2);
                                    }

                                    let price_for_total_time = Number(price_for_total_time1 * timeMinutes);
                                    let total = 0;
                                    total = +base_price + +price_per_unit_distance + +price_for_total_time;
                                    // tax cal
                                    total = total + total * 0.01 * tax;
                                    try {
                                        if (Number(body.is_surge_hours) == 1) {
                                            total = total * surge_multiplier;
                                        }
                                    } catch (error) {

                                    }
                                    let is_min_fare_used = 0;
                                    let user_tax_fee = Number((user_tax * 0.01 * total).toFixed(2));

                                    total =total + user_tax_fee + user_miscellaneous_fee;
                                    if (total < min_fare) {
                                        total = min_fare;
                                        is_min_fare_used = 1;
                                    }
                                    let estimated_fare = Math.ceil(total);
                                    array.push({ _id: citytype._id, is_ride_share: citytype.is_ride_share, cancellation_fee: citytype.cancellation_fee, min_fare: min_fare, name: citytype.type_detail.typename, user_tax_fee: user_tax_fee, user_miscellaneous_fee: user_miscellaneous_fee, message: success_messages.MESSAGE_CODE_YOU_GET_FARE_ESTIMATE, time: timeMinutes, distance: (distanceKmMile).toFixed(2), is_min_fare_used: is_min_fare_used, base_price: base_price, price_per_unit_distance: price_per_unit_distance, price_per_unit_time: price_for_total_time, estimated_fare: estimated_fare });

                                	if(count == city_type_list.length){
                                        Country.findOne({countryname: city_type_list[0].countryname}, function(error, country){
                                            res.json({
                                                success: true,
                                                type_list: array,
                                                currencysign: country.currencysign,
                                                city_detail: finalCityDetail,
                                                country_detail: country,
                                                server_time: server_time
                                            });
                                        })
									}
                                })
							}
                        }, (err) => {
                                    utils.error_response(err, req, res)
                        })
                    } else {
                        res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY});
					}
                }
            });
        }
	});

}

exports.get_nearby_provider = async function (req, res) {
    const setting_detail = await Settings.findOne({});


    let default_Search_radious = setting_detail.default_Search_radious;
    let distance = default_Search_radious / constant_json.DEGREE_TO_KM;
    let accessibility = req.body.accessibility;
    let accessibility_query = {};
    if (accessibility != undefined && accessibility.length > 0) {
        accessibility_query = {
            $and: [{
                "vehicle_detail.accessibility": {
                    $exists: true,
                    $ne: [],
                    $all: accessibility
                }
            }]
        };
    }
    

    const service_type = await Citytype.findById(req.body.service_type_id);
    const type_id = service_type.typeid;
    const country_id = service_type.countryid;



    Provider.find({
        'providerLocation': {
            $near: [
            req.body.latitude,
            req.body.longitude
            ],
            $maxDistance: distance

        }, "is_active": 1, "is_available": 1,
        $or: [
        {
            $and: [
            {"provider_type": Number(constant_json.PROVIDER_TYPE_NORMAL)},
            {"is_approved": 1}]
        },
        {
            $and: [
            {"provider_type": Number(constant_json.PROVIDER_TYPE_PARTNER)},
            {"is_approved": 1},
            {"is_partner_approved_by_admin": 1}
            ]
        }
        ],
        is_trip: [],
        country_id : country_id,
        admintypeid : type_id,

        // service_type: req.body.service_type_id,
        accessibility_query
    }).exec().then((providers) => { 
        if (providers.length == 0) {
            res.json({
                success: false,
                error_code: error_message.ERROR_CODE_NO_PROVIDER_FOUND_SELECTED_SERVICE_TYPE_AROUND_YOU
            });
        } else {
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOU_GET_NEARBY_DRIVER_LIST, providers: providers
            });
        }
    });
    
}

exports.generate_user_history_export_excel = function (req, res) {
    if(req.body.user_id){
        req.session.user = {_id:req.body.user_id}
    }

    if (typeof req.session.user != 'undefined') {

        let search_item = 'unique_id';
        let search_value = '';
        let sort_order = -1;
        let sort_field = 'unique_id';
        let start_date;
        let end_date;
        let value;
        if (req.body.search_item) {
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


        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        let search;
        if (search_item == "unique_id") {
            if (value != "") {
                value = Number(value)
                query1[search_item] = { $eq: value };
                search = { "$match": query1 };
            } else {
                search = { $match: {} };
            }

        } else if (search_item == "provider_detail.first_name") {
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


        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);


        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;
        let condition = { $match: { 'user_id': { $eq: Schema(req.session.user._id) } } };
        Trip_history.aggregate([condition, lookup, unwind, lookup1, search, filter, sort]).then((array) => {

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
            ws.cell(1, col++).string(title.date);
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
                        ws.cell(index + 2, col++).string(title.title_trip_status_completed );
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
                    wb.write('data/xlsheet/' + time + '_user_history.xlsx', function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_user_history.xlsx";
                            res.json(url);
                            setTimeout(function () {
                                fs.unlink('data/xlsheet/' + time + '_user_history.xlsx', function () {
                                });
                            }, 10000)
                        }
                    });
                }
            });
        }, (err) => {
            utils.error_response(err, req, res)
        });

    } else {
        res.redirect('/login');
    }
};

exports.userReviews = async function (req, res) {
    let condition = {$match : { $and : [ {'userReview' : {$ne :''}}, {'userReview' : {$exists: true}}]}}
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
    let limit = {$limit : 5};
    let userReviews = await Reviews.aggregate([condition,lookup,unwind,limit])
    return res.json({ success: true, userReviews })
}

exports.fetch_mass_notification_for_user = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});
        let response = await utils.check_request_params_async(req.body, [{name: 'user_id', type: 'string'}, {name: 'device_type', type: 'string'}, {name: 'user_type', type: 'number'}])
        if (!response.success) {
            res.json(response)
            return;
        }
        const type = Number(req.body.user_type)
        let Table
        const device_type = req.body.device_type
        switch (type) {
            case TYPE_VALUE.USER:
                Table = User;
                break;
            case TYPE_VALUE.PROVIDER:
                Table = Provider;
                break;
            default:
                Table = User;
                break;
        }
        const user = await Table.findOne({ _id: req.body.user_id})
        if(!user) return res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND})
        const notifications = await MassNotification.aggregate([
            {
                $lookup: {
                    from: 'countries',
                    localField: 'country',
                    foreignField: '_id',
                    as: 'country_detail'
                }
            },
            {
                $unwind: {
                    path: '$country_detail',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                   $and: [ {user_type: type},
                    {created_at: { $gte: user.created_at}},
                    {$or: [{ device_type: device_type}, {device_type: 'both'}, {device_type: 'all'}]},
                    {$or: [{ $and: [{ user_type: 1}, { $or:[{ 'country_detail.countryname': user.country }, { 'country_detail.countryname': null }] }] },{ $and: [{ user_type: 2 }, { $or: [{ country: user.country_id }, { country: null }] }] }]}
                ]
                }
            },
            {
                $project: {
                    country_detail :0
                }
            },
            {
                $sort: { unique_id: -1}
            }
        ])

        let timezone = setting_detail.timezone_for_display_date;
        
        return res.json({ success: true, notifications, timezone})
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.user_social_login_web = function (req, res) {
    User.findOne({ social_unique_id: req.body.social_unique_id }).then((user) => {
 
        if (user) {
            let token = utils.tokenGenerator(32);
            user.token = token;
 
            let device_token = "";
            let device_type = "";
            if (user.device_token != "" && user.device_token != req.body.device_token) {
                device_token = user.device_token;
                device_type = user.device_type;
            }
 
 
            user.device_type = req.body.device_type;
            user.login_by = req.body.login_by;
            user.device_token = req.body.device_token
 
            if(req.body.device_type == "web" && req.body.webpush_config && Object.keys(req.body.webpush_config).length > 0){
                user.webpush_config = JSON.parse(req.body.webpush_config)
            }
 
            user.save().then(() => {
 
                if (device_token != "") {
                    utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_USER_LOGIN_IN_OTHER_DEVICE, "", null, user.lang_code);
                }
                req.session.user = user;
 
                Trip.findOne({ user_id: user._id, is_trip_cancelled: 0, is_trip_completed: 0 }).then((trip) => {
 
                    if (trip) {
                        res.json({ success: true, url: 'history',user_detail:user});
                    } else {
                        res.json({ success: true, url: 'create_trip',user_detail:user});
                    }
                });
 
            }, (err) => {
                utils.error_response(err, res)
            });
        } else {
            res.json({ success: false })
        }
    })
}

exports.change_user_language = async function (req, res) {
    try {
        
        let type = Number(req.body.type);
        let Type;
        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                break;
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                break;
            default:
                Type = User
                break;
        }

        let detail = await Type.findOne({_id: req.body.id});
        if(detail){
            detail.lang_code = req.body.lang_code;
            await detail.save();
        }

        return res.json({ success: true })
        
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

//rent car
exports.user_get_car_rent_setting_detail = async function (req, res) {
    try{
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response)
       
        let setting_details = {};
        setting_details.cancellation_reason = [
            "Price Too High", "Change In Time", "Vehicle Under Maintance",
        ]
        
        return res.json({ success: true, setting_details });
       
    } catch(error) {
        utils.error_response(error, req, res);
    }
}

exports.get_available_rent_vehicle = async function (req, res) {
    
    try {
        let params_array = [
            { name: "latitude", type: "string" }, 
            { name: "longitude", type: "string" }
        ];
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success) return res.json(response);

        let user;
        if(req.body.user_id && req.body.user_id != ''){
            user = await User.findOne({ _id: req.body.user_id });
            if (!user) return res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
    
            if (req.body.token != null && user.token !== req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
        }

        let address_data = await utils.getAddressDataFromLatLng( req.body.latitude, req.body.longitude );
        
        if(!address_data.success){
            return res.json({ success: true, vehicle_list: [] })
        }

        let country = await Country.findOne({$and: [{$and: [{countryname: { $regex:  new RegExp(`\\b${address_data.country_name}\\b`, 'i')  }}, { alpha2: {$exists: true, $eq: address_data.country_code}}]}]});

        if(!country){
            return res.json({ success: true, vehicle_list: [] });
        }

        if(country.isRentalBusiness != 1){
            return res.json({ success: true, vehicle_list: [] });
        }

        let search_radius = 1; //min search radius
        if(req.body.search_radius){
            search_radius =  Number(req.body.search_radius);
        }
        let distance = search_radius / constant_json.DEGREE_TO_KM; // Distance in radians for $near query
        let sourceLocation = [parseFloat(req.body.latitude), parseFloat(req.body.longitude)];

        // Determine delivery availability filter
        let delivery_preference = req.body?.booking_type == 1 ? [true] : [true, false];
        
        let start_date = req.body.start_date || '';
        let end_date = req.body.end_date || '';
        let min_price = req.body.min_price || '0';
        let max_price = req.body.max_price || '';
        let no_of_seat = req.body.no_of_seat || '';
        let brand_id = req.body.brand_id || '';
        let model_id = req.body.model_id || '';
        let types = req.body.types || [];
        let features = req.body.features || [];
        let startDate = new Date(req.body.start_date);
        let endDate = new Date(req.body.end_date);
        
        // Query for available vehicles
        let vehicle_query = {
            trip_id: null,
            location: { 
                $near: sourceLocation, 
                $maxDistance: distance
            },
            admin_status: 1,
            is_delivery_available: { $in: delivery_preference }
        };

        // Check if start_date and end_date are provided
        if (start_date != '' && end_date != '') {
            // Extract hours and minutes from the start date
            let startHours = startDate.getHours();
            let startMinutes = startDate.getMinutes();
            let extractedStartTime = ("0" + startHours).slice(-2) + ":" + ("0" + startMinutes).slice(-2);

            // Extract hours and minutes from the end date
            let endHours = endDate.getHours();
            let endMinutes = endDate.getMinutes();
            let extractedEndTime = ("0" + endHours).slice(-2) + ":" + ("0" + endMinutes).slice(-2);

            vehicle_query.$or = [
                // For vehicles with handover_type 1, check the time range
                {
                    $and: [
                        { "handover_type": 1 },
                        {
                            $expr: {
                                $and: [
                                    // Check if the extracted start time is greater than or equal to handover start time
                                    {
                                        $gte: [
                                            extractedStartTime,
                                            { $arrayElemAt: ["$handover_time.start_time", 0] }
                                        ]
                                    },
                                    // Check if the extracted end time is less than or equal to handover end time
                                    {
                                        $lte: [
                                            extractedEndTime,
                                            { $arrayElemAt: ["$handover_time.end_time", 0] }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                },
                // For vehicles with handover_type 0, skip the time checks
                {
                    "handover_type": 0
                }
            ];
        }

        // Check price range
        let exprConditions = [];
        min_price = min_price.toString();
        max_price = max_price.toString();        
        if (min_price != '' && max_price != '') {
            exprConditions.push({
                $and: [
                    { $gte: [{ $toDouble: "$base_price" }, Number(min_price)] },
                    { $lte: [{ $toDouble: "$base_price" }, Number(max_price)] }
                ]
            })
        }

        // Check Seats
        no_of_seat = no_of_seat.toString();
        if (no_of_seat != '') {
            exprConditions.push({
                $gte: [{ $toDouble: "$no_of_seats" }, Number(no_of_seat)]
            })
        }     
        
        // Apply conditions to the query
        if (exprConditions.length > 0) {
            vehicle_query.$expr = {
                $and: exprConditions
            };
        }

        // Check brand
        if (brand_id != '') {
            vehicle_query.brand_id = brand_id;
        }

        // Check model
        if (model_id != '') {
            vehicle_query.model_id = model_id;
        }

        // Check type
        if (types.length) {
            vehicle_query.type_id = { $in: types };
        }

        // Check features
        if (features.length) {
            vehicle_query.features = { $in: features };
        }
        
        // Query matching vehicles
        let vehicle_list = await Car_Rent_Vehicle.find(vehicle_query).select("_id non_availability");

        if (vehicle_list.length === 0) {
            return res.json({ success: true, vehicle_list: [] });
        }

        // this condition will check vehicle non availability
        let filtered_vehicle_list = [];
        vehicle_list.forEach((vehicle)=>{
            if(vehicle.non_availability?.length > 0){
                let vehicle_non_availability = vehicle.non_availability;
                let isAvailable = true;

                vehicle_non_availability.forEach((non_availability) => {
                    const nonAvailableStartDate = new Date(non_availability.start_date);
                    const nonAvailableEndDate = new Date(non_availability.end_date);

                    // Check for conflicts between requested dates and non-availability periods
                    if (
                        (startDate >= nonAvailableStartDate && startDate <= nonAvailableEndDate) || // Requested start is within non-availability
                        (endDate >= nonAvailableStartDate && endDate <= nonAvailableEndDate) || // Requested end is within non-availability
                        (startDate <= nonAvailableStartDate && endDate >= nonAvailableEndDate) // Non-availability is fully within requested period
                    ) {
                        isAvailable = false; // Conflict found, mark as unavailable
                    }

                    // If no conflicts found, add vehicle to the filtered list
                    if (isAvailable) {
                        filtered_vehicle_list.push(vehicle);
                    }
                })
            } else {
                filtered_vehicle_list.push(vehicle);
            }
        })

        if(filtered_vehicle_list.length == 0){
            return res.json({ success: true, vehicle_list: [] });
        }

        // Create the vehicle IDs list for lookup in aggregation
        let vehicleIds = filtered_vehicle_list.map(vehicle => vehicle._id);

        // for fav. vehicle
        let fav_vehicles = [];
        if(user){
            fav_vehicles = user.favourite_rent_vehicles;
        }

        // Now perform aggregation using the vehicle IDs
        let provider_lookup = {
            $lookup: {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                pipeline: [{ $project: { is_rental_approved: 1 } }],
                as: "provider_details"
            }
        };

        let brand_lookup = {
            $lookup: {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, _id: 0 } }],
                as: "brand_details"
            }
        };

        let model_lookup = {
            $lookup: {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, _id: 0 } }],
                as: "model_details"
            }
        };

        let match_provider_approved = {
            $match: {
                "provider_details.is_rental_approved": { $eq: 1 } // Ensures provider is approved For rantal
            }
        };

        let project = {
            $project: {
                _id: 1,
                provider_id: 1,
                year: 1,
                base_price: 1,
                image: { $arrayElemAt: ["$images", 0] }, // Extracting first image
                brand: { $arrayElemAt: ["$brand_details.name", 0] }, // Extracting brand name
                model: { $arrayElemAt: ["$model_details.name", 0] }, // Extracting model name
                plate_no: 1,
                rate: {
                    $round: [
                        {
                            $cond: {
                                if: { $eq: [{ $type: "$rate" }, "int"] },
                                then: {
                                    $cond: {
                                        if: { $eq: ["$rate", 0] },
                                        then: 0.0,
                                        else: { $add: ["$rate", 0.00] }
                                    }
                                },
                                else: "$rate"
                            }
                        },
                        1
                    ]
                },
                trips: { $toString: "$completed_request" },
                no_of_seats: 1,
                title: {
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] },
                        " ",
                        { $arrayElemAt: ["$model_details.name", 0] },
                        " ",
                        { $toString: "$year" }
                    ]
                },
                currency_sign: 1,
                is_favourite: {
                    $cond: {
                        if: { $in: ["$_id", fav_vehicles] }, // Checking if _id is in external fav_vehicles array
                        then: "true",
                        else: "false"
                    }
                }
            }
        };

        // Use aggregation to join with brand and model
        let vehicleDetails = await Car_Rent_Vehicle.aggregate([
            { $match: { _id: { $in: vehicleIds } } },
            provider_lookup,
            { $unwind: "$provider_details" },
            match_provider_approved,
            brand_lookup,
            model_lookup,
            project
        ]);

        return res.json({ success: true, vehicle_list: vehicleDetails });

    } catch (error) {
        utils.error_response(error, req, res);
    }
};

exports.get_rent_vehicle_detail = async function (req, res) {
    console.log("get_rent_vehicle_detail");
    console.log(req.body);
    
    try {
        let params_array = [
            { name: "vehicle_id", type: "string" }, 
            { name: "start_date", type: "string" }, 
            { name: "end_date", type: "string" }
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const vehicle = await Car_Rent_Vehicle.findOne({ _id: req.body.vehicle_id }).lean();
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        let user;
        if(req.body.user_id && req.body.user_id != ''){
            user = await User.findOne({ _id: req.body.user_id });
        }

        let start_date = req.body.start_date;
        let end_date = req.body.end_date;
        let tripDurationInDays = 1;

        if(start_date && end_date){
            let startDate = new Date(req.body.start_date);
            let endDate = new Date(req.body.end_date);
            let differenceInMilliseconds = endDate - startDate;
            // Convert milliseconds to days
            tripDurationInDays = Math.ceil(differenceInMilliseconds / (1000 * 60 * 60 * 24));
        }

        let vehicle_condition = { _id : Schema(req.body.vehicle_id)};

        let sourceLocation = [vehicle.location[0], vehicle.location[1]];
        let address = vehicle.address;
        let delivery_fee = 0;
        if(vehicle.is_delivery_available && req.body?.booking_type == 1 ){
            sourceLocation = [parseFloat(req.body.latitude), parseFloat(req.body.longitude)];
            address = req.body.address;
            // to find distance from sourceLocation to VehicleLocation
            let distance =  Math.abs(utils.getDistanceFromTwoLocation(vehicle.location, sourceLocation ));
            delivery_fee = Number(vehicle.delivery_charge_per_unit_distance * Math.ceil(distance * 2));
        }

        // Lookup for provider details
        let provider_lookup = {
            $lookup: {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                pipeline:[{ $project:{ first_name:1, last_name:1, picture:1, rental_rate:1, rental_completed_request:1 } }],
                as: "provider_details"
            }
        };

        // Lookup for brand details
        let brand_lookup = {
            $lookup: {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1 } }],
                as: "brand_details"
            }
        };

        // Lookup for model details
        let model_lookup = {
            $lookup: {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, type_id:1 } }],
                as: "model_details"
            }
        };

        // Lookup for type details
        let type_lookup = {
            $lookup: {
                from: "car_rent_types",
                localField: "type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ plateform_fee:1, name:1 } }],
                as: "type_detail"
            }
        };

        // Lookup for features
        let feature_lookup = {
            $lookup : {
                from: "car_rent_features",
                localField: "features",
                foreignField: "_id",
                pipeline:[{ $project:{ title:1 } }],
                as: "features_details"
            }
        }

        // for fav. vehicle
        let fav_vehicles = [];
        if(user){
            fav_vehicles = user.favourite_rent_vehicles;
        }

        // Project stage for fields and total calculation
        let project = {
            $project: {
                _id: 1,
                provider_id: 1,
                year: 1,
                brand: { $arrayElemAt: ["$brand_details.name", 0] },
                model: { $arrayElemAt: ["$model_details.name", 0] },
                type: { $arrayElemAt: ["$type_detail.name", 0] },
                title: { 
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] }, 
                        " ", 
                        { $arrayElemAt: ["$model_details.name", 0] }, 
                        " ", 
                        { $toString: "$year" }
                    ]
                },
                rate: {
                    $round: [
                        {
                            $cond: {
                                if: { $eq: [{ $type: "$rate" }, "int"] },
                                then: {
                                    $cond: {
                                        if: { $eq: ["$rate", 0] },
                                        then: 0.0,
                                        else: { $add: ["$rate", 0.00] }
                                    }
                                },
                                else: "$rate"
                            }
                        },
                        1
                    ]
                },                
                images: 1,
                address: address,
                additional_charge_per_unit_distance: 1,
                unique_no: 1,
                plate_no: 1,
                color: 1,
                no_of_seats: 1,
                transmission_type: 1,
                fuel_type: 1,
                base_price: 1,
                provider_detail: {
                    rate: {
                        $round: [
                            {
                                $cond: {
                                    if: { $eq: [{ $type: { $arrayElemAt: ["$provider_details.rental_rate", 0] } }, "int"] },
                                    then: {
                                        $cond: {
                                            if: { $eq: [{ $arrayElemAt: ["$provider_details.rental_rate", 0] }, 0] },
                                            then: 0.0,
                                            else: { $add: [{ $arrayElemAt: ["$provider_details.rental_rate", 0] }, 0.00] }
                                        }
                                    },
                                    else: { $arrayElemAt: ["$provider_details.rental_rate", 0] }
                                }
                            },
                            1
                        ]
                    },                    
                    name: { 
                        $concat: [
                            { $arrayElemAt: ["$provider_details.first_name", 0] },
                            " ", 
                            { $arrayElemAt: ["$provider_details.last_name", 0] }
                        ]
                    },
                    picture: { 
                        $arrayElemAt: ["$provider_details.picture", 0]
                    },
                    completed_request: { 
                        $toString: { 
                            $arrayElemAt: ["$provider_details.rental_completed_request", 0]
                        }
                    }
                },
                location: sourceLocation,
                description: 1,
                features_details: 1,
                max_distance_per_day: 1,
                cancellation_charge: 1,
                currency_sign: 1,
                start_date: req.body.start_date,
                end_date: req.body.end_date,
                total: {
                    $add: [
                        { $multiply: [{ $toDouble: "$base_price" }, tripDurationInDays] },
                        { $toDouble: { $arrayElemAt: ["$type_detail.plateform_fee", 0] } },
                        {
                            $cond: [
                                { $gt: [delivery_fee, 0] },
                                { $toDouble: delivery_fee },
                                0
                            ]
                        }
                    ]
                },
                is_favourite: {
                    $cond: {
                        if: { $in: ["$_id", fav_vehicles] }, // Checking if _id is in external fav_vehicles array
                        then: "true",
                        else: "false"
                    }
                },
                price_details: [
                    {
                        key: { 
                            $concat: [
                                vehicle.currency_sign, 
                                " ", 
                                { $toString: "$base_price" }, 
                                " x ", 
                                { $toString: tripDurationInDays }, 
                                " Days"
                            ] 
                        },
                        value: { 
                            $concat: [
                                vehicle.currency_sign, 
                                " ", 
                                { $toString: { $multiply: [{ $toDouble: "$base_price" }, tripDurationInDays] } }
                            ] 
                        }
                    },
                    {
                        key: "Platform Fee",
                        value: { 
                            $concat: [
                                vehicle.currency_sign, 
                                " ", 
                                { $toString: { $arrayElemAt: ["$type_detail.plateform_fee", 0] } }
                            ] 
                        }
                    },
                    {
                        $cond: [
                            { $gt: [delivery_fee, 0] },
                            {
                                key: "Delivery Fee",
                                value: {
                                    $concat: [
                                        vehicle.currency_sign,
                                        " ",
                                        { $toString: { $literal: delivery_fee } }
                                    ]
                                }
                            },
                            null
                        ]
                    }
                ],
                distance_unit: {
                    $cond: {
                        if: { $eq: ["$unit", 0] },
                        then: 'mi',
                        else: 'km'
                    }
                }
            }
        };

        let vehicle_detail = await Car_Rent_Vehicle.aggregate([
            { $match: vehicle_condition }, 
            provider_lookup, 
            brand_lookup, 
            model_lookup,
            type_lookup,
            feature_lookup,
            project
        ]);
        if(vehicle_detail.length){
            // Remove null values from price_details array
            vehicle_detail[0].price_details = vehicle_detail[0].price_details.filter(item => item !== null);
            return res.json({ success: true, vehicle_detail : vehicle_detail[0] });
        }
        return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.user_get_car_rent_model_list = async function (req, res) {
    try{
        let params_array = [{ name: "brand_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response);
       
        const Brand = await Car_Rent_Brand.findOne({_id: req.body.brand_id});
        if(!Brand) return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.BRAND_NOT_FOUND });

        let model_list = await Car_Rent_Model.find({ brand_id: Brand._id, is_active: true }).select({ name: 1 });

        if(!model_list || model_list.length == 0){
            return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.MODEL_NOT_ADDED });
        }

        return res.json({ success: true, model_list });
       
    } catch(error) {
        utils.error_response(error, req, res);
    }
}

exports.get_filter_data = async function (req, res) {
    try {
        let params_array = [
            { name: "latitude", type: "string" }, 
            { name: "longitude", type: "string" }
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);

        let address_data = await utils.getAddressDataFromLatLng( req.body.latitude, req.body.longitude );
        
        if(!address_data.success){
            return res.json({ success: false })
        }

        let country = await Country.findOne({$and: [{$and: [{countryname: { $regex:  new RegExp(`\\b${address_data.country_name}\\b`, 'i')  }}, { alpha2: {$exists: true, $eq: address_data.country_code}}]}]});

        if(!country){
            return res.json({ success: false });
        }

        if(country.isBusiness != 1){
            return res.json({ success: false });
        }

        let city = await City.findOne({countryid: country._id, cityname: { $regex:  new RegExp(`\\b${address_data.city_name}\\b`, 'i')}}).select("unit");

        const [max_price_vehicle, max_seat_vehicle] = await Promise.all([
            Car_Rent_Vehicle.aggregate([
                {
                    $project: {
                        base_price: 1
                    }
                },
                {
                    $addFields: {
                        base_price_as_number: { $toDouble: "$base_price" }
                    }
                },
                {
                    $sort: { base_price_as_number: -1 }
                },
                {
                    $limit: 1
                },
                {
                    $project: {
                        base_price_as_number: 1
                    }
                }
            ]),
            Car_Rent_Vehicle.aggregate([
                {
                    $project: {
                        no_of_seats: 1
                    }
                },
                {
                    $addFields: {
                        no_of_seats_as_number: { $toDouble: "$no_of_seats" }
                    }
                },
                {
                    $sort: { no_of_seats_as_number: -1 }
                },
                {
                    $limit: 1
                },
                {
                    $project: {
                        no_of_seats_as_number: 1
                    }
                }
            ])
        ]);        

        let min_price_range = 0;
        let max_price_range = max_price_vehicle[0]?.base_price_as_number || 100000;
        let min_seat_range = 2;
        let max_seat_range = max_seat_vehicle[0]?.no_of_seats_as_number || 100;
        let min_search_radius = 1;
        let max_search_radius = 10;

        const [vehicle_types, vehicle_brands, vehicle_features] = await Promise.all([
            Car_Rent_Type.find({is_active: true, country_id: country._id}).select({name:1}),
            Car_Rent_Brand.find({is_active: true, country_id: country._id}).select({name:1}),
            Car_Rent_Feature.find({is_active: true}).select({ title:1 })
        ])

        let distance_unit = "mi";
        if(city){
            distance_unit = city.unit == 0 ? "mi" : "km";
        }

        let filter_detail = {
            min_price_range : min_price_range,
            max_price_range : max_price_range,
            min_seat_range : min_seat_range,
            max_seat_range : max_seat_range,
            min_search_radius : min_search_radius,
            max_search_radius : max_search_radius,
            currency_sign: country?.currencysign,
            distance_unit: distance_unit,
            vehicle_types,
            vehicle_brands,
            vehicle_features
        }
        
        return res.json({ success: true, filter_detail });
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.add_remove_favourite_rent_vehicle = async function (req, res) {    
    try {
        let response = await utils.check_request_params_async(req.body, [{ name: 'user_id', type: 'string' }]);
        if (!response.success) return res.json(response);

        const user = await User.findOne({ _id: req.body.user_id });
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        const is_favourite = req.body.is_favourite ? req.body.is_favourite : "true";
        console.log(is_favourite);
        // add favourite 
        if(is_favourite  == "true" ){
            // Check if the vehicle ID already exists in the favourite array
            if (!user.favourite_rent_vehicles.includes(req.body.vehicle_id)) {
                user.favourite_rent_vehicles.push(req.body.vehicle_id);
                await user.save();
            }
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.ADD_FAVOURITE_RENT_VEHICLE_SUCCESSFULLY });
        }
        // remove favourite 
        // Find the index of the vehicle ID to remove
        const index = user.favourite_rent_vehicles.findIndex((x) => (x).toString() === req.body.vehicle_id);
        if (index !== -1) {
            user.favourite_rent_vehicles.splice(index, 1);
            await user.save();
        }
        return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.REMOVE_FAVOURITE_RENT_VEHICLE_SUCCESSFULLY });

    } catch (error) {
        utils.error_response(error, req, res);
    }
};

exports.get_favourite_rent_vehicle = async function (req, res) {
    try {

        let response = await utils.check_request_params_async(req.body, [{ name: 'user_id', type: 'string' }]);
        if (!response.success) return res.json(response);

        const user = await User.findOne({ _id: req.body.user_id });
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }

        // Create the vehicle IDs list for lookup in aggregation
        let vehicleIds = user.favourite_rent_vehicles;

        if(vehicleIds.length <= 0){
            return res.json({ success: true, vehicle_list: [] });
        }

        let brand_lookup = {
            $lookup: {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, _id: 0 } }],
                as: "brand_details"
            }
        };

        let model_lookup = {
            $lookup: {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, _id: 0 } }],
                as: "model_details"
            }
        };

        let project = {
            $project: {
                _id: 1,
                provider_id: 1,
                year: 1,
                base_price: 1,
                image: { $arrayElemAt: ["$images", 0] }, // Extracting first image
                brand: { $arrayElemAt: ["$brand_details.name", 0] }, // Extracting brand name
                model: { $arrayElemAt: ["$model_details.name", 0] }, // Extracting model name
                plate_no: 1,
                rate: {
                    $round: [
                        {
                            $cond: {
                                if: { $eq: [{ $type: "$rate" }, "int"] },
                                then: {
                                    $cond: {
                                        if: { $eq: ["$rate", 0] },
                                        then: 0.0,
                                        else: { $add: ["$rate", 0.00] }
                                    }
                                },
                                else: "$rate"
                            }
                        },
                        1
                    ]
                },
                trips: { $toString: "$completed_request" },
                no_of_seats: 1,
                title: {
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] },
                        " ",
                        { $arrayElemAt: ["$model_details.name", 0] },
                        " ",
                        { $toString: "$year" }
                    ]
                },
                currency_sign: 1
            }
        };
        let vehicleDetails = await Car_Rent_Vehicle.aggregate([
            { $match: { _id: { $in: vehicleIds } } },
            brand_lookup,
            model_lookup,
            project
        ]);
        
        return res.json({ success: true, vehicle_list: vehicleDetails });

    } catch (error) {
        utils.error_response(error, req, res);
    }
}
