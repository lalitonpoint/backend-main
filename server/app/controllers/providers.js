let utils = require('./utils');
let myAnalytics = require('./provider_analytics');
let allemails = require('./emails');
let Provider = require('mongoose').model('Provider');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let TripLocation = require('mongoose').model('trip_location');
let Document = require('mongoose').model('Document');
let Provider_Document = require('mongoose').model('Provider_Document');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let Type = require('mongoose').model('Type');
let console = require('./console');
let Citytype = require('mongoose').model('city_type');
let Partner = require('mongoose').model('Partner');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let CityZone = require('mongoose').model('CityZone');
let User = require('mongoose').model('User');
let mongoose = require('mongoose');
let Wallet_history = require('mongoose').model('Wallet_history');
let geolib = require('geolib');
const Transfer_history = require('mongoose').model('transfer_history');
let Card = require('mongoose').model('Card');
let Schema = mongoose.Types.ObjectId;
let Settings = require('mongoose').model('Settings')
let country_json = require('../../country_list.json')
let Vehicle = require('mongoose').model('Vehicle');
let Hub = require('mongoose').model('Hub');
let OpenRide = require('mongoose').model('Open_Ride');
let crypto = require('crypto');
var wsal_services = require('./wsal_controller')
let Car_Rent_Brand = require('mongoose').model("Car_Rent_Brand");
let Car_Rent_Model = require('mongoose').model("Car_Rent_Model");
let Car_Rent_Feature = require('mongoose').model("Car_Rent_Feature");
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");
let Rental_Trip = require('mongoose').model("Rental_Trip");
let moment = require('moment-timezone');
const {
    ERROR_CODE,
    RENT_CAR_ERROR_CODE,
} = require('../utils/error_code')
const {
    CAR_RENT_MESSAGE_CODE
} = require('../utils/success_code')
const {
    TYPE_VALUE,
    DOCUMENT_TYPE,
    PROVIDER_STATUS,
    ADMIN_NOTIFICATION_TYPE,
    VEHICLE_TYPE,
    VEHICLE_HISTORY_TYPE,
    SMS_TEMPLATE,
    RENTAL_TRIP_STATUS
} = require('./constant');

//// PROVIDER REGISTER USING POST SERVICE ///////
exports.provider_register = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});
        let check_captcha = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)    
        if (!check_captcha.success) {
            return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA });
        }
        let params_array = [{ name: 'email', type: 'string' }, { name: 'country_phone_code', type: 'string' }, { name: 'phone', type: 'string' },
        { name: 'first_name', type: 'string' }, { name: 'last_name', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let provider = await Provider.findOne({ email: ((req.body.email).trim()).toLowerCase() })
        if (provider) {
            if (provider.login_by == 'manual') {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED });
            }
            res.json({
                success: false,
                error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED_WITH_SOCIAL
            });
        } else {

            provider = await Provider.findOne({ phone: req.body.phone, country_phone_code: req.body.country_phone_code })
            if (provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED });
            }
            let country_data = await Country.findOne({ _id: req.body.country_id })

            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
                provider = await Provider.findOne({ national_id: ((req.body.national_id).trim()).toLowerCase() })
                if (provider) {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_NATIONAL_ID_ALREADY_REGISTERED });
                }
            }
            
            let query = {};
            if (req.body.city_id) {
                query['_id'] = req.body.city_id;
            } else {
                query['cityname'] = req.body.city;
            }

            let city = await City.findOne(query)
            let city_id = city._id;
            let city_name = city.cityname;
            let country_id = city.countryid;
            let token = utils.tokenGenerator(32);

            let gender = req.body.gender;
            if (gender != undefined) {
                gender = ((gender).trim()).toLowerCase();
            }

            let first_name = req.body.first_name;
            first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);

            let last_name = req.body.last_name;
            last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);
            let referral_code = (utils.tokenGenerator(8)).toUpperCase();

            let array_social_ids = []
            if(req.body.social_unique_id &&  req.body.social_unique_id  != ''){
                array_social_ids.push(req.body.social_unique_id)
            }

            let provider_detail = new Provider({
                first_name: first_name,
                last_name: last_name,
                country_phone_code: req.body.country_phone_code,
                email: ((req.body.email).trim()).toLowerCase(),
                phone: req.body.phone,
                gender: gender,
                service_type: null,
                car_model: req.body.car_model,
                car_number: req.body.car_number,
                device_token: req.body.device_token,
                device_type: req.body.device_type,
                bio: req.body.bio,
                address: req.body.address,
                zipcode: req.body.zipcode,
                social_unique_id: req.body.social_unique_id,
                social_ids :  array_social_ids,
                login_by: req.body.login_by,
                device_timezone: req.body.device_timezone,
                city: city_name,
                cityid: city_id,
                country_id: country_id,
                country: req.body.country,
                wallet_currency_code: "",
                token: token,
                referral_code: referral_code,
                is_available: 1,
                is_document_uploaded: 0,
                is_referral: 0,
                is_partner_approved_by_admin: 1,
                is_active: 0,
                is_approved: 0,
                rate: 0,
                rate_count: 0,
                is_trip: [],
                received_trip_from_gender: [],
                languages: [],
                admintypeid: null,
                wallet: 0,
                bearing: 0,
                picture: "",
                provider_type: Number(constant_json.PROVIDER_TYPE_NORMAL),
                provider_type_id: null,
                providerLocation: [0, 0],
                providerPreviousLocation: [0, 0],
                app_version: req.body.app_version,
                national_id: req.body.national_id,
                date_of_birth: req.body.date_of_birth
            });

            let alpha2 = country_json.filter((country) => country.name == provider_detail.country) || null
            /////////// FOR IMAGE /////////

            let pictureData = req.body.pictureData;
            if (pictureData != undefined && pictureData != "") {
                let image_name = provider_detail._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                provider_detail.picture = url;

                utils.saveImageAndGetURL(image_name + '.jpg', req, res, 2);
            }

            if (req.files != undefined && req.files.length > 0) {
                let image_name = provider_detail._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                provider_detail.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 2);
            }

            // for web push
            if(req.body.device_type == "web" && req.body.webpush_config && Object.keys(req.body.webpush_config).length > 0 ){
                provider_detail.webpush_config = JSON.parse(req.body.webpush_config)
            }

            ///////////////////////////
            if (req.body.login_by == "manual") {
                let crypto = require('crypto');
                let password = req.body.password;
                let hash = crypto.createHash('md5').update(password).digest('hex');
                provider_detail.password = hash;
                provider_detail.social_unique_id = ""
                let country = await Country.findById(req.body.country_id)
                if (country) {
                    let wallet_currency_code = country.currencycode;
                    provider_detail.wallet_currency_code = wallet_currency_code;

                    let document_response = await utils.insert_documets_for_new_providers(provider_detail, 1, country._id)
                    provider_detail.is_document_uploaded = document_response.is_document_uploaded;

                    await provider_detail.save()
                    provider_detail = await utils.checkNewDocumentsAdded(provider_detail, DOCUMENT_TYPE.PROVIDER);
                    let email_notification = setting_detail.email_notification;
                    if (email_notification) {
                        allemails.sendProviderRegisterEmail(req, provider_detail, provider_detail.first_name + " " + provider_detail.last_name);
                    }
        	        response.alpha2 = alpha2[0]?.alpha2
                    response.first_name = provider_detail.first_name;
                    response.last_name = provider_detail.last_name;
                    response.email = provider_detail.email;
                    response.country_phone_code = provider_detail.country_phone_code;
                    response.is_document_uploaded = provider_detail.is_document_uploaded;
                    response.address = provider_detail.address;
                    response.is_approved = provider_detail.is_approved;
                    response._id = provider_detail._id;
                    response.social_ids = provider_detail.social_ids;
                    response.social_unique_id = provider_detail.social_unique_id;
                    response.phone = provider_detail.phone;
                    response.login_by = provider_detail.login_by;
                    response.is_documents_expired = provider_detail.is_documents_expired;
                    response.account_id = provider_detail.account_id;
                    response.bank_id = provider_detail.bank_id;
                    response.city = provider_detail.city;
                    response.country = provider_detail.country;
                    response.rate = provider_detail.rate;
                    response.rate_count = provider_detail.rate_count;
                    response.is_referral = provider_detail.is_referral;
                    response.token = provider_detail.token;
                    response.referral_code = provider_detail.referral_code;
                    response.is_vehicle_document_uploaded = provider_detail.is_vehicle_document_uploaded;
                    response.service_type = provider_detail.service_type;
                    response.admintypeid = provider_detail.admintypeid;
                    response.is_available = provider_detail.is_available;
                    response.is_active = provider_detail.is_active;
                    response.is_partner_approved_by_admin = provider_detail.is_partner_approved_by_admin;
                    response.picture = provider_detail.picture;
                    response.wallet_currency_code = provider_detail.wallet_currency_code;
                    response.country_detail = { "is_referral": country.is_provider_referral }

                    res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REGISTERED_SUCCESSFULLY,
                        provider_detail: response,
                        phone_number_min_length: setting_detail.minimum_phone_number_length,
                        phone_number_length: setting_detail.maximum_phone_number_length
                    });

                    // Trigger admin notification
                    utils.addNotification({
                        type: ADMIN_NOTIFICATION_TYPE.DRIVER_REGISTERED,
                        user_id: provider_detail._id,
                        username: provider_detail.first_name + " " + provider_detail.last_name,
                        picture: provider_detail.picture,
                        country_id: country._id,
                        city_id: city._id,
                        user_unique_id: provider_detail.unique_id,
                    })
                }
            } else {
                provider_detail.password = "";
                let country = await Country.findOne({ countryphonecode: req.body.country_phone_code })
                if (country) {
                    let wallet_currency_code = country.currencycode;
                    provider_detail.wallet_currency_code = wallet_currency_code;
                    let document_response =  await utils.insert_documets_for_new_providers(provider_detail, 1, country._id)
                    provider_detail.is_document_uploaded = document_response.is_document_uploaded;
                    await provider_detail.save();
                    provider_detail = await utils.checkNewDocumentsAdded(provider_detail, DOCUMENT_TYPE.PROVIDER);
                    let email_notification = setting_detail.email_notification;
                    if (email_notification) {
                        allemails.sendProviderRegisterEmail(req, provider_detail, provider_detail.first_name + " " + provider_detail.last_name);
                    }
                    response.first_name = provider_detail.first_name;
                    response.last_name = provider_detail.last_name;
                    response.email = provider_detail.email;
                    response.country_phone_code = provider_detail.country_phone_code;
                    response.is_document_uploaded = provider_detail.is_document_uploaded;
                    response.address = provider_detail.address;
                    response.is_approved = provider_detail.is_approved;
                    response._id = provider_detail._id;
                    response.social_ids = provider_detail.social_ids;
                    response.social_unique_id = provider_detail.social_unique_id;
                    response.phone = provider_detail.phone;
                    response.login_by = provider_detail.login_by;
                    response.is_documents_expired = provider_detail.is_documents_expired;
                    response.account_id = provider_detail.account_id;
                    response.bank_id = provider_detail.bank_id;
                    response.referral_code = provider_detail.referral_code;
                    response.city = provider_detail.city;
                    response.is_referral = provider_detail.is_referral;
                    response.country = provider_detail.country;
                    response.rate = provider_detail.rate;
                    response.rate_count = provider_detail.rate_count;
                    response.token = provider_detail.token;
                    response.is_vehicle_document_uploaded = provider_detail.is_vehicle_document_uploaded;
                    response.service_type = provider_detail.service_type;
                    response.admintypeid = provider_detail.admintypeid;
                    response.is_available = provider_detail.is_available;
                    response.is_active = provider_detail.is_active;
                    response.is_partner_approved_by_admin = provider_detail.is_partner_approved_by_admin;
                    response.picture = provider_detail.picture;
                    response.wallet_currency_code = provider_detail.wallet_currency_code;
                    response.country_detail = { "is_referral": country.is_provider_referral }
        	        response.alpha2 = alpha2[0]?.alpha2

                    res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REGISTERED_SUCCESSFULLY,
                        provider_detail: response,
                        phone_number_min_length: setting_detail.minimum_phone_number_length,
                        phone_number_length: setting_detail.maximum_phone_number_length

                    });

                    // Trigger admin notification
                    utils.addNotification({
                        type: ADMIN_NOTIFICATION_TYPE.DRIVER_REGISTERED,
                        user_id: provider_detail._id,
                        username: provider_detail.first_name + " " + provider_detail.last_name,
                        picture: provider_detail.picture,
                        country_id: country._id,
                        city_id: city._id,
                        user_unique_id: provider_detail.unique_id,
                    })
                }
            }

        }
    } catch (err) {
        console.log(err);
        utils.error_response(err, req, res)
    }
};

exports.provider_login = async function (req, res) {
    try {
        console.log(req.body);
        const setting_detail = await Settings.findOne({});

        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        if (req.body.login_by == "manual") {
            let email = req.body.email;
            let provider;
            if (req.body.email) {
                provider = await Provider.findOne({ email: email.toLowerCase() });
            }else if (req.body.phone && req.body.country_phone_code) {
                provider = await Provider.findOne({ phone: req.body.phone , country_phone_code :  req.body.country_phone_code });
            }
            console.log(req.body);
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_PROVIDER });
            }
            let crypto = require('crypto');
            let password = req.body.password;
            if (password || req.body.otp_sms) {
                if (password && !req.body.otp_sms) {
                    let hash = crypto.createHash('md5').update(password).digest('hex');
                    if (provider.password != hash) {
                        return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_PASSWORD });
                    }
                }else{
                    if(req.body.otp_sms != provider.otp_sms){
                        return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_OTP });
                    }
                }
            }

            provider = await utils.checkNewDocumentsAdded(provider, DOCUMENT_TYPE.PROVIDER);
            provider = await utils.checkNewDocumentsAdded(provider, DOCUMENT_TYPE.VEHICLE);

            let token = utils.tokenGenerator(32);
            provider.token = token;
            let device_token = "";
            let device_type = "";
            provider.token = token;
            if (provider.device_token != "" && provider.device_token != req.body.device_token) {
                device_token = provider.device_token;
                device_type = provider.device_type;
            }

            provider.app_version = req.body.app_version;
            provider.device_token = req.body.device_token;
            provider.device_type = req.body.device_type;
            provider.login_by = req.body.login_by;
            // for web push
            if(req.body.device_type == "web" && req.body.webpush_config && Object.keys(req.body.webpush_config).length > 0 ){
                provider.webpush_config = JSON.parse(req.body.webpush_config)
            }
            
            await provider.save()
            if (device_token != "") {
                utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_LOGIN_IN_OTHER_DEVICE, "", null, provider.lang_code);
            }

            let alpha2 = country_json.filter((country) => country.name == provider.country) || null
        	response.alpha2 = alpha2[0]?.alpha2

            response.first_name = provider.first_name;
            response.last_name = provider.last_name;
            response.email = provider.email;
            response.country_phone_code = provider.country_phone_code;
            response.is_document_uploaded = provider.is_document_uploaded;
            response.address = provider.address;
            response.is_approved = provider.is_approved;
            response._id = provider._id;
            response.social_ids = provider.social_ids;
            response.social_unique_id = provider.social_unique_id;
            response.phone = provider.phone;
            response.login_by = provider.login_by;
            response.is_documents_expired = provider.is_documents_expired;
            response.account_id = provider.account_id;
            response.bank_id = provider.bank_id;
            response.is_referral = provider.is_referral;
            response.referral_code = provider.referral_code;
            response.city = provider.city;
            response.country = provider.country;
            response.rate = provider.rate;
            response.rate_count = provider.rate_count;
            response.token = provider.token;
            response.is_vehicle_document_uploaded = provider.is_vehicle_document_uploaded;
            response.service_type = provider.service_type;
            response.admintypeid = provider.admintypeid;
            response.is_available = provider.is_available;
            response.is_active = provider.is_active;
            response.is_partner_approved_by_admin = provider.is_partner_approved_by_admin;
            response.picture = provider.picture;
            response.wallet_currency_code = provider.wallet_currency_code;
            response.provider_type = provider.provider_type
            let country = await Country.findOne({ countryphonecode: provider.country_phone_code })
            if (country) {
                response.country_detail = { "is_referral": country.is_provider_referral }
            } else {
                response.country_detail = { "is_referral": false }
            }
            let filtered_is_trip = provider.is_trip
            let trips = provider.schedule_trip ? [...provider.schedule_trip, ...filtered_is_trip] : filtered_is_trip
            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_LOGIN_SUCCESSFULLY,
                provider_detail: response, trip_detail: trips,
                phone_number_min_length: setting_detail.minimum_phone_number_length,
                phone_number_length: setting_detail.maximum_phone_number_length
            });
        } else {

            let provider = await Provider.findOne({ social_unique_id: req.body.social_unique_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_PROVIDER });
            } else if (provider) {
                let country = Country.findOne({ countryname: provider.country })

                provider = await utils.checkNewDocumentsAdded(provider, DOCUMENT_TYPE.PROVIDER);
                provider = await utils.checkNewDocumentsAdded(provider, DOCUMENT_TYPE.VEHICLE);

                let token = utils.tokenGenerator(32);
                provider.token = token;
                let device_token = "";
                let device_type = "";
                provider.token = token;
                if (provider.device_token != "" && provider.device_token != req.body.device_token) {
                    device_token = provider.device_token;
                    device_type = provider.device_type;
                }


                provider.app_version = req.body.app_version;
                provider.device_token = req.body.device_token;
                provider.device_type = req.body.device_type;
                provider.login_by = req.body.login_by;
                await provider.save()
                if (device_token != "") {
                    utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_LOGIN_IN_OTHER_DEVICE, "", null, provider.lang_code);
                }
                response.first_name = provider.first_name;
                response.last_name = provider.last_name;
                response.email = provider.email;
                response.country_phone_code = provider.country_phone_code;
                response.is_document_uploaded = provider.is_document_uploaded;
                response.address = provider.address;
                response.is_approved = provider.is_approved;
                response._id = provider._id;
                response.social_ids = provider.social_ids;
                response.social_unique_id = provider.social_unique_id;
                response.phone = provider.phone;
                response.login_by = provider.login_by;
                response.is_referral = provider.is_referral;
                response.referral_code = provider.referral_code;
                response.is_documents_expired = provider.is_documents_expired;
                response.account_id = provider.account_id;
                response.bank_id = provider.bank_id;
                response.city = provider.city;
                response.country = provider.country;
                response.rate = provider.rate;
                response.rate_count = provider.rate_count;
                response.token = provider.token;
                response.is_vehicle_document_uploaded = provider.is_vehicle_document_uploaded;
                response.service_type = provider.service_type;
                response.admintypeid = provider.admintypeid;
                response.is_available = provider.is_available;
                response.is_active = provider.is_active;
                response.is_partner_approved_by_admin = provider.is_partner_approved_by_admin;
                response.picture = provider.picture;
                response.wallet_currency_code = provider.wallet_currency_code;
                response.provider_type = provider.provider_type
                if (country) {
                    response.country_detail = { "is_referral": country.is_provider_referral }
                } else {
                    response.country_detail = { "is_referral": false }
                }
                let filtered_is_trip = provider.is_trip
                let trips = provider.schedule_trip ? [...provider.schedule_trip, ...filtered_is_trip] : filtered_is_trip
                return res.json({
                    success: true, provider_detail: response, trip_detail: trips,
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_LOGIN_SUCCESSFULLY,
                    phone_number_min_length: setting_detail.minimum_phone_number_length,
                    phone_number_length: setting_detail.maximum_phone_number_length
                });
            }
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.getprovidersloginotp = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});
        let params_array = [{ name: 'phone', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)    
        if (!check_captcha.success) {
            return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA });
        }
        let phone = req.body.phone;
        let country_phone_code = req.body.country_phone_code;
        let phoneWithCode = phone;

        let otpForSMS = utils.generateOtp(6);
        let provider = await Provider.findOne({ phone: phone , country_phone_code : country_phone_code })
        if (!provider) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_A_REGISTERED_PROVIDER });
        }
        let providerSms = setting_detail.providerSms;
        if (providerSms) {
            if (country_phone_code) {
                phoneWithCode = country_phone_code + phoneWithCode;
            } else {
                phoneWithCode = user.country_phone_code + phoneWithCode;
            }
            utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode,9 , otpForSMS);
        }
        await Provider.findByIdAndUpdate({_id : provider._id}, {otp_sms : otpForSMS},{new : true});
        res.json({ success: true});
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

