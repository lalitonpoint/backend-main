let OpenRide = require('mongoose').model('Open_Ride');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let utils = require('./utils');
let Settings = require('mongoose').model('Settings')
let Citytype = require('mongoose').model('city_type');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let Type = require('mongoose').model('Type');
let Card = require('mongoose').model('Card');
let Trip_Service = require('mongoose').model('trip_service');
let mongoose = require('mongoose');
let ObjectId = mongoose.Types.ObjectId;
let TripLocation = require('mongoose').model('trip_location');
let Vehicle = require('mongoose').model('Vehicle');
let pad = require('pad-left');
let moment = require('moment');
let myAnalytics = require('./provider_analytics');

let Corporate = require('mongoose').model('Corporate');
let Partner = require('mongoose').model('Partner');
let Promo_Code = require('mongoose').model('Promo_Code');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic');
let console = require('./console');
const {
    PAYMENT_GATEWAY,
    PAYMENT_STATUS,
    TYPE_VALUE,
    TRIP_STATUS,
    PROVIDER_STATUS,
    TRIP_STATUS_TIMELIME,
    TRIP_TYPE,
    OPEN_RIDE_STATUS,
    OPEN_RIDE_CANCEL_REASON
} = require('./constant');

exports.create_open_ride = async function(req,res){
    try {
        let params_array = [
            { name: 'provider_id', type: 'string' },
            { name: 'service_type_id', type: 'string' },
            {name:"type",type:"number"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }
        const setting_detail = await Settings.findOne({})
        let tripData = req.body;
        let type = req.body.type
        let Table = Provider;
        let trip_user_type = TYPE_VALUE.PROVIDER

        if(type == TYPE_VALUE.USER){
            Table = User
            trip_user_type = TYPE_VALUE.USER
        }
        
        let provider_detail = await Table.findOne({ _id: req.body.provider_id }  )
        if (!provider_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
            return;
        }
        if (provider_detail.token !== tripData.token) {
            return  res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});    
        }

        let openride = true;

        // Unused Code:
        // if (tripData.trip_type !== undefined) {
        //     trip_type = tripData.trip_type;
        // }

        let citytype = await Citytype.findOne({ _id: tripData.service_type_id })
        if (!citytype) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND })
            return;
        }
        if (citytype.is_business != 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_AREA })
            return;
        }

        let typeid = await Type.findOne({ _id: citytype.typeid })

        if (citytype.is_business != 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_AREA })
            return;
        }

        let city_id = citytype.cityid;
        let country_id = citytype.countryid;

        let country_data = await Country.findOne({ _id: country_id })
        if (!country_data) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND })
            return;
        }

        if (country_data.isBusiness != 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY })
            return;
        }

        let city_detail = await City.findOne({ _id: city_id })
        if (!city_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND });
            return;
        }
        if (city_detail.isBusiness !== 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY })
            return;
        }
        
        let received_trip_from_gender = [];
        let provider_language = [];
        let accessibility = [];
        let destination_addresses = [];

        if (tripData.received_trip_from_gender) {
            received_trip_from_gender = tripData.received_trip_from_gender;
        }

        if (tripData.provider_language) {
            provider_language = tripData.provider_language;
        }

        if (tripData.accessibility) {
            accessibility = tripData.accessibility;
        }

        let dateNow = new Date();
        let schedule_start_time = null;
        let server_start_time_for_schedule = null;
        let is_schedule_trip = false;

        if (tripData.start_time) {
            schedule_start_time = Number(tripData.start_time);
            let addMiliSec = dateNow.getTime() + +schedule_start_time;
            server_start_time_for_schedule = new Date(addMiliSec);
        }
        if (tripData.destination_addresses) {
            destination_addresses = tripData.destination_addresses;
            destination_addresses.forEach((element, index) => {
                destination_addresses[index].location = [
                    Number(destination_addresses[index].location[0]),
                    Number(destination_addresses[index].location[1])
                ]
            });
        }
        
        let provider_vehicle_detail = await Vehicle.findOne({ provider_id: provider_detail._id , is_selected:true })
        if (!provider_vehicle_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_VEHICLE_AVAILABLE });
            return;
        }
        let booking_type = [TRIP_TYPE.OPEN_RIDE]
        const provider_details = {
            unique_id: provider_detail.unique_id,
            first_name: provider_detail.first_name,
            last_name: provider_detail.last_name,
            country_phone_code: provider_detail.country_phone_code,
            phone: provider_detail.phone,
            email: provider_detail.email,
            picture: provider_detail.picture,
            rate:provider_detail.rate,
        }

        let json = {
            service_type_id: citytype._id,
            type_id: citytype.typeid,
            token: tripData.token,
            provider_details: [provider_details],
            trip_type: tripData.trip_type,
            provider_id:tripData.provider_id,
            confirmed_provider:tripData.provider_id,
            provider_vehicle_id:provider_vehicle_detail._id,
            typeid:typeid._id,
            // is_surge_hours: tripData.is_surge_hours,
            // surge_multiplier: tripData.surge_multiplier,
            source_address: tripData.source_address,
            destination_address: tripData.destination_address,
            sourceLocation: [tripData.latitude, tripData.longitude],
            providerLocation : [tripData.latitude, tripData.longitude],
            payment_gateway_type: country_data.payment_gateway_type,  // check
            destinationLocation: [],
            initialDestinationLocation: [],
            timezone: city_detail.timezone,
            // user_create_time: tripData.user_create_time,
            payment_id: tripData.payment_id, //check
            unit: city_detail.unit,
            country_id: country_id,
            city_id: city_detail._id,
            is_provider_earning_set_in_wallet: false,
            is_schedule_trip : is_schedule_trip,
            received_trip_from_gender: received_trip_from_gender,
            provider_language: provider_language,
            accessibility: accessibility,
            destination_addresses,
            vehicle_capacity: tripData.vehicle_capacity,
            luggage_allowacation: tripData.luggage_allowacation,
            created_by: tripData.created_by,
            booked_seats:0,
            schedule_start_time:schedule_start_time,
            server_start_time_for_schedule:server_start_time_for_schedule,
            booking_type :booking_type,
            source_city_name:tripData.source_city_name,
            destination_city_name:tripData.destination_city_name,
            is_provider_status:0,
            is_provider_accepted: 0,
            payment_mode:tripData.payment_mode,
            total:tripData.estimate_price,
            total_time:tripData.estimate_time,
            total_distance: tripData.estimate_distance,
            surge_multiplier : tripData?.surge_multiplier, 
            is_surge_hours : tripData?.is_surge_hours,
            openride:openride,
            is_fixed_fare:true
        }

        // json.booking_type = await utils.getTripBookingTypes(json)
        let openRide = await new OpenRide(json);
        openRide.is_tip = setting_detail.is_tip;
        openRide.is_toll = setting_detail.is_toll;

        if (tripData.d_longitude && tripData.d_latitude) {
            openRide.destinationLocation = [tripData.d_latitude, tripData.d_longitude];
            openRide.initialDestinationLocation = openRide.destinationLocation;
        }

        let currency = country_data.currencysign;
        let currencycode = country_data.currencycode;
        openRide.currency = currency;
        openRide.currencycode = currencycode;

        let trip_service = await Trip_Service.findOne({ service_type_id: tripData.service_type_id }).sort({ _id: -1 })
            if (!trip_service) {
                trip_service = new Trip_Service({
                    _id: new ObjectId(),
                    service_type_id: citytype._id,
                    city_id: citytype.cityid,
                    service_type_name: citytype.typename,
                    min_fare: citytype.min_fare,
                    typename: citytype.typename,
                });
                await trip_service.save()
            }
            openRide.trip_service_city_type_id = trip_service._id;

            openRide.trip_status = await utils.addTripStatusTimeline(openRide, TRIP_STATUS_TIMELIME.ARRIVED, trip_user_type )
            await openRide.save();
            let unique_id = pad(openRide.unique_id, 7, '0');
            let invoice_number = constant_json.INVOICE_APP_NAME_CODE + " " + constant_json.INVOICE_PROVIDER_TRIP_EARNING_CODE + " " + (moment(new Date())).format(constant_json.DATE_FORMAT_MMDDYYYY) + " " + unique_id;
            openRide.invoice_number = invoice_number;
            await openRide.save();
            let triplocation = new TripLocation({
                tripID: openRide._id,
                trip_unique_id: openRide.unique_id,
                providerStartTime: dateNow,
                providerStartLocation: [0, 0],
                startTripTime: dateNow,
                startTripLocation: [0, 0],
                endTripTime: dateNow,
                endTripLocation: [0, 0],
                providerStartToStartTripLocations: [],
                startTripToEndTripLocations: [],
                googlePathStartLocationToPickUpLocation: "",
                googlePickUpLocationToDestinationLocation: tripData.googlePickUpLocationToDestinationLocation ? tripData.googlePickUpLocationToDestinationLocation : ""
            });

            await triplocation.save();

            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_FUTURE_TRIP_CREATE_SUCCESSFULLY
            });
            return;


    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// list of user details for ride
exports.get_open_ride_users_list = async function(req,res){
    try{

        let params_array = [{name: "type_id", type: "string"},{ name: "token", type: "string" },{name:"type",type:"number"},{name:"open_ride_id",type:"string"}]
        let params_response = await utils.check_request_params_async(req.body,params_array)
        if (!params_response.success) {
            return res.json(params_response)
        }
        

        let type = req.body.type
        let Table;
        switch (type) {
            case TYPE_VALUE.USER:
                Table = User
                break;
            case TYPE_VALUE.PROVIDER:
                Table = Provider
                break;
            default:
                Table = Provider
                break;
        }
        let type_detail = await Table.findById(req.body.type_id)

        if(!type_detail){
            return res.json({success:false,error_code:error_message.ERROR_CODE_NOT_GET_YOUR_DETAIL});
        }
        if (type_detail.token !== req.body.token) {
            return  res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});    
        }

        // find trip by open_ride_id
        let trip = await OpenRide.findOne({ _id: req.body.open_ride_id })

        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            return
        }

        if (trip.user_details && trip.user_details.length > 0) {
            const userDetails = trip.user_details.filter(userDetail =>
                userDetail.booking_cancelled !== 1 &&
                userDetail.booking_cancelled_by_user !== 1 &&
                userDetail.booking_cancelled_by_provider !== 1
            )
            
            const userIds = userDetails.map(userDetail => userDetail.user_id)

            // Querying User model using the extracted user_ids
            const users = await User.aggregate([
                {
                    $match: { _id: { $in: userIds } }
                }
            ])
        
            for (const user of userDetails) {
                const index = users.findIndex(item => item._id.toString() == user.user_id)
                if (index !== -1) {
                    user.device_token = users[index].device_token
                    user.device_type = users[index].device_type
                }
            }
            
            trip.user_details = userDetails
        }

        const trip_service = await Trip_Service.findOne({ _id: trip.trip_service_city_type_id })

        if (trip_service) {
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_DETAIL_GET_SUCCESSFULLY,
                trip: trip,
                tripservice: trip_service
            })
            return   
        } else {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_SERVICE_NOT_FOUND })
            return
        }

    }catch(error){
        utils.error_response(error,res)

    }

}


