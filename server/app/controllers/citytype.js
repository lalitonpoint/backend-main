let utils = require('./utils');
let Citytype = require('mongoose').model('city_type');
let City = require('mongoose').model('City');
let Country = require('mongoose').model('Country');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let geolib = require('geolib');
let console = require('./console');
let RedZoneArea = require('mongoose').model('RedZoneArea');
let CityZone = require('mongoose').model('CityZone');
let Corporate = require('mongoose').model('Corporate');
let Settings = require('mongoose').model('Settings')
let Dispatcher = require('mongoose').model('Dispatcher')
const {
    TYPE_VALUE,
} = require('./constant');
// list
exports.list = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    utils.check_request_params(req.body, [
        {name: 'country', type: 'string'}], function (response) {
        if (response.success) {
            let currentCityLatLong = [req.body.latitude, req.body.longitude];
            let provider_id = req.body.provider_id;
            let country = req.body.country;
            let country_code = req.body.country_code;
            let table;
            let query;
            let currency = "";
            let currencycode = "";
            let server_time = new Date();
            let corporate_id = null;
            if (provider_id !== undefined) {
                query = {_id : req.body.provider_id}
                table = Provider;
            } else {
                query = {_id : req.body.user_id}
                table = User;
            }
            if(!country_code){
                country_code = null;
            }
            table.findOne(query).then(async (detail) => {
                if (detail) {
                    if (req.body.token !== "token") {
                        if (req.body.token !== null && detail.token !== req.body.token ) {
                            res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                            return;
                        }
                    }
                }
        
                Country.findOne({$and: [{$and: [{countryname: { $regex:  new RegExp(`\\b${country}\\b`, 'i')  }}, { alpha2: {$exists: true, $eq: country_code}}]}]}).then((country) => {
                    if (!country) {
    
                           City.find({ cityLatLong : { $near: [Number(req.body.latitude), Number(req.body.longitude)], $maxDistance: 1 }  , isBusiness: constant_json.YES}).then((cityList) => {
                            let size = cityList.length;
                            let count = 0;
                            if (size == 0) {
                               res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY});
                            } else {
                                let finalCityId = null;
                                let finalDistance = 1000000;
                                let final_city_details = {};
                                cityList.forEach(async function (city_detail) {
                                    count++;
                                    let cityLatLong = city_detail.cityLatLong;
                                    let distanceFromSubAdminCity = utils.getDistanceFromTwoLocation(currentCityLatLong, cityLatLong);
                                    let cityRadius = city_detail.cityRadius;

                                    if (!city_detail.is_use_city_boundary) {
                                        if (distanceFromSubAdminCity < cityRadius) {
                                            if (distanceFromSubAdminCity < finalDistance) {
                                                finalDistance = distanceFromSubAdminCity;
                                                finalCityId = city_detail._id;
                                                final_city_details = city_detail;
                                                
                                            }
                                        }
                                    } else {
                                        let city_zone = geolib.isPointInside(
                                            {
                                                latitude: Number(req.body.latitude),
                                                longitude: Number(req.body.longitude)
                                            },
                                            city_detail.city_locations);
                                        if (city_zone) {
                                            if (distanceFromSubAdminCity < finalDistance) {
                                                finalDistance = distanceFromSubAdminCity;
                                                finalCityId = city_detail._id;
                                                final_city_details = city_detail;
                                                 
                                            }
                                        }
                                    }
                                    if (count == size) {
                                        if (finalCityId != null) {
                                            if(req.headers.type == TYPE_VALUE.DISPATCHER){
                                                let dispatcher_detail = await Dispatcher.findById(req.headers.admin_id)
                                                
                                                if(dispatcher_detail && dispatcher_detail.city_ids.length > 0 ){
                                                    if(dispatcher_detail.city_ids.includes(finalCityId)){
                                                        return res.json({
                                                            success: false,
                                                            error_code: error_message.ERROR_CODE_NO_PERMISSION_IN_CITY
                                                        }); 
        
                                                    }
                                                }
                                                
                                            }
                                            let city_id = finalCityId;

                                            RedZoneArea.find({cityid: city_id}).then((red_zone_area_list)=>{
                                                let inside_red_zone = false;
                                                red_zone_area_list.forEach(function(red_zone_area_data, index){
                                                    let inside_zone = geolib.isPointInside(
                                                        {
                                                            latitude: Number(req.body.latitude),
                                                            longitude: Number(req.body.longitude)
                                                        }, red_zone_area_data.kmlzone);
                                                    if (inside_zone) {
                                                        inside_red_zone = true;
                                                    }
                                                })
                                                if(!inside_red_zone){
                                                    CityZone.find({cityid: city_id}).then((zone_list)=>{
                                                        let zone_id = null;
                                                        zone_list.forEach(function(zone_data, index){
                                                            let inside_zone = geolib.isPointInside(
                                                                {
                                                                    latitude: Number(req.body.latitude),
                                                                    longitude: Number(req.body.longitude)
                                                                }, zone_data.kmlzone);
                                                            if (inside_zone) {
                                                                zone_id = zone_data._id;
                                                            }
                                                        });

                                                        let city_type_to_type_query = {
                                                            $lookup:
                                                                {
                                                                    from: "types",
                                                                    localField: "typeid",
                                                                    foreignField: "_id",
                                                                    as: "type_details"
                                                                }
                                                        };
                                                        let array_to_json = {$unwind: "$type_details"};

                                                        let countryid_condition = {$match: {'countryid': {$eq: final_city_details.countryid}}};
                                                        let cityid_condition = {$match: {'cityid': {$eq: city_id}}};
                                                        let buiesness_condotion = {$match: {'is_business': {$eq: 1}}};
                                                        let is_ride_share_condition = { $match: { 'is_ride_share': { $eq: 0 } } };
                                                        let rrr = { "$redact": { "$cond": [{ '$eq': ["$type_details.is_business", 1] }, "$$KEEP", "$$PRUNE"] } }

                                                        let lookup = {
                                                            $lookup:
                                                            {
                                                                from: "city_types",
                                                                localField: "car_rental_ids",
                                                                foreignField: "_id",
                                                                as: "car_rental_list"
                                                            }
                                                        };

                                                        Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, is_ride_share_condition, city_type_to_type_query, array_to_json, rrr, lookup]).then(async (citytypes) => {
                                                            let PAYMENT_TYPES = utils.PAYMENT_TYPES();
                                                            if(zone_id){
                                                                citytypes.forEach(function(citytype_data){
                                                                    if(citytype_data.rich_area_surge){
                                                                        let zone_index = citytype_data.rich_area_surge.findIndex((x) => (x.id).toString() == zone_id.toString());
                                                                        if(zone_index !== -1 && citytype_data.rich_area_surge[zone_index].surge_multiplier>0){
                                                                            citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                        }
                                                                    }
                                                                })
                                                            }
                                                            citytypes.forEach(function(citytype_data){
                                                                if(citytype_data.is_car_rental_business){
                                                                    let car_rental_list = citytype_data.car_rental_list;
                                                                    citytype_data.car_rental_list = [];
                                                                    car_rental_list.forEach(function(car_rental_data){
                                                                        if(car_rental_data.is_business){
                                                                            citytype_data.car_rental_list.push(car_rental_data);
                                                                        }
                                                                    })
                                                                } else {
                                                                    citytype_data.car_rental_list = [];
                                                                }
                                                            });
                                                            let pooltypes = []
                                                            if (setting_detail.is_allow_ride_share) {
                                                                let is_ride_share_condition = { $match: { 'is_ride_share': { $eq: 1 } } };
                                                                let rrr = { "$redact": { "$cond": [{ '$eq': ["$type_details.is_business", 1] }, "$$KEEP", "$$PRUNE"] } }
                                                                pooltypes = await Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, is_ride_share_condition, city_type_to_type_query, array_to_json, rrr])
                                                                pooltypes.forEach(function(citytype_data){
                                                                    if(citytype_data.rich_area_surge){
                                                                        let zone_index = citytype_data?.rich_area_surge?.findIndex((x) => (x.id).toString() == zone_id?.toString());
                                                                        if(zone_index !== -1 && citytype_data?.rich_area_surge[zone_index]?.surge_multiplier>0){
                                                                            citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                        }
                                                                    }
                                                                })
                                                            }
                                                            let openridetypes = []
                                                            let is_openride_condition = { $match: { 'is_ride_share': { $eq: 2 } } };
                                                            let rrr = { "$redact": { "$cond": [{ '$eq': ["$type_details.is_business", 1] }, "$$KEEP", "$$PRUNE"] } }
                                                            openridetypes = await Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, is_openride_condition, city_type_to_type_query, array_to_json, rrr])
                                                            openridetypes.forEach(function(citytype_data){
                                                                if(citytype_data.rich_area_surge){
                                                                    let zone_index = citytype_data?.rich_area_surge?.findIndex((x) => (x.id).toString() == zone_id?.toString());
                                                                    if(zone_index !== -1 && citytype_data?.rich_area_surge[zone_index]?.surge_multiplier>0){
                                                                        citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                    }
                                                                }
                                                            })


                                                            if (citytypes.length != 0 || pooltypes.length != 0 || openridetypes.length != 0) {
                                                                if(detail && detail.corporate_ids && detail.corporate_ids.length>0){
                                                                    corporate_id = detail.corporate_ids[0].corporate_id;
                                                                }

                                                                Corporate.findOne({_id: corporate_id}).then((corporate_detail)=>{
                                                                    let is_corporate_request = false;
                                                                    if(detail && corporate_detail && detail.corporate_ids[0].status == constant_json.CORPORATE_REQUEST_ACCEPTED && corporate_detail.is_approved){
                                                                        is_corporate_request = true;
                                                                    }

                                                                    citytypes.forEach((citytype) => {  
                                                                        if (citytype.is_surge_hours === 0 && citytype.surge_hours) {
                                                                            for (const surgeHour of citytype.surge_hours) {
                                                                                surgeHour.is_surge = false;
                                                                            }
                                                                        }
                                                                    })
                                                                    res.json({
                                                                        success: true,
                                                                        message: success_messages.MESSAGE_CODE_GET_CITYTYPE_LIST_SUCCESSFULLY,
                                                                        currency: currency,
                                                                        currencycode: currencycode,
                                                                        city_detail: final_city_details,
                                                                        payment_gateway: PAYMENT_TYPES,
                                                                        citytypes: citytypes,
                                                                        pooltypes: pooltypes,
                                                                        openridetypes: openridetypes,
                                                                        server_time: server_time,
                                                                        is_corporate_request: is_corporate_request,
                                                                        is_allow_trip_bidding: country?.is_allow_trip_bidding,
                                                                        is_user_can_set_bid_price: country?.is_user_can_set_bid_price,
                                                                        driver_max_bidding_limit: country?.driver_max_bidding_limit,
                                                                        user_min_bidding_limit: country?.user_min_bidding_limit
                                                                    });
                                                                });

                                                            } else if (count == size) {
                                                                res.json({
                                                                    success: false,
                                                                    error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                                });
                                                            }
                                                        });
                                                    });
                                                } else {
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                    }); 
                                                }
                                            });


                                        } else {
                                            res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY});
                                        }
                                    }

                                });
                            }
                        });

                        
                        
                    } else {
                        if(country.isBusiness== constant_json.YES){
                            let country_id = country._id;
                            currency = country.currencysign;
                            currencycode = country.currencycode;
                            
                            
                            City.find({countryid: country_id, isBusiness: constant_json.YES}).then((cityList) => {
                                let size = cityList.length;
                                let count = 0;
                                if (size == 0) {
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                    });
                                } else {
                                    let finalCityId = null;
                                    let finalDistance = 100000000;
                                    let final_city_details = {};
                                    cityList.forEach(async function (city_detail) {
                                        count++;
                                        let cityLatLong = city_detail.cityLatLong;
                                        let distanceFromSubAdminCity = utils.getDistanceFromTwoLocation(currentCityLatLong, cityLatLong);
                                        let cityRadius = city_detail.cityRadius;

                                        if (!city_detail.is_use_city_boundary) {
                                            if (distanceFromSubAdminCity < cityRadius) {
                                                if (distanceFromSubAdminCity < finalDistance) {
                                                    finalDistance = distanceFromSubAdminCity;
                                                    finalCityId = city_detail._id;
                                                    final_city_details = city_detail;
                                                }
                                            }
                                        } else {
                                            let city_zone = geolib.isPointInside(
                                                {
                                                    latitude: Number(req.body.latitude),
                                                    longitude: Number(req.body.longitude)
                                                },
                                                city_detail.city_locations);
                                            if (city_zone) {
                                                if (distanceFromSubAdminCity < finalDistance) {
                                                    finalDistance = distanceFromSubAdminCity;
                                                    finalCityId = city_detail._id;
                                                    final_city_details = city_detail;
                                                }
                                            }
                                        }
                                        if (count == size) {
                                            if (finalCityId != null) {

                                                if(req.headers.type == TYPE_VALUE.DISPATCHER){
                                                    let dispatcher_detail = await Dispatcher.findById(req.headers.admin_id)
                                                    
                                                    if(dispatcher_detail && dispatcher_detail.city_ids.length > 0 ){
                                                        if(!dispatcher_detail.city_ids.includes(finalCityId)){
                                                            return res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_NO_PERMISSION_IN_CITY
                                                            }); 
            
                                                        }
                                                    }
                                                    
                                                }

                                                let city_id = finalCityId;
                                                RedZoneArea.find({cityid: city_id}).then((red_zone_area_list)=>{
                                                    let inside_red_zone = false;
                                                    red_zone_area_list.forEach(function(red_zone_area_data, index){
                                                        let inside_zone = geolib.isPointInside(
                                                            {
                                                                latitude: Number(req.body.latitude),
                                                                longitude: Number(req.body.longitude)
                                                            }, red_zone_area_data.kmlzone);
                                                        if (inside_zone) {
                                                            inside_red_zone = true;
                                                        }
                                                    })
                                                    if(!inside_red_zone){
                                                        CityZone.find({cityid: city_id}).then((zone_list)=>{
                                                            let zone_id = null;
                                                            zone_list.forEach(function(zone_data, index){
                                                                let inside_zone = geolib.isPointInside(
                                                                    {
                                                                        latitude: Number(req.body.latitude),
                                                                        longitude: Number(req.body.longitude)
                                                                    }, zone_data.kmlzone);
                                                                if (inside_zone) {
                                                                    zone_id = zone_data._id;
                                                                }
                                                            });

                                                            let city_type_to_type_query = {
                                                                $lookup:
                                                                    {
                                                                        from: "types",
                                                                        localField: "typeid",
                                                                        foreignField: "_id",
                                                                        as: "type_details"
                                                                    }
                                                            };
                                                            let array_to_json = {$unwind: "$type_details"};

                                                            let countryid_condition = {$match: {'countryid': {$eq: country_id}}};
                                                            let cityid_condition = {$match: {'cityid': {$eq: city_id}}};
                                                            let buiesness_condotion = { $match: { 'is_business': { $eq: 1 } } };
                                                            let is_ride_share_condition = { $match: { 'is_ride_share': { $eq: 0 } } };
                                                            let rrr = { "$redact": { "$cond": [{ '$eq': ["$type_details.is_business", 1] }, "$$KEEP", "$$PRUNE"] } }

                                                            let lookup = {
                                                                $lookup:
                                                                {
                                                                    from: "city_types",
                                                                    localField: "car_rental_ids",
                                                                    foreignField: "_id",
                                                                    as: "car_rental_list"
                                                                }
                                                            };

                                                            Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, is_ride_share_condition, city_type_to_type_query, array_to_json, rrr, lookup]).then(async (citytypes) => {
                                                                let PAYMENT_TYPES = utils.PAYMENT_TYPES();
                                                                if(zone_id){
                                                                    citytypes.forEach(function(citytype_data){
                                                                        if(citytype_data.rich_area_surge){
                                                                            let zone_index = citytype_data.rich_area_surge.findIndex((x) => (x.id).toString() == zone_id.toString());
                                                                            if(zone_index !== -1 && citytype_data.rich_area_surge[zone_index].surge_multiplier>0){
                                                                                citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                            }
                                                                        }
                                                                    })
                                                                }
                                                                citytypes.forEach(function(citytype_data){
                                                                    if(citytype_data.is_car_rental_business){
                                                                        let car_rental_list = citytype_data.car_rental_list;
                                                                        citytype_data.car_rental_list = [];
                                                                        car_rental_list.forEach(function(car_rental_data){
                                                                            if(car_rental_data.is_business){
                                                                                citytype_data.car_rental_list.push(car_rental_data);
                                                                            }
                                                                        })
                                                                    } else {
                                                                        citytype_data.car_rental_list = [];
                                                                    }
                                                                });
                                                                let pooltypes = []
                                                                if (setting_detail.is_allow_ride_share) {
                                                                    let is_ride_share_condition = { $match: { 'is_ride_share': { $eq: 1 } } };
                                                                    let rrr = { "$redact": { "$cond": [{ '$eq': ["$type_details.is_business", 1] }, "$$KEEP", "$$PRUNE"] } }
                                                                    pooltypes = await Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, is_ride_share_condition, city_type_to_type_query, array_to_json, rrr])
                                                                    pooltypes.forEach(function(citytype_data){
                                                                        if(citytype_data.rich_area_surge){
                                                                            let zone_index = citytype_data?.rich_area_surge?.findIndex((x) => (x.id).toString() == zone_id?.toString());
                                                                            if(zone_index !== -1 && citytype_data?.rich_area_surge[zone_index]?.surge_multiplier>0){
                                                                                citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                            }
                                                                        }
                                                                    })

                                                                }
                                                                let openridetypes = []
                                                                let is_openride_condition = { $match: { 'is_ride_share': { $eq: 2 } } };
                                                                let rrr = { "$redact": { "$cond": [{ '$eq': ["$type_details.is_business", 1] }, "$$KEEP", "$$PRUNE"] } }
                                                                openridetypes = await Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, is_openride_condition, city_type_to_type_query, array_to_json, rrr])
                                                                openridetypes.forEach(function(citytype_data){
                                                                    if(citytype_data.rich_area_surge){
                                                                        let zone_index = citytype_data?.rich_area_surge?.findIndex((x) => (x.id).toString() == zone_id?.toString());
                                                                        if(zone_index !== -1 && citytype_data?.rich_area_surge[zone_index]?.surge_multiplier>0){
                                                                            citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                        }
                                                                    }
                                                                })
                                                                if (citytypes.length != 0 || pooltypes.length != 0 || openridetypes.length != 0) {
                                                                    if (req.body.token !== "token") {
                                                                        if(detail && detail.corporate_ids && detail.corporate_ids.length>0){
                                                                            corporate_id = detail.corporate_ids[0].corporate_id;
                                                                        }
                                                                    }

                                                                    Corporate.findOne({_id: corporate_id}).then((corporate_detail)=>{
                                                                        let is_corporate_request = false;
                                                                        if(detail && corporate_detail && detail.corporate_ids[0].status == constant_json.CORPORATE_REQUEST_ACCEPTED && corporate_detail.is_approved){
                                                                            is_corporate_request = true;
                                                                        }

                                                                        citytypes.forEach((citytype) => {  
                                                                            if (citytype.is_surge_hours === 0 && citytype?.surge_hours?.length > 0) {
                                                                                for (const surgeHour of citytype.surge_hours) {
                                                                                    surgeHour.is_surge = false;
                                                                                }
                                                                            }
                                                                        })
                                                                        res.json({
                                                                            success: true,
                                                                            message: success_messages.MESSAGE_CODE_GET_CITYTYPE_LIST_SUCCESSFULLY,
                                                                            currency: currency,
                                                                            currencycode: currencycode,
                                                                            city_detail: final_city_details,
                                                                            payment_gateway: PAYMENT_TYPES,
                                                                            citytypes: citytypes,
                                                                            pooltypes: pooltypes,
                                                                            openridetypes:openridetypes,
                                                                            server_time: server_time,
                                                                            is_corporate_request: is_corporate_request,
                                                                            is_allow_trip_bidding: country.is_allow_trip_bidding,
                                                                            is_user_can_set_bid_price: country?.is_user_can_set_bid_price,
                                                                            driver_max_bidding_limit: country?.driver_max_bidding_limit,
                                                                            user_min_bidding_limit: country?.user_min_bidding_limit
                                                                        });
                                                                    });

                                                                } else if (count == size) {
                                                                    res.json({
                                                                        success: false,
                                                                        error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                                    });
                                                                }
                                                            });
                                                        });
                                                    } else {
                                                        res.json({
                                                            success: false,
                                                            error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                        }); 
                                                    }
                                                });


                                            } else {
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                });
                                            }
                                        }

                                    });
                                }
                            });
                        } else {
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY
                            });
                        }    

                    }
                });
                    
                
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.disptcher_city_type_list = function (req, res) {

    utils.check_request_params(req.body, [
        {name: 'subAdminCountry', type: 'string'}], function (response) {
        if (response.success) {
            let currentCityLatLong = [req.body.latitude, req.body.longitude];
            let subAdminCountry = req.body.subAdminCountry;
            Country.findOne({$and: [{$or: [{countryname: subAdminCountry},  { alpha2: {$exists: true, $eq: req.body.country_code}}]}, {isBusiness: constant_json.YES}]}).then((country) => {
        

                let server_time = new Date();
                if (!country) {
                    res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY});
                } else {
                    let currency = country.currencysign;
                    City.find({countryname: subAdminCountry, isBusiness: constant_json.YES}).then((city_details) => {

                        let count = 0;
                        let size = city_details.length;
                        let finalDistance = 1000000;
                        let finalCityId = null;
                        let final_city_details = {};
                        if ( size == 0) {
                            res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY});
                        } else {
                            city_details.forEach(function (city_detail) {
                                count++;
                                let cityLatLong = city_detail.cityLatLong;
                                let distanceFromSubAdminCity = utils.getDistanceFromTwoLocation(currentCityLatLong, cityLatLong);
                                let cityRadius = city_detail.cityRadius;

                                if (!city_detail.is_use_city_boundary) {
                                    if (distanceFromSubAdminCity < cityRadius) {
                                        if (distanceFromSubAdminCity < finalDistance) {
                                            finalDistance = distanceFromSubAdminCity;
                                            finalCityId = city_detail._id;
                                            final_city_details = city_detail;
                                        }
                                    }
                                } else {
                                    let city_zone = geolib.isPointInside(
                                        {latitude: req.body.latitude, longitude: req.body.longitude},
                                        city_detail.city_locations);
                                    if (city_zone) {
                                        if (distanceFromSubAdminCity < finalDistance) {
                                            finalDistance = distanceFromSubAdminCity;
                                            finalCityId = city_detail._id;
                                            final_city_details = city_detail;
                                        }
                                    }
                                }


                                if (count == size) {

                                    if (finalCityId != null) {
                                        let city_id = finalCityId;
                                        let city_type_to_type_query = {
                                            $lookup:
                                                {
                                                    from: "types",
                                                    localField: "typeid",
                                                    foreignField: "_id",
                                                    as: "type_details"
                                                }
                                        };
                                        let array_to_json = {$unwind: "$type_details"};

                                        let countryid_condition = {$match: {'countryid': {$eq: country._id}}};
                                        let cityid_condition = { $match: {
                                            $and : [
                                                {'cityid': city_id},
                                                {'is_ride_share': {$ne: 1}},
                                            ]}
                                          }
                                        let buiesness_condition = {$match: {'is_business': {$eq: 1}}};

                                        let rrr = {"$redact": {"$cond": [{'$eq': ["$type_details.is_business", 1]}, "$$KEEP", "$$PRUNE"]}}

                                        let lookup = {
                                            $lookup:
                                            {
                                                from: "city_types",
                                                localField: "car_rental_ids",
                                                foreignField: "_id",
                                                as: "car_rental_list"
                                            }
                                        };

                                        Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condition, city_type_to_type_query, array_to_json, rrr, lookup]).then((citytypes) => {

                                            let PAYMENT_TYPES = utils.PAYMENT_TYPES();
                                            citytypes.forEach(function(citytype_data){
                                                if(citytype_data.is_car_rental_business){
                                                    let car_rental_list = citytype_data.car_rental_list;
                                                    citytype_data.car_rental_list = [];
                                                    car_rental_list.forEach(function(car_rental_data){
                                                        if(car_rental_data.is_business){
                                                            citytype_data.car_rental_list.push(car_rental_data);
                                                        }
                                                    })
                                                } else {
                                                    citytype_data.car_rental_list = [];
                                                }
                                            });
                                            if (citytypes.length != 0) {
                                                res.json({
                                                    success: true,
                                                    message: success_messages.MESSAGE_CODE_GET_CITYTYPE_LIST_SUCCESSFULLY,
                                                    currency: currency,
                                                    city_detail: final_city_details,
                                                    payment_gateway: PAYMENT_TYPES,
                                                    citytypes: citytypes,
                                                    server_time: server_time
                                                });
                                            } else if (count == size) {
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                });
                                            }
                                        });


                                    } else {
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                        });
                                    }
                                }
                            });
                        }
                    });

                }

            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