/////// get  provider Info  /////////////
exports.get_provider_info = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).lean().then(async (provider) => {
                if (!provider) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_GET_YOUR_DETAIL });
                } else {

                    let vehicle = await Vehicle.findOne({ provider_id: provider._id, is_selected: true });
                    if (vehicle) {
                        provider.car_model = vehicle.model;
                        provider.car_number = vehicle.plate_no;
                        provider.color = vehicle.color
                        provider.vehicle = vehicle.name
                    }
                    res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_GET_YOUR_DETAIL, provider: provider
                    });
                }
            }, (err) => {
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

exports.get_provider_detail = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).lean().then(async (provider) => {
                if (provider) {
                    if (provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let partner_detail = {
                            wallet: 0,
                        };
                        let schedule_trip_count = 0
                        const setting_detail = await Settings.findOne({});
                        schedule_trip_count = await Trip.count({ current_provider: provider._id, is_schedule_trip: true, is_provider_assigned_by_dispatcher: true });
                        let open_ride_count = await OpenRide.count({ provider_id: provider._id, is_trip_end : 0, is_trip_completed : 0, is_trip_cancelled : 0 });
                        schedule_trip_count = schedule_trip_count + open_ride_count

                        let alpha2 = country_json.filter((country) => country.name == provider.country) || null
                        provider.alpha2 = alpha2[0]?.alpha2

                        Citytype.findOne({ _id: provider.service_type }).then((type_detail) => {
                            Partner.findOne({ _id: provider.provider_type_id }).then(async (partner) => {
                                if (partner) {
                                    partner_detail = {
                                        first_name:partner.first_name,
                                        last_name:partner.last_name,
                                        email:partner.email,
                                        country_phone_code:partner.country_phone_code,
                                        phone:partner.phone,
                                        wallet: partner.wallet,
                                    };
                                }
                                let vehicle_list = await Vehicle.find({provider_id : provider._id});
                                let country_data = await Country.findOne({_id:provider.country_id})

                                provider.vehicle_detail = vehicle_list;
                                if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
                                    for (let i = 0; i < vehicle_list.length; i++) {
                                        let vehicle = vehicle_list[i];
                                        
                                        let rejection_reason = [];
                                        if(vehicle.wsal_rejection_reason && vehicle.wsal_rejection_reason.length > 0){
                                            for (const reason of vehicle.wsal_rejection_reason) {
                                                let push_code_response = await utils.getPushCodeString(reason);
                                                rejection_reason.push(push_code_response.sms_string);
                                            }
                                        } else {
                                            let push_code_response = await utils.getPushCodeString("INVALID_ID");
                                            rejection_reason.push(push_code_response.sms_string);
                                        }
                                        vehicle.wsal_rejection_reason = rejection_reason

                                    }

                                    provider.vehicle_detail = vehicle_list;

                                    let rejection_reason = [];
                                    if( !provider.is_driver_approved_from_wsal ){
                                        if(provider.wsal_rejection_reason && provider.wsal_rejection_reason.length > 0){
                                            for (const reason of provider.wsal_rejection_reason) {
                                                let push_code_response = await utils.getPushCodeString(reason);
                                                rejection_reason.push(push_code_response.sms_string);
                                            }
                                        } else if (provider.wsal_criminal_record_status  != "" && provider.wsal_criminal_record_status != "DONE_RESULT_OK" ){
                                            let push_code_response = await utils.getPushCodeString(provider.wsal_criminal_record_status);
                                            rejection_reason.push(push_code_response.sms_string);
                                        } else {
                                            let push_code_response = await utils.getPushCodeString("INVALID_ID");
                                            rejection_reason.push(push_code_response.sms_string);
                                        }
                                    }

                                    provider.wsal_rejection_reason = rejection_reason;
                                }
                                if (type_detail) {
                                    Country.findOne({ _id: type_detail.countryid }).then((country_data) => {
                                        City.findOne({ _id: type_detail.cityid }).then((city_data) => {
                                            Type.findOne({ _id: type_detail.typeid }).then(async (type_data) => {
                                                let type_image_url = type_data.type_image_url;
                                                let currency = country_data.currencysign;
                                                let country_id = country_data._id;
                                                let is_auto_transfer = country_data.is_auto_transfer;
                                                let unit = city_data.unit;
                                                let is_check_provider_wallet_amount_for_received_cash_request = city_data.is_check_provider_wallet_amount_for_received_cash_request;
                                                let provider_min_wallet_amount_set_for_received_cash_request = city_data.provider_min_wallet_amount_set_for_received_cash_request;

                                                let city_types = await Citytype.find({cityid:city_data._id,typeid:type_data._id,is_business:1})
                                                let hide_initiate_trip = false
                                                let hide_open_ride = false
                                                let open_ride_business = 1
                                                city_types = city_types.filter(each => each.is_ride_share == 2)
                                                if(city_types.length == 0){
                                                    open_ride_business = 0
                                                    hide_open_ride = true
                                                    city_types = city_types.filter(each => each.is_ride_share == 0)
                                                }
                                                //Unused OpenRide Code:
                                                // else if(city_types.length == 0){
                                                //     open_ride_business = 0
                                                //     hide_open_ride = true
                                                //     city_types = city_types.filter(each => each.is_ride_share == 1)
                                                // }
                                                if(city_types.length == 0){
                                                    hide_initiate_trip = true
                                                    hide_open_ride = true
                                                    open_ride_business = 0
                                                }
                                                if (city_data.open_ride_business == 0) {
                                                    hide_open_ride = true
                                                }
                                                let type_details = {
                                                    typeid: type_data._id,
                                                    typename: type_data.typename,
                                                    base_price: type_detail.base_price,
                                                    type_image_url: type_image_url,
                                                    map_pin_image_url: type_data.map_pin_image_url,
                                                    base_price_distance: type_detail.base_price_distance,
                                                    distance_price: type_detail.price_per_unit_distance,
                                                    time_price: type_detail.price_for_total_time,
                                                    currency: currency,
                                                    is_auto_transfer: is_auto_transfer,
                                                    country_id: country_id,
                                                    unit: unit,
                                                    is_check_provider_wallet_amount_for_received_cash_request: is_check_provider_wallet_amount_for_received_cash_request,
                                                    provider_min_wallet_amount_set_for_received_cash_request: provider_min_wallet_amount_set_for_received_cash_request,
                                                    server_time: new Date(),
                                                    is_surge_hours: type_detail.is_surge_hours,
                                                    surge_start_hour: type_detail.surge_start_hour,
                                                    surge_end_hour: type_detail.surge_end_hour,
                                                    timezone: city_data.timezone,
                                                    is_type_bussiness:type_data.is_business,
                                                    is_citytype_bussiness:type_detail.is_business,
                                                    luggage_allowacation:city_types[0]?.luggage_allowacation ? city_types[0]?.luggage_allowacation:0,
                                                    vehicle_capacity:city_types[0]?.vehicle_capacity ? city_types[0]?.vehicle_capacity : 0,
                                                    open_ride_business:open_ride_business
                                                    
                                                }
                                                provider.country_detail = { is_referral: country_data.is_provider_referral, is_use_wsal: country_data.is_use_wsal && setting_detail.is_wsal_service_use }
                                                provider.is_use_wsal = country_data.is_use_wsal && setting_detail.is_wsal_service_use

                                                if(provider.zone_queue_id){
                                                    let city_zone_data = await CityZone.findOne({ _id: provider.zone_queue_id });
                                                    if(city_zone_data){
                                                      let provider_index = city_zone_data.total_provider_in_zone_queue.indexOf(provider._id)
                                                      if(provider_index!==-1){
                                                        provider.zone_queue_number = provider_index+1;
                                                        provider.zone_name = city_zone_data.title;
                                                      }
                                                    }
                                                }
                                                res.json({
                                                    success: true,
                                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_GET_YOUR_DETAIL,
                                                    provider: provider,
                                                    type_details: type_details,
                                                    partner_detail: partner_detail,
                                                    schedule_trip_count,
                                                    hide_initiate_trip : hide_initiate_trip,
                                                    hide_open_ride: hide_open_ride
                                                });
                                            });
                                        });
                                    });


                                } else {
                                    let country_data = await Country.findOne({ _id: provider.country_id })
                                    provider.country_detail = { is_use_wsal: country_data.is_use_wsal && setting_detail.is_wsal_service_use }
                                    provider.is_use_wsal = country_data.is_use_wsal && setting_detail.is_wsal_service_use

                                    // provider.alpha2 = alpha2[0]?.alpha2
                                    res.json({
                                        success: true,
                                        partner_detail: partner_detail,
                                        schedule_trip_count,
                                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_GET_YOUR_DETAIL,
                                        provider: provider
                                    });
                                }
                            });

                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });

                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

exports.provider_heat_map = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        try {
            let provider = await Provider.findOne({ _id: req.body.provider_id });

            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }

            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }

            let now = new Date();
            now.setHours(now.getHours() - 1);

            let condition = { provider_id: provider._id, is_trip_completed: 1, created_at: { $gte: now } }
            let select = { _id: 0, sourceLocation: 1 }

            let trip_data = await Trip.find(condition).select(select).lean();
            let trip_history_data = await Trip_history.find(condition).select(select).lean();
            let pickup_locations = trip_data.concat(trip_history_data);

            if (pickup_locations.length == 0) {
                return res.json({ success: false });
            }
            return res.json({ success: true, pickup_locations: pickup_locations });

        } catch (e) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    })
};

// update provider
exports.provider_update = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'first_name', type: 'string' }, { name: 'last_name', type: 'string' },
        { name: 'phone', type: 'string' }, { name: 'country_phone_code', type: 'string' },]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const setting_detail = await Settings.findOne({});
        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
        }

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }
        
        let alpha2 = country_json.filter((country) => country.name == provider.country) || null
        let query = {}
        query['_id'] = { $ne: req.body.provider_id }
        query['$or'] = [{ phone: req.body.phone, country_phone_code: req.body.country_phone_code }]
        let duplicate = await Provider.findOne(query)
        if (duplicate) {
            res.json({ success: false, error_code:error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED  })
            return
        }
        let country_data = await Country.findOne({ _id: provider.country_id })

        // check if national_id already register
        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
            let duplicate_provider = await Provider.findOne({_id: { $ne: req.body.provider_id }, national_id: ((req.body.national_id).trim()).toLowerCase() })
            if (duplicate_provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NATIONAL_ID_ALREADY_REGISTERED });
            }
        }
        
        let vehicle_detail = await Vehicle.findOne({provider_id: Schema(provider._id), is_selected: true })
        if(!vehicle_detail){
            vehicle_detail = await Vehicle.findOne({provider_id: Schema(provider._id)})
        }

        if (provider.login_by !== "manual") {

            if (req.files != undefined && req.files.length > 0) {
                utils.deleteImageFromFolder(provider.picture, 2);
                let image_name = provider._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                provider.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 2);
            }

            

            let first_name = req.body.first_name;
            first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);
            let last_name = req.body.last_name;
            last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);
            provider.first_name = first_name;
            provider.last_name = last_name;
            provider.country_phone_code = req.body.country_phone_code;
            provider.phone = req.body.phone;
            provider.bio = req.body.bio;
            provider.gender = req.body.gender;
            provider.address = req.body.address;
            provider.zipcode = req.body.zipcode;
            provider.languages = req.body.languages;
            provider.received_trip_from_gender = req.body.received_trip_from_gender;
            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && vehicle_detail){
                wsal_services.DriverVehicleRegistrationService(provider._id, vehicle_detail._id )
            }
            await provider.save()

            response.first_name = provider.first_name;
            response.last_name = provider.last_name;
            response.email = provider.email;
            response.country_phone_code = provider.country_phone_code;
            response.is_document_uploaded = provider.is_document_uploaded;
            response.address = provider.address;
            response.is_approved = provider.is_approved;
            response._id = provider._id;
            response.social_ids = provider.social_ids;
            response.social_unique_id = provider.social_unique_id;
            response.phone = provider.phone;
            response.login_by = provider.login_by;
            response.is_documents_expired = provider.is_documents_expired;
            response.account_id = provider.account_id;
            response.bank_id = provider.bank_id;
            response.city = provider.city;
            response.country = provider.country;
            response.rate = provider.rate;
            response.referral_code = provider.referral_code;
            response.rate_count = provider.rate_count;
            response.is_referral = provider.is_referral;
            response.token = provider.token;
            response.is_vehicle_document_uploaded = provider.is_vehicle_document_uploaded;
            response.service_type = provider.service_type;
            response.admintypeid = provider.admintypeid;
            response.is_available = provider.is_available;
            response.is_active = provider.is_active;
            response.is_partner_approved_by_admin = provider.is_partner_approved_by_admin;
            response.picture = provider.picture;
            response.alpha2 = alpha2[0]?.alpha2;
            response.national_id = provider.national_id;
            response.date_of_birth = provider.date_of_birth;

            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_PROFILE_UPDATED_SUCCESSFULLY,
                provider_detail: response
            });
        } else {
            let old_password = req.body.old_password;
            let hash_old = crypto.createHash('md5').update(old_password).digest('hex');
            let new_password = req.body.new_password;

            if (provider.password == hash_old) {

                if (new_password != '') {
                    let hash_new = crypto.createHash('md5').update(new_password).digest('hex');
                    provider.password = hash_new;
                }
                if (req.files != undefined && req.files.length > 0) {
                    utils.deleteImageFromFolder(provider.picture, 2);
                    let image_name = provider._id + utils.tokenGenerator(4);
                    let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                    provider.picture = url;

                    utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 2);

                }

                let first_name = req.body.first_name;
                first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);
                let last_name = req.body.last_name;
                last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);


                provider.first_name = first_name;
                provider.last_name = last_name;
                provider.country_phone_code = req.body.country_phone_code;
                provider.phone = req.body.phone;
                provider.bio = req.body.bio;
                provider.gender = req.body.gender;
                provider.address = req.body.address;
                provider.zipcode = req.body.zipcode;
                provider.languages = req.body.languages;
                provider.received_trip_from_gender = req.body.received_trip_from_gender;
                if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && vehicle_detail){
                    wsal_services.DriverVehicleRegistrationService(provider._id, vehicle_detail._id )
                }
                await provider.save()

                if (new_password != '' && setting_detail.sms_notification) {
                    utils.sendSmsForOTPVerificationAndForgotPassword( provider.country_phone_code + provider.phone, SMS_TEMPLATE.FORGOT_PASSWORD, new_password )
                }

                response.first_name = provider.first_name;
                response.last_name = provider.last_name;
                response.email = provider.email;
                response.country_phone_code = provider.country_phone_code;
                response.is_document_uploaded = provider.is_document_uploaded;
                response.address = provider.address;
                response.is_approved = provider.is_approved;
                response._id = provider._id;
                response.social_ids = provider.social_ids;
                response.social_unique_id = provider.social_unique_id;
                response.phone = provider.phone;
                response.login_by = provider.login_by;
                response.is_documents_expired = provider.is_documents_expired;
                response.account_id = provider.account_id;
                response.bank_id = provider.bank_id;
                response.city = provider.city;
                response.country = provider.country;
                response.rate = provider.rate;
                response.referral_code = provider.referral_code;
                response.rate_count = provider.rate_count;
                response.token = provider.token;
                response.is_vehicle_document_uploaded = provider.is_vehicle_document_uploaded;
                response.service_type = provider.service_type;
                response.admintypeid = provider.admintypeid;
                response.is_available = provider.is_available;
                response.is_active = provider.is_active;
                response.is_partner_approved_by_admin = provider.is_partner_approved_by_admin;
                response.picture = provider.picture;
                response.alpha2 = alpha2[0]?.alpha2;
                response.national_id = provider.national_id;
                response.date_of_birth = provider.date_of_birth;

                res.json({
                    success: true,
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_PROFILE_UPDATED_SUCCESSFULLY,
                    provider_detail: response
                });

            } else {
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_YOUR_PASSWORD_IS_NOT_MATCH_WITH_OLD_PASSWORD
                });
            }
        }
    } catch (err) {
        utils.error_response(err, req, res)
    }
};


