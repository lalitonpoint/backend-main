const mongoose = require('mongoose');
const Schema = mongoose.Types.ObjectId
const Promo_Code = require('mongoose').model('Promo_Code');
const User_promo_use = require('mongoose').model('User_promo_use');
const Trip = require('mongoose').model('Trip');
const Trip_history = require('mongoose').model('Trip_history');
const utils = require('../../controllers/utils')
const Banner = require('mongoose').model('banner');
const Setting = require('mongoose').model('Settings')
const {
    PROMO_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    PROMO_ERROR_CODE,
} = require('../../utils/error_code')
const {
    HIDE_DETAILS,
    COLLECTION,
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');

exports.fetch_promo_list = async function (req, res) {
    try {
        let params_array = [{ name: 'page_type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let page_type = req.body.page_type
        let date = new Date()
        let query;
        let search_item = req.body.search_item
        let serach_value = req.body.serach_value
        let limit = Number(req.body.limit)
        let page = Number(req.body.page) - 1
        switch (page_type) {
            case '1':
                query = { 'code_expiry': { $gte: date }, state: 1 }
                break;
            case '2':
                query = { 'code_expiry': { $gte: date }, state: 0 }
                break;
            case '3':
                query = { 'code_expiry': { $lt: date } }
                break;
            default:
                query = {}
        }
        let contry_lookup = {
            $lookup: {
                from: 'countries',
                localField: 'countryid',
                foreignField: '_id',
                as: 'country_details'
            }
        }
        let unwind = {
            $unwind: '$country_details'
        }
        if (serach_value) {
            query[search_item] = { $regex: serach_value, $options: 'i' }
        }
        let condition = { $match: query }

        const pagination = {
            $facet: {
                data: [{ $count: "promoCount" }],
                promo_codes: [
                    { $skip: page * limit },
                    { $limit: limit }
                ],
            },
        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.PROMO, req.headers)

        const result = await Promo_Code.aggregate([{ $match: country_city_condition }, condition, contry_lookup, unwind, pagination])
        const promo_list = result[0].promo_codes
        const total_page = Math.ceil((result[0]?.data[0]?.promoCount || 0) / limit)
        
        res.json({ success: true, promo_list: promo_list, total_page: total_page })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_promo = async function (req, res) {
    try {
        let params_array = [{ name: 'promocode', type: 'string' }, { name: 'countryid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let promocode = (req.body.promocode).toUpperCase()
        let countryid = req.body.countryid
        let duplicate_promo = await Promo_Code.findOne({ promocode: promocode, countryid: countryid })
        if (duplicate_promo) {
            let error_code = PROMO_ERROR_CODE.PROMO_CODE_ALREADY_USED
            res.json({ success: false, error_code: error_code })
            return
        }
        if(req.body.start_date == req.body.code_expiry){
            const nextDay = new Date(req.body.code_expiry);
            nextDay.setHours(23, 59 , 59, 0);
            req.body.code_expiry = nextDay.toISOString()
        }
        let add_promo_detail = new Promo_Code({
            promocode: promocode,
            code_value: req.body.code_value,
            code_type: req.body.code_type,
            code_uses: req.body.code_uses,
            user_used_promo: 0,
            countryid: req.body.countryid,
            cityid: req.body.cityid,
            state: 1,
            start_date: req.body.start_date,
            code_expiry: req.body.code_expiry,
            completed_trips_type: req.body.completed_trips_type,
            completed_trips_value: req.body.completed_trips_value,
            description: req.body.description
        });
        await add_promo_detail.save()

        let info_detail = "ADDED"

        utils.addChangeLog(UPDATE_LOG_TYPE.PROMO_SETTINGS, req.headers, [], add_promo_detail.promocode, info_detail, {
            info_detail: add_promo_detail.promocode,
            promo_id: add_promo_detail._id
        })

        let message = PROMO_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_promo_details = async function (req, res) {
    try {
        let params_array = [{ name: 'promo_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.promo_id
        let before_update_promo = await Promo_Code.findById(id)
        if (req.body?.start_date == req.body?.code_expiry) {
            const nextDay = new Date(req.body.code_expiry);
            nextDay.setHours(23, 59, 59, 0);
            req.body.code_expiry = nextDay.toISOString()
        }
        let update_promo = await Promo_Code.findByIdAndUpdate(id, req.body, { new: true })
        let changes = utils.getModifiedFields(before_update_promo, update_promo)

        if (changes.length > 0) {
            utils.addChangeLog(UPDATE_LOG_TYPE.PROMO_SETTINGS, req.headers, changes, before_update_promo.promocode, "", {
                promo_id: update_promo._id
            })
        }

        if (!update_promo) {
            let error_code = PROMO_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = PROMO_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.delete_promocode = async function (req, res) {
    try {
        let params_array = [{ name: "promo_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.promo_id
        let delete_promo = await Promo_Code.findByIdAndDelete(id)
        if (!delete_promo) {
            let error_code = PROMO_ERROR_CODE.DELETE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = PROMO_MESSAGE_CODE.DELETE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.promo_used_info = async function (req, res) {
    try {
        let params_array = [{ name: 'promo_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let promo_id = req.body.promo_id
        let promo_condition = { $match: { _id: Schema(promo_id) } }
        let promo_country_details = {
            $lookup: {
                from: 'countries',
                localField: 'countryid',
                foreignField: '_id',
                as: 'country_details'
            }
        }
        let country_unwind = {
            $unwind: '$country_details'
        }
        let promo_detail = await Promo_Code.aggregate([promo_condition, promo_country_details, country_unwind])
        let used_promo_condition = { $match: { promo_id: { $eq: Schema(promo_id) } } };
        let lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                pipeline: [{ $project: { first_name: 1, last_name: 1, unique_id: 1, email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1, phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1, country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1 } }],
                foreignField: '_id',
                as: 'user_details'
            }
        }
        let unwind = { $unwind: '$user_details' }
        let lookup1 = {
            $lookup: {
                from: 'trips',
                localField: 'trip_id',
                foreignField: '_id',
                as: 'trip_details'
            }
        }
        let unwind1 = { $unwind: '$trip_details' }
        let lookup2 = {
            $lookup: {
                from: 'trip_histories',
                localField: 'trip_id',
                foreignField: '_id',
                as: 'trip_details'
            }
        }
        let unwind2 = { $unwind: '$trip_details' }
        let used_promo_trip_details = await User_promo_use.aggregate([used_promo_condition, lookup, unwind, lookup1, unwind1])
        let used_promo_trip_history = await User_promo_use.aggregate([used_promo_condition, lookup, unwind, lookup2, unwind2])
        let used_promo_array = used_promo_trip_details.concat(used_promo_trip_history)
        if (used_promo_array.length > 0) {
            let total_promo_payment = 0
            let total_promo_payment_trip = await Trip.aggregate([used_promo_condition, { $group: { _id: null, total: { $sum: '$promo_payment' } } }])
            if (total_promo_payment_trip.length > 0) {
                total_promo_payment = total_promo_payment + total_promo_payment_trip[0].total
            }
            let total_promo_payment_history = await Trip_history.aggregate([used_promo_condition, { $group: { _id: null, total: { $sum: '$promo_payment' } } }])
            if (total_promo_payment_history.length > 0) {
                total_promo_payment = total_promo_payment + total_promo_payment_history[0].total
            }
            res.json({ success: true, promo_detail: promo_detail[0], total_promo_payment: total_promo_payment, used_promo_array: used_promo_array })
            return
        }
        res.json({ success: true, promo_detail: promo_detail[0], total_promo_payment: 0, used_promo_array: [] })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_banner_list = async function (request_data, response_data) {
    try {
        if(!request_data.body?.is_admin_list){
            let settings = await Setting.findOne({},{is_banner_visible:1})
            if(!settings?.is_banner_visible){
                return response_data.json({ success: false, banners: [] })
            }
        }
        let banners = await Banner.find({});
        if (!banners.length) {
            return response_data.json({ success: false, banners })
        }
        return response_data.json({ success: true, banners })
    } catch (error) {
        utils.error_response(error, request_data, response_data);
    }
}


exports.add_banner = async function (request_data, response_data) {
    try {

        const requiredParams = [
            { name: 'banner_title', type: 'string' },
            { name: 'redirect_url', type: 'string' },
            { name: 'action_link', type: 'string' },
            { name: 'action_text', type: 'string' },
            { name: 'is_visible', type: 'boolean' }
        ];

        // Validate request parameters
        const response = await utils.check_request_params_async(request_data.body, requiredParams);
        if (!response.success) {
            return response_data.json(response);
        }

        const { banner_title, ...requestData } = request_data.body;

        // Check if a banner with the same name already exists
        const bannerExists = await Banner.findOne({
            banner_title: { '$regex': new RegExp(`^${banner_title}$`, 'i') }
        });

        if (bannerExists) {
            return response_data.json({ success: false, error_code: PROMO_ERROR_CODE.BANNER_WITH_SAME_NAME_ALREADY_EXISTS });
        }

        // Create and save the new banner
        const banner = new Banner({ banner_title, ...requestData });
        await banner.save();

        return response_data.json({ success: true, message: PROMO_MESSAGE_CODE.BANNER_ADD_SUCCESSFULLY ,banner: banner });
    } catch (error) {
        utils.error_response(error, request_data, response_data);
    }
}

exports.update_banner = async function (request_data, response_data) {
    try {
        const { _id, ...updateData } = request_data.body;
    
        const response =  await utils.check_request_params_async(request_data.body, [
            { name: 'banner_title', type: 'string' },
            { name: 'redirect_url', type: 'string' },
            { name: 'action_link', type: 'string' },
            { name : "_id" , type : 'string'},
            { name: 'action_text', type: 'string' },
            { name: 'is_visible', type: 'boolean' }
        ]);

        if (!response.success) {
            return response_data.json(response);
        }
        
        // Check if a banner with the same name already exists
        const bannerExists = await Banner.findOne({
            _id: { $ne: _id },
            banner_title: { '$regex': new RegExp(`^${updateData.banner_title}$`, 'i') }
        });

        if (bannerExists) {
            return response_data.json({ success: false, error_code: PROMO_ERROR_CODE.BANNER_WITH_SAME_NAME_ALREADY_EXISTS });
        }
    
        const banner = await Banner.findOneAndUpdate({ _id: _id }, updateData, { new: true });
        return response_data.json({
            success: true,
            message: PROMO_MESSAGE_CODE.BANNER_UPDATED_SUCCESSFULLY,
            banner
        });
    } catch (error) {
        utils.error_response(error, request_data, response_data);
    }
    
}
exports.delete_banner = async function (request_data, response_data) {
    try {
        const { _id } = request_data.body;

        const response =  await utils.check_request_params_async(request_data.body, [
            { name: '_id', type: 'string' },
        ]);

        if (!response.success) {
            return response_data.json(response);
        }
    
        // Delete the banner
        const banner = await Banner.findByIdAndDelete(_id);

        if (!banner) {
            return response_data.json({ success: false, error_code: PROMO_ERROR_CODE.BANNER_NOT_FOUND });
        }

        return response_data.json({ success: true, message: PROMO_MESSAGE_CODE.BANNER_DELETED_SUCCESSFULLY });

    } catch (error) {
        utils.error_response(error, request_data, response_data);
   }
}
