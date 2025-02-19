let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails')
let Hotel = require('mongoose').model('Hotel');
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
let Trip_history = require('mongoose').model('Trip_history');
let users = require('../../controllers/users')
let Settings = require('mongoose').model('Settings');
const {
    TYPE_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    TYPE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    SMS_TEMPLATE,
} =  require('../../controllers/constant');
exports.login = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        // code 
        let password = req.body.password;
        let hash = crypto.createHash('md5').update(password).digest('hex');
        let email = req.body.email
        let hotel = await Hotel.findOne({ email: email })
        if (!hotel) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        if (hotel.password != hash) {
            let error_code = TYPE_ERROR_CODE.PASSWORD_WRONG
            res.json({ success: false, error_code: error_code })
            return
        }
        let token = utils.tokenGenerator(32)
        hotel.token = token;
        await hotel.save()
        let message = TYPE_MESSAGE_CODE.LOGIN_SUCCESSFULLY
        res.json({ success: true, message: message, hotel: hotel })
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
        let message = TYPE_MESSAGE_CODE.LOGOUT_SUCCESSFULLY
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
        let check_captcha  = await utils.verify_captcha(req.body.captcha_token, req.body.device_type)
        if (!check_captcha.success) {
           return res.json({ success: false, error_code:error_message.ERROR_CODE_INVALID_CAPTCHA  });
        }
        // code 
        let dispatcher = await Hotel.findOne({ email: req.body.email })
        if (!dispatcher) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        let token = utils.tokenGenerator(32);
        let id = dispatcher._id;
        let link = req.get('origin') + '/hotel/reset-password?id=' + id + '&&token=' + token;
        let html = ` <a href="${link}">Click Here</a>`
        allemails.userForgotPassword(req, dispatcher, html);
        await Hotel.findOneAndUpdate({ _id: id }, { token: token })
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
        let dispatcher = await Hotel.findOne({ _id: id, token: token })
        const setting_detail = await Settings.findOne({}).select({ sms_notification: 1 });
        if (!dispatcher) {
            let error_code = TYPE_ERROR_CODE.INVALID_DATA
            res.json({ success: false, error_code: error_code })
            return
        }
        let hash = crypto.createHash('md5').update(password).digest('hex')
        dispatcher.password = hash
        dispatcher.token = utils.tokenGenerator(36)
        await dispatcher.save()
        if (setting_detail.sms_notification) {
            utils.sendSmsForOTPVerificationAndForgotPassword( dispatcher.country_phone_code + dispatcher.phone, SMS_TEMPLATE.FORGOT_PASSWORD, password )
    }
        let message = TYPE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.delete = async function (req, res) {
    try {
        let params_array = [{ name: 'hotel_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let dispatcher = await Hotel.findOne({ _id: req.body.hotel_id })
        if (!dispatcher) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        await Hotel.findByIdAndDelete(req.body.hotel_id)
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
        users.get_user_setting_detail(req,res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_country_code = async function (req, res) {
    try {
        let params_array = [{ name: 'country_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country = await Country.findOne({ _id: req.body.country_id })
        if (!country) {
            res.json({ success: false})
            return
        }
        res.json({ success: true, countryCode:country.countrycode})
    } catch (error) {
        utils.error_response(error, req, res)
    }
}