exports.update_location = function (req, res) {
    utils.check_request_params(req.body, [], function (response) {

        if (response.success && req.body.location && req.body.location.length > 0) {
            let location_unique_id = 0;
            if (req.body.location_unique_id != undefined) {
                location_unique_id = req.body.location_unique_id;
            }
            req.body.latitude = req.body.location[0]
            req.body.longitude = req.body.location[1]
            let minutes;
            Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({
                            success: false,
                            error_code: error_message.ERROR_CODE_INVALID_TOKEN
                        });
                    } else {
                        const setting_detail = await Settings.findOne({});
                        var selected_vehicle = await Vehicle.findOne({provider_id: provider._id, is_selected :true })
                        let country_data = await Country.findOne({_id: provider.country_id})
                        let trip_id = req.body.trip_id;
                        let now = new Date();
                        if (!trip_id) {
                            trip_id = provider.is_trip[0];
                        }
                        Trip.findOne({
                            _id: trip_id,
                            confirmed_provider: req.body.provider_id,
                            is_trip_completed: 0,
                            is_trip_cancelled: 0,
                            is_trip_end: 0
                        }).then((trip) => {

                            if (!trip) {

                                Citytype.findOne({ _id: provider.service_type }, function (error, city_type) {
                                    if (city_type) {
                                        if (!provider.zone_queue_id) {
                                            CityZone.find({ cityid: provider.cityid, _id: { $in: city_type.zone_ids } }).then((city_zone_list) => {
                                                if (city_zone_list && city_zone_list.length > 0) {
                                                    let i = 0;
                                                    let geo;
                                                    let selected_city_zone_data;
                                                    city_zone_list.forEach(async function (city_zone_data) {

                                                        if (!geo) {
                                                            geo = geolib.isPointInside(
                                                                { latitude: req.body.latitude, longitude: req.body.longitude },
                                                                city_zone_data.kmlzone
                                                            );
                                                            selected_city_zone_data = city_zone_data;
                                                        }

                                                        i++;
                                                        if (i == city_zone_list.length) {

                                                            if (geo) {
                                                                provider = await utils.add_in_zone_queue_new(selected_city_zone_data._id, provider);
                                                            }

                                                            provider.providerPreviousLocation = provider.providerLocation;
                                                            provider.providerLocation = [req.body.latitude, req.body.longitude];
                                                            provider.bearing = req.body.bearing;
                                                            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                                wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                                            }
                                                            provider.location_updated_time = now;
                                                            provider.save().then(() => {
                                                                res.json({
                                                                    success: true,
                                                                    location_unique_id: location_unique_id,
                                                                    providerLocation: provider.providerLocation

                                                                });
                                                            }, (err) => {
                                                                console.log(err);
                                                                res.json({
                                                                    success: false,
                                                                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                                });
                                                            });
                                                        }

                                                    })
                                                } else {
                                                    provider.providerPreviousLocation = provider.providerLocation;
                                                    provider.providerLocation = [req.body.latitude, req.body.longitude];
                                                    provider.bearing = req.body.bearing;
                                                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                                    }
                                                    provider.location_updated_time = now;
                                                    provider.save().then(() => {
                                                        res.json({
                                                            success: true,
                                                            location_unique_id: location_unique_id,
                                                            providerLocation: provider.providerLocation

                                                        });
                                                    }, (err) => {
                                                        console.log(err);
                                                        res.json({
                                                            success: false,
                                                            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                        });
                                                    });
                                                }
                                            }, () => {
                                                provider.providerPreviousLocation = provider.providerLocation;
                                                provider.providerLocation = [req.body.latitude, req.body.longitude];
                                                provider.bearing = req.body.bearing;
                                                if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                    wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                                }
                                                provider.location_updated_time = now;
                                                provider.save().then(() => {
                                                    res.json({
                                                        success: true,
                                                        location_unique_id: location_unique_id,
                                                        providerLocation: provider.providerLocation

                                                    });
                                                }, (err) => {
                                                    console.log(err);
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                    });
                                                });
                                            });

                                        } else {
                                            CityZone.findOne({ _id: provider.zone_queue_id }, async function (error, city_zone_data) {
                                                if (city_zone_data) {
                                                    let geo = geolib.isPointInside(
                                                        { latitude: req.body.latitude, longitude: req.body.longitude },
                                                        city_zone_data.kmlzone
                                                    );
                                                    if (!geo) {

                                                        provider = await utils.remove_from_zone_queue_new(provider);

                                                        provider.providerPreviousLocation = provider.providerLocation;
                                                        provider.providerLocation = [req.body.latitude, req.body.longitude];
                                                        provider.bearing = req.body.bearing;
                                                        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                            wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                                        }
                                                        provider.location_updated_time = now;
                                                        provider.save().then(() => {
                                                            res.json({
                                                                success: true,
                                                                location_unique_id: location_unique_id,
                                                                providerLocation: provider.providerLocation
                                                            });
                                                        }, (err) => {
                                                            console.log(err);
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                            });
                                                        });

                                                    } else {
                                                        provider.providerPreviousLocation = provider.providerLocation;
                                                        provider.providerLocation = [req.body.latitude, req.body.longitude];
                                                        provider.bearing = req.body.bearing;
                                                        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                            wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                                        }
                                                        provider.location_updated_time = now;
                                                        provider.save().then(() => {
                                                            res.json({
                                                                success: true,
                                                                location_unique_id: location_unique_id,
                                                                providerLocation: provider.providerLocation
                                                            });
                                                        }, (err) => {
                                                            console.log(err);
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                            });
                                                        });
                                                    }

                                                } else {
                                                    provider.providerPreviousLocation = provider.providerLocation;
                                                    provider.providerLocation = [req.body.latitude, req.body.longitude];
                                                    provider.bearing = req.body.bearing;
                                                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                                    }
                                                    provider.location_updated_time = now;
                                                    provider.save().then(() => {
                                                        res.json({
                                                            success: true,
                                                            location_unique_id: location_unique_id,
                                                            providerLocation: provider.providerLocation
                                                        });
                                                    }, (err) => {
                                                        console.log(err);
                                                        res.json({
                                                            success: false,
                                                            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                        });
                                                    });
                                                }
                                            })
                                        }
                                    } else {
                                        provider.providerPreviousLocation = provider.providerLocation;
                                        provider.providerLocation = [req.body.latitude, req.body.longitude];
                                        provider.bearing = req.body.bearing;
                                        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                            wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                        }
                                        provider.location_updated_time = now;
                                        provider.save().then(() => {
                                            res.json({
                                                success: true,
                                                location_unique_id: location_unique_id,
                                                providerLocation: provider.providerLocation
                                            });
                                        }, (err) => {
                                            console.log(err);
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                            });
                                        });
                                    }
                                });
                            } else {
                                let unit_set = trip.unit;
                                let is_provider_status = trip.is_provider_status

                                if (provider.providerLocation[0] == undefined || provider.providerLocation[1] == undefined || provider.providerLocation[0] == 0 || provider.providerLocation[1] == 0) {
                                    let location = req.body.location;
                                    provider.providerPreviousLocation = provider.providerLocation;
                                    provider.providerLocation = [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])];
                                    provider.bearing = req.body.bearing;
                                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])], false, provider.location_updated_time);
                                    }
                                    provider.location_updated_time = now;
                                    trip.provider_providerPreviousLocation = provider.providerPreviousLocation;
                                    trip.providerLocation = [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])];
                                    trip.bearing = req.body.bearing;
                                    Trip.findByIdAndUpdate(trip._id, trip, () => {

                                    });
                                    provider.save().then(() => {
                                        res.json({
                                            success: true,
                                            location_unique_id: location_unique_id,
                                            providerLocation: provider.providerLocation,
                                            total_distance: trip.total_distance,
                                            total_time: trip.total_time
                                        });
                                    }, (err) => {
                                        console.log(err);
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                        });

                                    });
                                } else {
                                    if (trip.provider_trip_start_time != null) {
                                        minutes = utils.getTimeDifferenceInMinute(now, trip.provider_trip_start_time);
                                        trip.total_time = minutes;
                                        Trip.findByIdAndUpdate(trip._id, { total_time: minutes }, () => {

                                        });
                                    }

                                    let all_temp_locations = req.body.location;
                                    let all_locations = [];
                                    let locations = [];
                                    TripLocation.findOne({ tripID: trip_id }).then((tripLocation) => {

                                        if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                                            let store_locations = tripLocation.startTripToEndTripLocations;
                                            let store_locations_size = store_locations.length;
                                            let locations_size = all_temp_locations.length;

                                            if (locations_size > 1) {

                                                for (let i = 0; i < locations_size; i++) {
                                                    is_add = true;
                                                    for (let j = i + 1; j < locations_size; j++) {
                                                        if (Number(all_temp_locations[i][0]) == Number(all_temp_locations[j][0]) && Number(all_temp_locations[i][1]) == Number(all_temp_locations[j][1])) {
                                                            is_add = false;
                                                            break;
                                                        }
                                                    }
                                                    if (is_add) {
                                                        all_locations.push(all_temp_locations[i]);
                                                    }
                                                }
                                            } else {
                                                all_locations = all_temp_locations;
                                            }

                                            locations_size = all_locations.length;

                                            let is_add = false;
                                            for (let i = 0; i < locations_size; i++) {
                                                is_add = true;
                                                for (let j = 0; j < store_locations_size; j++) {
                                                    if (Number(all_locations[i][0]) == Number(store_locations[j][0]) && Number(all_locations[i][1]) == Number(store_locations[j][1])) {
                                                        is_add = false;
                                                        break;
                                                    }
                                                }
                                                if (is_add) {
                                                    locations.push(all_locations[i]);
                                                }
                                            }
                                        } else {
                                            locations = all_temp_locations;
                                        }


                                        if (locations.length > 0) {
                                            let providerPreviousLocation = provider.providerPreviousLocation;
                                            let providerLocation = provider.providerLocation;

                                            let total_distance = trip.total_distance;
                                            let location_updated_time = provider.location_updated_time;
                                            let temp_location_updated_time = 0;
                                            let temp_diff = 0;
                                            let now = null;
                                            let max_distance = 0.05;
                                            let distance_diff = 0;
                                            let time_diff = 0;
                                            let location = [];

                                            for (const locationData of locations) {
                                                now = new Date(Number(locationData[2]));
                                            
                                                providerPreviousLocation = providerLocation;
                                                providerLocation = [Number(locationData[0]), Number(locationData[1])];
                                            
                                                distance_diff = Math.abs(utils.getDistanceFromTwoLocation(providerPreviousLocation, providerLocation));
                                                time_diff = Math.abs(utils.getTimeDifferenceInSecond(location_updated_time, now));
                                            
                                                if (temp_location_updated_time > 0) {
                                                    temp_diff = (Number(locationData[2]) - temp_location_updated_time) / 1000;
                                                }
                                                temp_location_updated_time = Number(locationData[2]);
                                            
                                                if ((distance_diff < max_distance * time_diff && distance_diff > 0.005) || (distance_diff < max_distance && time_diff == 0)) {
                                            
                                                    location = [Number(providerLocation[0]), Number(providerLocation[1]), time_diff, Number(locationData[2]), temp_diff];
                                                    switch (trip.is_provider_status) {
                                                        case 2:
                                                            tripLocation.providerStartToStartTripLocations.push(location);
                                                            break;
                                                        case 6:
                                                            tripLocation.startTripToEndTripLocations.push(location);
                                                            break;
                                                        default:
                                                            break;
                                                    }
                                                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                        let is_user_in_trip = trip.is_provider_status == 6;
                                                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])], is_user_in_trip, provider.location_updated_time);
                                                    }
                                                    location_updated_time = now;
                                                    if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                                                        let td = distance_diff; // km                                                    
                                                        if (unit_set == 0) { /// 0 = mile
                                                            td = td * 0.621371;
                                                        }
                                                        total_distance = +total_distance + +td;
                                                    }
                                                }
                                            }

                                            trip.providerPreviousLocation = providerPreviousLocation;
                                            trip.providerLocation = providerLocation;
                                            trip.total_distance = Number(total_distance.toFixed(2));
                                            Trip.findByIdAndUpdate(trip._id, { total_time: minutes, total_distance: trip.total_distance, providerLocation: trip.providerLocation, providerPreviousLocation: trip.providerPreviousLocation }, () => {

                                                // })
                                                // trip.save().then(() => {

                                                tripLocation.save().then(() => {
                                                    res.json({
                                                        success: true,
                                                        location_unique_id: location_unique_id,
                                                        providerLocation: provider.providerLocation,
                                                        total_distance: trip.total_distance,
                                                        total_time: trip.total_time

                                                    });

                                                    if (is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                                                        utils.set_google_road_api_locations(tripLocation);
                                                    }
                                                }, () => {
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                    });

                                                });
                                            }, () => {
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                });

                                            });

                                            provider.providerPreviousLocation = providerPreviousLocation;
                                            provider.providerLocation = providerLocation;
                                            provider.location_updated_time = now;
                                            provider.bearing = req.body.bearing;
                                            provider.save();

                                        } else {
                                            res.json({
                                                success: true,
                                                location_unique_id: location_unique_id,
                                                providerLocation: provider.providerLocation,
                                                total_distance: trip.total_distance, total_time: trip.total_time

                                            });
                                        }
                                    });

                                }

                            }
                        }, () => {
                            provider.providerPreviousLocation = provider.providerLocation;
                            provider.providerLocation = [req.body.latitude, req.body.longitude];
                            provider.bearing = req.body.bearing;
                            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                            }
                            provider.location_updated_time = now;
                            provider.save().then(() => {
                                res.json({
                                    success: true,
                                    location_unique_id: location_unique_id,
                                    providerLocation: provider.providerLocation

                                });
                            }, (err) => {
                                console.log(err);
                                res.json({
                                    success: false,
                                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                });
                            });
                        });

                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });

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


