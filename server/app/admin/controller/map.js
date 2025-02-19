let Provider = require('mongoose').model('Provider')
let City = require('mongoose').model('City')
let City_type = require('mongoose').model('city_type')
let mongoose = require('mongoose');
let utils = require('../../controllers/utils')
let Schema = mongoose.Types.ObjectId;
let Type = require('mongoose').model('Type')
let Trip = require('mongoose').model('Trip')
let Trip_history = require('mongoose').model('Trip_history')
let moment = require('moment');
const {
    HIDE_DETAILS,
    COLLECTION,
} = require('../../controllers/constant');

//get list of provider in map view
exports.provider_list_for_map = async function (req, res) {
    try {
        let query = {}
        query['is_approved'] = { $eq: 1 };
        
        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.PROVIDER, req.headers)
        if (req.body.country_id == 'all') {
            if(country_city_condition.country_id){
                query['country_id'] = { $eq: country_city_condition.country_id };
            }
            if(country_city_condition.cityid){
                query['cityid'] = { $eq: country_city_condition.cityid };
            }
        } else {
            query['country_id'] = { $eq: Schema(req.body.country_id) }
            if(country_city_condition.cityid){
                query['cityid'] = { $eq: country_city_condition.cityid };
            }
        }

        if (req.body.city_id) {
            query['cityid'] = { $eq: Schema(req.body.city_id) }
        }
        
        if (req.body.type_id == 'all') {
            query['admintypeid'] = { $ne: null }
        }else{
            query['admintypeid'] = { $eq: Schema(req.body.type_id) }
        }
        
        let type_lookup = {
            $lookup:
            {
                from: "types",
                localField: "admintypeid",
                foreignField: "_id",
                as: "type_detail"
            }
        };
        let type_unwind = {$unwind: "$type_detail"};


        let project = { $project: {
            phone:!req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1,
            country_phone_code: !req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1,
            email:!req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1,
            rate:1, 
            providerLocation:1,
            is_active:1,
            is_approved:1,
            is_available:1 ,
            is_trip:1,
            picture: 1, 
            vehicle_detail:1,
            typename:"$type_detail.typename",
            name: {$concat : [ "$first_name" , " " , "$last_name"]},
        } }

        let lookup_vehicles ={
            $lookup:
            {
                from: "vehicles",
                localField: "_id",
                foreignField: "provider_id",
                as: "vehicle_detail"
            }
        };

        let provider_list = await Provider.aggregate([{ $match: query },type_lookup, type_unwind, lookup_vehicles, project])

        res.json({ success: true, provider_list: provider_list })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

//get provider list for partner tracking
exports.fetch_provider_list = async function (req, res) {
    try {
        let city_id = req.body.city_id
        let params_array = [{ name: "city_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }

        let project = { $project: { _id: 1, first_name: 1, last_name: 1, email:!req.headers.is_show_email ?  HIDE_DETAILS.EMAIL : 1, country_phone_code: !req.headers.is_show_phone ?  HIDE_DETAILS.COUNTRY_CODE : 1, phone: !req.headers.is_show_phone ?  HIDE_DETAILS.PHONE : 1, admintypeid: 1, providerLocation: 1, is_available: 1, is_active: 1, is_approved: 1, rate: 1, vehicle_detail: 1 } }
        let query = {};
        query['providerLocation'] = { $ne: [0, 0] };
        query['cityid'] = { $eq: Schema(city_id) };
        query['is_active'] = 1;

        let lookup_vehicles ={
            $lookup:
            {
                from: "vehicles",
                localField: "_id",
                foreignField: "provider_id",
                as: "vehicle_detail"
            }
        };

        let providers = await Provider.aggregate([{ $match: query }, lookup_vehicles, project])
        res.json(providers);


    } catch (error) {
        utils.error_response(error, req, res)
    }
};

//get provider detail in partner tracking
exports.fetch_provider_detail = async function (req, res) {
    try {
        let providerid = req.body.provider_id;
        let params_array = [{ name: "provider_id", type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let query = {};
        query['_id'] = { $eq: Schema(providerid) };
        let project = { $project: { _id: 1, first_name: 1, last_name: 1, email: 1, country_phone_code: 1, phone: 1, admintypeid: 1, providerLocation: 1, is_available: 1, is_active: 1, is_approved: 1 } }
        let providers = await Provider.aggregate([{ $match: query }, project])
        res.json(providers);



    } catch (ere) {
        utils.error_response(err, req, res)
    }
};

//fetch city list
exports.fetch_all_city = async function (req, res) {
    try {
        let query = {};
        query['cityLatLong'] = { $ne: [0, 0] };
        let project = { $project: { _id: 1, cityname: 1, isBusiness: 1, cityLatLong: 1, is_use_city_boundary: 1, cityRadius: 1, city_locations: 1, } }
        
        // Country and city based restriction condition
        let country_city_condition = await utils.get_country_city_condition(COLLECTION.CITY, req.headers)
        
        let cities = await City.aggregate([{ $match: country_city_condition }, { $match: query }, project])
        res.json({ success: true, city_list: cities });

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.fetch_vehicle_type_list = async function (req, res) {
    try {
        let country_id = req.body.country_id;
        let city_id = req.body.city_id;
        let query = {}
        let query_city = {}
        if (country_id != 'all') {
            query = { $match: {countryid : { $eq: Schema(country_id) }} }
        }
        if (city_id != 'all' && city_id) {
            query = { $match: {cityid : { $eq: Schema(city_id) }} }
        }
        let lookup = {
            $lookup: {
                from: 'types',
                localField: 'typeid',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, typename: 1, unique_id: 1 } }],
                as: 'vehicle_type_details'
            }
        }
        let lookup_unwind = {
            $unwind: {
                path: "$vehicle_type_details",
                preserveNullAndEmptyArrays: false
            }
        };
        let project = { $project: { _id: 1, countryname: 1, vehicle_type_details: '$vehicle_type_details' } }
        let type_list = await City_type.aggregate([query ,{ $match: query_city }, lookup, lookup_unwind, project])
        let type_available = await Type.find({})
        let unique_array = new Set(type_list.map(value => (value.vehicle_type_details._id).toString()))
        let type_unique = type_available.filter(({ _id }) => unique_array.has(_id.toString()))
        res.json({ success: true, type_list: type_unique })
    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.fetch_heat_map = function (req, res) {
    utils.check_request_params(req.body, [], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        try {
            let condition = { is_trip_completed: 1}
            if (req.body.country_id !== "all") {
                condition.country_id = req.body.country_id
            }
            if (req.body.city_id !== "all") {
                condition.city_id = req.body.city_id
            }
            if (req.body.type_id !== "all") {
                condition.type_id = req.body.type_id
            }
            let start_date = req.body.start_date;
            let end_date = req.body.end_date;
            if (start_date != '' && start_date != undefined && end_date != '' && end_date != undefined) {
                const startDate = moment(start_date).startOf('day').toDate();
                const endDate = moment(end_date).endOf('day').toDate();
                condition.created_at =  { $gte: startDate, $lt: endDate };
            }
            let select = { _id: 0, sourceLocation: 1 }
            let trip_data = await Trip.find(condition).select(select).lean();
            let trip_history_data = await Trip_history.find(condition).select(select).lean();
            let pickup_locations = trip_data.concat(trip_history_data);

            if (pickup_locations.length == 0) {
                return res.json({ success: true ,pickup_locations : []  });
            }
            return res.json({ success: true, pickup_locations: pickup_locations });

        } catch (e) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    })
};