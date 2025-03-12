let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails')
let Corporate = require('mongoose').model('Corporate');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Trip = require('mongoose').model('Trip');
let moment = require('moment');
let Trip_Location = require('mongoose').model('trip_location');
let Country = require('mongoose').model('Country')
let crypto = require('crypto');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let xl = require('excel4node');
let fs = require("fs");
let users = require('../../controllers/users')
let Wallet_history = require('mongoose').model('Wallet_history');
let Trip_history = require('mongoose').model('Trip_history');
let Card = require('mongoose').model('Card');
let Settings = require('mongoose').model('Settings');
const {
    TYPE_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    ERROR_CODE,
    COUNTRY_ERROR_CODE,
    TYPE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    PROVIDER_STATUS,
    ADMIN_NOTIFICATION_TYPE,
    SMS_TEMPLATE,
} = require('../../controllers/constant');
exports.register = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_CAPTCHA });
        }
        // code 
        let name = req.body.name
        name = name.charAt(0).toUpperCase() + name.slice(1)
        let email = (req.body.email.trim()).toLowerCase()
        let phone = req.body.phone
        let country_phone_code = req.body.country_phone_code
        let password = req.body.password
        let country_name = req.body.country_name
        let hash = crypto.createHash('md5').update(password).digest('hex')
        let country_id = req.body.country_id

        let corporate_email = await Corporate.findOne({ email: email })
        if (corporate_email) {
            let message = TYPE_ERROR_CODE.EMAIL_ALREADY_REGISTERED;
            res.json({ success: false, message: message })
            return
        }
        let corporate_phone = await Corporate.findOne({ phone: phone, country_phone_code: country_phone_code })
        if (corporate_phone) {
            let message = TYPE_ERROR_CODE.PHONE_ALREADY_REGISTERED
            res.json({ success: false, message: message })
            return
        }

        let token = utils.tokenGenerator(32)
        let referral_codes = utils.tokenGenerator(6)
        let country = await Country.findOne({ _id: country_id })
        if (!country) {
            let message = COUNTRY_ERROR_CODE.COUNTRY_NOT_FOUND
            res.json({ success: false, message: message })
            return
        }
        let corporate = new Corporate({
            name: name,
            email: email,
            country_phone_code: country_phone_code,
            country_name: country_name,
            phone: phone,
            password: hash,
            country_id: country._id,
            wallet_currency_code: country.currencycode,
            is_approved: 0,
            wallet: 0,
            token: token,
            refferal_code: referral_codes
        });
        await corporate.save()
        let email_notification = setting_detail.email_notification
        if (email_notification) {
            allemails.sendCorporateRegisterEmail(req, corporate, corporate.name);
        }
        let corporate_detail = await Corporate.findOne({ email: email })
        let message = TYPE_MESSAGE_CODE.ADD_SUCCESSFULLY;
        res.json({ success: true, message: message, corporate_detail: corporate_detail })

        // Trigger admin notification
        utils.addNotification({
            type: ADMIN_NOTIFICATION_TYPE.CORPORATE_REGISTERED,
            user_id: corporate._id,
            username: corporate.name,
            country_id: corporate.country_id,
            user_unique_id: corporate.unique_id,
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.login = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_CAPTCHA });
        }
        // code 
        let password = req.body.password;
        let hash = crypto.createHash('md5').update(password).digest('hex');
        let email = req.body.email
        let corporate = await Corporate.findOne({ email: email })
        let error_code;
        if (!corporate) {
            error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        if (corporate.password != hash) {
            error_code = TYPE_ERROR_CODE.PASSWORD_WRONG
            res.json({ success: false, error_code: error_code })
            return
        }

        if (corporate.is_approved !== 1) {
            error_code = TYPE_ERROR_CODE.NOT_APPROVE
            res.json({ success: false, error_code: error_code })
            return
        }
        let token = utils.tokenGenerator(32)
        corporate.token = token;
        await corporate.save()
        let message = TYPE_MESSAGE_CODE.LOGIN_SUCCESSFULLY
        res.json({ success: true, message: message, corporate_detail: corporate })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.sign_out = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let message
        if (req.body.is_admin_decline) {
            message = ERROR_CODE.DECLINE_BY_ADMIN
            res.json({ success: true, error_code: message })
            return
        }
        message = TYPE_MESSAGE_CODE.LOGOUT_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.forgot_password = async function (req, res) {
    try {
        let params_array = [{ name: 'email', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_CAPTCHA });
        }
        // code 
        let corporate = await Corporate.findOne({ email: req.body.email })
        if (!corporate) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        let token = utils.tokenGenerator(32);
        let id = corporate._id;
        let link = req.get('origin') + '/corporate/reset-password?id=' + id + '&&token=' + token;
        let html = ` <a href="${link}">Click Here</a>`
        allemails.userForgotPassword(req, corporate, html);
        await Corporate.findOneAndUpdate({ _id: id }, { token: token })
        let message = TYPE_MESSAGE_CODE.LINK_SENT_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.update_password = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let id = req.body.id
        let token = req.body.token
        let password = req.body.password
        let corporate = await Corporate.findOne({ _id: id, token: token })
        if (!corporate) {
            let error_code = TYPE_ERROR_CODE.INVALID_DATA
            res.json({ success: false, error_code: error_code })
            return
        }
        let hash = crypto.createHash('md5').update(password).digest('hex')
        corporate.password = hash
        corporate.token = utils.tokenGenerator(36)
        await corporate.save()
        const setting_detail = await Settings.findOne({}).select({ sms_notification: 1 });

        if (setting_detail.sms_notification) {
            utils.sendSmsForOTPVerificationAndForgotPassword(corporate.country_phone_code + corporate.phone, SMS_TEMPLATE.FORGOT_PASSWORD, password)
        }
        let message = TYPE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.delete = async function (req, res) {
    try {
        let params_array = [{ name: 'corporate_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let corporate = await Corporate.findOne({ _id: req.body.corporate_id })

        if (!corporate) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        await Trip_history.updateMany({ user_type_id: corporate._id }, { user_type_id: null });
        await Trip.updateMany({ user_type_id: corporate._id }, { user_type_id: null });
        await User.updateMany({ user_type_id: corporate._id }, { user_type_id: null, corporate_ids: [], user_type: constant_json.USER_TYPE_NORMAL });
        await Wallet_history.deleteMany({ user_id: corporate._id });
        await Card.deleteMany({ user_id: corporate._id });
        await Corporate.deleteOne({ _id: corporate._id });
        await Corporate.findByIdAndDelete(req.body.corporate_id)
        let message = TYPE_MESSAGE_CODE.DELETE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_user_setting_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        users.get_user_setting_detail(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.profile = async function (req, res) {
    let id = req.body.id
    let corporate = await Corporate.findById(id)
    if (!corporate) {
        let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
        res.json({ success: false, error_code: error_code })
        return
    }
    res.json({ success: true, corporate_detail: corporate })
}


exports.edit = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let id = req.body.id
        let phone = req.body.phone
        let password = req.body.password
        let hash = crypto.createHash('md5').update(password).digest('hex')
        let new_password = req.body.new_password
        let new_password_hash;
        let message
        if (new_password) {
            new_password_hash = crypto.createHash('md5').update(new_password).digest('hex')
        }
        let corporate = await Corporate.findOne({ _id: { $ne: id }, phone: phone })
        if (corporate) {
            let message = admin_messages.error_message_mobile_no_already_used;
            res.json({ success: false, message: message })
            return
        }
        let findCorporate = await Corporate.findOne({ _id: id })
        if (!findCorporate) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        if (findCorporate.password != hash) {
            let message = admin_messages.error_message_password_wrong
            res.json({ success: false, message: message })
            return
        }
        if (req.body.new_password != '') {
            req.body.password = new_password_hash
        } else {
            req.body.password = hash
        }
        let updateCorporate = await Corporate.findOneAndUpdate({ _id: id }, req.body, { new: true })

        message = TYPE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message, corporate_detail: updateCorporate })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}



exports.history = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 

        let page
        let sort_field
        let sort_order
        let start_date
        let end_date
        let search_item
        let search_value
        let filter_start_date
        let filter_end_date

        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }

        if (req.body.search_item == undefined) {
            sort_field = 'unique_id'
            sort_order = -1
            start_date = ''
            end_date = ''
            filter_start_date = ''
            filter_end_date = ''
            search_item = 'user_detail.first_name'
            search_value = ''
        } else {
            sort_field = req.body.sort_item[0]
            sort_order = req.body.sort_item[1]
            filter_start_date = req.body.start_date
            filter_end_date = req.body.end_date
            search_item = req.body.search_item
            search_value = req.body.search_value
        }

        // date query
        if (filter_start_date == '' || filter_end_date == '') {
            if (filter_start_date == '' && filter_end_date == '') {
                start_date = new Date(0);
                end_date = new Date(Date.now());
            } else if (filter_start_date != '' && filter_end_date == '') {
                start_date = new Date(filter_start_date)
                start_date = start_date.setHours(0, 0, 0, 0)
                start_date = new Date(start_date)
                end_date = new Date(Date.now())
            } else {
                end_date = new Date(filter_end_date)
                end_date = end_date.setHours(23, 59, 59, 999)
                end_date = new Date(end_date)
                start_date = new Date(0)
            }
        } else if (filter_start_date == undefined || filter_end_date == undefined) {
            start_date = new Date(0);
            end_date = new Date(Date.now());
        } else {
            start_date = new Date(req.body.start_date)
            start_date = start_date.setHours(0, 0, 0, 0)
            start_date = new Date(start_date)
            end_date = new Date(req.body.end_date)
            end_date = end_date.setHours(23, 59, 59, 999)
            end_date = new Date(end_date)
        }

        // search query
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        let search;
        if (search_item == "user_detail.first_name") {
            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                search = { "$match": { $or: [query1, query2] } };
            } else {
                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
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
            search = { "$match": { 'unique_id': parseInt(search_value) } };
        }
        // for user
        let user_lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                as: 'user_detail'
            }
        }
        let user_unwind = {
            $unwind: {
                path: '$user_detail',
                preserveNullAndEmptyArrays: true
            }
        }

        // for provider
        let proivder_lookup = {
            $lookup: {
                from: 'providers',
                localField: 'confirmed_provider',
                foreignField: '_id',
                as: 'provider_detail'
            }
        }
        let provider_unwind = {
            $unwind: {
                path: '$provider_detail',
                preserveNullAndEmptyArrays: true
            }
        }


        // date filter 
        let filter = { $match: { 'created_at': { $gte: start_date, $lt: end_date } } }

        // match condition
        let condition = { $match: { 'user_type_id': Schema(req.body.corporate_id) } }
        // page limit skip sort done
        let limit = { $limit: 10 }
        let skip = { $skip: req.body.page * 10 }
        let sort = { $sort: { [sort_field]: parseInt(sort_order) } }

        Trip_history.aggregate([filter, condition, user_lookup, user_unwind, proivder_lookup, provider_unwind, search]).then((trip_details) => {
            let total_page = Math.ceil(trip_details.length / 10)
            Trip_history.aggregate([filter, condition, user_lookup, user_unwind, proivder_lookup, provider_unwind, search, sort, skip, limit]).then((trip_details) => {
                res.json({ success: true, detail: trip_details, 'current_page': page, 'total_pages': total_page });
            })
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}



exports.future_request = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let corporate = await Corporate.findById(req.body.corporate_id)
        if (!corporate) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }

        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let filter_start_date;
        let filter_end_date;
        let start_date
        let value
        let end_date

        if (req.body.page == undefined) {
            page = 0;
            next = 1;
            pre = 0;
        } else {
            page = req.body.page;
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
        }
        if (req.body.search_item == undefined) {
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
            filter_start_date = '';
            filter_end_date = '';

        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');


            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
            filter_start_date = req.body.start_date;
            filter_end_date = req.body.end_date;

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

        let number_of_rec = 10;

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
        if (search_item == "user_detail.first_name") {
            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
            }
        } else {
            search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
        }

        query1['created_at'] = { $gte: start_date, $lt: end_date };
        let filter = { "$match": query1 };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let count = { $group: { _id: null, total: { $sum: 1 }, data: { $push: '$data' } } };

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;

        let condition = { $match: { 'is_schedule_trip': { $eq: true } } };
        let condition1 = { $match: { 'is_trip_cancelled': { $eq: 0 } } };
        let condition2 = { $match: { 'is_trip_completed': { $eq: 0 } } };
        let condition3 = { $match: { 'is_trip_end': { $eq: 0 } } };
        let condition4 = { $match: { 'provider_id': { $eq: null } } };
        let corporate_type_condition = { $match: { 'user_type_id': { $eq: Schema(req.body.corporate_id) } } };

        let country_data = await Country.findOne({ _id: corporate.country_id })
        if (!country_data) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }

        let vehicle_type_lookup = {
            $lookup: {
                from: 'types',
                localField: 'type_id',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, typename: 1, unique_id: 1 } }],
                as: 'vehicle_type_details'
            }
        }
        let vehicle_unwind = { $unwind: "$vehicle_type_details" }

        let array = await Trip.aggregate([corporate_type_condition, condition, condition1, condition2, condition3, condition4, lookup, unwind, vehicle_type_lookup, vehicle_unwind, search, filter, count])

        if (array.length == 0) {
            res.json({ success: true, detail: array, timezone: country_data.countrytimezone, 'current_page': 1, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date });
            return
        }
        let pages = Math.ceil(array[0].total / number_of_rec);
        let detail = await Trip.aggregate([corporate_type_condition, condition, condition1, condition2, condition3, condition4, lookup, unwind, vehicle_type_lookup, vehicle_unwind, search, filter, sort, skip, limit])
        res.json({ success: true, detail: detail, timezone: country_data.countrytimezone, 'current_page': page, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.users = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let corporate = await Corporate.findById(req.body.corporate_id)
        if (!corporate) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        let query = {};
        let query1 = {};
        let query2 = {};
        let query3 = {};
        let query4 = {};
        let query5 = {};
        let query6 = {};
        let array = [];

        let page;
        let next;
        let pre;
        let search_item;
        let search_value;
        let filter_start_date;
        let filter_end_date;
        let value
        let options;
        if (req.body.page == undefined) {
            search_item = 'email';
            search_value = '';
            filter_start_date = '';
            filter_end_date = '';
        } else {
            let item = req.body.search_item;
            value = req.body.search_value;
            search_item = item
            search_value = value;
            filter_start_date = req.body.start_date;
            filter_end_date = req.body.end_date;
        }
        if (!req.body.search_value) {
            req.body.search_value = undefined;
        }

        if (req.body.search_value) {
            query['is_approved'] = 1;
            query['country_phone_code'] = corporate.country_phone_code;
            query[search_item] = req.body.search_value;
        } else {
            query['corporate_ids.corporate_id'] = corporate._id;
        }

        let userscount = await User.count(query)

        if (userscount == 0) {
            res.json({ success: true, moment: moment, corporate_id: corporate._id, detail: array, currentpage: '', pages: '', next: '', pre: '', search_item, search_value, filter_start_date, filter_end_date });
            return
        }
        let total_page = Math.ceil(userscount / 10)
        if (req.body.page == undefined) {
            page = 1;
            next = parseInt(page) + 1;
            pre = page - 1;

            options = {
                sort: { unique_id: -1 },
                page: page,
                limit: 10
            };
        } else {
            page = req.body.page;
            next = parseInt(req.body.page) + 1;
            pre = req.body.page - 1;
            let sort = {};
            sort['unique_id'] = -1

            options = {
                sort: sort,
                page: page,
                limit: 10
            };

        }


        let users = await User.paginate({ $and: [{ $or: [query1, query2, query3, query4, query5, query6] }, query] }, options)
        let settingData = await Settings.findOne({})
        let is_public_demo = settingData.is_public_demo;
        let timezone_for_display_date = settingData.timezone_for_display_date;
        if (users.docs.length <= 0) {
            res.json({ success: true, is_public_demo: is_public_demo, corporate_id: corporate._id, timezone_for_display_date: timezone_for_display_date, detail: [], pages: users.pages, currentpage: users.page, next: next, pre: pre, search_item, search_value, filter_start_date, filter_end_date, total_page: total_page });
        }
        let j = 1;
        users.docs.forEach(async function (user_data) {
            let id = user_data.referred_by;
            query = {};
            query['_id'] = id;
            if (id != undefined) {
                let user_val = await User.findOne(query)
                let user_name = "";
                if (user_val != null) {
                    user_name = user_val.first_name + ' ' + user_val.last_name;
                }

                if (j == users.docs.length) {
                    user_data.referred_by = user_name;
                    res.json({ success: true, moment: moment, corporate_id: corporate._id, is_public_demo: is_public_demo, timezone_for_display_date: timezone_for_display_date, detail: users.docs, pages: users.pages, currentpage: users.page, next: next, pre: pre, search_item, search_value, filter_start_date, filter_end_date, total_page: total_page });
                } else {
                    user_data.referred_by = user_name;
                    j = j + 1;
                }
            } else {
                if (j == users.docs.length) {
                    user_data.referred_by = "";
                    res.json({ success: true, moment: moment, corporate_id: corporate._id, is_public_demo: is_public_demo, timezone_for_display_date: timezone_for_display_date, detail: users.docs, pages: users.pages, next: next, currentpage: users.page, pre: pre, search_item, search_value, filter_start_date, filter_end_date, total_page: total_page });
                } else {
                    user_data.referred_by = "";
                    j = j + 1;
                }
            }
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.send_request = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let user_id = req.body.user_id
        let corporate_id = req.body.corporate_id
        let user = await User.findById(user_id);
        if (!user) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        user.corporate_ids.push({
            corporate_id: Schema(corporate_id),
            status: Number(constant_json.CORPORATE_REQUEST_WAITING)
        })
        user.markModified('corporate_ids');
        let corporate = await Corporate.findById(corporate_id)
        utils.req_type_id_socket(user._id)
        await user.save()
        utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_NEW_CORPORATE_REQUEST, {
            name: corporate.name,
            phone: corporate.phone,
            _id: corporate._id,
            country_phone_code: corporate.country_phone_code,
            status: user.corporate_ids[0].status
        }, user.webpush_config, user.lang_code);
        let message = TYPE_MESSAGE_CODE.SEND_REQUEST_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.add_limit = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let user_id = req.body.user_id
        let amount = req.body.wallet
        let user = await User.findById(user_id)

        if (!user) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        if (!user.corporate_wallet_limit) {
            user.corporate_wallet_limit = 0
        }
        user.corporate_wallet_limit = +user.corporate_wallet_limit + +amount
        await user.save()
        let message = success_messages.MESSAGE_CODE_USER_LIMIT_UPDATED_SUCCESSFULLY
        res.json({ success: true, message, wallet: user.corporate_wallet_limit });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.remove_user = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let user_id = req.body.user_id
        let user_detail = await User.findById(user_id)
        if (user_detail.current_trip_id != null) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_IS_IN_TRIP });
            return;
        }
        if (!user_detail) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        utils.req_type_id_socket(user_detail._id)
        let index = user_detail.corporate_ids.findIndex((x) => x._id == req.body.corporate_id);
        user_detail.corporate_ids.splice(index, 1);
        user_detail.user_type_id = null;
        user_detail.user_type = Number(constant_json.USER_TYPE_NORMAL)
        user_detail.corporate_wallet_limit = 0;
        user_detail.save().then(() => {
            let message = TYPE_MESSAGE_CODE.DELETE_SUCCESSFULLY;
            res.json({ success: true, message: message });
        });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}