// list of schedule ride when create ride by driver
exports.get_list_of_created_open_ride = async function(req,res){
    try {

        let params_array = [
            {name: "type_id", type: "string"},
            {name: "token", type: "string" },
            {name:"type",type:"number"}
            ]

        let params_response = await utils.check_request_params_async(req.body,params_array)
        if (!params_response.success) {
        return res.json(params_response)
        }

        const page = Number(req.body.page) || 1
        const limit = Number(req.body.limit) || 10

        let Table;
        switch (req.body.type) {
            case TYPE_VALUE.USER:
                Table = User
                break;
            case TYPE_VALUE.PROVIDER:
                Table = Provider
                break;
            default:
                Table = Provider
                break;
        }

        let type_detail = await Table.findById(req.body.type_id)
        if (!type_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
            return;
        }
        if (type_detail.token !== req.body.token) {
           return  res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});    
        }

        const vehicle_detail_lookup = {
            $lookup: {
                from: "vehicles",
                localField: "provider_vehicle_id",
                foreignField: "_id",
                as: "provider_vehicles_detail"
            }
        }

        const vehicle_detail_unwind = { $unwind: "$provider_vehicles_detail" }

        const type_detail_lookup = {
            $lookup: {
                from: "types",
                localField: "type_id",
                foreignField: "_id",
                as: "type_detail"
            }
        }

        const type_detail_unwind = { $unwind: "$type_detail" }

        const matchStage = {
            $match: {
                $and: [
                    { provider_id: type_detail._id },
                    { is_trip_cancelled_by_provider: { $eq: 0 } },
                    { is_trip_completed: { $eq: 0 } },
                    { is_trip_cancelled: { $eq: 0 } }
                ]
            }
        }

        const pagination = {
            $facet: {
                data: [{ $count: "tripCount" }],
                trips: [
                    { $skip: (page - 1) * limit },
                    { $limit: limit }
                ],
            },
        }
    
        const result = await OpenRide.aggregate([matchStage, vehicle_detail_lookup, vehicle_detail_unwind, type_detail_lookup, type_detail_unwind, pagination])

        const provider_open_rides = result[0].trips
        const total_page = Math.ceil((result[0]?.data[0]?.tripCount || 0) / limit)
    
        res.json({ success: true, provider_open_rides, total_page: total_page })
        
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// list of open ride for user
exports.open_ride_list_for_user = async function(req,res){
    try {
        let params_array = [
            {name: "service_type_id", type: "string"},
            {name: "token", type: "string" },
            {name:"date",type:"number"},
            {name:"type",type:"number"},
            {name:"destination_address",type:"string"},
            {name:"type_id",type:"string"},
            ]

        let params_response = await utils.check_request_params_async(req.body,params_array)
        if (!params_response.success) {
            return res.json(params_response)
        }

        let Table;
        switch (req.body.type) {
            case TYPE_VALUE.USER:
                Table = User
                break;
            case TYPE_VALUE.PROVIDER:
                Table = Provider
                break;
            default:
                Table = Provider
                break;
        }

        let type_detail = await Table.findById(req.body.type_id)
        if (!type_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
            return;
        }
        if (type_detail.token !== req.body.token) {
           return  res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});    
        }

        let citytype = await Citytype.findOne({ _id: req.body.service_type_id })
        if (!citytype) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND })
            return;
        }
        let typeid = await Type.findOne({ _id: citytype.typeid })

        let city_detail = await City.findOne({ _id: citytype.cityid })
        if (!city_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND });
            return;
        }

        if (city_detail.isBusiness !== 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY })
            return;
        }

        let vehicle_lookup = {
            $lookup:
            {
                from: "vehicles",
                localField: "provider_vehicle_id",
                foreignField: "_id",
                as: "vehicles_detail"
            }
        }
        let vehicle_unwind = {
            $unwind: {
                path: "$vehicles_detail",
                preserveNullAndEmptyArrays: true
            }
        };
        let current_date =  new Date().setHours(0, 0, 0, 0)
        let check_search_date =  new Date(req.body.date).setHours(0, 0, 0, 0);
        let date = new Date(req.body.date);
        let  start_date
        start_date = new Date(date);

        if (check_search_date > current_date) {
            start_date.setUTCHours(0, 0, 0, 0);
        } 
        start_date = start_date.toISOString();
        let  end_date
        end_date = new Date(date);
        end_date.setUTCHours(23, 59, 59, 999);
        end_date = end_date.toISOString();
        let id = new ObjectId(req.body.type_id)
        let user_ride_list = await OpenRide.aggregate([
            vehicle_lookup,vehicle_unwind,
            { $match: { $and: [
                    { typeid: { $eq: new ObjectId(typeid._id) } }, 
                    { server_start_time_for_schedule:{$gte:new Date(start_date),$lt:new Date(end_date)}},
                    { city_id: { $eq: city_detail._id } },  
                    {"destination_city_name": { $regex: new RegExp(req.body.destination_address, 'i') }},
                    { $expr: {$gt: ["$vehicle_capacity", "$booked_seats"]}},
                    { is_trip_cancelled_by_provider: { $eq: 0 } },  
                    { is_trip_completed: { $eq: 0 } },  
                    { is_trip_cancelled: { $eq: 0 } },
                    {
                        user_details: {
                          $not: {
                            $elemMatch: {
                                user_id: id
                            }
                          }
                        }
                    }
                ] } }
        ])
        res.json({ success: true, user_ride_list })
        

    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// user book ride
exports.user_book_ride = async function(req,res) {
    try {

        let params_array = [
                {name: "open_ride_id", type: "string"},
                {name: "token", type: "string" },
                {name:"country_id",type:"string"},
                {name:"user_id",type:"string"}
            ]

        let tripData = req.body
        let params_response = await utils.check_request_params_async(req.body,params_array)
        if (!params_response.success) {
            return res.json(params_response)
        }
        const setting_detail = await Settings.findOne({})
        let user_detail = await User.findOne({ _id: tripData.user_id })
        if (!user_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
            return;
        }
        if (user_detail.token !== tripData.token) {
            return  res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});    
        }

        if(user_detail.is_documents_expired){
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DOCUMENT_EXPIRED });
            return
        }

        if (user_detail.wallet < 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING })
            return
        }

        let country_data = await Country.findOne({ _id: tripData.country_id })
            if (!country_data) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND })
                return;
            }

        if (country_data.isBusiness !== 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY })
            return;
        }

        let payment_gateway_type = setting_detail.payment_gateway_type;
        if (country_data.payment_gateways && country_data.payment_gateways.length > 0) {
            payment_gateway_type = country_data.payment_gateways[0];
        }

        let card = await Card.find({ user_id: tripData.user_id, payment_gateway_type: payment_gateway_type })
        if (tripData.payment_mode == Number(constant_json.PAYMENT_MODE_CARD) && ((Number(payment_gateway_type) !== PAYMENT_GATEWAY.payu) && (Number(payment_gateway_type) !== PAYMENT_GATEWAY.paypal) && (Number(payment_gateway_type) !== PAYMENT_GATEWAY.razorpay))) {
            if (card.length == 0) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
                return;
            }
        }

        let ride_detail = await OpenRide.findById(tripData.open_ride_id)

        if (!ride_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            return
        }

        // Check if the trip already started or if it is within 30 seconds of the open ride start time
        let start_date = new Date();
        start_date = new Date(start_date.getTime() + 30 * 1000)

        console.log({og: ride_detail.server_start_time_for_schedule})
        console.log({start_date})
        if (ride_detail.server_start_time_for_schedule <= start_date) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
        }
        
        const user_detail_data = {
            user_id:user_detail._id ,
            unique_id:user_detail.unique_id ,
            first_name:user_detail.first_name ,
            last_name:user_detail.last_name ,
            country_phone_code:user_detail.country_phone_code ,
            phone:user_detail.phone ,
            email:user_detail.email ,
            picture:user_detail.picture ,
            payment_gateway_type: payment_gateway_type ,
            payment_mode:tripData.payment_mode ,
            total:ride_detail.total ,
            user_booked_time: new Date(),
            rate: user_detail.rate,
            sourceLocation: tripData.sourceLocation,
            destinationLocation: tripData.destinationLocation,
            source_address: tripData.source_address,
            destination_address: tripData.destination_address
        }


        ride_detail.user_details.push(user_detail_data)
        ride_detail.booked_seats = ride_detail.booked_seats + 1
        let provider_detail = await  Provider.findOne({_id:ride_detail.provider_id})
        let ride_id =  new ObjectId(ride_detail._id)
        const isObjectIdPresent = provider_detail.open_ride.includes(ride_id);
        if (!isObjectIdPresent) {
            provider_detail.open_ride.push(ride_detail._id)
            await provider_detail.save()
        } 

        
        await ride_detail.save()
        utils.send_socket_request(ride_detail._id, ride_detail.provider_id)
        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_NEW_TRIP, "", provider_detail.webpush_config, provider_detail.lang_code);

        res.json({ success: true, message: success_messages.MESSAGE_CODE_RIDE_BOOKED_SUCCESSFULLY })
        
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