exports.update_location_socket = function (req, res) {
    utils.check_request_params(req.body, [], async function (response) {
        if (!(response.success && req.body.location && req.body.location.length > 0)) {
            res([{ success: false, error_code: response.error_code, error_message: response.error_message }]);
            return;
        }
        let location_unique_id = 0;
        let now = new Date();

        if (req.body.location_unique_id != undefined) {
            location_unique_id = req.body.location_unique_id;
        }


        req.body.latitude = (typeof req.body.location[0] == 'string') ? req.body.location[0] : req.body.location[0][0]
        req.body.longitude = (typeof req.body.location[1] == 'string') ? req.body.location[1] : req.body.location[0][1]

        try {
            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                res([{ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND }]);
                return;
            }

            if (req.body.token != null && provider.token != req.body.token) {
                res([{ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN }]);
                return;
            }
            const setting_detail = await Settings.findOne({})
            var selected_vehicle = await Vehicle.findOne({provider_id: provider._id, is_selected: true});
            var country_data = await Country.findOne({_id: provider.country_id});

            if (provider.is_trip.length == 0) {
                let city_type = await Citytype.findOne({ cityid: provider.cityid, typeid: provider.admintypeid, is_ride_share: 0 })

                if (!city_type) {
                    provider.providerPreviousLocation = provider.providerLocation;
                    provider.providerLocation = [req.body.latitude, req.body.longitude];
                    provider.bearing = req.body.bearing;
                    provider.location_updated_time = now;
                    await provider.save();

                    res([{ success: true, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                    }
                    return;
                }

                try {
                    if (!provider.zone_queue_id) {
                        let city_zone_list = await CityZone.find({ cityid: provider.cityid, _id: { $in: city_type.zone_ids } });
                        if (!(city_zone_list && city_zone_list.length > 0)) {
                            provider.providerPreviousLocation = provider.providerLocation;
                            provider.providerLocation = [req.body.latitude, req.body.longitude];
                            provider.bearing = req.body.bearing;
                            provider.location_updated_time = now;
                            await provider.save()

                            res([{ success: true, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                            }
                            return;
                        }

                        let i = 0;
                        let geo;
                        let selected_city_zone_data;
                        for (const city_zone_data of city_zone_list) {
                            if (!geo) {
                                geo = geolib.isPointInside(
                                    { latitude: req.body.latitude, longitude: req.body.longitude },
                                    city_zone_data.kmlzone
                                );
                                selected_city_zone_data = city_zone_data;
                            }

                            i++;
                            if (i == city_zone_list.length) {
                                if (geo) {
                                    provider = await utils.add_in_zone_queue_new(selected_city_zone_data._id, provider);
                                }

                                provider.providerPreviousLocation = provider.providerLocation;
                                provider.providerLocation = [req.body.latitude, req.body.longitude];
                                provider.bearing = req.body.bearing;
                                provider.location_updated_time = now;
                                await provider.save();

                                res([{ success: true, zone_queue_id: provider.zone_queue_id, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                                if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                    wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                                }
                                return;
                            }
                        }
                    }

                    let city_zone_data = await CityZone.findOne({ _id: provider.zone_queue_id });
                    if (!city_zone_data) {
                        provider.providerPreviousLocation = provider.providerLocation;
                        provider.providerLocation = [req.body.latitude, req.body.longitude];
                        provider.bearing = req.body.bearing;
                        provider.location_updated_time = now;
                        await provider.save()

                        res([{ success: true, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                            wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                        }
                        return;
                    }

                    let geo = geolib.isPointInside({ latitude: req.body.latitude, longitude: req.body.longitude }, city_zone_data.kmlzone);
                    if (!geo) {
                        provider = await utils.remove_from_zone_queue_new(provider);
                        provider.providerPreviousLocation = provider.providerLocation;
                        provider.providerLocation = [req.body.latitude, req.body.longitude];
                        provider.bearing = req.body.bearing;
                        provider.location_updated_time = now;
                        await provider.save()

                        res([{ success: true, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                            wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                        }
                        return;
                    }

                    provider.providerPreviousLocation = provider.providerLocation;
                    provider.providerLocation = [req.body.latitude, req.body.longitude];
                    provider.bearing = req.body.bearing;
                    provider.location_updated_time = now;
                    await provider.save()

                    res([{ success: true, zone_queue_id: provider.zone_queue_id, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                    }
                    return;
                } catch (e) {
                    provider.providerPreviousLocation = provider.providerLocation;
                    provider.providerLocation = [req.body.latitude, req.body.longitude];
                    provider.bearing = req.body.bearing;
                    provider.location_updated_time = now;
                    await provider.save()

                    res([{ success: true, location_unique_id: location_unique_id, providerLocation: provider.providerLocation, is_active: provider.is_active, is_available: provider.is_available }]);
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
                    }
                    return;
                }
            }

            let responses = []
            for (const trip of provider.is_trip) {
                responses.push(await exports.update_is_trip_location(req, trip, provider))
            }

            res(responses)
            return;
        } catch (e) {
            // console.log(e)

            res([{ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG }]);
            return;
        }
    });
};

exports.update_is_trip_location = async function (req, trip_id, provider) {
    const setting_detail = await Settings.findOne({});
    var selected_vehicle = await Vehicle.findOne({provider_id: provider._id, is_selected: true})
    var country_data = await Country.findOne({_id: provider.country_id})

    let now = new Date();
    let location_unique_id = 0;

    if (req.body.location_unique_id != undefined) {
        location_unique_id = req.body.location_unique_id;
    }

    req.body.latitude = req.body.location[0][0]
    req.body.longitude = req.body.location[0][1]
    let minutes;
    try {
        let trip = await Trip.findOne({
            _id: trip_id,
            confirmed_provider: req.body.provider_id,
            is_trip_completed: 0,
            is_trip_cancelled: 0,
            is_trip_end: 0
        })
        if(!trip){
            trip = await OpenRide.findOne({
                _id: trip_id,
                confirmed_provider: req.body.provider_id,
                is_trip_completed: 0,
                is_trip_cancelled: 0,
                is_trip_end: 0
            })
        }
        let Table
        if(trip.openride){
            Table = OpenRide
        }else{
            Table = Trip
        }

        if(!trip){
            let location = req.body.location;
            provider.providerPreviousLocation = provider.providerLocation;
            provider.providerLocation = [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])];
            provider.bearing = req.body.bearing;
            provider.location_updated_time = now;
            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])], false, provider.location_updated_time);
            }
            return {
                success: true,
                location_unique_id: location_unique_id,
                providerLocation: provider.providerLocation,
            };
        }

        let unit_set = trip.unit;

        if (provider.providerLocation[0] == undefined || provider.providerLocation[1] == undefined || provider.providerLocation[0] == 0 || provider.providerLocation[1] == 0) {
            let location = req.body.location;
            provider.providerPreviousLocation = provider.providerLocation;
            provider.providerLocation = [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])];
            provider.bearing = req.body.bearing;
            provider.location_updated_time = now;

            trip.provider_providerPreviousLocation = provider.providerPreviousLocation;
            trip.providerLocation = [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])];
            trip.bearing = req.body.bearing;
            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.location[location.length - 1][0]), Number(req.body.location[location.length - 1][1])], false, provider.location_updated_time);
            }
            await Table.findByIdAndUpdate(trip._id, trip);
            await provider.save()

            return {
                success: true,
                location_unique_id: location_unique_id,
                providerLocation: provider.providerLocation,
                total_distance: trip.total_distance,
                total_time: trip.total_time,
                trip_id
            };
        }

        if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
            minutes = utils.getTimeDifferenceInMinute(now, trip.provider_trip_start_time);
            trip.total_time = minutes;
            await Table.findByIdAndUpdate(trip._id, { total_time: minutes });
        }

        let all_temp_locations = req.body.location;
        let all_locations = [];
        let locations = [];
        let tripLocation = await TripLocation.findOne({ tripID: trip_id })

        if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
            let store_locations = tripLocation.startTripToEndTripLocations;
            let store_locations_size = store_locations.length;
            let locations_size = all_temp_locations.length;

            if (locations_size > 1) {
                let is_add = false;
                for (let i = 0; i < locations_size; i++) {
                    is_add = true;
                    for (let j = i + 1; j < locations_size; j++) {
                        if (Number(all_temp_locations[i][0]) == Number(all_temp_locations[j][0]) && Number(all_temp_locations[i][1]) == Number(all_temp_locations[j][1])) {
                            is_add = false;
                            break;
                        }
                    }
                    if (is_add) {
                        all_locations.push(all_temp_locations[i]);
                    }
                }
            } else {
                all_locations = all_temp_locations;
            }

            locations_size = all_locations.length;
            let is_add = false;
            for (let i = 0; i < locations_size; i++) {
                is_add = true;
                for (let j = 0; j < store_locations_size; j++) {
                    if (Number(all_locations[i][0]) == Number(store_locations[j][0]) && Number(all_locations[i][1]) == Number(store_locations[j][1])) {
                        is_add = false;
                        break;
                    }
                }
                if (is_add) {
                    locations.push(all_locations[i]);
                }
            }
        } else {
            locations = all_temp_locations;
        }

        if (locations.length == 0) {
            return {
                success: true,
                location_unique_id: location_unique_id,
                providerLocation: provider.providerLocation,
                total_distance: trip.total_distance,
                total_time: trip.total_time,
                trip_id
            };
        }

        let providerPreviousLocation = trip.providerPreviousLocation;
        let providerLocation = trip.providerLocation;
        let total_distance = trip.total_distance;
        let location_updated_time = provider.location_updated_time;
        let temp_location_updated_time = 0;
        let temp_diff = 0;
        let distance_diff = 0;
        let time_diff = 0;
        let location = [];
        now = null;
        for (const locationData of locations) {
            now = new Date(Number(locationData[2]));
        
            providerPreviousLocation = providerLocation;
            providerLocation = [Number(locationData[0]), Number(locationData[1])];
        
            distance_diff = Math.abs(utils.getDistanceFromTwoLocation(providerPreviousLocation, providerLocation));
            time_diff = Math.abs(utils.getTimeDifferenceInSecond(location_updated_time, now));
        
            if (temp_location_updated_time > 0) {
                temp_diff = (Number(locationData[2]) - temp_location_updated_time) / 1000;
            }
            temp_location_updated_time = Number(locationData[2]);
        
            location = [Number(providerLocation[0]), Number(providerLocation[1]), time_diff, Number(locationData[2]), temp_diff];
            switch (trip.is_provider_status) {
                case 2:
                    tripLocation.providerStartToStartTripLocations.push(location);
                    break;
                case 6:
                    tripLocation.startTripToEndTripLocations.push(location);
                    break;
                default:
                    break;
            }
        
            location_updated_time = now;
            if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                let td = distance_diff; // km  
                if (unit_set == 0) { /// 0 = mile
                    td = td * 0.621371;
                }
                total_distance = +total_distance + +td;
            }
            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                var is_user_in_trip = trip.is_provider_status == 6;
                await wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.location[locations.length - 1][0]), Number(req.body.location[locations.length - 1][1])], is_user_in_trip, provider.location_updated_time);
            }
        }
        trip.providerPreviousLocation = providerPreviousLocation;
        trip.providerLocation = providerLocation;
        trip.total_distance = Number(total_distance.toFixed(2));

        await Table.findByIdAndUpdate(trip._id, {
            total_time: minutes,
            total_distance: trip.total_distance,
            providerLocation: trip.providerLocation,
            providerPreviousLocation: trip.providerPreviousLocation
        })

        await tripLocation.save();

        provider.providerPreviousLocation = providerPreviousLocation;
        provider.providerLocation = providerLocation;
        provider.location_updated_time = now;
        provider.bearing = req.body.bearing;

        if (setting_detail.is_receive_new_request_near_destination) {
            if (trip.trip_type != Number(constant_json.TRIP_TYPE_CAR_RENTAL) &&
                trip.is_ride_share != 1 &&
                trip.is_provider_status >= 6) {
                if (trip.destinationLocation) {
                    let destination_diff_km = Math.abs(utils.getDistanceFromTwoLocation(trip.destinationLocation, providerLocation));
                    let destination_diff_meter = destination_diff_km * 1000;
                    if (destination_diff_meter <= setting_detail.near_destination_radius) {
                        if (!provider.is_near_trip) { provider.is_near_trip = [] }
                        if (provider.is_near_trip.length == 0) {
                            provider.is_near_available = 1;
                        }
                    } else {
                        provider.is_near_available = 0;
                    }
                }
            }
        }
        await provider.save();

        return {
            success: true,
            location_unique_id: location_unique_id,
            providerLocation: provider.providerLocation,
            total_distance: trip.total_distance,
            total_time: trip.total_time,
            trip_id
        };
    } catch (e) {
        // console.log(e)
        provider.providerPreviousLocation = provider.providerLocation;
        provider.providerLocation = [req.body.latitude, req.body.longitude];
        provider.bearing = req.body.bearing;
        provider.location_updated_time = now;
        await provider.save()
        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
            wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [req.body.latitude, req.body.longitude], false, provider.location_updated_time);
        }
        return { success: true, location_unique_id: location_unique_id, providerLocation: provider.providerLocation };
    }
}


//// LOGOUT PROVIDER  SERVICE //
exports.logout = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let provider = await Provider.findOne({ _id: req.body.provider_id });
        if(req.body.is_admin_decline){
            let message = ERROR_CODE.DECLINE_BY_ADMIN
            res.json({ success: true, error_code: message })
            return
        }
        if (!provider) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
        }
        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }
        provider.device_token = "";
        provider.is_active = 0;
        provider.webpush_config = {}
        await provider.save();
        if(provider.zone_queue_id){
            await utils.remove_from_zone_queue_new(provider);
        }
        return res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_LOGOUT_SUCCESSFULLY });
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

////PROVIDER STATE change_provider_status 
exports.change_provider_status = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        try {
            let provider = await Provider.findOne({ _id: req.body.provider_id });
            let country = await Country.findOne({ _id: provider.country_id})
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }

            let city_detail = await City.findOne({ _id: provider.cityid });
            let city_timezone = city_detail.timezone;
            let state = Number(req.body.is_active);
            let start_time = null;
            let dateNow = new Date();
            if (provider.is_active != state) {
                if (state == 1) {
                    provider.start_online_time = dateNow;
                    provider.location_updated_time = dateNow;
                } else {
                    start_time = provider.start_online_time;
                    provider.start_online_time = null;
                    provider.is_go_home = 0;

                }
                provider.is_active = state;
                myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, 0, start_time,country._id,0);
            }

            socket_object.to("admin_panel").emit("provider_state_update", { 
                provider_id: provider._id, 
                providerLocation: provider.providerLocation,
                is_active: provider.is_active,
                is_available: provider.is_available
              });

            await provider.save();
            await utils.remove_from_zone_queue_new(provider);
            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACTIVE_SUCCESSFULLY,
                is_active: provider.is_active
            });
        } catch (e) {
            console.log(e)
            res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    });
};

exports.change_go_home_status = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        try {
            let provider = await Provider.findOne({ _id: req.body.provider_id });
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            if (!provider.address_location && Number(req.body.is_go_home) == 1) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_ADDRESS_NOT_ADDED });
            }
            if (!provider.address_location) { provider.address_location = [0, 0] }
            if (provider.address_location == [0, 0] && Number(req.body.is_go_home) == 1) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_ADDRESS_NOT_ADDED });
            }
            provider.is_go_home = Number(req.body.is_go_home);

            await provider.save();
            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACTIVE_SUCCESSFULLY
            });
        } catch (e) {
            console.log(e)
            res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    });
};
//////////////////////////////


/////////// update city type////////////

exports.provider_updatetype = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'typeid', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {

                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        utils.remove_from_zone_queue_new(provider);
                        let typeid = req.body.typeid;
                        provider.service_type = typeid;

                        Citytype.findOne({ _id: typeid }).then((city_type) => {
                            if (city_type) {
                                provider.cityid = city_type.cityid;
                                provider.city = city_type.cityname;

                                // start 2 april //
                                provider.admintypeid = city_type.typeid;
                                // end 2 april //
                                provider.save();
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_TYPE_UPDATE_SUCCESSFULLY
                                });

                            } else {
                                res.json({
                                    success: false,
                                    error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND
                                });
                            }

                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

exports.getproviderlatlong = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'trip_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {

                        Trip.findOne({ _id: req.body.trip_id, confirmed_provider: req.body.provider_id }).then((trip) => {

                            if (!trip) {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
                            } else {
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_GET_LATLONG,
                                    providerLocation: provider.providerLocation,
                                    bearing: provider.bearing,
                                    total_distance: trip.total_distance,
                                    total_time: trip.total_time
                                });
                            }

                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });

                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