exports.wallet_history = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let corporate_id = req.body.corporate_id
        let wallet_details = await Wallet_history.find({ user_id: corporate_id })
        res.json({ success: true, message: TYPE_MESSAGE_CODE.LIST_SUCCESSFULLY, wallet_history: wallet_details });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.trip_user_list = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let server_date = new Date(Date.now());

        let corporate_id = req.body.corporate_id
        let corporate = await Corporate.findById(corporate_id)

        let user_condition = { 'is_approved': 1, 'country_phone_code': corporate.country_phone_code }
        let corporate_condition = { 'corporate_ids': { $elemMatch: { corporate_id: Schema(corporate_id), status: Number(constant_json.CORPORATE_REQUEST_ACCEPTED) } } }
        let query = { $match: { $and: [user_condition, corporate_condition] } }
        let user = await User.aggregate([query])
        let country = await Country.findOne(corporate.country_id)

        res.json({
            'moment': moment,
            server_date: server_date, scheduled_request_pre_start_minute: setting_detail.scheduled_request_pre_start_minute,
            country_code: country.countrycode,
            phone_number_min_length: setting_detail.minimum_phone_number_length,
            phone_number_length: setting_detail.maximum_phone_number_length,
            user_list: user, corporates: corporate, country: country.countryname
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.generate_request_excel = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 

        let page;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let start_date
        let end_date

        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }
        let request;
        let value;
        if (req.body.search_item == undefined) {
            request = req.path.split('/')[1];
            search_item = 'user_detail.first_name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';

        } else {
            request = req.body.request;
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');
            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }

        let Table = Trip_history
        if (request == 'corporate_request') {
            Table = Trip;
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

        let number_of_rec = 10;

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
        if (search_item == "user_detail.first_name") {


            let full_name = value.split(' ');
            if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };

                search = { "$match": { $or: [query1, query2] } };
            } else {

                query1[search_item] = { $regex: new RegExp(value, 'i') };
                query2['user_detail.last_name'] = { $regex: new RegExp(value, 'i') };
                query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                query4['user_detail.last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                query6['user_detail.last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
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

        let filter = { "$match": {} };
        filter["$match"]['created_at'] = { $gte: start_date, $lt: end_date };

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);


        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;
        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;
        let condition = { $match: { 'user_type_id': { $eq: Schema(req.body.corporate._id) } } };
        Table.aggregate([filter, condition, lookup, unwind, lookup1, search, sort, skip, limit]).then((array) => {
            let date = new Date()
            let time = date.getTime()

            let wb = new xl.Workbook();
            let ws = wb.addWorksheet('sheet1');
            let col = 1;

            let title
            if (req.body.header) {
                title = req.body.header
            } else {
                title = {
                    id: 'Id',
                    user_id: 'UserId',
                    user: 'User',
                    driver_id: 'DriverId',
                    driver: 'Driver',
                    date: 'Date',
                    status: 'Status',
                    amout: 'Amount',
                    payment: 'Payment',
                    payment_status: 'Payment Status',
                    title_status_cancel_by_provider: 'Cancelled By Provider',
                    title_status_cancel_by_user: 'Cancelled By User',
                    title_trip_status_coming: 'Coming',
                    title_trip_status_arrived: 'Arrived',
                    title_trip_status_trip_started: 'Started',
                    title_trip_status_completed: 'Compeleted',
                    title_trip_status_accepted: 'Accepted',
                    title_trip_status_waiting: 'Waiting',
                    title_pay_by_cash: 'Cash',
                    title_pay_by_card: 'Card',
                    title_pending: 'Pending',
                    title_paid: 'Paid',
                    title_not_paid: 'Not Paid'
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
                ws.cell(index + 2, col++).string(moment(data.created_at).tz(setting_detail.timezone_for_display_date).format('DD MMM YYYY HH:mm a'));

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
                        ws.cell(index + 2, col++).string(title.title_trip_status_coming);
                    } else if (data.is_provider_status == PROVIDER_STATUS.ARRIVED) {
                        ws.cell(index + 2, col++).string(title.title_trip_status_arrived);
                    } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                        ws.cell(index + 2, col++).string(title.title_trip_status_trip_started);
                    } else if (data.is_provider_status == PROVIDER_STATUS.TRIP_COMPLETED) {
                        ws.cell(index + 2, col++).string(title.title_trip_status_completed);
                    } else if (data.is_provider_status == PROVIDER_STATUS.ACCEPTED || data.is_provider_status == PROVIDER_STATUS.WAITING) {
                        if (data.is_provider_accepted == 1) {
                            ws.cell(index + 2, col++).string(title.title_trip_status_accepted);
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
                    wb.write('data/xlsheet/' + time + '_corporate_request.xlsx', function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_corporate_request.xlsx";
                            res.json(url);
                            setTimeout(function () {
                                fs.unlink('data/xlsheet/' + time + '_corporate_request.xlsx', function () {
                                });
                            }, 10000)
                        }
                    });
                }
            })
        });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}