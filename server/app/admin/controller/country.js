let Country = require('mongoose').model('Country');
let utils = require('../../controllers/utils');
let country_list = require('../../../country_list.json');
let Settings = require('mongoose').model('Settings');
const {
    COUNTRY_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    COUNTRY_ERROR_CODE,
} = require('../../utils/error_code')
const {
    COLLECTION,
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');

/* FETCH COUNTRY */
exports.fetch_country_details = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.COUNTRY, req.headers)
        
        let country_list = await Country.find(country_city_condition).sort({ countryname: 1})
        res.json({ success: true, country_list: country_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* ADD COUNTRY */
exports.add_country_details = async function (req, res) {
    try {
        let params_array = [{ name: 'countryname', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const setting_detail = await Settings.findOne({});
        if (req.body.payment_gateways == null) {
            req.body.payment_gateways = []
        }
        let countryname = req.body.countryname.replace(/'/g, '');
        countryname = countryname.replace(/-/g, ' ');

        let index = country_list.findIndex(i => i.alpha2 == req.body.alpha2)
        if (index != -1) {
            req.body.currencycode = country_list[index].currency_code
            req.body.currencysign = country_list[index].sign
            req.body.countryphonecode = country_list[index].code
        }

        if(!setting_detail.is_wsal_service_use && req.body.is_use_wsal){
            req.body.is_use_wsal = false;
        }

        let country = new Country({
            countryname: countryname,
            countrycode: req.body.countrycode,
            alpha2: req.body.alpha2,
            currency: req.body.currency,
            flag_url: '',
            currencycode: req.body.currencycode,
            currencysign: req.body.currencysign,
            countrytimezone: req.body.countrytimezone,
            country_all_timezone: req.body.country_all_timezone,
            payment_gateways: req.body.payment_gateways,
            countryphonecode: req.body.countryphonecode,
            isBusiness: req.body.isBusiness,
            referral_bonus_to_user: req.body.referral_bonus_to_user,
            bonus_to_providerreferral: req.body.bonus_to_providerreferral,
            referral_bonus_to_provider: req.body.referral_bonus_to_provider,
            bonus_to_userreferral: req.body.bonus_to_userreferral,
            phone_number_min_length: req.body.phone_number_length,
            phone_number_length: req.body.phone_number_length,
            is_referral: req.body.is_referral,
            userreferral: req.body.userreferral,
            is_provider_referral: req.body.is_provider_referral,
            providerreferral: req.body.providerreferral,
            default_selected: req.body.default_selected,
            is_auto_transfer: req.body.is_auto_transfer,
            auto_transfer_day: req.body.auto_transfer_day,
            countryLatLong : req.body.countryLatLong,
            is_send_money_for_user: req.body.is_send_money_for_user,
            is_send_money_for_provider: req.body.is_send_money_for_provider,
            is_use_wsal: req.body.is_use_wsal
        });

        const user_redeem_point_data = {
            is_user_redeem_point_reward_on: req.body.is_user_redeem_point_reward_on,
            trip_redeem_point: req.body.trip_redeem_point,
            tip_redeem_point: req.body.tip_redeem_point,
            referring_redeem_point_to_user: req.body.referring_redeem_point_to_user,
            referring_redeem_point_to_users_friend: req.body.referring_redeem_point_to_users_friend,
            user_review_redeem_point: req.body.user_review_redeem_point,
            user_redeem_point_value: req.body.user_redeem_point_value,
            user_minimum_point_require_for_withdrawal: req.body.user_minimum_point_require_for_withdrawal
          };

        const driver_redeem_point_data = {
            is_driver_redeem_point_reward_on: req.body.is_driver_redeem_point_reward_on,
            daily_completed_trip_count_for_redeem_point: req.body.daily_completed_trip_count_for_redeem_point,
            daily_accepted_trip_count_for_redeem_point: req.body.daily_accepted_trip_count_for_redeem_point,
            rating_average_count_for_redeem_point: req.body.rating_average_count_for_redeem_point,
            daily_completed_trip_redeem_point: req.body.daily_completed_trip_redeem_point,
            daily_accepted_trip_redeem_point: req.body.daily_accepted_trip_redeem_point,
            high_rating_redeem_point: req.body.high_rating_redeem_point,
            driver_review_redeem_point: req.body.driver_review_redeem_point,
            driver_redeem_point_value: req.body.driver_redeem_point_value,
            driver_minimum_point_require_for_withdrawal:req.body.driver_minimum_point_require_for_withdrawal
        };

        country.user_redeem_settings.push(user_redeem_point_data)
        country.driver_redeem_settings.push(driver_redeem_point_data)

        country.flag_url = '/flags/' + (req.body.countryname).split(' ').join('_').toLowerCase() + '.gif'

        await country.save()
        let message = COUNTRY_MESSAGE_CODE.ADD_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* UPDATE COUNTRY DETAILS */
exports.update_country_details = async function (req, res) {
    try {
        let params_array = [{ name: 'country_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.country_id
        if(req.body.redeem_settings){
            const user_redeem_point_data = {
                is_user_redeem_point_reward_on: req.body.is_user_redeem_point_reward_on,
                trip_redeem_point: req.body.trip_redeem_point,
                tip_redeem_point: req.body.tip_redeem_point,
                referring_redeem_point_to_user: req.body.referring_redeem_point_to_user,
                referring_redeem_point_to_users_friend: req.body.referring_redeem_point_to_users_friend,
                user_review_redeem_point: req.body.user_review_redeem_point,
                user_redeem_point_value: req.body.user_redeem_point_value,
                user_minimum_point_require_for_withdrawal: req.body.user_minimum_point_require_for_withdrawal

              };
    
            const driver_redeem_point_data = {
                is_driver_redeem_point_reward_on: req.body.is_driver_redeem_point_reward_on,
                daily_completed_trip_count_for_redeem_point: req.body.daily_completed_trip_count_for_redeem_point,
                daily_accepted_trip_count_for_redeem_point: req.body.daily_accepted_trip_count_for_redeem_point,
                rating_average_count_for_redeem_point: req.body.rating_average_count_for_redeem_point,
                daily_completed_trip_redeem_point: req.body.daily_completed_trip_redeem_point,
                daily_accepted_trip_redeem_point: req.body.daily_accepted_trip_redeem_point,
                high_rating_redeem_point: req.body.high_rating_redeem_point,
                driver_review_redeem_point: req.body.driver_review_redeem_point,
                driver_redeem_point_value: req.body.driver_redeem_point_value,
                driver_minimum_point_require_for_withdrawal:req.body.driver_minimum_point_require_for_withdrawal

            };
            req.body.user_redeem_settings = []
            req.body.driver_redeem_settings = []
            req.body.user_redeem_settings.push(user_redeem_point_data)
            req.body.driver_redeem_settings.push(driver_redeem_point_data)
        }

        if (req.body.countryphonecode) {
            delete req.body.countryphonecode
        }
        if (req.body.currencycode) {
            delete req.body.currencycode
        }
        if (req.body.currencysign) {
            delete req.body.currencysign
        }
              
        let old_data = await Country.findById(id)
        let new_data = await Country.findByIdAndUpdate(id, req.body,{new:true}) 

        let changes = utils.getModifiedFields(old_data, new_data ,['_id'])
        
        if(changes.length > 0){
            utils.addChangeLog(UPDATE_LOG_TYPE.COUNTRY_SETTINGS, req.headers, changes, old_data.countryname, "",{
                country_id:old_data._id
            })
        }

        let message = COUNTRY_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* ALL COUNTRY LIST JSON DATA */
exports.get_country_json_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country_list = require('../../../country_list.json');
        res.json({ success: true, country_list: country_list });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

/* COUNTRY TIMEZON JSON LIST */
exports.get_country_timezone = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let country_list = require('../../../country_list.json');
        let timezone_list = []
        country_list.forEach(country => {
            if (country.timezones) {
                country.timezones.forEach(timezone => {
                    let i = timezone_list.findIndex(i => i == timezone)
                    if (i == -1) {
                        timezone_list.push(timezone)
                    }
                })
            }
        })
        res.json({ success: true, timezone_list: timezone_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* FETCH SELECTED COUNTRY TIMEZONE LIST */
exports.fetch_country_timezone = async function (req, res) {
    try {
        let params_array = [{ name: 'country_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.country_id
        let country = await Country.findById(id);
        let timezone_list = country.country_all_timezone
        res.json({ success: true, timezone_list: timezone_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

/* FIND DUPLICATE COUNTRY */
exports.check_country_exists = async function (req, res) {
    try {
        let params_array = [{ name: 'countryname', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let countryname = req.body.countryname
        let duplicate_country = await Country.findOne({ countryname: countryname })
        if (duplicate_country) {
            let error_code = COUNTRY_ERROR_CODE.COUNTRY_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        res.json({ success: true })
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