///////////////   UPDATE DEVICE TOKEN///////
exports.update_device_token = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        provider.device_token = req.body.device_token;
                        provider.save().then(() => {
                            res.json({
                                success: true,
                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_DEVICE_TOKEN_UPDATE_SUCCESSFULLY
                            });
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

exports.get_provider_vehicle_list = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            let mongoose = require('mongoose');
            let Schema = mongoose.Types.ObjectId;
            let condition = { $match: { "provider_id": Schema(req.body.provider_id) } };
            let lookup = {
                $lookup:
                {
                    from: "types",
                    localField: "admin_type_id",
                    foreignField: "_id",
                    as: "type_detail"
                }
            };
            let unwind = {
                $unwind: {
                    path: "$type_detail",
                    preserveNullAndEmptyArrays: true
                }
            };

            let project = {
                $project: {
                    is_selected: 1,
                    admin_type_id: 1,
                    service_type: 1,
                    passing_year: 1,
                    color: 1,
                    model: 1,
                    plate_no: 1,
                    name: 1,
                    _id: 1,
                    is_documents_expired: 1,
                    is_document_uploaded: 1,
                    type_image_url: '$type_detail.type_image_url',
                    typename: '$type_detail.typename',
                    accessibility: 1,
                    plate_type: 1,
                    left_plate_letter: 1,
                    center_plate_letter: 1,
                    right_plate_letter: 1,
                    sequence_number: 1
                }
            }
            Vehicle.aggregate([condition, lookup, unwind, project]).then(async(vehicles) => {
                if (vehicles.length == 0) {
                    res.json({ success: true, vehicle_list: [] })
                } else {
                    const setting_detail = await Settings.findOne({}).select("is_wsal_service_use");
                    let provider = await Provider.findOne({_id: req.body.provider_id}).select("country_id");
                    let country_data = await Country.findOne({_id: provider.country_id}).select("is_use_wsal");
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
                        for (let i = 0; i < vehicles.length; i++) {
                            let vehicle = vehicles[i];
                            
                            let rejection_reason = [];
                            if(vehicle.wsal_rejection_reason && vehicle.wsal_rejection_reason.length > 0){
                                for (const reason of vehicle.wsal_rejection_reason) {
                                    let push_code_response = await utils.getPushCodeString(reason);
                                    rejection_reason.push(push_code_response.sms_string);
                                }
                            } else {
                                let push_code_response = await utils.getPushCodeString("INVALID_ID");
                                rejection_reason.push(push_code_response.sms_string);
                            }
                            vehicle.wsal_rejection_reason = rejection_reason;
                        }
                    }

                    res.json({ success: true, vehicle_list: vehicles })
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
            })
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.change_current_vehicle = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'vehicle_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        try {
            const setting_detail = await Settings.findOne({})
            let provider = await Provider.findOne({ _id: req.body.provider_id })
            let vehicle = await Vehicle.findOne({_id: Schema(req.body.vehicle_id)})
            let country_data = await Country.findOne({_id: provider.country_id})
            if(provider.service_type == null){
                return res.json({success:false,error_code:error_message.ERROR_CODE_VEHICLE_NOT_APPROVED})
            }
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }

            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && (vehicle.wsal_eligibility == '' || vehicle.wsal_eligibility == 'INVALID')){
                var wsal_services_response = await wsal_services.DriverVehicleRegistrationServiceStatusCheck(provider._id, req.body.vehicle_id);
                if(!wsal_services_response.success){
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_VALID_FOR_WSAL });
                }
            }

            let selected_vehicle = await Vehicle.findOneAndUpdate({ provider_id: provider._id, is_selected: true}, {is_selected: false})
            let vehicle_detail = await Vehicle.findByIdAndUpdate(req.body.vehicle_id, {is_selected: true}, {new: true})
            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && (vehicle_detail.wsal_eligibility == ''|| vehicle.wsal_eligibility == 'INVALID')){
                wsal_services.DriverVehicleRegistrationService(provider._id, vehicle_detail._id)
            }
            if (vehicle_detail.service_type == null) {
                return res.json({ success: false });
            }

            provider.service_type = vehicle_detail.service_type;
            provider.admintypeid = vehicle_detail.admin_type_id;
            provider.vehicle_type = vehicle_detail.vehicle_type;
            provider.is_vehicle_document_uploaded = vehicle_detail.is_document_uploaded;

            if (String(selected_vehicle.service_type) != String(req.body.service_type)) {
                await Trip.updateMany(
                    {
                        current_provider: provider._id,
                        type_id: selected_vehicle.admin_type_id,
                        is_provider_assigned_by_dispatcher: true
                    },
                    {
                        current_provider: null,
                        confirmed_provider: null,
                        $pull: { current_providers: provider._id },
                        is_provider_assigned_by_dispatcher: false,
                        is_provider_accepted: 0
                    }
                );

                await OpenRide.updateMany(
                    {
                        provider_id: provider._id,
                        type_id: selected_vehicle.admin_type_id
                    },
                    {
                        is_provider_accepted: 0,
                        is_trip_end : 1, 
                        is_trip_cancelled_by_provider : 1,
                        is_trip_cancelled : 1
                    }
                );
                await Provider.updateOne({ _id: provider._id }, { schedule_trip: [], open_ride: [] })
            }

            await provider.save();
            await utils.remove_from_zone_queue_new(provider);
            return res.json({ success: true })
        } catch (e) {
            console.log(e);
            return res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    });
};

exports.get_provider_vehicle_detail = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'vehicle_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let vehicle_detail = await Vehicle.findOne({ _id: req.body.vehicle_id })

                        if (!vehicle_detail) {
                            res.json({ success: false })
                        } else {
                            Provider_Vehicle_Document.find({ $and: [{vehicle_id: req.body.vehicle_id}, {is_visible: true}] }).then((provider_vehicle_document) => {
                                Type.findOne({ _id: vehicle_detail.admin_type_id }).then((type) => {
                                    if (type) {
                                        vehicle_detail.type_image_url = type.type_image_url;
                                        res.json({
                                            success: true,
                                            vehicle_detail: vehicle_detail,
                                            document_list: provider_vehicle_document
                                        })

                                    } else {
                                        vehicle_detail.type_image_url = '';
                                        res.json({
                                            success: true,
                                            vehicle_detail: vehicle_detail,
                                            document_list: provider_vehicle_document
                                        })

                                    }
                                }, (err) => {
                                    console.log(err);
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                })
                            });
                        }
                    }
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

exports.upload_vehicle_document = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'vehicle_id', type: 'string' }, { name: 'document_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        Provider_Vehicle_Document.findOne({
                            _id: req.body.document_id,
                            vehicle_id: req.body.vehicle_id,
                            provider_id: req.body.provider_id
                        }).then((providervehicledocument) => {
                            if (providervehicledocument) {
                                if (req.files != undefined && req.files.length > 0) {
                                    utils.deleteImageFromFolder(providervehicledocument.document_picture, 3);
                                    let image_name = providervehicledocument._id + utils.tokenGenerator(4);
                                    let mime_type = req.files[0].mimetype.split('/')[1]
                                    let url = utils.getImageFolderPath(req, 3) + image_name + '.' + mime_type;
                                    providervehicledocument.document_picture = url;
                                    utils.saveImageFromBrowser(req.files[0].path, image_name + '.' + mime_type , 3);
                                }
                                providervehicledocument.is_uploaded = 1;
                                providervehicledocument.unique_code = req.body.unique_code;
                                providervehicledocument.expired_date = req.body.expired_date;
                                providervehicledocument.is_document_expired = false;


                                providervehicledocument.save().then(() => {
                                    Provider_Vehicle_Document.find({
                                        vehicle_id: req.body.vehicle_id,
                                        option: 1,
                                        is_visible: true,
                                        provider_id: req.body.provider_id,
                                        is_uploaded: 0
                                    }).then((providervehicledocumentuploaded) => {
                                        Provider_Vehicle_Document.find({
                                            vehicle_id: req.body.vehicle_id,
                                            option: 1,
                                            is_visible: true,
                                            provider_id: req.body.provider_id,
                                            is_document_expired: true
                                        }).then(async (expired_providervehicledocumentuploaded) => {
                                            let vehicle_detail = await Vehicle.findOne({ _id: req.body.vehicle_id })

                                            if (expired_providervehicledocumentuploaded.length == 0) {
                                                vehicle_detail.is_documents_expired = false;
                                            } else {
                                                vehicle_detail.is_documents_expired = true;
                                            }
                                            if (providervehicledocumentuploaded.length == 0) {
                                                vehicle_detail.is_document_uploaded = true;
                                            } else {
                                                vehicle_detail.is_document_uploaded = false;
                                            }

                                            if (vehicle_detail.is_selected) {
                                                if (providervehicledocumentuploaded.length == 0) {
                                                    provider.is_vehicle_document_uploaded = true;
                                                } else {
                                                    provider.is_vehicle_document_uploaded = false;
                                                }
                                            }
                                            await vehicle_detail.save();
                                            await provider.save();
                                        });

                                    });
                                    // }
                                    res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_VEHICLE_UPLOAD_DOCUMENT_SUCCESSFULLY, document_detail: providervehicledocument })
                                }, (err) => {
                                    console.log(err);
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                });

                            } else {
                                res.json({ success: false })
                            }
                        });
                    }
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                });
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

exports.provider_update_vehicle_detail = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'vehicle_name', type: 'string' }, { name: 'plate_no', type: 'string' },
    { name: 'model', type: 'string' }, { name: 'color', type: 'string' }, { name: 'passing_year', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        const setting_detail = await Settings.findOne({})
                        let vehicle_detail = await Vehicle.findOne({ _id: req.body.vehicle_id })
                        let country_data = await Country.findOne({ _id: provider.country_id })
                        if (!vehicle_detail) {
                            res.json({ success: false })
                        } else {

                            vehicle_detail.name = req.body.vehicle_name;
                            vehicle_detail.plate_no = req.body.plate_no;
                            vehicle_detail.model = req.body.model;
                            vehicle_detail.color = req.body.color;
                            vehicle_detail.accessibility = req.body.accessibility;
                            vehicle_detail.passing_year = req.body.passing_year;
                            await vehicle_detail.save();
                            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && vehicle_detail.is_selected){
                                wsal_services.DriverVehicleRegistrationService(provider._id, vehicle_detail._id)
                            }
                            res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_UPDATE_VEHICLE_SUCCESSFULLY, vehicle_detail: vehicle_detail })
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

exports.provider_add_vehicle = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'vehicle_name', type: 'string' },
    { name: 'passing_year', type: 'string' }, { name: 'model', type: 'string' }, { name: 'color', type: 'string' },
    { name: 'plate_no', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        const setting_detail = await Settings.findOne({})
                        let vehicle_count = await Vehicle.count({ user_type_id: provider._id })

                        if (vehicle_count == 0) {
                            provider.service_type = null;
                            provider.admintypeid = null;
                        }
                        let mongoose = require('mongoose');
                        let ObjectId = mongoose.Types.ObjectId;
                        let x = new ObjectId();

                        let plate_type_number = "6"
                        if(req.body.plate_type){
                            let plate_type_name = req.body.plate_type.trim().toLowerCase();

                            switch (plate_type_name) {
                            case "private":
                                plate_type_number = "1";
                                break;
                            case "public transport":
                                plate_type_number = "2";
                                break;
                            case "private transport":
                                plate_type_number = "3";
                                break;
                            case "public minibus":
                                plate_type_number = "4";
                                break;
                            case "private minibus":
                                plate_type_number = "5";
                                break;
                            case "taxi":
                                plate_type_number = "6";
                                break;
                            case "heavy equipment":
                                plate_type_number = "7";
                                break;
                            case "export":
                                plate_type_number = "8";
                                break;
                            case "diplomatic":
                                plate_type_number = "9";
                                break;
                            case "motorcycle":
                                plate_type_number = "10";
                                break;
                            case "temporary":
                                plate_type_number = "11";
                                break;
                            default:
                                plate_type_number = "6"; // Default to "Taxi" if no match
                            }
                        }

                        let vehicel_json = {
                            _id: x,
                            name: req.body.vehicle_name,
                            user_type_id: provider._id,
                            provider_id: provider._id,
                            user_type: TYPE_VALUE.PROVIDER,
                            accessibility: req.body.accessibility,
                            plate_no: req.body.plate_no,
                            model: req.body.model,
                            color: req.body.color,
                            passing_year: req.body.passing_year,
                            service_type: null,
                            admin_type_id: null,
                            is_documents_expired: false,
                            is_selected: false,
                            vehicle_type: req.body.vehicle_type || VEHICLE_TYPE.NORMAL,
                            is_document_uploaded: false,
                            sequence_number: req.body.sequence_number,
                            plate_type: plate_type_number,
                            left_plate_letter: req.body.left_plate_letter,
                            center_plate_letter: req.body.center_plate_letter,
                            right_plate_letter: req.body.right_plate_letter,
                        }

                        if (req.body.service_type) {
                            vehicel_json.service_type = Schema(req.body.service_type);
                            vehicel_json.admin_type_id = Schema(req.body.admin_type_id);
                            if (vehicle_count == 0) {
                                provider.service_type = Schema(req.body.service_type);
                                provider.admintypeid = Schema(req.body.admin_type_id);
                                provider.vehicle_type = vehicel_json.vehicle_type;
                                provider.is_approved = 1;
                                provider.is_document_uploaded = 1;
                                provider.is_vehicle_document_uploaded = true;
                                vehicel_json.is_selected = true;
                                vehicel_json.is_document_uploaded = true;
                            }
                        }

                        Country.findOne({ _id: provider.country_id }).then((country) => {

                            Document.find({ countryid: country._id, type: 2 , is_visible:true }).then(async (document) => {

                                let is_document_uploaded = false;

                                let document_size = document.length;

                                if (document_size !== 0) {

                                    let count = 0;
                                    for (let i = 0; i < document_size; i++) {

                                        if (document[i].option == 0) {
                                            count++;
                                        } else {
                                            break;
                                        }
                                        if (count == document_size) {
                                            is_document_uploaded = true;
                                        }
                                    }

                                    document.forEach(function (entry) {
                                        let providervehicledocument = new Provider_Vehicle_Document({
                                            vehicle_id: x,
                                            provider_id: provider._id,
                                            country_id: provider.country_id,
                                            document_id: entry._id,
                                            name: entry.title,
                                            option: entry.option,
                                            document_picture: "",
                                            unique_code: entry.unique_code,
                                            expired_date: "",
                                            is_unique_code: entry.is_unique_code,
                                            is_expired_date: entry.is_expired_date,
                                            is_document_expired: false,
                                            is_uploaded: 0,
                                            is_visible: entry.is_visible
                                        });
                                        providervehicledocument.save().then(() => {
                                        });
                                    });
                                    vehicel_json.is_document_uploaded = is_document_uploaded;
                                } else {
                                    vehicel_json.is_document_uploaded = true;
                                }

                                await utils.addVehicle(vehicel_json);
                                provider.save().then(() => {
                                    Provider_Vehicle_Document.find({ vehicle_id: x }, function (err, provider_vehicle_document) {
                                        res.json({
                                            success: true,
                                            vehicle_detail: vehicel_json,
                                            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_ADD_VEHICLE_SUCCESSFULLY,
                                            document_list: provider_vehicle_document
                                        })
                                    });
                                    if(setting_detail.is_wsal_service_use && country.is_use_wsal && vehicle_count == 0){
                                        wsal_services.DriverVehicleRegistrationService(provider._id);
                                    }
                                }, (err) => {
                                    console.log(err);
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                });
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
    });

};

//update_provider_setting
exports.update_provider_setting = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        provider.languages = req.body.languages;
                        provider.received_trip_from_gender = req.body.received_trip_from_gender;
                        if (typeof req.body.is_go_home != 'undefined') {
                            provider.is_go_home = req.body.is_go_home;
                        }
                        if (typeof req.body.address != 'undefined') {
                            provider.address = req.body.address;
                        }
                        if (typeof req.body.address_location != 'undefined') {
                            provider.address_location = req.body.address_location;
                        }

                        provider.save().then(() => {
                            res.json({
                                success: true, languages: provider.languages,
                                received_trip_from_gender: provider.received_trip_from_gender
                            })
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });
                    }

                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_GET_YOUR_DETAIL });

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

