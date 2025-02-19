let crypto = require('crypto');
let Corporate = require('mongoose').model('Corporate');
let Dispatcher = require('mongoose').model('Dispatcher');
let Hotel = require('mongoose').model('Hotel');
let Partner = require('mongoose').model('Partner');
let Wallet_history = require('mongoose').model('Wallet_history');
let Provider = require('mongoose').model('Provider');
let Trip_history = require('mongoose').model('Trip_history');
let Trip = require('mongoose').model('Trip');
let Card = require('mongoose').model('Card');
let Partner_Vehicle_Document = require('mongoose').model('Partner_Vehicle_Document');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic');
let Provider_Document = require('mongoose').model('Provider_Document');
let Admin = require('mongoose').model('admin');
let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails');
let twilio = require('twilio');
let fs = require('fs');
let Document = require('mongoose').model('Document');
let moment = require('moment');
let City = require('mongoose').model('City');
let Citytype = require('mongoose').model('city_type');
let Type = require('mongoose').model('Type');
let Country = require('mongoose').model('Country');
let Settings = require('mongoose').model('Settings');
let xl = require('excel4node');
let myPartners = require('./partner');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let list = require("../../admin/controller/list")
let Vehicle = require('mongoose').model('Vehicle');
const {
    PARTNER_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    PARTNER_ERROR_CODE,
} = require('../../utils/error_code')
const {
    TYPE_VALUE,
    VEHICLE_TYPE,
} = require('../../controllers/constant');
// create partner vehicle
exports.create_partner_vehicle = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let partner = await Partner.findOne({ _id: req.body.partner_id })
        let is_selected = false;

        let vehicle_count = await Vehicle.count({ user_type_id: partner._id })

        if (vehicle_count == 0) {
            is_selected = true;
        }
        let mongoose = require('mongoose');
        let ObjectId = mongoose.Types.ObjectId;
        let x = new ObjectId();
        let accessibility = req.body.accessibility
        let vehicel_json = {
            _id: x,
            name: req.body.name,
            user_type_id: partner._id,
            country_id: partner.country_id,
            provider_id: null,
            user_type: TYPE_VALUE.PARTNER,
            plate_no: req.body.plate_no,
            model: req.body.model,
            color: req.body.color,
            passing_year: req.body.passing_year,
            accessibility: accessibility,
            service_type: null,
            admin_type_id: null,
            is_assigned: false,
            is_documents_expired: false,
            is_selected: is_selected,
            is_document_uploaded: false
        }
        let country = await Country.findById(partner.country_id)

        let document = await Document.find({ countryid: country._id, type: 2 })

        if (document.length == 0) {
            partner.is_vehicle_document_uploaded = true;
            vehicel_json.is_document_uploaded = true;
            utils.addVehicle(vehicel_json)
            await partner.save()
            let message = PARTNER_MESSAGE_CODE.ADD_SUCCESSFULLY;
            res.json({ success: true, message: message })
            return
        }
       let vehicle = await utils.addVehicle(vehicel_json)
        await partner.save()
        document.forEach(async function (entry, index) {
            let partnervehicledocument = new Partner_Vehicle_Document({
                vehicle_id: x,
                partner_id: partner._id,
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
            await partnervehicledocument.save()
            if (index == document.length - 1) {
                let message = PARTNER_MESSAGE_CODE.ADD_SUCCESSFULLY;
                res.json({ success: true, message: message ,vehicle_id:vehicle._id})
            }

        });
    } catch (error) {
        console.log(error);
        utils.error_response(error, req, res)
    }
};

