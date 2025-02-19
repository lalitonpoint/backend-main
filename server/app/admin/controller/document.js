let Document = require('mongoose').model('Document');
let Provider_Document = require('mongoose').model('Provider_Document');
let User_Document = require('mongoose').model('User_Document');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Partner_vehicle_documents = require('mongoose').model('Partner_Vehicle_Document')
let Partner = require('mongoose').model('Partner')
let Country = require('mongoose').model('Country');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let utils = require('../../controllers/utils')
let Vehicle = require('mongoose').model('Vehicle');
const {
    DOCUMENT_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    COUNTRY_ERROR_CODE,
    DOCUMENT_ERROR_CODE,
} = require('../../utils/error_code')
const {
    DOCUMENT_TYPE,
    COLLECTION,
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');

exports.get_document_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country_lookup = {
            $lookup: {
                from: 'countries',
                localField: 'countryid',
                foreignField: '_id',
                as: 'country_details'
            }
        }
        let unwind = { $unwind: '$country_details' }
        let project = {
            $project: {
                'country_details.countryname': 1,
                "_id": 1,
                "unique_id": 1,
                "countryid": 1,
                "title": 1,
                "type": 1,
                "option": 1,
                "is_unique_code": 1,
                "is_expired_date": 1,
                "is_visible": 1,
                "created_at": 1,
                "updated_at": 1,
            }
        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.DOCUMENT, req.headers)

        let document_list = await Document.aggregate([{$match: country_city_condition}, country_lookup, unwind, project])
        res.json({ success: true, document_list: document_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.add_document_details = async function (req, res) {
    try {
        let params_array = [{ name: 'country', type: 'string' }, { name: 'title', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // check duplicate document
        let title = req.body.title;
        let duplicat_doc = await Document.findOne({ title: { $regex: `^${title}$`, $options: 'i' }, countryid: req.body.country, type: Number(req.body.type) });
        if (duplicat_doc) {
            return res.json({ success: false, error_code: DOCUMENT_ERROR_CODE.DOCUMENT_ALREADY_EXISTS });
        }

        let document = new Document({
            countryid: req.body.country,
            title: (req.body.title).trim(),
            type: req.body.type,
            option: req.body.option,
            is_unique_code: req.body.is_unique_code,
            is_expired_date: req.body.is_expired_date,
            is_visible: req.body.is_visible
        });
        await document.save()

        let info_detail = "ADDED"
        let changes = [ 
            {
                "field" : "title",
                "oldValue" : "-",
                "newValue" : document.title
            }
        ]
        utils.addChangeLog(UPDATE_LOG_TYPE.DOCUMENT_SETTINGS, req.headers, changes, document.title, info_detail, {
            info_detail: document.title,
            document_id: document._id,
            type: document.type,
            countryid: document.countryid,
        })
        
        let country_data = await Country.findOne({ _id: document.countryid });
        if (!country_data) {
            let error_code = COUNTRY_ERROR_CODE.COUNTRY_NOT_FOUND;
            res.json({ success: false, error_code: error_code })
            return
        }
        // Old Code
        // if (req.body.type == DOCUMENT_TYPE.PROVIDER) {
        // } 
            
        // add new document in provider and user document list
        if (req.body.type == DOCUMENT_TYPE.USER) {
            let users = await User.find({ country: country_data.countryname }).select({ _id: 1 }).lean();
            let users_documents = [];
            users.forEach((user) => {
                users_documents.push({
                    user_id: user._id,
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
            });
            // await removed because there maybe large data set that will take time to update
            User_Document.insertMany(users_documents).then(() => { });
        } else if (req.body.type == DOCUMENT_TYPE.VEHICLE) {
            let partners = await Partner.find({ country: country_data.countryname })
            let partner_vehicle = []

            for await (const partner of partners) {
                let vehicles = await Vehicle.find({user_type_id: partner.user_id})
                for await (const vehicle of vehicles) {
                    partner_vehicle.push({
                        partner_id: partner._id,
                        document_id: document._id,
                        name: document.title,
                        option: document.option,
                        vehicle_id: vehicle._id,
                        document_picture: "",
                        unique_code: "",
                        expired_date: null,
                        is_unique_code: document.is_unique_code,
                        is_expired_date: document.is_expired_date,
                        is_uploaded: 0,
                        is_visible: document.is_visible
                    })
                }
            }
            // await removed because there maybe large data set that will take time to update
            Partner_vehicle_documents.insertMany(partner_vehicle).then(() => { });
        }
        let message = DOCUMENT_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_document_details = async function (req, res) {
    req.body.name=req.body.title;
    try {
        
        let params_array = [{ name: 'document_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.document_id;
        let title = req.body.title;

        // check duplicate document
        let duplicat_doc = await Document.findOne({ _id: { $ne: id }, title: { $regex: `^${title}$`, $options: 'i' }, countryid: req.body.country, type: Number(req.body.type) });
        if (duplicat_doc) {
            return res.json({ success: false, error_code: DOCUMENT_ERROR_CODE.DOCUMENT_ALREADY_EXISTS });
        }

        let before_update_document = await Document.findById(id)
        let update_document = await Document.findByIdAndUpdate(id, req.body, {new : true })

        let changes = utils.getModifiedFields(before_update_document, update_document, [])
        if(changes.length > 0){
            utils.addChangeLog(UPDATE_LOG_TYPE.DOCUMENT_SETTINGS, req.headers, changes, before_update_document.title, "", {
                document_id: update_document._id
            })
        }

        if(!req.body.option){
            // hERE TO CHANGES
            // req.body.is_expired_date = false
        }
        // condition added for better optimization
        // await removed because there maybe large data set that will take time to update

        if (!req.body.is_expired_date) {
            req.body['is_document_expired'] = false 
        }


        if (req.body.type == DOCUMENT_TYPE.PROVIDER) {
            Provider_Document.updateMany({ document_id: id }, req.body, { multi: true }).then(() => { })
        } else if (req.body.type == DOCUMENT_TYPE.USER) {
            User_Document.updateMany({ document_id: id }, req.body, { multi: true }).then(() => { })
        } else if (req.body.type == DOCUMENT_TYPE.VEHICLE) {
            Provider_Vehicle_Document.updateMany({ document_id: id }, req.body, { multi: true }).then(() => { })
            Partner_vehicle_documents.updateMany({ document_id: id }, req.body, { multi: true }).then(() => { })
        }
        if (!update_document) {
            let error_code = DOCUMENT_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = DOCUMENT_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}