exports.get_provider_setting_detail = async function (req, res) {  
    const setting_detail = await Settings.findOne({});
    let terms_and_condition_url = `${setting_detail.driver_panel_url}/legal/provider-terms-conditions` 
    let privacy_policy_url = `${setting_detail.driver_panel_url}/legal/provider-privacy-policy`

    let setting_response = {};
    setting_response.is_provider_social_login = setting_detail.is_provider_social_login
    setting_response.is_provider_login_using_otp = setting_detail.is_provider_login_using_otp
    setting_response.terms_and_condition_url = terms_and_condition_url
    setting_response.privacy_policy_url = privacy_policy_url
    setting_response.admin_phone = setting_detail.admin_phone;
    setting_response.contactUsEmail = setting_detail.contactUsEmail;
    setting_response.is_tip = setting_detail.is_tip;
    setting_response.is_toll = setting_detail.is_toll;
    setting_response.scheduled_request_pre_start_minute = setting_detail.scheduled_request_pre_start_minute;
    setting_response.providerEmailVerification = setting_detail.providerEmailVerification;
    setting_response.stripe_publishable_key = setting_detail.stripe_publishable_key;
    setting_response.providerSms = setting_detail.providerSms;
    setting_response.twilio_call_masking = setting_detail.twilio_call_masking;
    setting_response.is_provider_initiate_trip = false; // only for without login
    setting_response.providerPath = setting_detail.providerPath;
    setting_response.image_base_url = setting_detail.image_base_url;
    setting_response.is_show_estimation_in_provider_app = setting_detail.is_show_estimation_in_provider_app;
    setting_response.is_show_estimation_in_user_app = setting_detail.is_show_estimation_in_user_app;
    setting_response.is_driver_go_home = setting_detail.is_driver_go_home;
    setting_response.is_driver_go_home_change_address = setting_detail.is_driver_go_home_change_address;
    setting_response.paypal_secret_key = setting_detail.paypal_secret_key
    setting_response.paypal_client_id = setting_detail.paypal_client_id
    setting_response.paypal_environment = setting_detail.paypal_environment
    setting_response.webpush_public_key = setting_detail.webpush_public_key
    setting_response.decimal_point_value = setting_detail.decimal_point_value
    setting_response.is_show_user_details_in_provider_app = setting_detail.is_show_user_details_in_provider_app
    setting_response.android_provider_app_gcm_key = setting_detail.android_provider_app_gcm_key

    setting_response.is_allow_biometric_verification_for_driver = setting_detail.is_allow_biometric_verification_for_driver

    setting_response.android_driver_app_url = setting_detail.android_driver_app_url
    setting_response.ios_driver_app_url = setting_detail.ios_driver_app_url
    setting_response.is_use_captcha = setting_detail.is_use_captcha;
    setting_response.recaptcha_site_key_for_web = setting_detail.recaptcha_site_key_for_web;
    setting_response.recaptcha_secret_key_for_web = setting_detail.recaptcha_secret_key_for_web;
    setting_response.recaptcha_secret_key_for_android = setting_detail.recaptcha_secret_key_for_android;
    setting_response.recaptcha_secret_key_for_ios = setting_detail.recaptcha_secret_key_for_ios;    
    setting_response.web_app_google_key = setting_detail.web_app_google_key    
   
    setting_response.driver_panel_google_key = setting_detail.driver_panel_google_key;    
    setting_response.partner_panel_google_key = setting_detail.partner_panel_google_key;   
    
    setting_response.flutter_user_app_google_places_autocomplete_key = setting_detail.flutter_user_app_google_places_autocomplete_key
    setting_response.flutter_driver_app_google_places_autocomplete_key = setting_detail.flutter_driver_app_google_places_autocomplete_key
    setting_response.is_allow_fake_gps = setting_detail.is_allow_fake_gps
    setting_response.is_wsal_service_use = setting_detail.is_wsal_service_use

    if (req.body.device_type == 'android') {
        setting_response.android_provider_app_google_key = setting_detail.android_provider_app_google_key;
        setting_response.android_provider_app_version_code = setting_detail.android_provider_app_version_code;
        setting_response.android_provider_app_force_update = setting_detail.android_provider_app_force_update;
        setting_response.android_places_autocomplete_key = setting_detail.android_places_autocomplete_key;
        setting_response.recaptcha_site_key_for_android = setting_detail.recaptcha_site_key_for_android

        setting_response.android_driver_app_google_map_key = setting_detail.android_driver_app_google_map_key;
        setting_response.android_driver_app_google_places_autocomplete_key = setting_detail.android_driver_app_google_places_autocomplete_key;
        setting_response.android_driver_app_google_geocoding_key = setting_detail.android_driver_app_google_geocoding_key;
        setting_response.android_driver_app_google_distance_matrix_key = setting_detail.android_driver_app_google_distance_matrix_key;
        setting_response.android_driver_app_google_direction_matrix_key = setting_detail.android_driver_app_google_direction_matrix_key;

    } else {
        setting_response.ios_provider_app_google_key = setting_detail.ios_provider_app_google_key;
        setting_response.ios_provider_app_version_code = setting_detail.ios_provider_app_version_code;
        setting_response.ios_provider_app_force_update = setting_detail.ios_provider_app_force_update;
        setting_response.ios_places_autocomplete_key = setting_detail.ios_places_autocomplete_key;
        setting_response.recaptcha_site_key_for_ios = setting_detail.recaptcha_site_key_for_ios

        setting_response.ios_driver_app_google_map_key = setting_detail.ios_driver_app_google_map_key;
        setting_response.ios_driver_app_google_places_autocomplete_key = setting_detail.ios_driver_app_google_places_autocomplete_key;
        setting_response.ios_driver_app_google_geocoding_key = setting_detail.ios_driver_app_google_geocoding_key;
        setting_response.ios_driver_app_google_distance_matrix_key = setting_detail.ios_driver_app_google_distance_matrix_key;
        setting_response.ios_driver_app_google_direction_matrix_key = setting_detail.ios_driver_app_google_direction_matrix_key;

    }

    setting_response.minimum_phone_number_length = setting_detail.minimum_phone_number_length;
    setting_response.maximum_phone_number_length = setting_detail.maximum_phone_number_length;

    let provider_id = req.body.provider_id;
    if (provider_id == '') {
        provider_id = null;
    }

    Provider.findOne({ _id: provider_id }).then(async (provider_detail) => {
        if (provider_detail && provider_detail.token !== req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN, setting_detail: setting_response });
        } else {
            let response = {};
            if (provider_detail) {
                
                if (req.body.app_version && req.body.app_version != provider_detail.app_version) {
                    provider_detail.app_version = req.body.app_version
                    provider_detail.device_token = req.body.device_type
                    await provider_detail.save()
                }

                provider_detail = await utils.checkNewDocumentsAdded(provider_detail, DOCUMENT_TYPE.PROVIDER);
                provider_detail = await utils.checkNewDocumentsAdded(provider_detail, DOCUMENT_TYPE.VEHICLE);
                let country_condition = { countryname: provider_detail.country }
                if (provider_detail.country_id) {
                    country_condition = {
                        $or: [
                            { _id: provider_detail.country_id },
                            { countryname: provider_detail.country },
                        ]
                    }
                }

                let alpha2 = country_json.filter((country) => country.name == provider_detail.country) || null
        	
                Country.findOne(country_condition).then(async (country) => {
                    let city = await City.findOne({_id: provider_detail.cityid});
                    if(city){
                        setting_response.is_provider_initiate_trip = city.is_provider_initiate_trip;
                    }
                    response.first_name = provider_detail.first_name;
                    response.last_name = provider_detail.last_name;
                    response.email = provider_detail.email;
                    response.country_phone_code = provider_detail.country_phone_code;
                    response.is_document_uploaded = provider_detail.is_document_uploaded;
                    response.address = provider_detail.address;
                    response.address_location = provider_detail.address_location;
                    response.is_approved = provider_detail.is_approved;
                    response._id = provider_detail._id;
                    response.social_ids = provider_detail.social_ids;
                    response.social_unique_id = provider_detail.social_unique_id;
                    response.phone = provider_detail.phone;
                    response.login_by = provider_detail.login_by;
                    response.is_documents_expired = provider_detail.is_documents_expired;
                    response.account_id = provider_detail.account_id;
                    response.bank_id = provider_detail.bank_id;
                    response.city = provider_detail.city;
                    response.country = provider_detail.country;
                    response.rate = provider_detail.rate;
                    response.rate_count = provider_detail.rate_count;
                    response.token = provider_detail.token;
                    response.is_vehicle_document_uploaded = provider_detail.is_vehicle_document_uploaded;
                    response.service_type = provider_detail.service_type;
                    response.admintypeid = provider_detail.admintypeid;
                    response.is_available = provider_detail.is_available;
                    response.is_active = provider_detail.is_active;
                    response.is_go_home = provider_detail.is_go_home;
                    response.is_partner_approved_by_admin = provider_detail.is_partner_approved_by_admin;
                    response.picture = provider_detail.picture;
                    response.wallet_currency_code = provider_detail.wallet_currency_code;
                    response.is_referral = provider_detail.is_referral;
                    response.referral_code = provider_detail.referral_code;
                    response.total_redeem_point = provider_detail.total_redeem_point
                    response.driver_redeem_point_value = country?.driver_redeem_settings[0]?.driver_redeem_point_value
                    response.driver_minimum_point_require_for_withdrawal = country?.driver_redeem_settings[0]?.driver_minimum_point_require_for_withdrawal
                    response.alpha2 = alpha2[0]?.alpha2
                    response.country_detail = { "is_referral": country.is_provider_referral, "is_use_wsal": setting_detail.is_wsal_service_use && country.is_use_wsal };
                    response.created_at = provider_detail.created_at;
                    response.is_send_money_for_provider = country.is_send_money_for_provider ? country.is_send_money_for_provider : false
                    response.date_of_birth = provider_detail.date_of_birth;
                    response.national_id = provider_detail.national_id;
                    response.is_driver_approved_from_wsal = provider_detail.is_driver_approved_from_wsal;
                    if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                        let rejection_reason = [];
                        if( !provider_detail.is_driver_approved_from_wsal ){
                            if(provider_detail.wsal_rejection_reason && provider_detail.wsal_rejection_reason.length > 0){
                                rejection_reason = provider_detail.wsal_rejection_reason;
                            } else if (provider_detail.wsal_criminal_record_status != "DONE_RESULT_OK" ){
                                rejection_reason = [provider_detail.wsal_criminal_record_status];
                            } else {
                                rejection_reason = ["INVALID"];
                            }
                        }
                        response.wsal_rejection_reason = rejection_reason;
                    }
                    if (!provider_detail.is_near_trip) { provider_detail.is_near_trip = [] }
                    if (provider_detail.is_trip.length == 0 && provider_detail.is_near_trip.length != 0) {
                        provider_detail.is_trip = provider_detail.is_near_trip;
                        provider_detail.is_available = 0;
                        provider_detail.is_near_trip = []
                        await provider_detail.save();
                    }
                    if (!provider_detail.is_available && !provider_detail.is_trip?.length && !provider_detail.is_near_trip?.length && !provider_detail.schedule_trip?.length) {
                        provider_detail.is_available = 1;
                        await provider_detail.save();
                        response.is_available = provider_detail.is_available;
                    }

                    let near_trip_detail = undefined;
                    let near_trip_details = undefined;
                    if (provider_detail.is_near_trip.length != 0) {
                        near_trip_detail = await Trip.findOne({ _id: provider_detail.is_near_trip[0], is_provider_accepted: 0 })
                    }

                    if (near_trip_detail) {
                        let start_time = near_trip_detail.updated_at;
                        let end_time = new Date();
                        let res_sec = utils.getTimeDifferenceInSecond(end_time, start_time);
                        let provider_timeout = setting_detail.provider_timeout;

                        if(near_trip_detail.is_trip_bidding){
                            let country_detail = await Country.findOne({_id: near_trip_detail.country_id},{provider_bidding_timeout: 1});
                            provider_timeout = country_detail.provider_bidding_timeout;
                        }
                        let time_left_to_responds_trip = provider_timeout - res_sec;
                        let new_user_detail = await User.findOne({ _id: near_trip_detail.user_id })
                        near_trip_details = {
                            trip_id: provider_detail.is_near_trip[0],
                            user_id: near_trip_detail.user_id,
                            is_provider_accepted: near_trip_detail.is_provider_accepted,
                            is_provider_status: near_trip_detail.is_provider_status,
                            trip_type: near_trip_detail.trip_type,
                            source_address: near_trip_detail.source_address,
                            destination_address: near_trip_detail.destination_address,
                            sourceLocation: near_trip_detail.sourceLocation,
                            destinationLocation: near_trip_detail.destinationLocation,
                            is_trip_end: near_trip_detail.is_trip_end,
                            time_left_to_responds_trip: time_left_to_responds_trip,
                            user: {
                                first_name: new_user_detail.first_name,
                                last_name: new_user_detail.last_name,
                                phone: new_user_detail.phone,
                                country_phone_code: new_user_detail.country_phone_code,
                                rate: new_user_detail.rate,
                                rate_count: new_user_detail.rate_count,
                                picture: new_user_detail.picture
                            }
                        }
                    }

                    let filtered_is_trip = provider_detail.is_trip
                    if(provider_detail.is_trip.length > 0){
                        filtered_is_trip = await provider_detail.is_trip.filter(async trip => !provider_detail.bids.some(bid => bid.trip_id.toString() === trip.toString()));
                    }
                    let trips = provider_detail.schedule_trip ? [...provider_detail.schedule_trip, ...filtered_is_trip] : filtered_is_trip
                    console.log(trips);
                    return res.json({
                        success: true, setting_detail: setting_response, phone_number_min_length: setting_detail.minimum_phone_number_length,
                        phone_number_length: setting_detail.maximum_phone_number_length,
                        provider_detail: response, trip_detail: trips, near_trip_detail: near_trip_details
                    });
                });

            } else {
                res.json({ success: true, setting_detail: setting_response })
            }
        }
    })
};



exports.get_provider_privacy_policy = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    res.send(setting_detail.provider_privacy_policy)
};

exports.get_provider_terms_and_condition = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    res.send(setting_detail.provider_terms_and_condition)
};



exports.apply_provider_referral_code = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, { name: 'referral_code', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }, function (err, provider) {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let is_skip = req.body.is_skip;

                        if (is_skip == 0) {
                            if(provider.referral_code == req.body.referral_code) {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_USER_OWN_REFERRAL });
                            } 
                            let referral_code = req.body.referral_code;
                            Provider.findOne({ referral_code: referral_code }).then((providerData) => {
                                if (!providerData) {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_REFERRAL_CODE_INVALID });
                                } else if (providerData.country != provider.country) {
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_YOUR_FRIEND_COUNTRY_NOT_MATCH_WITH_YOU
                                    });
                                } else {

                                    if (provider.is_referral == 1) {
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_YOU_HAVE_ALREADY_APPLY_REFERRAL_CODE
                                        });
                                    } else {
                                        Country.findOne({ countryphonecode: provider.country_phone_code }).then((country) => {

                                            let providerRefferalCount = providerData.total_referrals;

                                            if (providerRefferalCount < country.providerreferral) {

                                                let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, providerData.unique_id, providerData._id, null,
                                                    providerData.wallet_currency_code, providerData.wallet_currency_code,
                                                    1, country.bonus_to_providerreferral, providerData.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_REFERRAL, "Provider used your referral code, provider id : " + provider.unique_id);

                                                providerData.total_referrals = +providerData.total_referrals + 1;
                                                providerData.wallet = total_wallet_amount;
                                                providerData.save().then(() => {
                                                });

                                                provider.is_referral = 1;
                                                provider.referred_by = providerData._id;

                                                total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, null,
                                                    provider.wallet_currency_code, provider.wallet_currency_code,
                                                    1, country.referral_bonus_to_provider, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_REFERRAL, "Using refferal code : " + referral_code + " of provider id : " + providerData.unique_id);

                                                provider.wallet = total_wallet_amount;
                                                provider.save().then(() => {
                                                    res.json({
                                                        success: true,
                                                        message: success_messages.MESSAGE_CODE_REFERRAL_PROCESS_SUCCESSFULLY_COMPLETED
                                                    });
                                                });

                                            } else {

                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_REFERRAL_LIMIT_REACHED
                                                });
                                            }

                                        });
                                    }
                                }

                            });
                        } else {
                            provider.is_referral = 1;
                            provider.save().then(() => {
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_YOU_HAVE_SKIPPED_FOR_REFERRAL_PROCESS
                                });


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


exports.get_provider_referal_credit = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {

                        let condition = { $match: { user_id: { $eq: Schema(req.body.provider_id) } } }
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
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });

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

