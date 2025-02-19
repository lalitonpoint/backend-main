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
let Provider_Document = require('mongoose').model('Provider_Document');
let Country = require('mongoose').model('Country');
let Admin = require('mongoose').model('admin');
let wallet_history = require('mongoose').model('Wallet_history');
const Transfer_history = require('mongoose').model('transfer_history');
let fs = require('fs')
let setting = require('../../admin/controller/settings')
let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails');
let bank = require('../../controllers/bank_detail')
let list = require('../../admin/controller/list')
let request = require('../../admin/controller/request');
let mongoose = require('mongoose');
let moment = require('moment')
let Schema = mongoose.Types.ObjectId;
let xl = require('excel4node');
let Settings = require('mongoose').model('Settings')
const {
    PARTNER_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    ERROR_CODE,
    PARTNER_ERROR_CODE,
} = require('../../utils/error_code')
const {
    ADMIN_NOTIFICATION_TYPE,
    SMS_TEMPLATE,
} = require('../../controllers/constant');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic')
/* PARTNER LOGIN */
exports.partner_login = async function (req, res) {
    utils.check_request_params_for_web(req.body, [{ name: "email", type: 'string' }, { name: "password", type: "string" }], async (response) => {
        try {
            let email = req.body.email
            let password = req.body.password
            // check params and type match
            if (response.success) {
                let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
                if (!check_captcha.success) {
                    return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
                }
                // find partner
                let partner = await Partner.findOne({ $or: [{ email: email }] })
                let hash = crypto.createHash('md5').update(password).digest('hex');
                let error_code;
                if (!partner) {
                    error_code = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND
                    res.json({ success: false, error_code: error_code })
                } else {
                    if (partner.password != hash) {
                        error_code = PARTNER_ERROR_CODE.PASSWORD_WRONG;
                        return res.json({ success: false, error_code: error_code })
                    }

                    if (partner.is_approved !== 1) {
                        error_code = PARTNER_ERROR_CODE.PARTNER_NOT_APPROVE;
                        return res.json({ success: false, error_code: error_code })
                    }

                    let partner_vehicle_documents = await Partner_Vehicle_Document.find({ partner_id: partner._id, option: 1, is_uploaded: 0, is_visible: true })

                    if (partner_vehicle_documents.length > 0) {
                        partner.is_vehicle_document_uploaded = 0
                    } else {
                        partner.is_vehicle_document_uploaded = 1
                    }

                    partner.token = utils.tokenGenerator(32);
                    await partner.save();
                    let message = PARTNER_MESSAGE_CODE.LOGIN_SUCCESSFULLY;
                    res.json({ success: true, message: message, partnerDetail: partner })
                }
            } else {
                res.json(response)
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}

/* SIGN OUT */
exports.partner_sign_out = function (req, res) {
    try {
        if (req.body.is_admin_decline) {
            let message = ERROR_CODE.DECLINE_BY_ADMIN
            res.json({ success: true, error_code: message })
            return
        }
        let message = PARTNER_MESSAGE_CODE.LOGOUT_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

//forgot_password
exports.partner_forgot_password = function (req, res) {

    utils.check_request_params_for_web(req.body, [{ name: "email", type: 'string' }], async (response) => {
        try {
            let email = req.body.email
            if (response.success) {
                // find partner
                let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
                if (!check_captcha.success) {
                    return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
                }
                let partner = await Partner.findOne({ email: email })
                if (!partner) {
                    let error_code = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND
                    res.json({ success: false, error_code: error_code })
                } else {
                    let token = utils.tokenGenerator(32);
                    let id = partner._id;
                    let link = req.get('origin') + '/partner/reset-password?id=' + id + '&&token=' + token;
                    let html = ` <a href="${link}">Click Here</a>`
                    allemails.userForgotPassword(req, partner, html);
                    await Partner.findOneAndUpdate({ _id: id }, { token: token })
                    let message = PARTNER_MESSAGE_CODE.SEND_LINK_SUCCESSFULLY;
                    res.json({ success: true, message: message })

                }
            } else {
                res.json(response)
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}


/* UPDATE FORGOT PASSWORD */
exports.partner_update_password = async function (req, res) {
    utils.check_request_params_for_web(req.body, [{ name: "password", type: "string" }], async function (response) {
        try {
            let query = {}
            query['_id'] = req.body.id
            query['token'] = req.body.token
            let password = req.body.password
            req.body.password = crypto.createHash('md5').update(password).digest('hex')
            req.body.token = ''
            if (response.success) {
                let update_password = await Partner.findOneAndUpdate(query, req.body, { new: true })
                const setting_detail = await Settings.findOne({}).select({ sms_notification: 1 });

                if (!update_password) {
                    let error_code = ERROR_CODE.TOKEN_EXPIRED;
                    res.json({ success: false, error_code: error_code })
                } else {

                    if (setting_detail.sms_notification) {
                        utils.sendSmsForOTPVerificationAndForgotPassword( update_password.country_phone_code + update_password.phone, SMS_TEMPLATE.FORGOT_PASSWORD, password )
                    }
                    let message = PARTNER_MESSAGE_CODE.UPDATE_PASSWORD_SUCCESSFULLY;
                    res.json({ success: true, message: message })
                }
            } else {
                res.json(response)
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}


/* ADD PARTNER */
exports.add_new_partner = async function (req, res) {
    let params_array = [{ name: 'phone', type: 'string' }, { name: 'email', type: 'string' }, { name: 'password', type: 'string' }]
    utils.check_request_params(req.body, params_array, async (response) => {
        try {
            let email = req.body.email.trim().toLowerCase()
            let phone = req.body.phone
            let country_phone_code = req.body.country_phone_code
            if (response.success) {
                let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
                if (!check_captcha.success) {
                    return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
                }
                let old_partner_phone = await Partner.findOne({ phone: phone,country_phone_code:country_phone_code })
                let old_partner_email = await Partner.findOne({ email: email })
                let error_code
                let message
                if (old_partner_phone) {
                    error_code = PARTNER_ERROR_CODE.PHONE_ALREADY_REGISTERED
                    return res.json({ success: false, error_code: error_code })
                }
                if (old_partner_email) {
                    error_code = PARTNER_ERROR_CODE.EMAIL_ALREADY_REGISTERED
                    return res.json({ success: false, error_code: error_code })
                }
                function randomValueHex(Len) {
                    return crypto.randomBytes(Math.ceil(Len / 2)).
                        toString('hex').
                        slice(0, Len);
                }
                let referral_code = randomValueHex(6);

                let password = req.body.password
                let hash = crypto.createHash('md5').update(password).digest('hex')

                let first_name = req.body.first_name;
                first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);

                let last_name = req.body.last_name;
                last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);

                let partner_company_name = req.body.partner_company_name;
                partner_company_name = partner_company_name.charAt(0).toUpperCase() + partner_company_name.slice(1);

                let token = utils.tokenGenerator(32);

                let code = req.body.country_phone_code;
                let code_name = code.split(' ');
                let country_code = code_name[0];
                let country_name = "";
                for (let i = 1; i <= (code_name.length) - 1; i++) {

                    country_name = country_name + " " + code_name[i];
                }
                let country = await Country.findById(req.body.country_id)

                let partner = new Partner({
                    first_name: first_name,
                    last_name: last_name,
                    email: ((req.body.email).trim()).toLowerCase(),
                    country_phone_code: country_code,
                    phone: req.body.phone,
                    password: hash,
                    address: req.body.address,
                    city: req.body.city,
                    country_id: req.body.country_id,
                    city_id: req.body.city_id,
                    wallet_currency_code: req.body.wallet_currency_code,
                    country: country?.countryname,
                    partner_company_name: partner_company_name,
                    is_approved: 0,
                    wallet: 0,
                    token: token,
                    referral_code: referral_code
                });

                let file_list_size = 0;
                let files_details = req.files;
                if (files_details && files_details.length > 0) { // Checking if files_details is not null or undefined and has items

                    file_list_size = files_details.length;

                    let file_data;
                    let file_id;
                    for (let i = 0; i < file_list_size; i++) {

                        file_data = files_details[i];
                        file_id = file_data.fieldname;

                        if (file_id == 'idproof') {
                            let image_name = partner._id + utils.tokenGenerator(5);
                            let url = utils.getImageFolderPath(req, 8) + image_name + '.jpg';
                            partner.government_id_proof = url
                            utils.saveImageFromBrowser(req.files[i].path, image_name + '.jpg', 8);
                        }

                        if (file_id == 'pictureData') {
                            let image_name = partner._id + utils.tokenGenerator(4);
                            let url = utils.getImageFolderPath(req, 7) + image_name + '.jpg';
                            partner.picture = url;
                            utils.saveImageFromBrowser(req.files[i].path, image_name + '.jpg', 7);
                        }
                    }


                    await partner.save()
                    let email_notification = setting_detail.email_notification;
                    if (email_notification) {
                        allemails.sendPartnerRegisterEmail(req, partner, partner.first_name + " " + partner.last_name);
                    }
                    message = PARTNER_MESSAGE_CODE.REGISTER_SCUUCESSFULLY;
                    res.json({ success: true, message: message })

                    // Trigger admin notification
                    utils.addNotification({
                        type: ADMIN_NOTIFICATION_TYPE.PARTNER_REGISTERED,
                        user_id: partner._id,
                        username: partner.first_name + " " + partner.last_name,
                        picture: partner.picture,
                        country_id: partner.country_id,
                        city_id: partner.city_id,
                        user_unique_id: partner.unique_id,
                    })
                }
            } else {
                res.json(response)
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}

/* update partner */
exports.update_partner_details = function (req, res) {
    utils.check_request_params_for_web(req.body, [{ name: 'id', type: 'string' }, { name: 'phone', type: 'string' }, { name: 'email', type: 'string' }, { name: 'password', type: 'string' }], async function (response) {
        try {
            let id = req.body.id
            let phone = req.body.phone
            let password = req.body.password
            let country_phone_code = req.body.country_phone_code
            let hash = crypto.createHash('md5').update(password).digest('hex')
            let new_password = req.body.new_password
            let new_password_hash;
            let email = req.body.email;
            if (new_password) {
                new_password_hash = crypto.createHash('md5').update(new_password).digest('hex')
            }

            let old_partner_phone = await Partner.findOne({ _id: { $ne: id }, phone: phone, country_phone_code: country_phone_code })
            let old_partner_email = await Partner.findOne({ _id: { $ne: id }, email: email })
            let message
            let error_code
            if (old_partner_phone) {
                error_code = PARTNER_ERROR_CODE.PHONE_ALREADY_REGISTERED
                return res.json({ success: false, error_code: error_code })
            }
            if (old_partner_email) {
                error_code = PARTNER_ERROR_CODE.EMAIL_ALREADY_REGISTERED
                res.json({ success: false, error_code: error_code })
            } else {
                let findPartner = await Partner.findOne({ _id: id })
                if (findPartner) {
                    if (findPartner.password != hash) {
                        message = PARTNER_ERROR_CODE.PASSWORD_WRONG;
                        res.json({ success: false, message: message })
                    } else {
                        if (req.body.new_password != '') {
                            req.body.password = new_password_hash
                        } else {
                            req.body.password = hash
                        }

                        let file_list_size = 0;
                        let files_details = req.files;
                        if (files_details && files_details.length > 0) { // Checking if files_details is not null or undefined and has items

                            file_list_size = files_details.length;

                            let file_data;
                            let file_id;
                            for (let i = 0; i < file_list_size; i++) {

                                file_data = files_details[i];
                                file_id = file_data.fieldname;

                                if (file_id == 'idproof') {
                                    let image_name = findPartner._id + utils.tokenGenerator(5);
                                    let url = utils.getImageFolderPath(req, 8) + image_name + '.jpg';
                                    findPartner.government_id_proof = url;
                                    utils.saveImageFromBrowser(req.files[i].path, image_name + '.jpg', 8);
                                    utils.deleteImageFromFolder(findPartner.government_id_proof, 2);
                                }

                                if (file_id == 'pictureData') {
                                    let image_name = findPartner._id + utils.tokenGenerator(4);
                                    let url = utils.getImageFolderPath(req, 7) + image_name + '.jpg';
                                    findPartner.picture = url;
                                    utils.saveImageFromBrowser(req.files[i].path, image_name + '.jpg', 7);
                                    utils.deleteImageFromFolder(findPartner.picture, 2);
                                }
                            }
                        }
                        let updatePartner = await Partner.findOneAndUpdate({ _id: id }, { ...req.body, government_id_proof: findPartner.government_id_proof, picture: findPartner.picture }, { new: true })
                        message = PARTNER_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
                        res.json({ success: true, message: message, Partner_detail: updatePartner })
                    }
                } else {
                    res.json({ success: false })
                }
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}


/* delete partner */
exports.delete_partner = function (req, res) {
    utils.check_request_params_for_web(req.body, [{ name: 'partner_id', type: 'string' }, { name: 'password', type: 'string' }], async function (response) {
        try {
            let password = req.body.password
            let hash = crypto.createHash('md5').update(password).digest('hex')
            let partner = await Partner.findOne({ _id: req.body.partner_id })
            let message
            if (partner) {
                if (partner.password != hash) {
                    message = PARTNER_ERROR_CODE.PASSWORD_WRONG;
                    res.json({ success: false, message: message })
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
                await Transfer_history.deleteMany({ user_id: partner._id });

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

                message = PARTNER_MESSAGE_CODE.DELETE_SUCCESSFULLY;
                res.json({ success: true, message: message })

            } else {
                message = PARTNER_MESSAGE_CODE.DETAIL_NOT_FOUND;
                res.json({ success: false, message: message })
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}


/* get partner */
exports.get_partner_details = function (req, res) {
    utils.check_request_params_for_web(req.body, [{ name: 'partner_id', type: 'string' }], async function (response) {
        try {
            let partner = await Partner.findOne({ _id: req.body.partner_id }).lean()
            let message
            if (partner) {
                
                let country = await Country.findById(partner.country_id)
                if(!country){
                    message = PARTNER_MESSAGE_CODE.DETAIL_NOT_FOUND;
                    res.json({ success: false, message: message })
                }
                
                partner.driver_minimum_point_require_for_withdrawal = country?.driver_redeem_settings[0]?.driver_minimum_point_require_for_withdrawal
                partner.driver_redeem_point_value = country?.driver_redeem_settings[0]?.driver_redeem_point_value
                partner.is_auto_transfer = country.is_auto_transfer
                
                message = PARTNER_MESSAGE_CODE.GET_DETAILS_SUCCESSFULLY;
                res.json({ success: true, message: message, partner })
            } else {
                message = PARTNER_MESSAGE_CODE.DETAIL_NOT_FOUND;
                res.json({ success: false, message: message })
            }
        } catch (error) {
            utils.error_response(error, req, res)
        }
    })
}

exports.add_bank_details = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'token', type: 'string' }, { name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        bank.add_bank_detail(req, res)
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_bank_details = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'token', type: 'string' }, { name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        bank.get_bank_detail(req, res)
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.delete_banke_details = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'token', type: 'string' }, { name: 'type', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        bank.delete_bank_detail(req, res)
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.wallet_history = async function (req, res) {
    try {
        let params_array = [{ name: 'partner_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let wallet_history = await Wallet_history.find({ user_id: req.body.partner_id })
        res.json({ success: true, wallet_history: wallet_history })
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
            return;
        }
        // code 
        list.add_wallet_amount(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.earning_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let start_date;
        let end_date;
        let search_item
        let search_value
        if (req.body.search_value == undefined) {
            search_item = 'provider_detail.first_name';
            search_value = '';
        } else {
            search_item = req.body.search_item;
            search_value = req.body.search_value;
        }
        let week_start_date_view = "";
        let week_end_date_view = "";
        if (req.body.weekly_filter != undefined) {

            let weekDuration = req.body.weekly_filter;
            weekDuration = weekDuration.split('-');

            week_start_date_view = weekDuration[0];
            week_end_date_view = weekDuration[1];

            start_date = new Date(week_start_date_view);
            end_date = new Date(week_end_date_view);

            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        } else {

            let today = new Date();
            end_date = new Date(today.setDate(today.getDate() + 6 - today.getDay()));
            today = new Date(end_date);
            start_date = new Date(today.setDate(today.getDate() - 6));

            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        }
        let lookup = {
            $lookup:
            {
                from: "providers",
                localField: "_id",
                pipeline: [{ $project: { _id: 1, first_name: 1, last_name: 1, unique_id: 1, phone: 1, wallet_currency_code: 1, country_phone_code: 1 } }],
                foreignField: "_id",
                as: "provider_detail"
            }
        };
        let value = search_value;
        value = value.trim();
        value = value.replace(/ +(?= )/g, '');
        let search = {}
        if (search_item == "provider_detail.first_name") {
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};

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
            search = { "$match": {} };
            search["$match"][search_item] = { $regex: value };
        }
        let trip_filter = { "$match": {} };
        trip_filter["$match"]['complete_date_in_city_timezone'] = { $gte: start_date, $lt: end_date };

        let sort = { "$sort": {} };
        sort["$sort"]['provider_trip_end_time'] = parseInt(-1);
        let count = { $group: { _id: null, data: { $push: '$$ROOT' } } };
        let skip = {};
        let page = req.body.page
        skip["$skip"] = page * 10;
        let limit = {};
        limit["$limit"] = 10;
        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };
        let provider_type_condition = { $match: { 'provider_type': Number(constant_json.PROVIDER_TYPE_PARTNER) } };
        let provider_weekly_analytic_data = {};
        let provider_type_id_condition = { $match: { 'provider_type_id': mongoose.Types.ObjectId(req.body.partner_id) } };

        let trip_group_condition = {
            $group: {
                _id: '$provider_id',
                total_trip: { $sum: 1 },
                completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                total: { $sum: '$total' },
                provider_have_cash: { $sum: '$provider_have_cash' },
                provider_service_fees: { $sum: '$provider_service_fees' },
                pay_to_provider: { $sum: '$pay_to_provider' }
            }
        }

        let array = await Trip_history.aggregate([trip_condition, provider_type_condition, provider_type_id_condition, trip_filter, trip_group_condition, lookup, search, count])
        if (array.length == 0) {
            array = [];
            res.json({ detail: array, provider_weekly_analytic: provider_weekly_analytic_data });
            return
        }
        let pages = Math.ceil(array[0].total / 10);
        let arrays = await Trip_history.aggregate([trip_condition, provider_type_condition, provider_type_id_condition, trip_filter, trip_group_condition, lookup, search, count, skip, limit])
        let trip_group_condition_total = {
            $group: {
                _id: null,
                total_trip: { $sum: 1 },
                completed_trip: { $sum: { $cond: [{ $eq: ["$is_trip_completed", 1] }, 1, 0] } },
                total: { $sum: '$total' },
                promo_payment: { $sum: '$promo_payment' },
                card_payment: { $sum: '$card_payment' },
                cash_payment: { $sum: '$cash_payment' },
                wallet_payment: { $sum: '$wallet_payment' },
                admin_earning: { $sum: { $subtract: ['$total', '$provider_service_fees'] } },
                admin_earning_in_currency: { $sum: { $subtract: ['$total_in_admin_currency', '$provider_service_fees_in_admin_currency'] } },
                provider_earning: { $sum: '$provider_service_fees' },
                provider_have_cash: { $sum: '$provider_have_cash' },
                pay_to_provider: { $sum: '$pay_to_provider' }
            }
        }
        let trip_total = await Trip_history.aggregate([trip_condition, provider_type_condition, provider_type_id_condition, trip_filter, trip_group_condition_total])
        res.json({ pages: pages, detail: arrays, provider_weekly_analytic: provider_weekly_analytic_data, trip_total: trip_total })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.partner_earning_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let partner_id = req.body.partner_id;
        let start_date = new Date(req.body.week_start_date);
        let end_date = new Date(req.body.week_end_date);

        start_date = start_date.setHours(0, 0, 0, 0);
        start_date = new Date(start_date);
        end_date = end_date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);


        let provider_match_condition = { $match: { partner_id: { $eq: Schema(partner_id) } } };
        let provider_daily_analytic_data = [];

        let date_for_tag = new Date(start_date);
        for (let i = 0; i < 7; i++) {
            provider_daily_analytic_data.push(moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY));
            date_for_tag = moment(date_for_tag).add(1, 'days');
        }

        let provider_daily_analytic_query = { $match: { date_tag: { $in: provider_daily_analytic_data } } }
        let group_analytic_data_condition = {
            $group: {
                _id: null,
                received: { $sum: '$received' },
                accepted: { $sum: '$accepted' },
                rejected: { $sum: '$rejected' },
                not_answered: { $sum: '$not_answered' },
                cancelled: { $sum: '$cancelled' },
                completed: { $sum: '$completed' },
                acception_ratio: { $sum: '$acception_ratio' },
                rejection_ratio: { $sum: '$rejection_ratio' },
                cancellation_ratio: { $sum: '$cancellation_ratio' },
                completed_ratio: { $sum: '$completed_ratio' },
                total_online_time: { $sum: '$total_online_time' }
            }
        }

        let cond1 = { $match: { provider_type_id: { $eq: Schema(partner_id) } } }
        let proj1 = {
            $project: {
                _id: 1
            }
        }
        let partner_provider_list = await Provider.aggregate([cond1, proj1])
        let provider_ids = []
        partner_provider_list.forEach(provider => {
            provider_ids.push(provider._id)
        })
        provider_match_condition = { $match: { provider_id: { $in: provider_ids } } };

        let provider_daily_analytic = await Provider_daily_analytic.aggregate([provider_match_condition, provider_daily_analytic_query, group_analytic_data_condition])

        if (provider_daily_analytic.length > 0) {
            provider_daily_analytic_data = provider_daily_analytic[0];
            if ((Number(provider_daily_analytic_data.received)) > 0) {
                let received = provider_daily_analytic_data.received;
                provider_daily_analytic_data.acception_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.accepted * 100) / received));
                provider_daily_analytic_data.cancellation_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.cancelled * 100) / received));
                provider_daily_analytic_data.completed_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.completed * 100) / received));
                provider_daily_analytic_data.rejection_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.rejected * 100) / received));
            }
        }

        let provider_condition = { $match: { provider_type_id: { $eq: Schema(partner_id) } } };

        let filter = { "$match": {} };
        filter["$match"]['complete_date_in_city_timezone'] = { $gte: start_date, $lt: end_date };

        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

        let trip_group_condition = {
            $group: {
                _id: '$provider._id',
                total_distance: { $sum: '$total_distance' },
                total_time: { $sum: '$total_time' },
                total_waiting_time: { $sum: '$total_waiting_time' },
                total_service_surge_fees: { $sum: '$surge_fee' },
                service_total: { $sum: '$total_after_surge_fees' },
                total_cancellation_fees: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_trip_cancelled_by_user', 1] }, { '$gt': ['$pay_to_provider', 0] }] }, '$total_service_fees', 0] } },
                total_provider_tax_fees: { $sum: '$provider_tax_fee' },
                total_provider_miscellaneous_fees: { $sum: '$provider_miscellaneous_fee' },
                total_toll_amount: { $sum: '$toll_amount' },
                total_tip_amount: { $sum: '$tip_amount' },
                total_provider_service_fees: { $sum: '$provider_service_fees' },
                total_provider_have_cash: { $sum: { '$cond': [{ '$eq': ['$payment_mode', 1] }, '$cash_payment', 0] } },
                total_deduct_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, { '$ne': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 1] }] }, '$provider_income_set_in_wallet', 0] } },
                total_added_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, {$or: [{ '$eq': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 0] } ]} ] }, '$provider_income_set_in_wallet', 0] } },
                total_paid_in_wallet_payment: { $sum: { '$cond': [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, '$provider_income_set_in_wallet', 0] } },
                total_transferred_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', true] }] }, '$pay_to_provider', 0] } },
                total_pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },
                currency: { $first: '$currency' },
                unit: { $first: '$unit' },
                created_at:{ $first: '$created_at'},
                statement_number: { $first: '$invoice_number' },
            }
        }
        let trips = await Trip_history.aggregate([provider_condition, trip_condition, filter, trip_group_condition])

        if (trips.length == 0) {
            trips = {};
            res.json({ sucess: true, detail: trips, type: req.body.type, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });
        } else {
            res.json({ sucess: true, detail: trips[0], type: req.body.type, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });
        }

        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.complete_request = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        request.get_trip_list(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.statement_earning = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let query = {};
        query['_id'] = req.body.provider_id;

        let start_date = new Date(req.body.week_start_date);
        let end_date = new Date(req.body.week_end_date);

        start_date = start_date.setHours(0, 0, 0, 0);
        start_date = new Date(start_date);
        end_date = end_date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);

        let provider = await Provider.findOne(query);

        let provider_match_condition = { $match: { 'provider_id': { $eq: provider._id } } };
        let provider_daily_analytic_datas = [];
        let date_for_tag = new Date(start_date);
        let date_string = '';
        for (let i = 0; i < 7; i++) {
            if (i == 0) {
                date_string = date_string + moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY)
            }
            if (i == 6) {
                date_string = date_string + ' - ' + moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY)
            }
            provider_daily_analytic_datas.push(moment(date_for_tag).format(constant_json.DATE_FORMAT_MMM_D_YYYY));
            date_for_tag = moment(date_for_tag).add(1, 'days');
        }

        let provider_daily_analytic_query = { $match: { date_tag: { $in: provider_daily_analytic_datas } } }
        let group_analytic_data_condition = {
            $group: {
                _id: null,
                received: { $sum: '$received' },
                accepted: { $sum: '$accepted' },
                rejected: { $sum: '$rejected' },
                not_answered: { $sum: '$not_answered' },
                cancelled: { $sum: '$cancelled' },
                completed: { $sum: '$completed' },
                acception_ratio: { $sum: '$acception_ratio' },
                rejection_ratio: { $sum: '$rejection_ratio' },
                cancellation_ratio: { $sum: '$cancellation_ratio' },
                completed_ratio: { $sum: '$completed_ratio' },
                total_online_time: { $sum: '$total_online_time' }
            }
        }

        let provider_daily_analytic = await Provider_daily_analytic.aggregate([provider_match_condition, provider_daily_analytic_query, group_analytic_data_condition])
        let provider_daily_analytic_data = {};
        if (provider_daily_analytic.length > 0) {
            provider_daily_analytic_data = provider_daily_analytic[0];
            if ((Number(provider_daily_analytic_data.received)) > 0) {
                let received = provider_daily_analytic_data.received;
                provider_daily_analytic_data.acception_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.accepted * 100) / received));
                provider_daily_analytic_data.cancellation_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.cancelled * 100) / received));
                provider_daily_analytic_data.completed_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.completed * 100) / received));
                provider_daily_analytic_data.rejection_ratio = utils.precisionRoundTwo(Number((provider_daily_analytic_data.rejected * 100) / received));
            }
        }

        let provider_condition = { $match: { 'provider_id': provider._id } };
        let filter = { "$match": {} };
        filter["$match"]['complete_date_in_city_timezone'] = { $gte: start_date, $lt: end_date };

        let trip_condition = { 'is_trip_completed': 1 };
        let trip_condition_new = { $and: [{ 'is_trip_cancelled_by_user': 1 }, { 'pay_to_provider': { $gt: 0 } }] };
        trip_condition = { $match: { $or: [trip_condition, trip_condition_new] } };

        let trip_group_condition = {
            $group: {
                _id: '$provider._id',
                total_distance: { $sum: '$total_distance' },
                total_time: { $sum: '$total_time' },
                total_waiting_time: { $sum: '$total_waiting_time' },
                total_service_surge_fees: { $sum: '$surge_fee' },
                service_total: { $sum: '$total_after_surge_fees' },
                total_cancellation_fees: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_trip_cancelled_by_user', 1] }, { '$gt': ['$pay_to_provider', 0] }] }, '$total_service_fees', 0] } },

                total_provider_tax_fees: { $sum: '$provider_tax_fee' },
                total_provider_miscellaneous_fees: { $sum: '$provider_miscellaneous_fee' },
                total_toll_amount: { $sum: '$toll_amount' },
                total_tip_amount: { $sum: '$tip_amount' },
                total_provider_service_fees: { $sum: '$provider_service_fees' },

                total_provider_have_cash: { $sum: { '$cond': [{ '$eq': ['$payment_mode', 1] }, '$cash_payment', 0] } },
                total_deduct_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, { '$ne': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 1] }] }, '$provider_income_set_in_wallet', 0] } },
                                total_added_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, {$or: [{ '$eq': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 0] } ]} ] }, '$provider_income_set_in_wallet', 0] } },
                                total_paid_in_wallet_payment: { $sum: { '$cond': [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, '$provider_income_set_in_wallet', 0] } },
                total_transferred_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', true] }] }, '$pay_to_provider', 0] } },
                total_pay_to_provider: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', false] }, { '$eq': ['$is_transfered', false] }] }, '$pay_to_provider', 0] } },

                currency: { $first: '$currency' },
                unit: { $first: '$unit' },
                statement_number: { $first: '$invoice_number' },
            }
        }
        let array = await Trip_history.aggregate([provider_condition, trip_condition, filter, trip_group_condition]);
        res.json({ detail: array[0], date_string: date_string, type: req.body.type, provider_daily_analytic_data: provider_daily_analytic_data, moment: moment });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.request_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        request.get_trip_detail(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.pranter_document_update = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.query, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        list.type_update_document(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

function partner_pro_generate_excel(req, res, array, timezone) {

    let date = new Date()
    let time = date.getTime()
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('sheet1');
    let col = 1;

    ws.cell(1, col++).string(req.__('title_id'));
    ws.cell(1, col++).string(req.__('title_name'));
    ws.cell(1, col++).string(req.__('title_email'));
    ws.cell(1, col++).string(req.__('title_phone'));
    ws.cell(1, col++).string(req.__('title_total_request'));
    ws.cell(1, col++).string(req.__('title_completed_request'));
    ws.cell(1, col++).string(req.__('title_cancelled_request'));
    ws.cell(1, col++).string(req.__('title_accepted_request'));
    ws.cell(1, col++).string(req.__('title_city'));
    ws.cell(1, col++).string(req.__('title_car'));
    ws.cell(1, col++).string(req.__('title_app_version'));
    ws.cell(1, col++).string(req.__('title_registered_date'));

    array.forEach(function (data, index) {
        col = 1;
        ws.cell(index + 2, col++).number(data.unique_id);
        ws.cell(index + 2, col++).string(data.first_name + ' ' + data.last_name);
        ws.cell(index + 2, col++).string(data.email);
        ws.cell(index + 2, col++).string(data.country_phone_code + data.phone);
        ws.cell(index + 2, col++).number(data.total_request);
        ws.cell(index + 2, col++).number(data.completed_request);
        ws.cell(index + 2, col++).number(data.cancelled_request);
        ws.cell(index + 2, col++).number(data.accepted_request);
        ws.cell(index + 2, col++).string(data.city);
        ws.cell(index + 2, col++).string(data.service_type_name);
        ws.cell(index + 2, col++).string(data.device_type + '-' + data.app_version);
        ws.cell(index + 2, col++).string(moment(data.created_at).tz(timezone).format("DD MMM 'YY") + ' ' + moment(data.created_at).tz(timezone).format("hh:mm a"));

        if (index == array.length - 1) {
            wb.write('data/xlsheet/' + time + '_partner_providers.xlsx', function (err) {
                if (err) {
                    console.error(err);
                } else {
                    let url = req.protocol + "://" + req.get('host') + "/xlsheet/" + time + "_partner_providers.xlsx";
                    res.json(url);
                    setTimeout(function () {
                        fs.unlink('data/xlsheet/' + time + '_partner_providers.xlsx', function () {
                        });
                    }, 10000)
                }
            });
        }
    })
}