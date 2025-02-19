let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider')
let Dispatcher = require('mongoose').model('Dispatcher')
let Corporate = require('mongoose').model('Corporate')
let Hotel = require('mongoose').model('Hotel')
let Partner = require('mongoose').model('Partner')
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let Card = require('mongoose').model('Card');
let Wallet_history = require('mongoose').model('Wallet_history');
let User_Document = require('mongoose').model('User_Document');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Provider_Document = require('mongoose').model('Provider_Document');
let Partner_Vehicle_Document = require('mongoose').model('Partner_Vehicle_Document');
let Document_list = require('mongoose').model('Document')
let Reviews = require('mongoose').model('Reviews')
let City_type = require('mongoose').model('city_type')
let CityZone = require('mongoose').model('CityZone');
let Country = require('mongoose').model('Country')
let mongoose = require('mongoose')
let crypto = require('crypto')
let xl = require('excel4node');
let fs = require("fs");
let Schema = mongoose.Types.ObjectId
let allemails = require('../../controllers/emails');
let utils = require('../../controllers/utils');
let Settings = require('mongoose').model('Settings')
let moment = require('moment-timezone');
let Vehicle = require('mongoose').model('Vehicle');
let Hub = require('mongoose').model('Hub');
let Type = require('mongoose').model('Type');
let City = require('mongoose').model('City');
let Document = require('mongoose').model('Document');
let Hub_User = require('mongoose').model('Hub_User');
let Vehicle_Brand = require('mongoose').model('Vehicle_Brand');
let Vehicle_Model = require('mongoose').model('Vehicle_Model');
var wsal_services = require('../../controllers/wsal_controller');
let Car_Rent_Type = require('mongoose').model('Car_Rent_Type');
let Car_Rent_Brand = require('mongoose').model('Car_Rent_Brand');
let Car_Rent_Model = require('mongoose').model('Car_Rent_Model');
let Car_Rent_Feature = require('mongoose').model('Car_Rent_Feature');
let Car_Rent_Specification = require('mongoose').model('Car_Rent_Specification');
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");

const {
    PARTNER_MESSAGE_CODE,
    DOCUMENT_MESSAGE_CODE,
    LIST_MESSAGE_CODE,
    VEHICLE_MESSAGE_CODE,
    HUB_USER_MESSAGE_CODE,
    VEHICLE_MODEL_BRAND_MESSAGE_CODE,
    CAR_RENT_MESSAGE_CODE
} = require('../../utils/success_code')
const {
    PARTNER_ERROR_CODE,
    DOCUMENT_ERROR_CODE,
    LIST_ERROR_CODE,
    HUB_ERROR_CODE,
    VEHICLE_MODEL_BRAND_ERROR_CODE,
    RENT_CAR_ERROR_CODE
} = require('../../utils/error_code')
const {
    TYPE_VALUE,
    HIDE_DETAILS,
    COLLECTION,
    PROVIDER_TYPE,
    VEHICLE_HISTORY_TYPE,
} = require('../../controllers/constant');