exports.update_vehicle_details = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }, { name: 'vehicle_id', type: 'string' },]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }


        let partner = await Partner.findOne({ _id: req.body.partner_id })
        let vehicle_detail = await Vehicle.findOne({ _id: req.body.vehicle_id })

        vehicle_detail.name = req.body.name;
        vehicle_detail.plate_no = req.body.plate_no;
        vehicle_detail.model = req.body.model;
        vehicle_detail.color = req.body.color;
        vehicle_detail.passing_year = req.body.passing_year;
        vehicle_detail.accessibility = req.body.accessibility;
        vehicle_detail.save();
        let message = PARTNER_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
        res.json({ success: true, message: message, partner })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.get_partner_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let partner = await Partner.findOne({ _id: req.body.partner_id })
        if (!partner) {
            let message = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, error_code: message })
            return
        }

        let page;
        let search_item;
        let search_value;
        let sort_order;
        let sort_field;
        let value;
        if (req.body.page == undefined) {
            page = 0;
        } else {
            page = req.body.page;
        }

        if (req.body.search_item == undefined) {
            search_item = 'name';
            search_value = '';
            sort_order = -1;
            sort_field = 'unique_id';
        } else {
            value = req.body.search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            value = new RegExp(value, 'i');

            sort_order = req.body.sort_item[1];
            sort_field = req.body.sort_item[0];
            search_item = req.body.search_item
            search_value = req.body.search_value;
        }

        let number_of_rec = 10;

        value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');

        let search = { "$match": {} };
        search["$match"][search_item] = { $regex: new RegExp(value, 'i') }

        let sort = { "$sort": {} };
        sort["$sort"][sort_field] = parseInt(sort_order);

        let count = { $group: { _id: "$_id", total: { $sum: 1 } } };

        let skip = {};
        skip["$skip"] = page * number_of_rec;

        let limit = {};
        limit["$limit"] = number_of_rec;

        let condition = { $match: { "user_type_id": Schema(partner._id) } };

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
                _id: 1,
                is_selected: 1,
                passing_year: 1,
                color: 1,
                model: 1,
                plate_no: 1,
                name: 1,
                partner_id: "$user_id",
                type_image_url: '$type_detail.type_image_url',
                typename: '$type_detail.typename',
                accessibility: 1
            }
        };
        
        let message = PARTNER_MESSAGE_CODE.GET_DETAILS_SUCCESSFULLY;
        let array = await Vehicle.aggregate([condition, lookup, unwind, search, count])
        if (array.length == 0) {
            res.json({ success: true, message, vehicle_list: [], pages: 0 })
        } else {
            let pages = Math.ceil(array[0].total / number_of_rec);
            // let array2 = await Partner.aggregate([condition, vunwind, lookup, unwind, group, unwind2, search, sort, skip, limit])
            let array2 = await Vehicle.aggregate([condition, lookup, unwind, project, search])
            res.json({ success: true, message, vehicle_list: array2, pages });
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.vehicle_document_list_for_partner = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }, { name: 'vehicle_id', type: 'string' },]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let partner_vehicle_document = await Partner_Vehicle_Document.find({ partner_id: req.body.partner_id, vehicle_id: req.body.vehicle_id, is_visible: true })
        let message = PARTNER_MESSAGE_CODE.GET_DETAILS_SUCCESSFULLY;
        res.json({ success: true, message, partner_vehicle_document })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};


