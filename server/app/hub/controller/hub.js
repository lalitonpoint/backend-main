let utils = require('../../controllers/utils');
let Hub_User = require('mongoose').model('Hub_User');
let crypto = require('crypto');
let mongoose = require('mongoose');
let users = require('../../controllers/users')
let Vehicle = require('mongoose').model('Vehicle');
const {
    TYPE_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    TYPE_ERROR_CODE,
} = require('../../utils/error_code')

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
        let hub = await Hub_User.findOne({ email: email })
        if (!hub) {
            let error_code = TYPE_ERROR_CODE.DETAIL_NOT_FOUND
            res.json({ success: false, error_code: error_code })
            return
        }
        if (hub.password != hash) {
            let error_code = TYPE_ERROR_CODE.PASSWORD_WRONG
            res.json({ success: false, error_code: error_code })
            return
        }
        let token = utils.tokenGenerator(32)
        hub.token = token;
        await hub.save()
        let message = TYPE_MESSAGE_CODE.LOGIN_SUCCESSFULLY
        res.json({ success: true, message: message, hub: hub })
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
        let dispatcher = await Hub_User.findOne({ _id: id, token: token })
        if (!dispatcher) {
            let error_code = TYPE_ERROR_CODE.INVALID_DATA
            res.json({ success: false, error_code: error_code })
            return
        }
        let hash = crypto.createHash('md5').update(password).digest('hex')
        dispatcher.password = hash
        dispatcher.token = utils.tokenGenerator(36)
        await dispatcher.save()
        let message = TYPE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
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