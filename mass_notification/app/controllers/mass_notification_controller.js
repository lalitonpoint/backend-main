let utils = require('./utils');
let queue_manager = require('./queue_manager')
let MassNotification = require('mongoose').model('mass_notification')
let Schema = require('mongoose').Types.ObjectId
let User = require('mongoose').model('User')
let Provider = require('mongoose').model('Provider')
let Admin = require('mongoose').model("admin")
const {
    TYPE_VALUE,
    COLLECTION
} = require('./constant')
const {
    SETTINGS_MESSAGE_CODE
} = require('../utils/success_code')

exports.fetch_notification_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user_type = Number(req.body.user_type)
        let limit = Number(req.body.limit)
        let page = Number(req.body.page) - 1
        let query = {}
        if (user_type) {
            query['user_type'] = user_type
        }
        let limits = { $limit: limit }
        let skip = { $skip: page * limit }
        let sort = { $sort: { unique_id: -1 } }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.MASS_NOTIFICATION, req.headers)

        let total_list = await MassNotification.find(country_city_condition)
        let total_page = Math.ceil(total_list.length / limit)
        let notification_list = await MassNotification.aggregate([{$match: country_city_condition}, { $match: query },sort,skip, limits])
        res.json({ success: true, notification_list: notification_list, total_page: total_page, success_code: SETTINGS_MESSAGE_CODE.DEFAULT_SUCCESS_CODE, success_message: "" })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.send_mass_notification = async function (req, res) {
    try {
        const params_array = [];
        const response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success) {
            return res.json(response);
        }

        const request_data_body = req.body;
        let country = request_data_body.country;
        if (country === 'all') {
            country = null;
        }
        let currency_code = req.body.currencycode    
        let admin = await Admin.findById(req.headers.admin_id)

        const mass_notification = new MassNotification({
            user_type: request_data_body.user_type,
            user_id: req.headers.admin_id,
            username: admin.username,
            email: admin.email,
            device_type: request_data_body.device_type,
            message: request_data_body.message,
            country: country
        });
        await mass_notification.save();

        const user_type = Number(request_data_body.user_type);

        let country_query = country ? { "$match": { country_id: { $eq: Schema(country) } } } : { "$match": {} };
        const device_type_query = (request_data_body.device_type !== 'all') ? { "$match": { device_type: request_data_body.device_type } } : { "$match": {} };
        const device_token_query = { "$match": { device_token: { $ne: '' } } };
        const group = { $group: { _id: '$device_type', device_token: { $addToSet: '$device_token'},webpush_config:{$addToSet:"$webpush_config"} } };

        let user_list;
        if (user_type === TYPE_VALUE.USER) {
            country_query =  currency_code ? { "$match": { wallet_currency_code: { $eq: currency_code } } } : { "$match": {} };
            user_list = await User.aggregate([country_query,device_type_query, device_token_query, group]);
        } else if (user_type === TYPE_VALUE.PROVIDER) {
            user_list = await Provider.aggregate([country_query, device_type_query, device_token_query, group]);
        }
        const message = request_data_body.message;
        if (user_list && user_list.length > 0) {
            const split_val = 100;
            user_list.forEach((user) => {
                const deviceType = user._id;
                const deviceTokens = user.device_token;
                const size = Math.ceil(deviceTokens.length / split_val);
                const webpush_config = user.webpush_config

                for (let i = 0; i < size; i++) {
                    const start = i * split_val;
                    const end = start + split_val;
                    const array = deviceTokens.slice(start, end);

                    let data = {
                        user_type: user_type,
                        deviceType: deviceType,
                        deviceTokens: array,
                        message: message,
                        webpush_config:webpush_config
                    };
                    queue_manager.massNotificationQueue.add(data)
                }
            });
        }
        res.json({ success: true, message: String(SETTINGS_MESSAGE_CODE.SENT_SUCCESSFULLY), success_message: utils.get_response_message(req.headers.lang_code, true, SETTINGS_MESSAGE_CODE.SENT_SUCCESSFULLY) });
    } catch (error) {
        utils.error_response(error, req, res);
    }
};