exports.vehicle_documents_update_for_partner = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }, { name: 'vehicle_id', type: 'string' },]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let partner_document = await Partner_Vehicle_Document.findById(req.body.document_id)

        partner_document.expired_date = req.body.expired_date;
        partner_document.unique_code = req.body.unique_code;
        if (req.body.expired_date == undefined) {
            partner_document.expired_date = null;
        }
        await Partner.findOne({ _id: req.body.partner_id })
        let vehicle_detail = await Vehicle.findOne({ _id: partner_document.vehicle_id })

        if (req.files.length > 0) {
            let image_name = partner_document.partner_id + utils.tokenGenerator(4);
            let mime_type = req.files[0].mimetype.split('/')[1]
            let url = utils.getImageFolderPath(req, 3) + image_name + '.' + mime_type;
            utils.saveImageFromBrowser(req.files[0].path, image_name + '.' + mime_type, 3);
            partner_document.document_picture = url;
            partner_document.is_uploaded = 1;
            await partner_document.save()
            let partner_pending_document = await Partner_Vehicle_Document.find({ _id: req.body.document_id, is_uploaded: 0 })
            if (partner_pending_document.length == 0) {
                vehicle_detail.is_document_uploaded = true;
                await vehicle_detail.save();
            }

            let message = PARTNER_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
            res.json({ success: true, message })
        } else {
            await partner_document.save()
            let partner_Vehicle_Document = await Partner_Vehicle_Document.find({ _id: req.body.document_id, is_uploaded: 0 })
            if (partner_Vehicle_Document.length == 0) {
                vehicle_detail.is_document_uploaded = true;
                await vehicle_detail.save()
            }
            let message = PARTNER_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
            res.json({ success: true, message })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

exports.assign_vehicle_to_provider = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }, { name: 'vehicle_id', type: 'string' },]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let partner = await Partner.findOne({ _id: req.body.partner_id })
        if (!partner) {
            let message = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, message: message })
            return
        }

        let vehicle_detail = await Vehicle.findOne({ _id: req.body.vehicle_id })

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        vehicle_detail.provider_id = provider.id;
        vehicle_detail.service_type = Schema(req.body.service_type_id);
        vehicle_detail.is_selected = true;
        vehicle_detail.is_assigned = true;

        provider.service_type = vehicle_detail.service_type;
        provider.admintypeid = vehicle_detail.admin_type_id;
        provider.vehicle_type = vehicle_detail.vehicle_type;
        provider.is_vehicle_document_uploaded = true;
        await provider.save();
        await vehicle_detail.save()

        let message = PARTNER_MESSAGE_CODE.ASSIGN_VEHICLE;
        res.json({ success: true, message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.remove_vehicle_from_provider = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }, { name: 'provider_id', type: 'string' },]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let partner = await Partner.findOne({ _id: req.body.partner_id })
        if (!partner) {
            let message = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, message: message })
            return
        }
        let provider = await Provider.findOne({ _id: req.body.provider_id })
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

        let vehicle_detail = await Vehicle.findOne({ provider_id: provider._id, is_selected: true })
        vehicle_detail.provider_id = null;
        vehicle_detail.is_assigned = false;
        vehicle_detail.is_selected = false;
        await vehicle_detail.save();

        provider.service_type = null;
        provider.admintypeid = null;
        provider.vehicle_type = VEHICLE_TYPE.NORMAL;
        provider.is_vehicle_document_uploaded = false;
        await provider.save();

        let message = PARTNER_MESSAGE_CODE.REMOVE_VEHICLE;
        res.json({ success: true, message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_available_vehicle_list = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let partner_id = req.body.partner_id
        let service_type = req.body.service_type
        let partner = await Partner.findOne({ _id: partner_id })
        let city_type = await Citytype.findOne({ _id: service_type })

        let vehicle_list = await Vehicle.find({ user_type_id: partner._id, admin_type_id: city_type.typeid, is_assigned: false })
        let vehicle_array = []
        for await(const vehicle of vehicle_list) {
            let partner_Vehicle_Document = await Partner_Vehicle_Document.findOne({ vehicle_id: vehicle._id, option: 1, is_uploaded: 0, is_visible: true })
            if (partner_Vehicle_Document) {
                vehicle.is_document_uploaded = false
            } else {
                vehicle.is_document_uploaded = true
            }
            if (vehicle.admin_type_id != null && !vehicle.is_assigned && city_type.typeid.toString() == vehicle.admin_type_id.toString() && vehicle.is_document_uploaded) {
                vehicle_array.push(vehicle)
            }
            await vehicle.save()
        }
        if (vehicle_array.length == 0) {
            res.json({ success: false, error_code: PARTNER_ERROR_CODE.VEHICLE_LIST_NOT_FOUND })
            return
        }
        res.json({ success: true, vehicle_array: vehicle_array })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_service_types = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        list.fetch_service_type(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.partner_fetch_service_type = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let partner_id = req.body.partner_id
        let partner = await Partner.findOne({ _id: partner_id })
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
        let cityid_condition = {
            $match: {
                $and: [
                    { 'cityid': { $eq: Schema(partner.city_id) } }
                ]
            }
        }
        let project = {
            $project: {
                'type_detail.typename': 1, 'type_detail._id': 1
            }
        }
        let unique_array;
        let detail;
        let service_type = []

        let vehicle_list = await Vehicle.find({ user_type_id: partner._id, admin_type_id: {$ne: null} }, {admin_type_id: 1})

        // find unique array partner vehicle admin type id
        if (vehicle_list.length > 0) {
            detail = (vehicle_list).filter((value) => value.admin_type_id != null).map(value => (value.admin_type_id).toString())
        }
        unique_array = [...new Set(detail)]
        // find type which match admin type id
        for (const type_id of unique_array) {
            let service_list = await Citytype.aggregate([{ $match: { typeid: Schema(type_id) } }, cityid_condition, lookup, unwind, project])
            if (service_list.length) {
                service_type.push(service_list[0])
            }
        }
        res.json({ success: true, service_type: service_type })
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}
