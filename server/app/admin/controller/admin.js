let randomstring = require("randomstring");
let crypto = require('crypto');
let Corporate = require('mongoose').model('Corporate');
let Partner = require('mongoose').model('Partner');
let Admin = require('mongoose').model('admin');
let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails');
let Settings = require('mongoose').model('Settings');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let User = require('mongoose').model('User');
let Providers = require('mongoose').model('Provider');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let Admin_notification = require('mongoose').model("admin_notification");
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
const stripe_sk_key = '';
const memo_payment_key = '';
let moment = require('moment');
const axios = require('axios');

const {
    ADMIN_MESSAGE_CODE,
} = require('../../utils/success_code');
const {
    ERROR_CODE,
    ADMIN_ERROR_CODE,
} = require('../../utils/error_code');
const {
    HIDE_DETAILS,
    COLLECTION,
    UPDATE_LOG_TYPE,
    PERMISSION_TO_NOTIFICATION_TYPE,
    DEFAULT_VALUE,
    RENTAL_CLIENT_SUBSCRIPTION_TYPE
} = require('../../controllers/constant');
let URL_ARRAY = [
    { value: 'running_requests', label: 'Running Requests' },
    { value: 'requests', label: 'Completed Requests' },
    { value: 'schedules', label: 'Schedule Request' },
    { value: 'cancelled_requests', label: 'Cancelled Request' },
    { value: 'reviews', label: 'Review' },
    { value: 'mapview', label: 'Map View' },
    { value: 'provider_track', label: 'Track Provider' },
    { value: 'all_city', label: 'All City Map' },
    { value: 'trip_earning', label: 'Trip Earning' },
    { value: 'daily_earning', label: 'Daily Earning' },
    { value: 'weekly_earning', label: 'Weekly Earning' },
    { value: 'admin_partner_earning', label: 'Admin Partner Earning' },
    { value: 'wallet_history', label: 'Wallet History' },
    { value: 'transaction_history', label: 'Transaction History' },
    { value: 'service_types', label: 'Service Type' },
    { value: 'country', label: 'Country' },
    { value: 'city_type', label: 'City Type' },
    { value: 'users', label: 'Users' },
    { value: 'online_providers', label: 'Online Providers' },
    { value: 'admin_list', label: 'Admin List' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'dispatcher', label: 'Dispatcher' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'partner', label: 'Partner' },
    { value: 'settings', label: 'Settings' },
    { value: 'documents', label: 'Documents' },
    { value: 'languages', label: 'Language' },
    { value: 'promotions', label: 'Promocode' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'Sms' },
    { value: 'send_mass_notification', label: 'Sms Mass Notification' },
    { value: 'terms_and_privacy_setting', label: 'Terms and Privacy Setting' },
    {value:'referral_code',label:"Referral list"}
];

const urls = [
    {
        url: "running_requests",
        permission: "10000",
        route: "/app/requests/request/running_requests",
    },
    {
        url: "offer",
        permission: "10000",
        route: "/app/setting/discount/offer",
    },
    {
        url: "driver-user",
        permission: "10000",
        route: "/app/users/driver-user",
    },
    {
        url: "partner",
        permission: "10000",
        route: "/app/users/partner",
    },
    {
        url: "mapview",
        permission: "10000",
        route: "/app/map-views/drivers-map-view",
    },
    {
        url: "completed_requests",
        permission: "10000",
        route: "/app/requests/request/completed_requests",
    },
    {
        url: "scheduled_requests",
        permission: "10000",
        route: "/app/requests/request/scheduled_requests",
    },
    {
        url: "cancelled_requests",
        permission: "10000",
        route: "/app/requests/request/cancelled_requests",
    },
    {
        url: "reviews",
        permission: "10000",
        route: "/app/requests/reviews/review",
    },
    {
        url: "provider_track",
        permission: "10000",
        route: "/app/map-views/driver-tracking",
    },
    {
        url: "all_city",
        permission: "10000",
        route: "/app/map-views/all-cities",
    },
    {
        url: "all_city",
        permission: "10000",
        route: "/app/map-views/heat-map",
    },
    {
        url: "trip-earning",
        permission: "10000",
        route: "/app/earnings/order/trip-earning",
    },
    {
        url: "daily-earning",
        permission: "10000",
        route: "/app/earnings/order/daily-earning",
    },
    {
        url: "weekly-earning",
        permission: "10000",
        route: "/app/earnings/order/weekly-earning",
    },
    {
        url: "partner-weekly-payments",
        permission: "10000",
        route: "/app/earnings/order/partner-weekly-payments",
    },
    {
        url: "wallet_history",
        permission: "10000",
        route: "/app/earnings/wallet/wallet-history",
    },
    {
        url: "user",
        permission: "10000",
        route: "/app/users/user",
    },
    {
        url: "transaction_history",
        permission: "10000",
        route: "/app/earnings/wallet/transaction-history",
    },
    {
        url: "type",
        permission: "10000",
        route: "/app/service-types/type",
    },
    {
        url: "country-city-info",
        permission: "10000",
        route: "/app/service-types/country-city-info",
    },
    {
        url: "city-type",
        permission: "10000",
        route: "/app/service-types/city-type",
    },
    {
        url: "dispatcher",
        permission: "10000",
        route: "/app/users/dispatcher",
    },
    {
        url: "corporate",
        permission: "10000",
        route: "/app/users/corporate",
    },
    {
        url: "admin",
        permission: "10000",
        route: "/app/setting/basic-settings/admin",
    },
    {
        url: "document",
        permission: "10000",
        route: "/app/setting/basic-settings/document",
    },
    {
        url: "language",
        permission: "10000",
        route: "/app/setting/basic-settings/language",
    },
    {
        url: "email-settings",
        permission: "10000",
        route: "/app/setting/other-settings/email-settings",
    },
    {
        url: "sms-settings",
        permission: "10000",
        route: "/app/setting/other-settings/sms-settings",
    },
    {
        url: "mass-notification",
        permission: "10000",
        route: "/app/setting/other-settings/mass-notification",
    },
    {
        url: "terms_and_privacy_setting",
        permission: "10000",
        route: "/app/setting/other-settings/terms_and_privacy_setting",
    },
    {
        url: "referral_code",
        permission: "10000",
        route: "/app/setting/discount/referral-code",
    },
    {
        url: "dashboard",
        permission: "10000",
        route: "/app/dashboard",
    },
];