exports.delete_provider = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }
        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }
        let password = utils.encryptPassword(req.body.password ? req.body.password : '');
        let social_index = provider.social_ids.indexOf(req.body.social_id);
        let message
        if (social_index !== -1 || provider.password == password) {
            if (provider.is_trip.length != 0) {
                let message = error_message.ERROR_CODE_TRIP_RUNNING
                return res.json({ success: false, error_code: message })
            }
            let ride_details = await OpenRide.countDocuments({
                $and: [
                    {confirmed_provider: provider._id},
                    {is_trip_end: 0},
                    {is_trip_completed: 0},
                    {is_trip_cancelled: 0}
                ]
               
            })
            
            if (ride_details > 0) {
                message = error_message.ERROR_CODE_PLEASE_DELETE_YOUR_FUTURE_RIDE_FIRST
                return res.json({ success: false, error_code: message })
            }

            let provider_detail = await Provider.findOne({ phone: '0000000000' });
            if (!provider_detail) {
                provider_detail = new Provider({
                    _id: Schema('000000000000000000000000'),
                    first_name: 'anonymous',
                    last_name: 'provider',
                    email: 'anonymousprovider@gmail.com',
                    phone: '0000000000',
                    country_phone_code: '',
                })
                await provider_detail.save();
            }

            await Trip_history.updateMany({ confirmed_provider: provider._id }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id });
            await Trip.updateMany({ confirmed_provider: provider._id }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id });
            await OpenRide.updateMany({ confirmed_provider: provider._id }, { confirmed_provider: provider_detail._id, provider_id: provider_detail._id });
            await Wallet_history.updateMany({ user_id: provider._id }, { user_id: provider_detail._id });
            await Card.deleteMany({ user_id: provider._id });
            await Provider_Document.deleteMany({ provider_id: provider._id });
            await Provider_Vehicle_Document.deleteMany({ provider_id: provider._id });
            await Provider.deleteOne({ _id: provider._id });
            await Vehicle.updateMany({provider_id:provider._id},{$set:{provider_id:null}})
            await CityZone.updateMany({},{$pull:{total_provider_in_zone_queue:provider._id}})
            await Transfer_history.updateMany({ user_id: provider._id }, { user_id: provider_detail._id });
            utils.delete_firebase_user(provider.uid);

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
    catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.get_provider_hub_vehicle_list = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (response.success) {
            
            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            
            console.log(provider.cityid);
            let hubs = await Hub.find({city_id: provider.cityid},{_id: 1, name: 1, kmlzone: 1, address: 1, location: 1});
            console.log(hubs);
            let is_hub_found = false;
            let selected_hub = null;
            
            await hubs.forEach(hub => {
                console.log(hub.kmlzone);
                is_hub_found = geolib.isPointInside(
                    { latitude: req.body.latitude, longitude: req.body.longitude },
                    hub.kmlzone
                    );
                    if(is_hub_found){
                        selected_hub = hub
                    }
            });

            if(selected_hub){
                let condition = { $match: {$and: [
                    { "user_type_id": selected_hub._id },
                    { "is_document_uploaded": true },
                    { "is_documents_expired": false },
                    { "is_assigned": false }
                    
                ]} };
    
                let lookup = {
                    $lookup:
                    {
                        from: "types",
                        localField: "admin_type_id",
                        foreignField: "_id",
                        as: "type_detail"
                    }
                };
                let unwind = {
                    $unwind: {
                        path: "$type_detail",
                        preserveNullAndEmptyArrays: true
                    }
                };
    
                let project = {
                    $project: {
                        is_selected: 1,
                        admin_type_id: 1,
                        service_type: 1,
                        passing_year: 1,
                        color: 1,
                        model: 1,
                        plate_no: 1,
                        name: 1,
                        _id: 1,
                        is_documents_expired: 1,
                        is_document_uploaded: 1,
                        type_image_url: '$type_detail.type_image_url',
                        typename: '$type_detail.typename',
                        accessibility: 1,
                    }
                }
                Vehicle.aggregate([condition, lookup, unwind, project]).then((vehicles) => {
                    if (vehicles.length == 0) {
                        return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_VEHICLE_AVAILABLE })
                    } else {
                        return res.json({ success: true, vehicle_list: vehicles, hub: selected_hub })
                    }
                }, (err) => {
                    console.log(err);
                    return res.json({
                        success: false,
                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                    });
                })
            }else{
                return res.json({ success: false, error_code: error_message.ERROR_CODE_OUTSIDE_HUB_AREA });
            }

        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.provider_pick_hub_vehicle = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' },{ name: 'vehicle_id', type: 'string' }], async function (response) {
        if (response.success) {
            
            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
 
            if (provider.is_approved == 0) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED });
            }
 
            let vehicle = await Vehicle.findOne({_id: req.body.vehicle_id})
            let provider_vehicle = await Vehicle.findOne({provider_id: provider._id})
 
            if(provider_vehicle){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_ALREADY_PICKED })
            }
 
            if(vehicle.is_assigned){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_ALREADY_PICKED })
            }
 
            vehicle.provider_id = provider._id;
            vehicle.is_selected = true;
            vehicle.is_assigned = true;
            vehicle.save();
 
            provider.admintypeid = vehicle.admin_type_id;
            provider.vehicle_type = vehicle.vehicle_type;
            provider.service_type = vehicle.service_type;
            provider.is_vehicle_document_uploaded = vehicle.is_document_uploaded;
            provider.provider_type_id = vehicle.user_type_id;
            await provider.save();
 
            let history_type = VEHICLE_HISTORY_TYPE.PICKED
            utils.add_vehicle_history(vehicle, history_type, {
                user_id: provider._id,
                name: provider.first_name + " " + provider.last_name,
                email: provider.email,
                unique_id: provider.unique_id
            }, null, TYPE_VALUE.PROVIDER)
 
            return res.json({ success: true, message: success_messages.MESSAGE_CODE_VEHICLE_PICKED_SUCCESSFULLY});
 
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.provider_drop_hub_vehicle = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' },{ name: 'vehicle_id', type: 'string' }], async function (response) {
        if (response.success) {
            
            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            let open_ride_count = await OpenRide.count({ provider_id: provider._id, is_trip_end : 0, is_trip_completed : 0, is_trip_cancelled : 0 });
            if (open_ride_count > 0) {
                return res.json({success: false, error_code: error_message.ERROR_CODE_PLEASE_DELETE_YOUR_FUTURE_RIDE_FIRST})
            }
            let vehicle = await Vehicle.findOne({_id: req.body.vehicle_id})
            let hub = await Hub.findOne({_id: vehicle.user_type_id});
            let is_hub_found = false;
            
            let latitude = req.body.latitude || provider.providerLocation[0]
            let longitude = req.body.longitude || provider.providerLocation[1]
            
            is_hub_found = geolib.isPointInside(
                { latitude: latitude, longitude: longitude },
                hub.kmlzone
            );
            if(is_hub_found){
                await Trip.updateMany(
                    {
                        current_provider: provider._id,
                        service_type_id: provider.service_type,
                        is_provider_assigned_by_dispatcher: true
                    },
                    {
                        current_provider: null,
                        confirmed_provider: null,
                        $pull: { current_providers: provider._id },
                        is_provider_assigned_by_dispatcher: false,
                        is_provider_accepted: 0
                    }
                );
                await Provider.updateOne({ _id: provider._id }, { schedule_trip: [] })
                vehicle.provider_id = null;
                vehicle.is_selected = false;
                vehicle.is_assigned = false;
                vehicle.save();
    
                provider.admintypeid = null;
                provider.service_type = null;
                provider.vehicle_type = VEHICLE_TYPE.NORMAL;
                provider.is_vehicle_document_uploaded = false;
                provider.provider_type_id = null;
                await provider.save();

                let history_type = VEHICLE_HISTORY_TYPE.DROPPED
                utils.add_vehicle_history(vehicle, history_type, {
                    user_id: provider._id,
                    name: provider.first_name + " " + provider.last_name,
                    email: provider.email,
                    unique_id: provider.unique_id
                }, null, TYPE_VALUE.PROVIDER)
                
                return res.json({ success: true, message: success_messages.MESSAGE_CODE_VEHICLE_DROPPED_SUCCESSFULLY});
            }else{
                return res.json({ success: false, error_code: error_message.ERROR_CODE_OUTSIDE_HUB_AREA });
            }

        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.get_provider_hub_list = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (response.success) {

            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            let location_query = {
                $geoNear: {
                    near: [req.body.latitude, req.body.longitude],
                    distanceField: "distance",
                    uniqueDocs: true,
                    maxDistance: 100000000
                }
            }
            let hubs = await Hub.aggregate([location_query, { $match: { city_id: provider.cityid, is_active: true } }, {$sort: { distance: 1 }}, { $project: { name: 1, address: 1, location: 1, kmlzone: 1, distance: 1 } }]);
            return res.json({ success: true, hubs: hubs });

        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.get_provider_list_for_dispatcher = async function(req, res) {
    try{
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const trip = await Trip.findOne({ _id: req.body.trip_id})
        if(!trip) return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND})
        const providers = await Provider.find({admintypeid: trip.type_id, cityid: trip.city_id}).select({
            _id: 1,
            is_trip: 1,
            first_name: 1,
            last_name: 1,
            email: 1,
            phone: 1,
            service_type: 1,
            is_available: 1,
            is_active: 1,
            unique_id: 1
        })
        console.log(providers);
        let online_drivers = providers.filter(data => data.is_active == 1 && data.is_trip.length == 0)
        let in_trip_provider = providers.filter(data => data.is_trip.length > 0)
        let offline_provider = providers.filter(data => data.is_active == 0)

        let array = [...online_drivers, ...in_trip_provider, ...offline_provider]
        array = [...new Set(array)] // Preserv duplicate providers
        res.json({
            success: true,
            providers:array
        });
    } catch(error) {
        utils.error_response(error, req, res)
    }
}

exports.get_trip_detail_for_provider = async function(req, res) {
    try{
        let params_array = [{ name: "trip_id", type: "string"}, { name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return;
        }
        const trip = await Trip.findOne({ _id: req.body.trip_id })
        const date = trip.server_start_time_for_schedule

        // $and: [{extractedDate: date.toISOString().substr(0, 10)},
        //     {$or: [ {confirmed_provider: {$eq: mongoose.Types.ObjectId(req.body.provider_id)}}, { provider_id: {$eq: mongoose.Types.ObjectId(req.body.provider_id)}}]},
        //     {is_provider_accepted: 1}]
        const pipeline = [
            {
              $addFields: {
                extractedDate: { $dateToString: { format: '%Y-%m-%d', date: '$server_start_time_for_schedule' } }
              }
            },
            {
                $match: { 
                    extractedDate: date.toISOString().substr(0, 10),
                    confirmed_provider: {$eq: mongoose.Types.ObjectId(req.body.provider_id)},
                    is_provider_accepted: 1,
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user_detail'
                }
            },
            {
                $unwind: '$user_detail'
            },
            {
                $project: {
                    source_address: 1,
                    destination_address: 1,
                    is_schedule_trip: 1,
                    unique_id: 1,
                    user_first_name: 1,
                    user_last_name: 1,
                    user_unique_id: '$user_detail.unique_id',
                    server_start_time_for_schedule: 1,
                    user_image: '$user_detail.picture',
                    destination_addresses: 1
                }
            }
        ];
          
        const schedule_trips = await Trip.aggregate(pipeline)
        const ongoing_trip = await Provider.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(req.body.provider_id)}
            },
            {
                $lookup: {
                    from: 'trips',
                    localField: 'is_trip',
                    foreignField: '_id',
                    as: 'trip_detail'
                }
            },
            {
                $unwind: '$trip_detail'
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'trip_detail.user_id',
                    foreignField: '_id',
                    as: 'user_detail'
                }
            },
            {
                $unwind: {
                    path: "$user_detail",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    // trip_detail: 1
                    trip_id: '$trip_detail._id',
                    source_address: '$trip_detail.source_address',
                    destination_address: '$trip_detail.destination_address',
                    is_schedule_trip: '$trip_detail.is_schedule_trip',
                    unique_id: '$trip_detail.unique_id',
                    user_first_name: '$trip_detail.user_first_name',
                    user_last_name: '$trip_detail.user_last_name',
                    user_unique_id: '$user_detail.unique_id',
                    user_image: '$user_detail.picture',
                    server_start_time_for_schedule: '$trip_detail.server_start_time_for_schedule',
                    destination_addresses: '$trip_detail.destination_addresses',
                    created_at: '$trip_detail.created_at'
                }
            }
        ])
        res.json({
            success: true,
            schedule_trips,
            ongoing_trip
        });
    } catch(error) {
        utils.error_response(error, req, res)
    }
}

exports.accept_reject_dispatcher_schedule_trip = async function(req, res) {
    try{
        let params_array = [{ name: "trip_id", type: "string"}, { name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const trip = await Trip.findOne({ _id: mongoose.Types.ObjectId(req.body.trip_id) })
        if(!trip) return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND})

      let  provider=  await Provider.findOneAndUpdate({ _id: req.body.provider_id }, { $pull: { schedule_trip: trip._id }}, { new: true })
       
        if (req.body.is_provider_accepted == 1) {
            await Trip.findOneAndUpdate({ _id: trip._id }, { is_provider_accepted: req.body.is_provider_accepted, current_providers: [], confirmed_provider: req.body.provider_id,provider_type_id:provider.provider_type_id }, { new: true })
            // remaining------------------
            utils.update_request_status_socket(trip._id,null,trip.is_provider_status);
            return res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACCEPTED_TRIP_SUCCESSFULLY });
        } else {
            if(req.body.is_dispatcher_rejected && trip.confirmed_provider != null) {
                const previous_provider = await Provider.findOne({ _id: trip.confirmed_provider})
                utils.sendPushNotification(previous_provider.device_type, previous_provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_REQUEST_CANCELLED_BY_PROVIDER, "", null, previous_provider.lang_code)
            }
            await Trip.findOneAndUpdate({ _id: trip._id }, { is_provider_accepted: req.body.is_provider_accepted,current_providers: [], current_provider: null, confirmed_provider: null,is_provider_assigned_by_dispatcher: false ,provider_type_id:null}, { new: true })
            utils.update_request_status_socket(trip._id);
            return res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REJECTED_TRIP });
        }
    } catch(error) {
        utils.error_response(error, req, res)
    }
}

exports.get_pending_schedule_trip = async function (req, res) {
    try{
        let params_array = [{ name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response)
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND})

        let Table
        if (req.body.is_open_ride) {
            Table = OpenRide
        } else {
            Table = Trip
        }

        const type_detail_lookup = {
            $lookup: {
                from: "types",
                localField: "type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        }

        const type_detail_unwind = { $unwind: "$type_detail" }

        const trips = await Provider.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(req.body.provider_id)}
            },
            {
                $lookup: {
                    from: 'trips',
                    localField: 'schedule_trip',
                    foreignField: '_id',
                    as: 'trip_detail'
                }
            },
            {
                $unwind: '$trip_detail'
            },
            {
                $project: {
                    // trip_detail: 1
                    trip_id: '$trip_detail._id',
                    source_address: '$trip_detail.source_address',
                    destination_address: '$trip_detail.destination_address',
                    is_schedule_trip: '$trip_detail.is_schedule_trip',
                    unique_id: '$trip_detail.unique_id',
                    user_first_name: '$trip_detail.user_first_name',
                    user_last_name: '$trip_detail.user_last_name',
                    destination_addresses: '$trip_detail.destination_addresses',
                    is_provider_accepted: '$trip_detail.is_provider_accepted',
                    provider_service_fees: '$trip_detail.provider_service_fees',
                    sourceLocation: '$trip_detail.sourceLocation',
                    initialDestinationLocation: '$trip_detail.initialDestinationLocation',
                    destinationLocation: '$trip_detail.destinationLocation',
                    server_start_time_for_schedule: '$trip_detail.server_start_time_for_schedule'

                }
            }
        ])

        const accepted_trips = await Table.aggregate([
            {
                $match: {
                    confirmed_provider: mongoose.Types.ObjectId(req.body.provider_id),
                    is_provider_accepted: 1,
                    is_schedule_trip: true 
                }
            },
            type_detail_lookup,
            type_detail_unwind,
            {
                $project: {
                    trip_id: '$_id',
                    source_address: 1,
                    destination_address: 1,
                    is_schedule_trip: 1,
                    unique_id: 1,
                    user_first_name: 1,
                    user_last_name: 1,
                    destination_addresses: 1,
                    is_provider_accepted: 1,
                    provider_service_fees: 1,
                    sourceLocation: 1,
                    initialDestinationLocation: 1,
                    destinationLocation: 1,
                    server_start_time_for_schedule: 1,
                    user_details : 1,
                    provider_details : 1,
                    user_create_time: 1,
                    payment_mode: 1,
                    currency: 1,
                    type_detail: 1
                }
            }
        ])
        res.json({ success: true, pending_trips: trips, accepted_trips })
       
    } catch(error) {
        utils.error_response(error, req, res)
    }
}