// ride cancel by user 
exports.cancel_ride_by_user = async function(req,res){
    try {
        const params_array = [
            { name: "open_ride_id", type: "string" },
            { name: "token", type: "string" },
            { name: "user_id", type: "string" }
        ]

        let params_response = await utils.check_request_params_async(req.body, params_array)
        if (!params_response.success) {
            return res.json(params_response)
        }

        const setting_detail = await Settings.findOne({})
        let user = await User.findOne({ _id: req.body.user_id })

        if(!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND })
        } else if (user.token !== req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN })
        }

        let trip = await OpenRide.findOne({_id: req.body.open_ride_id })

        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
            return;
        }

        let provider = await Provider.findOne({_id: trip.provider_id })
        
        let index = trip.user_details.findIndex(item => item.user_id.toString() == req.body.user_id.toString())

        let trip_service = await Trip_Service.findById({ _id: trip.trip_service_city_type_id })
        let provider_profit = trip_service.provider_profit
        let cancellationCharges = trip_service.cancellation_fee

        if (index === -1) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND })
        }

        trip.user_details[index].booking_cancelled = 1 
        trip.user_details[index].booking_cancelled_by_user = 1
        trip.user_details[index].payment_status = 1
        trip.cancel_reason = req.body.cancel_reason;
        trip.user_details[index].total =  cancellationCharges
        trip.booked_seats = trip.booked_seats - 1
        user.current_trip_id = null
        const user_name = user.first_name + " " + user.last_name
        
        // For open ride we have to pass user_name and user_id for trip_status
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, TYPE_VALUE.USER, user_name, user._id)
        
        utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_USER, "", null, provider.lang_code)
        trip.markModified("user_details")

        if (provider.is_trip.includes(req.body.open_ride_id)) {

            const total_wallet_amount = utils.addWalletHistory(
                constant_json.USER_UNIQUE_NUMBER,
                user.unique_id,
                user._id,
                user.country_id,
                user.wallet_currency_code,
                trip.currencycode,
                trip.wallet_current_rate || 1,
                cancellationCharges,
                user.wallet,
                constant_json.DEDUCT_WALLET_AMOUNT, 
                constant_json.PAID_TRIP_AMOUNT,
                "Charge Of This Trip : " + trip.unique_id
            )
            user.wallet = total_wallet_amount
            trip.wallet_payment += cancellationCharges
            
            const accepted_users = trip.user_details.filter((user_detail) => {
                return user_detail.booking_cancelled === 0 && user_detail.booking_cancelled_by_user === 0 && user_detail.booking_cancelled_by_provider === 0 && user_detail.status == OPEN_RIDE_STATUS.ACCEPTED
            })
            
            if (accepted_users.length === 0) {
                let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone)
                let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY)
                
                // Set trip status
                trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, null, "System" )
                provider.open_ride.pull(new ObjectId(req.body.trip_id))
                provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
                await provider.save()
                
                trip.is_trip_end = 1
                trip.is_trip_cancelled = 1
                trip.is_trip_cancelled_by_admin = 1
                trip.cancel_reason = OPEN_RIDE_CANCEL_REASON.NO_ACCEPTED_USER_FOUND
                trip.payment_status = 1
                trip.provider_trip_end_time = new Date()
                trip.complete_date_in_city_timezone = complete_date_in_city_timezone
                trip.complete_date_tag = complete_date_tag

                let admin_currencycode = setting_detail.adminCurrencyCode
                let admin_currency = setting_detail.adminCurrency
                let countryCurrencyCode = trip.currencycode
                let currency_response = await utils.getCurrencyConvertRateAsync(1, countryCurrencyCode, admin_currencycode)
                let current_rate = 1
                if (currency_response.success) {
                    current_rate = currency_response.current_rate
                }
                
                let provider_service_fees = 0;
                let total_in_admin_currency = 0;
                let service_total_in_admin_currency = 0;
                let provider_service_fees_in_admin_currency = 0;
                
                provider_service_fees = cancellationCharges * provider_profit * 0.01;
                provider_service_fees_in_admin_currency = provider_service_fees * current_rate;

                total_in_admin_currency = cancellationCharges * current_rate;
                service_total_in_admin_currency = cancellationCharges * current_rate;

                trip.total_service_fees = trip.total_service_fees + cancellationCharges; 
                let total = 0
                for (const user_detail of trip.user_details) {
                    total += user_detail.total
                }
                trip.provider_service_fees += Number((provider_service_fees).toFixed(2))
                trip.pay_to_provider = trip.provider_service_fees
                trip.total_in_admin_currency += total_in_admin_currency
                trip.service_total_in_admin_currency += service_total_in_admin_currency
                trip.provider_service_fees_in_admin_currency += provider_service_fees_in_admin_currency
                trip.current_rate = current_rate
                trip.total = total

                trip.admin_currency = admin_currency
                trip.admin_currencycode = admin_currencycode
            }
        }
        utils.update_request_status_socket(trip._id)
        await trip.save()

        await user.save()
        res.json({ success: true, payment_status: trip.user_details[index].payment_status, message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY })
    
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.provider_accept_reject_cancel_ride = async function(req,res){
    try {
            let params_array = [
                {name: "open_ride_id", type: "string"},
                {name:"provider_id",type:"string"},
                {name:"user_id",type:"string"},
                {name:"status",type:"number"},
                {name: "token", type: "string" }
            ]

            let params_response = await utils.check_request_params_async(req.body,params_array)
            if (!params_response.success) {
                return res.json(params_response)
            }

            let provider_detail = await Provider.findOne({ _id: req.body.provider_id }  )
            if (!provider_detail) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
                return;
            }
            if (provider_detail.token !== req.body.token) {
                return  res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});    
            }

            if(req.body.status == 1){
                let accept_trip_res = await accept_open_ride(req,null)
                return res.json(accept_trip_res)
            }

            if(req.body.status == 2){
                let accept_trip_res = await rejected_open_ride(req,res)
                return res.json(accept_trip_res)
            }

            if(req.body.status == 3){
                let accept_trip_res = await cancel_open_ride(req, res, { provider: provider_detail })
                return res.json(accept_trip_res)
            }
            
            if(req.body.status == 4){
                let openride_details = await OpenRide.findOne({_id:req.body.open_ride_id})

                if(!openride_details) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND })
                    return
                }

                let open_ride_id = mongoose.Types.ObjectId(req.body.open_ride_id)

                const filteredObjects = openride_details.user_details.filter(item => 
                    item.status == 0 && item.send_req_to_provider_first_time == 0 
                );
                if (filteredObjects) {
                    await Provider.updateOne({ _id: openride_details.provider_id},
                        { $pull:  { open_ride: open_ride_id } },)  
                }
                return res.json({success:true})
            }
        
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


function accept_open_ride(req, res){
    return new Promise(async (resolve, reject) => {
        try {
            const setting_detail = await Settings.findOne({});
            let openride_details = await OpenRide.findOne({_id:req.body.open_ride_id})

            if(!openride_details) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND })
                return
            }

            let userdetails_index = openride_details.user_details.findIndex(item => item.user_id == req.body.user_id)

            if(openride_details.user_details[userdetails_index].status == 1){
                resolve({
                    success:false, 
                    error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED
                })
                return
            }

            if (userdetails_index != -1) {
                openride_details.user_details[userdetails_index].status = 1
            }
            // openride_details.booked_seats = openride_details.booked_seats + 1
            
            let user_detail = await User.findOne({ _id: openride_details.user_details[userdetails_index].user_id })  
            
            const openride_username = user_detail.first_name + " " + user_detail.last_name
            const openride_user_id = user_detail._id

            openride_details.trip_status =
                await utils.addTripStatusTimeline(
                openride_details,
                TRIP_STATUS_TIMELIME.ACCEPTED, 
                TYPE_VALUE.PROVIDER,
                null,
                null,
                openride_username,
                openride_user_id
                )

            if (user_detail) {
                if (setting_detail.sms_notification) {
                    utils.sendOtherSMS(user_detail.country_phone_code + user_detail.phone, 5, "");
                }
                utils.sendPushNotification(user_detail.device_type, user_detail.device_token, push_messages.PUSH_CODE_FOR_ACCEPT_TRIP, "", user_detail.webpush_config, user_detail.lang_code);
            }
            let open_ride_id = mongoose.Types.ObjectId(req.body.open_ride_id)

            const filteredObjects = openride_details.user_details.filter(item => 
                item.status == 0 && item.send_req_to_provider_first_time == 0 
            );
            if (filteredObjects) {
                await Provider.updateOne({ _id: openride_details.provider_id},
                    { $pull:  { open_ride: open_ride_id } },)  
            }

            utils.update_request_status_socket(openride_details._id);
            await openride_details.save()
            
            if(res){
                res.json({ 
                    success: true,
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REJECTED_TRIP,
                    openride_details
                })
            }else{
                resolve({ 
                    success:true, 
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REJECTED_TRIP,
                    openride_details
                })
            }
        }catch (error) {
            if(res){
                res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
            }else{
                resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
            }
        }

    })
}

function rejected_open_ride(req, res){
    return new Promise(async (resolve, reject) => {
        try {

            let openride_details = await OpenRide.findOne({_id:req.body.open_ride_id})

            if(!openride_details) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND })
                return
            }

            let userdetails_index = openride_details.user_details.findIndex(item => item.user_id == req.body.user_id)

            if(openride_details.user_details[userdetails_index].status == 1){
                resolve({
                    success:false, 
                    error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED
                })
                return
            }
            if (userdetails_index != -1) {
                openride_details.user_details[userdetails_index].status = 2
                openride_details.user_details[userdetails_index].booking_cancelled = 1
                openride_details.user_details[userdetails_index].booking_cancelled_by_provider = 1
                openride_details.user_details[userdetails_index].cancel_reason = req.body.cancel_reason
            }

            let open_ride_id = mongoose.Types.ObjectId(req.body.open_ride_id)

            const filteredObjects = openride_details.user_details.filter(item => 
                item.status == 0 && item.send_req_to_provider_first_time == 0 
            );
            if (filteredObjects) {
                await Provider.updateOne({ _id: openride_details.provider_id},
                    { $pull:  { open_ride: open_ride_id } },)  
            }
            openride_details.booked_seats = openride_details.booked_seats - 1
            await openride_details.save()
            utils.update_request_status_socket(openride_details._id);
            if(res){
                res.json({ 
                    success:true, 
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACCEPTED_TRIP_SUCCESSFULLY,
                    openride_details
                })
            }else{
                resolve({ 
                    success:true, 
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACCEPTED_TRIP_SUCCESSFULLY,
                    openride_details
                })
            }
        }catch (error) {
            if(res){
                res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
            }else{
                resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
            }
        }

    })
}

