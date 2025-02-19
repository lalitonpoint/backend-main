let City = require('mongoose').model('City');
let Country = require('mongoose').model('Country');
let console = require('./console');
let utils = require('./utils');

exports.citylist = async function (req, res) {
    try {
        let params_array = [{ name: 'country', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country = req.body.country;
        if (country === "") {
            let city = await City.find({ isBusiness: constant_json.YES })
            if (!city) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_CITY_LIST_FOUND, city: city });
                return
            }
            res.json({ success: true, message: success_messages.MESSAGE_CODE_GET_CITY_LIST_SUCCESSFULLY, city: city });
            return
        }
        let country_details = await Country.findOne({ countryname: country })
        if (!country_details) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND });
            return
        }
        let country_id = country_details._id;
        let city = await City.find({ countryid: country_id, isBusiness: constant_json.YES })
        if (city.length == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_CITY_LIST_FOUND, city: city });
            return
        }
        res.json({ success: true, message: success_messages.MESSAGE_CODE_GET_CITY_LIST_SUCCESSFULLY, city: city });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};