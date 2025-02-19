let utils = require('./utils');

exports.check_request_params = function (request_data_body, params_array, response) {
    let missing_param = '';
    let is_missing = false;
    let invalid_param = '';
    let is_invalid_param = false;
    if (request_data_body) {
        params_array.forEach(function (param) {
            if (request_data_body[param.name] == undefined) {
                missing_param = param.name;
                is_missing = true;
            } else {
                if (typeof request_data_body[param.name] !== param.type) {
                    is_invalid_param = true;
                    invalid_param = param.name;
                }
            }
        });

        if (is_missing) {
            response({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_MISSING), error_description: missing_param + ' parameter missing' });
        } else if (is_invalid_param) {
            response({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_INVALID), error_description: invalid_param + ' parameter invalid' });
        }
        else {
            response({ success: true });
        }
    }
    else {
        response({ success: true });
    }
}

exports.check_request_params_async = function (request_data_body, params_array) {
    return new Promise((resolve, reject) => {
        let missing_param = '';
        let is_missing = false;
        let invalid_param = '';
        let is_invalid_param = false;
        if (request_data_body) {
            params_array.forEach(function (param) {
                if (request_data_body[param.name] == undefined) {
                    missing_param = param.name;
                    is_missing = true;
                } else {
                    if (typeof request_data_body[param.name] !== param.type) {
                        is_invalid_param = true;
                        invalid_param = param.name;
                    }
                }
            });
            if (is_missing) {
                resolve({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_MISSING), error_description: missing_param + ' parameter missing' });
            } else if (is_invalid_param) {
                resolve({ success: false, error_code: String(error_message.ERROR_CODE_PARAMETER_INVALID), error_description: invalid_param + ' parameter invalid' });
            } else {
                resolve({ success: true });
            }
        } else {
            resolve({ success: true });
        }
    })
}

exports.error_response = function (err, res) {
    console.log(err);
    res.json({
        success: false,
        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
    });
}