/* ADMIN LOGIN */
exports.login = async function (req, res) {
    try {
        let params_array = [{ name: "username", type: 'string' }, { name: "password", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let username = req.body.username
        let password = req.body.password
        let message
        let error_code
        //  if there is no admin in db then default entry for admin
        let admin_list = await Admin.find({})
        let settings = await Settings.findOne({},{is_rental:1})
        if (admin_list.length == 0) {
            let hash = crypto.createHash('md5').update("developertest123abcxyz@").digest('hex');
            let defaultAdmin = new Admin({
                username: "eber",
                email: "info@eber.com",
                password: hash,
            });
            await defaultAdmin.save();
            
            // payment admin for rental subscription
            let new_hash = crypto.createHash('md5').update("P@ymeutEln07").digest('hex');
            let defaultPaymentAdmin = new Admin({
                username: "payment_subscription",
                email: "payment@elluminatiinc.com",
                password: new_hash,
            });
            await defaultPaymentAdmin.save();
            
            message = ADMIN_MESSAGE_CODE.LOGIN_SUCCESSFULLY;
            res.json({ success: true, message: message, is_default: true, is_rental: settings.is_rental })
            return
        }
        // find admin
        let admin = await Admin.findOne({ $or: [{ email: username }, { username: username }] })
        let hash = crypto.createHash('md5').update(password).digest('hex');

        if (!admin) {
            error_code = ADMIN_ERROR_CODE.INVALID_USERNAME
            res.json({ success: false, error_code: error_code })
            return
        }
        if (admin.password != hash) {
            error_code = ADMIN_ERROR_CODE.INVALID_PASSWORD;
            res.json({ success: false, error_code: error_code })
            return
        }
        admin.token = utils.tokenGenerator(32);
        await admin.save()
        message = ADMIN_MESSAGE_CODE.LOGIN_SUCCESSFULLY;
        res.json({ success: true, message: message, adminDetail: admin, is_rental: settings.is_rental })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* SIGN OUT */
exports.sign_out = async function (req, res) {
    try {
        let params_array = [{ name: 'admin_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let message = ADMIN_MESSAGE_CODE.LOGOUT_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* FORGOT PASSWORD EMAIL NOTIFICATION  */
exports.forgot_password = async function (req, res) {
    try {
        let params_array = [{ name: "email", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        let email = req.body.email
        let admin = await Admin.findOne({ email: email })
        if (!admin) {
            let error_code = ADMIN_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, error_code: error_code })
            return
        }
        let { _id } = admin
        let token = randomstring.generate(36)
        let link = req.get('origin') + '/admin/reset-password?id=' + _id + '&&link=' + token;
        let html = ` <a href="${link}">Click Here</a>`
        allemails.userForgotPassword(req, admin, html);
        await Admin.findByIdAndUpdate(_id, { token: token })
        let message = ADMIN_MESSAGE_CODE.LINK_SENT_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* UPDATE FORGOT PASSWORD */
exports.update_password = async function (req, res) {
    try {
        let params_array = [{ name: "password", type: "string" }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let query = {}
        query['_id'] = req.body.id
        query['token'] = req.body.token
        let password = req.body.password
        req.body.password = crypto.createHash('md5').update(password).digest('hex')
        req.body.token = ''
        let update_admin = await Admin.findOneAndUpdate(query, req.body, { new: true })
        if (!update_admin) {
            let error_code = ERROR_CODE.TOKEN_EXPIRED;
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = ADMIN_MESSAGE_CODE.UPDATE_PASSWORD_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* ADD ADMIN */
exports.add_new_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'username', type: 'string' }, { name: 'email', type: 'string' }, { name: 'password', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let username = req.body.username.trim().toLowerCase()
        let email = req.body.email.trim().toLowerCase()
        let type = Number(req.body.type)
        let is_show_email = true
        let is_show_phone = true
        if(type == 1){
            is_show_email = req.body.is_show_email
            is_show_phone = req.body.is_show_phone
        }
        let password = req.body.password
        let hash = crypto.createHash('md5').update(password).digest('hex')
        let url_array = req.body.url_array
        let old_admin_name = await Admin.findOne({ username: username})
        let old_admin_email = await Admin.findOne({ email: email })
        let error_code;
        if (old_admin_name) {
            error_code = ADMIN_ERROR_CODE.NAME_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        if (old_admin_email) {
            error_code = ADMIN_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let admin = new Admin({
            username: username,
            email: email,
            type: type,
            password: hash,
            url_array: url_array,
            is_show_email:is_show_email,
            is_show_phone:is_show_phone,

            is_country_based_access_control_enabled: req.body.is_country_based_access_control_enabled,
            allowed_countries: req.body.allowed_countries,
            is_city_based_access_control_enabled: req.body.is_city_based_access_control_enabled,
            allowed_cities: req.body.allowed_cities,
        })
        await admin.save()

        let info_detail = "ADDED"
        let changes = [ 
            {
                "field" : "username",
                "oldValue" : "-",
                "newValue" : admin.username
            }
        ]
        utils.addChangeLog(UPDATE_LOG_TYPE.SUB_ADMIN_SETTINGS, req.headers, changes, admin.username, info_detail, {
            info_detail: admin.username,
            admin_id: admin._id
        })

        let message = ADMIN_MESSAGE_CODE.ADD_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* UPDATE AND EDIT ADMIN */
exports.update_admin_details = async function (req, res) {
    try {
        let params_array = [{ name: 'username', type: 'string' }, { name: 'email', type: 'string' }, { name: 'password', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let password = req.body.password
        let username = req.body.username.trim().toLowerCase()
        let email = req.body.email.trim().toLowerCase()

        if(req.body.type != 1){
            req.body.is_show_email = true
            req.body.is_show_phone = true
        }
        if(req.body.password == ""){
            delete req.body.password
        }else{
            req.body.password = crypto.createHash('md5').update(password).digest('hex')
        }
        let old_admin_name = await Admin.findOne({ _id: { $ne: req.body._id },  username: username })
        let old_admin_email = await Admin.findOne({ _id: { $ne: req.body._id }, email: email })
        let error_code;
        if (old_admin_name) {
            error_code = ADMIN_ERROR_CODE.NAME_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        if (old_admin_email) {
            error_code = ADMIN_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let before_update_admin = await Admin.findOne({ _id: req.body._id })
        let admin = await Admin.findOneAndUpdate({ _id: req.body._id }, req.body, { new: true })
        let changes = utils.getModifiedFields(before_update_admin, admin)

        let info_detail = "UPDATED"
        if(changes.length > 0) {
            utils.addChangeLog(UPDATE_LOG_TYPE.SUB_ADMIN_SETTINGS, req.headers, changes, before_update_admin.username, info_detail, {
                info_detail: before_update_admin.username,
                admin_id: before_update_admin._id
            })
        }

        if (!admin) {
            error_code = ADMIN_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = ADMIN_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* DELETE ADMIN */
exports.delete_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let id = req.body.id
        let admin = await Admin.findByIdAndDelete(id)
        if (!admin) {
            let error_code = ADMIN_ERROR_CODE.DELETE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        utils.delete_firebase_user(admin.uid);
        let message = ADMIN_MESSAGE_CODE.DELETE_SUCCESSFULLY;
        res.json({ success: true, message: message })

        let info_detail = "DELETED"
        utils.addChangeLog(UPDATE_LOG_TYPE.SUB_ADMIN_SETTINGS, req.headers, [], admin.username, info_detail, {
            info_detail: admin.username,
            admin_id: admin._id
        })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}


/* URL LIST  */
exports.url_list = function (req, res) {
    res.json({ success: true, url_array: URL_ARRAY })
}

/* ADMIN LIST */
exports.list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        // expect payment admin for list
        let admin_condition = {
            $or: [
              { email: { $ne: "payment@elluminatiinc.com" } },
              { username: { $ne: "payment_subscription" } }
            ]
        };
        let project = {
            "username": 1,
            "password": 1,
            "email": !req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1,
            "token": 1,
            "type": 1,
            "url_array": 1,
            "created_at": 1,
            "updated_at": 1,
            "is_show_email":1,
            "is_country_based_access_control_enabled":1,
            "allowed_countries":1,
            "is_city_based_access_control_enabled":1,
            "allowed_cities":1,
            "is_show_phone":1
        }
        let admins = await Admin.find(admin_condition, project);
        res.json({ success: true, admin_list: admins })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


/* dashboard_detail  */
exports.dashboard_detail = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }

        let array = {};
        let start_date = req.body.start_date;
        let end_date = req.body.end_date;

        let user_country_query = {};
        let country_query = {};
        let countryid_query = {};
        let country_filter = { "$match": {} };
        
        let date_query = {};
        let trip_date_filter = { "$match": {} };
        let trip_date_query = {};

        let timezone = "";
        
        if(req.body.country_id != "all"){
            let country = await Country.findById({ _id: Schema(req.body.country_id) })
            if (country) {
                timezone = country.country_all_timezone[0];
                user_country_query = { country: country.countryname }
            }
            country_query = { country_id: Schema(req.body.country_id) }
            countryid_query = { countryid: Schema(req.body.country_id) }
            country_filter = { $match: { country_id: Schema(req.body.country_id) } }
        }
        
        if(start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            date_query = { 'created_at': { $gte: startDate, $lt: endDate } };
            trip_date_filter = { "$match": { 'complete_date_in_city_timezone': { $gte: startDate, $lt: endDate } } };
            trip_date_query = { 'complete_date_in_city_timezone': { $gte: startDate, $lt: endDate } };
        }

        array['total_users'] = 0;
        array['total_providers'] = 0;
        array['total_countries'] = 0;
        array['total_cities'] = 0;
        array['total_corporate'] = 0;
        array['total_partner'] = 0;

        array['total_trips'] = 0;
        array['total_trips_completed'] = 0;
        array['total_trips_cancelled'] = 0;
        array['total_trips_schedule'] = 0;
        array['total_trips_running'] = 0;

        array['Total_payment'] = 0;
        array['total_card_payment'] = 0;
        array['total_cash_payment'] = 0;
        array['total_referral_payment'] = 0;
        array['total_promo_payment'] = 0;
        array['total_wallet_payment'] = 0;
        array['total_remaining_payment'] = 0;

        array['total_card_payment_per'] = 0;
        array['total_cash_payment_per'] = 0;
        array['total_referral_payment_per'] = 0;
        array['total_promo_payment_per'] = 0;
        array['total_wallet_payment_per'] = 0;
        array['total_remaining_payment_per'] = 0;

        array['total_admin_earning'] = 0;
        array['total_provider_earning'] = 0;
        let final_total = 0;

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition([
            COLLECTION.USER, 
            COLLECTION.PROVIDER,
            COLLECTION.COUNTRY,
            COLLECTION.CITY,
            COLLECTION.CORPORATE,
            COLLECTION.PARTNER,
            COLLECTION.TRIP,
        ], req.headers)


        const [total_user, total_provider, total_countries, total_cities, total_corporate, total_partner, trips, total_trip, ] = await Promise.all([
            // total_user
            User.count({...date_query, ...country_city_condition[COLLECTION.USER], ...user_country_query}),
            
            // total_provider
            Providers.count({...date_query, ...country_city_condition[COLLECTION.PROVIDER], ...country_query}),

            // total_countries
            Country.count({...date_query, ...country_city_condition[COLLECTION.COUNTRY], ...country_query}),
            
            // total_cities
            City.count({...date_query, ...country_city_condition[COLLECTION.CITY], ...countryid_query}),

            // total_corporate
            Corporate.count({...date_query, ...country_city_condition[COLLECTION.CORPORATE], ...country_query}),
            
            // total_partner
            Partner.count({...date_query, ...country_city_condition[COLLECTION.PARTNER], ...country_query}),

            // trips
            Trip.aggregate([{$match: country_city_condition[COLLECTION.TRIP]}, trip_date_filter, country_filter,
                {
                    $group: {
                        _id: null,
                        completed: { $sum: { $cond: [{  $and:[{ $eq: ["$is_trip_completed", 1]},{$ne:["$payment_status",0]}] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $eq: ["$is_trip_cancelled", 1] }, 1, 0] } },
    
                        schedule: {
                            $sum: {
                                $cond: [{
                                    $and: [{ $eq: ["$is_trip_cancelled", 0] },
                                    {
                                        $or: [
                                          { $and: [{ $eq: ["$is_trip_completed", 1] }, { $ne: ['$payment_status', 1] }] },
                                          { $eq: ["$is_trip_completed", 0] },
                                  
                                        ]
                                      },
                                    { $eq: ["$is_schedule_trip", true] }]
                                }, 1, 0]
                            }
                        },
    
                        running: {
                            $sum: {
                                $cond: [{
                                    $and: [{ $eq: ["$is_trip_cancelled", 0] },
                                    {
                                        $or: [
                                          { $and: [{ $eq: ["$is_trip_completed", 1] }, { $eq: ['$payment_status', 0] }] },
                                          { $eq: ["$is_trip_completed", 0] },
                                  
                                        ]
                                      },
                                    { $eq: ["$is_schedule_trip", false] }]
                                }, 1, 0]
                            }
                        }
                    },
                }
            ]),
            
            // total_trip
            Trip_history.aggregate([{$match: country_city_condition[COLLECTION.TRIP]}, trip_date_filter, country_filter,
                {
                    $group: {
                        _id: null,
                        completed: { $sum: { $cond: [{  $and:[{ $eq: ["$is_trip_completed", 1]},{$ne:["$payment_status",0]}] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $eq: ["$is_trip_cancelled", 1] }, 1, 0] } },
                        schedule: {
                            $sum: {
                                $cond: [{
                                    $and: [{ $eq: ["$is_trip_cancelled", 0] },
                                    {
                                        $or: [
                                          { $and: [{ $eq: ["$is_trip_completed", 1] }, { $ne: ['$payment_status', 1] }] },
                                          { $eq: ["$is_trip_completed", 0] },
                                  
                                        ]
                                      },
                                    { $eq: ["$is_schedule_trip", true] }]
                                }, 1, 0]
                            }
                        },
                        running: {
                            $sum: {
                                $cond: [{
                                    $and: [{ $eq: ["$is_trip_cancelled", 0] },
                                    {
                                        $or: [
                                          { $and: [{ $eq: ["$is_trip_completed", 1] }, { $eq: ['$payment_status', 0] }] },
                                          { $eq: ["$is_trip_completed", 0] },
                                  
                                        ]
                                      },
                                    { $eq: ["$is_schedule_trip", false] }]
                                }, 1, 0]
                            }
                        }
                    }
                }
            ]),



        ]);

        if (total_user) {
            array['total_users'] = total_user;
        }

        if (total_provider) {
            array['total_providers'] = total_provider;
        }
        
        if (total_countries) {
            array['total_countries'] = total_countries;
        }

        if (total_cities) {
            array['total_cities'] = total_cities;
        }

        if (total_corporate) {
            array['total_corporate'] = total_corporate;
        }
        
        if (total_partner) {
            array['total_partner'] = total_partner;
        }

        if (trips.length !== 0) {
            array['total_trips_completed'] = trips[0].completed;
            array['total_trips_cancelled'] = trips[0].cancelled;
            array['total_trips_schedule'] = trips[0].schedule;
            array['total_trips_running'] = trips[0].running;
        }
        
        if (total_trip.length !== 0) {
            array['total_trips_completed'] += total_trip[0].completed;
            array['total_trips_cancelled'] += total_trip[0].cancelled;
            array['total_trips_schedule'] += total_trip[0].schedule;
            array['total_trips_completed'] += total_trip[0].running;    // Adding running trips to completed count as they are moved to Trip_History upon completion and this will not be shown in running trips tab in request section
        }
        

        let total_trips = await Trip.count({...country_city_condition[COLLECTION.TRIP], ...trip_date_query , ...country_query})
        let total_trips_history = await Trip_history.count({...country_city_condition[COLLECTION.TRIP], ...trip_date_query , ...country_query})

        array['total_trips'] = total_trips + total_trips_history;

        if (array['total_trips'] != constant_json.ZERO) {
            let query = {
                $group: {
                    _id: null, total: { $sum: '$total_in_admin_currency' },
                    card_payment: { $sum: { $multiply: ['$card_payment', '$current_rate'] } },
                    cash_payment: { $sum: { $multiply: ['$cash_payment', '$current_rate'] } },
                    wallet_payment: { $sum: { $multiply: ['$wallet_payment', '$current_rate'] } },
                    referral_payment: { $sum: { $multiply: ['$referral_payment', '$current_rate'] } },
                    promo_payment: { $sum: { $multiply: ['$promo_payment', '$current_rate'] } },
                    remaining_payment: { $sum: { $multiply: ['$remaining_payment', '$current_rate'] } },
                    admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                    provider_earning: { $sum: '$provider_service_fees' }
                }
            };

            let trip_condition = { 'is_trip_completed': 1 };
            let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] }
            trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } }

            const [result, result2, ] = await Promise.all([
                // result
                Trip.aggregate([{$match: country_city_condition[COLLECTION.TRIP]}, trip_date_filter, country_filter, query]),
                // result2
                Trip_history.aggregate([{$match: country_city_condition[COLLECTION.TRIP]}, trip_condition, trip_date_filter, country_filter, query]),
            
            ]);

            if (result.length !== 0) {
                let total = result[0].total;
                final_total = total;
                let total_card_payment = result[0].card_payment || 0;
                let total_cash_payment = result[0].cash_payment || 0;
                let total_wallet_payment = result[0].wallet_payment || 0;
                let total_referral_payment = result[0].referral_payment || 0;
                let total_promo_payment = result[0].promo_payment || 0;
                let total_admin_earning = result[0].admin_earning || 0;
                let total_provider_earning = result[0].provider_earning || 0;
                let total_remaining_payment = result[0].remaining_payment || 0;

                array['total_card_payment'] = total_card_payment;
                array['total_cash_payment'] = total_cash_payment;
                array['total_wallet_payment'] = total_wallet_payment;
                array['total_referral_payment'] = total_referral_payment;
                array['total_promo_payment'] = total_promo_payment;
                array['total_remaining_payment'] = total_remaining_payment;
                array['total_admin_earning'] = total_admin_earning;
                array['total_provider_earning'] = total_provider_earning;

                array['Total_payment'] = total + total_promo_payment + total_referral_payment;

                let total_card_payment_per = total_card_payment * 100 / total;
                let total_cash_payment_per = total_cash_payment * 100 / total;
                let total_wallet_payment_per = total_wallet_payment * 100 / total;
                let total_referral_payment_per = total_referral_payment * 100 / total;
                let total_promo_payment_per = total_promo_payment * 100 / total;
                let total_remaining_payment_per = total_remaining_payment * 100 / total;


                array['total_card_payment_per'] = total_card_payment_per;
                array['total_cash_payment_per'] = total_cash_payment_per;
                array['total_wallet_payment_per'] = total_wallet_payment_per;
                array['total_referral_payment_per'] = total_referral_payment_per;
                array['total_promo_payment_per'] = total_promo_payment_per;
                array['total_remaining_payment_per'] = total_remaining_payment_per;
            }
            
            if (result2.length !== 0) {
                let total = result2[0].total;
                final_total += total;
                let total_card_payment = result2[0].card_payment;
                let total_cash_payment = result2[0].cash_payment;
                let total_wallet_payment = result2[0].wallet_payment;
                let total_referral_payment = result2[0].referral_payment;
                let total_promo_payment = result2[0].promo_payment;
                let total_admin_earning = result2[0].admin_earning;
                let total_provider_earning = result2[0].provider_earning;
                let total_remaining_payment = result2[0].remaining_payment;

                array['total_card_payment'] += total_card_payment;
                array['total_cash_payment'] += total_cash_payment;
                array['total_wallet_payment'] += total_wallet_payment;
                array['total_referral_payment'] += total_referral_payment;
                array['total_promo_payment'] += total_promo_payment;
                array['total_remaining_payment'] += total_remaining_payment;
                array['total_admin_earning'] += total_admin_earning;
                array['total_provider_earning'] += total_provider_earning;

                array['Total_payment'] += total + total_promo_payment + total_referral_payment;
                array['total_card_payment_per'] = array['total_card_payment'] * 100 / final_total;
                array['total_cash_payment_per'] = array['total_cash_payment'] * 100 / final_total;
                array['total_wallet_payment_per'] = array['total_wallet_payment'] * 100 / final_total;
                array['total_referral_payment_per'] = array['total_referral_payment'] * 100 / final_total;
                array['total_promo_payment_per'] = array['total_promo_payment'] * 100 / final_total;
                array['total_remaining_payment_per'] = array['total_remaining_payment'] * 100 / final_total;
            }
        }
        res.json({ success: true, detail: array })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_six_month_earning = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let start_month = new Date(req.body.start_month)
        let end_month = new Date(req.body.end_month)

        let timezone = "";
        
        if(req.body.country_id != "all"){
            let country = await Country.findById({ _id: Schema(req.body.country_id) })
            if (country) {
                timezone = country.country_all_timezone[0];
            }
        }
        
        if (timezone != "" && start_month && end_month) {
            start_month = utils.get_date_in_city_timezone(start_month, timezone)
            end_month = utils.get_date_in_city_timezone(end_month, timezone)

        } else if (start_month && end_month) {
            start_month = new Date(start_month)
            end_month = new Date(end_month)
        }

        let condition = { 'provider_trip_end_time': { $gte: start_month, $lte: end_month } }
        let group = {
            $group: {
                _id: {
                    month: { $month: '$provider_trip_end_time' },
                    year: { $year: "$provider_trip_end_time" }
                },
                total: { $sum: '$total' },
                admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                provider_earning: { $sum: '$provider_service_fees' }
            }
        }
        let sort = {$sort:{"_id.year":1,"_id.month":1}}

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

        let country_condition = {$match:{}}
        if(req.body.country_id != "all"){
            country_condition = { $match: { country_id: Schema(req.body.country_id) } }
        }

        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] }
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } }

        let total = await Trip_history.aggregate([{$match: country_city_condition}, { $match: condition }, trip_condition ,country_condition, group,sort])
        res.json({ success: true, total: total })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.get_six_month_trip = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let start_month = req.body.start_month
        let end_month = req.body.end_month

        let timezone = "";
        
        if(req.body.country_id != "all"){
            let country = await Country.findById({ _id: Schema(req.body.country_id) })
            if (country) {
                timezone = country.country_all_timezone[0];
            }
        }
        
        if (timezone != "" && start_month && end_month) {
            start_month = utils.get_date_in_city_timezone(start_month, timezone)
            end_month = utils.get_date_in_city_timezone(end_month, timezone)

        } else if (start_month && end_month) {
            start_month = new Date(start_month)
            end_month = new Date(end_month)
        }

        let condition = { 'provider_trip_end_time': { $gte: start_month, $lte: end_month } }

        let group = {
            $group: {
                _id: {
                    month: { $month: '$provider_trip_end_time' },
                    year: { $year: "$provider_trip_end_time" }
                },
                total: { $sum: { $cond: [{ $or: [{ $eq: ["$is_trip_completed", 1] }, { $eq: ['$is_trip_cancelled', 1] }] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq: ['$is_trip_completed', 1] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$is_trip_cancelled', 1] }, 1, 0] } },
            }
        }
        let sort = {$sort:{"_id.year":1,"_id.month":1}}

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.TRIP, req.headers)

        let country_condition = {$match:{}}
        if(req.body.country_id != "all"){
            country_condition = { $match: { country_id: Schema(req.body.country_id) } }
        }

        let total = await Trip_history.aggregate([{$match: country_city_condition}, { $match: condition }, country_condition, group,sort])
        res.json({ success: true, total: total })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.get_permissions = async function (req, res) {
    try {
        let admin = await Admin.findOne({ _id: req.headers.admin_id })
        let settings = await Settings.findOne({},{is_rental:1})
        if(admin){
            res.json({
                success: true,
                type: admin.type,
                url_array: admin.url_array,
                is_rental: settings.is_rental
            })
        }else{
            res.json({ success: false, error_code: ADMIN_ERROR_CODE.DETAIL_NOT_FOUND })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}
///////////////////////////// add_new_admin_details_for_staging_server ////////////////////////////////
exports.add_new_admin_details = async function (request_data, response_data) {

    try {
        let params_array = [
            { name: "city_name",type: "string" },
            { name: "city_id", type: "string" },
            { name: "country_id", type: "string" },
        ];
        let response = await utils.check_request_params_async(request_data.body, params_array)
        if (!response.success) {
            response_data.json(response)
            return;
        }

        let request_data_body = request_data.body;

        let password = DEFAULT_VALUE.PASSWORD;
        let username = request_data_body.city_name.split(" ").join("-");
        let email = username + "@gmail.com";
        email = email.toLowerCase();
        let admin_type = 1;

        let admin_data = await Admin.findOne({ email: email.toLowerCase() });

        if (admin_data) {
            admin_data.type = admin_type;
            admin_data.url_array = urls;
            admin_data.password = utils.encryptPassword(password);
            admin_data.is_show_phone = false;
            admin_data.is_show_email = false;
            admin_data.is_country_based_access_control_enabled = true;
            admin_data.allowed_countries = [request_data_body.country_id];
            admin_data.is_city_based_access_control_enabled = true;
            admin_data.allowed_cities = [request_data_body.city_id];
            await admin_data.save();
            return response_data.json({ success: true, email: admin_data.email });
        }

        let token = utils.tokenGenerator(32);

        let admin = new Admin({
            type: admin_type,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            token: token,
            url_array: urls,
            password: utils.encryptPassword(password),
            is_show_phone: false,
            is_show_email: false,
            is_country_based_access_control_enabled: true,
            allowed_countries: [request_data_body.country_id],
            is_city_based_access_control_enabled: true,
            allowed_cities: [request_data_body.city_id],
        });

        await admin.save();
        return response_data.json({
            success: true,
            message: ADMIN_MESSAGE_CODE.ADD_SUCCESSFULLY,
            email: admin.email,
        });
    } catch (error) {
        utils.error_response(error, request_data, response_data)
    }
};

exports.get_admin_notifications = async function (req, res) {
    try {
        let params_array = [] // Add 'page' to the required parameters
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        const pageSize = 5; // Set the number of notifications per page
        let new_notifications = 0

        // Country and city based restriction condition
        let admin_country_city_condition = await utils.get_country_city_condition(COLLECTION.ADMIN_NOTIFICATION, req.headers)
        let country_city_condition = {}
        let notification_filter = {}

        if(!req.body.is_main_admin){
            notification_filter = { type : {$in: req.body.permissions.map(item =>  PERMISSION_TO_NOTIFICATION_TYPE[item.url] ).filter(number => number !== undefined)}};
        }
        
        if(admin_country_city_condition.country_id){
            country_city_condition = {
                country_id: admin_country_city_condition.country_id,
                $or: [{city_id: admin_country_city_condition.city_id},{city_id: null}]
            }
        }
        
        if (!req.body.get_notification_list) {
            new_notifications = await Admin_notification.count({ ...notification_filter, ...country_city_condition, is_read: false })
            return res.json({
                success: true,
                new_notifications: new_notifications
            })
        }

        const page = Math.max(1, parseInt(req.body.page));
        let admin_notifications = await Admin_notification.find({...notification_filter, ...country_city_condition}).sort({is_read: false, unique_id: -1}).skip((page - 1) * pageSize).limit(pageSize); 

        await Admin_notification.updateMany(
            { _id: { $in: admin_notifications.map(notification => notification._id) }, is_read: false },
            { $set: { is_read: true } }
        );
        new_notifications = await Admin_notification.count({ ...notification_filter, ...country_city_condition, is_read: false })
        socket_object.to("admin_panel").emit("new_admin_notification", {
            new_notifications: new_notifications
        })
        return res.json({
            success: true,
            admin_notifications: admin_notifications,
            new_notifications: new_notifications
        })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.remove_notification = async function (req, res) {
    try {
        let params_array = [] // Add 'page' to the required parameters
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        await Admin_notification.deleteOne({_id: req.body.notification_id})
        return res.json({
            success: true
        })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_details_country_city_wise = async function (req, res) {
    try {
        utils.check_request_params(req.body, [{ name: 'country_id', type: 'string' },{ name : 'city_id', type: 'string'}], function (response) {
            if (!response.success) {
                return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
            }
        })

        let partner = ''
        let provider = ''
        let corporate = await Corporate.find({ country_id: req.body.country_id }, { 'name': 1 })
        
        if (req.body.city_id != 'all') {
            partner = await Partner.find({ country_id: req.body.country_id, city_id: req.body.city_id }, { 'first_name': 1, 'last_name': 1 })
            provider = await Providers.find({ country_id: req.body.country_id, cityid: req.body.city_id }, { 'first_name': 1, 'last_name': 1 })
        } else {
            partner = await Partner.find({ country_id: req.body.country_id }, { 'first_name': 1, 'last_name': 1 })
            provider = await Providers.find({ country_id: req.body.country_id }, { 'first_name': 1, 'last_name': 1 })
        }
        
        return res.json({
          success: true,
          corporate: corporate,
          partner: partner,
          provider: provider,
        })
        
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

//for products and clients other than rental, we have to pass this response is equal to true. if not then comment below code for rental check.
exports.check_subscription = async function (req, res) {
    try {
        let settings = await Settings.findOne({},{sub_id:1, sub_customer_id:1, is_rental:1, rental_subscription_type:1})
        //this will check if client is rental or not
        if(!settings.is_rental){
            return res.json({
                success: true  
            })
        }
        let is_sub_expired = false;
        if(settings && settings.sub_id != ''){
            if(settings.rental_subscription_type == RENTAL_CLIENT_SUBSCRIPTION_TYPE.MEMO_PAYMENT){

                const options = {
                    method: 'GET',
                    url: `https://sandbox.dev.business.mamopay.com/manage_api/v1/subscriptions/${settings.sub_id}/subscribers`,
                    headers: {
                        accept: 'application/json',
                        Authorization: `Bearer ${memo_payment_key}`
                    }
                };

                try {
                    const response = await axios.request(options);
                    if(response.data.length != 0){
                        // time components for accurate comparison
                        const nextPaymentDate = new Date(response?.data[0]?.next_payment_date);
                        nextPaymentDate.setHours(0, 0, 0, 0);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        
                        if(response?.data[0]?.status == 'Active' || nextPaymentDate >= todayDate ){
                            is_sub_expired = true
                        }
                        if(settings.sub_customer_id == ''){
                            settings.sub_customer_id = (response?.data[0]?.id).toString();
                            await settings.save();
                        }
                    }
                } catch (error) {
                    console.error('Inner error in Mamopay:', error);
                    throw error;
                }

            } else {
                const stripe = require('stripe')(stripe_sk_key);
                const subscription = await stripe.subscriptions.retrieve(settings.sub_id);
                if(subscription && subscription.status == 'active'){
                    is_sub_expired = true
                }
            }
        }
        return res.json({
            success: is_sub_expired  
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.create_subscription_session = async function (req, res) {
    try {
        let settings = await Settings.findOne({})
        if(settings.rental_subscription_type == RENTAL_CLIENT_SUBSCRIPTION_TYPE.MEMO_PAYMENT){
            // if subscription is already created
            if(settings.sub_id != ''){
                const options = {
                    method: 'DELETE',
                    url: `https://sandbox.dev.business.mamopay.com/manage_api/v1/subscriptions/${settings.sub_id}`,
                    headers: {
                      accept: 'application/json',
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${memo_payment_key}`
                    }
                };
                await axios.request(options);
                settings.sub_id = "";
                settings.sub_customer_id = "";
                settings.rental_payment_link = "";
                await settings.save();
            }

            let todayDate = new Date();
            let formattedDate = moment(todayDate).format('YYYY/MM/DD');

            const options = {
                method: 'POST',
                url: 'https://sandbox.dev.business.mamopay.com/manage_api/v1/links',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${memo_payment_key}`
                },
                data: {
                    title: settings.rental_title || 'Rental Subscription',
                    description: settings.rental_description || 'Rental Subscription Payment',
                    active: true,
                    return_url: `${req.body.url}`,
                    failure_return_url: `${req.body.url}`,
                    processing_fee_percentage: settings.rental_processing_fee || 3,
                    amount: settings.rental_amount || 99,
                    amount_currency: settings.rental_amount_currency || 'USD',
                    link_type: 'standalone',
                    save_card: 'optional',
                    enable_customer_details: true,
                    subscription: {
                      frequency: settings.rental_subscription_frequency || 'monthly',
                      frequency_interval: 1,
                      start_date: (formattedDate).toString()
                    },
                    payment_methods: ['card']
                }
            };

            try {
                const response = await axios.request(options);
                
                settings.rental_payment_link = (response?.data?.id).toString();
                settings.sub_id = (response?.data?.subscription?.identifier).toString();
                await settings.save();

                return res.json({
                    success: true,
                    url: response?.data?.payment_url
                })
            } catch (error) {
                console.error('Inner error in Mamopay:', error.response.data);
                throw error;
            }
        } else { // Stripe Default
            const stripe = require('stripe')(stripe_sk_key);
            if(settings.sub_customer_id == ''){
                const session = await stripe.checkout.sessions.create({
                    billing_address_collection: 'auto',
                    line_items: [
                      {
                        price: settings.sub_price_id,
                        quantity: 1,
                      },
                    ],
                    mode: 'subscription',
                    success_url: `${req.body.url}`,
                    cancel_url: `${req.body.url}`,
                });
            
                return res.json({
                    success: true,
                    url: session.url
                })
            }else if(settings.sub_customer_id != '' && settings.sub_id == ''){
                const session = await stripe.checkout.sessions.create({
                    customer: settings.sub_customer_id,
                    billing_address_collection: 'auto',
                    line_items: [
                      {
                        price: settings.sub_price_id,
                        quantity: 1,
                      },
                    ],
                    mode: 'subscription',
                    success_url: `${req.body.url}`,
                    cancel_url: `${req.body.url}`,
                });
            
                return res.json({
                    success: true,
                    url: session.url
                })
            }else {
                const portalSession = await stripe.billingPortal.sessions.create({
                    customer: settings.sub_customer_id,
                    return_url: `${req.body.url}`,
                });
            
                return res.json({
                    success: true,
                    url: portalSession.url
                })
            }
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

//if the project is rentel then the project team need to add this webhook in stripe dashboard with 1) checkout.session.completed 2) customer.subscription.deleted 3) customer.deleted this three events.
exports.webhook = async function (req, res) {
    try {
        let check_url = 'https://admin.test.com/admin/check-subscription'  
        //Note: this check_url must based on project. For ex. if admin panel url is 'admin.eber.com' then check_url is 'https://admin.eber.com/admin/check-subscription';
        let settings = await Settings.findOne({},{sub_customer_id:1, sub_id: 1})
        let data = req.body.data;
        let eventType  = req.body.type;
        switch (eventType) {
            case 'checkout.session.completed':
                // Payment is successful and the subscription is created.
                // You should provision the subscription and save the customer ID to your database.
                if(data.object.success_url == check_url ){
                    console.log("webhooks_session_completed");
                    settings.sub_customer_id = (data.object.customer).toString();
                    settings.sub_id = (data.object.subscription).toString();
                    await settings.save()
                }
            break;
            case 'customer.subscription.deleted':
                // The payment failed or the customer does not have a valid payment method.
                // The subscription becomes past_due. Notify your customer and send them to the
                // customer portal to update their payment information.
                if(settings && settings.sub_id != '' && data.object.id == settings.sub_id){
                    console.log("webhooks_subscription_deleted");
                    settings.sub_id = '';
                    await settings.save()
                }
            break;
            case 'customer.deleted':
                // The payment failed or the customer does not have a valid payment method.
                // The subscription becomes past_due. Notify your customer and send them to the
                // customer portal to update their payment information.
                if(settings && settings.sub_customer_id != '' && data.object.id == settings.sub_customer_id){
                    console.log("webhooks_customer_deleted");
                    settings.sub_customer_id = '';
                    await settings.save()
                }
            break;
            default:
            // Unhandled event type
        }
        res.sendStatus(200);
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