// rent car apis
exports.get_car_rent_setting_detail = async function (req, res) {
    try{
        let params_array = [{ name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response)
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND})

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const country = await Country.findOne({_id: provider.country_id}).select("currencycode currencysign").lean();
        const city = await City.findOne({_id: provider.city_id}).select("unit").lean();

        let setting_details = {};
        setting_details.is_vehicle_added = false;
        setting_details.currency_code = country?.currencycode;
        setting_details.currency_sign = country?.currencysign;
        setting_details.distance_unit = city?.unit == 0 ? "mi" : "km";
        setting_details.cancellation_reason = [
            "Price Too High", "Change In Time", "Vehicle Under Maintance",
        ]
        
        let vehicle = await Car_Rent_Vehicle.findOne({provider_id: provider._id});
        if(vehicle){
            setting_details.is_vehicle_added = true;
        }
        return res.json({ success: true, setting_details });
       
    } catch(error) {
        utils.error_response(error, req, res);
    }
}

exports.get_car_rent_brand_list = async function (req, res) {
    try{
        let params_array = [{ name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const country = await Country.findOne({_id: provider.country_id});
        if(!country) return res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND});

        let brand_list = await Car_Rent_Brand.find({country_id: country._id, is_active: true }).select({ name: 1 });

        if(!brand_list || brand_list.length == 0){
            return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.BRAND_NOT_ADDED });
        }
        // to check if model exits or not
        let brand_list_with_model = [];
        for(let brand of brand_list){
            let model = await Car_Rent_Model.findOne({brand_id: brand._id, is_active: true});
            if(model){
                brand_list_with_model.push(brand);
            }
        }

        if(!brand_list_with_model || brand_list_with_model.length == 0){
            return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.BRAND_NOT_ADDED });
        }

        return res.json({ success: true, brand_list: brand_list_with_model });
       
    } catch(error) {
        utils.error_response(error, req, res);
    }
}

exports.get_car_rent_model_list = async function (req, res) {
    try{
        let params_array = [{ name: "provider_id", type: "string"}, { name: "brand_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

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

exports.get_car_rent_specification_feature_list = async function (req, res) {
    try{
        let params_array = [{ name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const feature_list = await Car_Rent_Feature.find({ is_active: true }).select({ title: 1 });
        return res.json({ success: true, feature_list });
       
    } catch(error) {
        utils.error_response(error, req, res);
    }
}

exports.provider_add_rent_vehicle = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"},
            { name: "unique_no", type: "string"},
            { name: "plate_no", type: "string"},
            { name: "brand_id", type: "string"},
            { name: "model_id", type: "string"},
            { name: "color", type: "string"},
            { name: "year", type: "string"},
            { name: "fuel_type", type: "string"},
            { name: "transmission_type", type: "string"},
            { name: "min_trip_duration", type: "string"},
            { name: "max_trip_duration", type: "string"},
            { name: "buffer_time", type: "string"},
            { name: "address", type: "string"},
            { name: "latitude", type: "string"},
            { name: "longitude", type: "string"},
            { name: "handover_type", type: "string"},
            { name: "base_price", type: "string"},
            { name: "cancellation_charge", type: "string"},
            { name: "max_distance_per_day", type: "string"},
            { name: "additional_charge_per_unit_distance", type: "string"},
            { name: "no_of_seats", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response);

        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const country = await Country.findOne({_id: provider.country_id}).select("currencycode currencysign").lean();
        const city = await City.findOne({_id: provider.cityid}).select("unit").lean();

        req.body.features = JSON.parse(req.body.features);
        req.body.features = req.body.features.length > 0 ? req.body.features : [];
        req.body.features = [...new Set(req.body.features)];
        if(req.body.features.length > 0){
            req.body.features = req.body.features.map(feature => Schema(feature));
        }

        let handover_time = [];
        if(Number(req.body.handover_type) === 1 ){ // 1 means handover time is fixed.
            let handover_time_json = {
                "start_time" : req.body.start_time,
                "end_time" : req.body.end_time
            }
            handover_time.push(handover_time_json)
        }

        let model_details = await Car_Rent_Model.findOne({_id: req.body.model_id}).select({type_id: 1})

        let vehicle_detail = new Car_Rent_Vehicle({
            provider_id : req.body.provider_id,
            unique_no : req.body.unique_no,
            plate_no : req.body.plate_no,
            brand_id : req.body.brand_id,
            model_id : req.body.model_id,
            type_id : model_details.type_id, 
            color : req.body.color,
            year : req.body.year,
            fuel_type : Number(req.body.fuel_type),
            transmission_type: Number(req.body.transmission_type),
            features: req.body.features,
            min_trip_duration : req.body.min_trip_duration,
            max_trip_duration : req.body.max_trip_duration,
            buffer_time : req.body.buffer_time,
            address : req.body.address,
            location : [req.body.latitude, req.body.longitude],
            handover_type : Number(req.body.handover_type),
            handover_time : handover_time,
            description : req.body.description,
            base_price : req.body.base_price,
            cancellation_charge : req.body.cancellation_charge,
            max_distance_per_day : req.body.max_distance_per_day,
            additional_charge_per_unit_distance : req.body.additional_charge_per_unit_distance,
            no_of_seats : req.body.no_of_seats,
            currency_code: country.currencycode,
            currency_sign: country.currencysign,
            unit: city.unit
        })

        /////////// FOR IMAGES /////////
        let images = [];
        if (req.files != undefined && req.files.length > 0) {
            let new_images = req.files;
            for (let new_image of new_images){
                let image_name = vehicle_detail._id + utils.tokenGenerator(12);
                let url = utils.getImageFolderPath(req, 12) + image_name + '.jpg';
                utils.saveImageFromBrowser(new_image.path, image_name + '.jpg', 12);
                console.log(url);
                images.push(url)
            }
        }

        vehicle_detail.images = images;
        await vehicle_detail.save();
        
        return res.json({ success: true, vehicle_detail, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_ADD_VEHICLE_SUCCESSFULLY });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.provider_update_rent_vehicle = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"},
            { name: "vehicle_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success)  return res.json(response);

        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const vehicle_id = req.body.vehicle_id;

        const vehicle = await Car_Rent_Vehicle.findOne({ _id: vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        if(req.body.features){
            req.body.features = JSON.parse(req.body.features);
            req.body.features = req.body.features.length > 0 ? req.body.features : [];
            req.body.features = [...new Set(req.body.features)];
            if(req.body.features.length > 0){
                req.body.features = req.body.features.map(feature => Schema(feature));
            }
        }

        if(req.body.handover_type){
            let handover_time = [];
            if(Number(req.body.handover_type) === 1 ){ // 1 means handover time is fixed.
                let handover_time_json = {
                    "start_time" : req.body.start_time,
                    "end_time" : req.body.end_time
                }
                handover_time.push(handover_time_json)
            }
            req.body.handover_time = handover_time;
        }

        if(req.body.latitude && req.body.longitude){
            req.body.location = [req.body.latitude, req.body.longitude];
        }

        /////////// FOR IMAGES /////////

        // remove existing images
        for (let image of vehicle.images){
            await utils.deleteImageFromFolder(image, 12);
        }

        // add new images
        let images = [];
        if (req.files != undefined && req.files.length > 0) {
            let new_images = req.files;
            for (let new_image of new_images){
                let image_name = vehicle._id + utils.tokenGenerator(12);
                let url = utils.getImageFolderPath(req, 12) + image_name + '.jpg';
                utils.saveImageFromBrowser(new_image.path, image_name + '.jpg', 12);
                console.log(url);
                images.push(url)
            }
            req.body.images = images;
        }

        req.body.admin_status = 0;
        req.body.rejection_reason = '';

        let vehicle_update = await Car_Rent_Vehicle.findByIdAndUpdate( vehicle_id, req.body, { new: true });
        if (!vehicle_update) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_UPDATE_FAILED })
            return
        }
        return res.json({ success: true, vehicle_detail: vehicle_update, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_UPDATE_VEHICLE_SUCCESSFULLY })

    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.rent_vehicle_list = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        let provider_condition = { provider_id : Schema(req.body.provider_id)};

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let project = {
            $project: {
                _id: 1,
                provider_id: 1,
                year: 1,
                base_price: 1,
                image: { $arrayElemAt: ["$images", 0] }, // Extracting first image
                admin_status: 1,
                brand: { $arrayElemAt: ["$brand_details.name", 0] }, // Extracting brand name
                model: { $arrayElemAt: ["$model_details.name", 0] }, // Extracting model name
                plate_no: 1,
                rejection_reason: 1,
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
                title: { 
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] }, 
                        " ", 
                        { $arrayElemAt: ["$model_details.name", 0] }, 
                        " ", 
                        { $toString: "$year" }
                    ] 
                }
            }
        }

        let vehicle_list = await Car_Rent_Vehicle.aggregate([{ $match: provider_condition }, brand_lookup, model_lookup, project]);
        return res.json({ success: true, vehicle_list });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.provider_delete_rent_vehicle = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"}, { name: "vehicle_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id });
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const vehicle = await Car_Rent_Vehicle.findOne({ _id: req.body.vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        let future_trip = await Rental_Trip.find({vehicle_id : vehicle._id, schedule_start_time: {$gte : new Date() }, status:{$nin: [RENTAL_TRIP_STATUS.COMPLETED, RENTAL_TRIP_STATUS.CANCELLED]} });
        if(!future_trip) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_CAN_NOT_BE_DELETED });

        await Car_Rent_Vehicle.deleteOne({ _id: vehicle._id });
        return res.json({ success: true, message : success_messages.MESSAGE_CODE_VEHICLE_DELETE_SUCCESSFULLY });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.provider_get_rent_vehicle_detail = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"}, { name: "vehicle_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id });
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const vehicle = await Car_Rent_Vehicle.findOne({ _id: req.body.vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });


        let vehicle_condition = { _id : Schema(req.body.vehicle_id)};

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let type_lookup = {
            $lookup: {
                from: "car_rent_types",
                localField: "type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "type_details"
            }
        }

        let feature_lookup = {
            $lookup : {
                from: "car_rent_features",
                localField: "features",
                foreignField: "_id",
                pipeline:[{ $project:{ title:1 } }],
                as: "features_details"
            }
        }

        let project = {
            $project: {
                _id: 1,
                provider_id: 1,
                year: 1,
                brand: { $arrayElemAt: ["$brand_details.name", 0] }, // Extracting brand name
                model: { $arrayElemAt: ["$model_details.name", 0] }, // Extracting model name
                type: { $arrayElemAt: ["$type_details.name", 0] }, // Extracting model name
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
                unique_no: 1,
                plate_no: 1,
                color: 1,
                no_of_seats: 1,
                transmission_type: 1,
                fuel_type: 1,
                base_price: 1,
                features_details: 1,
                images: 1,
                min_trip_duration: 1,
                max_trip_duration: 1,
                description: 1,
                location: 1,
                admin_status: 1,        
                max_distance_per_day: 1,
                additional_charge_per_unit_distance: 1,
                buffer_time: 1,
                address: 1,
                cancellation_charge: 1,
                handover_type: 1, 
                start_time: {
                    $cond: {
                        if: { $eq: ["$handover_type", 1] },
                        then: { $arrayElemAt: ["$handover_time.start_time", 0] }, // Extracting start_time from the handover array
                        else: '00:00' // or '' if you prefer an empty string
                    }
                },
                end_time: {
                    $cond: {
                        if: { $eq: ["$handover_type", 1] },
                        then: { $arrayElemAt: ["$handover_time.end_time", 0] }, // Extracting end_time from the handover array
                        else: '00:00' // or '' if you prefer an empty string
                    }
                },
                brand_id: 1,
                model_id: 1,
                rejection_reason: 1,
                is_delivery_available: 1,
                delivery_distance: 1,
                delivery_charge_per_unit_distance: 1,
                delivery_time_type: 1
            }
        }

        let vehicle_detail = await Car_Rent_Vehicle.aggregate([{ $match: vehicle_condition }, brand_lookup, model_lookup, type_lookup, feature_lookup, project]);
        if(vehicle_detail?.length > 0){
            return res.json({ success: true, vehicle_detail : vehicle_detail[0] });
        }
        return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.get_rent_vehicle_availability = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"},
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        let provider_condition = { provider_id : Schema(req.body.provider_id)};

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let project = {
            $project: {
                _id: 1,
                image: { $arrayElemAt: ["$images", 0] }, // Extracting first image
                title: { 
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] }, 
                        " ", 
                        { $arrayElemAt: ["$model_details.name", 0] }, 
                        " ", 
                        { $toString: "$year" }
                    ] 
                },
                non_availability: {
                    $filter: {
                        input: "$non_availability",
                        as: "item",
                        cond: { $eq: ["$$item.trip_id", null] }
                    }
                }
            }
        }

        let vehicle_list = await Car_Rent_Vehicle.aggregate([{ $match: provider_condition }, brand_lookup, model_lookup, project]);
        if(!vehicle_list) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });
        
        return res.json({ success: true, vehicle_list });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.add_rent_vehicle_availability = async function (req, res) {
    try {
        let params_array = [
          { name: "provider_id", type: "string" },
          { name: "vehicle_id", type: "string" },
          { name: "start_date", type: "string" },
          { name: "end_date", type: "string" },
        ];
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const vehicle_id = req.body.vehicle_id;
        const vehicle = await Car_Rent_Vehicle.findOne({ _id: vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        let start_date = req.body.start_date || new Date();
        let end_date = req.body.end_date || new Date();

        start_date = moment.utc(start_date).startOf('day').toDate();
        end_date = moment.utc(end_date).endOf('day').toDate();

        // for check if any future trip is in between mention time
        let future_trip = await Rental_Trip.findOne({
            vehicle_id: vehicle_id,
            status: {$nin:[RENTAL_TRIP_STATUS.COMPLETED, RENTAL_TRIP_STATUS.CANCELLED]},
            $or: [
                {
                    $or: [
                        { "schedule_start_time": { $gte: start_date, $lte: end_date } },
                        { "schedule_end_time": { $gte: start_date, $lte: end_date } }
                    ]
                },
                {
                    $and: [
                        { "schedule_start_time": { $lte: start_date } },
                        { "schedule_end_time": { $gte: end_date } }
                    ]
                }
            ]
        });
        if(future_trip) return res.json({ success: false, error_code: error_message.ERROR_CODE_CANT_CHANGE_AVAILABILITY_FOR_THIS_VEHICLE });
        
        const nonAvailability = {
            start_date: start_date,
            end_date: end_date,
            trip_id: null,
            availability_type: 1
        };

        const updatedVehicle = await Car_Rent_Vehicle.findByIdAndUpdate(
            vehicle_id,
            { $push: { non_availability: nonAvailability } },
            { new: true }
        );
        if (!updatedVehicle) {
            return res.json({
                success: false,
                error_code: RENT_CAR_ERROR_CODE.AVAILABILITY_SET_FAILED
            });
        }

        return res.json({
            success: true,
            message: CAR_RENT_MESSAGE_CODE.AVAILABILITY_SET_SUCCCESSFULLY,
            non_availability: updatedVehicle.non_availability
        });

    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.delete_rent_vehicle_availability = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"},
            { name: "vehicle_id", type: "string" },
            { name: "id", type: "string" },
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const vehicle_id = req.body.vehicle_id;
        const vehicle = await Car_Rent_Vehicle.findOne({ _id: vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        
        vehicle.non_availability = vehicle.non_availability.filter((availability) => {
            return availability._id.toString() !== req.body.id.toString()
        })
        await vehicle.save();
    
        return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.AVAILABILITY_DELETE_SUCCCESSFULLY, non_availability: vehicle.non_availability });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.update_rent_delivery_info = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"},
            { name: "vehicle_id", type: "string" }
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        const vehicle_id = req.body.vehicle_id;
        const vehicle = await Car_Rent_Vehicle.findOne({ _id: vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        vehicle.is_delivery_available = req.body.is_delivery_available;        
        if(req.body?.is_delivery_available){
            // vehicle.delivery_distance = req.body.delivery_distance;
            vehicle.delivery_charge_per_unit_distance = req.body.delivery_charge_per_unit_distance;
            vehicle.delivery_time_type = req.body.delivery_time_type;
        }
        await vehicle.save(); 
    
        return res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_UPDATE_VEHICLE_SUCCESSFULLY });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}