exports.user_city_type_list = function (req, res) {
    utils.check_request_params(req.body, [
        {name: 'country', type: 'string'}], function (response) {
        if (response.success) {
            let currentCityLatLong = [req.body.latitude, req.body.longitude];
            let provider_id = req.body.provider_id;
            let country = req.body.country;
            let id;
            let table
            if (provider_id !== undefined) {
                id = req.body.provider_id;
                table = Provider;
            } else {
                id = req.body.user_id;
                table = User;
            }

            table.findOne({_id: id}).then((detail) => {
                if (detail) {
                    if (req.body.token !== null && detail.token !== req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});

                    }
                }
                Country.findOne({$and: [{$or: [{countryname: country}, {alpha2: req.body.country_code}]}, {isBusiness: constant_json.YES}]}).then((country) => {
            
                    if (!country) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY});
                    } else {

                        let country_id = country._id;
                        let currency = country.currencysign;
                        let currencycode = country.currencycode;
                        let server_time = new Date();
                        City.find({countryid: country_id, isBusiness: constant_json.YES}).then((cityList) => {

                            let size = cityList.length;
                            let count = 0;
                            if (size == 0) {
                                res.json({
                                    success: false,
                                    error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                });
                            } else {
                                let finalCityId = null;
                                let finalDistance = 1000000;
                                let final_city_details = {};
                                cityList.forEach(function (city_detail) {
                                    count++;
                                    let cityLatLong = city_detail.cityLatLong;
                                    let distanceFromSubAdminCity = utils.getDistanceFromTwoLocation(currentCityLatLong, cityLatLong);
                                    let cityRadius = city_detail.cityRadius;

                                    if (!city_detail.is_use_city_boundary) {
                                        if (distanceFromSubAdminCity < cityRadius) {
                                            if (distanceFromSubAdminCity < finalDistance) {
                                                finalDistance = distanceFromSubAdminCity;
                                                finalCityId = city_detail._id;
                                                final_city_details = city_detail;
                                            }
                                        }
                                    } else {
                                        let city_zone = geolib.isPointInside(
                                            {
                                                latitude: Number(req.body.latitude),
                                                longitude: Number(req.body.longitude)
                                            },
                                            city_detail.city_locations);
                                        if (city_zone) {
                                            if (distanceFromSubAdminCity < finalDistance) {
                                                finalDistance = distanceFromSubAdminCity;
                                                finalCityId = city_detail._id;
                                                final_city_details = city_detail;
                                            }
                                        }
                                    }
                                    if (count == size) {
                                        if (finalCityId != null) {
                                            let city_id = finalCityId;

                                            RedZoneArea.find({cityid: city_id}).then((red_zone_area_list)=>{
                                                let inside_red_zone = false;
                                                red_zone_area_list.forEach(function(red_zone_area_data, index){
                                                    let inside_zone = geolib.isPointInside(
                                                        {
                                                            latitude: Number(req.body.latitude),
                                                            longitude: Number(req.body.longitude)
                                                        }, red_zone_area_data.kmlzone);
                                                    if (inside_zone) {
                                                        inside_red_zone = true;
                                                    }
                                                })
                                                if(!inside_red_zone){
                                                    CityZone.find({cityid: city_id}).then((zone_list)=>{
                                                        let zone_id = null;
                                                        zone_list.forEach(function(zone_data, index){
                                                            let inside_zone = geolib.isPointInside(
                                                                {
                                                                    latitude: Number(req.body.latitude),
                                                                    longitude: Number(req.body.longitude)
                                                                }, zone_data.kmlzone);
                                                            if (inside_zone) {
                                                                zone_id = zone_data._id;
                                                            }
                                                        });

                                                        let city_type_to_type_query = {
                                                            $lookup:
                                                                {
                                                                    from: "types",
                                                                    localField: "typeid",
                                                                    foreignField: "_id",
                                                                    as: "type_details"
                                                                }
                                                        };
                                                        let array_to_json = {$unwind: "$type_details"};

                                                        let countryid_condition = {$match: {'countryid': {$eq: country_id}}};
                                                        let cityid_condition = {$match: {'cityid': {$eq: city_id}}};
                                                        let buiesness_condotion = {$match: {'is_business': {$eq: 1}}};

                                                        let rrr = {"$redact": {"$cond": [{'$eq': ["$type_details.is_business", 1]}, "$$KEEP", "$$PRUNE"]}}

                                                        let lookup = {
                                                            $lookup:
                                                            {
                                                                from: "city_types",
                                                                localField: "car_rental_ids",
                                                                foreignField: "_id",
                                                                as: "car_rental_list"
                                                            }
                                                        };

                                                        Citytype.aggregate([countryid_condition, cityid_condition, buiesness_condotion, city_type_to_type_query, array_to_json, rrr, lookup]).then((citytypes) => {
                                                            let PAYMENT_TYPES = utils.PAYMENT_TYPES();
                                                            if(zone_id){
                                                                citytypes.forEach(function(citytype_data){
                                                                    if(citytype_data.rich_area_surge){
                                                                        let zone_index = citytype_data.rich_area_surge.findIndex((x) => (x.id).toString() == zone_id.toString());
                                                                        if(zone_index !== -1 && citytype_data.rich_area_surge[zone_index].surge_multiplier>0){
                                                                            citytype_data.rich_area_surge_multiplier = citytype_data.rich_area_surge[zone_index].surge_multiplier;
                                                                        }
                                                                    }
                                                                })
                                                            }
                                                            if (citytypes.length != 0) {

                                                                 let corporate_id = null;
                                                                if(detail.corporate_ids && detail.corporate_ids.length>0){
                                                                    corporate_id = detail.corporate_ids[0].corporate_id;
                                                                }

                                                                Corporate.findOne({_id: corporate_id}).then((corporate_detail)=>{
                                                                    let is_corporate_request = false;
                                                                    if(corporate_detail && detail.corporate_ids[0].status == constant_json.CORPORATE_REQUEST_ACCEPTED && corporate_detail.is_approved){
                                                                        is_corporate_request = true;
                                                                    }

                                                                    res.json({
                                                                        success: true,
                                                                        message: success_messages.MESSAGE_CODE_GET_CITYTYPE_LIST_SUCCESSFULLY,
                                                                        currency: currency,
                                                                        currencycode: currencycode,
                                                                        city_detail: final_city_details,
                                                                        payment_gateway: PAYMENT_TYPES,
                                                                        citytypes: citytypes,
                                                                        server_time: server_time,
                                                                        is_corporate_request: is_corporate_request
                                                                    });
                                                                });

                                                            } else if (count == size) {
                                                                res.json({
                                                                    success: false,
                                                                    error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                                });
                                                            }
                                                        });
                                                    });
                                                } else {
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                                    }); 
                                                }
                                            });


                                        } else {
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY
                                            });
                                        }
                                    }

                                });
                            }
                        });

                    }
                });
                    
                
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};