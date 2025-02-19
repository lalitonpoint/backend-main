let email_detail = require('mongoose').model('email_detail')
let utils = require('../../controllers/utils');
let Settings = require('mongoose').model('Settings');
let sms_detail = require('mongoose').model('sms_detail')
let guest_tokens = require('mongoose').model('guest_token')
let User = require('mongoose').model('User')
let Provider = require('mongoose').model('Provider')
let Language = require('mongoose').model('language')
let Cancel_reason = require('mongoose').model("cancellation_reason")
const { Types: { ObjectId } } = require("mongoose");
let webPush = require('web-push')
let path = require('path');
let Change_log = require('mongoose').model("change_log")
let moment = require('moment');
const {
    SETTINGS_MESSAGE_CODE,
    FILE_MESSAGE_CODE,
    LANG_MESSAGE_CODE,
    CANCELLATION_REASON,
} = require('../../utils/success_code')
const {
    SETTINGS_ERROR_CODE,
    LANGUAGE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    HIDE_DETAILS,
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');
const fs = require("fs");

exports.get_mongoose_models = async function (req, res) {
    const filePath = path.join(__dirname, "../../models/" + req.body.fileName + ".js");
    fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
            res.status(500).send("Error reading file");
        } else {
            res.type("application/javascript");
            res.send(data);
        }
    });
};