function cancel_open_ride(req, res, optional = {}){
    return new Promise(async (resolve, reject) => {
        try {
            let provider = optional.provider || null
            let openride_details = await OpenRide.findOne({_id:req.body.open_ride_id})

            if(!openride_details) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND })
                return
            }

            let index = openride_details.user_details.findIndex(item => item.user_id.toString() == req.body.user_id.toString())
            if (index === -1) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND })
            }

            const cancelled_user = openride_details.user_details[index]
            
            if (cancelled_user.booking_cancelled != 0 || cancelled_user.booking_cancelled_by_user != 0 || cancelled_user.booking_cancelled_by_provider != 0) {
                resolve({
                    success:false, 
                    error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED,
                })
                return
            }

            let user = await User.findById({ _id: cancelled_user.user_id })
            if (!user) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND })
            }

            openride_details.booked_seats = openride_details.booked_seats - 1
            
            if (openride_details.is_provider_status < 6) {
                cancelled_user.status = 3
                cancelled_user.booking_cancelled = 1
                cancelled_user.booking_cancelled_by_provider = 1
                cancelled_user.cancel_reason = req.body.cancel_reason
                
                const openride_username = cancelled_user.first_name + " " + cancelled_user.last_name
                const openride_user_id = cancelled_user.user_id

                openride_details.trip_status =
                  await utils.addTripStatusTimeline(
                    openride_details,
                    TRIP_STATUS_TIMELIME.TRIP_CANCELLED,
                    TYPE_VALUE.PROVIDER,
                    null,
                    null,
                    openride_username,
                    openride_user_id
                )
                
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_PROVIDER, "", user.webpush_config, user.langCode)
                
                if (provider && provider.is_trip.includes(req.body.open_ride_id)) {
                    
                    const accepted_users = openride_details.user_details.filter((user_detail) => {
                        return user_detail.booking_cancelled === 0 && user_detail.booking_cancelled_by_user === 0 && user_detail.booking_cancelled_by_provider === 0 && user_detail.status == OPEN_RIDE_STATUS.ACCEPTED
                    })
                    
                    if (accepted_users.length === 0) {
                        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), openride_details.timezone)
                        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY)
                        
                        // Set openride_details status
                        openride_details.trip_status = await utils.addTripStatusTimeline(openride_details, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, null, "System" )
                        provider.open_ride.pull(new ObjectId(req.body.trip_id))
                        provider = utils.remove_is_trip_from_provider(provider, openride_details._id, openride_details.initialDestinationLocation)
                        await provider.save()
                        
                        openride_details.is_trip_end = 1
                        openride_details.is_trip_cancelled = 1
                        openride_details.is_trip_cancelled_by_admin = 1
                        openride_details.cancel_reason = OPEN_RIDE_CANCEL_REASON.NO_ACCEPTED_USER_FOUND
                        openride_details.payment_status = 1
                        openride_details.provider_trip_end_time = new Date()
                        openride_details.complete_date_in_city_timezone = complete_date_in_city_timezone
                        openride_details.complete_date_tag = complete_date_tag
                        openride_details.provider_service_fees = 0
                        openride_details.pay_to_provider = 0
                        openride_details.total_in_admin_currency = 0
                        openride_details.service_total_in_admin_currency = 0
                        openride_details.provider_service_fees_in_admin_currency = 0
                        openride_details.total = 0
                    }
                }
                
                openride_details.markModified('user_details')
                await openride_details.save()
                  
            } else {
                let  toll = 0
                if(req.body.toll) {
                    toll = req.body.toll
                }
                
                Trip_Service.findOne({ _id: openride_details.trip_service_city_type_id }).then(async (trip_service_type) => {
                    const tax = trip_service_type.tax
                    const user_tax = trip_service_type.user_tax
                    const user_miscellaneous_fee = trip_service_type.user_miscellaneous_fee
    
                    const ride_fixed_price = cancelled_user.total
                    const tax_fee = Number((tax * 0.01 * ride_fixed_price).toFixed(2))
                    const user_tax_fee = Number((user_tax * 0.01 * ride_fixed_price).toFixed(2))
    
                    
                    cancelled_user.total = ride_fixed_price + tax_fee + user_tax_fee + user_miscellaneous_fee + parseInt(toll)
    
                    if (cancelled_user.payment_mode == constant_json.PAYMENT_MODE_CASH) {
                        cancelled_user.total_after_wallet_payment = 0
                        cancelled_user.remaining_payment = 0
                        cancelled_user.is_paid = 1
                        cancelled_user.wallet_payment = 0
                        cancelled_user.cash_payment = parseInt(cancelled_user?.total)
                        cancelled_user.is_pending_payments = 0
                        cancelled_user.user_toll_amount = toll
                        cancelled_user.payment_status = PAYMENT_STATUS.COMPLETED;
                        cancelled_user.user_ride_completed = 1
    
                        const openride_username = cancelled_user.first_name + " " + cancelled_user.last_name
                        const openride_user_id = cancelled_user.user_id
                        
                        openride_details.trip_status =
                            await utils.addTripStatusTimeline(
                            openride_details,
                            TRIP_STATUS_TIMELIME.OPEN_RIDE_USER_DROPPED,
                            TYPE_VALUE.PROVIDER,
                            null,
                            null,
                            openride_username,
                            openride_user_id
                        )
    
                        openride_details.cash_payment = cancelled_user?.total
                        openride_details.provider_have_cash = cancelled_user?.total
                        
                        openride_details.markModified('user_details')
                        await openride_details.save()
                    }
                })
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", user.webpush_config, user.langCode)
            }
            user.current_trip_id = null

            await user.save()
            utils.update_request_status_socket(openride_details._id)
            if(res){
                res.json({
                    success: true,
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_CANCELLED_SUCCESSFULLY,
                    openride_details
                })
            }else{
                resolve({ 
                    success: true,
                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_CANCELLED_SUCCESSFULLY,
                    openride_details
                })
            }
        }catch (error) {

            if(res){
                res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
            }else{
                resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
            }
        }

    })
}


