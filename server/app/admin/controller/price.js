let Type = require('mongoose').model('Type');
let City_type = require('mongoose').model('city_type');
let City_to_City = require('mongoose').model('City_to_City');
let Airport_to_City = require('mongoose').model('Airport_to_City');
let Airport = require('mongoose').model('Airport')
let Trip_Service = require('mongoose').model('trip_service');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let CityZone = require('mongoose').model('CityZone');
let ZoneValue = require('mongoose').model('ZoneValue');
let utils = require('../../controllers/utils')
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let Provider = require('mongoose').model('Provider');
const {
    PRICE_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    PRICE_ERROR_CODE,
} = require('../../utils/error_code')
const {
    COLLECTION,
    UPDATE_LOG_TYPE,
} = require('../../controllers/constant');

exports.fetch_service_price = async function (req, res) {
    try {
        req.body.page = Number(req.body.page)
        let params_array = [{ name: 'page', type: 'number' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let search_item = req.body.search_item
        let search_value = req.body.search_value
        // lookup for country city and type              
        let lookup = {
            $lookup:
            {
                from: "countries",
                localField: "countryid",
                foreignField: "_id",
                as: "country_detail"
            }
        };
        let unwind = { $unwind: { path: "$country_detail", preserveNullAndEmptyArrays: false } };
        let lookup1 = {
            $lookup:
            {
                from: "cities",
                localField: "cityid",
                foreignField: "_id",
                as: "city_detail"
            }
        };
        let unwind1 = { $unwind: { path: "$city_detail", preserveNullAndEmptyArrays: false } };
        let lookup2 = {
            $lookup:
            {
                from: "types",
                localField: "typeid",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let unwind2 = { $unwind: { path: "$type_detail", preserveNullAndEmptyArrays: false } }

        // search filter
        let search = {}
        if (search_value) {
            search[search_item] = { $regex: search_value, $options: 'i' }
        }
        // sorting limit skip
        let sort = { $sort: { 'cityname': 1 } }
        let filter = { $match: search }

        // let total_list = await City_type.aggregate([lookup, unwind, lookup1, unwind1, lookup2, unwind2, filter,sort])
        // let total_page = Math.ceil(total_list.length / number_of_rec)
        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.CITY_TYPE, req.headers)

        let city_price_list = await City_type.aggregate([{$match: country_city_condition}, lookup, unwind, lookup1, unwind1, lookup2, unwind2, filter, sort])
        res.json({ success: true, city_price_list: city_price_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_unique_types = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.cityid
        let is_ride_share = req.body.is_ride_share
        let check_exist_service = await City_type.find({ cityid: id, is_ride_share: is_ride_share, typeid: { $exists: true } })
        let type_available = await Type.find({})
        let unique_array = new Set(check_exist_service.map(value => value.typeid.toString()))
        let type_unique = type_available.filter(({ _id }) => !unique_array.has(_id.toString()))
        res.json({ success: true, type_unique: type_unique })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_service_price = async function (req, res) {
    try {
        let params_array = [{ name: 'countryid', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let countryid = req.body.countryid
        let country = await Country.findById(countryid)
        let countryname = (country.countryname).trim()
        let cityid = req.body.cityid
        let city = await City.findById(cityid)
        let cityname = (city.cityname).trim()
        let typeid = req.body.typeid
        let type = await Type.findById(typeid)
        let typename = (type.typename).trim()
        let type_image = type.type_image_url
        let service_type = type.service_type;
        let surge_multiplier = 0;
        if (req.body.surge_multiplier) {
            surge_multiplier = req.body.surge_multiplier;
        }

        let duplicate_city_type = await City_type.findOne({cityid: req.body.cityid, typeid: typeid, is_ride_share: req.body.is_ride_share})
        if(duplicate_city_type){
            let error_code = PRICE_ERROR_CODE.ALREADY_EXISTS
            return res.json({ success: false, error_code })
        }
        
        let citytype = new City_type({
            countryid: req.body.countryid,
            countryname: countryname,
            cityname: cityname,
            cityid: req.body.cityid,
            typeid: typeid,
            type_image: type_image,
            service_type: service_type,
            is_business: req.body.is_business,
            is_ride_share: req.body.is_ride_share,
            is_car_rental_business: req.body.is_car_rental_business,
            surge_multiplier: surge_multiplier,
            surge_start_hour: req.body.surge_start_hour,
            surge_end_hour: req.body.surge_end_hour,
            is_surge_hours: req.body.is_surge_hours,
            is_zone: req.body.is_zone,
            typename: typename,
            base_price_distance: req.body.base_price_distance,
            base_price: req.body.base_price,
            price_per_unit_distance: req.body.price_per_unit_distance,
            waiting_time_start_after_minute: req.body.waiting_time_start_after_minute ?req.body.waiting_time_start_after_minute:0,
            price_for_waiting_time: req.body.price_for_waiting ?req.body.price_for_waiting:0,
            waiting_time_start_after_minute_multiple_stops: req.body.waiting_time_start_after_minute_multiple_stops ?req.body.waiting_time_start_after_minute_multiple_stops:0,
            price_for_waiting_time_multiple_stops: req.body.price_for_waiting_time_multiple_stops ?req.body.price_for_waiting_time_multiple_stops:0,
            price_for_total_time: req.body.price_for_total_time,
            tax: req.body.tax,
            min_fare: req.body.min_fare,
            provider_profit: req.body.provider_profit,
            max_space: req.body.max_space,
            cancellation_fee: req.body.cancellation_fee,
            user_miscellaneous_fee: req.body.user_miscellaneous_fee,
            provider_miscellaneous_fee: req.body.provider_miscellaneous_fee,
            user_tax: req.body.user_tax,
            provider_tax: req.body.provider_tax,
            luggage_allowacation: req.body.luggage_allowacation ?req.body.luggage_allowacation:null,
            vehicle_capacity:req.body.vehicle_capacity ?req.body.vehicle_capacity:null,
        });
        let save_citytype = await citytype.save()
        let city_id = save_citytype.cityid;
        let trip_service = new Trip_Service({
            service_type_id: save_citytype._id,
            city_id: city_id,
            service_type_name: (type.typename).trim(),
            min_fare: save_citytype.min_fare,
            provider_profit: save_citytype.provider_profit,
            base_price_distance: save_citytype.base_price_distance,
            base_price: save_citytype.base_price,
            price_per_unit_distance: save_citytype.price_per_unit_distance,
            waiting_time_start_after_minute: save_citytype.waiting_time_start_after_minute,
            price_for_waiting_time: save_citytype.price_for_waiting_time,
            waiting_time_start_after_minute_multiple_stops: save_citytype.waiting_time_start_after_minute_multiple_stops,
            price_for_waiting_time_multiple_stops: save_citytype.price_for_waiting_time_multiple_stops,
            is_car_rental_business: save_citytype.is_car_rental_business,
            price_for_total_time: save_citytype.price_for_total_time,
            surge_multiplier: save_citytype.surge_multiplier,
            surge_start_hour: save_citytype.surge_start_hour,
            surge_end_hour: save_citytype.surge_end_hour,
            is_surge_hours: save_citytype.is_surge_hours,
            tax: save_citytype.tax,
            max_space: save_citytype.max_space,
            cancellation_fee: save_citytype.cancellation_fee,
            user_miscellaneous_fee: save_citytype.user_miscellaneous_fee,
            provider_miscellaneous_fee: save_citytype.provider_miscellaneous_fee,
            user_tax: save_citytype.user_tax,
            provider_tax: save_citytype.provider_tax,
            luggage_allowacation: save_citytype.luggage_allowacation,
            vehicle_capacity:save_citytype.vehicle_capacity 
        });
        await trip_service.save()
        if (!save_citytype) {
            let error_code = PRICE_ERROR_CODE.ADD_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = PRICE_MESSAGE_CODE.ADD_SUCCESSFULLY
        res.json({ success: true, message: message })


        let info_detail = "ADDED"
        let changes = [ 
            {
                "field" : "typename",
                "oldValue" : "-",
                "newValue" : citytype.typename
            }
        ]
        
        utils.addChangeLog(UPDATE_LOG_TYPE.CITY_TYPE_SETTINGS, req.headers, changes, citytype.typename + " (" + citytype.cityname + ")", info_detail, {
            info_detail: citytype.typename + " (" + citytype.cityname + ")",
            type_id: citytype._id
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_surge_hour = async function (req, res) {
    try {
        let params_array = [{ name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let service_type_id = req.body.service_type_id
        let surge_hour = []
        let surge_array = req.body.surge_hours
        let is_surge_hours = req.body.is_surge_hours
        if (!is_surge_hours) {
            is_surge_hours = 0
        }
        for (let surge_data of surge_array) {
            // Unused Code:
            // if (surge_data.day_time) {
            //     day_time = surge_data.day_time
            // }
            if (!surge_data.is_surge || surge_data.is_surge == 'false') {
                surge_data.is_surge = false
            } else {
                surge_data.is_surge = true
            }
            surge_hour.push({ day: surge_data.day, day_time: surge_data.day_time, is_surge: surge_data.is_surge })
        }
        let update_surge_hour = await City_type.findByIdAndUpdate(service_type_id, { surge_hours: surge_hour, is_surge_hours: is_surge_hours }, { multi: true })
        if (!update_surge_hour) {
            let error_code = PRICE_ERROR_CODE.UPDATE_FAILED
            res.json({ success: false, error_code: error_code })
            return
        }
        let message = PRICE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_zone_price = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        let zone_list = await CityZone.find({ cityid: cityid })
        let condition = {
            $match: { 'cityid': Schema(cityid), 'service_type_id': Schema(service_type_id) }
        }
        let from_lookup = {
            $lookup: {
                from: 'cityzones',
                localField: 'from',
                foreignField: '_id',
                as: 'form_details'
            }
        }
        let to_lookup = {
            $lookup: {
                from: 'cityzones',
                localField: 'to',
                foreignField: '_id',
                as: 'to_details'
            }
        }
        let unwind = {
            $unwind: "$form_details"
        }
        let unwind1 = {
            $unwind: "$to_details"
        }
        let zone_value = await ZoneValue.aggregate([condition, from_lookup, to_lookup, unwind, unwind1])
        res.json({ success: true, zone_value: zone_value, zone_list: zone_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_airport_price = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        let airport_list = await Airport.find({ city_id: cityid }, { title: 1 })
        let condition = {
            $match: { 'city_id': Schema(cityid), 'service_type_id': Schema(service_type_id) }
        }
        let airport_lookup = {
            $lookup: {
                from: 'airports',
                localField: 'airport_id',
                foreignField: '_id',
                as: 'airport_details'
            }
        }
        let unwind = {
            $unwind: "$airport_details"
        }
        let project = {
            $project: { 'airport_details.title': 1, airport_id: 1, price: 1 }
        }
        let airport_value = await Airport_to_City.aggregate([condition, airport_lookup, unwind, project])
        res.json({ success: true, airport_list: airport_list, airport_value: airport_value })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_city_price = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        // fetch city to destination city list when value not add
        let city_to_city = {
            $lookup: {
                from: 'cities',
                localField: 'destination_city',
                foreignField: '_id',
                as: 'destination_name'
            }
        }
        let unwind = {
            $unwind: "$destination_name"
        }
        let match = {
            $match: { _id: Schema(cityid) }
        }
        let project = {
            $project: { cityname: 1, 'destination_name.cityname': 1, 'destination_name._id': 1 }
        }
        let city_list = await City.aggregate([match, city_to_city, unwind, project])
        let condition = {
            $match: { 'city_id': Schema(cityid), 'service_type_id': Schema(service_type_id) }
        }
        // fetch destionation price list 
        let city_name_lookup = {
            $lookup: {
                from: 'cities',
                localField: 'city_id',
                foreignField: '_id',
                as: 'city_name'
            }
        }
        let destination_lookup = {
            $lookup: {
                from: 'cities',
                localField: 'destination_city_id',
                foreignField: '_id',
                as: 'destination_name'
            }
        }
        let city_project = {
            $project: { price: 1, 'destination_name.cityname': 1, 'city_name.cityname': 1, 'destination_name._id': 1, 'city_name._id': 1 }
        }
        let unwind1 = {
            $unwind: '$city_name'
        }
        let unwind2 = {
            $unwind: '$destination_name'
        }
        let city_value = await City_to_City.aggregate([condition, destination_lookup, city_name_lookup, city_project, unwind1, unwind2])
        res.json({ success: true, city_list: city_list, city_value: city_value })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.fetch_car_rental = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        let condition = {
            $match: {
                '_id': Schema(service_type_id), 'cityid': Schema(cityid)
            }
        }
        let lookup = {
            $lookup:
            {
                from: "city_types",
                localField: "car_rental_ids",
                foreignField: "_id",
                as: "car_rental_details"
            }
        };
        let unwind = {
            $unwind: "$car_rental_details"
        }
        let project = {
            $project: {
                "car_rental_details.typename": 1,
                "car_rental_details.base_price_distance": 1,
                "car_rental_details.base_price_time": 1,
                "car_rental_details.base_price": 1,
                "car_rental_details.price_per_unit_distance": 1,
                "car_rental_details.price_for_total_time": 1,
                "car_rental_details.price_for_waiting_time": 1,
                "car_rental_details.is_business": 1,
                "car_rental_details._id": 1,
                "car_rental_details.tax": 1
            }
        }
        let car_rental_list = await City_type.aggregate([condition, lookup, unwind, project])
        res.json({ success: true, car_rental_list: car_rental_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// yet not finish
exports.fetch_rich_surge = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        let condition = {
            $match: { 'cityid': Schema(cityid), '_id': Schema(service_type_id) }
        }
        let unwind = {
            $unwind: '$rich_area_surge'
        }
        let rich_lookup = {
            $lookup: {
                from: 'cityzones',
                localField: 'rich_area_surge.id',
                foreignField: '_id',
                as: 'rich_surge_details'
            }
        }
        let rich_area_surges = await City_type.aggregate([condition, unwind, rich_lookup])
        res.json({ success: true, rich_area_surge: rich_area_surges })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.update_service_price = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        let type = req.body.type
        let airport_price = req.body.airport_price
        let city_price = req.body.city_price
        let zone_price = req.body.zone_price
        let delete_zone_id = req.body.delete_zone_id
        let rich_surge_price = req.body.rich_surge_price
        let update_car_rental_id = req.body.update_car_rental_id
        let delete_car_rental_id = req.body.delete_car_rental_id
        let is_car_rental_add = req.body.is_car_rental_add
        let message
        // service price 
        let citytype = await City_type.findById(service_type_id)
        if (type) {
            let updated_citytype = await City_type.findByIdAndUpdate(service_type_id, req.body, {new : true })

            let changes = utils.getModifiedFields(citytype, updated_citytype, [])
            if(changes.length > 0){
                utils.addChangeLog(UPDATE_LOG_TYPE.CITY_TYPE_SETTINGS, req.headers, changes, updated_citytype.typename + " (" + updated_citytype.cityname + ")", "", {
                    citytype_id: updated_citytype._id,
                    is_ride_share: updated_citytype.is_ride_share
                })
            }

            let city = updated_citytype.cityid;
            let typeid = updated_citytype.typeid;
            let type_detail = await Type.findOne({ _id: typeid })
            let trip_service = new Trip_Service({
                service_type_id: updated_citytype._id,
                city_id: city,
                service_type_name: (type_detail.typename).trim(),
                min_fare: updated_citytype.min_fare,
                provider_profit: updated_citytype.provider_profit,
                base_price_distance: updated_citytype.base_price_distance,
                base_price: updated_citytype.base_price,
                price_per_unit_distance: updated_citytype.price_per_unit_distance,
                waiting_time_start_after_minute: updated_citytype.waiting_time_start_after_minute,
                price_for_waiting_time: updated_citytype.price_for_waiting_time,
                waiting_time_start_after_minute_multiple_stops: updated_citytype.waiting_time_start_after_minute_multiple_stops,
                price_for_waiting_time_multiple_stops: updated_citytype.price_for_waiting_time_multiple_stops,
                price_for_total_time: updated_citytype.price_for_total_time,
                surge_multiplier: updated_citytype.surge_multiplier,
                is_car_rental_business: updated_citytype.is_car_rental_business,
                surge_start_hour: updated_citytype.surge_start_hour,
                surge_end_hour: updated_citytype.surge_end_hour,
                is_surge_hours: updated_citytype.is_surge_hours,
                tax: updated_citytype.tax,
                max_space: updated_citytype.max_space,
                cancellation_fee: updated_citytype.cancellation_fee,
                is_business: req.body.is_business,
                user_miscellaneous_fee: updated_citytype.user_miscellaneous_fee,
                provider_miscellaneous_fee: updated_citytype.provider_miscellaneous_fee,
                user_tax: updated_citytype.user_tax,
                provider_tax: updated_citytype.provider_tax,
                luggage_allowacation: updated_citytype.luggage_allowacation,
                vehicle_capacity:updated_citytype.vehicle_capacity 
            });
            await trip_service.save()
            await Trip_Service.updateMany({ service_type_id: { $in: updated_citytype.car_rental_ids } }, { provider_profit: updated_citytype.provider_profit }, { multi: true })
            await City_type.updateMany({ _id: { $in: updated_citytype.car_rental_ids } }, { provider_profit: updated_citytype.provider_profit }, { multi: true })
        }
        // airport to city price
        if (airport_price && airport_price.length > 0) {
            for (const data of airport_price) {
                let query = { city_id: cityid, airport_id: data.airport_id, service_type_id: service_type_id }
                let before_update_airport = await Airport_to_City.findOne(query)
                let info_detail = ""
                let changes = []
                if (before_update_airport == null) {
                    let airport_to_city_price = new Airport_to_City({
                        city_id: cityid,
                        service_type_id: service_type_id,
                        airport_id: data.airport_id,
                        price: data.price || 0
                    });
                    info_detail = "ADDED"
                    changes = [ 
                        {
                            "field" : "price",
                            "oldValue" : "-",
                            "newValue" : data.price
                        }
                    ]
                    await airport_to_city_price.save()
                }else{
                    let update_airport = await Airport_to_City.findOneAndUpdate(query, { price: data.price }, {new: true })
                    info_detail = "UPDATED"
                    changes = utils.getModifiedFields(before_update_airport, update_airport)
                }

                if(changes.length > 0){

                    let airport = await Airport.findById(data.airport_id)

                    utils.addChangeLog(UPDATE_LOG_TYPE.AIRPORT_TO_CITY_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                        info_detail: airport.title,
                        citytype_id: citytype._id,
                        is_ride_share: citytype.is_ride_share
                    })
                }
            }
        }
        // city to city price
        if (city_price && city_price.length > 0) {
            for (const data of city_price) {
                let query = { city_id: cityid, destination_city_id: data.destination_city_id, service_type_id: service_type_id }
                let before_update_city = await City_to_City.findOne(query)
                let info_detail = ""
                let changes = []
                if (before_update_city == null) {
                    let city_to_city_price = new City_to_City({
                        city_id: cityid,
                        service_type_id: service_type_id,
                        destination_city_id: data.destination_city_id,
                        price: data.price
                    });
                    info_detail = "ADDED"
                    changes = [ 
                        {
                            "field" : "price",
                            "oldValue" : "-",
                            "newValue" : data.price
                        }
                    ]
                    await city_to_city_price.save()
                }else{
                    let update_city = await City_to_City.findOneAndUpdate(query, { price: data.price }, { multi: true, new: true })
                    info_detail = "UPDATED"
                    changes = utils.getModifiedFields(before_update_city, update_city)
                }

                if(changes.length > 0){

                    let from_city = await City.findById(cityid)
                    let to_city = await City.findById(data.destination_city_id)

                    utils.addChangeLog(UPDATE_LOG_TYPE.CITY_TO_CITY_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                        info_detail: from_city.cityname + " - " + to_city.cityname,
                        citytype_id: citytype._id,
                        is_ride_share: citytype.is_ride_share
                    })
                }

            }
        }
        // zone to zone price
        if (zone_price && zone_price.length > 0) {
            for (const data of zone_price) {
                let query = { city_id: cityid, from: data.from, to: data.to, service_type_id: service_type_id }
                let before_update_zone = await ZoneValue.findOne(query)
                let info_detail = ""
                let changes = []
                if (!before_update_zone) {
                    let zone_to_zone_price = new ZoneValue({
                        cityid: cityid,
                        service_type_id: service_type_id,
                        from: data.from,
                        to: data.to,
                        amount: data.amount
                    });
                    info_detail = "ADDED"
                    changes = [ 
                        {
                            "field" : "amount",
                            "oldValue" : "-",
                            "newValue" : data.amount
                        }
                    ]

                    await zone_to_zone_price.save()
                }else{
                    let upadate_zone = await ZoneValue.findOneAndUpdate(query, { amount: data.amount },{new: true})
                    info_detail = "UPDATED"
                    changes = utils.getModifiedFields(before_update_zone, upadate_zone)
                }

                if(changes.length > 0 || info_detail){

                    let from_zone = await CityZone.findById(data.from)
                    let to_zone = await CityZone.findById(data.to)

                    utils.addChangeLog(UPDATE_LOG_TYPE.ZONE_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                        info_detail: from_zone.title + " - " + to_zone.title,
                        citytype_id: citytype._id,
                        is_ride_share: citytype.is_ride_share
                    })
                }
            }
        }
        if (delete_zone_id) {
            
            let zone = await ZoneValue.findOneAndDelete({ _id: delete_zone_id })
            let from_zone = await CityZone.findById(zone.from)
            let to_zone = await CityZone.findById(zone.to)

            utils.addChangeLog(UPDATE_LOG_TYPE.ZONE_SETTINGS, req.headers, [], citytype.typename + " - " + citytype.cityname, "DELETED", {
                info_detail: from_zone.title + " - " + to_zone.title,
                citytype_id: citytype._id,
                is_ride_share: citytype.is_ride_share
            })
            
            let message = PRICE_MESSAGE_CODE.DELETE_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        // rich surge area price
        if (rich_surge_price && rich_surge_price.length > 0) {
            for (const rich_area_surge_data of rich_surge_price) {
                let zone_index = citytype.rich_area_surge.findIndex((x) => (x.id).toString() == (rich_area_surge_data.id).toString());
                let changes = []
                let info_detail = ""
                if (zone_index == -1) {
                    if(rich_area_surge_data.surge_multiplier != ""){
                        citytype.rich_area_surge.push({ id: Schema(rich_area_surge_data.id), surge_multiplier: Number(rich_area_surge_data.surge_multiplier) })
                        info_detail = "ADDED"
                        changes = [ 
                            {
                                "field" : "surge_multiplier",
                                "oldValue" : "-",
                                "newValue" : rich_area_surge_data.surge_multiplier
                            }
                        ]
                    }
                } else {
                    let before_update = JSON.parse(JSON.stringify(citytype.rich_area_surge[zone_index]))
                    citytype.rich_area_surge[zone_index].surge_multiplier = Number(rich_area_surge_data.surge_multiplier)
                    info_detail = "UPDATED"
                    changes = utils.getModifiedFields(before_update, citytype.rich_area_surge[zone_index], [])
                }

                if(changes.length > 0 || info_detail){
                    utils.addChangeLog(UPDATE_LOG_TYPE.RICH_AREA_SURGE_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                        info_detail: rich_area_surge_data.title,
                        citytype_id: citytype._id,
                        rich_area_surge_id: rich_area_surge_data.id,
                        is_ride_share: citytype.is_ride_share
                    })
                }
            }
            citytype.markModified('rich_area_surge');
            await citytype.save();
        }
        // car rental price
        // update car rental price
        if (update_car_rental_id) {
            req.body.is_business = Number(req.body.is_business)
            let before_update_city_type_data = await City_type.findOne({ _id: update_car_rental_id })
            let city_type_data = await City_type.findOneAndUpdate({ _id: update_car_rental_id }, req.body, { multi: true, new: true })
            if (city_type_data) {
                let trip_service = new Trip_Service({
                    service_type_id: city_type_data._id,
                    typename: req.body.typename,
                    base_price_distance: req.body.base_price_distance,
                    base_price_time: req.body.base_price_time,
                    base_price: req.body.base_price,
                    price_per_unit_distance: req.body.price_per_unit_distance,
                    price_for_total_time: req.body.price_for_total_time,
                    provider_profit: req.body.provider_profit || city_type_data.provider_profit,
                    tax: req.body.tax
                });
                await trip_service.save()
                message = PRICE_MESSAGE_CODE.UPDATE_SUCCESSFULLY

                let info_detail = ""
                let changes = utils.getModifiedFields(before_update_city_type_data, city_type_data, [])

                if(changes.length > 0) {
                    utils.addChangeLog(UPDATE_LOG_TYPE.RENTAL_CAR_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                        citytype_id: citytype._id,
                        rental_citytype_id: city_type_data._id,
                        is_ride_share: citytype.is_ride_share
                    })
                }

                res.json({ success: true, message: message })
                return
            }
        }
        // add car rental price
        if (is_car_rental_add) {
            let city_type_data = await City_type.findOne({ _id: service_type_id })
            let citytype_new = new City_type({
                typename: req.body.typename,
                base_price_distance: req.body.base_price_distance,
                base_price_time: req.body.base_price_time,
                base_price: req.body.base_price,
                price_per_unit_distance: req.body.price_per_unit_distance,
                price_for_total_time: req.body.price_for_total_time,
                is_business: req.body.is_business,
                provider_profit: req.body.provider_profit || city_type_data.provider_profit,
                tax: req.body.tax,
            });
            await citytype_new.save()
            let trip_service = new Trip_Service({
                service_type_id: citytype_new._id,
                typename: req.body.typename,
                base_price_distance: req.body.base_price_distance,
                base_price_time: req.body.base_price_time,
                base_price: req.body.base_price,
                price_per_unit_distance: req.body.price_per_unit_distance,
                price_for_total_time: req.body.price_for_total_time,
                provider_profit: req.body.provider_profit || city_type_data.provider_profit,
                tax: req.body.tax
            });
            await trip_service.save()
            city_type_data.car_rental_ids.unshift(citytype_new._id);
            await city_type_data.save();

            let info_detail = ""
            let changes = []

            info_detail = "ADDED"
            utils.addChangeLog(UPDATE_LOG_TYPE.RENTAL_CAR_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                info_detail: citytype_new.typename,
                citytype_id: citytype._id,
                rental_citytype_id: citytype_new._id,
                is_ride_share: citytype.is_ride_share
            })
            
        }
        // delete car rental
        if (delete_car_rental_id) {
            let delete_car_rental = await City_type.findOneAndDelete({ _id: delete_car_rental_id })
            let update_car_rental = await City_type.findOne({ _id: service_type_id })
            let index = update_car_rental.car_rental_ids.indexOf(delete_car_rental_id)
            if (index != -1) {
                update_car_rental.car_rental_ids.splice(index, 1)
                await update_car_rental.save()
            }


            let info_detail = ""
            let changes = []

            info_detail = "DELETED"
            utils.addChangeLog(UPDATE_LOG_TYPE.RENTAL_CAR_SETTINGS, req.headers, changes, citytype.typename + " - " + citytype.cityname, info_detail, {
                info_detail: delete_car_rental.typename,
                citytype_id: citytype._id,
                rental_citytype_id: delete_car_rental._id,
                is_ride_share: citytype.is_ride_share
            })


            message = PRICE_MESSAGE_CODE.DELETE_SUCCESSFULLY
            res.json({ success: true, message: message })
            return
        }
        message = PRICE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })
        return;
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.check_zone_price_exist = async function (req, res) {
    try {
        let params_array = [{ name: 'cityid', type: 'string' }, { name: 'service_type_id', type: 'string' }, { name: 'from', type: 'string' }, { name: 'to', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let cityid = req.body.cityid
        let service_type_id = req.body.service_type_id
        let from = req.body.from
        let to = req.body.to
        let duplicate = await ZoneValue.find({ cityid: cityid, service_type_id: service_type_id, $or: [{ from: from, to: to }, { from:to,to:from }] })
        if (duplicate.length == 0) {
            res.json({ success: true })
            return
        }
        let error_code = PRICE_MESSAGE_CODE.ALREADY_EXISTS
        res.json({ success: false, error_code })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.add_zone_queue = async function(req, res) {
    try {
        let params_array = [{ name: 'service_type_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const city_type = await City_type.findOne({ _id: mongoose.Types.ObjectId(req.body.service_type_id) })
        if(!city_type) return res.json({ success: false, error_code: error_message.ERROR_CODE_NO_SERVICE_TYPE_FOUND})
        await City_type.findOneAndUpdate({ _id: mongoose.Types.ObjectId(req.body.service_type_id)}, { zone_ids: req.body.zone_ids}, { new: true })

        let message = PRICE_MESSAGE_CODE.UPDATE_SUCCESSFULLY
        res.json({ success: true, message: message })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.get_zone_provider_list = async function(req, res) {
    try {
        let params_array = [{ name: 'zone_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let zone_detail = await CityZone.findById(req.body.zone_id);
        if(!zone_detail){
            res.json({success: false})
        }

        let zone_provider = []
        let queque_array = zone_detail.total_provider_in_zone_queue

        for (const iterator of queque_array) {
            let provider = await Provider.findOne({_id:(iterator).toString()},
            {
                _id: 1,
                first_name: 1,
                last_name: 1,
                email: 1,
                phone: 1,
                country_phone_code: 1,
                unique_id: 1,
                city: 1,
                wallet: 1,
            })
            zone_provider.push(provider)
        }

        res.json({ success: true, zone_providers:zone_provider })

    } catch (error) {
        utils.error_response(error, req, res)
    }
}