exports.fetch_type_list = async function (req, res) {
    try {
        let params_array = [{ name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let Type;
        let vehicle_foreign_field = "provider_id"

        let type = Number(req.query.type)
        let is_approved = req.query.is_approved
        let is_active = req.query.is_active
        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1
        let search_item = req.query.search_item
        let search_value = req.query.search_value
        let partner_id = req.query.partner_id
        let hub_id = req.query.hub_id
        let is_excel_sheet = req.query.is_excel_sheet
        let start_date = req.query.start_date;
        let end_date = req.query.end_date;

        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                break;
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                break;
            case TYPE_VALUE.PARTNER:
                Type = Partner
                vehicle_foreign_field = "user_type_id"
                break;
            case TYPE_VALUE.CORPORATE:
                Type = Corporate
                break;
            case TYPE_VALUE.HOTEL:
                Type = Hotel
                break;
            case TYPE_VALUE.DISPATCHER:
                Type = Dispatcher
                break;
            case TYPE_VALUE.HUB:
                Type = Hub
                vehicle_foreign_field = "user_type_id"
                break;
        }
        // check user and provide approved decline and active
        let provider_condition = {}
        if (is_approved) {
            if (is_approved == 1 && is_active == 1) {
                provider_condition['is_active'] = 1;
                provider_condition['is_approved'] = 1;
            } else if (is_approved == 1) {
                provider_condition['is_approved'] = 1;
            } else {
                provider_condition['is_approved'] = 0;
            }
        }
        // project optimize query
        let condition = {}
        let Project = {
            $project:
            {
                first_name: 1,
                last_name: 1,
                name: 1,
                email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1,
                phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                country_name: 1,
                country: 1,
                city: 1,
                wallet: 1,
                hotel_name: 1,
                app_version: 1,
                unique_id: 1,
                picture: 1,
                wallet_currency_code: 1,
                country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                is_available: 1,
                is_active: 1,
                service_type: 1,
                admintypeid: 1,
                vehicle_detail: 1,
                is_document_uploaded: 1,
                user_type_id: 1,
                provider_type_id: 1,
                "corporate_details.name": 1,
                provider_type: 1,
                providerLocation: 1,
                vehicle_type: 1,
                address: 1,
                is_go_home: 1,
                service_detail:1,
                wsal_transc_date: 1,
                national_id: 1,
                is_driver_approved_from_wsal: 1,
                wsal_eligibility: 1,
                wsal_eligibility_expiry_date: 1,
                wsal_criminal_record_status: 1,
                is_approved: 1,
                wsal_request: 1,
                wsal_response: 1,
                wsal_vehicle_eligibility_expiry_date:1,
                wsal_result_code:1,
                wsal_rejection_reason:1,
                rent_vehicle_details: 1
            }
        }

        let lookup =  { $match:{}}
        let unwind =  { $match:{}}


        // pagination query 
        let limits = { $limit: limit }
        let skips = { $skip: limit * page }

        // filter query
        if (search_item && search_value) {
            if (search_item == 'unique_id') {
                search_value = Number(req.query.search_value)
                condition[search_item] = search_value
            } else {
                let search_name = search_item.includes('name')
                if (search_value.endsWith('\\')) {
                    search_value = search_value.slice(0, -1);
                }
                condition[search_item] = { $regex: search_value, $options: 'i' }
                if (search_name) {
                    condition = {
                        $or: [
                            {
                                [search_item]: { $regex: search_value, $options: 'i' },
                            },
                            {
                                'last_name': { $regex: search_value, $options: 'i' },
                            }
                        ]
                    }
                }
                let value = search_value.split(' ')
                if (type != 4 && type != 5 && value.length > 1 && search_name) {
                    condition = {}
                    condition[search_item] = { $regex: value[0], $options: 'i' }
                    condition['last_name'] = { $regex: value[1], $options: 'i' }
                }
               
            }
        }
 
        let lookup2 ={ $match:{}}
        let unwind2 ={ $match:{}}

        if(type == TYPE_VALUE.PROVIDER){
            if(req.query.driver_type && req.query.driver_type != "all" && req.query.driver_type != "3"){
                condition['provider_type'] = Number(req.query.driver_type)
            }
            lookup2 = {
                $lookup: {
                    from: 'types',
                    localField: 'admintypeid',
                    foreignField: "_id",
                    pipeline:[{$project:{typename:1,_id:0}}],
                    as: 'service_detail'
                }
    
            }
            unwind2 = {
                $unwind: {
                    path: "$service_detail",
                    preserveNullAndEmptyArrays: true
                }
            }
        }
        if (type == TYPE_VALUE.USER) {
            if(req.query.user_type && req.query.user_type != "all"){
                condition['user_type'] = Number(req.query.user_type)
            }
            if(start_date && end_date){
                const startDate = moment(start_date).startOf('day').toDate();
                const endDate = moment(end_date).endOf('day').toDate();
                condition['created_at'] = { $gte: startDate, $lt: endDate };
            }
            lookup = {
                $lookup: {
                    from: 'corporates',
                    localField: 'user_type_id',
                    foreignField: '_id',
                    as: 'corporate_details'
                }
            }
            unwind = {
                $unwind: {
                    path: '$corporate_details',
                    preserveNullAndEmptyArrays: true
                }
            }
    
        }

        // sorting by unique_id
        let sort = { $sort: { unique_id: -1 } }

        //vehicle detail look up by provider/partner id
        let vehicle_lookup = {
            $lookup: {
                from: 'vehicles',
                localField: '_id',
                foreignField: vehicle_foreign_field,
                as: 'vehicle_detail'
            }
        }

        // partner provider list 
        if (partner_id) {
            condition['provider_type_id'] = Schema(partner_id)
        }

        // partner provider list 
        if (hub_id) {
            condition['provider_type_id'] = Schema(hub_id)
        }

        //anonymous
        let anonymous = { $match: { _id: { $ne: Schema('000000000000000000000000') } } }
        // corporate_id
        let corporate_id = req.query.corporate_id
        if (corporate_id) {
            condition['user_type_id'] = Schema(corporate_id)
        }
        let city_lookup = { $match: {} };
        let unwind_city = { $match: {} };

        if (type == TYPE_VALUE.HUB) {

            city_lookup = {
                $lookup: {
                    from: 'cities',
                    localField: 'city_id',
                    foreignField: '_id',
                    as: 'city_detail'
                }
            }

            unwind_city = {
                $unwind: {
                    path: "$city_detail",
                    preserveNullAndEmptyArrays: true
                }
            }

            Project.$project.country = "$city_detail.countryname";
            Project.$project.city = "$city_detail.cityname";
        }

        // count query
        let count = { $group: { _id: null, total: { $sum: 1 } } };

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(type, req.headers)


        // Total page 
        let total_list = await Type.aggregate([{ $match: country_city_condition }, city_lookup, unwind_city , { $match: provider_condition }, { $match: condition }, anonymous, count])
        let total_page = Math.ceil((total_list[0]?.total || 0) / limit)

        if (is_excel_sheet) {
            let array = await Type.aggregate([{ $match: provider_condition }, city_lookup, unwind_city, { $match: condition }, anonymous, Project, sort])
            generate_excel(req, res, array, Type.modelName, req.query.header)
            return
        }

        // apply query for particular type
        let type_list = await Type.aggregate([{ $match: country_city_condition } , city_lookup, unwind_city,{ $match: provider_condition },{ $match: condition }, anonymous, sort, skips, limits, lookup, unwind, vehicle_lookup, lookup2, unwind2])

        return res.json({ success: true, type_list: type_list, total_page: total_page, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_type_details = async function (req, res) {
    try {
        let params_array = [{ name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let type = Number(req.body.type)
        let id = req.body._id
        let Type;
        let condition = {}
        let vehicle_foreign_field = "provider_id"
        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                condition['user_id'] = id
                break;
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                condition['provider_id'] = id
                break;
            case TYPE_VALUE.PARTNER:
                Type = Partner
                condition['provider_type_id'] = id
                vehicle_foreign_field = "user_type_id"
                break;
            case TYPE_VALUE.CORPORATE:
                Type = Corporate
                condition['user_type_id'] = id
                break;
            case TYPE_VALUE.HOTEL:
                Type = Hotel
                condition['user_type_id'] = id
                break;
            case TYPE_VALUE.DISPATCHER:
                Type = Dispatcher
                condition['user_type_id'] = id
                break;
            case TYPE_VALUE.HUB:
                Type = Hub
                condition['user_type_id'] = id
                vehicle_foreign_field = "user_type_id"
                break;
        }
        // project optimize query
        let Project = {
            $project: {
                first_name: 1,
                last_name: 1,
                name: 1,
                email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1,
                phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                country_name: 1,
                country: 1,
                city: 1,
                wallet: 1,
                hotel_name: 1,
                app_version: 1,
                unique_id: 1,
                currency_code: 1,
                picture: 1,
                government_id_proof: 1,
                account_id: 1,
                bank_id: 1,
                vehicle_detail: 1,
                address: 1,
                partner_company_name: 1,
                country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                wallet_currency_code: 1,
                created_at: 1,
                updated_at: 1,
                zipcode: 1,
                address_location: 1,
                service_details: 1,
                referral_code: 1,
                device_type: 1,
                "partner_providers.first_name": 1,
                "partner_providers.last_name": 1,
                "corporate_user.name": 1,
                latitude: 1,
                longitude: 1,
                admin_profit_type: 1,
                admin_profit_value: 1,
                provider_type: 1,
                country_id: 1,
                city_id: 1,
                location: 1,
                kmlzone: 1,
                city_ids: 1,
                total_redeem_point: 1,
                country_detail:1,
                national_id: 1,
                date_of_birth: 1,
                rental_rate:1,
                rental_rate_count:1,
                total_rental_request: 1,
                rental_cancelled_request : 1,
                rental_completed_request : 1,
            }
        }
        let query = { $match: { _id: Schema(id) } }

        let lookup = {
            $lookup: {
                from: 'partners',
                localField: 'provider_type_id',
                foreignField: '_id',
                as: 'partner_providers'
            }
        }

        let lookup1 = {
            $lookup: {
                from: 'corporates',
                localField: 'user_type_id',
                foreignField: '_id',
                as: 'corporate_user'
            }
        }

        let lookup2 = {
            $lookup: {
                from: "countries",
                localField: "country_id",
                foreignField: "_id",
                pipeline: [{$project: {countryphonecode: 1, _id: 0, is_use_wsal: 1}}],
                as: "country_detail"
            }
        }


        let vehicle_lookup = {
            $lookup: {
                from: 'vehicles',
                localField: '_id',
                foreignField: vehicle_foreign_field,
                as: 'vehicle_detail'
            }
        }

        let city_lookup = { $match: {} };
        let unwind_city = { $match: {} };
        let country_lookup = { $match: {} };
        let unwind_country = { $match: {} };

        if (type === TYPE_VALUE.PARTNER || type === TYPE_VALUE.HOTEL) {
            const localField = type === TYPE_VALUE.PARTNER ? 'country_id' : 'countryid'
            country_lookup = {
                $lookup: {
                    from: 'countries',
                    localField: localField,
                    foreignField: '_id',
                    pipeline: [{$project: {countrycode: 1, _id: 0}}],
                    as: 'country_detail'
                }
            }

            unwind_country = {
                $unwind: {
                    path: "$country_detail",
                    preserveNullAndEmptyArrays: true
                }
            }
            Project.$project["country_detail"] = 1

        }
        if (type == TYPE_VALUE.HUB) {

            city_lookup = {
                $lookup: {
                    from: 'cities',
                    localField: 'city_id',
                    foreignField: '_id',
                    as: 'city_detail'
                }
            }

            unwind_city = {
                $unwind: {
                    path: "$city_detail",
                    preserveNullAndEmptyArrays: true
                }
            }

            country_lookup = {
                $lookup: {
                    from: 'countries',
                    localField: 'country_id',
                    foreignField: '_id',
                    as: 'country_detail'
                }
            }

            unwind_country = {
                $unwind: {
                    path: "$country_detail",
                    preserveNullAndEmptyArrays: true
                }
            }

            Project.$project.country = "$city_detail.countryname";
            Project.$project.city = "$city_detail.cityname";
            Project.$project.country_phone_code = "$country_detail.countryphonecode";
        }

        let type_detail = await Type.aggregate([query, lookup, lookup1, lookup2, vehicle_lookup, city_lookup, unwind_city, country_lookup, unwind_country, Project])

        if (type_detail.length == 0) {
            let error_code = LIST_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }

        // find total and completed request count
        let trip_count = await Trip.count(condition)
        let trip_history_count = await Trip_history.count(condition)
        condition['is_trip_end'] = 1
        let trip_history_completed_count = await Trip_history.count(condition)
        let total_request = trip_count + trip_history_count
        let completed_request = trip_history_completed_count

        res.json({ success: true, type_detail: type_detail, total_request: total_request, completed_request: completed_request, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_document_list = async function (req, res) {
    try {
        let params_array = [{ name: "_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = Schema(req.body._id)
        let vehicle_id = Schema(req.body.vehicle_id)
        let user_document = await User_Document.aggregate([{ $match: { is_visible: true, user_id: id } }])
        let provider_document = await Provider_Document.aggregate([{ $match: { $and: [{ provider_id: id }, { is_visible: true }] } }])
        let provide_vehicle_document = await Provider_Vehicle_Document.aggregate([{ $match: { vehicle_id: vehicle_id, is_visible: true } }])
        let partner_vehicle_document = await Partner_Vehicle_Document.aggregate([{ $match: { partner_id: id, vehicle_id: vehicle_id, is_visible: true } }])
        res.json({ success: true, provider_document: provider_document, user_document: user_document, partner_vehicle_document: partner_vehicle_document, provide_vehicle_document: provide_vehicle_document })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.type_update_document = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body._id
        let type = Number(req.body.type)
        let Type
        let image_id
        switch (type) {
            case TYPE_VALUE.USER:
                image_id = 9
                Type = User_Document
                break;
            case TYPE_VALUE.PROVIDER:
                image_id = 3
                Type = Provider_Document
                break;
            case TYPE_VALUE.VEHICLE:
                image_id = 3
                Type = Provider_Vehicle_Document
                break;
            case TYPE_VALUE.PARTNER:
                image_id = 8
                Type = Partner_Vehicle_Document
                break;
        }
        let type_detials = await Type.findById(id)
        if (req.files && req.files.length > 0) {
            if (type_detials.partner_id) {
                type_detials.provider_id = type_detials.partner_id
            }
            let image_name = type_detials.provider_id + utils.tokenGenerator(4);
            let mime_type = req.files[0].mimetype.split('/')[1]
            let url = utils.getImageFolderPath(req, image_id) + image_name + '.' + mime_type;
            utils.saveImageFromBrowser(req.files[0].path, image_name + '.' + mime_type, image_id);
            req.body.document_picture = url
        }
        req.body.is_uploaded = 1
            req.body.is_document_expired = false;
        await Type.findByIdAndUpdate(id, req.body)
        let message = DOCUMENT_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.type_update_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: 'vehicle_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body._id
        let vehicle_id = req.body.vehicle_id
        let type = Number(req.body.type)
        let Type = null;
        switch (type) {
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                break;
            case TYPE_VALUE.PARTNER:
                Type = Partner
                break;
        }
        if (Type) {
            let type_detail = await Type.findOne({ _id: id })
            if (!type_detail && type != TYPE_VALUE.ADMIN) {
                return
            }
        }
        let vehicle_detail = await Vehicle.findOne({ _id: vehicle_id });

        if (type == TYPE_VALUE.PARTNER) {
            vehicle_detail.admin_type_id = Schema(req.body.service_type);
        }

        if (type == TYPE_VALUE.ADMIN) {
            vehicle_detail.admin_type_id = Schema(req.body.admin_type_id);
            let changes = utils.getModifiedFields(vehicle_detail, req.body, ['vehicle_type', 'type', 'vehicle_id'])
            if (changes.length > 0) {
                utils.add_vehicle_history(vehicle_detail, VEHICLE_HISTORY_TYPE.UPDATED, changes, req.headers)
            }
        }

        vehicle_detail.name = req.body.name;
        vehicle_detail.plate_no = req.body.plate_no;
        vehicle_detail.model = req.body.model;
        vehicle_detail.color = req.body.color;
        vehicle_detail.accessibility = req.body.accessibility;
        vehicle_detail.passing_year = req.body.passing_year;

        if (req.body.brand_id) {
            vehicle_detail.brand_id = req.body.brand_id;
        }
        if (req.body.model_id) {
            vehicle_detail.model_id = req.body.model_id;
        }

        let update_query = {}
        if (type == TYPE_VALUE.PROVIDER) {
            let citytype = await City_type.findOne({ _id: req.body.service_type })

            if ((vehicle_detail?.service_type)?.toString() != (req.body.service_type).toString()) {
                await Trip.updateMany({ current_provider: Schema(id), service_type_id: vehicle_detail.service_type, is_provider_assigned_by_dispatcher: true }, { current_provider: null, confirmed_provider: null, $pull: { current_providers: Schema(id) }, is_provider_assigned_by_dispatcher: false, is_provider_accepted: 0 }, { new: true })
                await Provider.findOneAndUpdate({ _id: Schema(id) }, { schedule_trip: [] }, { new: true })
            }

            vehicle_detail.service_type = citytype._id;
            vehicle_detail.admin_type_id = citytype.typeid;

            if (vehicle_detail.is_selected) {
                update_query = { service_type: citytype._id, admintypeid: citytype.typeid }
            }
        }
        vehicle_detail.save();
        if (type != TYPE_VALUE.ADMIN) {
            await Type.findOneAndUpdate({ _id: id }, update_query)
        }
        let user_data = await Type.findOne({ _id: id })
        const setting_detail = await Settings.findOne({})
        let country_data = await Country.findOne({ _id: user_data.country_id })
        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
            let all_vehicle_detail = await Vehicle.find({ provider_id: user_data._id });
            let count = 0
            for(let i=0; i<all_vehicle_detail.length; i++){
                if(all_vehicle_detail[i].service_type){
                    count = count + 1;
                }
            }
            if(count == 0){
                wsal_services.DriverVehicleEligibilityInquiryService(user_data._id)
            }
        }
        let message = LIST_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.type_is_approved = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({})
        let params_array = [{ name: 'type', type: 'string' }, { name: 'id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let id = req.body.id;
        let is_approved = Number(req.body.is_approved);
        let provider_type = req.body.provider_type ? req.body.provider_type : PROVIDER_TYPE.NORMAL;
        let is_document_uploaded;
        let service_type = req.body.service_type;
        let type = Number(req.body.type)
        let citytype = null;
        let admintypeid = null;
        let message
        let error_code
        if (type == TYPE_VALUE.PROVIDER) {
            // DECLINE PROVIDER
            if (is_approved == 0) {
                let providers = await Provider.findById(id)
                if (providers.is_trip.length != 0) {
                    let error_code = LIST_ERROR_CODE.PROVIDER_IN_TRIP
                    res.json({ success: false, error_code: error_code })
                    return
                }
                providers.is_approved = is_approved;
                utils.remove_from_zone_queue_new(providers);
                let device_token = providers.device_token;
                let device_type = providers.device_type;
                if (providers.provider_type != 0) {
                    if (providers.is_partner_approved_by_admin != 0) {
                        providers.is_active = constant_json.NO;
                        allemails.sendProviderDeclineEmail(req, providers);
                        utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_DECLINED, "", providers.webpush_config, providers.lang_code);
                    }
                } else {
                    providers.is_active = constant_json.NO;
                    allemails.sendProviderDeclineEmail(req, providers);
                    utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_DECLINED, "", providers.webpush_config, providers.lang_code);
                }
                await providers.save()
                utils.decline_socket_id(providers._id)
                let message = LIST_MESSAGE_CODE.DECLINE_SUCCESSFULLY
                res.json({ success: true, message: message })
                return
            }
            // APPROVED PROVIDERS
            // check provider document uploaded or not
            var wsal_provider = await Provider.findOne({_id: id});
            let country_data = await Country.findOne({_id: wsal_provider.country_id}); 
            if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && wsal_provider && !wsal_provider.is_driver_approved_from_wsal){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_APPROVED_FROM_WSAL });
            }
            
            let query = { provider_id: id, option: 1, is_uploaded: 0, is_visible: true }
            let check_document_uploaded = await Provider_Document.find(query)
            if(req.body.vehicle_id){
                let check_vehicle_document = await Provider_Vehicle_Document.find({  option: 1, is_uploaded: 0, is_visible: true ,vehicle_id:req.body.vehicle_id})

                if(check_vehicle_document.length >0){
                    res.json({ success: false, error_code: DOCUMENT_ERROR_CODE.DOCUMENT_NOT_UPLOADED })
                    return
                }
            }
            if (check_document_uploaded.length > 0) {
                is_document_uploaded = 0
            } else {
                is_document_uploaded = 1
            }
            // if no document found
            if (is_document_uploaded == 0) {
                let error_code = DOCUMENT_ERROR_CODE.DOCUMENT_NOT_UPLOADED
                res.json({ success: false, error_code: error_code })
                return
            }

            if(provider_type == PROVIDER_TYPE.NORMAL){
                citytype = await City_type.findById(service_type)
                admintypeid = citytype ? citytype.typeid : null;
            }

            if (provider_type == PROVIDER_TYPE.ADMIN) {
                admintypeid = null;
                service_type = null;
                // remove driver vehicle if registered as admin type
                let deleted_vehicle = await Vehicle.findOneAndDelete({ provider_id: id, user_type_id: id, user_type: TYPE_VALUE.PROVIDER })
                if (deleted_vehicle) {
                    await Provider_Vehicle_Document.deleteMany({ vehicle_id: deleted_vehicle._id })
                }
            }


            let providers = await Provider.findByIdAndUpdate(id, { is_approved: is_approved, is_document_uploaded: is_document_uploaded, provider_type: provider_type }, { new: true })
            if (req.body.vehicle_id) {
                let vehicle_detail = await Vehicle.findOne({ _id: req.body.vehicle_id });
                if(vehicle_detail){
                vehicle_detail.service_type = service_type;
                vehicle_detail.admin_type_id = admintypeid;
                vehicle_detail.is_selected = true;
                await vehicle_detail.save()
                let json = { is_vehicle_document_uploaded: vehicle_detail.is_document_uploaded, service_type: service_type, admintypeid: admintypeid }
                await Provider.findByIdAndUpdate(id, json, { new: true });
                }
            }
            let device_token = providers.device_token;
            let device_type = providers.device_type;
            if (providers.provider_type != 0) {
                if (providers.is_partner_approved_by_admin == 1) {
                    let email_notification = setting_detail.email_notification;
                    if (email_notification) {
                        allemails.sendProviderApprovedEmail(req, providers);
                    }
                    utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_APPROVED, "", providers.webpush_config, providers.lang_code);
                }
            } else {
                let email_notification = setting_detail.email_notification;
                if (email_notification) {
                    allemails.sendProviderApprovedEmail(req, providers);
                }
                utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_APPROVED, "", providers.webpush_config, providers.lang_code);
            }
            message = LIST_MESSAGE_CODE.APRROVED_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        //  USER AND APPROVED
        if (is_approved == 1) {
            let customers = await User.findByIdAndUpdate(id, { is_approved: is_approved })
            let device_token = customers.device_token;
            let device_type = customers.device_type;
            let email_notification = setting_detail.email_notification;
            if (email_notification) {
                allemails.sendUserApprovedEmail(req, customers);
            }
            utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_USER_APPROVED, "", customers.webpush_config, customers.lang_code);
            message = LIST_MESSAGE_CODE.APRROVED_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        // DECLINE USER
        let trip_data = await Trip.findOne({ user_id: id, is_trip_completed: 0, is_trip_cancelled: 0 })
        if (!trip_data) {
            let customers = await User.findByIdAndUpdate(id, { is_approved: is_approved });
            let device_token = customers.device_token;
            let device_type = customers.device_type;
            allemails.sendUserDeclineEmail(req, customers);
            utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_USER_DECLINED, "", customers.webpush_config, customers.lang_code);
            utils.decline_socket_id(customers._id)
            message = LIST_MESSAGE_CODE.DECLINE_SUCCESSFULLY;
            res.json({ success: true, message: message })
            return
        }
        if (trip_data.is_provider_status > 4) {
            error_code = LIST_ERROR_CODE.USER_IN_TRIP;
            res.json({ success: false, error_code: error_code })
            return
        }
        let customers = await User.findByIdAndUpdate(id, { is_approved: is_approved })
        let device_token = customers.device_token;
        let device_type = customers.device_type;
        allemails.sendUserDeclineEmail(req, customers);
        utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_USER_DECLINED, "", customers.webpush_config, customers.lang_code);
        delete req.body.user_type;
        req.body.user_id = String(customers._id);
        req.body.token = customers.token;
        req.body.trip_id = String(trip_data._id);
        req.body.cancel_reason = "Declined By Admin";
        req.body.type = "Admin"
        utils.decline_socket_id(customers._id)
        message = LIST_MESSAGE_CODE.DECLINE_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.unfreeze_provider = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let proivder = await Provider.findById(req.body.provider_id);
        let trip = await Trip.findById(proivder.is_trip[0]);
        let error_code;
        if (!trip) {
            trip = await Trip_history.findById(proivder.is_trip[0]);
        }
        if (!trip) {
            error_code = LIST_ERROR_CODE.TRIP_NOT_FOUND;
            res.json({ success: false, error_code: error_code })
            return
        }

        if (trip.is_trip_end == 0) {
            error_code = LIST_ERROR_CODE.PROVIDER_IN_TRIP;
            res.json({ success: false, error_code: error_code })
            return
        }
        let provider = await Provider.findByIdAndUpdate(req.body.provider_id, { is_trip: [], is_available: 1 }, { new: true })
        let message = LIST_MESSAGE_CODE.UNFREEZE_SUCCESSFULLY
        res.json({ success: true, message: message, provider_detail: provider })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_referral_list = async function (req, res) {
    try {
        let params_array = [{ name: "_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = Schema(req.body._id)
        let condition = { $match: { referred_by: id } };
        let project = {
            $project: {
                "first_name": 1,
                "last_name": 1,
                "email": !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1,
                "country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                "phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                "picture": 1,
                "created_at": 1
            }
        }
        let user_referral = await User.aggregate([condition, project])
        let provider_referral = await Provider.aggregate([condition, project])
        res.json({ success: true, user_referral: user_referral, provider_referral: provider_referral })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_service_type = async function (req, res) {
    try {
        let params_array = [{ name: "provider_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let type = Number(req.body.type)
        let Type;
        switch (type) {
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                break;
            case TYPE_VALUE.PARTNER:
                Type = Partner
                break;
            case TYPE_VALUE.HUB:
                Type = Hub
                break;
        }
        let provider = await Type.findOne({ _id: req.body.provider_id })
        let lookup = {
            $lookup:
            {
                from: "types",
                localField: "typeid",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let unwind = { $unwind: "$type_detail" };
        if (provider['city_id']) {
            provider.cityid = provider.city_id
        }
        let cityid_condition = {
            $match: {
                $and: [
                    { 'cityid': { $eq: Schema(provider.cityid) } },
                ]
            }
        }
        let project = {
            $project: {
                'type_detail.typename': 1, 'type_detail._id': 1
            }
        }
  
        let service_list = await City_type.aggregate([cityid_condition, lookup, unwind, project])
        let uniuqe_value = [];
        service_list.forEach(function (list) {
            let i = uniuqe_value.findIndex(x => ((x.type_detail._id).toString() == (list.type_detail._id).toString()));
            if (i <= -1) {
                uniuqe_value.push(list);
            }
        });
        res.json({ success: true, service_list: uniuqe_value })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.update_type_details = async function (req, res) {
    try {
        let params_array = [{ name: 'update_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        if (!req.headers.is_show_email) {
            delete req.body.email
        }
        if (!req.headers.is_show_phone) {
            delete req.body.phone
            delete req.body.country_phone_code
        }
        let type = Number(req.body.type)
        let update_id = req.body.update_id
        let phone = req.body.phone
        let password = req.body.password
        let email = req.body.email
        let picture = req.body.picture
        let Type;
        let image_id;
        let error_code
        if (req.body.latitude && req.body.longitude) {
            req.body.location = [req.body.latitude, req.body.longitude];
        }
        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                image_id = 1
                break;
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                image_id = 2
                break;
            case TYPE_VALUE.PARTNER:
                Type = Partner
                image_id = 7
                break;
            case TYPE_VALUE.CORPORATE:
                Type = Corporate
                break;
            case TYPE_VALUE.HOTEL:
                Type = Hotel
                break;
            case TYPE_VALUE.DISPATCHER:
                Type = Dispatcher
                break;
            case TYPE_VALUE.HUB:
                Type = Hub
                break;
        }
        if (password) {
            req.body.password = crypto.createHash('md5').update(password).digest('hex')
        }
        let query = {}
        let country_phone_code = req.body.country_phone_code
        query['_id'] = { $ne: update_id }
        query['$or'] = [{ phone: phone, country_phone_code: country_phone_code }]
        let duplicate = await Type.findOne(query)
        if (duplicate && type != TYPE_VALUE.HUB) {
            error_code = LIST_ERROR_CODE.PHONE_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let query1 = {}
        query1['_id'] = { $ne: update_id }
        query1['email'] = email
        let duplicate_email = await Type.findOne(query1)
        if (duplicate_email && email != "" && type != TYPE_VALUE.HUB) {
            error_code = LIST_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let type_detail = await Type.findOne({ _id: update_id })
        // for image update
        if (req.files && req.files.length > 0) {
            if (picture == '') {
                let image_name = type_detail._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, image_id) + image_name + '.jpg';
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', image_id);
                req.body.picture = url;
            }
            utils.deleteImageFromFolder(type_detail.picture, image_id);
            let image_name = type_detail._id + utils.tokenGenerator(4);
            let url = utils.getImageFolderPath(req, image_id) + image_name + '.jpg';
            utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', image_id);
            req.body.picture = url;
            // parnter id proof  
            let id_proof = req.files.findIndex(value => value.fieldname == 'id_proof')
            if (id_proof != -1) {
                utils.deleteImageFromFolder(type_detail.government_id_proof, 8);
                let image_name = type_detail._id + utils.tokenGenerator(5);
                let url = utils.getImageFolderPath(req, 8) + image_name + '.jpg';
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 8);
                req.body.government_id_proof = url;
            }
        }
        if (req.body.is_approved == '0') {
            utils.decline_socket_id(type_detail._id)
        }

        if (req.body.city_ids) {
            req.body.city_ids = JSON.parse(req.body.city_ids)
        }

        if (type == TYPE_VALUE.PROVIDER) {
            req.body.address_location = [+req.body.latitude, +req.body.longitude]
        }

        // update type details
        await Type.findByIdAndUpdate(update_id, req.body)
        let message = LIST_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.delete_type_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let type = Number(req.body.type)
        let delete_id = req.body.delete_id

        // User
        if (type == TYPE_VALUE.USER) {
            let user = await User.findOne({ _id: delete_id })
            if (!user) {
                res.json({ success: false, error_code: error_code.DETAIL_NOT_FOUND });
                return
            }
            if (user.current_trip_id != null) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_USER_IS_IN_TRIP });
                return;
            }
            const trip = await Trip.findOne({ "split_payment_users.user_id": Schema(delete_id) })
            if (trip) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_USER_IS_IN_TRIP });
                return;
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
            await Trip_history.updateMany({ user_id: user._id }, { user_id: user_detail._id });
            await Trip.deleteMany({ is_schedule_trip: true, user_id: user._id })
            await Wallet_history.updateMany({ user_id: user._id }, { user_id: user_detail._id });
            await Card.deleteMany({ user_id: user._id });
            await User_Document.deleteMany({ user_id: user._id });
            await User.deleteOne({ _id: user._id });
        }
        // Provider
        if (type == TYPE_VALUE.PROVIDER) {
            let provider = await Provider.findOne({ _id: delete_id })
            if (!provider) {
                res.json({ success: false, error_code: error_code.DETAIL_NOT_FOUND });
                return
            }
            const trip = await Trip.findOne({
                provider_id: provider._id
            })
            if (trip) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_IS_IN_TRIP });
                return;
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
            await Trip.updateMany({ $or: [{ current_provider: provider._id }, { confirmed_provider: provider._id }] }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id });
            await Wallet_history.updateMany({ user_id: provider._id }, { user_id: provider_detail._id });
            await Card.deleteMany({ user_id: provider._id });
            await Provider_Document.deleteMany({ provider_id: provider._id });
            await Provider_Vehicle_Document.deleteMany({ provider_id: provider._id });
            await Provider_daily_analytic.deleteMany({ provider_id: provider._id })
            await Provider.deleteOne({ _id: provider._id })
            await Vehicle.updateMany({provider_id:provider._id},{$set:{provider_id:null}})
            await CityZone.updateMany({},{$pull:{total_provider_in_zone_queue:provider._id}})
        }
        // Partner
        if (type == TYPE_VALUE.PARTNER) {
            let partner = await Partner.findOne({ _id: delete_id });
            if (!partner) {
                res.json({ success: false, error_code: error_code.DETAIL_NOT_FOUND });
                return
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
            await Trip_history.updateMany({ provider_type_id: partner._id }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id, provider_type_id: null });
            await Trip.updateMany({ provider_type_id: partner._id }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id, provider_type_id: null });
            await Wallet_history.deleteMany({ user_id: partner._id });
            await Card.deleteMany({ user_id: partner._id });
            await Partner_Vehicle_Document.deleteMany({ partner_id: partner._id });
            let providers = await Provider.aggregate([
                { $match: { provider_type_id: partner._id } },
                {
                    $group: {
                        _id: null,
                        provider_ids: { $push: '$_id' }
                    }
                }
            ]);
            let provider_ids = [];
            if (providers.length > 0) {
                provider_ids = providers[0].provider_ids;
            }
            await Wallet_history.updateMany({ user_id: { $in: provider_ids } }, { user_id: provider_detail._id });
            await Card.deleteMany({ user_id: { $in: provider_ids } });
            await Provider_Document.deleteMany({ provider_id: { $in: provider_ids } });
            await Provider_Vehicle_Document.deleteMany({ provider_id: { $in: provider_ids } });
            await Provider.deleteMany({ provider_type_id: partner._id });
            await Partner.deleteOne({ _id: partner._id });
        }
        // Corporate
        if (type == TYPE_VALUE.CORPORATE) {
            let corporate = await Corporate.findOne({ _id: delete_id });
            if (!corporate) {
                res.json({ success: false, error_code: error_code.DETAIL_NOT_FOUND });
                return
            }
            await Corporate.findOneAndDelete({ _id: corporate._id });
            await Trip_history.updateMany({ user_type_id: corporate._id }, { user_type_id: null });
            await Trip.updateMany({ user_type_id: corporate._id }, { user_type_id: null });
            await User.updateMany({ user_type_id: corporate._id }, { user_type_id: null, corporate_ids: [], user_type: constant_json.USER_TYPE_NORMAL });
            await Wallet_history.deleteMany({ user_id: corporate._id });
            await Card.deleteMany({ user_id: corporate._id });
        }
        // Hotel
        if (type == TYPE_VALUE.HOTEL) {
            let hotel = await Hotel.findOne({ _id: delete_id })
            if (!hotel) {
                res.json({ success: false, error_code: error_code.DETAIL_NOT_FOUND });
                return
            }
            await Hotel.deleteOne({ _id: hotel._id });
        }
        // Dispatcher
        if (type == TYPE_VALUE.DISPATCHER) {
            let dispatcher = await Dispatcher.findOne({ _id: delete_id })
            if (!dispatcher) {
                res.json({ success: false, error_code: error_code.DETAIL_NOT_FOUND });
                return
            }
            await Dispatcher.deleteOne({ _id: dispatcher._id });
        }
        utils.decline_socket_id(delete_id)
        let message = LIST_MESSAGE_CODE.DELETE_SUCCESSFULLY
        res.json({ success: true, message: message });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_wallet_amount = async function (req, res) {
    try {
        let params_array = [{ name: 'type', type: 'string' }, { name: 'type_id', type: 'string' }, { name: 'wallet_amount', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let type = Number(req.body.type)
        let wallet_amount = Number(req.body.wallet_amount)
        let type_id = req.body.type_id
        let Type;
        let uniuqe_value;
        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                uniuqe_value = constant_json.USER_UNIQUE_NUMBER
                break;
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                uniuqe_value = constant_json.PROVIDER_UNIQUE_NUMBER
                break;
            case TYPE_VALUE.PARTNER:
                Type = Partner
                uniuqe_value = constant_json.PARTNER_UNIQUE_NUMBER
                break;
            case TYPE_VALUE.CORPORATE:
                Type = Corporate
                uniuqe_value = constant_json.CORPORATE_UNIQUE_NUMBER
                break;
        }
        let type_details = await Type.findById(type_id)
        if (!type_details) {
            let error_code = LIST_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        let wallet = utils.precisionRoundTwo(wallet_amount);
        let status = constant_json.DEDUCT_WALLET_AMOUNT
        if (wallet > 0) {
            status = constant_json.ADD_WALLET_AMOUNT
        }
        if (wallet != 0) {
            let total_wallet_amount = utils.addWalletHistory(uniuqe_value, type_details.unique_id, type_details._id, type_details.country_id, type_details.wallet_currency_code, type_details.wallet_currency_code,
                1, Math.abs(wallet), type_details.wallet, status, constant_json.ADDED_BY_ADMIN, "By Admin")
            type_details.wallet = total_wallet_amount;
        }
        await type_details.save()
        let message = LIST_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.reviews_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let limit = Number(req.body.limit)
        let page = Number(req.body.page) - 1
        let search_item = req.body.search_item
        let search_value = req.body.search_value
        let lookup = {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                as: 'user_details'
            }
        }
        let unwind = {
            $unwind: {
                path: '$user_details',
                preserveNullAndEmptyArrays: false
            }
        }
        let lookup1 = {
            $lookup: {
                from: 'providers',
                localField: 'provider_id',
                foreignField: '_id',
                as: 'provider_details'
            }
        }
        let unwind1 = {
            $unwind: {
                path: '$provider_details',
                preserveNullAndEmptyArrays: false
            }
        }
        let project = {
            $project: {
                "userRating": 1,
                "userReview": 1,
                "providerRating": 1,
                "providerReview": 1,
                "user_details.first_name": 1,
                "provider_details.first_name": 1,
                "user_details.last_name": 1,
                "provider_details.last_name": 1,
                "trip_unique_id": 1,
                "provider_details.picture": 1,
                "user_details.picture": 1,
                "user_details.phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                "user_details.country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                "provider_details.phone": !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                "provider_details.country_phone_code": !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                "created_at": 1,
            }
        }
        let condition = {}
        if (search_item && search_value) {
            condition[search_item] = { $regex: search_value, $options: 'i' }
        }
        let sort = {
            $sort: { trip_unique_id: -1 }
        }

        let number_of_rec = limit;
        let start = ((page + 1) * number_of_rec) - number_of_rec;
        let end = number_of_rec;

        let group = {
            $group: {
                _id: null, total: { $sum: 1 }, result: { $push: "$$ROOT" },
            }
        }
        let projects = {
            $project: { total: { $ceil: { $divide: ['$total', limit] } }, data: { $slice: ['$result', start, end] } }
        }


        let facet = {
            $facet: {
                data: [group, projects],
                userCount: [
                    {
                        $match: condition
                    },
                    {
                        $group: {
                            _id: "$userRating",
                            userCount: { $count: {} },
                        }
                    },
                    {
                        $project: { userCount: 1 }
                    }
                ],
                providerCount: [
                    {
                        $match: condition
                    },
                    {
                        $group: {
                            _id: "$providerRating",
                            providerCount: { $count: {} },
                        }
                    },
                    {
                        $project: { providerCount: 1 }
                    }
                ],
            }
        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.ADMIN_NOTIFICATION, req.headers)
        const match_condition = { $match: country_city_condition }
        let review_list = await Reviews.aggregate([match_condition, lookup, unwind, lookup1, unwind1, project, { $match: condition }, sort, facet])

        res.json({
            success: true, review_list: review_list
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_new_type = async function (req, res) {
    try {
        let params_array = [{ name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let type = Number(req.body.type)
        let Type;
        switch (type) {
            case TYPE_VALUE.DISPATCHER:
                Type = Dispatcher
                break;
            case TYPE_VALUE.HOTEL:
                Type = Hotel
                break;
            case TYPE_VALUE.HUB:
                Type = Hub
                break;
        }
        let email = req.body.email ? ((req.body.email).trim()).toLowerCase() : null
        let phone = req.body.phone ? req.body.phone : null;
        let password = req.body.password
        let country = req.body.country
        let city = req.body.city
        let first_name = req.body.first_name;
        let hotel_name = req.body.hotel_name;
        let last_name = req.body.last_name;
        let token = utils.tokenGenerator(32)
        let hash = password ? crypto.createHash('md5').update(password).digest('hex') : "";
        let country_phone_code = req.body.country_phone_code
        let duplicate_email = await Type.find({ email: email })
        let error_code;
        if (duplicate_email.length > 0 && email) {
            error_code = LIST_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let duplicate_phone = await Type.find({ phone: phone, country_phone_code: req.body.country_phone_code })
        if (duplicate_phone.length > 0 && phone) {
            error_code = LIST_ERROR_CODE.PHONE_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        if (type == TYPE_VALUE.DISPATCHER) {
            if (req.body.city_ids) {
                req.body.city_ids = JSON.parse(req.body.city_ids)
            }
            let type_details = new Type({
                first_name: first_name.charAt(0).toUpperCase() + first_name.slice(1),
                last_name: last_name.charAt(0).toUpperCase() + last_name.slice(1),
                email: email,
                country_phone_code: country_phone_code,
                countryid: req.body.countryid,
                phone: phone,
                password: hash,
                country: country,
                token: token,
                city_ids: req.body.city_ids || []
            })
            await type_details.save()
        }
        if (type == TYPE_VALUE.HOTEL) {
            let hotel = new Type({
                hotel_name: hotel_name.charAt(0).toUpperCase() + hotel_name.slice(1),
                email: email,
                country_phone_code: country_phone_code,
                phone: phone,
                password: hash,
                city: city,
                country: country,
                countryid: req.body.countryid,
                address: req.body.address,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                token: token
            })
            await hotel.save()
        }
        if (type == TYPE_VALUE.HUB) {
            let hub = new Type({
                name: req.body.name.charAt(0).toUpperCase() + req.body.name.slice(1),
                country_id: req.body.countryid,
                city_id: req.body.cityid,
                address: req.body.address,
                location: [req.body.latitude, req.body.longitude],
                kmlzone: req.body.kmlzone
            })
            await hub.save()
        }

        let message = LIST_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// excel sheet download
async function generate_excel(req, res, array, type, header) {
    let setting_detail = await Settings.findOne({}, { history_base_url: 1, timezone_for_display_date: 1 })
    const currentDate = moment().tz(setting_detail.timezone_for_display_date).format('HHmm_DDMMYYYY');
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;
    let title = JSON.parse(header)

    if (type == "Hub") {
        ws.cell(1, col++).string(title.id);
        ws.cell(1, col++).string(title.name);
        ws.cell(1, col++).string(title.country);
        ws.cell(1, col++).string(title.city);
        ws.cell(1, col++).string(title.address);
    } else {
        ws.cell(1, col++).string(title.id);
        ws.cell(1, col++).string(title.name);
        ws.cell(1, col++).string(title.email);
        ws.cell(1, col++).string(title.phone);
        ws.cell(1, col++).string(title.country);
    }
    if(type == "Provider"){
        ws.cell(1, col++).string(title.type);

    }

    if (type == "User") {
        type = 'Customer'
    }
    array.forEach(function (data, index) {
        col = 1;
        if (data['country_name']) {
            data.country = data.country_name
        }
        if (data['first_name'] && data['last_name']) {
            data.name = data.first_name + data.last_name
        }
        ws.cell(index + 2, col++).number(data.unique_id);
        ws.cell(index + 2, col++).string(data.name || data.hotel_name);

        if (type == "Hub") {
            ws.cell(index + 2, col++).string(data.country || null);
            ws.cell(index + 2, col++).string(data.city);
            ws.cell(index + 2, col++).string(data.address);
        } else {
            ws.cell(index + 2, col++).string(data.email);
            ws.cell(index + 2, col++).string(data.country_phone_code + data.phone);
            ws.cell(index + 2, col++).string(data.country || null);
        }

        if(type == "Provider"){
            let provider_type = utils.get_provider_type_name(data.provider_type)
            ws.cell(index + 2, col++).string(provider_type);
        }



        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + `${type}` + '_' + currentDate + '.xlsx', function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + `${type}` + '_' + currentDate + '.xlsx';
                    res.json({ success: true, url: url });
                    setTimeout(() => {
                        fs.unlink('data/xlsheet/' + `${type}` + '_' + currentDate + '.xlsx', function () { });
                    }, 10000);
                }
            });
        }

    })
}

exports.add_provider_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'name', type: 'string' },
        { name: 'passing_year', type: 'string' }, { name: 'model', type: 'string' }, { name: 'color', type: 'string' },
        { name: 'plate_no', type: 'string' }, { name: 'service_type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let provider = await Provider.findOne({ _id: req.body.provider_id })
        let citytype = await City_type.findOne({ _id: req.body.service_type })
        let is_selected = false;
        let message
        let provider_vehicle_count = await Vehicle.count({ user_type_id: provider._id });

        if (provider_vehicle_count == 0) {
            is_selected = true;
            provider.service_type = null;
            provider.admintypeid = null;
        }

        let objectid = Schema()
        let vehicel_json = {
            _id: objectid,
            name: req.body.name,
            user_type_id: provider._id,
            provider_id: provider._id,
            user_type: TYPE_VALUE.PROVIDER,
            country_id: provider.country_id,
            plate_no: req.body.plate_no,
            model: req.body.model,
            color: req.body.color,
            passing_year: req.body.passing_year,
            service_type: citytype._id,
            admin_type_id: citytype.typeid,
            is_selected: is_selected,
            is_document_uploaded: false,
            is_document_expired: false,
            accessibility: req.body.accessibility
        }
        let country = await Country.findOne({ _id: provider.country_id })
        // add vehicle document in provider vehicle
        let document = await Document_list.find({ country_id: country._id, type: 2 })
        if (document.length == 0) {
            provider.is_vehicle_document_uploaded = true;
            vehicel_json.is_document_uploaded = true;
            utils.addVehicle(vehicel_json)
            provider.save();
            message = LIST_MESSAGE_CODE.ADD_VEHICLE_SUCCESSFULLY;
            res.json({ success: true, message: message })
            return
        }
        let is_document_uploaded = false
        let count = 0
        for (let iterator of document) {
            if (iterator.option == 0) {
                count++
            } else {
                break;
            }
            if (count == document.length) {
                is_document_uploaded = true;
            }
        }
        vehicel_json.is_document_uploaded = is_document_uploaded
        utils.addVehicle(vehicel_json)
        await provider.save();
        document.forEach(async function (documents) {
            let providervehicledocument = new Provider_Vehicle_Document({
                vehicle_id: objectid,
                provider_id: provider._id,
                document_id: documents._id,
                name: documents.title,
                option: documents.option,
                document_picture: "",
                unique_code: documents.unique_code,
                expired_date: "",
                is_unique_code: documents.is_unique_code,
                is_expired_date: documents.is_expired_date,
                is_document_expired: false,
                is_uploaded: 0,
                is_visible: documents.is_visible
            });
            await providervehicledocument.save()
        });
        message = LIST_MESSAGE_CODE.ADD_VEHICLE_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.referral_list = async function (req, res) {
    try {
        let params_array = [{ name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let type = Number(req.query.type)
        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1
        let search_item = req.query.search_item
        let search_value = req.query.search_value
        let Type;
        let lookup_from_field = type == TYPE_VALUE.USER ? 'users' : 'providers'
        Type = type == TYPE_VALUE.USER ? User : Provider
        let lookup = {
            $lookup: {
                from: lookup_from_field,
                localField: 'referred_by',
                foreignField: '_id',
                as: 'referred_details'
            }
        }
        let condition = {}
        let unwind = {
            $unwind: '$referred_details'
        }
        let group = {
            $group: {
                _id: '$referred_by',
                total: { $count: {} },
                unique_id: { $first: '$referred_details.unique_id' },
                first_name: { $first: '$referred_details.first_name' },
                last_name: { $first: '$referred_details.last_name' },
                email: !req.headers.is_show_email ? { $first: HIDE_DETAILS.EMAIL } : { $first: '$referred_details.email' },
                phone: !req.headers.is_show_phone ? { $first: HIDE_DETAILS.PHONE } : { $first: '$referred_details.phone' },
                country_phone_code: !req.headers.is_show_phone ? { $first: HIDE_DETAILS.COUNTRY_CODE } : { $first: '$referred_details.country_phone_code' },
                code: { $first: '$referred_details.referral_code' }
            }
        }
        let sort = {
            $sort: {
                unique_id: -1
            }
        }
        let limits = { $limit: limit }
        let skips = { $skip: limit * page }
        // filter query
        if (search_item && search_value) {
            if (search_item == 'unique_id') {
                search_value = Number(req.query.search_value)
                condition[search_item] = search_value
            } else {
                condition[search_item] = { $regex: search_value, $options: 'i' }
                let value = search_value.split(' ')
                if (type != 4 && type != 5 && value.length > 1) {
                    condition[search_item] = { $regex: value[0], $options: 'i' }
                    condition['last_name'] = { $regex: value[1], $options: 'i' }
                }
            }
        }

        //for optimise query match only users which use referals codes
        let screening_for_not_used = {$match:{referred_by:{$ne:null}}} 

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(type, req.headers)

        let total = await Type.aggregate([{ $match: country_city_condition },screening_for_not_used,lookup, unwind, group, { $match: condition }])

        let total_page = Math.ceil(total.length / limit)
        let referral_list = await Type.aggregate([{ $match: country_city_condition }, screening_for_not_used,lookup, unwind, group, { $match: condition }, sort, skips, limits])
        res.json({ success: true, referral_list: referral_list, total_page: total_page, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.referral_details = async function (req, res) {
    try {
        let params_array = [{ name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let type = Number(req.body.type)
        let id = req.body.id
        let Type;
        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                break;

            case TYPE_VALUE.PROVIDER:
                Type = Provider
                break;
        }
        let condition = {
            $match: {
                referred_by: Schema(id)
            }
        }
        let project = {
            $project: {
                first_name: 1,
                last_name: 1,
                phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                created_at: 1,
                country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1
            }
        }
        let referral_details = await Type.aggregate([condition, project])
        res.json({ success: true, referral_details: referral_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.is_document_uploaded = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let type = Number(req.body.type);
        let id = req.body.id
        let Type;
        let DOC_TYPE;
        let query = {};
        switch (type) {
            case TYPE_VALUE.USER:
                Type = User
                DOC_TYPE = User_Document
                query = { user_id: id, option: 1, is_uploaded: 0, is_visible: true }
                break;
            case TYPE_VALUE.PROVIDER:
                Type = Provider
                DOC_TYPE = Provider_Document
                query = { provider_id: id, option: 1, is_uploaded: 0, is_visible: true }
                break;
        }
        let check_document_uploaded = await DOC_TYPE.find(query)
        let is_document_uploaded = 0;
        if (check_document_uploaded.length > 0) {
            res.json({ success: true, is_document_uploaded: is_document_uploaded })
            return
        }
        await Type.findByIdAndUpdate(id, { is_document_uploaded: 1 })
        res.json({ success: true, is_document_uploaded: 1 })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_admin_vehicles = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1;

        const countryid = req.query.countryid;
        const vehicle_type = req.query.vehicle_type;
        const typeid = req.query.typeid;
        const passing_year = req.query.passing_year;
        const plate_no = req.query.plate_no;
        const brand_id = req.query.brand_id;
        const model_id = req.query.model_id;


        let vehicle_type_condition = { $match: { user_type: TYPE_VALUE.ADMIN } }
        let condition = {}

        // pagination query 
        let limits = { $limit: limit }
        let skips = { $skip: limit * page }


        // filter query

        if (countryid && Schema.isValid(countryid)) {
            condition["country_id"] = Schema(countryid)
        }
        if (vehicle_type && vehicle_type !== "null") {
            condition['vehicle_type'] = Number(vehicle_type)
        }
        if (typeid && Schema.isValid(typeid)) {
            condition["city_type_detail.typeid"] = Schema(typeid)
        }

        if (brand_id && Schema.isValid(brand_id)) {
            condition['brand_id'] = Schema(brand_id)
        }

        if (model_id && Schema.isValid(model_id)) {
            condition["model_id"] = Schema(model_id)
        }

        if (passing_year && passing_year !== "null") {
            condition['passing_year'] = { $regex: passing_year, $options: 'i' }
        }

        if (plate_no && plate_no !== "null") {
            condition['plate_no'] = { $regex: plate_no, $options: 'i' }
        }


        let city_type_lookup = {
            $lookup:
            {
                from: "city_types",
                localField: "service_type",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, countryid: 1, typeid: 1 } }],
                as: "city_type_detail"
            }
        };

        let city_type_unwind = {
            $unwind: {
                path: "$city_type_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let hub_lookup = {
            $lookup:
            {
                from: "hubs",
                localField: "user_type_id",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, name: 1, unique_id: 1 } }],
                as: "hub_detail"
            }
        };

        let hub_unwind = {
            $unwind: {
                path: "$hub_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let type_lookup = {
            $lookup:
            {
                from: "types",
                localField: "admin_type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let type_unwind = {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        // count query
        let count = { $group: { _id: null, total: { $sum: 1 } } };

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.VEHICLE, req.headers)


        // Total page 
        let total_list = await Vehicle.aggregate([vehicle_type_condition, { $match: country_city_condition }, city_type_lookup,
            city_type_unwind,
            { $match: condition }, count])
        let total_page = Math.ceil((total_list[0]?.total || 0) / limit)

        // apply query for particular type
        let vehicle_list = await Vehicle.aggregate([
            vehicle_type_condition,
            { $match: country_city_condition },
            city_type_lookup,
            city_type_unwind,
            { $match: condition },
            skips,
            limits,
            hub_lookup,
            hub_unwind,
            type_lookup,
            type_unwind
        ])
        res.json({ success: true, vehicle_list: vehicle_list, total_page: total_page })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_admin_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: 'name', type: 'string' },
        { name: 'passing_year', type: 'string' }, { name: 'model', type: 'string' }, { name: 'color', type: 'string' },
        { name: 'plate_no', type: 'string' }, { name: 'admin_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let message;
        let objectid = Schema()
        let vehicel_json = {
            _id: objectid,
            name: req.body.name,
            vehicle_type: req.body.vehicle_type,
            user_type_id: null,
            provider_id: null,
            user_type: TYPE_VALUE.ADMIN,
            plate_no: req.body.plate_no,
            model: req.body.model,
            color: req.body.color,
            passing_year: req.body.passing_year,
            service_type: null,
            admin_type_id: req.body.admin_type_id,
            country_id: req.body.country_id,
            is_selected: false,
            is_document_uploaded: false,
            is_document_expired: false,

            brand_id: req.body.brand_id,
            model_id: req.body.model_id,

            accessibility: req.body.accessibility
        }
        let country = await Country.findOne({ _id: req.body.country_id })
        // add vehicle document in vehicle
        let document = await Document_list.find({ country_id: country._id, type: 2, option: 1, is_visible: true, })

        if (document.length == 0) {
            vehicel_json.is_document_uploaded = true;
            utils.addVehicle(vehicel_json, req.headers)
            message = LIST_MESSAGE_CODE.ADD_VEHICLE_SUCCESSFULLY;
            res.json({ success: true, message: message })
            return
        }
        let is_document_uploaded = false
        let count = 0
        for (let iterator of document) {
            if (iterator.option == 0) {
                count++
            } else {
                break;
            }
            if (count == document.length) {
                is_document_uploaded = true;
            }
        }
        vehicel_json.is_document_uploaded = is_document_uploaded
        utils.addVehicle(vehicel_json, req.headers)
        document.forEach(async function (documents) {
            let providervehicledocument = new Provider_Vehicle_Document({
                vehicle_id: objectid,
                provider_id: null,
                document_id: documents._id,
                name: documents.title,
                option: documents.option,
                document_picture: "",
                unique_code: documents.unique_code,
                expired_date: "",
                is_unique_code: documents.is_unique_code,
                is_expired_date: documents.is_expired_date,
                is_document_expired: false,
                is_uploaded: 0,
                is_visible: documents.is_visible
            });
            await providervehicledocument.save()
        });
        message = LIST_MESSAGE_CODE.ADD_VEHICLE_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_vehicle_admin_types = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let types = await Type.find({ is_business: 1 })
        res.json({ success: true, types: types })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// create partner_provider
exports.admin_add_provider = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        // code 
        let error_code;
        let old_Provider_phone = await Provider.findOne({ phone: req.body.phone, country_phone_code: req.body.country_phone_code })
        let old_Provider_email = await Provider.findOne({ email: req.body.email })
        if (old_Provider_phone) {
            error_code = PARTNER_ERROR_CODE.PHONE_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }

        if (old_Provider_email) {
            error_code = PARTNER_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }

        let city = await City.findOne({ cityname: req.body.city })
        if (!city) {
            res.json({ success: false });
            return;
        }
        let city_id = city._id;
        let password = req.body.password;
        let token = utils.tokenGenerator(32);
        let first_name = req.body.first_name;
        let last_name = req.body.last_name;
        let zipcode = "";
        let address = "";
        let message;
        if (first_name != undefined) {
            first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);
        }
        if (last_name != undefined) {
            last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);

        }

        if (zipcode != undefined) {
            zipcode = req.body.zipcode;
        }
        if (address != undefined) {
            address = (req.body.address).trim();
        }

        let country = await Country.findOne({ _id: city.countryid })
        if (!country) {
            res.json({ success: false });
            return;
        }

        let provider = new Provider({
            first_name: first_name,
            last_name: last_name,
            country_phone_code: req.body.country_phone_code,
            email: ((req.body.email).trim()).toLowerCase(),
            phone: req.body.phone,
            password: utils.encryptPassword(password),
            service_type: null,
            // referral_code: referral_code,
            car_model: req.body.car_model,
            car_number: req.body.car_number,
            device_token: "",
            device_type: "",
            bio: "",
            address: address,
            zipcode: zipcode,
            social_unique_id: "",
            login_by: "",
            device_timezone: "",
            providerLocation: [
                0,
                0
            ],
            city: req.body.city,
            cityid: city_id,
            country: country.countryname,
            country_id: country._id,
            token: token,
            is_available: 1,
            is_document_uploaded: 0,
            is_active: 0,
            is_approved: 1,
            is_partner_approved_by_admin: 1,
            rate: 0,
            rate_count: 0,
            is_trip: [],
            admintypeid: null,
            wallet: 0,
            bearing: 0,
            picture: "",
            provider_type: PROVIDER_TYPE.ADMIN,
            provider_type_id: null,
            address_location: [+req.body.latitude, +req.body.longitude]
        });

        if (req.files != undefined) {
            if (req.files.length != 0) {
                let image_name = provider._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                provider.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 2);
            }
        }

        let country_id = country._id;
        let document = await Document.find({ countryid: country_id, type: 1 })

        let is_document_uploaded = 0;
        let document_size = document.length;
        if (document_size === 0) {
            is_document_uploaded = 1;
            provider.is_document_uploaded = is_document_uploaded;
        }


        let count = 0;
        for (let i = 0; i < document_size; i++) {
            if (document[i].option == 0) {
                count++;
            } else {
                break;
            }
        }
        if (count == document_size) {
            is_document_uploaded = 1;
        }

        document.forEach(async function (entry) {
            let providerdocument = new Provider_Document({
                provider_id: provider._id,
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

            provider.is_document_uploaded = is_document_uploaded;
            await providerdocument.save()
        });

        provider.wallet_currency_code = country.currencycode;
        await provider.save()

        message = PARTNER_MESSAGE_CODE.ADD_SUCCESSFULLY;
        res.json({ success: true, message: message })

    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.fetch_admin_vehicles = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let provider_lookup = {
            $lookup:
            {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1, email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1, phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1, country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1 } }],
                as: "provider_detail"
            }
        };

        let provider_unwind = {
            $unwind: {
                path: "$provider_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let type_lookup = {
            $lookup:
            {
                from: "types",
                localField: "admin_type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let type_unwind = {
            $unwind: {
                path: "$type_detail",
                preserveNullAndEmptyArrays: true
            }
        };


        let user_type_id = req.body.user_type_id ? Schema(req.body.user_type_id) : null;
        if (req.body.hub_id) {
            user_type_id = Schema(req.body.hub_id)
        }

        let country_filter = req.body.country_id ? { $match: { country_id: Schema(req.body.country_id) } } : { $match: {} }

        let vehicles = await Vehicle.aggregate([{ $match: { $and: [{ user_type: TYPE_VALUE.ADMIN }, { user_type_id: user_type_id }] } }, country_filter, provider_lookup, provider_unwind, type_lookup, type_unwind])
        res.json({ success: true, vehicles: vehicles })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_hub_providers = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let Project = {
            $project:
            {
                first_name: 1,
                last_name: 1,
                name: 1,
                email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1,
                phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                country_name: 1,
                country: 1,
                city: 1,
                wallet: 1,
                hotel_name: 1,
                app_version: 1,
                unique_id: 1,
                picture: 1,
                wallet_currency_code: 1,
                country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                is_available: 1,
                is_active: 1,
                service_type: 1,
                admintypeid: 1,
                // vehicle_detail: 1,
                is_document_uploaded: 1,
                user_type_id: 1,
                provider_type_id: 1,
                provider_type: 1,
                "corporate_details.name": 1,
                providerLocation: 1,
                vehicle_detail: "$vehicles_detail",
            }
        }

        let vehicle_lookup = {
            $lookup:
            {
                from: "vehicles",
                localField: "_id",
                foreignField: "provider_id",
                pipeline: [{ $match: { user_type_id: Schema(req.body.hub_id) } }],
                as: "vehicles_detail"
            }
        };
        let vehicle_unwind = {
            $unwind: {
                path: "$vehicles_detail",
                preserveNullAndEmptyArrays: true
            }
        };

        let providers = await Provider.aggregate([{ $match: { provider_type_id: Schema(req.body.hub_id) } }, vehicle_lookup, vehicle_unwind, Project])
        res.json({ success: true, providers: providers })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.get_hub_users = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let Project = {
            $project:
            {
                first_name: 1,
                last_name: 1,
                country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1,
                phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                hub_id: 1,
                is_approved: 1,
            }
        }

        let users = await Hub_User.aggregate([{ $match: { hub_id: Schema(req.body.hub_id) } }, Project])
        res.json({
          success: true,
          users: users,
          is_show_email: req.headers.is_show_email,
          is_show_phone: req.headers.is_show_phone,
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.fetch_service_type_for_hub = async function (req, res) {
    try {
        let params_array = [{ name: "hub_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let hub_id = Schema(req.body.hub_id)
        let admin_type_id = Schema(req.body.admin_type_id);

        let hub = await Hub.findOne({ _id: hub_id })
        let cityid = hub.city_id;

        let lookup = {
            $lookup:
            {
                from: "types",
                localField: "typeid",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let unwind = { $unwind: "$type_detail" };

        let project = {
            $project: {
                'type_detail.typename': 1, 'type_detail._id': 1
            }
        }

        let service_list = await City_type.aggregate([{ $match: { cityid: cityid } }, { $match: { typeid: admin_type_id } }, { $match: { is_ride_share: 0 } }, lookup, unwind, project])
        res.json({ success: true, service_list: service_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.assign_unassign_vehicle_to_hub = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let hub_id = req.body.hub_id;
        let state = Number(req.body.state)

        let user_type_id = null
        let service_type = null;

        let vehicle = await Vehicle.findOne({ _id: Schema(req.body.vehicle_id) })
        let hub = await Hub.findOne({ _id: hub_id });
        let city_type = await City_type.findOne({ cityid: hub.city_id, typeid: vehicle.admin_type_id });
        let message;
        if (!city_type) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_NO_SERVICE_TYPE_FOUND_IN_YOUR_CITY })
        }

        let history_type = VEHICLE_HISTORY_TYPE.ASSIGNED
        if (state == 1) {
            user_type_id = hub_id
            service_type = city_type._id;
            message = VEHICLE_MESSAGE_CODE.ASSIGNED_SUCCESSFULLY
        } else {
            if (vehicle.provider_id != null) {
                message = HUB_ERROR_CODE.VEHICLE_IN_USE
                return res.json({ success: false, message: message })
            }
            message = VEHICLE_MESSAGE_CODE.UNASSIGNED_SUCCESSFULLY
            history_type = VEHICLE_HISTORY_TYPE.UNASSIGNED
        }

        utils.add_vehicle_history(vehicle, history_type, {
            hub_id: hub_id,
            name: hub.name
        }, req.headers)

        if (vehicle) {
            vehicle.user_type_id = user_type_id
            vehicle.service_type = service_type
            await vehicle.save();
        }

        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_hub_user = async function (req, res) {
    try {
        let params_array = [{ name: "hub_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let error_code;
        let phone_user = await Hub_User.find({ country_phone_code: req.body.country_phone_code, phone: req.body.phone })
        if (phone_user.length > 0) {
            error_code = LIST_ERROR_CODE.PHONE_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }

        let email_user = await Hub_User.find({ email: req.body.email })
        if (email_user.length > 0) {
            error_code = LIST_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }

        if (req.body.password) {
            req.body.password = crypto.createHash('md5').update(req.body.password).digest('hex')
        }

        let hub_id = Schema(req.body.hub_id)
        let hub_user = new Hub_User({
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            email: req.body.email,
            country_phone_code: req.body.country_phone_code,
            phone: req.body.phone,
            password: req.body.password,
            hub_id: hub_id,
            is_approved: true,
            token: utils.tokenGenerator(32)
        })
        await hub_user.save();
        res.json({ success: true, message: HUB_USER_MESSAGE_CODE.ADD_SUCCESSFULLY, hub_user: hub_user })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_hub_user = async function (req, res) {
    try {
        let params_array = [{ name: "user_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user_id = Schema(req.body.user_id)
        let error_code;
        let phone_user = await Hub_User.find({ _id: { $ne: user_id }, country_phone_code: req.body.country_phone_code, phone: req.body.phone })
        if (phone_user.length > 0) {
            error_code = LIST_ERROR_CODE.PHONE_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }

        let email_user = await Hub_User.find({ _id: { $ne: user_id }, email: req.body.email })
        if (email_user.length > 0) {
            error_code = LIST_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }

        if (req.body.password == "") {
            delete req.body.password;
        } else {
            req.body.password = crypto.createHash('md5').update(req.body.password).digest('hex')
        }
        let hub_user = await Hub_User.findByIdAndUpdate(user_id, req.body);

        res.json({ success: true, message: HUB_USER_MESSAGE_CODE.UPDATE_SUCCESSFULLY, hub_user: hub_user })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.delete_hub_user = async function (req, res) {
    try {
        let params_array = [{ name: "user_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        await Hub_User.findByIdAndDelete(Schema(req.body.user_id))
        res.json({ success: true, message: HUB_USER_MESSAGE_CODE.DELETED_SUCCESSFULLY })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_edit_vehicle_model_brand = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let Type;
        switch (req.body.type) {
            case 1: // vehicle brand
                Type = Vehicle_Brand
                break;
            case 2: // vehicle model
                Type = Vehicle_Model
                break;
        }

        let id = req.body.id ? Schema(req.body.id) : null

        let duplicate = await Type.findOne({ _id: { $ne: id }, name: req.body.name, vehicle_type: req.body.vehicle_type })
        if (duplicate) {
            return res.json({ success: false, error_code: VEHICLE_MODEL_BRAND_ERROR_CODE.ALREADY_EXITS })
        }

        if (id) {
            let doc = await Type.findByIdAndUpdate(id, req.body, { new: true })
            return res.json({ success: true, message: VEHICLE_MODEL_BRAND_MESSAGE_CODE.UPDATE_SUCCESSFULLY, doc: doc })
        } else {
            let doc = new Type({
                brand_id: req.body.brand_id,
                vehicle_type: req.body.vehicle_type,
                name: req.body.name,
                is_active: true,
            })
            await doc.save()
            return res.json({ success: true, message: VEHICLE_MODEL_BRAND_MESSAGE_CODE.ADD_SUCCESSFULLY })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_vehicle_brand_model = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let Type;
        switch (req.body.type) {
            case 1: // vehicle brand
                Type = Vehicle_Brand
                break;
            case 2: // vehicle model
                Type = Vehicle_Model
                break;
        }
        let brand_condition = {}
        let brand_id = req.body.brand_id ? Schema(req.body.brand_id) : null;
        if (brand_id) {
            brand_condition = { brand_id: brand_id }
        }

        let list = await Type.find({ ...brand_condition, is_active: true })
        return res.json({ success: true, list: list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}
let Vehicle_History = require('mongoose').model('Vehicle_History');

exports.get_vehicle_history = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let history = await Vehicle_History.find({ vehicle_id: Schema(req.body.vehicle_id) })
        return res.json({ success: true, history: history })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_all_hub_list = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'city_id', type: 'string' }], async function (response) {
        if (response.success) {
            let city_id = Schema(req.body.city_id) || null;
            let hubs = await Hub.find({ city_id: city_id }, { name: 1, address: 1, location: 1, kmlzone: 1 });
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

exports.get_hub_list = async function(req,res){
    try{

        
        let params = [{name:"country_id" , type:"string"},{name:"city_id" , type:"string"}]
        
        let response = await utils.check_request_params_async(req.body,params)
        if (!response.success) {
            res.json(response)
            return;
        }
        
       let city_condition = {$match:{}}
       let country_condition = {$match:{}}
        
        if(req.body.country_id != "all"){
             country_condition = {$match:{country_id:Schema(req.body.country_id)}}
            
        }
        if(req.body.city_id != "all"){
             city_condition = {$match:{city_id:Schema(req.body.city_id)}}
            
        }
       let city_lookup = {
            $lookup: {
                from: 'cities',
                localField: 'city_id',
                foreignField: '_id',
                pipeline:[{$project:{
                    cityname:1,
                    full_cityname:1
                }}],
                as: 'city_detail'
            }
        }

       let unwind_city = {
            $unwind: {
                path: "$city_detail",
                preserveNullAndEmptyArrays: true
            }
        }

        let hubs = await Hub.aggregate([city_condition,country_condition,city_lookup,unwind_city])
    

        res.json({success:true,hubs})
        
        
    }catch(error){
        utils.error_response(error, req, res)

    }
        
}

exports.check_wsal_status = async function(req, res){
    try{

        let params_array = [{ name: 'driver_ids', type: 'object' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let driver_ids = req.body.driver_ids;
        
        if (driver_ids.length > 0) {
            let promises = driver_ids.map(async (driver_id) => {
                await wsal_services.DriverVehicleEligibilityInquiryService(driver_id);
            });

            // Wait for all operations to complete and then emit socket event
            Promise.all(promises).then(() => {
                utils.wsal_status_socket();
            }).catch(error => {
                utils.wsal_status_socket();
            });
        }
        
        res.json({success: true, message: success_messages.MESSAGE_CODE_PROVIDER_SENT_TO_WSAL_CHECK})

    }catch(error){
        utils.error_response(error, req, res)
    
    }
}

// Rent Car 
exports.add_edit_car_rent_type = async function (req, res) {

    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let id = req.body.id ? Schema(req.body.id) : null

        let duplicate = await Car_Rent_Type.findOne({ _id: { $ne: id }, name: { $regex: `${req.body.name}$`, $options: 'i' }, country_id: req.body.country_id });
        if (duplicate) {
            return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.TYPE_ALREADY_EXITS })
        }

        if (id) {
            let doc = await Car_Rent_Type.findByIdAndUpdate(id, req.body, { new: true })
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.UPDATE_SUCCESSFULLY, doc: doc })
        } else {
            let doc = new Car_Rent_Type({
                name: req.body.name,
                brand_id: req.body.brand_id,
                plateform_fee: req.body.plateform_fee,
                country_id: req.body.country_id,
                is_active: true
            })
            await doc.save()
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.ADD_SUCCESSFULLY })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_car_rent_type = async function (req, res) {
    try {
        let params_array = [{ name:"country_id" , type:"string" }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let car_rent_type_list = await Car_Rent_Type.find({ country_id: req.body.country_id });
        return res.json({ success: true, car_rent_type_list });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_edit_car_rent_brand_model = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let Type;
        switch (req.body.type) {
            case 1: // vehicle brand
                Type = Car_Rent_Brand
                break;
            case 2: // vehicle model
                Type = Car_Rent_Model
                break;
        }

        let id = req.body.id ? Schema(req.body.id) : null;

        if(req.body.type == 1){
            let duplicate = await Type.findOne({ _id: { $ne: id }, name: { $regex: `${req.body.name}$`, $options: 'i' }, country_id: req.body.country_id })
            if (duplicate) {
                return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.BRAND_ALREADY_EXITS })
            }
        } else {
            let duplicate = await Type.findOne({ _id: { $ne: id }, name: { $regex: `${req.body.name}$`, $options: 'i' }, brand_id: req.body.brand_id })
            if (duplicate) {
                return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.MODEL_ALREADY_EXITS })
            }
        }

        if (id) {
            let doc = await Type.findByIdAndUpdate(id, req.body, { new: true })
            let message = req.body.type == 1 ? CAR_RENT_MESSAGE_CODE.BRAND_UPDATE_SUCCESSFULLY : CAR_RENT_MESSAGE_CODE.MODEL_UPDATE_SUCCESSFULLY;
            return res.json({ success: true, message: message, doc: doc })
        } else {
            let doc = new Type({
                brand_id: req.body.brand_id,
                name: req.body.name,
                is_active: true,
                country_id: req.body.country_id,
                type_id: req.body.type_id
            })
            await doc.save()
            let message = req.body.type == 1 ? CAR_RENT_MESSAGE_CODE.BRAND_ADD_SUCCESSFULLY : CAR_RENT_MESSAGE_CODE.MODEL_ADD_SUCCESSFULLY;
            return res.json({ success: true, message: message })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_car_rent_brand_model = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let Type;
        switch (req.body.type) {
            case 1: // vehicle brand
                Type = Car_Rent_Brand
                break;
            case 2: // vehicle model
                Type = Car_Rent_Model
                break;
        }
        let country_condition = {};
        let country_id = req.body.country_id ? Schema(req.body.country_id): null;
        if(country_id){
            country_condition = { country_id: country_id };
        }
        let brand_condition = {};
        let brand_id = req.body.brand_id ? Schema(req.body.brand_id) : null;
        if (brand_id) {
            brand_condition = { brand_id: brand_id };
        }

        let query_conditions = {
            ...country_condition,
            ...brand_condition,
            is_active: true
        };

        if (req.body.type == 1) {
            // For brand
            const list = await Type.find(query_conditions);
            return res.json({ success: true, list: list });
        } 

        let type_lookup = {
            $lookup:{
                from: "car_rent_types",
                localField: "type_id",
                pipeline: [{ $project: { _id: 1, name: 1 } }],
                foreignField: "_id",
                as: "type_detail"
            }
        }

        let list = await Type.aggregate([{ $match: query_conditions }, type_lookup]);
        return res.json({ success: true, list: list })
        
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// Rent Car Feature
exports.add_edit_car_rent_feature = async function (req, res) {

    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let id = req.body.id ? Schema(req.body.id) : null

        let duplicate = await Car_Rent_Feature.findOne({ _id: { $ne: id }, title: { $regex: `${req.body.title}$`, $options: 'i' } });
        if (duplicate) {
            return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.FEATURE_ALREADY_EXITS })
        }

        if (id) {
            let doc = await Car_Rent_Feature.findByIdAndUpdate(id, req.body, { new: true })
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.FEATURE_UPDATE_SUCCESSFULLY, doc: doc })
        } else {
            let doc = new Car_Rent_Feature({
                title: req.body.title,
                is_active: true
            })
            await doc.save()
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.FEATURE_ADDED_SUCCESSFULLY })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_car_rent_feature = async function (req, res) {
    try {
        let params_array = [];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let limit = Number(req.query.limit);
        let page = Number(req.query.page) - 1;
        let search = req.query.search_value;

        // pagination query 
        let limits = { $limit: limit };
        let skips = { $skip: limit * page };

        // count query
        let count = { $group: { _id: null, total: { $sum: 1 } } };

        let condition = {};
        if (search && search !== "null") {
            condition['title'] = { $regex: search, $options: 'i' }
        }

        // Total page 
        let total_list = await Car_Rent_Feature.aggregate([{$match: condition }, count])
        let total_page = Math.ceil((total_list[0]?.total || 0) / limit)

        // apply query for particular type
        let car_rent_feature_list = await Car_Rent_Feature.aggregate([
            { $match: condition },
            skips,
            limits,
        ])

        return res.json({ success: true, total_page, car_rent_feature_list });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// Rent Car Specification
exports.add_edit_car_rent_spedification = async function (req, res) {

    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let id = req.body.id ? Schema(req.body.id) : null

        let duplicate = await Car_Rent_Specification.findOne({ _id: { $ne: id }, title: { $regex: `${req.body.title}$`, $options: 'i' } });
        if (duplicate) {
            return res.json({ success: false, error_code: RENT_CAR_ERROR_CODE.SPECIFICATION_ALREADY_EXITS })
        }
        
        let options = req.body.options;
        // Check if the options string is not empty or undefined/null
        if (options && options.trim() !== '') {
            const options_array = options.split(',').map(option => option.trim());
            req.body.options = options_array;
        } else {
            req.body.options = [];
        }

        if (id) {
            let doc = await Car_Rent_Specification.findByIdAndUpdate(id, req.body, { new: true })
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.SPECIFICATION_UPDATE_SUCCESSFULLY, doc: doc })
        } else {
            let doc = new Car_Rent_Specification({
                title: req.body.title,
                is_active: true,
                options: req.body.options
            })
            await doc.save()
            return res.json({ success: true, message: CAR_RENT_MESSAGE_CODE.SPECIFICATION_ADDED_SUCCESSFULLY })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_car_rent_specification = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let limit = Number(req.query.limit);
        let page = Number(req.query.page) - 1;
        let search = req.query.search_value;

        // pagination query 
        let limits = { $limit: limit };
        let skips = { $skip: limit * page };

        // count query
        let count = { $group: { _id: null, total: { $sum: 1 } } };

        let condition = {};
        if (search && search !== "null") {
            condition['title'] = { $regex: search, $options: 'i' }
        }

        // Total page 
        let total_list = await Car_Rent_Specification.aggregate([{ $match: condition }, count])
        let total_page = Math.ceil((total_list[0]?.total || 0) / limit)

        // apply query for particular type
        let car_rent_specification_list = await Car_Rent_Specification.aggregate([
            { $match: condition },
            skips,
            limits,
        ])

        return res.json({ success: true, total_page, car_rent_specification_list });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.admin_get_rent_vehicle_list = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
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
                admin_status: 1,
                brand: { $arrayElemAt: ["$brand_details.name", 0] }, // Extracting brand name
                model: { $arrayElemAt: ["$model_details.name", 0] }, // Extracting model name
                plate_no: 1,
                rate: 1,
                rate_count: 1,
                trips: { $toString: "$completed_request" },
                currency_code : 1,
                currency_sign : 1,
                unique_id: 1,
            }
        }

        let rent_vehicle_list = await Car_Rent_Vehicle.aggregate([{ $match: provider_condition }, brand_lookup, model_lookup, project]);
        return res.json({ success: true, rent_vehicle_list });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.admin_get_rent_vehicle_detail = async function (req, res) {
    try {
        let params_array = [
            { name: "vehicle_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
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
                pipeline:[{ $project:{ name:1 } }],
                as: "type_details"
            }
        }

        let feature_lookup = {
            $lookup : {
                from: "car_rent_features",
                localField: "features",
                foreignField: "_id",
                pipeline:[{ $project:{ title:1, _id:0 } }],
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
                type: { $arrayElemAt: ["$type_details.name", 0] }, // Extracting type name
                title: { 
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] },
                        " ", 
                        { $arrayElemAt: ["$model_details.name", 0] },
                        " ", 
                        { $toString: "$year" }
                    ] 
                },
                unique_no: 1,
                unique_id: 1,
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
                currency_sign : 1,
                cancellation_charge: 1,
                total_request: 1,
                completed_request: 1,
                rate : 1,
                rate_count : 1,
                unit: 1
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

exports.admin_approve_reject_rent_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: "vehicle_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        const vehicle = await Car_Rent_Vehicle.findOne({ _id: req.body.vehicle_id });
        if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        let is_approved = Number(req.body.is_approved);

        let message = CAR_RENT_MESSAGE_CODE.VEHICLE_APPROVED_SUCCESSFULLY
        let push_message = push_messages.PUSH_CODE_FOR_ADMIN_APPROVED_RENTAL_VEHICLE
        vehicle.admin_status = 1 // Approved
        vehicle.rejection_reason = "";
        if(is_approved == 0){
            vehicle.rejection_reason = req.body.reason;
            vehicle.admin_status = 2 // Rejected
            message = CAR_RENT_MESSAGE_CODE.VEHICLE_REJECTED_SUCCESSFULLY;
            push_message = push_messages.PUSH_CODE_FOR_ADMIN_REJECT_RENTAL_VEHICLE
        }

        await vehicle.save();
        const provider = await Provider.findOne({_id : vehicle.provider_id }).select({
            device_type : 1, device_token : 1
        })
        if(provider){
            utils.sendPushNotification(provider.device_type, provider.device_token, push_message, {vehicle_id: vehicle._id}, provider.webpush_config, provider.lang_code);
        }
        return res.json({ success: true, message : message, vehicle_id: req.body.vehicle_id });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.admin_approve_reject_rental_driver = async function (req, res) {
    try {
        let params_array = [{ name: "provider_id", type: "string"}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        const provider = await Provider.findOne({ _id: req.body.provider_id });
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });

        let is_approved = Number(req.body.is_approved);

        if(is_approved == 1){
            const vehicle = await Car_Rent_Vehicle.findOne({ provider_id: req.body.provider_id });
            if(!vehicle) return res.json({ success: false, error_code: error_message.ERROR_CODE_RENTAL_VEHICLE_NOT_ADDED });
        }

        provider.is_rental_approved = is_approved; // Approved or Reject
        await provider.save();

        let message = LIST_MESSAGE_CODE.APRROVED_SUCCESSFULLY;
        let push_message = push_messages.PUSH_CODE_FOR_PROVIDER_APPROVED_FOR_RENTAL;
        if(is_approved == 0){
            message = LIST_MESSAGE_CODE.DECLINE_SUCCESSFULLY;
            push_message = push_messages.PUSH_CODE_FOR_PROVIDER_DECLINED_FOR_RENTAL;
        }
        utils.sendPushNotification(provider.device_type, provider.device_token, push_message, "", provider.webpush_config, provider.lang_code);
        return res.json({ success: true, message: message });

    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.fetch_rent_car_owner_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return
        }

        let limit = Number(req.query.limit)
        let page = Number(req.query.page) - 1
        let search_item = req.query.search_item
        let search_value = req.query.search_value
        let is_excel_sheet = req.query.is_excel_sheet
        let start_date = req.query.start_date;
        let end_date = req.query.end_date;
        
        // project optimize query
        let project = {
            $project:
            {
                unique_id: 1,
                last_name: 1,
                first_name: 1,
                email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1,
                phone: !req.headers.is_show_phone ? HIDE_DETAILS.PHONE : 1,
                country_phone_code: !req.headers.is_show_phone ? HIDE_DETAILS.COUNTRY_CODE : 1,
                country: 1,
                city: 1,
                picture: 1,
                wallet: 1,
                wallet_currency_code: 1,
                is_document_uploaded: 1,
                address: 1,
                rent_vehicle_details: 1,
                app_version: 1
            }
        }

        // pagination query 
        let limits = { $limit: limit }
        let skips = { $skip: limit * page }

        // filter query
        let condition = {}
        if (search_item && search_value) {
            if (search_item == 'unique_id') {
                search_value = Number(req.query.search_value)
                condition[search_item] = search_value
            } else {
                let search_name = search_item.includes('name')
                if (search_value.endsWith('\\')) {
                    search_value = search_value.slice(0, -1);
                }
                condition[search_item] = { $regex: search_value, $options: 'i' }
                if (search_name) {
                    condition = {
                        $or: [
                            {
                                [search_item]: { $regex: search_value, $options: 'i' },
                            },
                            {
                                'last_name': { $regex: search_value, $options: 'i' },
                            }
                        ]
                    }
                }
                let value = search_value.split(' ')
                if (value.length > 1 && search_name) {
                    condition = {}
                    condition[search_item] = { $regex: value[0], $options: 'i' }
                    condition['last_name'] = { $regex: value[1], $options: 'i' }
                }
               
            }
        }

        if(start_date && end_date){
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            condition['created_at'] = { $gte: startDate, $lt: endDate };
        }

        let rent_vehicle_lookup = {
            $lookup: {
                from: 'car_rent_vehicles',
                localField: '_id',
                foreignField: "provider_id",
                pipeline:[{$project:{ unique_id:1, _id:0 }}],
                as: 'rent_vehicle_details'
            }
        }
        // Match only providers with at least one rental vehicle
        let rent_vehicle_condition = {
            $match: { "rent_vehicle_details.0": { $exists: true } }
        };

        // sorting by unique_id
        let sort = { $sort: { unique_id: -1 } }

        //anonymous
        let anonymous = { $match: { _id: { $ne: Schema('000000000000000000000000') } } }

        // count query
        let count = { $group: { _id: null, total: { $sum: 1 } } };

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(2, req.headers)

        // Total page 
        let total_list = await Provider.aggregate([{ $match: country_city_condition }, rent_vehicle_lookup, rent_vehicle_condition, { $match: condition }, anonymous, count])
        let total_page = Math.ceil((total_list[0]?.total || 0) / limit)

        if (is_excel_sheet) {
            let array = await Provider.aggregate([rent_vehicle_lookup, rent_vehicle_condition, { $match: condition }, anonymous, project, sort])
            generate_excel(req, res, array, "Car Rent Owner", req.query.header)
            return
        }

        // apply query for particular type
        let type_list = await Provider.aggregate([{ $match: country_city_condition }, rent_vehicle_lookup, rent_vehicle_condition, { $match: condition }, anonymous, project, sort, skips, limits])

        return res.json({ success: true, type_list: type_list, total_page: total_page, is_show_email: req.headers.is_show_email, is_show_phone: req.headers.is_show_phone })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}


