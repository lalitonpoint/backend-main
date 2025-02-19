let Type = require('mongoose').model('Type');
let utils = require('../../controllers/utils')
const {
    SERVICE_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    SERVICE_TYPE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');

exports.service_type_list = async function (req, res) {
    try {
        let parmas_array = []
        let response = await utils.check_request_params_async(req.body, parmas_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let type_list = await Type.find({}).sort({ is_default_selected: -1 })
        res.json({ success: true, type_list: type_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* ADD SERVICE TYPE */
exports.add_service_type = async function (req, res) {
    try {
        let parmas_array = [{ name: 'typename', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, parmas_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let typename = req.body.typename
        let duplicat_type = await Type.findOne({ typename: { $regex: `^${typename}$`, $options: 'i' } })
        if (duplicat_type) {
            let error_code = SERVICE_TYPE_ERROR_CODE.NAME_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let add_type = new Type({
            typename: (req.body.typename).trim(),
            description: req.body.description,
            service_type: req.body.service_type || 0,
            is_business: req.body.is_business,
            ride_share_limit: req.body.ride_share_limit,
            priority: req.body.priority,
            vehicle_type: req.body.vehicle_type,
            type_image_url: '',
            map_pin_image_url: ''
        });
        if (req.files != null || req.files != undefined) {
            req.files.forEach(file => {
                if (file.fieldname === 'type_image_url') {
                    let image_name = add_type._id + utils.tokenGenerator(4);
                    let url = utils.getImageFolderPath(req, 4) + image_name + '.png';
                    add_type.type_image_url = url;
                    utils.saveImageFromBrowser(file.path, image_name + '.png', 4);
                } else if (file.fieldname === 'map_pin_image_url') {
                    let image_name = add_type._id + utils.tokenGenerator(5);
                    let url = utils.getImageFolderPath(req, 5) + image_name + '.png';
                    add_type.map_pin_image_url = url;
                    utils.saveImageFromBrowser(file.path, image_name + '.png', 5);
                }
            });
        }
        await add_type.save()

        let info_detail = "ADDED"
        let changes = [ 
            {
                "field" : "typename",
                "oldValue" : "-",
                "newValue" : add_type.typename
            }
        ]
        
        utils.addChangeLog(UPDATE_LOG_TYPE.TYPE_DETAIL, req.headers, changes, add_type.typename, info_detail, {
            info_detail: add_type.typename,
            type_id: add_type._id
        })

        let message = SERVICE_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* EDIT SERVICE TYPE */
exports.edit_service_type = async function (req, res) {
    try {
        let parmas_array = [{ name: 'id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, parmas_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let id = req.body.id
        let typename = req.body.typename
        let find_duplicate_name = await Type.findOne({ _id: { $ne: id }, typename: { $regex: `^${typename}$`, $options: 'i' } })
        if (find_duplicate_name) {
            let error_code = SERVICE_TYPE_ERROR_CODE.NAME_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        if (req.body.is_default_selected == 'true') {
            await Type.updateMany({ _id: { $ne: id } }, { $set: { is_default_selected: false } }, { multi: true })
        }
        if (req.files != undefined && req.files.length > 0) {
            for (const value of req.files) {
                if (value.fieldname === 'type_image_url') {
                    let icon_name = id + utils.tokenGenerator(36);
                    let icon_url = utils.getImageFolderPath(req, 4) + icon_name + '.png';
                    req.body.type_image_url = icon_url;
                    utils.saveImageFromBrowser(value.path, icon_name + '.png', 4);
                } else {
                    let pin_name = id + utils.tokenGenerator(36);
                    let pin_url = utils.getImageFolderPath(req, 5) + pin_name + '.png';
                    req.body.map_pin_image_url = pin_url;
                    utils.saveImageFromBrowser(value.path, pin_name + '.png', 5);
                }
            }
        }
        if(req.body.is_business == 0){
            req.body.is_default_selected = false;
        }
        
        let old_type = await Type.findById(id)
        let updated_type = await Type.findByIdAndUpdate(id, req.body, {new: true})
        let changes = utils.getModifiedFields(old_type, updated_type, [])
        if(changes.length > 0){
            utils.addChangeLog(UPDATE_LOG_TYPE.TYPE_DETAIL, req.headers, changes, old_type.typename, "", {
                type_id: updated_type._id
            })
        }

        res.json({ success: true, message: SERVICE_MESSAGE_CODE.UPDATE_SUCCESSFULLY })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}