exports.openride_provider_set_trip_status = async function (req, res) {
    try {
        let params_array = [
            { name: 'provider_id', type: 'string' },
            { name: 'trip_id', type: 'string' },
            { name: 'is_provider_status', type: 'number' },
            { name: 'latitude', type: 'number' },
            { name: 'longitude', type: 'number' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id });
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let trip = await OpenRide.findOne({ _id: req.body.trip_id, confirmed_provider: req.body.provider_id })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            return;
        }
        
        let filteredUserIds = trip.user_details
        .filter(item => item.booking_cancelled == 0 || item.booking_cancelled_by_user == 0 || item.booking_cancelled_by_provider == 0)
        .map(item => item.user_id);

        let user
        user = await User.aggregate([
            {
                $match: {
                    _id: { $in: filteredUserIds.map(userId => mongoose.Types.ObjectId(userId)) }
                }
                },
                {
                    $project: {
                        _id: 1,
                        device_token: 1, 
                        device_type: 1,
                    }
                }
            
            ]);
              
        if (!(trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_provider == 0)) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_MISMATCH_PROVIDER_ID_OR_TRIP_ID });
            return;
        }

        let is_provider_status = Number(req.body.is_provider_status);
        let timeline_status;
        let now = new Date();
        if (is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
            if (trip.actual_destination_addresses.length == 0) {
                trip.provider_trip_start_time = now;
            }
            trip.total_distance = 0 
            trip.total_time = 0
            trip.fixed_price = trip.total
            //Old Code:
            // if (trip?.is_otp_verification && trip.actual_destination_addresses.length == 0 && req.body.user_type != TYPE_VALUE.ADMIN) {
            //     let confirmation_code = req.body.trip_start_otp;
            //     if (trip.confirmation_code != confirmation_code) {
            //         res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TRIP_START_OTP });
            //         return;
            //     }
            // }
            // if (trip.destination_addresses.length != 0) {
            //     let provider_arrived_time = trip.provider_arrived_time
            //     if (trip.actual_destination_addresses.length != 0) {
            //         provider_arrived_time = trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].arrived_time;
            //     }
            //     let waiting_time = utils.getTimeDifferenceInMinute(now, provider_arrived_time);
            //     if (waiting_time < 0) {
            //         waiting_time = 0;
            //     }
            //     trip.actual_destination_addresses.push({
            //         address: '',
            //         location: [],
            //         arrived_time: null,
            //         start_time: new Date(),
            //         total_time: 0,
            //         waiting_time: Number(waiting_time)
            //     });
            //     trip.markModified('actual_destination_addresses');
            // }
        }

        if (is_provider_status == is_provider_status == PROVIDER_STATUS.ARRIVED) {
            trip.provider_arrived_time = now;
        }
        
        if(is_provider_status == PROVIDER_STATUS.TRIP_STARTED){
            timeline_status = TRIP_STATUS_TIMELIME.TRIP_STARTED;
        } else if(is_provider_status == PROVIDER_STATUS.ARRIVED){
            timeline_status = TRIP_STATUS_TIMELIME.ARRIVED;
        } else {
            timeline_status = is_provider_status;
        }

        trip.is_provider_status = is_provider_status;

        // Set trip status
        if(req.body.user_type && req.body.user_type == TYPE_VALUE.ADMIN){
            trip.trip_status = await utils.addTripStatusTimeline(trip, timeline_status, TYPE_VALUE.ADMIN, req.headers.username )
        }else{
            trip.trip_status = await utils.addTripStatusTimeline(trip, timeline_status, TYPE_VALUE.PROVIDER )
        }

        await OpenRide.updateOne({ _id: trip._id }, trip.getChanges())

        if (trip.actual_destination_addresses && trip.actual_destination_addresses.length > 1) {
            utils.update_request_status_socket(trip._id);
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_SET_TRIP_STATUS_SUCCESSFULLY,
                trip: trip
            });
            return;
        }

        let tripLocation = await TripLocation.findOne({ tripID: req.body.trip_id })
        let latlong = [Number(req.body.latitude), Number(req.body.longitude)];
        switch (is_provider_status) {
            case 2:
                tripLocation.providerStartTime = now;
                tripLocation.providerStartLocation = latlong;
                tripLocation.providerStartToStartTripLocations.push(latlong);
                break;
            case 6:
                tripLocation.startTripTime = now;
                tripLocation.startTripLocation = latlong;
                tripLocation.startTripToEndTripLocations.push(latlong);
                break;
        }
        await TripLocation.updateOne({ _id: tripLocation._id }, tripLocation.getChanges());

        let message_code;
        let providerStatusCase = trip.is_provider_status;
        switch (providerStatusCase) {
            case 2:
                message_code = push_messages.PUSH_CODE_FOR_PROVIDER_COMMING_YOUR_LOCATION;
                break;
            case 4:
                message_code = push_messages.PUSH_CODE_FOR_PROVIDER_ARRIVED;
                break;
            case 6:
                message_code = push_messages.PUSH_CODE_FOR_YOUR_TRIP_STARTED;
                break;
        }
        if (message_code) {
            for (const current_user of user) {
                utils.sendPushNotification(current_user.device_type, current_user.device_token, message_code, "", current_user.webpush_config, current_user.langCode);
            }
        }
        utils.update_request_status_socket(trip._id,null,trip.is_provider_status);
        if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
            utils.get_service_id_socket(trip.user_type_id)
        }

        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_SET_TRIP_STATUS_SUCCESSFULLY,
            trip: trip
        });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.openride_provider_complete_trip = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }, { name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        OpenRide.findOne({
                            _id: req.body.trip_id,
                            confirmed_provider: req.body.provider_id,
                            is_trip_completed: 0,
                            is_trip_end: 0
                        }).then(async (trip) => {
                            if (trip) {
                                if (trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_provider == 0) {

                                    let city_timezone = trip.timezone;
                                   
                                        if(req.body.complete_by_admin){
                                            let distance = req.body.total_distance;
                                            let distanceKmMile;
                                            if (trip.unit == 1) {
                                                distanceKmMile = distance * 0.001;
                                            } else {
                                                distanceKmMile = distance * 0.000621371;
                                            }
                                            trip.total_distance = distanceKmMile
                                        }
                                        let total_distance = Number((trip.total_distance).toFixed(2));
                                        let total_time = Number((trip.total_time).toFixed(2));
                                        let total_stop_waiting_time = 0;
                                        let distance_cost = 0;
                                        let time_cost = 0;
                                        let waiting_time_cost = 0;
                                        let stop_waiting_time_cost = 0;
                                        let total_service_fees = 0;
                                        let tax_fee = 0;
                                        let provider_tax_fee = 0;
                                        let total_after_tax_fees = 0;
                                        let surge_fee = 0;
                                        let total_after_surge_fees = 0;
                                        let promo_payment = 0;
                                        let total_after_promo_payment = 0;

                                        let total = 0;
                                        let is_min_fare_used = 0;
                                        let user_tax_fee = 0;
                                        let is_surge_hours = trip.is_surge_hours;
                                        let total_time_end = 0;
                                        let now = new Date();
                                        let dateNow = new Date();
                                        total_time_end = utils.getTimeDifferenceInMinute(dateNow, trip.provider_trip_start_time);
                                        if (total_time_end > total_time) {
                                            total_time = total_time_end;
                                        }

                                        if (total_time < 0) {
                                            total_time = 0;
                                        }
                                        trip.total_time = total_time;

                                        TripLocation.findOne({ tripID: req.body.trip_id }).then(async (tripLocation) => {
                                            tripLocation.endTripTime = now;

                                            let total_distance_diff = 0;
                                            let start_end_Location = tripLocation.startTripToEndTripLocations;
                                            if (req.body.location && req.body.location.length > 0) {
                                                let prev_location = [Number(start_end_Location[0][0]), Number(start_end_Location[0][1])]
                                                let time = provider.location_updated_time;
                                                for (const location_data of req.body.location) {
                                                    let location = [Number(location_data[0]), Number(location_data[1])];
                                                    start_end_Location.push(location);
                                                    let distance_diff = Math.abs(utils.getDistanceFromTwoLocation(prev_location, location));
                                                    let time_diff = Math.abs(utils.getTimeDifferenceInSecond(new Date(time), new Date(Number(location_data[2]))));
                                                    let max_distance = 0.05;
                                                    if ((distance_diff < max_distance * time_diff && distance_diff > 0.005) || (distance_diff < max_distance && time_diff == 0)) {
                                                        total_distance_diff = total_distance_diff + distance_diff;
                                                        time = Number(location_data[2]);
                                                        prev_location = location;
                                                    }
                                                }
                                                if (trip.unit == 0) { /// 0 = mile
                                                    total_distance_diff = total_distance_diff * 0.621371;
                                                }
                                                trip.total_distance = (+trip.total_distance + +total_distance_diff).toFixed(2);
                                                total_distance = trip.total_distance;
                                            }

                                            if (!req.body.latitude || !req.body.longitude) {
                                                req.body.latitude = tripLocation.startTripToEndTripLocations[tripLocation.startTripToEndTripLocations.length - 1][0]
                                                req.body.longitude = tripLocation.startTripToEndTripLocations[tripLocation.startTripToEndTripLocations.length - 1][1]
                                            }

                                            start_end_Location.push([req.body.latitude, req.body.longitude]);
                                            start_end_Location = await utils.removeDuplicateCoordinates(start_end_Location);

                                            if (!req.body.complete_by_admin) {
                                                let distanceKmMile;
                                                let distance = await utils.calculateDistanceFromCoordinates(start_end_Location) * 1000
                                                if (trip.unit == 1) {
                                                    distanceKmMile = distance * 0.001;
                                                } else {
                                                    distanceKmMile = distance * 0.000621371;
                                                }
                                                trip.total_distance = distanceKmMile
                                                total_distance = trip.total_distance;
                                            }

                                            tripLocation.startTripToEndTripLocations = start_end_Location;
                                            tripLocation.endTripLocation = [req.body.latitude, req.body.longitude];

                                            let url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.latitude + "," + req.body.longitude + "&key=" + setting_detail.web_app_google_key;
                                            let request_data = require('request');
                                            if (!req.body.destination_address) {
                                                request_data(url, function (error, response, body) {
                                                    if (body.status == 'OK') {
                                                        req.body.destination_address = body.results[0].formatted_address;
                                                    }
                                                });
                                            }
                                            tripLocation.googlePathStartLocationToPickUpLocation = "";
                                            tripLocation.googlePickUpLocationToDestinationLocation = "";
                                            tripLocation.actual_startTripToEndTripLocations = tripLocation.startTripToEndTripLocations;
                                            tripLocation.save().then(() => {

                                                if (trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1]) {
                                                    trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].address = req.body.destination_address;
                                                    trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].location = [Number(req.body.latitude), Number(req.body.longitude)];
                                                    trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].arrived_time = now;

                                                    let actual_destination_time_diff = Math.abs(utils.getTimeDifferenceInMinute(now, trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].start_time));
                                                    if (actual_destination_time_diff < 0) {
                                                        actual_destination_time_diff = 0
                                                    }
                                                    trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].total_time = actual_destination_time_diff;
                                                    trip.markModified('actual_destination_addresses');
                                                }

                                                let index = tripLocation.index_for_that_covered_path_in_google;
                                                let startTripToEndTripLocations = tripLocation.startTripToEndTripLocations;
                                                let size = startTripToEndTripLocations.length;
                                                let gap = 95;
                                                let start_index = index * gap;
                                                let end_index = size;
                                                start_index--;
                                                if (start_index < 0) {
                                                    start_index = 0;
                                                }
                                                let locations = [];

                                                for (; start_index < end_index; start_index++) {
                                                    locations.push(startTripToEndTripLocations[start_index]);
                                                }

                                                utils.getSmoothPath(locations, function (getSmoothPathresponse) {

                                                    utils.bendAndSnap(getSmoothPathresponse, locations.length, function (response) {

                                                        if (response) {
                                                            let index = tripLocation.index_for_that_covered_path_in_google;
                                                            let google_start_trip_to_end_trip_locations = tripLocation.google_start_trip_to_end_trip_locations;
                                                            google_start_trip_to_end_trip_locations = google_start_trip_to_end_trip_locations.concat(response.temp_array);
                                                            tripLocation.google_start_trip_to_end_trip_locations = google_start_trip_to_end_trip_locations;
                                                            let google_total_distance = +tripLocation.google_total_distance + +response.distance;
                                                            tripLocation.google_total_distance = google_total_distance;
                                                            index++;
                                                            tripLocation.index_for_that_covered_path_in_google = index;
                                                            tripLocation.startTripToEndTripLocations = tripLocation.google_start_trip_to_end_trip_locations;
                                                            tripLocation.save();

                                                            let distance_diff = total_distance - google_total_distance;
                                                            if (distance_diff > 0.5 || distance_diff < -0.5) {
                                                                total_distance = (google_total_distance).toFixed(2);

                                                                if (trip.unit == 0) { /// 0 = mile
                                                                    total_distance = total_distance * 0.621371;
                                                                }

                                                                trip.total_distance = total_distance;
                                                            }
                                                        }

                                                        Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                                                            var selected_vehicle = await Vehicle.findOne({provider_id: provider._id, is_selected: true});
                                                            City.findOne({ _id: trip.city_id }).then(async () => {
                                                                let country_data = await Country.findOne({_id: provider.country_id})
                                                                provider.providerLocation = [Number(req.body.latitude), Number(req.body.longitude)];
                                                                provider.bearing = req.body.bearing;
                                                                provider.save();
                                                                if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                                                                    wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.latitude), Number(req.body.longitude)], true, provider.location_updated_time);
                                                                }

                                                                Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then(async (tripservice) => {

                                                                    let surge_multiplier = 0;
                                                                    let min_fare = 0;
                                                                    let base_price = 0;
                                                                    let base_price_distance = 0;
                                                                    let tax = 0;
                                                                    let user_miscellaneous_fee = 0;
                                                                    let provider_miscellaneous_fee = 0;
                                                                    let user_tax = 0;
                                                                    let provider_tax = 0;
                                                                    let provider_profit = 0;
                                                                    let price_per_unit_distance = 0;
                                                                    let price_for_total_time = 0;
                                                                    let waiting_time_start_after_minute_multiple_stops = 0;
                                                                    let base_price_time = 0;
                                                                    let total_after_user_tax_fees = 0;
                                                                    ///////////////// Distance cost and Time cost calculation /////
                                                                    trip.is_provider_status = 9;
                                                                    // DISTANCE CALCULATIONS
                                                                    trip.destination_address = req.body.destination_address;
                                                                    trip.destinationLocation = [req.body.latitude, req.body.longitude];
                                                                    trip.provider_trip_end_time = now;

                                                                    let toll_amount = req.body.toll_amount;

                                                                    if (toll_amount == undefined) {
                                                                        toll_amount = 0;
                                                                    }

                                                                    let trip_type_amount = trip.trip_type_amount;
                                                                    provider_miscellaneous_fee = tripservice.provider_miscellaneous_fee;
                                                                    provider_tax = tripservice.provider_tax;

                                                                    provider_profit = tripservice.provider_profit;

                                                                    if (trip.is_fixed_fare && trip.fixed_price > 0) {
                                                                        tax = tripservice.tax;
                                                                        user_miscellaneous_fee = tripservice.user_miscellaneous_fee;
                                                                        user_tax = tripservice.user_tax;

                                                                        total_after_surge_fees = trip.fixed_price;
                                                                        trip.total_service_fees = total_after_surge_fees;
                                                                        tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.tax_fee = tax_fee;
                                                                        total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                                                                        user_tax_fee = Number((user_tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.user_tax_fee = user_tax_fee;
                                                                        trip.user_miscellaneous_fee = user_miscellaneous_fee;
                                                                    } 
                                                                    else if (trip.trip_type == constant_json.TRIP_TYPE_AIRPORT) {
                                                                        tax = tripservice.tax;
                                                                        user_miscellaneous_fee = tripservice.user_miscellaneous_fee;
                                                                        user_tax = tripservice.user_tax;

                                                                        total_after_surge_fees = trip_type_amount;
                                                                        trip.total_service_fees = total_after_surge_fees;

                                                                        total_after_surge_fees = utils.get_reverse_service_fee(total_after_surge_fees, tax)
                                                                        trip.fixed_price = total_after_surge_fees;
                                                                        tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.tax_fee = tax_fee;
                                                                        total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                                                                        user_tax_fee = Number((user_tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.user_tax_fee = user_tax_fee;
                                                                        trip.user_miscellaneous_fee = user_miscellaneous_fee;
                                                                    } 
                                                                    else if (trip.trip_type == constant_json.TRIP_TYPE_ZONE || trip.trip_type == constant_json.TRIP_TYPE_CITY) {
                                                                        tax = tripservice.tax;
                                                                        user_miscellaneous_fee = tripservice.user_miscellaneous_fee;
                                                                        user_tax = tripservice.user_tax;
                                                                        total_after_surge_fees = trip_type_amount;
                                                                        trip.total_service_fees = total_after_surge_fees;
                                                                        total_after_surge_fees = utils.get_reverse_service_fee(total_after_surge_fees, tax)
                                                                        trip.fixed_price = total_after_surge_fees;
                                                                        tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.tax_fee = tax_fee;
                                                                        total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                                                                        user_tax_fee = Number((user_tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.user_tax_fee = user_tax_fee;
                                                                        trip.user_miscellaneous_fee = user_miscellaneous_fee;
                                                                    } else if (trip.car_rental_id) {
                                                                        if (trip.surge_multiplier) {
                                                                            surge_multiplier = trip.surge_multiplier;
                                                                        }
                                                                        min_fare = tripservice.min_fare;
                                                                        base_price = tripservice.base_price;
                                                                        base_price_distance = tripservice.base_price_distance;
                                                                        tax = tripservice.tax;
                                                                        user_miscellaneous_fee = tripservice.user_miscellaneous_fee;
                                                                        user_tax = tripservice.user_tax;

                                                                        price_per_unit_distance = tripservice.price_per_unit_distance;
                                                                        price_for_total_time = tripservice.price_for_total_time;
                                                                        if (total_distance <= base_price_distance) {
                                                                            distance_cost = 0;
                                                                        } else {
                                                                            distance_cost = Number(((total_distance - base_price_distance) * price_per_unit_distance).toFixed(2));
                                                                        }

                                                                        trip.distance_cost = distance_cost;

                                                                        // TIME CALCULATIONS
                                                                       
                                                                        base_price_time = tripservice.base_price_time;
                                                                        if (total_time < base_price_time) {
                                                                            time_cost = 0;
                                                                        } else {
                                                                            time_cost = (total_time - base_price_time) * price_for_total_time;
                                                                        }
                                                                        time_cost = Number((time_cost).toFixed(2));
                                                                        trip.time_cost = time_cost;


                                                                        total_service_fees = +base_price + +distance_cost + +time_cost + +waiting_time_cost;
                                                                        trip.total_service_fees = total_service_fees;
                                                                        if (is_surge_hours == constant_json.YES) {
                                                                            surge_fee = Number((total_service_fees * (surge_multiplier - 1)).toFixed(2));
                                                                            trip.surge_fee = surge_fee;
                                                                            total_after_surge_fees = total_service_fees + surge_fee;
                                                                            total_after_surge_fees = Number((total_after_surge_fees).toFixed(2));
                                                                        } else {
                                                                            surge_fee = 0;
                                                                            trip.surge_fee = surge_fee;
                                                                            total_after_surge_fees = total_service_fees;
                                                                            total_after_surge_fees = Number((total_after_surge_fees).toFixed(2));
                                                                        }

                                                                        tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.tax_fee = tax_fee;
                                                                        total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                                                                        if (total_after_tax_fees < min_fare) {
                                                                            total_after_tax_fees = min_fare;
                                                                            is_min_fare_used = 1;

                                                                            total_after_surge_fees = utils.get_reverse_service_fee(min_fare, tax)

                                                                            tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                            trip.tax_fee = tax_fee;
                                                                            total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                                                                        }
                                                                        trip.is_min_fare_used = is_min_fare_used;

                                                                        user_tax_fee = Number((user_tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.user_tax_fee = user_tax_fee;
                                                                        trip.user_miscellaneous_fee = user_miscellaneous_fee;
                                                                    } 
                                                                    else {
                                                                        if (trip.surge_multiplier) {
                                                                            surge_multiplier = trip.surge_multiplier;
                                                                        }
                                                                        min_fare = tripservice.min_fare;
                                                                        base_price = tripservice.base_price;
                                                                        base_price_distance = tripservice.base_price_distance;
                                                                        tax = tripservice.tax;
                                                                        user_miscellaneous_fee = tripservice.user_miscellaneous_fee;
                                                                        user_tax = tripservice.user_tax;

                                                                        price_per_unit_distance = tripservice.price_per_unit_distance;
                                                                        price_for_total_time = tripservice.price_for_total_time;
                                                                        
                                                                        if (total_distance <= base_price_distance) {
                                                                            distance_cost = 0;
                                                                        } else {
                                                                            distance_cost = Number(((total_distance - base_price_distance) * price_per_unit_distance).toFixed(2));
                                                                        }
                                                                        trip.distance_cost = distance_cost;
                                                                        // TIME CALCULATIONS
                                                                        if (time_cost < 0) {
                                                                            time_cost = 0;
                                                                        }
                                                                        if (trip.actual_destination_addresses) {
                                                                            trip.actual_destination_addresses.forEach(destination_address => {
                                                                                total_time = total_time - destination_address.waiting_time
                                                                            });
                                                                        }
                                                                        if (total_time < 0) {
                                                                            total_time = 0
                                                                        }
                                                                        time_cost = total_time * price_for_total_time;
                                                                        time_cost = Number((time_cost).toFixed(2));
                                                                        trip.time_cost = time_cost;
                                                                        
                                                                        if (trip.actual_destination_addresses) {
                                                                            if (setting_detail.is_multiple_stop_waiting_free_on_each_stop) {
                                                                                trip.actual_destination_addresses.forEach(destination_address => {
                                                                                    if ((destination_address.waiting_time - waiting_time_start_after_minute_multiple_stops) > 0) {
                                                                                        total_stop_waiting_time += destination_address.waiting_time;
                                                                                    }
                                                                                });
                                                                            } else {
                                                                                trip.actual_destination_addresses.forEach(destination_address => {
                                                                                    total_stop_waiting_time += destination_address.waiting_time;
                                                                                });
                                                                                total_stop_waiting_time = total_stop_waiting_time - waiting_time_start_after_minute_multiple_stops;
                                                                                if (total_stop_waiting_time < 0) {
                                                                                    total_stop_waiting_time = 0;
                                                                                }
                                                                            }
                                                                        }
                                                                        


                                                                        total_service_fees = +base_price + +distance_cost + +time_cost + +waiting_time_cost + +stop_waiting_time_cost;
                                                                        trip.total_service_fees = total_service_fees;
                                                                       
                                                                        if (is_surge_hours == constant_json.YES) {
                                                                            surge_fee = Number((total_service_fees * (surge_multiplier - 1)).toFixed(2));
                                                                            trip.surge_fee = surge_fee;
                                                                            total_after_surge_fees = total_service_fees + surge_fee;
                                                                            total_after_surge_fees = Number((total_after_surge_fees).toFixed(2));
                                                                        } else {
                                                                            surge_fee = 0;
                                                                            trip.surge_fee = surge_fee;
                                                                            total_after_surge_fees = total_service_fees;
                                                                            total_after_surge_fees = Number((total_after_surge_fees).toFixed(2));
                                                                        }

                                                                        tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.tax_fee = tax_fee;
                                                                        total_after_tax_fees = +total_after_surge_fees + +tax_fee;

                                                                        if (total_after_tax_fees < min_fare) {
                                                                            total_after_tax_fees = min_fare;
                                                                            is_min_fare_used = 1;

                                                                            total_after_surge_fees = utils.get_reverse_service_fee(min_fare, tax)

                                                                            tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                            trip.tax_fee = tax_fee;
                                                                            total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                                                                        }
                                                                        trip.is_min_fare_used = is_min_fare_used;

                                                                        user_tax_fee = Number((user_tax * 0.01 * total_after_surge_fees).toFixed(2));
                                                                        trip.user_tax_fee = user_tax_fee;
                                                                        trip.user_miscellaneous_fee = user_miscellaneous_fee;
                                                                    }
                                                                    trip.total_after_tax_fees = total_after_tax_fees;
                                                                    trip.total_after_surge_fees = total_after_surge_fees;

                                                                    // Set booking type
                                                                    // trip.booking_type = await utils.getTripBookingTypes(trip)

                                                                    // Set trip status
                                                                    trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_COMPLETED, TYPE_VALUE.PROVIDER )
                                                                    
                                                                    ///////////////////////// FOR INVOICE //////////////////////////
                                                                    let current_rate = 1;
                                                                    let countryCurrencyCode = trip.currencycode;
                                                                    let adminCurrencyCode = trip.currencycode;
                                                                    let adminCurrency = trip.currency;
                                                                    trip.payment_status = 1;

                                                                    adminCurrencyCode = setting_detail.adminCurrencyCode;
                                                                    adminCurrency = setting_detail.adminCurrency;

                                                                    utils.getCurrencyConvertRate(1, countryCurrencyCode, adminCurrencyCode, function (response) {

                                                                        if (response.success) {
                                                                            current_rate = response.current_rate;
                                                                        } else {
                                                                            current_rate = 1;
                                                                        }

                                                                        trip.current_rate = current_rate;

                                                                        Promo_Code.findOne({ _id: trip.promo_id }).then(async (promocode) => {


                                                                            let filteredUser = trip.user_details
                                                                                .filter(item => item.booking_cancelled == 0 && item.booking_cancelled_by_user == 0 && item.booking_cancelled_by_provider == 0 && item.status == OPEN_RIDE_STATUS.ACCEPTED)
                                                                                
                                                                            const filteredUserIds = filteredUser.map(item => item.user_id)

                                                                            total_after_user_tax_fees = +total_after_tax_fees + +user_miscellaneous_fee + +user_tax_fee;

                                                                            promo_payment = 0;
                                                                            total_after_promo_payment = Number((total_after_user_tax_fees).toFixed(2));
                                                                            trip.promo_payment = promo_payment;
                                                                            trip.total_after_promo_payment = total_after_promo_payment;

                                                                            trip.total_after_referral_payment = total_after_promo_payment;
                                                                            ////////ENTRY IN PROVIDER EARNING TABLE ///////////

                                                                            trip.toll_amount = toll_amount;                                                                            
                                                                            let promo_referral_amount = promo_payment;
                                                                            total = total_after_promo_payment;
                                                                            
                                                                            let user 
                                                                            user = await User.find({ _id: { $in: filteredUserIds } }).select({ _id: 1, device_token: 1, device_type: 1 }).lean()

                                                                            const remaining_trip_user = filteredUser.filter(user => user.user_ride_completed !== 1)
                                                                            const count_of_remaining_trip_users = remaining_trip_user.length;

                                                                            toll_amount = parseInt(toll_amount) / parseInt(count_of_remaining_trip_users)
                                                                            
                                                                            remaining_trip_user.forEach((user) => {
                                                                                user.user_toll_amount = toll_amount
                                                                                user.total = total + toll_amount
                                                                                user.user_ride_completed = 1
                                                                            })

                                                                            let total_toll = 0                                                                            
                                                                            let user_total = 0
                                                                            for (const user_detail of trip.user_details) {
                                                                                total_toll += user_detail.user_toll_amount
                                                                                user_total += user_detail.total
                                                                            }
                                                                            
                                                                            trip.toll_amount = total_toll
                                                                            trip.total = user_total
                                                                            
                                                                            total_after_user_tax_fees = total_after_user_tax_fees * filteredUser.length     // Multiply the "total_after_user_tax_fees" by the number of users who are present in the ride
                                                                            total_after_tax_fees = total_after_tax_fees * filteredUser.length       // Multiply the "total_after_tax_fees" by the number of users who are present in the ride

                                                                            let service_total_in_admin_currency = Number((total_after_user_tax_fees * current_rate).toFixed(3))
                                                                            let provider_profit_fees = Number((total_after_tax_fees * provider_profit * 0.01).toFixed(2))

                                                                            provider_tax_fee = Number((provider_tax * 0.01 * provider_profit_fees).toFixed(2))
                                                                            trip.provider_miscellaneous_fee = provider_miscellaneous_fee
                                                                            trip.provider_tax_fee = provider_tax_fee

                                                                            let provider_service_fees = +provider_profit_fees + +total_toll - provider_miscellaneous_fee - provider_tax_fee
                                                                            let provider_service_fees_in_admin_currency = Number((provider_service_fees * current_rate).toFixed(3))

                                                                            let total_in_admin_currency = Number((total * current_rate).toFixed(3));
                                                                            trip.total_after_user_tax_fees = total_after_user_tax_fees
                                                                            trip.base_distance_cost = base_price;
                                                                            trip.admin_currency = adminCurrency;
                                                                            trip.admin_currencycode = adminCurrencyCode;
                                                                            trip.provider_service_fees = provider_service_fees;
                                                                            trip.provider_profit_fees = provider_profit_fees;
                                                                            trip.total_in_admin_currency = total_in_admin_currency;
                                                                            trip.service_total_in_admin_currency = service_total_in_admin_currency;
                                                                            trip.provider_service_fees_in_admin_currency = provider_service_fees_in_admin_currency;
                                                                            trip.promo_referral_amount = promo_referral_amount;
                                                                            
                                                                            let wallet_currency_code = user.wallet_currency_code;
                                                                            if (wallet_currency_code == "" || !wallet_currency_code) {
                                                                                wallet_currency_code = setting_detail.adminCurrencyCode;
                                                                            }
                                                                            utils.getCurrencyConvertRate(1, wallet_currency_code, countryCurrencyCode, function (response) {
                                                                                let wallet_current_rate = 1;
                                                                                if (response.success) {
                                                                                    wallet_current_rate = response.current_rate;
                                                                                }

                                                                                trip.wallet_current_rate = wallet_current_rate;
                                                                                
                                                                                trip.save().then(async () => {
                                                                                    let country = await Country.findById(trip.country_id)
                                                                                    myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, TRIP_STATUS.TRIP_COMPLETED,null, country._id);
                                                                                    console.log('update_request_status_socket')
                                                                                    utils.update_request_status_socket(trip._id,null,trip.is_provider_status);
                                                                                    if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                                                                                        utils.get_service_id_socket(trip.user_type_id)
                                                                                    }

                                                                                    await utils.generate_admin_profit(trip, user)                                                    
                                                                                    res.json({
                                                                                        success: true,
                                                                                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                                                                        trip: trip,
                                                                                        tripservice: tripservice
                                                                                    });

                                                                                }, (err) => {
                                                                                    console.log(err);
                                                                                    res.json({
                                                                                        success: false,
                                                                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                                                                    });
                                                                                });
                                                                            });

                                                                        });

                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    // });
                                } else {
                                    utils.update_request_status_socket(trip._id);
                                    res.json({
                                        success: true,
                                        message: success_messages.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
                                    });
                                }

                            } else {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
                            }
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
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

exports.openride_pay_payment = async function (req, res, next) {
    let trip_id = "";
    if (res == null) {
        trip_id = next;
    } else {
        trip_id = req.body.trip_id;
    }

    OpenRide.findOne({ _id: trip_id, is_trip_end: 0 }).then(async (trip) => {
        if (trip) {
            City.findOne({ _id: trip.city_id }).then((city) => {
                Provider.findOne({ _id: trip.confirmed_provider }).then(async (provider) => {
                    let provider_device_token = provider.device_token;
                    let provider_device_type = provider.device_type;

                        let filteredUser = trip.user_details.filter((item) =>
                            item.booking_cancelled == 0 &&
                            item.booking_cancelled_by_user == 0 &&
                            item.booking_cancelled_by_provider == 0 &&
                            item.status == OPEN_RIDE_STATUS.ACCEPTED
                        )
                               
                        Corporate.findOne({ _id: trip.user_type_id }).then(async (corporate) => {

                            trip.is_trip_end = 1;
                      
                            let total_cash_payment = 0
                            let cash_payment = false
                            let total
                            for (const user_detail of filteredUser) {

                                total = user_detail.total;
                                total = Number((total).toFixed(2));
                                if (user_detail.payment_mode == constant_json.PAYMENT_MODE_CASH) {
                                        
                                    user_detail.total_after_wallet_payment = 0
                                    user_detail.remaining_payment = 0
                                    user_detail.wallet_payment = 0
                                    user_detail.cash_payment = total
                                    user_detail.is_pending_payments = 0

                                    trip.provider_have_cash = trip.total
                                    total_cash_payment = trip.total
                                    cash_payment = true
                                    
                                    if (user_detail.payment_status != PAYMENT_STATUS.COMPLETED) {
                                        user_detail.is_paid = 1
                                        user_detail.payment_status = PAYMENT_STATUS.COMPLETED

                                        const user = await User.findById({ _id: user_detail.user_id })
                                        utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", user.webpush_config, user.langCode);
                                    }
                                }
                                

                            }
                          
                            trip.current_rate  = trip.current_rate ? trip.current_rate : 1

                            trip.total_in_admin_currency = Number(trip.total) * trip.current_rate ;
                            trip.provider_service_fees_in_admin_currency = trip.provider_service_fees * trip.current_rate;
                            trip.markModified('split_payment_users');

                            if (cash_payment) {
                                trip.pay_to_provider = trip.provider_service_fees - trip.provider_have_cash;
                            } else if(!cash_payment) {
                                trip.pay_to_provider = trip.provider_service_fees
                            }


                            trip.cash_payment = total_cash_payment
                            let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
                            let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
                            trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
                            trip.complete_date_tag = complete_date_tag;

                            let total_wallet_amount = 0;
                            

                            if (city.is_provider_earning_set_in_wallet_on_cash_payment) {
                                    if (trip.pay_to_provider < 0) {
                                        total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                            provider.wallet_currency_code, trip.currencycode,
                                            1, Math.abs(trip.pay_to_provider), provider.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                                    } else {
                                        total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                            provider.wallet_currency_code, trip.currencycode,
                                            1, trip.pay_to_provider, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                                    }
                                    provider.wallet = total_wallet_amount;
                                    await provider.save();
                                trip.is_provider_earning_set_in_wallet = true;
                                if (trip.pay_to_provider >= 0) {
                                    trip.is_provider_earning_added_in_wallet = true;
                                } else {
                                    trip.is_provider_earning_added_in_wallet = false;
                                }
                                trip.provider_income_set_in_wallet = Math.abs(trip.pay_to_provider);
                            }
                            trip.save().then(() => {
                                utils.update_request_status_socket(trip._id);
                                //Old Code:
                                // let email_notification = setting_detail.email_notification;
                                // if (email_notification) {
                                // }

                                if (trip.is_tip) {
                                    if (res == null) {

                                        utils.sendPushNotification(provider_device_type, provider_device_token, push_messages.PUSH_CODE_FOR_PROVIDER_TRIP_END, "", null, provider.lang_code);
                                        
                                    } else {

                                        utils.sendPushNotification(provider_device_type, provider_device_token, push_messages.PUSH_CODE_FOR_PROVIDER_TRIP_END, "", null, provider.lang_code);
                                     
                                        res.json({
                                            success: true,
                                            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                            payment_status: trip.payment_status
                                        });
                                    }

                                } else {
                                    if (res != null) {
                                        if (req.body.provider_id != undefined) {

                                            res.json({
                                                success: true,
                                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                                payment_status: trip.payment_status
                                            });
                                            
                                        } else {
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_PAY_PAYMENT_FAILED
                                            });
                                        }
                                    }
                                }

                            });

                        });
                    
                });

            });

        } else {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }
    }, (err) => {
        console.log(err);
        res.json({
            success: false,
            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
        });
    });
};

exports.provider_cancel_ride = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }
        let trip = await OpenRide.findOne({
            _id: req.body.trip_id,
            is_trip_cancelled: 0,
            is_trip_cancelled_by_provider: 0,
        })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND })
            return
        }
        
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        

        // Set trip status
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, TYPE_VALUE.PROVIDER )

            let open_ride_id = mongoose.Types.ObjectId(req.body.trip_id)

            const filteredObjects = trip.user_details.filter(item => 
                item.status == 0 && item.send_req_to_provider_first_time == 0 
            );
            if (filteredObjects) {
                await Provider.updateOne({ _id: trip.provider_id},
                    { $pull:  { open_ride: open_ride_id } },)  
            }
            const updatedUserDetails = trip.user_details.filter(userDetail =>
                userDetail.booking_cancelled !== 1 && userDetail.booking_cancelled_by_user !== 1 && userDetail.booking_cancelled_by_provider !== 1 
            );      
    
            for (const userDetails of updatedUserDetails) {
                let user = await User.findOne({ _id: userDetails.user_id });
                if (String(trip._id) === String(user.current_trip_id)) {
                    user.current_trip_id = null;
                    await User.updateOne({ _id: user._id }, user.getChanges());
                }
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_PROVIDER, "", user.webpush_config, user.lang_code);
                let userDetailsIndex = trip.user_details.findIndex(item => item.user_id.toString() === userDetails.user_id.toString());
            
                if (userDetailsIndex !== -1) {
                    trip.user_details[userDetailsIndex].booking_cancelled = 1;
                    trip.user_details[userDetailsIndex].booking_cancelled_by_provider = 1;
                    trip.user_details[userDetailsIndex].payment_status = 1;
                    trip.cancel_reason = req.body?.cancel_reason;
                }
            }


            let provider = await Provider.findOne({ _id: trip.confirmed_provider })
            if (provider) {
                provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
                if (!provider.is_near_trip) { provider.is_near_trip = [] }
                if ((String(provider.is_trip[0]) == String(trip._id))) {
                    provider.is_near_available = 1;
                    provider.is_near_trip = [];
                    provider.is_trip = [];
                    provider.is_available = 1;
                }
                await Provider.updateOne({ _id: provider._id }, provider.getChanges())
            }


            trip.is_trip_end = 1;
            trip.is_trip_cancelled = 1;
            trip.is_trip_cancelled_by_provider = 1
            trip.cancel_reason = '';
            trip.payment_status = 1
            trip.provider_trip_end_time = new Date();
            trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
            trip.complete_date_tag = complete_date_tag;
        
       

        await OpenRide.updateOne({ _id: trip._id }, trip.getChanges())

        let message = admin_messages.success_message_trip_cancelled;
        utils.update_request_status_socket(trip._id);

        res.json({ success: true, message: message });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};


// get_provider_daily_earning_detail
exports.get_open_ride_provider_daily_earning_detail = function (req, res) {
    utils.check_request_params(req.body, [{name: 'provider_id', type: 'string'},{name: 'date', type: 'string'}], function (response) {
        if (response.success) {
            Provider.findOne({_id: req.body.provider_id}).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else {

                        Country.findOne({_id: provider.country_id}).then((country) => {
                            let currency = "";
                            let currencycode = "";
                            if (country) {
                                currency = country.currencysign;
                                currencycode = country.currencycode;
                            }

                            let provider_id = new ObjectId(req.body.provider_id);

                            let today = req.body.date;
                            if (today == '' || today == undefined || today == null) {
                                today = new Date();
                            } else {
                                today = new Date(today);
                            }

                            let complete_date_tag = moment(moment(today).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
                            let date_filter = {$match: {"complete_date_tag": {$eq: complete_date_tag}}};

                            let trip_condition = {'is_trip_completed': 1};
                            let trip_condition_new = {$and: [{'user_details.booking_cancelled_by_user': 1}, {'pay_to_provider': {$gt: 0}}]};
                            trip_condition = {$match: {$or: [trip_condition, trip_condition_new]}}

                            let provider_match_condition = {$match: {'provider_id': {$eq: provider_id}}};

                            let provider_daily_analytic_data = {};
                            let provider_daily_earning_data = {};
                            let provider_trips_data = [];

                            Provider_daily_analytic.findOne({
                                provider_id: provider_id,
                                date_tag: complete_date_tag
                            }).then((provider_daily_analytic) => {
                                if (provider_daily_analytic) {
                                    provider_daily_analytic_data = provider_daily_analytic;
                                }

                                let unwind ={
                                    $unwind: "$user_details",
                                }

                                let project_selection_data_from_trip = {
                                    $project: {
                                        _id: 0,
                                        unique_id: 1,
                                        provider_service_fees: 1,
                                        total: 1,
                                        payment_mode: "$user_details.payment_mode",
                                        provider_have_cash: 1,
                                        pay_to_provider: 1,
                                        provider_income_set_in_wallet: 1,
                                        cash_payment: "$user_details.cash_payment"
                                    }
                                };

                                OpenRide.aggregate([trip_condition, date_filter, provider_match_condition, unwind, project_selection_data_from_trip]).then((daily_trips) => {

                                    if (daily_trips.length == 0) {
                                        res.json({
                                            success: true,
                                            currency: currency,
                                            currencycode: currencycode,
                                            provider_daily_analytic: provider_daily_analytic_data,
                                            provider_daily_earning: provider_daily_earning_data,
                                            trips: provider_trips_data
                                        })
                                    } else {

                                        let group_trip_data_condition = {
                                            $group: {
                                                _id: null,
                                                total_distance: {$sum: '$total_distance'},
                                                total_time: {$sum: '$total_time'},
                                                total_waiting_time: {$sum: '$total_waiting_time'},
                                                total_service_surge_fees: {$sum: '$surge_fee'},
                                                service_total: {$sum: '$total_after_surge_fees'},

                                                total_provider_tax_fees: {$sum: '$provider_tax_fee'},
                                                total_provider_miscellaneous_fees: {$sum: '$provider_miscellaneous_fee'},
                                                total_toll_amount: {$sum: '$toll_amount'},
                                                total_tip_amount: {$sum: '$tip_amount'},
                                                total_provider_service_fees: {$sum: '$provider_service_fees'},

                                                total_provider_have_cash: {$sum: {'$cond': [{'$eq': ['$user_details.payment_mode', 1]}, '$cash_payment', 0]}},
                                                // total_deduct_wallet_amount: {
                                                //     $sum: {
                                                //         '$cond': [{
                                                //             '$eq': ['$is_provider_earning_set_in_wallet', true],
                                                //             '$eq': ['$payment_mode', 1]
                                                //         }, '$provider_income_set_in_wallet', 0]
                                                //     }
                                                // },
                                                // total_added_wallet_amount: {
                                                //     $sum: {
                                                //         '$cond': [{
                                                //             '$eq': ['$is_provider_earning_set_in_wallet', true],
                                                //             '$eq': ['$payment_mode', 0]
                                                //         }, '$provider_income_set_in_wallet', 0]
                                                //     }
                                                // },
                                                total_deduct_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, { '$ne': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$user_details.payment_mode', 1] }] }, '$provider_income_set_in_wallet', 0] } },
                                                total_added_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, {$or: [{ '$eq': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$user_details.payment_mode', 0] } ]} ] }, '$provider_income_set_in_wallet', 0] } },
                                
                                                total_paid_in_wallet_payment: {$sum: {'$cond': [{'$eq': ['$is_provider_earning_set_in_wallet', true]}, '$provider_income_set_in_wallet', 0]}},

                                                total_transferred_amount: {$sum: {'$cond': [{$and: [{'$eq': ['$is_provider_earning_set_in_wallet', false]}, {'$eq': ['$is_transfered', true]}]}, '$pay_to_provider', 0]}},
                                                total_pay_to_provider: {$sum: {'$cond': [{$and: [{'$eq': ['$is_provider_earning_set_in_wallet', false]}, {'$eq': ['$is_transfered', false]}]}, '$pay_to_provider', 0]}},

                                                currency: {$first: '$currency'},
                                                unit: {$first: '$unit'},
                                                statement_number: {$first: '$invoice_number'},

                                            }
                                        }
                                        OpenRide.aggregate([trip_condition, date_filter, provider_match_condition, unwind, group_trip_data_condition]).then((trips) => {
                                            if (trips.length == 0) {
                                                res.json({success: false, error_code: error_message.ERROR_CODE_EARNING_NOT_FOUND})
                                            } else {
                                                provider_daily_earning_data = trips[0];
                                                res.json({
                                                    success: true,
                                                    currency: currency,
                                                    currencycode: currencycode,
                                                    provider_daily_analytic: provider_daily_analytic_data,
                                                    provider_daily_earning: provider_daily_earning_data,
                                                    trips: daily_trips
                                                });
                                            }
                                        }, (err) => {
                                            console.log(err)
                                            res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                        });
                                    }
                                }, (err) => {
                                    console.log(err)
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                });
                            });
                        });
                    }
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


// get_provider_weekly_earning_detail
exports.get_open_ride_provider_weekly_earning_detail = function (req, res) {
    utils.check_request_params(req.body, [{name: 'provider_id', type: 'string'},{name: 'date', type: 'string'}], function (response) {
        if (response.success) {
            Provider.findOne({_id: req.body.provider_id}).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else {
                        let country_id = provider.country_id;
                        let city_id = provider.cityid;
                        City.findOne({_id: city_id}).then((city) => {
                            if (city) {
                                country_id = city.countryid;
                                Country.findOne({_id: country_id}).then((country) => {
                                    if (country) {
                                        let currency = country.currencysign;
                                        let currencycode = country.currencycode;
                                        let provider_id = new ObjectId(req.body.provider_id);
                                        let today = req.body.date;
                                        if (today == '' || today == undefined || today == null) {
                                            today = new Date();
                                        } else {
                                            today = new Date(today);
                                        }
                                        let start_date_view = today;
                                        let week_start_date_time = today;
                                        let trip_condition = {'is_trip_completed': 1};
                                        let trip_condition_new = {$and: [{'is_trip_cancelled_by_user': 1}, {'pay_to_provider': {$gt: 0}}]};
                                        trip_condition = {$match: {$or: [trip_condition, trip_condition_new]}}
                                        let provider_match_condition = {$match: {'provider_id': {$eq: provider_id}}};

                                        let provider_daily_analytic_data = [];
                                        for (let i = 0; i < 7; i++) {
                                            provider_daily_analytic_data.push(moment(today).format(constant_json.DATE_FORMAT_MMM_D_YYYY));
                                            today = moment(today).add(1, 'days');
                                        }
                                        let provider_daily_analytic_query = {$match: {date_tag: {$in: provider_daily_analytic_data}}};
                                        let date_filter = {$match: {complete_date_tag: {$in: provider_daily_analytic_data}}};

                                        let group_analytic_data_condition = {
                                            $group: {
                                                _id: null,
                                                received: {$sum: '$received'},
                                                accepted: {$sum: '$accepted'},
                                                rejected: {$sum: '$rejected'},
                                                not_answered: {$sum: '$not_answered'},
                                                cancelled: {$sum: '$cancelled'},
                                                completed: {$sum: '$completed'},        
                                                acception_ratio: {$sum: '$acception_ratio'},
                                                rejection_ratio: {$sum: '$rejection_ratio'},
                                                cancellation_ratio: {$sum: '$cancellation_ratio'},
                                                completed_ratio: {$sum: '$completed_ratio'},

                                                total_online_time: {$sum: '$total_online_time'}
                                            }
                                        }

                                        Provider_daily_analytic.aggregate([provider_match_condition, provider_daily_analytic_query, group_analytic_data_condition]).then((provider_daily_analytic) => {
                                            let provider_weekly_analytic_data = {};

                                            if (provider_daily_analytic.length > 0) {
                                                provider_weekly_analytic_data = provider_daily_analytic[0];
                                                if ((Number(provider_weekly_analytic_data.received)) > 0) {
                                                    let received = provider_weekly_analytic_data.received;
                                                    provider_weekly_analytic_data.acception_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.accepted * 100) / received));
                                                    provider_weekly_analytic_data.cancellation_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.cancelled * 100) / received));
                                                    provider_weekly_analytic_data.completed_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.completed * 100) / received));
                                                    provider_weekly_analytic_data.rejection_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.rejected * 100) / received));
                                                }
                                            }


                                            let provider_weekly_earning_data = {};
                                            let daily_condition = {
                                                $group: {
                                                    _id: null,
                                                    date1: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(0, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date2: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(1, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date3: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(2, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date4: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(3, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date5: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(4, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date6: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(5, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date7: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(6, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}}
                                                }

                                            }
                                            let date = {
                                                date1: new Date(moment(start_date_view)),
                                                date2: new Date(moment(start_date_view).add(1, 'days')),
                                                date3: new Date(moment(start_date_view).add(2, 'days')),
                                                date4: new Date(moment(start_date_view).add(3, 'days')),
                                                date5: new Date(moment(start_date_view).add(4, 'days')),
                                                date6: new Date(moment(start_date_view).add(5, 'days')),
                                                date7: new Date(moment(start_date_view).add(6, 'days'))

                                            }

                                            OpenRide.aggregate([trip_condition, date_filter, provider_match_condition, daily_condition]).then((daily_trips) => {
                                                if (daily_trips.length == 0) {
                                                    res.json({
                                                        success: true,
                                                        currency: currency,
                                                        currencycode: currencycode,
                                                        provider_weekly_analytic: provider_weekly_analytic_data,
                                                        provider_weekly_earning: provider_weekly_earning_data,
                                                        date: date,
                                                        trip_day_total: {}
                                                    })
                                                } else {
                                                    let group_trip_data_condition = {
                                                        $group: {
                                                            _id: null,
                                                            total_distance: {$sum: '$total_distance'},
                                                            total_time: {$sum: '$total_time'},
                                                            total_waiting_time: {$sum: '$total_waiting_time'},
                                                            total_service_surge_fees: {$sum: '$surge_fee'},
                                                            service_total: {$sum: '$total_after_surge_fees'},

                                                            total_provider_tax_fees: {$sum: '$provider_tax_fee'},
                                                            total_provider_miscellaneous_fees: {$sum: '$provider_miscellaneous_fee'},
                                                            total_toll_amount: {$sum: '$toll_amount'},
                                                            total_tip_amount: {$sum: '$tip_amount'},

                                                            total_provider_service_fees: {$sum: '$provider_service_fees'},
                                                            total_provider_have_cash: {$sum: {'$cond': [{'$eq': ['$payment_mode', 1]}, '$cash_payment', 0]}},
                                                            total_deduct_wallet_amount: {
                                                                $sum: {
                                                                    $cond: [{
                                                                        $and: [{ $eq: ["$is_provider_earning_set_in_wallet", true] },
                                                                        { $lt: ["$pay_to_provider", 0] }                                        ]
                                                                    },'$provider_income_set_in_wallet',0]
                                                                }
                                                            },
                                                            total_added_wallet_amount:{
                                                                $sum: {
                                                                    $cond: [{
                                                                        $and: [{ $eq: ["$is_provider_earning_set_in_wallet", true] },
                                                                        { $gt: ["$pay_to_provider", 0] }                                        ]
                                                                    },'$provider_income_set_in_wallet',0]
                                                                }
                                                            },
                                                            total_paid_in_wallet_payment: {$sum: {'$cond': [{'$eq': ['$is_provider_earning_set_in_wallet', true]}, '$provider_income_set_in_wallet', 0]}},
                                                            total_pay_to_provider: {$sum: {'$cond': [{'$eq': ['$is_provider_earning_set_in_wallet', false]}, '$pay_to_provider', 0]}},

                                                            currency: {$first: '$currency'},
                                                            unit: {$first: '$unit'},
                                                            statement_number: {$first: '$invoice_number'},

                                                        }
                                                    }

                                                    OpenRide.aggregate([trip_condition, date_filter, provider_match_condition, group_trip_data_condition]).then((trips) => {
                                                        if (trips.length == 0) {
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_EARNING_NOT_FOUND
                                                            })
                                                        } else {
                                                            provider_weekly_earning_data = trips[0];
                                                            res.json({
                                                                success: true,
                                                                currency: currency,
                                                                currencycode: currencycode,
                                                                provider_weekly_analytic: provider_weekly_analytic_data,
                                                                provider_weekly_earning: provider_weekly_earning_data,
                                                                date: date,
                                                                trip_day_total: daily_trips[0]
                                                            });
                                                        }
                                                    }, (err) => {
                                                        console.log(err)
                                                        res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                                    });

                                                }
                                            }, (err) => {
                                                console.log(err)
                                                res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                            });
                                        });
                                    }
                                });


                            } else {
                                res.json({success: false, error_code: error_message.ERROR_CODE_EARNING_NOT_FOUND});

                            }
                        });

                    }
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