let Country = require('mongoose').model('Country');
let console = require('./console');
let utils = require('./utils');

exports.country_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let country = await Country.find({ isBusiness: constant_json.YES }).sort({ countryname: 1 })
        if (country.length == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_COUNTRY_FOUND })
            return
        }
        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_GET_COUNTRY_LIST_SUCCESSFULLY,
            country: country
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};
exports.get_all_country_details=async function (req,res){
    let country_list = require('../../country_list.json');
    res.json({ success: true, country_list: country_list });
}
exports.get_country_city_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let lookup = {
            $lookup:
            {
                from: "cities",
                localField: "_id",
                foreignField: "countryid",
                as: "city_detail"
            }
        };
        let unwind = { $unwind: "$city_detail" };
        let condition = { $match: { isBusiness: { $eq: 1 } } }
        let redact = { "$redact": { "$cond": [{ '$eq': ["$city_detail.isBusiness", 1] }, "$$KEEP", "$$PRUNE"] } }
        let group = {
            $group: {
                _id: '$_id',
                countryname: { $first: '$countryname' },
                countrycode: { $first: '$countrycode' },
                alpha2: { $first: '$alpha2' },
                countryphonecode: { $first: '$countryphonecode' },
                phone_number_min_length: { $first: '$phone_number_min_length' },
                phone_number_length: { $first: '$phone_number_length' },
                currencycode: { $first: '$currencycode' },
                is_use_wsal: {$first: '$is_use_wsal'},
                city_list: { $push: { _id: '$city_detail._id', full_cityname: '$city_detail.full_cityname', cityname: '$city_detail.cityname', cityLatLong: '$city_detail.cityLatLong' } }
            }
        }
        let country_list = await Country.aggregate([condition, lookup, unwind, redact, group])
        res.json({ success: true, country_list: country_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};


exports.countries_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let country = await Country.find({ isBusiness: constant_json.YES }, {
            "countryname": 1,
            "countryphonecode": 1,
            "phone_number_min_length": 1,
            "phone_number_length": 1,
            "flag_url": 1
        }).sort({ countryname: 1 })
        if (country.length == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_COUNTRY_FOUND })
            return
        }
        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_GET_COUNTRY_LIST_SUCCESSFULLY,
            country: country
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};