exports.get_setting_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let setting_detail = await Settings.find({})
        res.json({ success: true, setting_detail: setting_detail })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_setting_details = async function (req, res) {
    try {
        let id = req.body.setting_id
        if (req.body.location) {
            req.body.location = JSON.parse(req.body.location)
        }
        let params_array = [{ name: 'setting_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let old_settings = await Settings.findById(id)
        let setting = await Settings.findByIdAndUpdate(id, req.body, { new: true })
        let changes = utils.getModifiedFields(old_settings, setting, ["updated_at"])

        if (changes.length > 0) {
            utils.addChangeLog(UPDATE_LOG_TYPE.ADMIN_SETTINGS, req.headers, changes)
        }

        if (!setting) {
            let error_code = SETTINGS_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        if (!setting.webpush_public_key || !setting.webpush_private_key) {
            const vapidKeys = webPush.generateVAPIDKeys();
            setting.webpush_public_key = vapidKeys.publicKey
            setting.webpush_private_key = vapidKeys.privateKey
            await Settings.updateOne({ _id: id }, setting.getChanges())
        }
        let message = SETTINGS_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.upload_logo_images = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let files = req.files
        let message
        if (files != undefined && files.length > 0) {
            for (const file of files) {
                let fieldname = file.fieldname;
                let file_name = '';
                if (fieldname === 'logo_image') {
                    file_name = constant_json.LOGO_IMAGE_NAME;
                } else if (fieldname === 'title_image') {
                    file_name = constant_json.TITLE_IMAGE_NAME;
                } else if (fieldname === 'mail_title_image') {
                    file_name = constant_json.MAIL_TITLE_IMAGE_NAME;
                } else if (fieldname === 'authorised_image') {
                    file_name = constant_json.AUTHORISED_IMAGE_NAME;
                } else if (fieldname === 'user_logo') {
                    file_name = constant_json.USER_LOGO;
                } else if (fieldname === 'dark_header_logo') {
                    file_name = constant_json.DARK_HEADER;
                } else if (fieldname === 'dark_website_logo') {
                    file_name = constant_json.DARK_WEBSITE;
                }
                
                if (file_name !== '') {
                    utils.saveImageFromBrowser(req.files[0].path, file_name, 6);
                }
            }
            message = FILE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        message = FILE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_email_title = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let email_title = await email_detail.find({}, { emailUniqueTitle: 1 })
        res.json({ success: true, email_title: email_title })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_email_detail = async function (req, res) {
    try {
        let params_array = [{ name: "email_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.email_id
        let email_details = await email_detail.findById(id)
        res.json({ success: true, email_title: email_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_email_detail = async function (req, res) {
    try {
        let params_array = [{ name: "email_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.email_id
        let before_update_email_details = await email_detail.findByIdAndUpdate(id, req.body)
        let email_details = await email_detail.findByIdAndUpdate(id, req.body, { new: true })

        let changes = utils.getModifiedFields(before_update_email_details, email_details)

        if (changes.length > 0) {
            utils.addChangeLog(UPDATE_LOG_TYPE.EMAIL_SETTINGS, req.headers, changes, email_details.emailUniqueTitle, "", {
                _id: email_details._id
            })
        }

        let message = SETTINGS_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, email_title: email_details, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_sms_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let sms_details = await sms_detail.find({})
        res.json({ success: true, sms_details: sms_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_sms_details = async function (req, res) {
    try {
        let params_array = [{ name: "sms_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.sms_id
        let message = SETTINGS_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        let before_update_sms_details = await sms_detail.findById(id)
        let sms_details = await sms_detail.findByIdAndUpdate(id, req.body, { new: true })

        let changes = utils.getModifiedFields(before_update_sms_details, sms_details)

        if (changes.length > 0) {
            utils.addChangeLog(UPDATE_LOG_TYPE.SMS_SETTINGS, req.headers, changes, before_update_sms_details.smsUniqueTitle, "", {
                _id: before_update_sms_details._id
            })
        }


        res.json({ success: true, message: message, sms_details: sms_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_guest_token = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const date = new Date()
        let guest_token = await guest_tokens.find({ 'code_expiry': { $gte: date }, state: true })
        res.json({ success: true, guest_token: guest_token })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_guest_token = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.guest_id
        let guest_token = await guest_tokens.findByIdAndUpdate(id, req.body)
        res.json({ success: true, guest_token: guest_token })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_user_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country = req.body.country
        let query = {}
        if (country) {
            query['country'] = country
        }
        let user_list = await User.find(query, { unique_id: 1 }).sort({ unique_id: 1 })
        res.json({ success: true, user_list: user_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_provider_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country = req.body.country
        let query = {}
        if (country) {
            query['country'] = country
        }
        let provider_list = await Provider.find(query, { unique_id: 1 }).sort({ unique_id: 1 })
        res.json({ success: true, provider_list: provider_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_language_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let language_list = await Language.find({})
        res.json({ success: true, language_list: language_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_string = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const translatte = require('translatte');



        const newKey = req.body.key;
        const newValue = req.body.value;
        const customGeneralKey = req.body.object; // Replace with your custom key

        let translatted_values = [];
        let language_list = await Language.find({})

        for await (const element of language_list) {
            if (element.code != "en") {
                await translatte(newValue, { to: element.code }).then(res => {
                    console.log(res.text);
                    translatted_values.push({
                        path: element.string_file_path,
                        value: res.text
                    })
                }).catch(err => {
                    console.error(err);
                });
            } else {
                translatted_values.push({
                    path: element.string_file_path,
                    value: newValue
                })
            }
        }


        for await (const element of translatted_values) {
            add_string_to_file(element.path, customGeneralKey, newKey, element.value)
        }

        res.json({ success: true, language_list: language_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

function add_string_to_file(string_file_path, customGeneralKey, newKey, newValue) {
    let file_name = path.join(__dirname + '../../../../data/' + string_file_path)
    // Read file
    fs.readFile(file_name, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading en.json:', err);
            return;
        }

        try {
            const enData = JSON.parse(data);
            enData[customGeneralKey] = enData[customGeneralKey] || {};
            enData[customGeneralKey][newKey] = newValue;

            // Write updated content back to file
            fs.writeFile(file_name, JSON.stringify(enData, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing en.json:', err);
                } else {
                    console.log(`Added new key-value pair under ${customGeneralKey} in en.json`);
                }
            });
        } catch (parseErr) {
            console.error('Error parsing en.json:', parseErr);
        }
    });
}

exports.add_new_language = async function (req, res) {
    try {
        let params_array = [{ name: 'name', type: 'string' }, { name: 'code', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let name = (req.body.name).trim().toLowerCase()
        let code = (req.body.code).trim().toLowerCase()
        let is_lang_rtl = req.body.is_lang_rtl;
        if(is_lang_rtl == "null"){
            is_lang_rtl = "false"
        }
        let duplicate = await Language.findOne({ $or: [{ name: name }, { code: code }] })
        if (duplicate) {
            let error_code = LANGUAGE_ERROR_CODE.NAME_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        let language = new Language({
            name: name,
            code: code,
            string_file_path: '',
            is_lang_rtl: is_lang_rtl
        })

        let info_detail = "ADDED"
        let changes = [
            {
                "field": "name",
                "oldValue": "-",
                "newValue": language.name
            }
        ]

        utils.addChangeLog(UPDATE_LOG_TYPE.LANGUAGE_SETTINGS, req.headers, changes, language.name, info_detail, {
            info_detail: language.name,
            language_id: language._id
        })

        if (req.files != null || req.files != undefined) {
            const fs = require('fs');
            const file_path = req.files[0].path;
            const file_content = fs.readFileSync(file_path, 'utf-8');
            const json_content = JSON.parse(file_content);
            if (json_content) {
                let image_name = code
                let url = utils.getImageFolderPath(req, 10) + image_name + '.json';
                language.string_file_path = url
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.json', 10);
            } else {
                res.json({ success: false, message: LANGUAGE_ERROR_CODE.INVALID_JSON_FILE })
            }
        }
        await language.save()
        let message = LANG_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        if (error instanceof SyntaxError && error.message.includes('Unexpected token') || error instanceof SyntaxError && error.message.includes('Unexpected string')) {
            res.json({ success: false, message: LANGUAGE_ERROR_CODE.INVALID_JSON_FILE })
            return
        }
        utils.error_response(error, req, res)
    }
}

exports.edit_language = async function (req, res) {
    try {
        let params_array = [{ name: '_id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'code', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let name = (req.body.name).trim().toLowerCase()
        let code = (req.body.code).trim().toLowerCase()
        let is_lang_rtl = req.body.is_lang_rtl
        let before_update_language = await Language.findById(req.body._id);
        let language = {
            name: name,
            code: code,
            string_file_path: '',
            is_lang_rtl: is_lang_rtl
        }
        if (req.files.length > 0) {

            const fs = require('fs');
            const file_path = req.files[0].path;
            const file_content = fs.readFileSync(file_path, 'utf-8');
            const json_content = JSON.parse(file_content);
            if (json_content) {
                let image_name = code
                let detail = await Language.findOne({ _id: req.body._id })
                utils.deleteImageFromFolder(detail.string_file_path, 10);
                let url = utils.getImageFolderPath(req, 10) + image_name + '.json';
                language.string_file_path = url
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.json', 10);
            } else {
                res.json({ success: false, message: LANGUAGE_ERROR_CODE.INVALID_JSON_FILE })
            }

        }
        let updated_language = await Language.findByIdAndUpdate({ _id: req.body._id }, language, { new: true });
        let changes = utils.getModifiedFields(before_update_language, updated_language, ["updated_at"])
        let info_detail = "UPDATED"

        utils.addChangeLog(UPDATE_LOG_TYPE.LANGUAGE_SETTINGS, req.headers, changes, before_update_language.name, info_detail, {
            info_detail: before_update_language.name,
            language_id: updated_language._id
        })

        let message = LANG_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        if (error instanceof SyntaxError && error.message.includes('Unexpected token') || error instanceof SyntaxError && error.message.includes('Unexpected string')) {
            res.json({ success: false, message: LANGUAGE_ERROR_CODE.INVALID_JSON_FILE })
            return
        }
        utils.error_response(error, req, res)
    }
}

exports.delete_language = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let language_list = await Language.findById(req.body.id)
        if (language_list) {
            utils.deleteImageFromFolder(language_list.string_file_path, 10)
            let language = await Language.findByIdAndDelete(req.body.id)

            let info_detail = "DELETED"
            utils.addChangeLog(UPDATE_LOG_TYPE.LANGUAGE_SETTINGS, req.headers, [], language.name, info_detail, {
                info_detail: language.name,
                language_id: language._id
            })

            res.json({ success: true, message: LANG_MESSAGE_CODE.LANGUAGE_DELETED_SUCCESSFULLY })
        }
        else {
            res.json({ success: false, message: LANGUAGE_ERROR_CODE.LANGUAGE_NOT_FOUND })
        }


    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.uplodad_user_panel_images = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let files = req.files
        let message;
        if (files != undefined && files.length > 0) {
     
            for (const file of files) {
                let fieldname = file.fieldname;
                let file_name = '';
                if (fieldname === 'airport_transfer') {
                    file_name = constant_json.AIRPORT_TRANSFER;
                } else if (fieldname === 'bg_image') {
                    file_name = constant_json.BG_IMAGE;
                } else if (fieldname === 'cashless_rides') {
                    file_name = constant_json.CASHLESS_RIDES;
                } else if (fieldname === 'driver_going_home') {
                    file_name = constant_json.DRIVER_GOING_HOME;
                } else if (fieldname === 'extensive_range_of_cabs') {
                    file_name = constant_json.EXTENSIVE_RANGE_OF_CABS;
                } else if (fieldname === 'flexible_bookings') {
                    file_name = constant_json.FLEXIBLE_BOOKING;
                } else if (fieldname === 'licensed_drivers') {
                    file_name = constant_json.LICENSED_DRIVERS;
                } else if (fieldname === 'map') {
                    file_name = constant_json.MAP;
                } else if (fieldname === 'multiple_stop') {
                    file_name = constant_json.MULTIPLE_STOP;
                } else if (fieldname === 'rentals') {
                    file_name = constant_json.RENTALS;
                } else if (fieldname === 'ride_share') {
                    file_name = constant_json.RIDE_SHARE;
                } else if (fieldname === 'secure_and_swift_ride') {
                    file_name = constant_json.SECURE_AND_SWIFT_RIDE;
                } else if (fieldname === 'split_payment') {
                    file_name = constant_json.SPLIT_PAYMENT;
                } else if (fieldname === 'taxi_hailing') {
                    file_name = constant_json.TAXI_HAILING;
                }
                if (file_name !== '') {
                    utils.saveImageFromBrowser(req.files[0].path, file_name, 11);
                }
            }
            message = FILE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        message = FILE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_cancellation_reason = async function (req, res) {
    try {
        let params_array = [{ name: "user_type", type: 'number' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let list = await Cancel_reason.find({ user_type: req.body.user_type })
        res.json({ success: true, list: list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_cancellation_reason = async function (req, res) {
    try {
        let params_array = [{ name: "user_type", type: 'number' }, { name: 'reason', type: "object" }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cancel_reason = new Cancel_reason({
            user_type: req.body.user_type,
            reason: req.body.reason
        })
        await cancel_reason.save()

        let info_detail = "ADDED"
        let changes = [
            {
                "field": "reason",
                "oldValue": "-",
                "newValue": cancel_reason.reason
            }
        ]

        utils.addChangeLog(UPDATE_LOG_TYPE.CANCEL_REASON_SETTINGS, req.headers, changes, cancel_reason.reason[0], info_detail, {
            info_detail: cancel_reason.reason[0],
            reason_id: cancel_reason._id
        })

        res.json({ success: true, message: CANCELLATION_REASON.ADD_SUCCESSFULLY })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_cancellation_reason = async function (req, res) {
    try {
        let params_array = [{ name: "reason_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let before_update_cancel_reason = await Cancel_reason.findOne({ _id: req.body.reason_id })
        let cancel_reason = await Cancel_reason.findOneAndUpdate({ _id: req.body.reason_id }, req.body, { new: true })
        let changes = utils.getModifiedFields(before_update_cancel_reason, cancel_reason, ["updated_at"])

        utils.addChangeLog(UPDATE_LOG_TYPE.CANCEL_REASON_SETTINGS, req.headers, changes, before_update_cancel_reason.reason[0], "", {
            info_detail: cancel_reason.reason[0],
            reason_id: cancel_reason._id
        })

        res.json({ success: true, message: CANCELLATION_REASON.UPDATE_SUCCESSFULLY })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.delete_cancellation_reason = async function (req, res) {
    try {
        let params_array = [{ name: "reason_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cancel_reason = await Cancel_reason.findOneAndDelete({ _id: req.body.reason_id })

        let info_detail = "DELETED"

        utils.addChangeLog(UPDATE_LOG_TYPE.CANCEL_REASON_SETTINGS, req.headers, [], cancel_reason.reason[0], info_detail, {
            info_detail: cancel_reason.reason[0],
            reason_id: cancel_reason._id
        })

        res.json({ success: true, message: CANCELLATION_REASON.DELETE_SUCCESSFULLY })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_change_logs = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let limit = req.body.limit ? Number(req.body.limit) : 20
        let page = Number(req.body.page) - 1
        let limits = { $limit: limit }
        let skip = { $skip: page * limit }

        // filter query
        let condition = {};

        const start_date = req.body.start_date;
        const end_date = req.body.end_date;
        const user_id = req.body.user_id;
        const log_type = req.body.log_type;
        const setting_type = req.body.setting_type;

        if (start_date && end_date) {
            const startDate = moment(start_date).startOf('day').toDate();
            const endDate = moment(end_date).endOf('day').toDate();
            condition["created_at"] = { $gte: startDate }
            condition["created_at"] = { ...condition["created_at"], $lt: endDate }
        }

        if (user_id && ObjectId.isValid(user_id)) {
            condition["user_detail._id"] = ObjectId(user_id)
        }
        if (log_type && log_type !== "null") {
            condition["log_type"] = Number(log_type)
        }
        if (setting_type && setting_type !== "null") {
            condition["setting_type"] = Number(setting_type)
        }

        let lookup = {
            $lookup:
            {
                from: "admins",
                localField: "user_id",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, username: 1, type: 1, email: !req.headers.is_show_email ? HIDE_DETAILS.EMAIL : 1, } }],
                as: "user_detail"
            }
        };
        let logs = await Change_log.aggregate([lookup
            , { $match: condition },
            { $sort: { _id: -1 } },
            skip, limits])
        const total_list = await Change_log.aggregate([
            lookup,
            { $match: condition }
        ])
        let total_page = Math.ceil(total_list.length / limit);
        res.json({ success: true, logs: logs, total_page: total_page })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.fetch_guest_tokens_list = async function (req, res) {
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
        switch (page_type) {
            case '1':
                query = { 'code_expiry': { $gte: date }, state: true }
                break;
            case '2':
                query = { 'code_expiry': { $gte: date }, state: false }
                break;
            case '3':
                query = { 'code_expiry': { $lt: date } }
                break;
            default:
                query = {}
        }

        let condition = { $match: query }

        let guest_tokens_list = await guest_tokens.aggregate([condition])
        res.json({ success: true, guest_tokens_list: guest_tokens_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.add_update_guest_token_new = async function (req, res) {

    if (req.body?.id) {

        let id = req.body.id;
        if (req.body?.start_date == req.body?.code_expiry) {
            const nextDay = new Date(req.body.code_expiry);
            nextDay.setHours(23, 59, 59, 0);
            req.body.code_expiry = nextDay.toISOString()
        }
        await guest_tokens.findByIdAndUpdate(id, req.body, { new: true })
        res.json({ success: true, message: success_messages.MESSAGE_CODE_GUEAT_TOKEN_UPDATED_SUCCESSFULLY })

    } else {
        if (req.body?.start_date == req.body?.code_expiry) {
            const nextDay = new Date(req.body.code_expiry);
            nextDay.setHours(23, 59, 59, 0);
            req.body.code_expiry = nextDay.toISOString()
        }

        let add_guest_token = new guest_tokens({
            token_name: req.body.token_name,
            token_value: utils.tokenGenerator(20),
            state: req.body.state,
            start_date: req.body.start_date,
            code_expiry: req.body.code_expiry
        });

        await add_guest_token.save()
        res.json({ success: true, message: success_messages.MESSAGE_CODE_GUEAT_TOKEN_ADDED_SUCCESSFULLY })
    }

};

exports.get_admin_setting_detail = async function (req, res) {
    const setting_detail = await Settings.findOne({},{is_use_captcha:1, recaptcha_site_key_for_web:1, admin_panel_google_key:1, web_app_google_key:1 });
    res.json({ success: true, setting_detail });
}

