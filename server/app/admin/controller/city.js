let City = require('mongoose').model('City');
let Country = require('mongoose').model('Country');
let Airport = require('mongoose').model('Airport');
let Airport_to_City = require('mongoose').model('Airport_to_City');
let CityZone = require('mongoose').model('CityZone');
let RedZoneArea = require('mongoose').model('RedZoneArea');
let ZoneValue = require('mongoose').model('ZoneValue');
let utils = require('../../controllers/utils');
const {
    CITY_MESSAGE_CODE,
} = require('../../utils/success_code');
const {
    CITY_ERROR_CODE,
} = require('../../utils/error_code');
const {
    COLLECTION,
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');

exports.fetch_city_list = async function (req, res) {
    try {
        req.body.page = Number(req.body.page)
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let search_item = req.body.search_item
        let search_value = req.body.search_value
        let query = {}
        if (search_value) {
            query[search_item] = { $regex: search_value, $options: 'i' }
        }
        let sort = { $sort: { cityname: 1 } }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.CITY, req.headers)
        let city_list = await City.aggregate([{$match: country_city_condition}, { $match: query }, sort])
        res.json({ success: true, city_list: city_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_city_details = async function (req, res) {
    try {
        let params_array = [{ name: 'countryid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let array = [];
        let location_array = [];
        let city_locations = req.body.city_locations + '';
        if (city_locations && city_locations.length > 0) {
            city_locations = city_locations.split(',');
            city_locations.forEach(function (location, index) {
                location_array.push(Number(location))
                if (index % 2 !== 0) {
                    array.push(location_array);
                    location_array = [];
                }
            })
        }
        let countryid = req.body.countryid
        let country = await Country.findById(countryid)
        let countryname = (country.countryname).trim()
        let add_city = new City({
            countryid: req.body.countryid,
            city_locations: array,
            countryname: countryname,
            cityname: (req.body.cityname).trim(),
            full_cityname: (req.body.full_cityname).trim(),
            citycode: req.body.citycode,
            cityRadius: req.body.cityRadius,
            cityLatLong: [req.body.city_lat, req.body.city_lng],
            payment_gateway: req.body.payment_gateway,
            provider_min_wallet_amount_set_for_received_cash_request: req.body.provider_min_wallet_amount_set_for_received_cash_request,
            timezone: req.body.timezone,
            destination_city: req.body.destination_city,
            isBusiness: req.body.isBusiness,
            unit: req.body.unit,
            zone_business: req.body.zone_business,
            city_business: req.body.city_business,
            airport_business: req.body.airport_business,
            is_payment_mode_cash: req.body.is_payment_mode_cash,
            is_payment_mode_apple_pay: req.body.is_payment_mode_apple_pay,
            is_payment_mode_card: req.body.is_payment_mode_card,
            isPromoApplyForCash: req.body.isPromoApplyForCash,
            isPromoApplyForCard: req.body.isPromoApplyForCard,
            schedule_business: req.body.schedule_business,
            is_provider_initiate_trip: req.body.is_provider_initiate_trip,
            is_use_city_boundary: req.body.is_use_city_boundary,
            is_ask_user_for_fixed_fare: req.body.is_ask_user_for_fixed_fare,
            is_check_provider_wallet_amount_for_received_cash_request: req.body.is_check_provider_wallet_amount_for_received_cash_request,
            is_provider_earning_set_in_wallet_on_cash_payment: req.body.is_provider_earning_set_in_wallet_on_cash_payment,
            is_provider_earning_set_in_wallet_on_other_payment: req.body.is_provider_earning_set_in_wallet_on_other_payment,
        });
        if (!add_city) {
            let error_code = CITY_ERROR_CODE.ADD_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        await add_city.save()

        utils.addChangeLog(UPDATE_LOG_TYPE.CITY_SETTINGS, req.headers, [], add_city.cityname, "ADDED", {
            info_detail: add_city.cityname,
            country_id: add_city.countryid,
            city_id: add_city._id,
        })

        let message = CITY_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_city_details = async function (req, res) {
    try {
        let params_array = [{ name: 'city_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let city_id = req.body.city_id

        let old_city = await City.findById(city_id)
        let city_update = await City.findByIdAndUpdate(city_id, req.body, { multi: true, new: true })
        let changes = utils.getModifiedFields(old_city, city_update, [])
        if(changes.length > 0){
            utils.addChangeLog(UPDATE_LOG_TYPE.CITY_SETTINGS, req.headers, changes, old_city.cityname, "", {
                city_id: old_city._id
            })
        }
        if (city_update) {
            let message = CITY_MESSAGE_CODE.UPDATE_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        let error_code = CITY_ERROR_CODE.UPDATE_FAILED
        res.json({ success: false, error_code: error_code })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_destination_city = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let query = {}
        let country_id = req.body.country_id
        let countryname = req.body.countryname
        let city_id = req.body.city_id
        if (countryname) {
            let country = await Country.findOne({ countryname: countryname })
            if (country) {
                country_id = country._id
            }
        }
        if(req.body.type != 1){
            query['isBusiness'] = 1
        }
        if (city_id) {
            query['_id'] = { $ne: city_id }
        }
        query['countryid'] = country_id

        if(req.body.country_ids){
            query['countryid'] = { $in: req.body.country_ids}
        }

        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.CITY, req.headers)
        if(country_city_condition._id){
            query['_id'] = country_city_condition._id
        }

        let destination_list = await City.find(query, { unit: 1, _id: 1, cityname: 1, cityLatLong: 1, city_locations: 1, cityRadius: 1, is_use_city_boundary: 1 })
        res.json({ success: true, destination_list: destination_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_airport_details = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.cityid
        let city = await City.findById(id)
        if (!city) {
            let error_code = CITY_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        // FOR DELETE AIRPORT ZONE
        let airport_deleted_array = req.body.deleted_airport
        if (airport_deleted_array && airport_deleted_array.length > 0) {
            for (const id of airport_deleted_array) {

                let airport_detail = await Airport.findById(id)
                utils.addChangeLog(UPDATE_LOG_TYPE.AIRPORT_SETTINGS, req.headers, [], city.cityname, "DELETED", {
                    info_detail: airport_detail.title,
                    city_id: city._id,
                    airport_id: airport_detail._id
                })
                
                await Airport.findByIdAndDelete(id)
                await Airport_to_City.findOneAndDelete({ airport_id: id })
            }
        }

        // FOR ADD OR UPDATE AIRPORT ZONE
        let airport_array = req.body.airport_array
        if (airport_array && airport_array.length > 0) {
            for (const airport_data of airport_array) {
                if (airport_data._id) {

                    let old_airport = await Airport.findById(airport_data._id)
                    let airport_update = await Airport.findByIdAndUpdate(airport_data._id, airport_data, { new: true })
                    let changes = utils.getModifiedFields(old_airport, airport_update, [])

                    utils.addChangeLog(UPDATE_LOG_TYPE.AIRPORT_SETTINGS, req.headers, changes, city.cityname, "", {
                        city_id: city._id,
                        airport_id: airport_update._id
                    })
                    
                } else {
                    let add_airport = new Airport({
                        city_id: city._id,
                        title: airport_data.title,
                        kmlzone: airport_data.kmlzone,
                        styleUrl: airport_data.styleUrl,
                        styleHash: airport_data.styleHash,
                        description: airport_data.description,
                        stroke: airport_data.stroke,
                        stroke_opacity: 1,
                        stroke_width: 1.2,
                        fill: airport_data.fill,
                        fill_opacity: 0.30196078431372547,
                    })
                    await add_airport.save()


                    utils.addChangeLog(UPDATE_LOG_TYPE.AIRPORT_SETTINGS, req.headers, [], city.cityname, "ADDED", {
                        info_detail: add_airport.title,
                        city_id: city._id,
                        airport_id: add_airport._id
                    })

                }
            }
        }
        let message = CITY_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_zone_details = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.cityid
        let city = await City.findById(id)
        if (!city) {
            let error_code = CITY_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        //  FOR DELETE CITY ZONE
        let cityzone_deleted_array = req.body.deleted_zone
        if (cityzone_deleted_array && cityzone_deleted_array.length > 0) {
            for (const id of cityzone_deleted_array) {
                let city_zone = await CityZone.findById(id)

                utils.addChangeLog(UPDATE_LOG_TYPE.ZONE_SETTINGS, req.headers, [], city.cityname, "DELETED", {
                    info_detail: city_zone.title,
                    city_id: city._id,
                    zone_id: city_zone._id
                })

                await CityZone.findByIdAndDelete(id)
                await ZoneValue.findOneAndDelete({ $or: [{ from: id }, { to: id }] })
            }
        }
        // FOR ADD OR UPDATE CITY ZONE
        let cityzone_array = req.body.zone_array
        if (cityzone_array && cityzone_array.length > 0) {
            for (let zone_data of cityzone_array) {
                if (zone_data._id) {
                    let old_zone = await CityZone.findById(zone_data._id)
                    let zone_detail = await CityZone.findByIdAndUpdate(zone_data._id, zone_data , {new: true})
                    let changes = utils.getModifiedFields(old_zone, zone_detail, [])

                    if(changes.length > 0){
                        utils.addChangeLog(UPDATE_LOG_TYPE.ZONE_SETTINGS, req.headers, changes, city.cityname, "", {
                            city_id: city._id,
                            zone_id: zone_detail._id
                        })
                    }

                } else {
                    let city_zone = new CityZone({
                        cityid: city._id,
                        cityname: city.cityname,
                        title: zone_data.title,
                        kmlzone: zone_data.kmlzone,
                        styleUrl: zone_data.styleUrl,
                        styleHash: zone_data.styleHash,
                        description: zone_data.description,
                        stroke: zone_data.stroke,
                        stroke_opacity: 1,
                        stroke_width: 1.2,
                        fill: zone_data.fill,
                        fill_opacity: 0.30196078431372547,
                    });
                    await city_zone.save()

                    utils.addChangeLog(UPDATE_LOG_TYPE.ZONE_SETTINGS, req.headers, [], city.cityname, "ADDED", {
                        info_detail: city_zone.title,
                        city_id: city._id,
                        zone_id: city_zone._id
                    })

                }
            }
        }
        let message = CITY_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_redzone_details = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.cityid
        let city = await City.findById(id)
        if (!city) {
            let error_code = CITY_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        // FOR DELETE REDZONE 
        let redzone_deleted_array = req.body.deleted_red_zone
        if (redzone_deleted_array && redzone_deleted_array.length > 0) {
            for (const id of redzone_deleted_array) {
                let zone_data = await RedZoneArea.findById(id)
                await RedZoneArea.findByIdAndDelete(id)

                utils.addChangeLog(UPDATE_LOG_TYPE.RED_ZONE_SETTINGS, req.headers, [], city.cityname, "DELETED", {
                    info_detail: zone_data.title,
                    city_id: city._id,
                    zone_id: zone_data._id
                })

            }
        }
        // FOR ADD OR UPDATE  REDZONE
        let red_zone_array = req.body.red_zone_array
        if (red_zone_array && red_zone_array.length > 0) {
            for (const red_zone_data of red_zone_array) {
                if (red_zone_data._id) {
                    let old_zone = await RedZoneArea.findById(red_zone_data._id)
                    let updated_zone = await RedZoneArea.findByIdAndUpdate(red_zone_data._id, red_zone_data, {new: true})
                    let changes = utils.getModifiedFields(old_zone, updated_zone, [])

                    if(changes.length > 0){
                        utils.addChangeLog(UPDATE_LOG_TYPE.RED_ZONE_SETTINGS, req.headers, changes, city.cityname, "", {
                            city_id: city._id,
                            zone_id: updated_zone._id
                        })
                    }

                } else {
                    let city_red_zone = new RedZoneArea({
                        cityid: city._id,
                        cityname: city.cityname,
                        title: red_zone_data.title,
                        kmlzone: red_zone_data.kmlzone,
                        styleUrl: red_zone_data.styleUrl,
                        styleHash: red_zone_data.styleHash,
                        description: red_zone_data.description,
                        stroke: red_zone_data.stroke,
                        stroke_opacity: 1,
                        stroke_width: 1.2,
                        fill: red_zone_data.fill,
                        fill_opacity: 0.30196078431372547,
                    });
                    await city_red_zone.save()
                    utils.addChangeLog(UPDATE_LOG_TYPE.RED_ZONE_SETTINGS, req.headers, [], city.cityname, "ADDED", {
                        info_detail: city_red_zone.title,
                        city_id: city._id,
                        zone_id: city_red_zone._id
                    })
                }
            }
        }
        let message = CITY_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.check_city_avaliable = async function (req, res) {
    try {
        let params_array = [{ name: "countryid", type: 'string' }, { name: 'cityname', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let countryid = req.body.countryid
        let cityname = req.body.cityname
        let latitude = req.body.latitude
        let longitude = req.body.longitude
        let city = await City.findOne({ $and: [{ cityLatLong: { $in: [latitude, longitude] } }, { cityname: cityname }], countryid: countryid })
        if (city) {
            let error_code = CITY_ERROR_CODE.CITY_ALREADY_REGISTERED
            res.json({ success: false, error_code: error_code })
            return
        }
        res.json({ success: true })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_airport_details = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let airport_details = await Airport.find({ city_id: cityid })
        res.json({ success: true, airport_details: airport_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_cityzone_details = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let cityzone_details = await CityZone.find({ cityid: cityid })
        res.json({ success: true, cityzone_details: cityzone_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_redzone_details = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let redzone_details = await RedZoneArea.find({ cityid: cityid })
        res.json({ success: true, redzone_details: redzone_details })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}