let utils = require('./utils');
let allemails = require('./emails');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let Type = require('mongoose').model('Type');
let Trip_Service = require('mongoose').model('trip_service');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Dispatcher = require('mongoose').model('Dispatcher');
let Hotel = require('mongoose').model('Hotel');
let TripLocation = require('mongoose').model('trip_location');
let Citytype = require('mongoose').model('city_type');
let Reviews = require('mongoose').model('Reviews');
let Promo_Code = require('mongoose').model('Promo_Code');
let User_promo_use = require('mongoose').model('User_promo_use');
let mongoose = require('mongoose');
let ObjectId = mongoose.Types.ObjectId;
let Card = require('mongoose').model('Card');
let EmergencyContactDetail = require('mongoose').model('emergency_contact_detail');
let pad = require('pad-left');
let Country = require('mongoose').model('Country');
let City = require('mongoose').model('City');
let moment = require('moment');
let geolib = require('geolib');
let CityZone = require('mongoose').model('CityZone');
let ZoneValue = require('mongoose').model('ZoneValue');
let Airport = require('mongoose').model('Airport');
let AirportCity = require('mongoose').model('Airport_to_City');
let CitytoCity = require('mongoose').model('City_to_City');
let Partner = require('mongoose').model('Partner');
let Corporate = require('mongoose').model('Corporate');
const https = require('https')
let country_list = require('../../country_list.json')
let cards = require('./card');
const { type } = require('os');
const { table } = require('console');
let Cancel_reason = require('mongoose').model('cancellation_reason');
let Languages = require('mongoose').model('language')
let myAnalytics = require('./provider_analytics');
let user_controller = require('./users');
let Find_provider_logs = require('mongoose').model('find_provider_logs');
const Schema = mongoose.Types.ObjectId
let OpenRide = require('mongoose').model('Open_Ride');
let Settings = require('mongoose').model('Settings');
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");
let Car_Rent_Brand = require('mongoose').model("Car_Rent_Brand");
let Car_Rent_Model = require('mongoose').model("Car_Rent_Model");
let Car_Rent_Type = require('mongoose').model("Car_Rent_Type");
let Rental_Trip = require('mongoose').model("Rental_Trip");

let Mutex = require('async-mutex').Mutex;
var wsal_services = require('./wsal_controller');
let Vehicle = require('mongoose').model('Vehicle');
const lock = new Mutex();
const {
    PAYMENT_GATEWAY,
    PAYMENT_STATUS,
    SPLIT_PAYMENT,
    TYPE_VALUE,
    TRIP_STATUS,
    PROVIDER_STATUS,
    TRIP_STATUS_TIMELIME,
    ADMIN_NOTIFICATION_TYPE,
    PROVIDER_TYPE,
    SMS_TEMPLATE,
    RENTAL_TRIP_STATUS
} = require('./constant');

exports.create_trip = function (user_data, trip_type, city_type_id, req_data) {
    return new Promise(async (resolve, reject) => {
        const release = await lock.acquire();
        try {
            const setting_detail = await Settings.findOne({})
            if (req_data.car_rental_id == "") {
                delete req_data.car_rental_id;
            }
            let tripData = req_data;
            let user_id = tripData.user_id;

            if (user_data.is_approved == 0) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED });
                return;
            }
            
            const existingOrder = await Trip.findOne({
                user_id: user_id,
                is_schedule_trip: false,
                is_provider_accepted: 0,
                is_trip_completed: 0,
                is_trip_cancelled: 0
            });

            if (existingOrder ) {
                return resolve({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
            }

            if (tripData.trip_type !== undefined) {
                trip_type = tripData.trip_type;
            }
            if (trip_type == constant_json.TRIP_TYPE_CORPORATE) {
                tripData.user_type_id = user_data.user_type_id;
                user_id = user_data.user_type_id;
            }

            let corporate_data = await Corporate.findOne( {$or: [{
                _id: tripData.corporate_id
            }, {
                _id: tripData.user_type_id
            }]})


            if ( trip_type == constant_json.TRIP_TYPE_CORPORATE && tripData.corporate_id) {
                if (user_data.corporate_wallet_limit < 0 ) {
                    resolve({ success: false, trip_id: null, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING});
                    return;
                }
                if(corporate_data?.wallet < 0)  {
                    resolve({ success: false, trip_id: null, error_code: error_message.ERROR_CODE_CORPORATE_TRIP_PAYMENT_IS_PENDING });
                    return;
                }
            }else if ( trip_type == constant_json.TRIP_TYPE_CORPORATE && !tripData.corporate_id) {
                if (user_data.corporate_wallet_limit < 0 ) {
                    resolve({ success: false, trip_id: null, error_code: error_message.ERROR_CODE_CUSTOMER_TRIP_PAYMENT_IS_PENDING});
                    return;
                }
                if(corporate_data?.wallet < 0)  {
                    resolve({ success: false, trip_id: null, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING });
                    return;
                }
            }


            if ((user_data.wallet < 0) || (trip_type == constant_json.TRIP_TYPE_CORPORATE && tripData.user_type_id && user_data.corporate_wallet_limit < 0)) {
                resolve({ success: false, trip_id: null, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING });
                return;
            }

            if (tripData.trip_type !== undefined) {
                trip_type = tripData.trip_type;
            }

            let citytype = await Citytype.findOne({ _id: city_type_id })
            if (!citytype) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND })
                return;
            }

            if (citytype.is_business !== 1) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_AREA })
                return;
            }

            let city_id = citytype.cityid;
            let country_id = citytype.countryid;

            let country_data = await Country.findOne({ _id: country_id })
            if (!country_data) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND })
                return;
            }

            if (country_data.isBusiness !== 1) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY })
                return;
            }

            let city_detail = await City.findOne({ _id: city_id })
            if (!city_detail) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND });
                return;
            }

            if (city_detail.isBusiness !== 1) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_CITY })
                return;
            }


            if (tripData.promo_id) {
                let promocode = await Promo_Code.findOne({ _id: tripData.promo_id })
                if (promocode) {
                    promocode.user_used_promo = promocode.user_used_promo + 1;
                    
                    if(promocode.user_used_promo > promocode.code_uses){

                        resolve({ success: false, error_code: error_message.ERROR_CODE_INVALID_PROMO_CODE })
                        return;                        
                    }
                    
            }}
            
            let payment_gateway_type = setting_detail.payment_gateway_type;
            if (country_data.payment_gateways && country_data.payment_gateways.length > 0) {
                payment_gateway_type = country_data.payment_gateways[0];
            }


            let card = await Card.find({ user_id: user_id, payment_gateway_type: payment_gateway_type })
            if (tripData.payment_mode == Number(constant_json.PAYMENT_MODE_CARD) && ((Number(payment_gateway_type) !== PAYMENT_GATEWAY.payu) && (Number(payment_gateway_type) !== PAYMENT_GATEWAY.paypal) && (Number(payment_gateway_type) !== PAYMENT_GATEWAY.razorpay))) {
                if (card.length == 0 && trip_type != constant_json.TRIP_TYPE_CORPORATE) {
                    resolve({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
                    return;
                }
                if (card.length == 0 && trip_type == constant_json.TRIP_TYPE_CORPORATE && tripData.corporate_id) {
                    resolve({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST_FOR_CORPORATE_USER });
                    return;
                }
                if(card.length == 0 && trip_type == constant_json.TRIP_TYPE_CORPORATE && tripData.user_type_id){
                    resolve({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
                    return;
                }
            }

            let is_fixed_fare = false;
            let fixed_price = 0;
            let received_trip_from_gender = [];
            let provider_language = [];
            let accessibility = [];
            let destination_addresses = [];
            let type_detail = await Type.findById(citytype.typeid)

            if (tripData.is_fixed_fare != undefined) {
                is_fixed_fare = tripData.is_fixed_fare;
                if (is_fixed_fare) {
                    fixed_price = tripData.fixed_price;
                }
            }

            if (tripData.received_trip_from_gender != undefined) {
                received_trip_from_gender = tripData.received_trip_from_gender;
            }

            if (tripData.provider_language != undefined) {
                provider_language = tripData.provider_language;
            }

            if (tripData.accessibility != undefined) {
                accessibility = tripData.accessibility;
            }

            let dateNow = new Date();
            let schedule_start_time = null;
            let server_start_time_for_schedule = null;
            let is_schedule_trip = false;

            if (tripData.start_time) {
                is_schedule_trip = true;
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
            let json = {
                user_last_name: user_data.last_name,
                user_first_name: user_data.first_name,
                user_unique_id: user_data.unique_id,
                service_type_id: citytype._id,
                type_id: citytype.typeid,
                typename: type_detail.typename,
                user_id: user_data._id,
                is_trip_inside_zone_queue: tripData.is_trip_inside_zone_queue,
                token: tripData.token,
                current_provider: null,
                provider_id: null,
                confirmed_provider: null,
                trip_type: trip_type,
                car_rental_id: tripData.car_rental_id,
                is_surge_hours: tripData.is_surge_hours,
                surge_multiplier: tripData.surge_multiplier,
                hotel_name: tripData.hotel_name,
                room_number: tripData.room_number,
                floor: tripData.floor,
                source_address: tripData.source_address,
                destination_address: tripData.destination_address,
                sourceLocation: [tripData.latitude, tripData.longitude],
                payment_gateway_type: payment_gateway_type,
                destinationLocation: [],
                initialDestinationLocation: [],
                timezone: city_detail.timezone,
                payment_mode: tripData.payment_mode,
                user_create_time: tripData.user_create_time,
                payment_id: tripData.payment_id,
                unit: city_detail.unit,
                country_id: country_id,
                city_id: city_detail._id,
                fixed_price: fixed_price,
                is_fixed_fare: is_fixed_fare,
                is_provider_earning_set_in_wallet: false,
                received_trip_from_gender: received_trip_from_gender,
                provider_language: provider_language,
                accessibility: accessibility,
                is_schedule_trip: is_schedule_trip,
                schedule_start_time: schedule_start_time,
                server_start_time_for_schedule: server_start_time_for_schedule,
                user_app_version: user_data.app_version,
                user_device_type: user_data.device_type,
                zone_queue_id: tripData.zone_queue_id,
                destination_addresses,
                is_ride_share: citytype.is_ride_share != 1 ? 0 : 1,
                ride_share_limit: type_detail.ride_share_limit ? type_detail.ride_share_limit : null,
                created_by: tripData.created_by,
                estimate_time: tripData.estimate_time,
                estimate_distance: tripData.estimate_distance,
                booking_type : [],
                is_trip_bidding : tripData.is_trip_bidding
            }
                        

            // Set booking type
            json.booking_type = await utils.getTripBookingTypes(json)
            let trip = await new Trip(json);

            
            if (setting_detail.sms_notification) {
                    utils.sendOtherSMS(user_data.country_phone_code + user_data.phone, SMS_TEMPLATE.RIDE_BOOKING )
            }
            
            if (tripData.d_longitude && tripData.d_latitude) {
                trip.destinationLocation = [tripData.d_latitude, tripData.d_longitude];
                trip.initialDestinationLocation = trip.destinationLocation;
            }
            if (tripData.user_type_id) {
                trip.user_type = tripData.user_type;
                trip.user_type_id = tripData.user_type_id;
                let Table1
                if (trip.user_type == constant_json.USER_TYPE_CORPORATE  ||  trip.user_type == constant_json.USER_TYPE_DISPATCHER   ||  trip.user_type == constant_json.USER_TYPE_HOTEL) {
                    
                    switch ((trip.user_type).toString()) {
                        case constant_json.USER_TYPE_CORPORATE:
                            Table1 = Corporate;
                            break;
                        case constant_json.USER_TYPE_HOTEL:
                            Table1 = Hotel;
                            break;
                        case constant_json.USER_TYPE_DISPATCHER:
                            Table1 = Dispatcher;
                            break;
                        default:
                            Table1 = Corporate;
                            break;
                    }
    
                    if(trip.user_type != 0) {
                        const user_data = await Table1.findOne({ _id: mongoose.Types.ObjectId(trip.user_type_id)})
                        if(user_data) trip.support_phone_user =  user_data.country_phone_code + user_data.phone
                    }
                }
            } else {
                trip.user_type = constant_json.USER_TYPE_NORMAL;
                trip.user_type_id = null;
            }

            if (tripData.device == undefined && trip_type != constant_json.TRIP_TYPE_PROVIDER) {
                trip.is_tip = setting_detail.is_tip;
            }
            trip.is_toll = setting_detail.is_toll;

            if (trip_type != constant_json.TRIP_TYPE_PROVIDER && trip_type != constant_json.TRIP_TYPE_DISPATCHER) {
                trip.is_otp_verification = setting_detail.is_otp_verification_start_trip;
                if (trip.is_otp_verification) {
                    trip.confirmation_code = utils.generateOtp(6);
                }
            }

            if (tripData.is_trip_bidding) {
                trip.is_trip_bidding = tripData.is_trip_bidding;
                trip.is_user_can_set_bid_price = tripData.is_user_can_set_bid_price;
                trip.bid_price = tripData.bid_price;

                // if bid trip then set price as a fixed fare
                is_fixed_fare = true;
                fixed_price = trip.bid_price;
            }
            let currency = country_data.currencysign;
            let currencycode = country_data.currencycode;
            trip.currency = currency;
            trip.currencycode = currencycode;

            user_data.total_request = user_data.total_request + 1;
            await User.updateOne({ _id: user_data._id }, user_data.getChanges());

            let service_type_id = tripData.service_type_id;
            if (tripData.car_rental_id) {
                service_type_id = tripData.car_rental_id;
            }

            let trip_service = await Trip_Service.findOne({ service_type_id: service_type_id }).sort({ _id: -1 })
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
            trip.trip_service_city_type_id = trip_service._id;
            if (is_fixed_fare) {
                trip.provider_service_fees = Number((fixed_price * trip_service.provider_profit * 0.01).toFixed(3));
            }

            // Set trip status
            let trip_user_type = TYPE_VALUE.USER
            switch (trip.user_type) {
                case constant_json.USER_TYPE_NORMAL:
                    trip_user_type = TYPE_VALUE.USER
                    break;
            
                case constant_json.USER_TYPE_CORPORATE:
                    trip_user_type = TYPE_VALUE.CORPORATE
                    break;

                case constant_json.USER_TYPE_DISPATCHER:
                    trip_user_type = TYPE_VALUE.DISPATCHER
                    break;

                case constant_json.USER_TYPE_HOTEL:
                    trip_user_type = TYPE_VALUE.HOTEL
                    break;

                case constant_json.USER_TYPE_PROVIDER:
                    trip_user_type = TYPE_VALUE.PROVIDER
                    break;
                default:
                    break;
            }
            trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.CREATED, trip_user_type )

            await trip.save();
            let unique_id = pad(trip.unique_id, 7, '0');
            let invoice_number = constant_json.INVOICE_APP_NAME_CODE + " " + constant_json.INVOICE_PROVIDER_TRIP_EARNING_CODE + " " + (moment(new Date())).format(constant_json.DATE_FORMAT_MMDDYYYY) + " " + unique_id;
            trip.invoice_number = invoice_number;
            await trip.save();
            let triplocation = new TripLocation({
                tripID: trip._id,
                trip_unique_id: trip.unique_id,
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

            resolve({
                success: true,
                trip: trip,
                message: success_messages.MESSAGE_CODE_YOUR_FUTURE_TRIP_CREATE_SUCCESSFULLY
            });
            return;

        } catch (err) {
            resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        } finally {
            release();
        }
    })
};

// FIND NEAREST PROVIDER
exports.nearest_provider = function (trip, provider_id, user_favourite_providers, city_type_data = null, req_data = null) {
    return new Promise(async (resolve, reject) => {
        let provider_query = {};
        let is_save_log = false;
        let city_id ;
        try {

            const setting_detail = await Settings.findOne({});

            city_id = trip?.city_id || city_type_data?.cityid;
            let city_detail = await City.findOne({ _id: city_id })
            if (!city_detail && !req_data) {
                resolve({ success: false, error_code: error_message.ERROR_CODE_CITY_TYPE_NOT_FOUND });
                return;
            }
           
            // added for common function
            let providers_id_that_rejected_trip = trip?.providers_id_that_rejected_trip || [];
            let type_id = trip?.type_id || city_type_data?.typeid;
            let country_id = trip?.country_id || city_type_data?.countryid;
            let is_ride_share = trip?.is_ride_share || req_data?.is_ride_share;
            let payment_mode = trip?.payment_mode || req_data?.payment_mode;
            let sourceLocation = trip?.sourceLocation || [req_data.latitude, req_data.longitude];
            let provider_language = trip?.provider_language || req_data?.provider_language || [];
            let received_trip_from_gender = trip?.received_trip_from_gender || req_data?.received_trip_from_gender || [];
            let accessibility = trip?.accessibility || req_data?.accessibility;
            let is_trip_inside_zone_queue = trip?.is_trip_inside_zone_queue;
            let ride_share_limit = trip?.ride_share_limit || 2;
            let destination_location = trip?.destinationLocation
            if (!destination_location && req_data?.destination_latitude && req_data?.destination_longitude) {
                destination_location = [req_data.destination_latitude, req_data.destination_longitude];
            }
            let city_timezone = city_detail?.timezone;
            let is_check_provider_wallet_amount_for_received_cash_request = city_detail?.is_check_provider_wallet_amount_for_received_cash_request;
            let provider_min_wallet_amount_set_for_received_cash_request = city_detail?.provider_min_wallet_amount_set_for_received_cash_request;
            let distance = setting_detail.default_Search_radious / constant_json.DEGREE_TO_KM;
            // end added for common function

            provider_query["_id"] = { $nin: providers_id_that_rejected_trip };
            if (type_id) {
                provider_query["admintypeid"] = type_id;
            }
            if (country_id) {
                provider_query["country_id"] = country_id;
            }

            let is_trip_condition = []
            let is_available_condition = []

            is_trip_condition.push({ "is_trip": [] })
            is_trip_condition.push({ "bids": {$ne: []} })
            is_available_condition.push({ "is_available": 1 })

            if (setting_detail.is_receive_new_request_near_destination) {
                is_trip_condition.push({ "is_near_trip": [] })
                is_available_condition.push({ "is_near_available": 1 })
            }

            if (setting_detail.is_allow_ride_share && is_ride_share) {
                is_trip_condition.push({ "is_ride_share": 1 })
                is_available_condition.push({ "is_ride_share": 1 })
            }
            let is_trip_query = { $or: is_trip_condition }
            let is_available_query = { $or: is_available_condition }

            provider_query["is_active"] = 1;
            let country = await Country.findOne({_id: city_detail.countryid})
            if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                provider_query["is_driver_approved_from_wsal"] = true;
            }

            let admin_type_query = [{ "provider_type": Number(constant_json.PROVIDER_TYPE_NORMAL) }, { "is_approved": 1 }]

            if (is_check_provider_wallet_amount_for_received_cash_request && payment_mode == Number(constant_json.PAYMENT_MODE_CASH)) {
                let wallet_query = { 'wallet': { $gte: provider_min_wallet_amount_set_for_received_cash_request } };
                admin_type_query.push(wallet_query)
            }
            provider_query["is_vehicle_document_uploaded"] = true;
            provider_query["is_documents_expired"] = false;

            provider_query["providerLocation"] = { $near: sourceLocation, $maxDistance: distance };

            let provider_normal_type_query = {
                $and: admin_type_query
            };
            let provider_admin_type_query = {
                $and: [
                    { "provider_type": Number(constant_json.PROVIDER_TYPE_ADMIN) },
                    { "is_approved": 1 }
                ]
            };
            let provider_partner_type_query = {
                $and: [
                    { "provider_type": Number(constant_json.PROVIDER_TYPE_PARTNER) },
                    { "is_approved": 1 },
                    { "is_partner_approved_by_admin": 1 }
                ]
            };
            let provider_type_query = { $or: [provider_normal_type_query, provider_admin_type_query, provider_partner_type_query] };
            let languages_exists_query = { $and: [{ "languages": { $in: provider_language } }] };

            let received_trip_from_gender_exists_query = {
                $and: [{
                    "gender": {
                        $exists: true,
                        $all: received_trip_from_gender
                    }
                }]
            }

            let provider_query_and = [];
            provider_query_and.push(is_trip_query);
            provider_query_and.push(is_available_query);
            provider_query_and.push(provider_type_query);
            if (provider_id != null) {
                provider_query_and.push({ $and: [{ "_id": { $eq: provider_id } }] });
            }

            if (accessibility != undefined && accessibility.length > 0) {
                let accessibility_query = {
                    vehicle_detail: { $elemMatch: { is_selected: true, accessibility: { $exists: true, $ne: [], $all: accessibility } } }
                }
                provider_query_and.push(accessibility_query);
            }

            if (provider_language.length > 0) {
                provider_query_and.push(languages_exists_query);
            }
            if (received_trip_from_gender.length > 0 && received_trip_from_gender.length != 2) {
                provider_query_and.push(received_trip_from_gender_exists_query);
            }

            let limit = 1;
            if (setting_detail.find_nearest_driver_type == Number(constant_json.NEAREST_PROVIDER_TYPE_MULTIPLE)) {
                limit = setting_detail.request_send_to_no_of_providers;
            }

            if ( city_type_data?.provider_type == 2 ) {
                limit = 1;
            }

            if(trip?.is_trip_bidding){
                let country_detail = await Country.findOne({ _id: country_id })
                limit = country_detail.no_of_providers_can_bid;
            }
            if(req_data?.type == TYPE_VALUE.HOTEL || req_data?.type == TYPE_VALUE.DISPATCHER){
                limit = 1000; // Manual assign from hotel and dispatcher all drivers will be fetched.
            }
            provider_query["$and"] = provider_query_and;

            let favourite_providers = [];
            if (user_favourite_providers) {
                favourite_providers = user_favourite_providers;
            }
            let favourite_providersSet = new Set(user_favourite_providers || []);

            let query;
            query = Provider.find(provider_query)
            let providers = await query.exec()
            if (trip) {
                delete trip.provider_to_user_estimated_distance;
                delete trip.provider_to_user_estimated_time;
            }

            if (providers.length == 0) {
                await handleNoProviderFound(trip, resolve)
            }

            async function handleNoProviderFound(trip, resolve){
                if (!trip) {
                    is_save_log = true;
                    resolve({ success: false, error_code: error_message.ERROR_CODE_NO_PROVIDER_FOUND_SELECTED_SERVICE_TYPE_AROUND_YOU });
                    return;
                }

                if (!trip.is_schedule_trip) {
                    trip.current_provider = null;
                    trip.provider_first_name = "";
                    trip.provider_last_name = "";
                    trip.provider_unique_id = null;
                    trip.provider_phone_code = ""
                    trip.provider_phone = ""

                    if (String(trip.trip_type) !== String(constant_json.TRIP_TYPE_DISPATCHER)) {
                        trip.provider_trip_end_time = new Date();
                        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
                        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
                        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
                        trip.complete_date_tag = complete_date_tag;
                        trip.is_trip_cancelled = 1;
                        trip.is_provider_accepted = 0;
                    } else {
                        trip.is_provider_accepted = 3;
                    }
                }

                if (trip.is_trip_cancelled == 0) {
                    await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                    utils.update_request_status_socket(trip._id);

                    let user = await User.findOne({ _id: trip.user_id })
                    if (user) {
                        if (!trip.is_schedule_trip) {
                            user.current_trip_id = null;
                            await User.updateOne({ _id: user._id }, user.getChanges());
                        }
                        utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_NO_PROVIDER_FOUND, "", null, user.lang_code);
                    }
                    is_save_log = true;
                    resolve({ success: false, error_code: error_message.ERROR_CODE_NO_PROVIDER_FOUND_AROUND_YOU });
                    return;
                } else {
                    // Set trip status
                    trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, null, "System" )
                }
                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                await utils.move_trip_to_completed(trip._id)
                utils.update_request_status_socket(trip._id);
                await utils.remove_trip_promo_code(trip)

                let user = await User.findOne({ _id: trip.user_id })
                if (user) {
                    if (!trip.is_schedule_trip) {
                        user.current_trip_id = null;
                        await User.updateOne({ _id: user._id }, user.getChanges());
                    }
                    utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_NO_PROVIDER_FOUND, "", null, user.lang_code);
                }
                is_save_log = true;
                resolve({ success: false, error_code: error_message.ERROR_CODE_NO_PROVIDER_FOUND_AROUND_YOU });
            }

            function onlyUnique(value, index, self) {
                return self.indexOf(value) === index;
            }
            favourite_providers = favourite_providers.filter(onlyUnique)

            let final_providers = [];
            let finalProvidersIds = new Set();

            let providerIndexMap = new Map();
            providers.forEach((provider, index) => {
                providerIndexMap.set(provider._id.toString(), index);
            });

            if (is_trip_inside_zone_queue && trip.zone_queue_id) {
                let zone = await CityZone.findById(trip.zone_queue_id);
                let zone_providers = zone?.total_provider_in_zone_queue || [];

                for (const zone_provider of zone_providers) {
                    let zoneProviderId = zone_provider.toString();
                    if (providerIndexMap.has(zoneProviderId)) {
                        let zoneProviderIndex = providerIndexMap.get(zoneProviderId);
                        if (final_providers.length < limit) {
                            final_providers.push(providers[zoneProviderIndex]);
                            finalProvidersIds.add(zoneProviderId);
                        } else {
                            break;
                        }
                    }
                }
            }

            for (const fav_provider of favourite_providers) {
                let dup_index = final_providers.findIndex((x) => (x._id).toString() == fav_provider.toString());
                if (dup_index == -1) {
                    let fav_index = providers.findIndex((x) => (x._id).toString() == fav_provider.toString())
                    if (fav_index !== -1) {
                        if (Number(final_providers.length) < Number(limit)) {
                            final_providers.push(providers[fav_index]);
                        }else{
                            break;
                        }
                    }
                }
            }

            for (const provider of providers) {
                if (final_providers.length >= limit) {
                    break;
                }
                let providerId = provider._id.toString();
                if (favourite_providersSet.has(providerId) && !finalProvidersIds.has(providerId)) {
                    final_providers.push(provider);
                    finalProvidersIds.add(providerId);
                }
            }

            for (const provider of providers) {
                if (final_providers.length >= limit) {
                    break;
                }
                let providerId = provider._id.toString();
                if (!finalProvidersIds.has(providerId)) {
                    final_providers.push(provider);
                    finalProvidersIds.add(providerId);
                }
            }

            if ((setting_detail.is_allow_ride_share && is_ride_share) || trip?.is_trip_bidding) {
                final_providers = final_providers.filter(provider => {
                    if (provider.is_trip.length === 0) {
                        return true;
                    }
            
                    if (!destination_location || !destination_location.length) {
                        return true;
                    }
            
                    if (provider.is_trip.length >= ride_share_limit && !trip?.is_trip_bidding) {
                        return false;
                    }
            
                    const pickup_diff_km = Math.abs(utils.getDistanceFromTwoLocation(sourceLocation, provider.providerLocation));
                    if (pickup_diff_km > setting_detail.ride_share_pickup_radius) {
                        return false;
                    }
            
                    let destination_condition = true;
                    if (!provider.destinationLocation) {
                        provider.destinationLocation = [];
                    }
            
                    for (const destinationLocation of provider.destinationLocation) {
                        const destination_diff_km = Math.abs(utils.getDistanceFromTwoLocation(destination_location, destinationLocation));
                        if (destination_diff_km > setting_detail.ride_share_destination_radius) {
                            destination_condition = false;
                            break;
                        }
                    }
            
                    return destination_condition || trip?.is_trip_bidding;
                });
            }        

            if (!destination_location) {
                final_providers = final_providers.filter(provider => provider.is_go_home !== 1);
            } else if (setting_detail.is_driver_go_home && destination_location) {
                final_providers = final_providers.filter(provider => {
                    if (!provider.address_location || provider.address_location.length === 0) {
                        provider.address_location = [0, 0];
                    }
            
                    if (provider.is_go_home && provider.address_location.toString() !== [0, 0].toString()) {
                        if (destination_location.length !== 0) {
                            let destination_diff_km = Math.abs(utils.getDistanceFromTwoLocation(destination_location, provider.address_location));
                            let destination_diff_meter = destination_diff_km * 1000;
                            return destination_diff_meter <= setting_detail.driver_go_home_radius;
                        }
                    }
                    return true;
                });
            }
          
            if (final_providers.length == 0 && providers.length != 0) {
                await handleNoProviderFound(trip, resolve)
            }

            if (!trip) {
                // terminate for provider list
                resolve({
                    success: true,
                    message: success_messages.MESSAGE_CODE_YOU_GET_NEARBY_DRIVER_LIST,
                    providers: final_providers
                });
                return;
            }

            if (setting_detail.find_nearest_driver_type == Number(constant_json.NEAREST_PROVIDER_TYPE_SINGLE) && !trip.is_trip_bidding) {
                trip.current_provider = final_providers[0]._id;
                trip.provider_type = final_providers[0].provider_type;
                trip.provider_type_id = final_providers[0].provider_type_id;
            }

            trip.unit = city_detail.unit;
            trip.is_provider_accepted = 0;

            let current_providers = [];

            if (setting_detail.find_nearest_driver_type == Number(constant_json.NEAREST_PROVIDER_TYPE_SINGLE) && !trip.is_trip_bidding) {
                current_providers.push(final_providers[0]._id);
            } else {
                current_providers = final_providers.map(provider => provider._id);
            }

            trip.find_nearest_provider_time = new Date();
            trip.current_providers = current_providers;

            await Trip.updateOne({ _id: trip._id }, trip.getChanges())

            let trips = [];
            trips.push(trip._id);


            for (let final_provider of final_providers) {
                let idx = current_providers.findIndex(i => String(i) == String(final_provider._id));
                if (idx != -1) {
                    let is_trip_condition = { _id: final_provider._id, is_trip: [] };
                    let is_trip_update = { is_available: 0, is_trip: trips, is_near_available: 0, $inc: { total_request: 1 } };
                    
                    if (trip.is_ride_share && setting_detail.is_allow_ride_share) {
                        is_trip_condition = { _id: final_provider._id };
                        is_trip_update = { is_available: 0, $push: { is_trip: trip._id }, is_ride_share: 1, is_near_available: 0, $inc: { total_request: 1 } };
                    }

                    if(trip.is_trip_bidding || final_provider.bids.length > 0 ){
                        is_trip_update = { is_available: 0, $push: { is_trip: trip._id }, is_near_available: 0, $inc: { total_request: 1 } };
                        delete is_trip_condition.is_trip
                    }
                    
                    if (setting_detail.is_receive_new_request_near_destination && final_provider.is_trip.length != 0 && 
                        final_provider.is_near_available == 1 && !trip.is_ride_share) {
                        is_trip_condition = { _id: final_provider._id, is_near_trip: [] };
                        is_trip_update = { is_near_available: 0, is_near_trip: trips, $inc: { total_request: 1 } };
                    }

                    let updateCount = await Provider.updateOne(is_trip_condition, is_trip_update)
                    if (updateCount.modifiedCount != 0) {
                        let is_trip_condition = { _id: final_provider._id, is_trip: trip._id };
                        if (setting_detail.is_receive_new_request_near_destination) {
                            if (final_provider.is_trip.length != 0 && final_provider.is_near_available == 1) {
                                is_trip_condition = { _id: final_provider._id, is_near_trip: trip._id };
                            }
                        }
                        let provider = await Provider.findOne(is_trip_condition);
                        if (provider) {
                            if ((trip.is_ride_share && final_provider.is_trip.length != 0) ||
                                (final_provider.is_trip.length != 0 && final_provider.is_near_available == 1)) {
                                utils.update_request_status_socket(final_provider.is_trip[0], trip._id);
                                myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, TRIP_STATUS.WAITING_FOR_PROVIDER);
                                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_NEW_NEAREST_TRIP, "", null, provider.lang_code);
                            } else {
                                utils.send_socket_request(trip._id, provider._id);
                                myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, TRIP_STATUS.WAITING_FOR_PROVIDER);
                                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_NEW_TRIP, "", null, provider.lang_code);
                            }
                        }
                    }
                }
            }
                     
            
            resolve({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CREATED_SUCCESSFULLY,
                trip_id: trip._id,
                is_schedule_trip: trip.is_schedule_trip,
                trip_unique_id: trip.unique_id
            });
            return;

        } catch (err) {
            resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        } finally {
            if (is_save_log) {
                //save logs 
                let trip_id = trip?._id || null
                let log;
                let no_of_time_send_request = 0;
                if(trip_id){
                    log = await Find_provider_logs.findOne({trip_id : trip_id})
                    no_of_time_send_request = trip.no_of_time_send_request
                }else if(req_data){
                    log = await Find_provider_logs.findOne({"body.user_id" : req_data?.user_id})
                }
                if (!log) {
                    log = new Find_provider_logs()
                }
                log.body = req_data 
                log.quey = provider_query
                log.online_providers = await Provider.find({cityid : city_id , is_available : 1 , is_active : 1 ,is_approved : 1},{ providerLocation : 1 }) || []
                log.city_id = city_id
                log.trip_id = trip_id
                log.no_of_time_send_request = no_of_time_send_request
                await Find_provider_logs.updateOne({ _id: log._id }, log.getChanges());
            }
        }
    })
};


////  START USER CREATE TRIP SERVICE //// ////////
exports.create = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'service_type_id', type: 'string' },
            { name: 'timezone', type: 'string' }
        ]

        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user_data = await User.findOne({ _id: req.body.user_id })
        if (Number(req.body.trip_type) == constant_json.TRIP_TYPE_NORMAL && user_data.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }
        if (!user_data) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (user_data.current_trip_id) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
            return;
        }

        // Don't need to check the user document flow when the trip created by below.
        const trip_type_condition = Number(req.body.trip_type) != constant_json.TRIP_TYPE_GUEST_TOKEN &&
            Number(req.body.trip_type) != constant_json.TRIP_TYPE_HOTEL &&
            Number(req.body.trip_type) != constant_json.TRIP_TYPE_DISPATCHER &&
            Number(req.body.trip_type) != constant_json.TRIP_TYPE_PROVIDER &&
            Number(req.body.trip_type) != constant_json.TRIP_TYPE_CORPORATE

        if(user_data.is_documents_expired && trip_type_condition){
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DOCUMENT_EXPIRED });
            return;
        }
        if (!user_data.is_document_uploaded && trip_type_condition) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_DOCUMENT_NOT_UPLOADED });
            return;
        }

        let provider_id = null
        if (req.body.provider_id || req.body.select_trip_provider) {
            provider_id = req.body.provider_id ? req.body.provider_id : req.body.select_trip_provider
        }
        if (typeof req.body.created_by == 'undefined') {
            req.body.created_by = constant_json.CREATED_BY_USER_APP
        }
        req.body.created_by = Number(req.body.created_by);

        let citytype = await Citytype.findOne({ _id: req.body.service_type_id })
        let data = await exports.check_trip_inside_zone_queue_async(citytype.cityid, req.body.latitude, req.body.longitude)

        req.body.is_trip_inside_zone_queue = data.is_trip_inside_zone_queue;
        req.body.zone_queue_id = data.zone_queue_id;


        let trip_type = constant_json.TRIP_TYPE_NORMAL;

        
        let trip_response = await exports.create_trip(user_data, trip_type, req.body.service_type_id, req.body)
        if (!trip_response.success) {
            res.json(trip_response);
            return;
        }

        let trip = trip_response.trip;
        if (req.body.promo_id) {
            let promocode = await Promo_Code.findOne({ _id: req.body.promo_id })
            if (promocode) {
                promocode.user_used_promo = promocode.user_used_promo + 1;

                await Promo_Code.updateOne({ _id: req.body.promo_id }, promocode.getChanges())

                trip.promo_id = promocode._id;
                await Trip.updateOne({ _id: trip._id }, trip.getChanges())

                let userpromouse = new User_promo_use({
                    promo_id: promocode._id,
                    promocode: promocode.promocode,
                    user_id: req.body.user_id,
                    promo_type: promocode.code_type,
                    promo_value: promocode.code_value,
                    trip_id: trip._id,
                    user_used_amount: 0
                });
                await userpromouse.save();
            }
        }

        if (trip.trip_type == constant_json.TRIP_TYPE_HOTEL) {
            req.flash('response_code', admin_messages.success_create_trip);
        }

        if (trip.is_schedule_trip) {
            res.json({
                success: true,
                trip: trip,
                message: success_messages.MESSAGE_CODE_YOUR_FUTURE_TRIP_CREATE_SUCCESSFULLY
            });
            return;
        }

        let nearest_provider_response = await exports.nearest_provider(trip, provider_id, user_data.favourite_providers,req.body)
        if (nearest_provider_response.success) {
            user_data.current_trip_id = trip._id;
            await User.updateOne({ _id: user_data._id }, user_data.getChanges());
        if ((trip.trip_type == constant_json.TRIP_TYPE_CORPORATE  || trip.trip_type == constant_json.TRIP_TYPE_DISPATCHER || trip.trip_type == constant_json.TRIP_TYPE_HOTEL)  && req.body?.user_type_id != null  &&  req.body?.corporate_id == null) {
                let phoneWithCode = user_data.country_phone_code + user_data.phone;
                let user_panel_url = setting_detail.user_panel_url
                let map = user_panel_url+'/track-trip?user_id='+user_data._id+'&trip_id='+ trip._id
                utils.sendSmsToEmergencyContact(phoneWithCode, 8, user_data.first_name + " " + user_data.last_name, map, trip.providerLocation.providerLocation);
            }
            res.json(nearest_provider_response);
            return;
        }

        res.json({
            success: false,
            error_code: error_message.ERROR_CODE_CREATE_TRIP_FAILED
        });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.provider_create = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = [
            { name: 'provider_id', type: 'string' },
            { name: 'phone', type: 'string' },
            { name: 'service_type_id', type: 'string' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider_detail = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider_detail) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        let trip_count = await Trip.count({
            provider_id: req.body.provider_id,
            is_trip_cancelled: 0,
            is_trip_completed: 0,
            is_trip_end: 0
        })
        if (trip_count) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
            return;
        }

        req.body.created_by = Number(constant_json.CREATED_BY_PROVIDER_APP);
        let user_data = await User.findOne({ country_phone_code: req.body.country_phone_code, phone: req.body.phone });
        if (!user_data && req.body.email) {
            user_data = await User.findOne({ email: req.body.email });
        }
        if (user_data) {
            if (user_data.current_trip_id) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
                return;
            }

            req.body.trip_type = constant_json.TRIP_TYPE_PROVIDER;
            let trip_response = await exports.create_trip(user_data, constant_json.TRIP_TYPE_PROVIDER, req.body.service_type_id, req.body)
            if (!trip_response.success) {
                res.json(trip_response);
                return;
            }

            let trip = trip_response.trip;
            if (trip.is_schedule_trip) {
                res.json({
                    success: true,
                    trip: trip,
                    message: success_messages.MESSAGE_CODE_YOUR_FUTURE_TRIP_CREATE_SUCCESSFULLY
                });
                return;
            }

            let now_date = new Date()
            trip.is_toll = setting_detail.is_toll;
            trip.provider_unique_id = provider_detail.unique_id;
            trip.provider_first_name = provider_detail.first_name;
            trip.provider_last_name = provider_detail.last_name;
            trip.provider_phone_code = provider_detail.country_phone_code;
            trip.provider_phone = provider_detail.phone;
            trip.provider_type = provider_detail.provider_type;
            trip.provider_type_id = provider_detail.provider_type_id;
            trip.current_provider = provider_detail._id;
            trip.current_providers = [provider_detail._id];
            trip.confirmed_provider = provider_detail._id;
            trip.provider_id = provider_detail._id;
            trip.is_provider_accepted = 1;
            trip.is_provider_status = 4;
            trip.accepted_time = now_date;
            trip.provider_arrived_time = now_date;
            trip.provider_trip_start_time = now_date;

            let is_favourite_provider = false;
            let index = user_data.favourite_providers.findIndex((x) => (x).toString() == (provider_detail._id).toString());
            if (index !== -1) {
                is_favourite_provider = true;
            }
            trip.is_favourite_provider = is_favourite_provider;

            // Set trip status
            trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.ACCEPTED, TYPE_VALUE.PROVIDER )

            await Trip.updateOne({ _id: trip._id }, trip.getChanges())

            let trips = [];
            trips.push(trip._id);
            provider_detail.is_trip = trips;
            provider_detail.total_request = provider_detail.total_request + 1;
            provider_detail.accepted_request = provider_detail.accepted_request + 1;
            provider_detail.is_available = 0;

            await Provider.updateOne({ _id: provider_detail._id }, provider_detail.getChanges())
            myAnalytics.insert_daily_provider_analytics(trip.timezone, provider_detail._id, TRIP_STATUS.INITIATE_TRIP);

            user_data.current_trip_id = trip._id;
            await User.updateOne({ _id: user_data._id }, user_data.getChanges());
            utils.sendPushNotification(user_data.device_type, user_data.device_token, push_messages.PUSH_CODE_FOR_PROVIDER_INITATE_TRIP, "", null, user_data.lang_code);
            // socket for user get trip when provider create trip
            utils.user_get_trip(user_data._id)
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CREATED_SUCCESSFULLY,
                trip_id: trip._id,
                user: user_data,
                is_schedule_trip: trip.is_schedule_trip
            });
            return;
        }

        let duplicate_user_email = await User.findOne({ email: req.body.email })
        if(duplicate_user_email && req.body.email){
            return res.json({success:false,error_code: error_message.ERROR_CODE_EMAIL_ID_ALREADY_REGISTERED})
        }

        let duplicate_user_phone = await User.findOne({ phone: req.body.phone,country_phone_code:req.body.country_phone_code })
        if(duplicate_user_phone){
            return res.json({success:false,error_code: error_message.ERROR_CODE_PHONE_NUMBER_ALREADY_USED})
        }

        const alpha2 = req.body.alpha2
        let country_phone_code = req.body.country_phone_code;
        let match = { countryphonecode: country_phone_code }
        
        if(alpha2) {
            match = {  alpha2: alpha2 }
        }

        let country = await Country.findOne(match)

        let wallet_currency_code = "";
        let countryname = "";
        if (country) {
            wallet_currency_code = country.currencycode;
            countryname = country.countryname;
        } else {
            let index = country_list.findIndex(i => i.alpha2 == alpha2);
            if (index != -1) {
                wallet_currency_code = country_list[index].currency_code;
                countryname = country_list[index].name
            }
        }

        let first_name = req.body.first_name;
        let last_name = req.body.last_name;
        let encrypt_password = require('crypto').createHash('md5').update(req.body.phone).digest('hex');
        let referral_code = (utils.tokenGenerator(8)).toUpperCase();
        
        let user = new User({
            first_name: first_name,
            last_name: last_name,
            email: ((req.body.email).trim()).toLowerCase(),
            password: encrypt_password,
            user_type: Number(constant_json.USER_TYPE_PROVIDER),
            user_type_id: provider_detail._id,
            country_phone_code: req.body.country_phone_code,
            phone: req.body.phone,
            token: utils.tokenGenerator(32),
            country: countryname,
            referral_code: referral_code,
            is_referral : 1,    // Set is_referral to 1 as we are setting random referral
            wallet_currency_code: wallet_currency_code,
            alpha2: alpha2
        });

        await user.save();

        if(country && country._id) {
            // FOR ADD DOCUEMNTS
            utils.insert_documets_for_new_users(user, Number(constant_json.USER_TYPE_NORMAL), country._id, function (document_response) {})
        }
        
        // Trigger admin notification
        utils.addNotification({
            type: ADMIN_NOTIFICATION_TYPE.USER_REGISTERED,
            user_id: user._id,
            username: user.first_name + " " + user.last_name,
            picture: user.picture,
            country_id: (country && country._id) ? country._id : null,
            user_unique_id: user.unique_id,
        })

        if (setting_detail.email_notification) {
            allemails.sendUserRegisterEmail(req, user);
        }
        let trip_response = await exports.create_trip(user, constant_json.TRIP_TYPE_PROVIDER, req.body.service_type_id, req.body)
        if (!trip_response.success) {
            res.json(response);
            return;
        }

        let trip = trip_response.trip;


        if (trip.is_schedule_trip) {
            res.json({
                success: true,
                trip: trip,
                message: success_messages.MESSAGE_CODE_YOUR_FUTURE_TRIP_CREATE_SUCCESSFULLY
            });
            return;
        }

        trip.is_toll = setting_detail.is_toll;
        trip.provider_unique_id = provider_detail.unique_id;
        trip.provider_phone_code = provider_detail.country_phone_code;
        trip.provider_phone = provider_detail.phone;
        trip.provider_first_name = provider_detail.first_name;
        trip.provider_last_name = provider_detail.last_name;
        trip.provider_type = provider_detail.provider_type;
        trip.provider_type_id = provider_detail.provider_type_id;
        trip.current_provider = provider_detail._id;
        trip.current_providers = [provider_detail._id];
        trip.confirmed_provider = provider_detail._id;
        trip.provider_id = provider_detail._id;
        trip.is_provider_accepted = 1;
        trip.is_provider_status = 4;
        let now_date = new Date();
        trip.accepted_time = now_date;
        trip.provider_arrived_time = now_date;
        trip.provider_trip_start_time = now_date;

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        let trips = [];
        trips.push(trip._id);
        provider_detail.is_trip = trips;
        provider_detail.total_request = provider_detail.total_request + 1;
        provider_detail.accepted_request = provider_detail.accepted_request + 1;
        provider_detail.is_available = 0;

        await Provider.updateOne({ _id: provider_detail._id }, provider_detail.getChanges())
        myAnalytics.insert_daily_provider_analytics(trip.timezone, provider_detail._id, TRIP_STATUS.INITIATE_TRIP);

        user.current_trip_id = trip._id;
        await User.updateOne({ _id: user._id }, user.getChanges());
        // socket for user get trip when provider create trip
        utils.user_get_trip(user._id)
        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_YOUR_TRIP_CREATED_SUCCESSFULLY,
            trip_id: trip._id,
            user: user,
            is_schedule_trip: trip.is_schedule_trip
        });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.send_request_from_dispatcher = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider_id = null
        if (req.body.provider_id) {
            provider_id = req.body.provider_id;
        }
        let tripData = await Trip.findOne({ _id: req.body.trip_id })

        let nearest_provider_response = await exports.nearest_provider(tripData, provider_id, [],null,req.body)
        res.json(nearest_provider_response);
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.get_near_by_provider = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
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
            case TYPE_VALUE.PARTNER:
                Table = Partner
                break;
            case TYPE_VALUE.CORPORATE:
                Table = Corporate
                break;
            case TYPE_VALUE.HOTEL:
                Table = Hotel
                break;
            case TYPE_VALUE.DISPATCHER:
                Table = Dispatcher
                break;
            default:
                Table = User
                break;
        }
        let user = await Table.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_PROVIDER_FOUND_SELECTED_SERVICE_TYPE_AROUND_YOU });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        if (req.body.service_type_id) {
            let citytype = await Citytype.findOne({ _id: req.body.service_type_id })
            if (citytype) {
                let nearest_provider_response = await exports.nearest_provider(null, null, [], citytype, req.body)
                res.json(nearest_provider_response);
                return;
            }
        }
        let nearest_provider_response = await exports.nearest_provider(null, null, [], null, req.body)
        res.json(nearest_provider_response);
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.provider_get_trips = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let openride_acceted_trip
                        if (!provider.is_near_trip) { provider.is_near_trip = [] }
                        if (provider.is_trip.length == 0 && provider.is_near_trip.length != 0) {
                            provider.is_trip = provider.is_near_trip;
                            provider.is_available = 0;
                            provider.is_near_trip = []

                            let acceted_trip = await Trip.count({$or: [{ $and: [{_id: {$in: provider.is_trip}}, {provider_id: provider.id}]}, {_id: {$in: provider.schedule_trip}}]})
                            openride_acceted_trip = await OpenRide.count({$or: [  {provider_id: provider.id}, {_id: {$in: provider.open_ride}}]})
                            if(acceted_trip == 0){
                                provider.is_available = 1;
                            }
                            if(openride_acceted_trip == 0){
                                provider.is_available = 1;
                            }
                            await provider.save();
                        }
                            let filtered_is_trip

                            filtered_is_trip = provider.is_trip
                            if (openride_acceted_trip != 0) {
                                filtered_is_trip = provider.open_ride
                            }
                            
                            if(provider.is_trip.length > 0){
                                filtered_is_trip = provider.is_trip.filter(trip => !provider.bids.some(bid => bid.trip_id.toString() === trip.toString()));
                            } else if(provider.schedule_trip.length > 0){
                                filtered_is_trip = [provider.schedule_trip[provider.schedule_trip.length - 1]]
                            }
                            else if(provider.open_ride.length > 0){
                                filtered_is_trip = [provider.open_ride[provider.open_ride.length - 1]]
                            }

                        return res.json({ success: true, message: success_messages.MESSAGE_CODE_YOU_GET_TRIP, trip_detail: filtered_is_trip, bids: provider.bids })
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

exports.provider_get_trip_details = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        try {
            const setting_detail = await Settings.findOne({});


            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }
            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            if (!provider.is_near_trip) { provider.is_near_trip = [] }
            if (provider.is_trip.length == 0 && provider.is_near_trip.length != 0) {
                provider.is_trip = provider.is_near_trip;
                provider.is_available = 0;
                provider.is_near_trip = []

                let acceted_trip = await Trip.count({_id: {$in: provider.is_trip}, provider_id: provider.id})
                if(acceted_trip == 0){
                    provider.is_available = 1;
                }
            }
            if (provider.is_trip.length == 0 && provider.schedule_trip?.length == 0 && provider.open_ride?.length == 0) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            }
            
            let filtered_is_trip = provider.is_trip;
            if(provider.is_trip.length > 0){
                filtered_is_trip = provider.is_trip.filter(trip => !provider.bids.some(bid => bid.trip_id.toString() === trip.toString()));
            }
            if(provider.open_ride.length > 0){
                filtered_is_trip = provider.open_ride.filter(trip => !provider.bids.some(bid => bid.trip_id.toString() === trip.toString()));
            }
            let trip = await Trip.find({ _id: { $in: filtered_is_trip } });

            let schedule_trip = provider.schedule_trip
            let schedule_trips = await Trip.find({ _id: { $in: schedule_trip}})  
            let openride_schedule_trips = await OpenRide.find({ _id: { $in: provider.open_ride}})

            let trip_histories = await Trip_history.find({ _id: { $in: filtered_is_trip } });
            let trips = [...schedule_trips, ...openride_schedule_trips, ...trip, ...trip_histories];
            let trip_detail = [];

            for (let trip of trips) {
                if (trip.is_trip_cancelled == 0 && trip.is_provider_invoice_show == 0 && trip.is_trip_completed == 0) {
                    let userid
                    if (trip.openride) {
                        const filteredObjects = trip.user_details.filter(item => 
                            item.status == 0 && item.send_req_to_provider_first_time == 0 
                        );
                        if (filteredObjects.length != 0) {
                            userid = filteredObjects[0].user_id
                        }
                        
                    } else {
                        userid = trip.user_id
                    }

                    let user_detail = await User.findOne({ _id: userid })
                        let start_time = trip.updated_at;
                        let end_time = new Date();
                        let res_sec = utils.getTimeDifferenceInSecond(end_time, start_time);
                        let provider_timeout = setting_detail.provider_timeout;
                        
                        if(trip.is_trip_bidding){
                            let country_detail = await Country.findOne({_id: trip.country_id},{provider_bidding_timeout: 1});
                            provider_timeout = country_detail.provider_bidding_timeout;
                        }
                        let time_left_to_responds_trip = provider_timeout - res_sec;

                        trip_detail.push({
                            trip_id: trip._id,
                            unique_id: trip.unique_id,
                            user_id: userid,
                            is_provider_accepted: trip.is_provider_accepted,
                            is_provider_status: trip.is_provider_status,
                            trip_type: trip.trip_type,
                            source_address: trip.source_address,
                            destination_address: trip.destination_address,
                            sourceLocation: trip.sourceLocation,
                            destinationLocation: trip.destinationLocation,
                            is_trip_end: trip.is_trip_end,
                            time_left_to_responds_trip: time_left_to_responds_trip,
                            user: {
                                first_name: user_detail?.first_name ? user_detail?.first_name : '',
                                last_name: user_detail?.last_name ? user_detail?.last_name : '',
                                phone: user_detail?.phone ? user_detail?.phone : '',
                                country_phone_code: user_detail?.country_phone_code ? user_detail?.country_phone_code : '',
                                rate: user_detail?.rate ? user_detail?.rate : 0,
                                rate_count: user_detail?.rate_count ? user_detail?.rate_count : 0,
                                picture: user_detail?.picture ? user_detail?.picture : ''
                            }
                        })
                        if (trip.openride) {
                            let userdetails_index = trip.user_details.findIndex(item => String(item.user_id) == String(userid))
                            if (userdetails_index != -1) {
                                trip.user_details[userdetails_index].send_req_to_provider_first_time = 1 
                                await OpenRide.updateOne({ _id: trip._id }, trip.getChanges())
                            }
                        }
                    
                } else {
                    provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
                    if (!provider.is_near_trip) { provider.is_near_trip = [] }
                    if ((String(provider.is_near_trip[0]) == String(trip._id))) {
                        provider.is_near_available = 1;
                        provider.is_near_trip = [];
                    }
                }
            }
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())

            if (trip_detail.length == 0) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            }
            trip_detail.sort((a, b) => a.is_provider_accepted - b.is_provider_accepted);
            return res.json({ success: true, message: success_messages.MESSAGE_CODE_YOU_GET_TRIP, trip_detail });
        } catch (e) {
            console.log(e)
            return res.json({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    });
};


////////////USER  GET TRIPSTATUS//////////// ///
exports.user_get_trip_status = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }
        if (user.is_approved == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED })
            return;
        }

        if (req.body?.trackUrl !== true &&   user.token != req.body?.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }
        let json;
        if (req.body.type == "web") {
            json = { user_id: req.body.user_id, _id: req.body.trip_id }
        } else {
            json = { user_id: req.body.user_id, _id: req.body.trip_id ? req.body.trip_id : user.current_trip_id }
        }
        let openride_json = {'user_details.user_id': Schema(req.body.user_id), _id: req.body.trip_id ? req.body.trip_id : user.current_trip_id }
        let trip = await Trip.findOne(json) || await Trip_history.findOne(json) || await OpenRide.findOne(openride_json)
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP })
            return
        }
        let country = await Country.findOne({ _id: trip.country_id })
        if (trip.is_trip_cancelled_by_provider == 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_CANCELLED_BY_PROVIDER });
            return;
        }
        let tripservice = await Trip_Service.findOne({ _id: trip.trip_service_city_type_id })
        if (!tripservice) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
            return;
        }
        let citytype_detail = await Citytype.findById(trip.service_type_id)
        let type_detail = await Type.findById(citytype_detail.typeid)
        let cancellation_fee = tripservice.cancellation_fee;
        if (trip.car_rental_id) {
            let rental_main_citytype = await Citytype.findOne({ car_rental_ids: trip.car_rental_id });
            if (rental_main_citytype) {
                cancellation_fee = rental_main_citytype.cancellation_fee
            }
        }
        let waiting_time_start_after_minute = tripservice.waiting_time_start_after_minute;
        let price_for_waiting_time = tripservice.price_for_waiting_time;
        let total_wait_time = 0;
        let provider_arrived_time = trip.provider_arrived_time;
        let now = new Date();
        
        if (provider_arrived_time != null) {
            let end_time = new Date();
            total_wait_time = utils.getTimeDifferenceInSecond(end_time, provider_arrived_time);
            total_wait_time = total_wait_time - waiting_time_start_after_minute * 60;
        }
 
        let cityDetail = await City.findOne({ _id: citytype_detail.cityid })
        if (!cityDetail) {
            res.json({
                success: false,
                error_code: error_message.ERROR_CODE_NO_CITY_LIST_FOUND
            });
            return;
        }
        let user_promo_use = await User_promo_use.findOne({ trip_id: trip._id })
        let isPromoUsed = 0;
        let PAYMENT_TYPES = utils.PAYMENT_TYPES();
        if (user_promo_use) {
            isPromoUsed = 1;
        }
        if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
            let minutes = utils.getTimeDifferenceInMinute(now, trip.provider_trip_start_time);
            trip.total_time = minutes;
            if(trip.openride){
                await OpenRide.updateOne({ _id: trip._id }, trip.getChanges())
            }else{
                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
            }
        }
        let provider_trip_end_time = trip.provider_trip_end_time;
        let diff = utils.getTimeDifferenceInSecond(now, provider_trip_end_time);
        let tip_timeout = 30;
        if (diff < 0) {
            diff = 0;
        }
        let time_left_for_tip = tip_timeout - diff;
        utils.socket_provider_location_update(trip.unique_id, trip.provider_id)
        res.json({
            success: true,
            map_pin_image_url: type_detail.map_pin_image_url,
            type_name:type_detail.typename,
            message: success_messages.MESSAGE_CODE_YOU_GET_TRIP_STATUS,
            city_detail: cityDetail,
            trip: trip,
            time_left_for_tip: time_left_for_tip,
            waiting_time_start_after_minute: waiting_time_start_after_minute,
            price_for_waiting_time: price_for_waiting_time,
            total_wait_time: total_wait_time,
            isPromoUsed: isPromoUsed,
            server_time: new Date(),
            cancellation_fee: cancellation_fee,
            payment_gateway: PAYMENT_TYPES,
            country_code: country?.alpha2
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};

/////////////RESPOND TRIP///////////////////

exports.responds_trip = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        if (!ObjectId.isValid(req.body.trip_id)) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED });
            return;
        }

        let trip = await Trip.findOne({ _id: req.body.trip_id, current_providers: provider._id });
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED });
            return;
        }

        let is_provider_accepted = req.body.is_provider_accepted;
        if (trip.is_trip_cancelled == 1) {
            if (is_provider_accepted == 1) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED });
                return;
            }

            res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REJECTED_TRIP });
            return;
        }

        if (trip.is_provider_accepted == 1) {
            if (is_provider_accepted == 1) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED });
                return;
            }

            res.json({ success: true, message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REJECTED_TRIP });
            return;
        }

        if (is_provider_accepted == 1 ) {

            if(trip.is_trip_bidding && req.body.bid_price && (trip.bid_price < +req.body.bid_price)){
                let bid_trip_response = await exports.driver_bids_trip(req.body.bid_price, provider, trip)
                res.json(bid_trip_response);
            }else{
                let accept_trip_response = await exports.accept_trip(provider, trip, req)
                res.json(accept_trip_response);
            }
            return;
        }

        let reject_trip_response = await exports.reject_trip(provider, trip, req.body.is_request_timeout)
        res.json(reject_trip_response);
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.driver_bids_trip = function (bid_price, provider, trip) {
    return new Promise(async (resolve, reject) => {
        try {
            let country_detail = await Country.findOne({_id: trip.country_id},{provider_bidding_timeout: 1,user_bidding_timeout: 1});
                    
            let now = new Date();
            let end = new Date();
            end.setSeconds(end.getSeconds() + +country_detail.user_bidding_timeout);
            end = new Date(end)

            let user_detail = await User
                .findOne({ _id: trip.user_id })
                .select({
                    favourite_providers: 1,
                    country_phone_code: 1,
                    phone: 1,
                    device_type: 1,
                    device_token: 1,
                    picture: 1,
                    rate: 1,
                    rate_count: 1
                })
            let is_favourite_provider = false;

            if (user_detail) {
                let index = user_detail.favourite_providers.findIndex((x) => (x).toString() == (provider._id).toString());
                if (index !== -1) {
                    is_favourite_provider = true;
                }
            }


            let bids = trip.bids;
            bids.push({ 
                provider_id: provider._id, 
                first_name: provider.first_name,
                last_name: provider.last_name,
                picture: provider.picture,
                is_favourite_provider: is_favourite_provider,
                currency: trip.currency,
                ask_bid_price: bid_price, 
                bid_at: now,
                bid_end_at: end,
                rate: provider.rate,
                rate_count: provider.rate_count,
                status: 0
            });
            trip.bids = bids
            
            if(trip.current_providers.length == 0){
                await exports.nearest_provider(trip, null, []);
            }
            
            await Trip.updateOne({ _id: trip._id, is_provider_accepted: 0 }, trip.getChanges())


            let provider_bids = provider.bids;
            provider_bids.push({ 
                trip_id: trip._id, 
                unique_id: trip.unique_id, 
                first_name: trip.user_first_name,
                last_name: trip.user_last_name,
                picture: user_detail.picture,
                currency: trip.currency,
                bid_price: trip.bid_price, 
                ask_bid_price: bid_price, 
                bid_at: now,
                bid_end_at: end,
                rate: user_detail.rate,
                rate_count: user_detail.rate_count,
                status: 0
            });
            provider.bids = provider_bids
            provider.is_available = 1;
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())

            utils.update_request_status_socket(trip._id);
            resolve({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_BID_TRIP_SUCCESSFULLY,
                is_trip_bidding: trip.is_trip_bidding
            });
        } catch (e) {
            resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    })
};

exports.user_reject_bid = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' },
            { name: 'provider_id', type: 'string' }
        ];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            if(res){
                res.json(response);
            }
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            if(res){
                res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            }
            return;
        }

        if (user.token != req.body.token && !req.body.is_from_cron) {
            if(res){
                res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            return;
        }

        let trip = await Trip.findOne({ _id: req.body.trip_id });
        if (!trip) {
            if(res){
                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
            }
            return;
        }

        // remove bid entry of specific provider
        trip.bids = trip.bids.filter(function(bid) { return (bid.provider_id).toString() !== (req.body.provider_id).toString(); });
        trip.current_providers = trip.current_providers.filter(provider_id => provider_id.toString() !== (req.body.provider_id).toString());
        trip.markModified('bids');

        // remove bid entry of specific provider
        let provider = await Provider.findOne({ _id: req.body.provider_id });
        provider.bids = provider.bids.filter(function(bid) { return (bid.trip_id).toString() !== (req.body.trip_id).toString(); });
        provider.markModified('bids');
        
        trip.providers_id_that_rejected_trip.push(provider._id)
        trip.markModified('providers_id_that_rejected_trip');

        await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        if(trip.current_providers.length == 0){
            await exports.nearest_provider(trip, null, []);
        }

        utils.update_request_status_socket(trip._id);

        if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
            utils.get_service_id_socket(trip.user_type_id)
        }

        if(res){
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_USER_YOU_REJECT_BID_SUCCESSFULLY
            });
        }
        return;
    } catch (err) {
        console.log(err);
        utils.error_response(err, req, res)
    }
};

exports.user_accept_bid = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' },
            { name: 'provider_id', type: 'string' }
        ];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        if (user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let trip = await Trip.findOne({ _id: req.body.trip_id, is_provider_accepted: 0 });
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id });
        let trips = Trip.find({_id: {$in: provider.is_trip, is_provider_accepted: 1 }})
        if(trips.length > 0 || (provider.is_available == 0 && provider.is_near_trip.length == 0)){
            trip.bids = trip.bids.filter(function(bid) { return (bid.provider_id).toString() !== (provider._id).toString(); });
            trip.markModified('bids');
            await Trip.updateOne({ _id: trip._id }, trip.getChanges())
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
        }

        let now = new Date();
 
        // web panel future histoy socket
        if (trip.trip_type == constant_json.TRIP_TYPE_SCHEDULE) {
            utils.req_type_id_socket(trip.user_id)
        }
    
        // set trip values same as accept_trip api
        
        // set driver bid price as a fixed trip price
        trip.is_fixed_fare = true;
        let index = trip.bids.findIndex((x) => (x.provider_id).toString() == (provider._id).toString());
        if(index != -1){
            trip.fixed_price = trip.bids[index].ask_bid_price;

            let service_type_id = trip.service_type_id;
            if (trip.car_rental_id) {
                service_type_id = trip.car_rental_id;
            }
            let trip_service = await Trip_Service.findOne({ service_type_id: service_type_id }).sort({ _id: -1 })
            
            trip.provider_service_fees = Number((trip.fixed_price * trip_service.provider_profit * 0.01).toFixed(3));
        }

        // assign provider details to trip
        trip.current_provider = provider._id;
        trip.provider_type = provider.provider_type;
        trip.provider_type_id = provider.provider_type_id;
        trip.confirmed_provider = provider._id;
        trip.provider_app_version = provider.app_version;
        trip.provider_device_type = provider.device_type;
        trip.is_provider_accepted = 1;
        trip.is_provider_status = 1;
        trip.accepted_time = now;
        trip.is_schedule_trip = false;
        trip.provider_unique_id = provider.unique_id;
        trip.provider_phone_code = provider.country_phone_code;
        trip.provider_phone = provider.phone;
        trip.provider_first_name = provider.first_name;
        trip.provider_last_name = provider.last_name;

        let unique_id = pad(trip.unique_id, 7, '0');
        let invoice_number = constant_json.INVOICE_APP_NAME_CODE + " " + constant_json.INVOICE_PROVIDER_TRIP_EARNING_CODE + " " + (moment(now)).format(constant_json.DATE_FORMAT_MMDDYYYY) + " " + unique_id;
        trip.invoice_number = invoice_number;
        trip.provider_id = provider._id;
        trip.providerLocation = provider.providerLocation;
        trip.bearing = provider.bearing;
        let current_providers = trip.current_providers.filter((el) => { return String(el) !== String(provider._id) });
        trip.current_providers = [];
        let is_favourite_provider = false;
        if (user) {
            let index = user.favourite_providers.findIndex((x) => (x).toString() == (provider._id).toString());
            if (index !== -1) {
                is_favourite_provider = true;
            }
        }
        trip.is_favourite_provider = is_favourite_provider

        let providers_list = await Provider.find({ _id: current_providers }).select({
            device_type: 1,
            device_token: 1,
            is_trip: 1,
            is_near_trip: 1,
            bids: 1,
        })  

        for (let provider of providers_list) {
            utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_ACCEPTED_BY_ANOTHER_PROVIDER, "", null, provider.lang_code);

            let is_trip_condition = { _id: provider._id };
            let is_trip_update = { is_available: 1, is_trip: [] };
            if(trip.is_trip_bidding){
                is_trip_update = { $pull: { is_trip: trip._id } };
            }else if (provider.is_trip.length > 1) {
                is_trip_update = { is_available: 0, $pull: { is_trip: trip._id } };
            }
            if (!provider.is_near_trip) { provider.is_near_trip = [] }
            if (provider.is_near_trip.length != 0) {
                is_trip_update = { is_near_available: 1, is_near_trip: [] };
            }

            is_trip_update.bids = provider.bids;
            is_trip_update.bids = is_trip_update.bids.filter(function(bid) { return (bid.trip_id).toString() !== (trip._id).toString(); });

            await Provider.updateOne(is_trip_condition, is_trip_update);
        }

        myAnalytics.insert_daily_provider_analytics(trip.timezone, provider._id, TRIP_STATUS.PROVIDER_ACCEPTED);

        provider.accepted_request = provider.accepted_request + 1;
        provider.is_available = 0;
        if (trip.is_ride_share) {
            provider.is_ride_share = 1
            if (!provider.destinationLocation) {
                provider.destinationLocation = [];
            }
            provider.destinationLocation.push(trip.destinationLocation);
        }


        if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
            utils.get_service_id_socket(trip.user_type_id)
        }

        // create bid array on accept
        trip.bids = []
        let provider_bids = provider.bids;

        if(provider.is_trip.length > 0){
            utils.update_request_status_socket(provider.is_trip[0]);
        }
        // remove bid entry from other trips
        for await (const bid of provider_bids) {
            if(bid.trip_id.toString() != trip._id.toString()){
                let other_bid_trip = await Trip.findOne({_id: bid.trip_id})
                if(other_bid_trip){
                    other_bid_trip.bids = other_bid_trip.bids.filter(function(bid) { return (bid.provider_id).toString() !== (provider._id).toString(); });
                    let current_providers = other_bid_trip.current_providers.filter((el) => { return String(el) !== String(provider._id) });
                    other_bid_trip.current_providers = current_providers
                    await Trip.updateOne({ _id: other_bid_trip._id }, other_bid_trip.getChanges())
                    utils.update_request_status_socket(other_bid_trip._id);
                    
                    let index = provider.is_trip.findIndex((x) => (x).toString() == (other_bid_trip._id).toString());
                    if(index != -1){
                        provider.is_trip.splice(index, 1);
                    }
                }
            }
        }

        provider.bids = []

        if(!provider.is_trip.includes(trip._id) && !provider.is_near_trip.includes(trip._id)){
            provider.is_trip.push(trip._id);
        }
        provider.markModified('is_trip');
        
        await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        await Trip.updateOne({ _id: trip._id }, trip.getChanges())


        utils.update_request_status_socket(trip._id);
        utils.send_socket_request(trip._id, provider._id);
        if (user) {
            if (setting_detail.sms_notification) {
                utils.sendOtherSMS(user.country_phone_code + user.phone, 5, "");
            }
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_ACCEPT_TRIP, "", null, user.lang_code);
        }
        
        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACCEPTED_TRIP_SUCCESSFULLY,
            is_provider_accepted: trip.is_provider_accepted
        });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.accept_trip = function (provider, trip, req = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const setting_detail = await Settings.findOne({});
            if (provider.zone_queue_id) {
                provider = await utils.remove_from_zone_queue_new(provider);
            }
            let now = new Date();
            if(provider.zone_queue_id){
                provider = await utils.add_in_zone_queue_new(provider?.zone_queue_id, provider);
            }
            // web panel future histoy socket
            if (trip.trip_type == constant_json.TRIP_TYPE_SCHEDULE) {
                utils.req_type_id_socket(trip.user_id)
            }
            trip.current_provider = provider._id;
            trip.provider_type = provider.provider_type;
            trip.provider_type_id = provider.provider_type_id;
            trip.confirmed_provider = provider._id;
            trip.provider_app_version = provider.app_version;
            trip.provider_device_type = provider.device_type;
            trip.is_provider_accepted = 1;
            trip.is_provider_status = 1;
            trip.accepted_time = now;
            trip.is_schedule_trip = false;
            trip.provider_unique_id = provider.unique_id;
            trip.provider_phone_code = provider.country_phone_code;
            trip.provider_phone = provider.phone;
            trip.provider_first_name = provider.first_name;
            trip.provider_last_name = provider.last_name;

            trip.provider_id = provider._id;
            trip.providerLocation = provider.providerLocation;
            trip.bearing = provider.bearing;
            let current_providers = trip.current_providers.filter((el) => { return String(el) !== String(provider._id) });
            trip.current_providers = [];
            
            // Set trip status
            trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.ACCEPTED, TYPE_VALUE.PROVIDER )

            if(trip.is_trip_bidding){
                 // set driver bid price as a fixed trip price
                trip.is_fixed_fare = true;
                trip.fixed_price = req.body.bid_price;
                let service_type_id = trip.service_type_id;
                if (trip.car_rental_id) {
                    service_type_id = trip.car_rental_id;
                }
                let trip_service = await Trip_Service.findOne({ service_type_id: service_type_id }).sort({ _id: -1 })
                trip.provider_service_fees = Number((trip.fixed_price * trip_service.provider_profit * 0.01).toFixed(3));
                
                trip.bids = [];
            }
            let user_detail = await User
                .findOne({ _id: trip.user_id })
                .select({
                    favourite_providers: 1,
                    country_phone_code: 1,
                    phone: 1,
                    device_type: 1,
                    device_token: 1,
                    webpush_config:1
                })
            let is_favourite_provider = false;
            if (user_detail) {
                let index = user_detail.favourite_providers.findIndex((x) => (x).toString() == (provider._id).toString());
                if (index !== -1) {
                    is_favourite_provider = true;
                }
            }
            trip.is_favourite_provider = is_favourite_provider

            let update = await Trip.updateOne({ _id: trip._id, $or: [{is_provider_accepted: 0}, {is_provider_assigned_by_dispatcher: true}]  }, trip.getChanges())
            if (!update.modifiedCount) {
                resolve({
                    success: false,
                    error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED
                });
                return;
            }

            let providers_list = await Provider
                .find({ _id: current_providers })
                .select({
                    device_type: 1,
                    device_token: 1,
                    is_trip: 1,
                    is_near_trip: 1,
                    bids: 1
                })
            for (let provider of providers_list) {
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_ACCEPTED_BY_ANOTHER_PROVIDER, "", null, provider.lang_code);

                let is_trip_condition = { _id: provider._id };
                let is_trip_update = { is_available: 1, is_trip: [] };
                if (provider.is_trip.length > 1) {
                    is_trip_update = { is_available: 0, $pull: { is_trip: trip._id } };
                }
                if (!provider.is_near_trip) { provider.is_near_trip = [] }
                if (provider.is_near_trip.length != 0) {
                    is_trip_update = { is_near_available: 1, is_near_trip: [] };
                }

                is_trip_update.bids = provider.bids;
                is_trip_update.bids = is_trip_update.bids.filter(function(bid) { return (bid.trip_id).toString() !== (trip._id).toString(); });

                await Provider.updateOne(is_trip_condition, is_trip_update);
            }

            if (user_detail) {
                if (setting_detail.sms_notification) {
                    utils.sendOtherSMS(user_detail.country_phone_code + user_detail.phone, 5, "");
                }
                utils.sendPushNotification(user_detail.device_type, user_detail.device_token, push_messages.PUSH_CODE_FOR_ACCEPT_TRIP, "", user_detail.webpush_config, user_detail.lang_code);
            }
            myAnalytics.insert_daily_provider_analytics(trip.timezone, provider._id, TRIP_STATUS.PROVIDER_ACCEPTED);

            provider.accepted_request = provider.accepted_request + 1;
            provider.is_available = 0;
            
            let provider_bids = provider.bids;
            // remove bid entry from other trips
            console.log(provider.is_trip);
            //provider_bids.forEach(async (bid) => {
            for await (const bid of provider_bids) {

                if((bid.trip_id).toString() != (trip._id).toString()){
                    let other_bid_trip = await Trip.findOne({_id: bid.trip_id})
                    if(other_bid_trip){
                        other_bid_trip.bids = other_bid_trip.bids.filter(function(bid) { return (bid.provider_id).toString() !== (provider._id).toString(); });
                        await Trip.updateOne({ _id: other_bid_trip._id }, other_bid_trip.getChanges())
                        utils.update_request_status_socket(other_bid_trip._id);

                        let index = provider.is_trip.findIndex((x) => (x).toString() == (other_bid_trip._id).toString());
                        if(index != -1){
                            provider.is_trip.splice(index, 1);
                        }
                        
                        console.log(provider.is_trip);
                    }
                }
            }
            console.log(provider.is_trip);

            if(!provider.is_trip.includes(trip._id) && !provider.is_near_trip.includes(trip._id)){
                provider.is_trip.push(trip._id);
            }
            console.log(provider.is_trip);

            provider.bids = [];
            
            if (trip.is_ride_share) {
                provider.is_ride_share = 1
                if (!provider.destinationLocation) {
                    provider.destinationLocation = [];
                }
                provider.destinationLocation.push(trip.destinationLocation);
            }
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())

            utils.update_request_status_socket(trip._id,null,trip.is_provider_status);
            if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                utils.get_service_id_socket(trip.user_type_id)
            }
            resolve({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_ACCEPTED_TRIP_SUCCESSFULLY,
                is_provider_accepted: trip.is_provider_accepted
            });
        } catch (e) {
            resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    })
};

exports.reject_trip = function (provider, trip, is_request_timeout) {
    return new Promise(async (resolve, reject) => {
        try {
            const setting_detail = await Settings.findOne({});

            let zone_queue_id = provider.zone_queue_id;
            if (provider.zone_queue_id) {
                provider = await utils.remove_from_zone_queue_new(provider);
                provider = await utils.add_in_zone_queue_new(zone_queue_id, provider);
                if (is_request_timeout) {
                    myAnalytics.insert_daily_provider_analytics(trip.timezone, provider._id, TRIP_STATUS.NOT_ANSWERED);
                } else {
                    myAnalytics.insert_daily_provider_analytics(trip.timezone, provider._id, TRIP_STATUS.PROVIDER_REJECTED);
                }
                provider.rejected_request = provider.rejected_request + 1;
                provider = utils.remove_is_trip_from_provider(provider, trip._id)
                if (!provider.is_near_trip) { provider.is_near_trip = [] }
                if ((String(provider.is_near_trip[0]) == String(trip._id))) {
                    provider.is_near_available = 1;
                    provider.is_near_trip = [];
                }
                await Provider.updateMany({ zone_queue_id: provider.zone_queue_id, _id: { $ne: provider._id } }, { '$inc': { zone_queue_no: -1 } }, { multi: true });
            } else {
                if (is_request_timeout) {
                    myAnalytics.insert_daily_provider_analytics(trip.timezone, provider._id, TRIP_STATUS.NOT_ANSWERED);
                } else {
                    myAnalytics.insert_daily_provider_analytics(trip.timezone, provider._id, TRIP_STATUS.PROVIDER_REJECTED);
                }
                provider.rejected_request = provider.rejected_request + 1;
                provider = utils.remove_is_trip_from_provider(provider, trip._id)

                if (!provider.is_near_trip) { provider.is_near_trip = [] }
                if ((String(provider.is_near_trip[0]) == String(trip._id))) {
                    provider.is_near_available = 1;
                    provider.is_near_trip = [];
                }
            }


            trip.bids = trip.bids.filter(function(bid) { return (bid.provider_id).toString() !== (provider._id).toString(); });
            trip.markModified('bids');
    
            provider.bids = provider.bids.filter(function(bid) { return (bid.trip_id).toString() !== (trip._id).toString(); });
            provider.markModified('bids');
    
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())

            let trip_changes = trip.getChanges()
            trip_changes['$pull'] = { current_providers: provider._id }
            trip_changes['$push'] = { providers_id_that_rejected_trip: provider._id }
            if(trip.is_schedule_trip) {
                trip_changes['$addToSet'] = {providers_id_that_rejected_trip_for_schedule: provider._id}
            }
            let updateTrip = await Trip.findOneAndUpdate({_id : trip._id , is_provider_accepted : 0} , trip_changes , {new : true})
            if (!updateTrip) {
                resolve({
                    success: false,
                    error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_ACCEPTED
                });
                return;
            }
            utils.update_request_status_socket(updateTrip._id);

            resolve({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_REJECTED_TRIP,
                is_provider_accepted: updateTrip.is_provider_accepted
            });

            if ((setting_detail.find_nearest_driver_type == Number(constant_json.NEAREST_PROVIDER_TYPE_SINGLE) && !trip.is_trip_bidding) || updateTrip.current_providers.length == 0) {
                await exports.nearest_provider(updateTrip, null, []);
            }

        } catch (e) {
            console.log(e)
            resolve({ success: false, error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG });
        }
    })
};

exports.trip_cancel_by_user = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' }
        ];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        const trip = await Trip.findById(req.body.trip_id)         
        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP });
        }
        
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        let corporate;
        if(trip.user_type == constant_json.USER_TYPE_CORPORATE){
            corporate = await Corporate.findById(trip.user_type_id)
            if (!corporate) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                return;
            }
        }

        if (req.body.type != constant_json.TRIP_TYPE_DISPATCHER && req.body.type != constant_json.TRIP_TYPE_CORPORATE && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let cancel_reason = req.body.cancel_reason;
        if(trip.is_provider_status >= PROVIDER_STATUS.TRIP_STARTED){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_CANCEL_TRIP_FAILED });
        }

        if (!(trip.is_trip_completed == 0 && trip.is_trip_end == 0)) {
            utils.update_request_status_socket(trip._id);
            if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                utils.get_service_id_socket(trip.user_type_id)
            }
            res.json({
                success: true,
                payment_status: trip.payment_status,
                message: success_messages.ERROR_CODE_TRIP_ALREADY_COMPLETED
            });
            return;
        }

        if (!(trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_user == 0 && trip.is_trip_cancelled_by_provider == 0)) {
            if (user.current_trip_id) {
                user.current_trip_id = null;
                user.cancelled_request = user.cancelled_request + 1;
                await User.updateOne({ _id: user._id }, user.getChanges())
            }
            utils.update_request_status_socket(trip._id);
            if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                utils.get_service_id_socket(trip.user_type_id)
            }
            res.json({
                success: true,
                payment_status: trip.payment_status,
                message: success_messages.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
            });
            return;
        }

        let providerID = trip.confirmed_provider;
        let status = trip.is_provider_status;
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;
        trip.payment_status = PAYMENT_STATUS.COMPLETED;
        trip.provider_trip_end_time = new Date();

        let provider_list = await Provider
            .find({ _id: trip.current_providers })
            .select({
                is_near_trip: 1,
                is_near_available: 1,
                is_trip: 1,
                is_available: 1,
                bids: 1,
                is_ride_share: 1,
                destinationLocation: 1
            })
        for (let providers of provider_list) {
            let provider = utils.remove_is_trip_from_provider(providers, trip._id, trip.initialDestinationLocation)
            if (!provider.is_near_trip) { provider.is_near_trip = [] }
            if (provider.is_near_trip.length != 0) {
                provider.is_near_available = 1;
                provider.is_near_trip = [];
            }

            if(provider.bids && provider.bids.length > 0) {
                provider.bids = provider.bids.filter(function(bid) { return (bid.trip_id).toString() !== (trip._id).toString(); });
                provider.markModified('bids');
            }
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        }

        // FOR REMOVE DISPATCHER SCHEDUAL ASSIGN DRIVERS
        let schedual_provider_list = await Provider
            .find({ schedule_trip: {$in: trip._id} })
            .select({
                schedule_trip: 1
            })
        for (let provider of schedual_provider_list) {

            if(provider.schedule_trip && provider.schedule_trip.length > 0) {
                provider.schedule_trip = provider.schedule_trip.filter(function(schedule_trip) {
                    return (schedule_trip).toString() !== (trip._id).toString();
                });
            }

            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        }
        
        let trip_user_type
        switch (req.body.type) {
            case constant_json.TRIP_TYPE_CORPORATE:
                trip_user_type = TYPE_VALUE.CORPORATE
                break;

            case constant_json.TRIP_TYPE_DISPATCHER:
                trip_user_type = TYPE_VALUE.DISPATCHER
                break;

            case constant_json.TRIP_TYPE_HOTEL:
                trip_user_type = TYPE_VALUE.HOTEL
                break;

            default:
                trip_user_type = TYPE_VALUE.USER
                break;
        }
        if (trip_user_type != TYPE_VALUE.USER) {
           await utils.remove_trip_promo_code(trip)
        }

        if (status == 0) {
            trip.cancel_reason = cancel_reason;
            trip.is_trip_cancelled = 1;
            trip.is_trip_cancelled_by_user = 1;

            await Trip.updateOne({ _id: trip._id }, trip.getChanges())

            user.current_trip_id = null;
            user.cancelled_request = user.cancelled_request + 1;

            await User.updateOne({ _id: user._id }, user.getChanges())

            utils.update_request_status_socket(trip._id);
            if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                utils.get_service_id_socket(trip.user_type_id)
            }

            await utils.move_trip_to_completed(req.body.trip_id)

            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY
            });
            return;
        }

        trip.cancel_reason = cancel_reason;
        trip.is_trip_cancelled = 1;
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, trip_user_type )

        if (trip.is_provider_accepted == constant_json.YES) {
            trip.is_trip_cancelled_by_user = 1;
        }

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        let provider = await Provider.findOne({ _id: providerID })
        if (provider) {
            provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
            utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_USER, "", null, provider.lang_code);
        }

        if (status != 4) {
            trip.provider_service_fees = 0;

            await Trip.updateOne({ _id: trip._id }, trip.getChanges())

            user.cancelled_request = user.cancelled_request + 1;
            user.current_trip_id = null;
            await User.updateOne({ _id: user._id }, user.getChanges())

            utils.update_request_status_socket(trip._id);
            if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                utils.get_service_id_socket(trip.user_type_id)
            }

            await utils.move_trip_to_completed(req.body.trip_id)

            res.json({
                success: true,
                payment_status: trip.payment_status,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY
            });
            return;
        }

        let tripservice_data = await Trip_Service.findOne({ _id: trip.trip_service_city_type_id })
        let cancellationCharges = tripservice_data.cancellation_fee;
        if (trip.car_rental_id) {
            let rental_main_citytype = await Citytype.findOne({ car_rental_ids: trip.car_rental_id });
            if (rental_main_citytype) {
                cancellationCharges = rental_main_citytype.cancellation_fee
            }
        }
        let provider_profit = tripservice_data.provider_profit;
        trip.is_cancellation_fee = 1;
        let current_rate = 1;

        if (cancellationCharges <= 0) {
            trip.provider_service_fees = 0;

            await Trip.updateOne({ _id: trip._id }, trip.getChanges())

            user.cancelled_request = user.cancelled_request + 1;
            user.current_trip_id = null;

            await User.updateOne({ _id: user._id }, user.getChanges())

            utils.update_request_status_socket(trip._id);
            if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                utils.get_service_id_socket(trip.user_type_id)
            }

            await utils.move_trip_to_completed(req.body.trip_id)

            res.json({
                success: true,
                payment_status: trip.payment_status,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY
            });
            return;
        }

        let admin_currencycode = setting_detail.adminCurrencyCode;
        let admin_currency = setting_detail.adminCurrency;
        let countryCurrencyCode = trip.currencycode;
        let city = await City.findOne({ _id: trip.city_id })
        let is_provider_earning_set_in_wallet_on_cash_payment = false;
        let is_provider_earning_set_in_wallet_on_other_payment = false;
        if (city) {
            is_provider_earning_set_in_wallet_on_cash_payment = city.is_provider_earning_set_in_wallet_on_cash_payment;
            is_provider_earning_set_in_wallet_on_other_payment = city.is_provider_earning_set_in_wallet_on_other_payment;
        }

        let currency_response = await utils.getCurrencyConvertRateAsync(1, countryCurrencyCode, admin_currencycode)
        if (currency_response.success) {
            current_rate = currency_response.current_rate;
        }

        let provider_service_fees = 0;
        let total_in_admin_currency = 0;
        let service_total_in_admin_currency = 0;
        let provider_service_fees_in_admin_currency = 0;

        provider_service_fees = cancellationCharges * provider_profit * 0.01;
        provider_service_fees_in_admin_currency = provider_service_fees * current_rate;

        total_in_admin_currency = cancellationCharges * current_rate;
        service_total_in_admin_currency = cancellationCharges * current_rate;

        trip.total_service_fees = cancellationCharges;
        trip.total = cancellationCharges;
        trip.provider_service_fees = (provider_service_fees).toFixed(2);
        trip.pay_to_provider = trip.provider_service_fees;
        trip.total_in_admin_currency = total_in_admin_currency;
        trip.service_total_in_admin_currency = service_total_in_admin_currency;
        trip.provider_service_fees_in_admin_currency = provider_service_fees_in_admin_currency;
        trip.current_rate = current_rate;
        trip.payment_status = PAYMENT_STATUS.WAITING;

        trip.admin_currency = admin_currency;
        trip.admin_currencycode = admin_currencycode;
        trip.remaining_payment = cancellationCharges;

        if (trip.payment_mode == Number(constant_json.PAYMENT_MODE_CASH) && is_provider_earning_set_in_wallet_on_cash_payment) {
            let provider = await Provider.findOne({ _id: providerID })
            if (provider) {
                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                        provider.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Profit Of This Trip : " + trip.unique_id);
                    provider.wallet = total_wallet_amount;
                    await Provider.updateOne({ _id: provider._id }, provider.getChanges())
                } else {
                    let partner = await Partner.findOne({ _id: provider.provider_type_id })
                    let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Profit Of This Trip : " + trip.unique_id);
                    partner.wallet = total_wallet_amount;
                    await Partner.updateOne({ _id: partner._id }, partner.getChanges())
                }

                trip.is_provider_earning_set_in_wallet = true;
                if(trip.pay_to_provider>=0){
                    trip.is_provider_earning_added_in_wallet = true;
                } else {
                    trip.is_provider_earning_added_in_wallet = false;
                }
                trip.provider_income_set_in_wallet = Math.abs(trip.pay_to_provider);
            }
        }

        let total_after_wallet_payment = trip.total
        let wallet_payment = 0
        let remaining_payment = 0

        // cancellation charge always deduct from wallet
        if (total_after_wallet_payment > 0) {
            wallet_payment = total_after_wallet_payment
            if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE && corporate) {
                let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, corporate.unique_id, corporate._id, null,
                    corporate.wallet_currency_code, trip.currencycode,
                    trip.wallet_current_rate, wallet_payment, corporate.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                corporate.wallet = total_wallet_amount;
                await Corporate.updateOne({ _id: corporate._id }, corporate.getChanges())
                user.corporate_wallet_limit = user.corporate_wallet_limit - wallet_payment;
            } else {
                let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id, null,
                    user.wallet_currency_code, trip.currencycode,
                    1, wallet_payment, user.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                user.wallet = total_wallet_amount;
            }
            total_after_wallet_payment = total_after_wallet_payment - wallet_payment;
        }

        if(is_provider_earning_set_in_wallet_on_other_payment){
            let provider = await Provider.findOne({ _id: providerID })
            if (provider) {
                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                        provider.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Profit Of This Trip : " + trip.unique_id);
                    provider.wallet = total_wallet_amount;
                    await Provider.updateOne({ _id: provider._id }, provider.getChanges())
                } else {
                    let partner = await Partner.findOne({ _id: provider.provider_type_id })
                    let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Profit Of This Trip : " + trip.unique_id);
                    partner.wallet = total_wallet_amount;
                    await Partner.updateOne({ _id: partner._id }, partner.getChanges())
                }

                trip.is_provider_earning_set_in_wallet = true;
                if(trip.pay_to_provider >= 0){
                    trip.is_provider_earning_added_in_wallet = true;
                } else {
                    trip.is_provider_earning_added_in_wallet = false;
                }
                trip.provider_income_set_in_wallet = Math.abs(trip.pay_to_provider);
            }
        }

        trip.payment_mode = constant_json.PAYMENT_MODE_CARD;
        total_after_wallet_payment = Number((total_after_wallet_payment).toFixed(2));
        wallet_payment = Number((wallet_payment).toFixed(2));
        remaining_payment = trip.total - wallet_payment;
        remaining_payment = Number((remaining_payment).toFixed(2));
        trip.wallet_payment = wallet_payment;
        trip.total_after_wallet_payment = total_after_wallet_payment;
        trip.remaining_payment = remaining_payment;
        trip.payment_status = PAYMENT_STATUS.COMPLETED;
        trip.is_paid = 1;
        trip.is_pending_payments = 0;
        trip.card_payment = 0;

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        user.cancelled_request = user.cancelled_request + 1;
        user.current_trip_id = null;
        await User.updateOne({ _id: user._id }, user.getChanges());

        utils.update_request_status_socket(trip._id)
        if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
            utils.get_service_id_socket(trip.user_type_id)
        }

        await utils.move_trip_to_completed(req.body.trip_id)

        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
            payment_status: trip.payment_status,
        });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_cancel_by_guest = async function (req, res) {
    try {
        const params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' }
        ];
        const response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success) {
            return res.json(response);
        }

        const { user_id, trip_id } = req.body;

        const user = await User.findById(user_id)
        if (!user) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }

        const trip = await Trip.findById(trip_id)
        let isValidTrip
        if(trip) {
            isValidTrip = trip._id.toString() === user.current_trip_id.toString()
        }
        
        if (!trip || !isValidTrip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
        }
        if (trip.is_provider_status >= PROVIDER_STATUS.TRIP_STARTED) {
            utils.update_request_status_socket(trip._id);
            return res.json({ success: false, error_code: error_message.ERROR_CODE_CANCEL_TRIP_FAILED });
        } else if (trip.is_trip_cancelled == 1) {
            utils.update_request_status_socket(trip._id);
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED });
        } else if (trip.is_trip_completed == 1 || trip.is_trip_end == 1) {
            utils.update_request_status_socket(trip._id);
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_COMPLETED });
        }

        let providerID = trip.confirmed_provider;

        const complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        const complete_date_tag = moment(complete_date_in_city_timezone).startOf('day').format(constant_json.DATE_FORMAT_MMM_D_YYYY);

        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;
        trip.payment_status = PAYMENT_STATUS.COMPLETED;
        trip.provider_trip_end_time = new Date();

        const provider_list = await Provider
            .find({ _id: trip.current_providers })
            .select({
                is_near_trip: 1,
                is_near_available: 1,
                is_trip: 1,
                is_available: 1,
                bids: 1,
                is_ride_share: 1,
                destinationLocation: 1
            })

        for (let providers of provider_list) {
            let provider = utils.remove_is_trip_from_provider(providers, trip._id, trip.initialDestinationLocation)
            provider.is_near_trip = [];
            provider.is_near_available = 1;

            if (provider.bids && provider.bids.length > 0) {
                provider.bids = provider.bids.filter((bid) => bid.trip_id.toString() !== trip._id.toString());
                provider.markModified('bids');
            }
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        }

        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, TYPE_VALUE.USER )
        trip.is_trip_cancelled = 1
        trip.is_trip_cancelled_by_user = 1
        trip.cancel_reason = req.body.cancel_reason ? req.body.cancel_reason.trim() : ""
        
        if (trip.is_provider_status < PROVIDER_STATUS.ARRIVED) {
            if (user.current_trip_id) {
                user.current_trip_id = null
                user.cancelled_request++
            }
            
            await trip.save()
            await user.save()

            utils.update_request_status_socket(trip._id);
            await utils.move_trip_to_completed(req.body.trip_id)
            
            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY
            });
        }
        
        let trip_provider = await Provider.findById(providerID)
        if (trip_provider) {
            trip_provider = utils.remove_is_trip_from_provider(trip_provider, trip._id, trip.initialDestinationLocation)
            await Provider.updateOne({ _id: trip_provider._id }, trip_provider.getChanges())
            utils.sendPushNotification(trip_provider.device_type, trip_provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_USER, "", null, trip_provider.lang_code);
        }
        
        let trip_service = await Trip_Service.findOne({ _id: trip.trip_service_city_type_id })
        let cancellationCharges = trip_service.cancellation_fee;
        
        let provider_profit = trip_service.provider_profit;
        trip.is_cancellation_fee = 1;
        let current_rate = 1;
        
        if (cancellationCharges <= 0) {
            trip.provider_service_fees = 0;
            await trip.save()
            
            if (user.current_trip_id) {
                user.current_trip_id = null
                user.cancelled_request++
            }
            await user.save()

            utils.update_request_status_socket(trip._id);
            await utils.move_trip_to_completed(req.body.trip_id)
            
            return res.json({
                success: true,
                payment_status: trip.payment_status,
                message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY
            });
        }

        let admin_currencycode = setting_detail.adminCurrencyCode;
        let admin_currency = setting_detail.adminCurrency;
        let city = await City.findOne({ _id: trip.city_id })
        let is_provider_earning_set_in_wallet_on_cash_payment = false;
        if (city) {
            is_provider_earning_set_in_wallet_on_cash_payment = city.is_provider_earning_set_in_wallet_on_cash_payment;
        }
        
        let currency_response = await utils.getCurrencyConvertRateAsync(1, trip.currencycode, admin_currencycode)
        if (currency_response.success) {
            current_rate = currency_response.current_rate;
        }
        
        let provider_service_fees = cancellationCharges * provider_profit * 0.01;
        let provider_service_fees_in_admin_currency = provider_service_fees * current_rate;
        
        let total_in_admin_currency = cancellationCharges * current_rate;
        let service_total_in_admin_currency = cancellationCharges * current_rate;
        
        trip.total_service_fees = cancellationCharges;
        trip.total = cancellationCharges;
        trip.provider_service_fees = (provider_service_fees).toFixed(2);
        trip.pay_to_provider = trip.provider_service_fees
        trip.total_in_admin_currency = total_in_admin_currency;
        trip.service_total_in_admin_currency = service_total_in_admin_currency;
        trip.provider_service_fees_in_admin_currency = provider_service_fees_in_admin_currency;
        trip.current_rate = current_rate;
        trip.payment_status = PAYMENT_STATUS.WAITING;
        
        trip.admin_currency = admin_currency;
        trip.admin_currencycode = admin_currencycode;
        
        if (trip.payment_mode == Number(constant_json.PAYMENT_MODE_CASH) && is_provider_earning_set_in_wallet_on_cash_payment) {
            if (trip_provider) {
                if (trip_provider.provider_type != PROVIDER_TYPE.PARTNER) {
                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, trip_provider.unique_id, trip_provider._id, trip_provider.country_id,
                        trip_provider.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, trip_provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Profit Of This Trip : " + trip.unique_id);
                        trip_provider.wallet = total_wallet_amount;
                    await Provider.updateOne({ _id: trip_provider._id }, trip_provider.getChanges())
                } else {
                    let partner = await Partner.findOne({ _id: trip_provider.provider_type_id })
                    let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Profit Of This Trip : " + trip.unique_id);
                        partner.wallet = total_wallet_amount;
                    await Partner.updateOne({ _id: partner._id }, partner.getChanges())
                }

                trip.is_provider_earning_set_in_wallet = true;
                if (trip.pay_to_provider >= 0) {
                    trip.is_provider_earning_added_in_wallet = true;
                } else {
                    trip.is_provider_earning_added_in_wallet = false;
                }
                trip.provider_income_set_in_wallet = Math.abs(trip.pay_to_provider);
            }
        }

        let wallet_payment = 0

        if (cancellationCharges > 0) {
            wallet_payment = cancellationCharges
            user.wallet = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id, null, user.wallet_currency_code, trip.currencycode, 1, wallet_payment, user.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);            
        }
        
        const total_after_wallet_payment = Number((cancellationCharges - wallet_payment).toFixed(2)); 
        trip.wallet_payment = Number((wallet_payment).toFixed(2));
        trip.total_after_wallet_payment = total_after_wallet_payment;
        trip.remaining_payment = total_after_wallet_payment;
        trip.payment_status = PAYMENT_STATUS.COMPLETED;
        trip.is_paid = 1;
        trip.is_pending_payments = 0;

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        user.cancelled_request++;
        user.current_trip_id = null;
        await User.updateOne({ _id: user._id }, user.getChanges());

        utils.update_request_status_socket(trip._id)
        await utils.move_trip_to_completed(req.body.trip_id)

        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_YOUR_TRIP_CANCELLED_SUCCESSFULLY,
            payment_status: trip.payment_status,
        });
        return;
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.trip_cancel_by_provider = async function (req, res) {
    try {
        let params_array = [
            { name: 'provider_id', type: 'string' },
            { name: 'trip_id', type: 'string' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let trip = await Trip.findOne({
            _id: req.body.trip_id,
            is_trip_cancelled: 0,
            is_trip_cancelled_by_provider: 0,
            is_trip_cancelled_by_user: 0
        })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED });
            return;
        }

        let city_timezone = trip.timezone;
        let cancel_reason = req.body.cancel_reason;
        let user = await User.findOne({ _id: trip.user_id })

        trip.cancel_reason = cancel_reason;
        trip.is_trip_cancelled = 1;
        trip.is_trip_cancelled_by_provider = 1;
        trip.provider_trip_end_time = new Date();

        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;
        trip.provider_service_fees = 0;

        // Set trip status
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, TYPE_VALUE.PROVIDER )

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        provider.cancelled_request = provider.cancelled_request + 1;
        provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation);

        await Provider.updateOne({ _id: provider._id }, provider.getChanges())

        myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, TRIP_STATUS.PROVIDER_CANCELLED);
        
        await utils.remove_trip_promo_code(trip)
        
        user.current_trip_id = null;
        
        await User.updateOne({ _id: user._id }, user.getChanges())
        utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_PROVIDER, constant_json.PUSH_NOTIFICATION_SOUND_FILE_IN_IOS, "", user.webpush_config, user.lang_code);

        utils.update_request_status_socket(trip._id,null,11);
        if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
            utils.get_service_id_socket(trip.user_type_id)
        }
        await utils.move_trip_to_completed(req.body.trip_id)

        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_CANCELLED_SUCCESSFULLY,
            is_trip_cancelled_by_provider: trip.is_trip_cancelled_by_provider
        });
        return;

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.trip_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let trip = await Trip.findOne({
            _id: req.body.trip_id,
            is_trip_cancelled: 0,
            is_trip_cancelled_by_provider: 0,
            is_trip_cancelled_by_user: 0
        })
        if (!trip) {
            res.json({ success: false });
            return;
        }

        let provider = await Provider.findOne({ _id: trip.confirmed_provider })
        let user = await User.findOne({ _id: trip.user_id })
        if (provider) {
            provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
            if (!provider.is_near_trip) { provider.is_near_trip = [] }
            if ((String(provider.is_near_trip[0]) == String(trip._id))) {
                provider.is_near_available = 1;
                provider.is_near_trip = [];
            }
            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
            utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", null, provider.lang_code);
        }

        let provider_list = await Provider
            .find({ _id: trip.current_providers })
            .select({
                is_near_trip: 1,
                is_trip: 1,
                is_available: 1,
                is_ride_share: 1,
                destinationLocation: 1,
                bids:1
            })
        for (let provider of provider_list) {
            let is_trip_condition = { _id: provider._id };
            let is_trip_update = {};
            let provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
            if (!provider.is_near_trip) { provider.is_near_trip = [] }
            if (provider.is_near_trip.length != 0) {
                is_trip_update = { is_near_available: 1, is_near_trip: [] };
            }
            provider.bids = provider.bids.filter((details) => details.trip_id.toString() != trip._id);
            await Provider.updateOne(is_trip_condition, { is_trip_update, bids:provider.bids });
        }

        // FOR REMOVE DISPATCHER SCHEDUAL ASSIGN DRIVERS
        let schedual_provider_list = await Provider
            .find({ schedule_trip: {$in: trip._id} })
            .select({
                schedule_trip: 1
            })
        for (let provider of schedual_provider_list) {

            if(provider.schedule_trip && provider.schedule_trip.length > 0) {
                provider.schedule_trip = provider.schedule_trip.filter(function(schedule_trip) {
                    return (schedule_trip).toString() !== (trip._id).toString();
                });
            }

            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        }

        trip.cancel_reason = '';
        trip.is_trip_cancelled = 1;
        trip.payment_status = 1
        trip.provider_trip_end_time = new Date();
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;

        // Set trip status
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, TYPE_VALUE.ADMIN, req.headers.username, req.headers.admin_id )

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        await utils.remove_trip_promo_code(trip)
        
        if (String(trip._id) == String(user.current_trip_id)) {
            user.current_trip_id = null;
            await User.updateOne({ _id: user._id }, user.getChanges())
        }
        utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_ADMIN, "", user.webpush_config, user.lang_code);

        let message = admin_messages.success_message_trip_cancelled;
        utils.update_request_status_socket(trip._id);

        await utils.move_trip_to_completed(req.body.trip_id)

        res.json({ success: true, message: message });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.scheduled_trip_cancel_by_admin = async function (req, res) {
    try {
        let params_array = [{ name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let trip = await Trip.findOne({
            _id: req.body.trip_id,
            is_trip_cancelled: 0,
            is_trip_cancelled_by_provider: 0,
            is_trip_cancelled_by_user: 0
        })
        if (!trip) {
            res.json({ success: false });
            return;
        }

        let user = await User.findOne({ _id: trip.user_id })
        trip.cancel_reason = '';
        trip.is_trip_cancelled = 1;
        trip.is_trip_cancelled_by_admin = 1;
        trip.payment_status = 1
        trip.provider_trip_end_time = new Date();
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;

        // Set trip status
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, TYPE_VALUE.ADMIN, req.headers.username, req.headers.admin_id )

        // FOR REMOVE DISPATCHER SCHEDUAL ASSIGN DRIVERS
        let schedual_provider_list = await Provider
            .find({ schedule_trip: {$in: trip._id} })
            .select({
                schedule_trip: 1
            })
        for (let provider of schedual_provider_list) {

            if(provider.schedule_trip && provider.schedule_trip.length > 0) {
                provider.schedule_trip = provider.schedule_trip.filter(function(schedule_trip) {
                    return (schedule_trip).toString() !== (trip._id).toString();
                });
            }

            await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        }

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        await utils.remove_trip_promo_code(trip)

        if(user.current_trip_id && String(trip._id) == String(user.current_trip_id)){
            user.current_trip_id = null;
        }

        user.cancelled_request = user.cancelled_request + 1;
        await User.updateOne({ _id: user._id }, user.getChanges())

        let message = admin_messages.success_message_trip_cancelled;
        utils.update_request_status_socket(trip._id);

        await utils.move_trip_to_completed(req.body.trip_id)

        res.json({ success: true,message:message });
        return;
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.provider_set_trip_status = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

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

        let trip = await Trip.findOne({ _id: req.body.trip_id, confirmed_provider: req.body.provider_id });
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            return;
        }

        if (!(trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_provider == 0)) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_MISMATCH_PROVIDER_ID_OR_TRIP_ID });
            return;
        }

        let is_provider_status = Number(req.body.is_provider_status);
        
        let now = new Date();
        if (is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
            if (trip.actual_destination_addresses.length == 0) {
                trip.provider_trip_start_time = now;
            }

            if (trip.is_otp_verification && trip.actual_destination_addresses.length == 0 && req.body.user_type != TYPE_VALUE.ADMIN) {
                let confirmation_code = req.body.trip_start_otp;
                if (trip.confirmation_code != confirmation_code) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TRIP_START_OTP });
                    return;
                }
            }

            if (trip.destination_addresses.length != 0) {
                let provider_arrived_time = trip.provider_arrived_time
                if (trip.actual_destination_addresses.length != 0) {
                    provider_arrived_time = trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].arrived_time;
                }
                let waiting_time = utils.getTimeDifferenceInMinute(now, provider_arrived_time);
                if (waiting_time < 0) {
                    waiting_time = 0;
                }
                trip.actual_destination_addresses.push({
                    address: '',
                    location: [],
                    arrived_time: null,
                    start_time: new Date(),
                    total_time: 0,
                    waiting_time: Number(waiting_time)
                });
                trip.markModified('actual_destination_addresses');
            }
        }

        if (is_provider_status == PROVIDER_STATUS.ARRIVED) {
          trip.provider_arrived_time = now
        }
        
        let timeline_status
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

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

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

        let user = await User.findOne({ _id: trip.user_id })
        let device_token = user.device_token;
        let device_type = user.device_type;

        if (is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
            if (setting_detail.sms_notification) {
            let emergencyContactDetails = await EmergencyContactDetail.find({ user_id: trip.user_id, is_always_share_ride_detail: 1 })
            emergencyContactDetails.forEach((emergencyContactDetail) => {
                let phoneWithCode = emergencyContactDetail.phone;
                    utils.sendSmsForOTPVerificationAndForgotPassword(phoneWithCode, SMS_TEMPLATE.START_RIDE, [user.first_name + " " + user.last_name, provider.first_name + " " + provider.last_name, trip.source_address, trip.destination_address]);
                });
                utils.sendSmsForOTPVerificationAndForgotPassword(user.country_phone_code + user.phone, SMS_TEMPLATE.START_RIDE, [user.first_name + " " + user.last_name, provider.first_name + " " + provider.last_name, trip.source_address, trip.destination_address]);
            }
        }

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
            utils.sendPushNotification(device_type, device_token, message_code, constant_json.PUSH_NOTIFICATION_SOUND_FILE_IN_IOS, "", user.webpush_config, user.lang_code);
        }
        console.log('update_request_status_socket')
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


exports.check_destination = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            let geo = false;
            let geo2 = false
            let zone1, zone2, k = 0;
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        let Table
                        if (req.body.is_open_ride) {
                            Table = OpenRide
                        } else {
                            Table = Trip
                        }
                        Table.findOne({ _id: req.body.trip_id }).then((trip) => {
                            if (trip) {
                                Citytype.findOne({ _id: trip.service_type_id }).then((citytype) => {
                                    if (citytype) {
                                        City.findOne({ _id: citytype.cityid, zone_business: true }).then((city) => {
                                            if (trip.destination_addresses && trip.destination_addresses.length > 0) {
                                                res.json({ success: true })
                                            } else if (city) {
                                                CityZone.find({ cityid: citytype.cityid }).then((cityzone) => {
                                                    if (citytype.is_zone == 1 && cityzone !== null && cityzone.length > 0) {

                                                        let zone_count = cityzone.length;
                                                        cityzone.forEach(function (cityzoneDetail) {

                                                            geo = geolib.isPointInside(
                                                                {
                                                                    latitude: trip.sourceLocation[0],
                                                                    longitude: trip.sourceLocation[1]
                                                                },
                                                                cityzoneDetail.kmlzone
                                                            );
                                                            geo2 = geolib.isPointInside(
                                                                {
                                                                    latitude: req.body.latitude,
                                                                    longitude: req.body.longitude
                                                                },
                                                                cityzoneDetail.kmlzone
                                                            );

                                                            if (geo) {
                                                                zone1 = cityzoneDetail.id;
                                                            }
                                                            if (geo2) {
                                                                zone2 = cityzoneDetail.id;
                                                            }
                                                            k++;

                                                            if (k == zone_count) {

                                                                ZoneValue.findOne({
                                                                    service_type_id: trip.service_type_id,
                                                                    $or: [{ from: zone1, to: zone2 }, {
                                                                        from: zone2,
                                                                        to: zone1
                                                                    }]
                                                                }).then((zonevalue) => {
                                                                    if (zonevalue) {

                                                                        trip.trip_type = constant_json.TRIP_TYPE_ZONE;
                                                                        trip.trip_type_amount = (zonevalue.amount).toFixed(2);
                                                                        trip.save(function () {
                                                                            res.json({ success: true, zone: '' });
                                                                        });
                                                                    } else {
                                                                        airport(citytype.cityid, citytype, trip, req.body, res);
                                                                    }
                                                                })
                                                            }
                                                        });
                                                    } else {
                                                        airport(citytype.cityid, citytype, trip, req.body, res);
                                                    }
                                                });
                                            } else {
                                                airport(citytype.cityid, citytype, trip, req.body, res);
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
                                            error_code: error_message.ERROR_CODE_NO_CITY_LIST_FOUND
                                        });
                                    }
                                }, (err) => {
                                    console.log(err);
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
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
}

function airport(cityid, citytype, trip, body, res) {
    let airport;
    Airport.find({ city_id: cityid }).then((airport_data) => {

        if (airport_data != null && airport_data.length > 0) {
            let k = 0;
            City.findOne({ '_id': cityid, airport_business: true }).then((city) => {
                if (city) {
                    airport_data.forEach(function (airportDetail) {

                        if (airport == undefined) {

                            let pickup_airport = geolib.isPointInside(
                                {
                                    latitude: trip.sourceLocation[0],
                                    longitude: trip.sourceLocation[1]
                                },
                                airportDetail.kmlzone
                            );

                            let dest_airport = geolib.isPointInside(
                                {
                                    latitude: body.latitude,
                                    longitude: body.longitude
                                },
                                airportDetail.kmlzone
                            );

                            if (pickup_airport) {
                                let city_distance = utils.getDistanceFromTwoLocation([body.latitude, body.longitude], city.cityLatLong);
                                if (city_distance < city.cityRadius) {

                                    AirportCity.findOne({
                                        airport_id: airportDetail._id,
                                        service_type_id: citytype._id
                                    }).then((airportcity) => {

                                        if (airportcity !== null && airportcity.price > 0) {
                                            airport = airportDetail._id;
                                            trip.trip_type = constant_json.TRIP_TYPE_AIRPORT;
                                            trip.trip_type_amount = (airportcity.price).toFixed(2);
                                            trip.save().then(() => {
                                                res.json({ success: true, airport: '' });
                                            });
                                        } else if (airport_data.length - 1 == k) {
                                            cityCheck(cityid, citytype, trip, body, res)
                                        } else {
                                            k++;
                                        }
                                    })
                                } else if (airport_data.length - 1 == k) {
                                    cityCheck(cityid, citytype, trip, body, res)
                                } else {
                                    k++;
                                }
                            } else if (dest_airport) {
                                let city_distance = utils.getDistanceFromTwoLocation(trip.sourceLocation, city.cityLatLong);
                                if (city_distance < city.cityRadius) {


                                    AirportCity.findOne({
                                        airport_id: airportDetail._id,
                                        service_type_id: citytype._id
                                    }).then((airportcity) => {

                                        if (airportcity !== null && airportcity.price > 0) {
                                            airport = airportDetail._id;
                                            trip.trip_type = constant_json.TRIP_TYPE_AIRPORT;
                                            trip.trip_type_amount = (airportcity.price).toFixed(2);
                                            trip.save().then(() => {
                                                res.json({ success: true, airport: '' });
                                            });
                                        } else if (airport_data.length - 1 == k) {
                                            cityCheck(cityid, citytype, trip, body, res)
                                        } else {
                                            k++;
                                        }
                                    })
                                } else if (airport_data.length - 1 == k) {
                                    cityCheck(cityid, citytype, trip, body, res)
                                } else {
                                    k++;
                                }
                            } else if (airport_data.length - 1 == k && airport == undefined) {
                                cityCheck(cityid, citytype, trip, body, res)
                            } else {
                                k++;
                            }
                        }
                    });
                } else {
                    cityCheck(cityid, citytype, trip, body, res)
                }
            }, () => {
                cityCheck(cityid, citytype, trip, body, res)
            })
        } else {
            cityCheck(cityid, citytype, trip, body, res)
        }
    }, () => {
        cityCheck(cityid, citytype, trip, body, res)
    });

}

function cityCheck(cityid, citytype, trip, body, res) {

    let flag = 0;
    let k = 0;
    City.findOne({ '_id': cityid, city_business: true }).then((city) => {
        if (city) {
            CitytoCity.find({ city_id: cityid, service_type_id: citytype._id, destination_city_id: { $in: city.destination_city } }).then((citytocity) => {


                if (citytocity !== null && citytocity.length > 0) {

                    citytocity.forEach(function (citytocity_detail) {

                        City.findById(citytocity_detail.destination_city_id).then((city_detail) => {
                            if (flag == 0) {
                                let city_radius = city_detail.cityRadius;
                                let destination_city_radius = utils.getDistanceFromTwoLocation([body.latitude, body.longitude], city_detail.cityLatLong);

                                let inside_city;
                                if (city_detail.city_locations && city_detail.city_locations.length > 2) {
                                    inside_city = geolib.isPointInside(
                                        {
                                            latitude: body.latitude,
                                            longitude: body.longitude
                                        },
                                        city_detail.city_locations
                                    );
                                }

                                if (citytocity_detail.price > 0 && ((!city_detail.is_use_city_boundary && city_radius > destination_city_radius) || (city_detail.is_use_city_boundary && inside_city))) {

                                    trip.trip_type = constant_json.TRIP_TYPE_CITY;
                                    trip.trip_type_amount = (citytocity_detail.price).toFixed(2);
                                    flag = 1;
                                    trip.save().then(() => {
                                        res.json({ success: true, city: '' })
                                    });
                                } else if (citytocity.length - 1 == k) {
                                    res.json({ success: true })
                                } else {
                                    k++;
                                }
                            }
                        });
                    });
                } else {
                    return res.json({ success: true })
                }
            });
        } else {
            return res.json({ success: true })
        }
    }, (err) => {
        console.log(err);
        res.json({
            success: false,
            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
        });
    });
}

exports.provider_complete_trip = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }, { name: 'provider_id', type: 'string' }], async function (response) {
        if (response.success) {

            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if(!provider){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }

            if (req.body.token != null && provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            } 
            
            var selected_vehicle = await Vehicle.findOne({provider_id: provider._id, is_selected: true});
            var country_data = await Country.findOne({_id: provider.country_id});

            let trip = await Trip.findOne({
                _id: req.body.trip_id,
                confirmed_provider: req.body.provider_id,
                is_trip_completed: 0,
                is_trip_end: 0
            })
            if(!trip){
                res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            }
            if (trip.is_trip_cancelled != 0 || trip.is_trip_cancelled_by_user != 0 || trip.is_trip_cancelled_by_provider != 0) {
                utils.update_request_status_socket(trip._id);
                return res.json({
                    success: true,
                    message: success_messages.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
                });
            }
            let city_timezone = trip.timezone;
            let user = await User.findOne({ _id: trip.user_id })

            if(req.body.complete_by_admin){
                let distance = req.body.total_distance;
                let  distanceKmMile;
                if (trip.unit == 1) {
                    distanceKmMile = distance * 0.001;
                } else {
                    distanceKmMile = distance * 0.000621371;
                }
                trip.total_distance = distanceKmMile
            }

            let total_distance = Number((trip.total_distance).toFixed(2));
            let total_time = Number((trip.total_time).toFixed(2));
            let total_waiting_time = 0;
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

            let promo_value = 0;

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

            total_waiting_time = utils.getTimeDifferenceInMinute(trip.provider_trip_start_time, trip.provider_arrived_time);
            if (total_waiting_time < 0) {
                total_waiting_time = 0;
            }

            let tripLocation = await TripLocation.findOne({ tripID: req.body.trip_id })
            tripLocation.endTripTime = now;

            let total_distance_diff = 0;
            let start_end_Location = tripLocation.startTripToEndTripLocations;
            if (req.body.location && req.body.location.length > 0) {
                let prev_location = [Number(start_end_Location[0][0]), Number(start_end_Location[0][1])]
                let time = provider.location_updated_time;
                for (const locationData of req.body.location) {
                    let location = [Number(locationData[0]), Number(locationData[1])];
                    start_end_Location.push(location);
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, location, false, provider.location_updated_time);
                    }
                    let distance_diff = Math.abs(utils.getDistanceFromTwoLocation(prev_location, location));
                    let time_diff = Math.abs(utils.getTimeDifferenceInSecond(new Date(time), new Date(Number(locationData[2]))));
                    let max_distance = 0.05;
                    if ((distance_diff < max_distance * time_diff && distance_diff > 0.005) || (distance_diff < max_distance && time_diff == 0)) {
                        total_distance_diff = total_distance_diff + distance_diff;
                        time = Number(locationData[2]);
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
            await tripLocation.save();

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

                utils.bendAndSnap(getSmoothPathresponse, locations.length, async function (response) {

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

                    let provider = await Provider.findOne({ _id: req.body.provider_id })
                    provider.providerLocation = [Number(req.body.latitude), Number(req.body.longitude)];
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal && selected_vehicle){
                        wsal_services.UpdateCurrentLocation(provider.national_id, selected_vehicle.sequence_number, [Number(req.body.latitude), Number(req.body.longitude)], false, provider.location_updated_time);
                    }
                    provider.bearing = req.body.bearing;
                    provider.save();

                    let tripservice = await Trip_Service.findOne({ _id: trip.trip_service_city_type_id })

                    let surge_multiplier = 0;
                    let base_price = 0;
                    let base_price_distance = 0;
                    let tax = 0;
                    let user_miscellaneous_fee = 0;
                    let provider_miscellaneous_fee = 0;
                    let user_tax = 0;
                    let provider_tax = 0;
                    let min_fare = 0;
                    let provider_profit = 0;
                    let price_per_unit_distance = 0;
                    let price_for_total_time = 0;
                    let price_for_waiting_time = 0;
                    let waiting_time_start_after_minute = 0;
                    let price_for_waiting_time_multiple_stops = 0;
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

                    tax = tripservice.tax;
                    user_miscellaneous_fee = tripservice.user_miscellaneous_fee;
                    user_tax = tripservice.user_tax;

                    if (trip.is_fixed_fare && trip.fixed_price > 0) {

                        total_after_surge_fees = trip.fixed_price;
                        trip.total_service_fees = total_after_surge_fees;

                        total_after_surge_fees = utils.get_reverse_service_fee(total_after_surge_fees, tax);
                        trip.fixed_price = total_after_surge_fees;
                        tax_fee = Number((tax * 0.01 * total_after_surge_fees).toFixed(2));
                        trip.tax_fee = tax_fee;
                        total_after_tax_fees = +total_after_surge_fees + +tax_fee;
                        user_tax_fee = Number((user_tax * 0.01 * total_after_surge_fees).toFixed(2));
                        trip.user_tax_fee = user_tax_fee;
                        trip.user_miscellaneous_fee = user_miscellaneous_fee;
                    } else if (trip.trip_type == constant_json.TRIP_TYPE_AIRPORT || trip.trip_type == constant_json.TRIP_TYPE_ZONE || trip.trip_type == constant_json.TRIP_TYPE_CITY) {

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

                        price_per_unit_distance = tripservice.price_per_unit_distance;
                        price_for_total_time = tripservice.price_for_total_time;
                        waiting_time_start_after_minute = tripservice.waiting_time_start_after_minute;
                        if (total_distance <= base_price_distance) {
                            distance_cost = 0;
                        } else {
                            distance_cost = Number(((total_distance - base_price_distance) * price_per_unit_distance).toFixed(2));
                        }

                        trip.distance_cost = distance_cost;

                        // TIME CALCULATIONS
                        // if (total_time > base_price_time) {
                        //     time_cost = (total_time - base_price_time) * price_for_total_time;
                        // }
                        base_price_time = tripservice.base_price_time;
                        if (total_time < base_price_time) {
                            time_cost = 0;
                        } else {
                            time_cost = (total_time - base_price_time) * price_for_total_time;
                        }
                        time_cost = Number((time_cost).toFixed(2));
                        trip.time_cost = time_cost;

                        total_waiting_time = total_waiting_time - waiting_time_start_after_minute;
                        trip.waiting_time_cost = 0;

                        trip.total_waiting_time = total_waiting_time;


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
                    } else {
                        if (trip.surge_multiplier) {
                            surge_multiplier = trip.surge_multiplier;
                        }
                        min_fare = tripservice.min_fare;
                        base_price = tripservice.base_price;
                        base_price_distance = tripservice.base_price_distance;

                        price_per_unit_distance = tripservice.price_per_unit_distance;
                        price_for_total_time = tripservice.price_for_total_time;
                        price_for_waiting_time = tripservice.price_for_waiting_time;
                        waiting_time_start_after_minute = tripservice.waiting_time_start_after_minute;

                        price_for_waiting_time_multiple_stops = tripservice.price_for_waiting_time_multiple_stops ? tripservice.price_for_waiting_time_multiple_stops : 0;
                        waiting_time_start_after_minute_multiple_stops = tripservice.waiting_time_start_after_minute_multiple_stops ? tripservice.waiting_time_start_after_minute_multiple_stops : 0;

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
                        //  WAITING TIME CALCULATIONS
                        total_waiting_time = total_waiting_time - waiting_time_start_after_minute;
                        if (total_waiting_time < 0) {
                            total_waiting_time = 0;
                        }

                        if (total_waiting_time > 0) {

                            waiting_time_cost = Number((total_waiting_time * price_for_waiting_time).toFixed(2));
                        }
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
                        if (total_stop_waiting_time > 0) {
                            stop_waiting_time_cost = Number((total_stop_waiting_time * price_for_waiting_time_multiple_stops).toFixed(2));
                        }

                        trip.waiting_time_cost = waiting_time_cost;
                        trip.total_waiting_time = total_waiting_time;
                        trip.total_stop_waiting_time = total_stop_waiting_time;
                        trip.stop_waiting_time_cost = stop_waiting_time_cost;


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
                    trip.booking_type = await utils.getTripBookingTypes(trip)

                    // Set trip status
                    trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_COMPLETED, TYPE_VALUE.PROVIDER )
                    
                    ///////////////////////// FOR INVOICE //////////////////////////
                    let current_rate = 1;

                    let adminCurrencyCode = setting_detail.adminCurrencyCode;
                    let adminCurrency = setting_detail.adminCurrency;

                    trip.current_rate = current_rate;

                    let promocode = await Promo_Code.findOne({ _id: trip.promo_id })

                    total_after_user_tax_fees = +total_after_tax_fees + +user_miscellaneous_fee + +user_tax_fee;

                    if (trip.promo_id != null && promocode) {
                        let promo_type = promocode.code_type;
                        promo_value = promocode.code_value;
                        if (promo_type == 1) { ///abs
                            promo_payment = promo_value;
                        } else { // perc
                            promo_payment = Number((promo_value * 0.01 * total_after_user_tax_fees).toFixed(2));
                        }


                        total_after_promo_payment = total_after_user_tax_fees - promo_payment;


                        if (total_after_promo_payment < 0) {
                            total_after_promo_payment = 0;
                            promo_payment = total_after_user_tax_fees;
                        }


                        let userpromouse = await User_promo_use.findOne({ trip_id: trip._id })
                        userpromouse.user_used_amount = promo_payment;
                        userpromouse.user_used_amount_in_admin_currency = promo_payment * current_rate;
                        userpromouse.save();
                    } else {
                        promo_payment = 0;
                        total_after_promo_payment = total_after_user_tax_fees;
                    }


                    total_after_promo_payment = Number((total_after_promo_payment).toFixed(2));
                    trip.promo_payment = promo_payment;
                    trip.total_after_promo_payment = total_after_promo_payment;

                    trip.total_after_referral_payment = total_after_promo_payment;
                    ////////ENTRY IN PROVIDER EARNING TABLE ///////////
                    let service_total_in_admin_currency = Number((total_after_user_tax_fees * current_rate).toFixed(3));

                    let provider_profit_fees = Number((total_after_tax_fees * provider_profit * 0.01).toFixed(2));


                    provider_tax_fee = Number((provider_tax * 0.01 * provider_profit_fees).toFixed(2));
                    trip.provider_miscellaneous_fee = provider_miscellaneous_fee;
                    trip.provider_tax_fee = provider_tax_fee;
                    let provider_service_fees = +provider_profit_fees + +toll_amount - provider_miscellaneous_fee - provider_tax_fee;

                    let provider_service_fees_in_admin_currency = Number((provider_service_fees * current_rate).toFixed(3));

                    let promo_referral_amount = promo_payment;
                    total = total_after_promo_payment;

                    total = +total + +toll_amount;
                    total = Number((total).toFixed(2));
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
                    trip.toll_amount = toll_amount;
                    trip.total = total;

                    let wallet_current_rate = 1;

                    trip.wallet_current_rate = wallet_current_rate;
                    let split_payment_users = trip.split_payment_users.filter((split_payment_user_detail) => {
                        if (split_payment_user_detail.status == SPLIT_PAYMENT.ACCEPTED) {
                            return split_payment_user_detail;
                        }
                    });
                    trip.split_payment_users = split_payment_users;
                    trip.split_payment_users.forEach((split_payment_user_detail) => {
                        split_payment_user_detail.total = (total / (trip.split_payment_users.length + 1));
                        if (split_payment_user_detail.payment_mode == constant_json.PAYMENT_MODE_CASH) {
                            split_payment_user_detail.cash_payment = split_payment_user_detail.total;
                            split_payment_user_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                        } else {
                            split_payment_user_detail.remaining_payment = split_payment_user_detail.total
                        }
                    })
                    trip.markModified('split_payment_users');
                    await trip.save()
                    if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
                        wsal_services.TripRegistrationService(trip._id);
                    }

                    let country = await Country.findById(trip.country_id)
                    myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, TRIP_STATUS.TRIP_COMPLETED,null, country._id);
                    utils.update_request_status_socket(trip._id,null,trip.is_provider_status);
                    if (trip.trip_type >= constant_json.TRIP_TYPE_DISPATCHER) {
                        utils.get_service_id_socket(trip.user_type_id)
                    }

                    let total_redeem_point = '';
                    if(country?.user_redeem_settings[0]?.is_user_redeem_point_reward_on && (country?.user_redeem_settings[0]?.trip_redeem_point > 0)){
                        total_redeem_point = utils.add_redeem_point_history(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id,country._id,constant_json.TRIP_REDEEM_POINT,user.wallet_currency_code,`Get redeem point via Trips : ${trip.unique_id}`,country.user_redeem_settings[0]?.trip_redeem_point,user.total_redeem_point,constant_json.ADD_REDEEM_POINT)
                        user.total_redeem_point = total_redeem_point
                        await user.save()
                    }
                    /*
                    This code was commented out due to an issue where the invoice was not displayed in the user app after completing a corporate or hotel trip. The problem arise from resetting the current_trip_id to null which results in the 'no trip found' error when firing the usergettripstatus API from the frontend, Android, and iOS apps

                        if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE || trip.trip_type == constant_json.TRIP_TYPE_HOTEL) {
                            let user = await User.findOne({ _id: trip.user_id })
                            user.current_trip_id = null;
                            user.save();
                        }
                    */
                    await utils.generate_admin_profit(trip, user)           

                    res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                        trip: trip,
                        tripservice: tripservice
                    });

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

exports.pay_payment = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});
        const trip = await Trip.findOne({ _id: req.body.trip_id, is_trip_end: 0 });
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
            return;
        }
        let is_provider_earning_set_in_wallet_on_cash_payment = false;
        const city = await City.findOne({ _id: trip.city_id });
        if (city) {
            is_provider_earning_set_in_wallet_on_cash_payment = city.is_provider_earning_set_in_wallet_on_cash_payment;
        }

        let payment_mode = trip.payment_mode;
        let is_user_need_save = false; // to avoid can't save() the same doc multiple times in parallel.

        const provider = await Provider.findOne({ _id: trip.confirmed_provider });
        const user = await User.findOne({ _id: trip.user_id });

        let user_device_token = user.device_token;
        let user_device_type = user.device_type;

        const corporate = await Corporate.findOne({ _id: trip.user_type_id });

        let countryCurrencyCode = trip.currencycode;
        
        trip.is_trip_end = 1;
        if (trip.user_type == Number(constant_json.USER_TYPE_DISPATCHER) || trip.user_type == Number(constant_json.USER_TYPE_HOTEL) || trip.user_type == Number(constant_json.USER_TYPE_PROVIDER)) {
            trip.is_user_invoice_show = 1;
            user.current_trip_id = null;
            is_user_need_save = true;
        }

        let wallet_amount = Number((Math.max(user.wallet, 0)).toFixed(2) * trip.wallet_current_rate);
        let is_use_wallet = user.is_use_wallet;
        if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE && corporate) {
            wallet_amount = Number((Math.max(corporate.wallet, 0)).toFixed(2) * trip.wallet_current_rate);
            is_use_wallet = 1;
        }
        let wallet_payment = 0;
        let remaining_payment = 0;
        let total = trip.total;
        if (trip.split_payment_users.length > 0) {
            total = (trip.total / (trip.split_payment_users.length + 1));
        }
        let total_after_wallet_payment = total;

        if (wallet_amount > 0 && total_after_wallet_payment > 0 && is_use_wallet == constant_json.YES && trip.trip_type != constant_json.TRIP_TYPE_DISPATCHER) {
            if (wallet_amount > total_after_wallet_payment) {
                wallet_payment = total_after_wallet_payment;
            } else {
                wallet_payment = wallet_amount;
            }
            if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE && corporate) {
                let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, corporate.unique_id, corporate._id, null,
                    corporate.wallet_currency_code, trip.currencycode,
                    trip.wallet_current_rate, wallet_payment, corporate.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                corporate.wallet = total_wallet_amount;
                await corporate.save();
                user.corporate_wallet_limit = user.corporate_wallet_limit - total;
                is_user_need_save = true;
            } else {
                let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id, null,
                    user.wallet_currency_code, trip.currencycode,
                    trip.wallet_current_rate, wallet_payment, user.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                user.wallet = total_wallet_amount;
                is_user_need_save = true;
            }

            total_after_wallet_payment = total_after_wallet_payment - wallet_payment;
        }

        if (is_user_need_save) {
            await user.save();
        }

        total_after_wallet_payment = Number((total_after_wallet_payment).toFixed(2));
        wallet_payment = Number((wallet_payment).toFixed(2));
        remaining_payment = total - wallet_payment;
        remaining_payment = Number((remaining_payment).toFixed(2));
        trip.current_rate  = trip.current_rate ? trip.current_rate : 1
        trip.wallet_payment = wallet_payment;
        trip.total_after_wallet_payment = total_after_wallet_payment;
        trip.remaining_payment = remaining_payment;
        trip.payment_status = PAYMENT_STATUS.COMPLETED;
        trip.provider_service_fees = +trip.provider_service_fees;
        trip.total_in_admin_currency = Number(trip.total) * trip.current_rate ;
        trip.provider_service_fees_in_admin_currency = trip.provider_service_fees * trip.current_rate;
        if (trip.payment_mode == Number(constant_json.PAYMENT_MODE_CASH)) {
            // added condition for cash in hand
            trip.provider_have_cash = remaining_payment;
        }

        trip.split_payment_users.forEach(async(split_user) => {
            let split_user_remaining_payment = split_user.remaining_payment;
            if (split_user.payment_mode == Number(constant_json.PAYMENT_MODE_CASH)) {
                trip.provider_have_cash = trip.provider_have_cash + split_user.cash_payment;
                trip.cash_payment = trip.cash_payment + split_user.cash_payment;
            }
            if (split_user.payment_mode == null) {
                trip.wallet_payment = trip.wallet_payment + split_user.remaining_payment;
                split_user.wallet_payment = split_user.remaining_payment;
                split_user.remaining_payment = 0;
                split_user.payment_status = PAYMENT_STATUS.COMPLETED;
            }
            const split_user_detail = await User.findOne({ _id: split_user.user_id });
            let push_data = {
                trip_id: trip._id,
                first_name: user.first_name,
                last_name: user.last_name,
                is_trip_end: trip.is_trip_end,
                currency: trip.currency,
                phone: user.phone,
                country_phone_code: user.country_phone_code,
                user_id: trip.user_id,
                status: split_user.status,
                payment_mode: split_user.payment_mode,
                payment_status: split_user.payment_status,
                payment_intent_id: split_user.payment_intent_id,
                total: split_user.total,
                currency_code: trip.currencycode
            }
            await utils.sendPushNotification(split_user_detail.device_type, split_user_detail.device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END_SPLIT_PAYMENT, push_data, split_user_detail.webpush_config, split_user_detail.lang_code);
            utils.req_type_id_socket(split_user_detail._id)
            if (split_user.payment_mode == null) {

                let total_aplit_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, split_user_detail.unique_id, split_user_detail._id, null,
                    split_user_detail.wallet_currency_code, trip.currencycode,
                    trip.wallet_current_rate, split_user_remaining_payment, split_user_detail.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);

                split_user_detail.wallet = total_aplit_wallet_amount;
                await split_user_detail.save();
            }
        });

        trip.markModified('split_payment_users');

        trip.pay_to_provider = (trip.payment_mode == constant_json.PAYMENT_MODE_CASH) ? trip.provider_service_fees - trip.provider_have_cash : trip.provider_service_fees;
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;

        let total_wallet_amount = 0;
        if (payment_mode == Number(constant_json.PAYMENT_MODE_CASH) && is_provider_earning_set_in_wallet_on_cash_payment) {
            if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
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
            } else {
                const partner = await Partner.findOne({ _id: trip.provider_type_id });
                if (trip.pay_to_provider < 0) {
                    total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, Math.abs(trip.pay_to_provider), partner.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
                } else {
                    total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                        partner.wallet_currency_code, trip.currencycode,
                        1, trip.pay_to_provider, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                }
                partner.wallet = total_wallet_amount;
                await partner.save();
            }

            trip.is_provider_earning_set_in_wallet = true;
            trip.is_provider_earning_added_in_wallet = trip.pay_to_provider >= 0;
            trip.provider_income_set_in_wallet = Math.abs(trip.pay_to_provider);
        }

        // End 6 March //

        if (payment_mode == constant_json.PAYMENT_MODE_CASH) {
            trip.is_paid = 1;
            trip.is_pending_payments = 0;
            trip.cash_payment = trip.cash_payment + remaining_payment;
            trip.remaining_payment = 0;
            await Trip.updateOne({ _id: trip._id }, trip.getChanges())
            utils.trip_response(req, trip, user, provider, res);
        } else if (payment_mode == constant_json.PAYMENT_MODE_APPLE_PAY) {
            
            if (remaining_payment > 0) {
                trip.is_paid = 0;
                trip.payment_status = PAYMENT_STATUS.FAILED;
                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                utils.trip_response(req, trip, user, provider, res);
            } else {
                trip.is_paid = 1;
                trip.is_pending_payments = 0;
                trip.payment_status = PAYMENT_STATUS.COMPLETED;
                trip.card_payment = 0;
                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                utils.trip_response(req, trip, user, provider, res);
            }

        } else {
            
            if (remaining_payment > 0) {
                let user_id = trip.user_id;
                let email = user.email;
                let customer_id = user.customer_id;
                if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE && corporate) {
                    user_id = trip.user_type_id;
                    customer_id = corporate.customer_id;
                    email = corporate.email;
                }
                trip.is_paid = 0;
                trip.remaining_payment = remaining_payment;
                trip.payment_status = PAYMENT_STATUS.WAITING;

                const card_detail = await Card.findOne({ user_id: user_id, payment_gateway_type: trip.payment_gateway_type, is_default: true });

                if (!card_detail) {
                    trip.payment_status = PAYMENT_STATUS.FAILED;
                    await trip.save();
                    utils.trip_response(req, trip, user, provider, res);
                    return
                }
                if (countryCurrencyCode == "" || !countryCurrencyCode) {
                    countryCurrencyCode = setting_detail.adminCurrencyCode;
                }
                if (trip.payment_gateway_type == PAYMENT_GATEWAY.stripe) {
                    let url = setting_detail.payments_base_url + "/create_payment_intent"
                    let data = {
                        amount: Math.round((remaining_payment * 100)),
                        currency: countryCurrencyCode,
                        customer: customer_id,
                        payment_method: card_detail.payment_method,
                        setup_future_usage: 'off_session',
                        confirm: true
                    }
        
                    const request = require('request');
                    request.post(
                    {
                        url: url,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(data),
                    }, async (error, response, body) => {
                        if (error) {
                            console.error(error);
                            return error
                        } else {
                            body = JSON.parse(body);
                            let paymentIntent = body.paymentIntent;
        
                            if (paymentIntent && paymentIntent.status == 'succeeded' && paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data.length > 0) {
                                trip.remaining_payment = 0
                                trip.is_paid = 1
                                trip.card_payment = paymentIntent.charges.data[0].amount / 100;
                                trip.payment_intent_id = paymentIntent.id;
                                trip.payment_status = PAYMENT_STATUS.COMPLETED
                                await utils.trip_provider_profit_card_wallet_settlement(trip)
                                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                                utils.trip_response(req, trip, user, provider, res);
                            } else {
                                utils.trip_payment_failed(trip, city, provider);
                                trip.payment_status = PAYMENT_STATUS.FAILED;
                                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                                utils.update_request_status_socket(trip._id, null, 0, true);
                                utils.sendPushNotification(user_device_type, user_device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", null, user.lang_code);
                                return res.json({
                                    success: true,
                                    error_message:error ? error.raw.message : '',
                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                    payment_status: trip.payment_status
                                });
                            }
                        }
                    });
                } else if(trip.payment_gateway_type == PAYMENT_GATEWAY.paystack) {
                    const params = JSON.stringify({
                        "email": email,
                        "amount": Math.round((remaining_payment * 100)),
                        // currency : wallet_currency_code,
                        authorization_code: card_detail.payment_method
                    });
                    const options = {
                        hostname: 'api.paystack.co',
                        port: 443,
                        path: '/charge',
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + setting_detail.paystack_secret_key,
                            'Content-Type': 'application/json'
                        }
                    }
                    const request = https.request(options, res_data => {
                        let data = ''
                        res_data.on('data', (chunk) => {
                            data += chunk
                        });
                        res_data.on('end', async () => {
                            let payment_response = JSON.parse(data);
                            if (payment_response.status) {
                                trip.payment_intent_id = payment_response.data.reference;
                                if (payment_response.data.status == 'success') {

                                    trip.is_paid = 1;
                                    trip.is_pending_payments = 0;
                                    trip.card_payment = 0;
                                    trip.payment_status = PAYMENT_STATUS.COMPLETED;
                                    trip.remaining_payment = 0;
                                    trip.card_payment = payment_response.data.amount / 100;

                                    // start provider profit after card payment done
                                    await utils.trip_provider_profit_card_wallet_settlement(trip);
                                    // end of provider profit after card payment done

                                    await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                                    utils.trip_response(req, trip, user, provider, res);

                                } else if (payment_response.data.status == 'open_url') {
                                    trip.payment_status = PAYMENT_STATUS.FAILED;
                                    await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                                    utils.update_request_status_socket(trip._id, null, 0, true)
                                    utils.sendPushNotification(user_device_type, user_device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", null, user.lang_code);
                                    return res.json({ success: false, url: payment_response.data.url });
                                } else {
                                    utils.trip_payment_failed(trip, city, provider);
                                    trip.payment_status = PAYMENT_STATUS.FAILED;
                                    await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                                    utils.update_request_status_socket(trip._id, null, 0, true)
                                    utils.sendPushNotification(user_device_type, user_device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", null, user.lang_code);
                                    return res.json({ success: false, reference: payment_response.data.reference, required_param: payment_response.data.status });
                                }

                            } else {
                                let error_message = '';
                                if (payment_response.data) {
                                    error_message = payment_response.data.message;
                                } else {
                                    error_message = payment_response.message;
                                }
                                trip.payment_status = PAYMENT_STATUS.FAILED;
                                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                                utils.update_request_status_socket(trip._id, null, 0, true)
                                utils.sendPushNotification(user_device_type, user_device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_END, "", null, user.lang_code);
                                return res.json({
                                    success: true,
                                    error_message:error_message,
                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                                    payment_status: trip.payment_status
                                });
                            }
                        })
                    }).on('error', error => {
                        console.error(error)
                    })
                    request.write(params)
                    request.end()
                } else{
                    trip.payment_status = PAYMENT_STATUS.FAILED;
                    await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                    utils.trip_response(req, trip, user, provider, res);
                }
            } else {
                trip.is_paid = 1;
                trip.is_pending_payments = 0;
                trip.payment_status = PAYMENT_STATUS.COMPLETED;
                trip.card_payment = 0;
                await utils.trip_provider_profit_card_wallet_settlement(trip);
                await Trip.updateOne({ _id: trip._id }, trip.getChanges())
                utils.trip_response(req, trip, user, provider, res);
            }

        }
        
    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
        }); 
    }

};

exports.pay_tip_payment = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    if(req.query?.amount){
        req.body.amount = req.query?.amount 
        req.body.trip_id = req.query?.trip_id
    }
    if (req.body?.udf5) {
        req.body.trip_id = req.body.udf5;
    }else if(req.body?.user_defined?.udf5){
        req.body.trip_id = req.body.user_defined.udf5
    }
    Trip.findOne({ _id: req.body.trip_id }).then(async  (trip) => {
        Trip_history.findOne({ _id: req.body.trip_id, is_trip_end: 1 }).then(async (trip_history) => {
            if (!trip) {
                trip = trip_history;
            }
            if (trip) {
                let total_redeem_point = '';
                let country = await Country.findById(trip.country_id)
                let user = await User.findById(trip.user_id)
                if(country?.user_redeem_settings[0]?.is_user_redeem_point_reward_on && (country.user_redeem_settings[0]?.tip_redeem_point > 0)){
                    total_redeem_point = utils.add_redeem_point_history(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id,country._id,constant_json.TIP_REDEEM_POINT,user.wallet_currency_code,"Get redeem point via Tips",country.user_redeem_settings[0]?.tip_redeem_point,user.total_redeem_point,constant_json.ADD_REDEEM_POINT,trip.unique_id)

                    user.total_redeem_point = total_redeem_point
                    await user.save()
                }
                if (!trip.payment_gateway_type || trip.payment_gateway_type == PAYMENT_GATEWAY.stripe || req.body?.is_apple_pay) {
                    let url = setting_detail.payments_base_url + "/retrieve_payment_intent"
                    let data = {
                        payment_intent_id: trip.tip_payment_intent_id
                    }

                    const request = require('request');
                    request.post(
                    {
                        url: url,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(data),
                    }, (error, response, body) => {
                        if (error) {
                            console.error(error);
                            return error
                        } else {
                            body = JSON.parse(body);
                            let intent = body.intent;

                            if (intent && intent.charges && intent.charges.data && intent.charges.data.length > 0) {
                                trip.tip_amount = intent.charges.data[0].amount / 100;
                                trip.total = trip.total + trip.tip_amount;
                                trip.provider_service_fees = +trip.provider_service_fees + +trip.tip_amount;
                                trip.pay_to_provider = trip.pay_to_provider + +trip.tip_amount;
                                trip.card_payment = trip.card_payment + trip.tip_amount;
    
                                Provider.findOne({ _id: trip.confirmed_provider }, function (error, provider) {
                                    City.findOne({ _id: trip.city_id }).then((city) => {
                                        if (city.is_provider_earning_set_in_wallet_on_other_payment) {
                                            if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                                let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                                    provider.wallet_currency_code, trip.currencycode,
                                                    1, trip.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
    
                                                provider.wallet = total_wallet_amount;
                                                provider.save();
                                            } else {
                                                Partner.findOne({ _id: trip.provider_type_id }).then((partner) => {
                                                    let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                                        partner.wallet_currency_code, trip.currencycode,
                                                        1, trip.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
    
                                                    partner.wallet = total_wallet_amount;
                                                    partner.save();
                                                });
                                            }
    
                                            trip.is_provider_earning_set_in_wallet = true;
                                            trip.provider_income_set_in_wallet = trip.provider_income_set_in_wallet + Math.abs(trip.tip_amount);
                                        }
    
                                        trip.save().then(() => {
                                            if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                                                wsal_services.TripsUpdateService(trip._id)
                                            }
                                            res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                                        });
                                    });
                                });
    
                            } else {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING })
                            }
                        }
                    })
                } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.payu) {
                    trip.tip_amount = req.body.amount;
                    trip.total = trip.total + trip.tip_amount;
                    trip.provider_service_fees = +trip.provider_service_fees + +trip.tip_amount;
                    trip.pay_to_provider = trip.pay_to_provider + +trip.tip_amount;
                    trip.card_payment = trip.card_payment + trip.tip_amount;
                    trip.payment_intent_id = req.body.mihpayid;

                    Provider.findOne({ _id: trip.confirmed_provider }, function (error, provider) {
                        City.findOne({ _id: trip.city_id }).then((city) => {
                            if (city.is_provider_earning_set_in_wallet_on_other_payment) {
                                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                        provider.wallet_currency_code, trip.currencycode,
                                        1, trip.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                                    provider.wallet = total_wallet_amount;
                                    provider.save();
                                } else {
                                    Partner.findOne({ _id: trip.provider_type_id }).then((partner) => {
                                        let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                            partner.wallet_currency_code, trip.currencycode,
                                            1, trip.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                                        partner.wallet = total_wallet_amount;
                                        partner.save();
                                    });
                                }

                                trip.is_provider_earning_set_in_wallet = true;
                                trip.provider_income_set_in_wallet = trip.provider_income_set_in_wallet + Math.abs(trip.tip_amount);
                            }

                            trip.save().then(() => {
                                if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                                    wsal_services.TripsUpdateService(trip._id)
                                }
                                if (req.body.udf4) {
                                    if (req.body.udf4 === "/payments" || req.body.udf4 === "/provider_payments") {
                                        return res.redirect(setting_detail.payments_base_url + "/success_payment_payu");
                                    } else {
                                        return res.redirect(req.body.udf4);
                                    }
                                } else {
                                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                                }
                            });
                        });
                    });

                } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.razorpay){
                   const key_secret = setting_detail.razorpay_secret_key
                   const crypto = require("crypto");
                   const generated_signature = crypto.createHmac("SHA256",key_secret).update(req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id).digest("hex"); 
                   let is_signature_valid = generated_signature == req.body.razorpay_signature;
                    
                    if (is_signature_valid) {
                        trip.tip_amount = req.body.amount;
                        trip.total = trip.total + trip.tip_amount;
                        trip.provider_service_fees = +trip.provider_service_fees + +trip.tip_amount;
                        trip.pay_to_provider = trip.pay_to_provider + +trip.tip_amount;
                        trip.card_payment = trip.card_payment + trip.tip_amount;
                        trip.tip_payment_intent_id = req.body.razorpay_payment_id;
    
                        Provider.findOne({ _id: trip.confirmed_provider }, function (error, provider) {
                            City.findOne({ _id: trip.city_id }).then((city) => {
                                if (city.is_provider_earning_set_in_wallet_on_other_payment) {
                                    if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                        let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                            provider.wallet_currency_code, trip.currencycode,
                                            1, trip.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
    
                                        provider.wallet = total_wallet_amount;
                                        provider.save();
                                    } else {
                                        Partner.findOne({ _id: trip.provider_type_id }).then((partner) => {
                                            let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                                partner.wallet_currency_code, trip.currencycode,
                                                1, trip.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);
    
                                            partner.wallet = total_wallet_amount;
                                            partner.save();
                                        });
                                    }
    
                                    trip.is_provider_earning_set_in_wallet = true;
                                    trip.provider_income_set_in_wallet = trip.provider_income_set_in_wallet + Math.abs(trip.tip_amount);
                                }
    
                                trip.save().then(() => {
                                    if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                                        wsal_services.TripsUpdateService(trip._id)
                                    }
                                    if (req.query?.is_new) {
                                        return res.redirect(req.query.is_new);
                                    } else {
                                        return res.redirect(setting_detail.payments_base_url + '/success_payment_razor');
                                    }
                                });
                            });
                        });
                    }else{
                        if (req.query?.is_new) {
                            utils.payu_status_fail_socket(trip.user_id)
                            return res.redirect(req.query?.is_new);
                        } else {
                            utils.payu_status_fail_socket(trip.user_id)
                            return res.redirect(setting_detail.payments_base_url + '/fail_payment');
                        }
                    }
                } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.paytabs){
                    trip.tip_amount = req.body.tran_total;
                    trip.total = trip.total + trip.tip_amount;
                    trip.provider_service_fees = +trip.provider_service_fees + +trip.tip_amount;
                    trip.pay_to_provider = trip.pay_to_provider + +trip.tip_amount;
                    trip.card_payment = trip.card_payment + trip.tip_amount;
                    trip.tip_payment_intent_id = req.body.tran_ref;

                    Provider.findOne({ _id: trip.confirmed_provider }, function (error, provider) {
                        City.findOne({ _id: trip.city_id }).then((city) => {
                            if (city.is_provider_earning_set_in_wallet_on_other_payment) {
                                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                        provider.wallet_currency_code, trip.currencycode,
                                        1, trip.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id,req.body.tran_ref);

                                    provider.wallet = total_wallet_amount;
                                    provider.save();
                                } else {
                                    Partner.findOne({ _id: trip.provider_type_id }).then((partner) => {
                                        let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                            partner.wallet_currency_code, trip.currencycode,
                                            1, trip.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id,req.body.tran_ref);

                                        partner.wallet = total_wallet_amount;
                                        partner.save();
                                    });
                                }

                                trip.is_provider_earning_set_in_wallet = true;
                                trip.provider_income_set_in_wallet = trip.provider_income_set_in_wallet + Math.abs(trip.tip_amount);
                            }

                            trip.save().then(() => {
                                if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                                    wsal_services.TripsUpdateService(trip._id)
                                }
                                if (req.query.is_new != 'undefined') {
                                    return res.redirect(req.query.is_new);
                                } else {
                                    return res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                }
                            });
                        });
                    });
                } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.paypal) {
                    trip.tip_amount = req.body.amount;
                    trip.total = trip.total + trip.tip_amount;
                    trip.provider_service_fees = +trip.provider_service_fees + +trip.tip_amount;
                    trip.pay_to_provider = trip.pay_to_provider + +trip.tip_amount;
                    trip.card_payment = trip.card_payment + trip.tip_amount;
                    trip.tip_payment_intent_id = req.body.is_web ? (req.body?.payment_intent_id?.purchase_units[0]?.payments?.captures[0]?.id) : req.body?.payment_intent_id;
                    Provider.findOne({ _id: trip.confirmed_provider }, function (error, provider) {
                        City.findOne({ _id: trip.city_id }).then((city) => {
                            if (city.is_provider_earning_set_in_wallet_on_other_payment) {
                                if (provider.provider_type != PROVIDER_TYPE.PARTNER) {
                                    let total_wallet_amount = utils.addWalletHistory(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country_id,
                                        provider.wallet_currency_code, trip.currencycode,
                                        1, trip.tip_amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                                    provider.wallet = total_wallet_amount;
                                    provider.save();
                                } else {
                                    Partner.findOne({ _id: trip.provider_type_id }).then((partner) => {
                                        let total_wallet_amount = utils.addWalletHistory(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner.country_id,
                                            partner.wallet_currency_code, trip.currencycode,
                                            1, trip.tip_amount, partner.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.SET_TRIP_PROFIT, "Set Profit Of This Trip : " + trip.unique_id);

                                        partner.wallet = total_wallet_amount;
                                        partner.save();
                                    });
                                }

                                trip.is_provider_earning_set_in_wallet = true;
                                trip.provider_income_set_in_wallet = trip.provider_income_set_in_wallet + Math.abs(trip.tip_amount);
                            }

                            trip.save().then(() => {
                                if(setting_detail.is_wsal_service_use && country.is_use_wsal){
                                    wsal_services.TripsUpdateService(trip._id)
                                }
                                res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                            });
                        });
                    });
                }
            } else {
                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
            }
        });
    });
}

exports.pay_stripe_intent_payment = async function (req, res) {

    console.log("pay_stripe_intent_payment");
    console.log(req.body);
    console.log(req.query);
    
    const setting_detail = await Settings.findOne({});

    // for rental trip PayU payment
    if(req.body?.udf1 == "12"){
        let payu_res = req.body?.udf5 || "";
        const input = payu_res;
        const resultArray = input.split("/");
        req.body.udf5 = resultArray[0];
        req.body.is_rental_trip_payment = resultArray[1] || false;
        req.body.is_rental_trip_additional_payment = resultArray[2] || false;
    }

    if(req.query.url !== undefined){
        req.body.user_id = req.query.url 
    }
    if((req.query.user_id !== undefined && req.query.trip_id  !== undefined) || (req.query.trip_id  !== undefined)){
        req.body.user_id = req.query.user_id 
        req.body.trip_id = req.query.trip_id 
    }
    if (req.body.txnid) {
        req.body.trip_id = req.body.txnid;
    }else if(req.body?.user_defined?.udf5){
        req.body.trip_id = req.body.user_defined.udf5
    }

    if(req.query?.is_rental_trip_payment){
        req.body.is_rental_trip_payment = req.query?.is_rental_trip_payment
    }

    if(req.query?.is_rental_trip_additional_payment){
        req.body.is_rental_trip_additional_payment = req.query?.is_rental_trip_additional_payment
    }
    
    if(typeof req.body.is_rental_trip_payment == "string"){
        req.body.is_rental_trip_payment = req.body.is_rental_trip_payment == "true" ? true : false
    }
    if(typeof req.body.is_rental_trip_additional_payment == "string"){
        req.body.is_rental_trip_additional_payment = req.body.is_rental_trip_additional_payment == "true" ? true : false
    }

    console.log(req.body);
    
    if(req.body?.is_rental_trip_payment){
        console.log("5140");
        Rental_Trip.findOne({_id: req.body.trip_id}).then(async (trip_detail) => {
            if(!trip_detail){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
            }

            let detail = await User.findOne({_id: trip_detail.user_id});
            let provider_detail = await Provider.findOne({_id: trip_detail.provider_id});

            if (!trip_detail.payment_gateway_type || trip_detail.payment_gateway_type == PAYMENT_GATEWAY.stripe || req.body?.is_apple_pay) {
    
                let payment_intent_id = trip_detail.payment_intent_id;

                let url = setting_detail.payments_base_url + "/retrieve_payment_intent"
                let data = {
                    payment_intent_id: payment_intent_id
                }
                const request = require('request');
                request.post(
                {
                    url: url,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                }, async (error, response, body) => {
                    if (error) {
                        console.error(error);
                        return error
                    } else {
                        body = JSON.parse(body);
                        let intent = body.intent;

                        if (intent && intent.charges && intent.charges.data && intent.charges.data.length > 0) {
                            
                            trip_detail.is_paid = 1;
                            trip_detail.remaining_payment = 0;
                            trip_detail.card_payment = intent.charges.data[0].amount / 100;
                            trip_detail.is_pending_payments = 0;
                            trip_detail.user_payment_time = new Date();
                            trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                            trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;
                            
                            let user_type = TYPE_VALUE.USER;
                            let trip_status = trip_detail.trip_status;
                            const newStatus = {
                                status: RENTAL_TRIP_STATUS.PAYMENT,
                                timestamp: new Date(),
                                user_type: user_type,
                                username: detail.first_name + " " + detail.last_name,
                                user_id: detail._id
                            };
                            trip_status.push(newStatus);
                            trip_detail.trip_status = trip_status;
                            
                            trip_detail.save().then(() => {
                                if(provider_detail){
                                    utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAYMENT_PAID_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                                }
                                return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });            
                            });
                        } else {
                            return res.json({ success: false, error_code: error_message.ERROR_CODE_PAY_PAYMENT_FAILED })
                        }
                        
                    }
                })
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.payu) {

                trip_detail.is_paid = 1;
                trip_detail.remaining_payment = 0;
                trip_detail.card_payment = trip_detail.total;
                trip_detail.is_pending_payments = 0;
                trip_detail.user_payment_time = new Date();
                trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                trip_detail.payment_intent_id = req.body.mihpayid;
                trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;        
                
                let user_type = TYPE_VALUE.USER;
                let trip_status = trip_detail.trip_status;
                const newStatus = {
                    status: RENTAL_TRIP_STATUS.PAYMENT,
                    timestamp: new Date(),
                    user_type: user_type,
                    username: detail.first_name + " " + detail.last_name,
                    user_id: detail._id
                };
                trip_status.push(newStatus);
                trip_detail.trip_status = trip_status;
                
                trip_detail.save().then(() => {
                    if(provider_detail){
                        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAYMENT_PAID_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                    }
                    if (req.body.udf4) {
                        if (req.body.udf4 === "/payments") {
                            return res.redirect(setting_detail.payments_base_url + "/success_payment_payu");
                        } else {
                            return res.redirect(req.body.udf4);
                        }
                    } else {
                        return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                    }
                });
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.razorpay){
                const key_secret = setting_detail.razorpay_secret_key
                const crypto = require("crypto");
                const generated_signature = crypto.createHmac("SHA256",key_secret).update(req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id).digest("hex");
                let is_signature_valid = generated_signature == req.body.razorpay_signature;
                console.log(generated_signature);
                console.log(req.body.razorpay_signature);
                if(is_signature_valid){

                    trip_detail.is_paid = 1;
                    trip_detail.remaining_payment = 0;
                    trip_detail.card_payment = trip_detail.total;
                    trip_detail.is_pending_payments = 0;
                    trip_detail.user_payment_time = new Date();
                    trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                    trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;        
                    trip_detail.payment_intent_id = req.body.razorpay_payment_id;
                    
                    let user_type = TYPE_VALUE.USER;
                    let trip_status = trip_detail.trip_status;
                    const newStatus = {
                        status: RENTAL_TRIP_STATUS.PAYMENT,
                        timestamp: new Date(),
                        user_type: user_type,
                        username: detail.first_name + " " + detail.last_name,
                        user_id: detail._id
                    };
                    trip_status.push(newStatus);
                    trip_detail.trip_status = trip_status;
                    
                    trip_detail.save().then(() => {
                        if(provider_detail){
                            utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAYMENT_PAID_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                        }
                        if (req.query?.is_new) {
                            return res.redirect(req.query.is_new);
                        } else {
                            return res.redirect(setting_detail.payments_base_url + '/success_payment_razor');
                        }
                    });
                }else{
                    if (req.query?.is_new) {
                        return res.redirect(req.query?.is_new);
                    } else {
                        return res.redirect(setting_detail.payments_base_url + '/fail_payment');
                    }
                }
                
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.paytabs){

                trip_detail.is_paid = 1;
                trip_detail.remaining_payment = 0;
                trip_detail.card_payment = trip_detail.total;
                trip_detail.is_pending_payments = 0;
                trip_detail.user_payment_time = new Date();
                trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;        
                trip_detail.payment_intent_id = req.body.tran_ref;
                
                let user_type = TYPE_VALUE.USER;
                let trip_status = trip_detail.trip_status;
                const newStatus = {
                    status: RENTAL_TRIP_STATUS.PAYMENT,
                    timestamp: new Date(),
                    user_type: user_type,
                    username: detail.first_name + " " + detail.last_name,
                    user_id: detail._id
                };
                trip_status.push(newStatus);
                trip_detail.trip_status = trip_status;

                trip_detail.save().then(() => {
                    if(provider_detail){
                        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAYMENT_PAID_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                    }
                    if (req.query.is_new != 'undefined') {
                        return res.redirect(req.query.is_new);
                    } else {
                        return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                    }
                });
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.paypal){

                trip_detail.is_paid = 1;
                trip_detail.remaining_payment = 0;
                trip_detail.card_payment = trip_detail.total;
                trip_detail.is_pending_payments = 0;
                trip_detail.user_payment_time = new Date();
                trip_detail.status = RENTAL_TRIP_STATUS.PAYMENT;
                trip_detail.payment_status = PAYMENT_STATUS.COMPLETED;        
                trip_detail.payment_intent_id = req.body.is_web ? (req.body?.payment_intent_id?.purchase_units[0]?.payments?.captures[0]?.id) : req.body?.payment_intent_id;
                
                let user_type = TYPE_VALUE.USER;
                let trip_status = trip_detail.trip_status;
                const newStatus = {
                    status: RENTAL_TRIP_STATUS.PAYMENT,
                    timestamp: new Date(),
                    user_type: user_type,
                    username: detail.first_name + " " + detail.last_name,
                    user_id: detail._id
                };
                trip_status.push(newStatus);
                trip_detail.trip_status = trip_status;

                trip_detail.save().then(() => {
                    if(provider_detail){
                        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAYMENT_PAID_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                    }
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                });
            }

        })
    } else if(req.body?.is_rental_trip_additional_payment){
        console.log("5361");
        Rental_Trip.findOne({_id: req.body.trip_id}).then(async (trip_detail) => {
            if(!trip_detail){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
            }

            let detail = await User.findOne({_id: trip_detail.user_id})
            let provider_detail = await Provider.findOne({_id: trip_detail.provider_id});

            if (!trip_detail.payment_gateway_type || trip_detail.payment_gateway_type == PAYMENT_GATEWAY.stripe || req.body?.is_apple_pay) {
    
                let payment_intent_id = trip_detail.additional_payment_intent_id;

                let url = setting_detail.payments_base_url + "/retrieve_payment_intent"
                let data = {
                    payment_intent_id: payment_intent_id
                }
                const request = require('request');
                request.post(
                {
                    url: url,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                }, async (error, response, body) => {
                    if (error) {
                        console.error(error);
                        return error
                    } else {
                        body = JSON.parse(body);
                        let intent = body.intent;

                        if (intent && intent.charges && intent.charges.data && intent.charges.data.length > 0) {
                            
                            let user_type = TYPE_VALUE.USER;
                            let trip_status = trip_detail.trip_status;
                            let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                            trip_detail.card_payment = trip_detail.card_payment + intent.charges.data[0].amount / 100;
                            trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                            trip_detail.provider_completed_time = new Date();
                            trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                            trip_detail.is_trip_completed = 1;
                            trip_detail.is_trip_end = 1;
                            
                            const newStatus = {
                                status: RENTAL_TRIP_STATUS.COMPLETED,
                                timestamp: new Date(),
                                user_type: user_type,
                                username: detail.first_name + " " + detail.last_name,
                                user_id: detail._id
                            };
                            trip_status.push(newStatus);
                            trip_detail.trip_status = trip_status;
                            
                            trip_detail.save().then(async() => {
                                if(provider_detail){
                                    utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAID_ADDITIONAL_PAYMETN_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                                }
                                await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id);
                                await Car_Rent_Vehicle.updateOne(
                                    { _id: trip_detail.vehicle_id },
                                    { $inc: { completed_request: 1 } }
                                );
                                await User.updateOne(
                                    { _id: trip_detail.user_id },
                                    { $inc: { rental_completed_request: 1 } }
                                );
                                await Provider.updateOne(
                                    { _id: trip_detail.provider_id },
                                    { $inc: { rental_completed_request: 1 } }
                                );
                                return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });            
                            });
                        } else {
                            return res.json({ success: false, error_code: error_message.ERROR_CODE_PAY_PAYMENT_FAILED })
                        }
                        
                    }
                })
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.payu) {
                let user_type = TYPE_VALUE.USER;
                let trip_status = trip_detail.trip_status;
                let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                trip_detail.card_payment = trip_detail.card_payment + trip_detail.total_additional_charge;
                trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                trip_detail.provider_completed_time = new Date();
                trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                trip_detail.is_trip_completed = 1;
                trip_detail.is_trip_end = 1;
                
                const newStatus = {
                    status: RENTAL_TRIP_STATUS.COMPLETED,
                    timestamp: new Date(),
                    user_type: user_type,
                    username: detail.first_name + " " + detail.last_name,
                    user_id: detail._id
                };
                trip_status.push(newStatus);
                trip_detail.trip_status = trip_status;
                
                trip_detail.save().then(async() => {
                    await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id);
                    await Car_Rent_Vehicle.updateOne(
                        { _id: trip_detail.vehicle_id },
                        { $inc: { completed_request: 1 } }
                    );
                    await User.updateOne(
                        { _id: trip_detail.user_id },
                        { $inc: { rental_completed_request: 1 } }
                    );
                    await Provider.updateOne(
                        { _id: trip_detail.provider_id },
                        { $inc: { rental_completed_request: 1 } }
                    );
                    if(provider_detail){
                        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAID_ADDITIONAL_PAYMETN_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                    }
                    if (req.body.udf4) {
                        if (req.body.udf4 === "/payments") {
                            return res.redirect(setting_detail.payments_base_url + "/success_payment_payu");
                        } else {
                            return res.redirect(req.body.udf4);
                        }
                    } else {
                        return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                    }
                });
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.razorpay){
                const key_secret = setting_detail.razorpay_secret_key
                const crypto = require("crypto");
                const generated_signature = crypto.createHmac("SHA256",key_secret).update(req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id).digest("hex");
                let is_signature_valid = generated_signature == req.body.razorpay_signature;
                console.log(generated_signature);
                console.log(req.body.razorpay_signature);
                if(is_signature_valid){

                    let user_type = TYPE_VALUE.USER;
                    let trip_status = trip_detail.trip_status;
                    let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                    trip_detail.card_payment = trip_detail.card_payment + trip_detail.total_additional_charge;
                    trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                    trip_detail.provider_completed_time = new Date();
                    trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                    trip_detail.is_trip_completed = 1;
                    trip_detail.is_trip_end = 1;
                    trip_detail.additional_payment_intent_id = req.body.razorpay_payment_id;
                    
                    const newStatus = {
                        status: RENTAL_TRIP_STATUS.COMPLETED,
                        timestamp: new Date(),
                        user_type: user_type,
                        username: detail.first_name + " " + detail.last_name,
                        user_id: detail._id
                    };
                    trip_status.push(newStatus);
                    trip_detail.trip_status = trip_status;
                    
                    trip_detail.save().then(async() => {
                        await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id);
                        await Car_Rent_Vehicle.updateOne(
                            { _id: trip_detail.vehicle_id },
                            { $inc: { completed_request: 1 } }
                        );
                        await User.updateOne(
                            { _id: trip_detail.user_id },
                            { $inc: { rental_completed_request: 1 } }
                        );
                        await Provider.updateOne(
                            { _id: trip_detail.provider_id },
                            { $inc: { rental_completed_request: 1 } }
                        );
                        if(provider_detail){
                            utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAID_ADDITIONAL_PAYMETN_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                        }
                        if (req.query?.is_new) {
                            return res.redirect(req.query.is_new);
                        } else {
                            return res.redirect(setting_detail.payments_base_url + '/success_payment_razor');
                        }
                    });
                }else{
                    if (req.query?.is_new) {
                        return res.redirect(req.query?.is_new);
                    } else {
                        return res.redirect(setting_detail.payments_base_url + '/fail_payment');
                    }
                }
                
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.paytabs){

                let user_type = TYPE_VALUE.USER;
                let trip_status = trip_detail.trip_status;
                let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                trip_detail.card_payment = trip_detail.card_payment + trip_detail.total_additional_charge;
                trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                trip_detail.provider_completed_time = new Date();
                trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                trip_detail.is_trip_completed = 1;
                trip_detail.is_trip_end = 1;
                trip_detail.additional_payment_intent_id = req.body.tran_ref;
                
                const newStatus = {
                    status: RENTAL_TRIP_STATUS.COMPLETED,
                    timestamp: new Date(),
                    user_type: user_type,
                    username: detail.first_name + " " + detail.last_name,
                    user_id: detail._id
                };
                trip_status.push(newStatus);
                trip_detail.trip_status = trip_status;

                trip_detail.save().then(async() => {
                    await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id);
                    await Car_Rent_Vehicle.updateOne(
                        { _id: trip_detail.vehicle_id },
                        { $inc: { completed_request: 1 } }
                    );
                    await User.updateOne(
                        { _id: trip_detail.user_id },
                        { $inc: { rental_completed_request: 1 } }
                    );
                    await Provider.updateOne(
                        { _id: trip_detail.provider_id },
                        { $inc: { rental_completed_request: 1 } }
                    );
                    if(provider_detail){
                        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAID_ADDITIONAL_PAYMETN_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                    }
                    if (req.query.is_new != 'undefined') {
                        return res.redirect(req.query.is_new);
                    } else {
                        return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                    }
                });
            } else if( trip_detail.payment_gateway_type == PAYMENT_GATEWAY.paypal){

                let user_type = TYPE_VALUE.USER;
                let trip_status = trip_detail.trip_status;
                let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip_detail.timezone);

                trip_detail.card_payment = trip_detail.card_payment + trip_detail.total_additional_charge;
                trip_detail.status = RENTAL_TRIP_STATUS.COMPLETED;
                trip_detail.provider_completed_time = new Date();
                trip_detail.complete_date_in_city_timezone = complete_date_in_city_timezone;
                trip_detail.is_trip_completed = 1;
                trip_detail.is_trip_end = 1;
                trip_detail.additional_payment_intent_id = req.body.is_web ? (req.body?.payment_intent_id?.purchase_units[0]?.payments?.captures[0]?.id) : req.body?.payment_intent_id;
                
                const newStatus = {
                    status: RENTAL_TRIP_STATUS.COMPLETED,
                    timestamp: new Date(),
                    user_type: user_type,
                    username: detail.first_name + " " + detail.last_name,
                    user_id: detail._id
                };
                trip_status.push(newStatus);
                trip_detail.trip_status = trip_status;

                trip_detail.save().then(async() => {
                    await utils.driver_non_availability_for_trip(trip_detail, trip_detail.vehicle_id);
                    await Car_Rent_Vehicle.updateOne(
                        { _id: trip_detail.vehicle_id },
                        { $inc: { completed_request: 1 } }
                    );
                    await User.updateOne(
                        { _id: trip_detail.user_id },
                        { $inc: { rental_completed_request: 1 } }
                    );
                    await Provider.updateOne(
                        { _id: trip_detail.provider_id },
                        { $inc: { rental_completed_request: 1 } }
                    );
                    if(provider_detail){
                        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_PAID_ADDITIONAL_PAYMETN_SUCCESSFULLY, "", provider_detail.webpush_config, provider_detail.lang_code);
                    }
                    return res.json({ success: true, message: success_messages.MESSAGE_CODE_PAYMENT_PAID_SUCCESSFULLY });
                });
            }

        })
    } else {
        console.log("5587");
        Trip.findOne({ _id: req.body.trip_id }).then(async (trip) => {
            Trip_history.findOne({ _id: req.body.trip_id }).then(async (trip_history) => {
                if (!trip) {
                    trip = trip_history;
                }
                if (trip) {
                    let is_main_user = true;
                    let split_payment_index = null;
                    trip.split_payment_users.forEach((split_payment_user_detail, index) => {
                        if (split_payment_user_detail.user_id.toString() == req.body.user_id.toString()) {
                            is_main_user = false;
                            split_payment_index = index;
                        }
                    })
                    if (!trip.payment_gateway_type || trip.payment_gateway_type == PAYMENT_GATEWAY.stripe || req.body?.is_apple_pay) {
    
                        let payment_intent_id = trip.payment_intent_id;
                        if (!is_main_user) {
                            payment_intent_id = trip.split_payment_users[split_payment_index].payment_intent_id;
                        }
                            let url = setting_detail.payments_base_url + "/retrieve_payment_intent"
                            let data = {
                                payment_intent_id: payment_intent_id
                            }
                            const request = require('request');
                            request.post(
                            {
                                url: url,
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(data),
                            }, async (error, response, body) => {
                                if (error) {
                                    console.error(error);
                                    return error
                                } else {
                                    body = JSON.parse(body);
                                    let intent = body.intent;
    
                                    if (intent && intent.charges && intent.charges.data && intent.charges.data.length > 0) {
                                        if (is_main_user) {
                                            trip.payment_status = PAYMENT_STATUS.COMPLETED;
                                            trip.remaining_payment = 0;
                                            trip.card_payment = intent.charges.data[0].amount / 100;
                                        } else {
                                            trip.split_payment_users[split_payment_index].card_payment = intent.charges.data[0].amount / 100;
                                            trip.split_payment_users[split_payment_index].remaining_payment = 0;
                                            trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                            trip.card_payment = trip.card_payment + (intent.charges.data[0].amount / 100);
                                        }
            
                                        if (trip.is_trip_cancelled == 1) {
                                            User.findOne({ _id: trip.user_id }).then((user) => {
                                                user.current_trip_id = null;
                                                user.save();
                                            });
                                        }
                                        // start provider profit after card payment done
                                        await utils.trip_provider_profit_card_wallet_settlement(trip);
                                        // end of provider profit after card payment done
            
            
                                        trip.markModified('split_payment_users');
                                        trip.save().then(() => {
                                            utils.update_request_status_socket(trip._id);
                                            if (is_main_user) {
                                                User.findOne({ _id: trip.user_id }, function (error, user) {
                                                    user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                                    user.save();
                                                })
                                            }
                                            Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                                if (deleted_trip) {
                                                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                    trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                                    trip_history_data.save(function () {
                                                        res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                                    });
                                                } else {
                                                    res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                                }
                                            });
                                        });
                                    } else {
                                        res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING })
                                    }
                                    
                                }
                            })
                    } else if( trip.payment_gateway_type == PAYMENT_GATEWAY.payu) {
                        if (is_main_user) {
                            trip.payment_status = PAYMENT_STATUS.COMPLETED;
                            trip.card_payment = trip.remaining_payment;
                            trip.remaining_payment = 0;
                            trip.payment_intent_id = req.body.mihpayid;
                        } else {
                            trip.split_payment_users[split_payment_index].card_payment = trip.split_payment_users[split_payment_index].remaining_payment;
                            trip.card_payment = trip.card_payment + trip.split_payment_users[split_payment_index].remaining_payment;
                            trip.split_payment_users[split_payment_index].remaining_payment = 0;
                            trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                            trip.split_payment_users[split_payment_index].payment_intent_id = req.body.mihpayid;
                        }
    
                        if (trip.is_trip_cancelled == 1) {
                            User.findOne({ _id: trip.user_id }).then((user) => {
                                user.current_trip_id = null;
                                user.save();
                            });
                        }
    
                        // start provider profit after card payment done
                        await utils.trip_provider_profit_card_wallet_settlement(trip);
                        // end of provider profit after card payment done
    
                        trip.markModified('split_payment_users');
                        trip.save().then(() => {
                            utils.update_request_status_socket(trip._id);
                            if (is_main_user) {
                                User.findOne({ _id: trip.user_id }, function (error, user) {
                                    user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                    user.save();
                                })
                            }
                            Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                if (deleted_trip) {
                                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                    trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                    trip_history_data.save(function () {
                                        if (req.body.udf4) {
                                            if (req.body.udf4 === "/payments") {
                                                return res.redirect(setting_detail.payments_base_url + "/success_payment_payu");
                                            } else {
                                                return res.redirect(req.body.udf4);
                                            }
                                        } else {
                                            return res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                        }
                                    });
                                } else {
                                    if (req.body.udf4) {
                                        if (req.body.udf4 === "/payments") {
                                            return res.redirect(setting_detail.payments_base_url + "/success_payment_payu");
                                        } else {
                                            return res.redirect(req.body.udf4);
                                        }
                                    } else {
                                        return res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                    }
                                }
                            });
                        });
                    } else if( trip.payment_gateway_type == PAYMENT_GATEWAY.razorpay){
                        const key_secret = setting_detail.razorpay_secret_key
                        const crypto = require("crypto");
                        const generated_signature = crypto.createHmac("SHA256",key_secret).update(req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id).digest("hex");
                        let is_signature_valid = generated_signature == req.body.razorpay_signature;
                        console.log(generated_signature);
                        console.log(req.body.razorpay_signature);
                        if(is_signature_valid){
                            if (is_main_user) {
                                trip.payment_status = PAYMENT_STATUS.COMPLETED;
                                trip.card_payment = trip.remaining_payment;
                                trip.remaining_payment = 0;
                                trip.payment_intent_id = req.body.razorpay_payment_id;
                            } else {
                                trip.split_payment_users[split_payment_index].card_payment = trip.split_payment_users[split_payment_index].remaining_payment;
                                trip.card_payment = trip.card_payment + trip.split_payment_users[split_payment_index].remaining_payment;
                                trip.split_payment_users[split_payment_index].remaining_payment = 0;
                                trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                trip.split_payment_users[split_payment_index].payment_intent_id = req.body.razorpay_payment_id;
                            }
                            if (trip.is_trip_cancelled == 1) {
                                User.findOne({ _id: trip.user_id }).then((user) => {
                                    user.current_trip_id = null;
                                    user.save();
                                });
                            }
        
                            // start provider profit after card payment done
                            await utils.trip_provider_profit_card_wallet_settlement(trip);
                            // end of provider profit after card payment done
                            trip.markModified('split_payment_users');
                            trip.save().then(() => {
                                utils.update_request_status_socket(trip._id);
                                if (is_main_user) {
                                    User.findOne({ _id: trip.user_id }, function (error, user) {
                                        user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                        user.save();
                                    })
                                }
                                Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                    if (deleted_trip) {
                                        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                        trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                        trip_history_data.save(function () {
                                            if (req.query?.is_new) {
                                                return res.redirect(req.query.is_new);
                                            } else {
                                                return res.redirect(setting_detail.payments_base_url + '/success_payment_razor');
                                            }
                                        });
                                    } else {
                                        if (req.query?.is_new) {
                                            return res.redirect(req.query.is_new);
                                        } else {
                                            return res.redirect(setting_detail.payments_base_url + '/success_payment_razor');
                                        }
                                    }
                                });
                            });
                        }else{
                            if (req.query?.is_new) {
                                utils.payu_status_fail_socket(trip.user_id)
                                return res.redirect(req.query?.is_new);
                            } else {
                                utils.payu_status_fail_socket(trip.user_id)
                                return res.redirect(setting_detail.payments_base_url + '/fail_payment');
                            }
                        }
                        
                    } else if( trip.payment_gateway_type == PAYMENT_GATEWAY.paytabs){
                            if (is_main_user) {
                                trip.payment_status = PAYMENT_STATUS.COMPLETED;
                                trip.card_payment = trip.remaining_payment;
                                trip.remaining_payment = 0;
                                trip.payment_intent_id = req.query.payment_intent_id;
                            } else {
                                trip.split_payment_users[split_payment_index].card_payment = trip.split_payment_users[split_payment_index].remaining_payment;
                                trip.card_payment = trip.card_payment + trip.split_payment_users[split_payment_index].remaining_payment;
                                trip.split_payment_users[split_payment_index].remaining_payment = 0;
                                trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                                trip.split_payment_users[split_payment_index].payment_intent_id = req.query.payment_intent_id;
                            }
                            if (trip.is_trip_cancelled == 1) {
                                User.findOne({ _id: trip.user_id }).then((user) => {
                                    user.current_trip_id = null;
                                    user.save();
                                });
                            }
    
                            // start provider profit after card payment done
                            await utils.trip_provider_profit_card_wallet_settlement(trip);
                            // end of provider profit after card payment done
    
                            trip.markModified('split_payment_users');
                            trip.save().then(() => {
                                utils.update_request_status_socket(trip._id);
                                if (is_main_user) {
                                    User.findOne({ _id: trip.user_id }, function (error, user) {
                                        user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                        user.save();
                                    })
                                }
                                Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                    if (deleted_trip) {
                                        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                        trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                        trip_history_data.save(function () {
                                            if (req.query.is_new != 'undefined') {
                                                return res.redirect(req.query.is_new);
                                            } else {
                                                return res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                            }
                                        });
                                    } else {
                                        if (req.query.is_new != 'undefined') {
                                            return res.redirect(req.query.is_new);
                                        } else {
                                            return res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                        }
                                    }
                                });
                            });
                    } else if( trip.payment_gateway_type == PAYMENT_GATEWAY.paypal){
                        if (is_main_user) {
                            trip.payment_status = PAYMENT_STATUS.COMPLETED;
                            trip.card_payment = trip.remaining_payment;
                            trip.remaining_payment = 0;
                            trip.payment_intent_id = req.body.is_web ? (req.body?.payment_intent_id?.purchase_units[0]?.payments?.captures[0]?.id) : req.body?.payment_intent_id;
                        } else {
                            trip.split_payment_users[split_payment_index].card_payment = trip.split_payment_users[split_payment_index].remaining_payment;
                            trip.card_payment = trip.card_payment + trip.split_payment_users[split_payment_index].remaining_payment;
                            trip.split_payment_users[split_payment_index].remaining_payment = 0;
                            trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                            trip.split_payment_users[split_payment_index].payment_intent_id = req.body.is_web ? (req.body?.payment_intent_id?.purchase_units[0]?.payments?.captures[0]?.id) : req.body?.payment_intent_id;
                        }
                        if (trip.is_trip_cancelled == 1) {
                            User.findOne({ _id: trip.user_id }).then((user) => {
                                user.current_trip_id = null;
                                user.save();
                            });
                        }
                        await utils.trip_provider_profit_card_wallet_settlement(trip);
                            // end of provider profit after card payment done
    
                            trip.markModified('split_payment_users');
                            trip.save().then(() => {
                                utils.update_request_status_socket(trip._id);
                                if (is_main_user) {
                                    User.findOne({ _id: trip.user_id }, function (error, user) {
                                        user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                        user.save();
                                    })
                                }
                                Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                    if (deleted_trip) {
                                        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                        trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                        trip_history_data.save(function () {
                                                res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                        });
                                    } else {
                                            res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                    }
                                });
                            });
                    }
    
                } else {
                    console.log(trip);
                    res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
                }
            });
        });
    }

}

exports.fail_stripe_intent_payment = async function (req, res) {
    console.log("fail_stripe_intent_payment");
    console.log(req.query);
    console.log(req.body);

    const setting_detail = await Settings.findOne({});
    // for rental trip PayU payment
    if(req.body?.udf1 == "12"){
        let payu_res = req.body?.udf5 || "";
        const input = payu_res;
        const resultArray = input.split("/");
        req.body.udf5 = resultArray[0] || "";
        req.body.is_rental_trip_payment = resultArray[1] || false;
        req.body.is_rental_trip_additional_payment = resultArray[2] || false;
    }
    let trip_id;
    if(req.query.url){
        trip_id = req.query.url
    }else{
        trip_id = req.body.trip_id
    }
    if (req.body.txnid) {
        trip_id = req.body.txnid;
    }

    if(req.body?.is_rental_trip_payment || req.body?.is_rental_trip_additional_payment){
        Rental_Trip.findOne({_id: trip_id, $or: [{ payment_status: PAYMENT_STATUS.WAITING }, { payment_status: PAYMENT_STATUS.FAILED }]}).then((trip) => {
            if(!trip){
                return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
            }
            if(req.body?.is_rental_trip_payment){
                trip.payment_status = PAYMENT_STATUS.FAILED;
                trip.save().then(() => {
                    if (req.body.udf4) {
                        if (req.body.udf4 === "/payments") {
                            return res.redirect(setting_detail.payments_base_url + "/fail_payment");
                        } else {
                            return res.redirect(req.body.udf4);
                        }
                    } else {
                        return res.json({ success: false, error_code: error_message.ERROR_CODE_PAYMENT_FAILED });
                    }
                }, (error) => {
                    console.log(error)
                });
            } else {
                if (req.body.udf4) {
                    if (req.body.udf4 === "/payments") {
                        return res.redirect(setting_detail.payments_base_url + "/fail_payment");
                    } else {
                        return res.redirect(req.body.udf4);
                    }
                } else {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_PAYMENT_FAILED });
                }
            }
        })
    } else {
        Trip.findOne({ _id: trip_id, $or: [{ payment_status: PAYMENT_STATUS.WAITING }, { payment_status: PAYMENT_STATUS.FAILED }] }).then((trip) => {
          Trip_history.findOne({ _id: trip_id, $or: [{ payment_status: PAYMENT_STATUS.WAITING }, { payment_status: PAYMENT_STATUS.FAILED }] }).then(async (trip_history) => {
            if (!trip) {
                trip = trip_history;
            }
            if (trip) {
                Corporate.findOne({ _id: trip.user_type_id }).then((corporate) => {
                    if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE && corporate) {
                        let wallet_payment = trip.remaining_payment;
                        let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, corporate.unique_id, corporate._id, null,
                            corporate.wallet_currency_code, trip.currencycode,
                            trip.wallet_current_rate, wallet_payment, corporate.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                        corporate.wallet = total_wallet_amount;
                        corporate.save();
    
                        utils.update_request_status_socket(trip._id);
                        trip.payment_status = PAYMENT_STATUS.COMPLETED;
                        trip.remaining_payment = 0;
                        trip.wallet_payment = wallet_payment;
    
                        if (trip.is_trip_cancelled == 1) {
                            User.findOne({ _id: trip.user_id }).then((user) => {
                                user.current_trip_id = null;
                                user.save();
                            });
                        }
                        trip.save().then(() => {
                            User.findOne({ _id: trip.user_id }, function (error, user) {
                                user.corporate_wallet_limit = user.corporate_wallet_limit - trip.card_payment;
                                user.save();
                            })
                            Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                                if (deleted_trip) {
                                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                    trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                    trip_history_data.save(function () {
                                        res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                    });
                                } else {
                                    res.json({ success: true, message: success_messages.PAYMENT_PAID_SUCCESSFULLY });
                                }
                            });
                        });
    
                    } else {
                        if (trip.payment_gateway_type != PAYMENT_GATEWAY.payu) {
                            utils.update_request_status_socket(trip._id);
                        }
    
                        trip.payment_status = PAYMENT_STATUS.FAILED;
                        trip.save().then(() => {
                            if (req.body.udf4) {
                                if (req.body.udf4 === "/payments") {
                                    return res.redirect(setting_detail.payments_base_url + "/fail_payment");
                                } else {
                                    return res.redirect(req.body.udf4);
                                }
                            } else {
                                return res.json({ success: false, error_code: error_message.ERROR_CODE_PAYMENT_FAILED });
                            }
                        }, (error) => {
                            console.log(error)
                        });
                    }
                });
    
            } else {
                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
            }
        })
        });
    }

}

///////////////////GETTRIP STATUS PROVIDER SIDE //////
exports.providergettripstatus = function (req, res) {

    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }], function (response) {
        if (response.success) {
            let provider_id = req.body.provider_id;
            let token = req.body.token;
            let country_phone_code = "";
            let phone = "";
            if (provider_id != undefined && token != undefined) {
                Provider.findOne({ _id: req.body.provider_id }).then(async (provider) => {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        if ((provider.is_trip.length > 0 && provider.is_trip.includes(req.body.trip_id)) || (provider.schedule_trip.length > 0 && provider.schedule_trip.includes(req.body.trip_id)) || (provider.open_ride.length > 0 && provider.open_ride.includes(req.body.trip_id))) {
                            const country = await Country.findById(provider.country_id)
                            if(!country){
                                res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND });
                            }
                            
                            Trip.findOne({
                                _id: req.body.trip_id,
                                $or: [{ current_providers: provider._id },
                                { confirmed_provider: provider._id }],

                                is_trip_cancelled: 0,
                                is_trip_cancelled_by_provider: 0
                            }).then((trip) => {

                                Trip_history.findOne({
                                    _id: req.body.trip_id,
                                    $or: [{ current_providers: provider._id },
                                    { confirmed_provider: provider._id }],

                                    is_trip_cancelled: 0,
                                    is_trip_cancelled_by_provider: 0
                                }).then(async (trip_history) => {
                                    if (!trip) {
                                        trip = trip_history;
                                    }
                                    let openride
                                    if(!trip){
                                        openride = await OpenRide.findOne({
                                            _id: req.body.trip_id,
                                            $or: [{ current_providers: provider._id },
                                            { confirmed_provider: provider._id }],

                                            is_trip_cancelled: 0,
                                            is_trip_cancelled_by_provider: 0
                                        })

                                        trip = openride;
                                    }

                                    if (trip) {
                                        Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
                                            let userid
                                            if (trip.openride) {
                                                const filteredObjects = trip.user_details.filter(item => 
                                                    item.status == 0 && item.send_req_to_provider_first_time == 1 
                                                );
                                                if (filteredObjects.length != 0) {
                                                    userid = filteredObjects[0].user_id
                                                }
                                                
                                            } else {
                                                userid = trip.user_id
                                            }
                                                                    if (tripservice) {
                                                User.findOne({ _id: userid }).then((user) => {

                                                    if (user) {
                                                        country_phone_code = user.country_phone_code;
                                                        phone = user.phone;
                                                    }

                                                    Citytype.findById(trip.service_type_id).then((citytype_detail) => {
                                                        Type.findById(citytype_detail.typeid).then((type_detail) => {
                                                            let waiting_time_start_after_minute = 0;
                                                            let price_for_waiting_time = 0;
                                                            let total_wait_time = 0;
                                                            let provider_arrived_time = trip.provider_arrived_time;
                                                            if (provider_arrived_time != null) {
                                                                let end_time = new Date();
                                                                waiting_time_start_after_minute = tripservice.waiting_time_start_after_minute;
                                                                price_for_waiting_time = tripservice.price_for_waiting_time;
                                                                total_wait_time = utils.getTimeDifferenceInSecond(end_time, provider_arrived_time);
                                                                total_wait_time = total_wait_time - waiting_time_start_after_minute * 60;
                                                            }
                                                            if (trip.is_provider_status == PROVIDER_STATUS.TRIP_STARTED) {
                                                                let now = new Date();
                                                                let minutes = utils.getTimeDifferenceInMinute(now, trip.provider_trip_start_time);
                                                                trip.total_time = minutes;
                                                                trip.save();
                                                            }
                                                            if (!trip.openride) {
                                                                let index = user.favourite_providers.findIndex((x) => (x).toString() == (req.body.provider_id).toString())
    
                                                                if (index !== -1) {
                                                                    trip.is_favourite_provider = true;
                                                                }
                                                            }

                                                            
                                                            let trip_to_send = JSON.parse(JSON.stringify(trip))
                                                            trip_to_send['driver_max_bidding_limit'] = country?.driver_max_bidding_limit
                                                            
                                                            res.json({
                                                                success: true,
                                                                map_pin_image_url: type_detail.map_pin_image_url,
                                                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_GET_TRIP_STATUS_SUCCESSFULLY,
                                                                country_phone_code: country_phone_code,
                                                                phone: phone,
                                                                trip: trip_to_send,
                                                                user: user,
                                                                tripservice: tripservice,
                                                                waiting_time_start_after_minute: waiting_time_start_after_minute,
                                                                price_for_waiting_time: price_for_waiting_time,
                                                                total_wait_time: total_wait_time,
                                                                driver_max_bidding_limit: country?.driver_max_bidding_limit,
                                                                openride: trip_to_send?.openride
                                                            });
                                                        });
                                                    });
                                                });
                                            } else {
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_NOT_GET_TRIP_STATUS
                                                });
                                            }
                                        });
                                    } else {
                                        Trip.findOne({
                                            _id: req.body.trip_id,
                                            is_trip_cancelled_by_user: 1,
                                            is_trip_cancelled: 1
                                        }).then(async (cancel_trip) => {
                                            if (!cancel_trip) {
                                                openride = await OpenRide.findOne({
                                                    _id: req.body.trip_id,
                                                    is_trip_cancelled_by_user: 1,
                                                    is_trip_cancelled: 1
                                                })
                                                cancel_trip = openride;
                                            }

                                            if (cancel_trip) {
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_TRIP_CANCELLED_BY_USER
                                                });
                                            } else {

                                                provider = utils.remove_is_trip_from_provider(provider, req.body.trip_id)
                                                if (!provider.is_near_trip) { provider.is_near_trip = [] }
                                                if ((String(provider.is_near_trip[0]) == String(req.body.trip_id))) {
                                                    provider.is_near_available = 1;
                                                    provider.is_near_trip = [];
                                                }
                                                await Provider.updateOne({ _id: provider._id }, provider.getChanges())

                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_NOT_GET_TRIP_STATUS
                                                });
                                            }

                                        });
                                    }
                                });
                            }, (err) => {
                                console.log(err);
                                res.json({
                                    success: false,
                                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                });
                            });

                        } else {
                            res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_GET_TRIP_STATUS });

                        }

                    }
                }, (err) => {
                    console.log(err);
                    res.json({
                        success: false,
                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                    });
                });


            } else {

                Trip.findOne({
                    _id: req.body.trip_id,
                    is_trip_cancelled: 0,
                    is_trip_cancelled_by_provider: 0
                }).then((trip) => {

                    if (trip) {

                        Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {

                            if (tripservice) {
                                User.findOne({ _id: trip.user_id }).then(async(user) => {

                                    if (user) {
                                        country_phone_code = user.country_phone_code;
                                        phone = user.phone;
                                    }
                                    const country = await Country.findOne({"countryname":user.country})
                                    if(!country){
                                        res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND });
                                    }
                                    Citytype.findById(trip.service_type_id).then((citytype_detail) => {
                                        Type.findById(citytype_detail.typeid).then((type_detail) => {
                                            let waiting_time_start_after_minute = 0;
                                            let price_for_waiting_time = 0;
                                            let total_wait_time = 0;
                                            let provider_arrived_time = trip.provider_arrived_time;
                                            if (provider_arrived_time != null) {
                                                let end_time = new Date();
                                                waiting_time_start_after_minute = tripservice.waiting_time_start_after_minute;
                                                price_for_waiting_time = tripservice.price_for_waiting_time;
                                                total_wait_time = utils.getTimeDifferenceInSecond(end_time, provider_arrived_time);
                                                total_wait_time = total_wait_time - waiting_time_start_after_minute * 60;
                                            }

                                            let trip_to_send = JSON.parse(JSON.stringify(trip))
                                            trip_to_send['driver_max_bidding_limit'] = country?.driver_max_bidding_limit

                                            res.json({
                                                success: true,
                                                country_phone_code: country_phone_code,
                                                phone: phone,
                                                map_pin_image_url: type_detail.map_pin_image_url,
                                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOU_GET_TRIP_STATUS_SUCCESSFULLY,
                                                trip: trip_to_send,
                                                user: user,
                                                waiting_time_start_after_minute: waiting_time_start_after_minute,
                                                price_for_waiting_time: price_for_waiting_time,
                                                total_wait_time: total_wait_time,
                                                driver_max_bidding_limit: country?.driver_max_bidding_limit
                                            });
                                        });
                                    });

                                });

                            } else {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_GET_TRIP_STATUS });
                            }
                        });
                    } else {

                        Trip.findOne({ _id: req.body.trip_id, is_trip_cancelled_by_user: 1 }).then((cancel_trip) => {

                            if (cancel_trip) {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_CANCELLED_BY_USER });
                            } else {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_NOT_GET_TRIP_STATUS });
                            }

                        });
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
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

//////////////////// user_history //////////////////////
exports.user_history = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user.token != req.body.token) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                } else {
                    let lookup1 = {
                        $lookup:
                        {
                            from: "providers",
                            localField: "confirmed_provider",
                            foreignField: "_id",
                            as: "provider_detail"
                        }
                    };
                    let unwind1 = {
                        $unwind: {
                            path: "$provider_detail",
                            preserveNullAndEmptyArrays: true
                        }
                    };

                    let lookup2 = {
                        $lookup:
                        {
                            from: "trip_services",
                            localField: "trip_service_city_type_id",
                            foreignField: "_id",
                            as: "service_type"
                        }
                    };
                    let unwind2 = { $unwind: "$service_type" };

                    let condition = { $match: { 'user_id': { $eq: Schema(req.body.user_id) } } };
                    let condition1 = { $match: { $or: [{ is_trip_cancelled: { $eq: 1 } }, { is_trip_end: { $eq: 1 } }, { is_trip_cancelled_by_user: { $eq: 1 } }, { is_trip_cancelled_by_provider: { $eq: 1 } }] } };

                    let group = {
                        $project: {
                            trip_id: '$_id', unique_id: 1, invoice_number: 1,
                            current_provider: 1, provider_service_fees: 1,
                            is_trip_cancelled_by_user: 1,
                            is_trip_completed: 1,
                            is_trip_cancelled: 1,
                            is_user_rated: 1,
                            is_provider_rated: 1,
                            is_trip_cancelled_by_provider: 1,
                            first_name: '$provider_detail.first_name',
                            last_name: '$provider_detail.last_name',
                            picture: '$provider_detail.picture',
                            total: 1,
                            unit: 1,
                            currency: 1,
                            currencycode: 1,
                            total_time: 1,
                            user_create_time: 1,
                            total_distance: 1,
                            source_address: 1,
                            destination_address: 1,
                            destination_addresses: 1,
                            provider_trip_end_time: 1,
                            timezone: 1,
                            created_at: 1,
                            cash_payment: 1,
                            card_payment: 1,
                            wallet_payment: 1,
                            service_type: 1,
                            payment_mode: 1
                        }
                    };

                    let search_item;
                    let search_value;
                    let sort_order;
                    let sort_field;
                    let value

                    if (req.body.search_item == undefined) {
                        search_item = 'unique_id';
                        search_value = '';
                        sort_order = -1;
                        sort_field = 'unique_id';
                    } else {
                        value = req.body.search_value;
                        value = value.trim();
                        value = value.replace(/ +(?= )/g, '');
                        value = new RegExp(value, 'i');
                        sort_order = req.body.sort_item[1];
                        sort_field = req.body.sort_item[0];
                        search_item = req.body.search_item
                        search_value = req.body.search_value;
                    }

                    value = search_value;
                    value = value.trim();
                    value = value.replace(/ +(?= )/g, '');
                    let query1 = {};
                    let query2 = {};
                    let query3 = {};
                    let query4 = {};
                    let query5 = {};
                    let query6 = {};
                    let search;
                    if (search_item == "unique_id") {

                        query1 = {};
                        if (value != "") {
                            value = Number(value)
                            query1[search_item] = { $eq: value };
                            search = { "$match": query1 };
                        }
                        else {
                            search = { $match: {} };
                        }
                    } else if (search_item == "first_name") {
                        query1 = {};
                        query2 = {};
                        query3 = {};
                        query4 = {};
                        query5 = {};
                        query6 = {};

                        let full_name = value.split(' ');
                        console.log(full_name)
                        if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                            query1['first_name'] = { $regex: new RegExp(full_name[0], 'i') };
                            query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            search = { "$match": { $or: [query1, query2] } };
                            console.log(query1)
                        } else {
                            query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                            query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                            query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                            query4['last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                            query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                            query6['last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                            search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
                        }
                    } else {
                        search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
                    }


                    let start_date = req.body.start_date;
                    let end_date = req.body.end_date;
                    if (end_date == '' || end_date == undefined) {
                        end_date = new Date();
                    } else {
                        end_date = new Date(end_date);
                        end_date = end_date.setHours(23, 59, 59, 999);
                        end_date = new Date(end_date);
                    }

                    if (start_date == '' || start_date == undefined) {
                        start_date = new Date(0);
                        start_date = start_date.setHours(0, 0, 0, 0);
                        start_date = new Date(start_date);
                    } else {
                        start_date = new Date(start_date);
                        start_date = start_date.setHours(0, 0, 0, 0);
                        start_date = new Date(start_date);
                    }
                    query1['created_at'] = { $gte: start_date, $lt: end_date };
                    let filter = { "$match": query1 };

                    let number_of_rec = 10;
                    let skip = {};
                    let page = req.body.page
                    skip["$skip"] = (page - 1) * number_of_rec;

                    let limit = {};
                    limit["$limit"] = number_of_rec;

                    let sort = { "$sort": {} };
                    sort["$sort"][sort_field] = parseInt(sort_order);


                    Trip_history.aggregate([condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search]).then((array) => {
                        let total_page = Math.ceil(array.length / 10)
                        if (req.body.page) {
                            Trip_history.aggregate([condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search, sort, skip, limit]).then((array_list) => {
                                res.json({ success: true, trips: array_list, pages: total_page });
                            });
                        } else {
                            Trip_history.aggregate([condition, condition1, lookup1, unwind1, lookup2, unwind2, group, filter, search, sort]).then((array_list) => {
                                res.json({ success: true, trips: array_list, pages: total_page });
                            });
                        }
                    }, (err) => {
                        console.log(err);
                        res.json({
                            success: false,
                            error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                        });
                    });
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
}


    /////////////////////// provider_history ///////////////////////////////////
    exports.provider_history = function (req, res) {
        utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }], async function (response) {
            if (!response.success) {
                return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
            }

            let provider = await Provider.findOne({ _id: req.body.provider_id })
            if (!provider) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            }

            if (provider.token != req.body.token) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            }
            let lookup1 = {
                $lookup:
                {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user_detail"
                }
            };
            let unwind1 = { $unwind: "$user_detail" };

            let condition = { $match: { 'confirmed_provider': { $eq: Schema(req.body.provider_id) } } };

            let group = {
                $project: {
                    trip_id: '$_id', unique_id: 1, invoice_number: 1,
                    current_provider: 1,
                    is_trip_cancelled_by_user: 1,
                    is_trip_cancelled: 1,
                    is_user_rated: 1,
                    is_trip_completed: 1,
                    is_provider_rated: 1,
                    is_trip_cancelled_by_provider: 1,
                    first_name: '$user_detail.first_name',
                    last_name: '$user_detail.last_name',
                    picture: '$user_detail.picture',
                    total: 1,
                    unit: 1,
                    currency: 1,
                    currencycode: 1,
                    total_time: 1,
                    user_create_time: 1,
                    total_distance: 1,
                    source_address: 1,
                    destination_address: 1,
                    destination_addresses: 1,
                    provider_trip_end_time: 1,
                    timezone: 1,
                    created_at: 1,
                    payment_mode: 1,
                    payment_status: 1,

                    sourceLocation: 1,
                    destinationLocation: 1,
                    // for invoice price details
                    base_distance_cost: 1,
                    distance_cost: 1,
                    time_cost: 1,
                    total_waiting_time: 1,
                    surge_fee: 1,
                    tax_fee: 1,
                    total_service_fees: 1,
                    user_tax_fee: 1,
                    user_miscellaneous_fee: 1,
                    tip_amount: 1,
                    toll_amount: 1,
                    promo_payment: 1,
                    wallet_payment: 1,
                    card_payment: 1,
                    cash_payment: 1,
                    remaining_payment: 1,
                    provider_profit_fees: 1,
                    provider_miscellaneous_fee: 1,
                    provider_service_fees: 1,
                    provider_tax_fee: 1,
                    fixed_price: 1,
                    total_after_surge_fees: 1,
                    total_after_tax_fees: 1,
                    provider_arrived_time: 1,
                    provider_trip_start_time: 1,
                    waiting_time_cost: 1,
                    is_trip_end: 1,
                    trip_type : 1,
                    is_fixed_fare : 1,
                    is_min_fare_used :1,
                    split_payment_users : 1

                }
            };

            // pangination and filter
            let search_item;
            let search_value;
            let sort_order;
            let sort_field;
            let value;
            if (req.body.search_item == undefined) {
                search_item = 'unique_id';
                search_value = '';
                sort_order = -1;
                sort_field = 'unique_id';
            } else {
                value = req.body.search_value;
                value = value.trim();
                value = value.replace(/ +(?= )/g, '');
                value = new RegExp(value, 'i');
                sort_order = req.body.sort_item[1];
                sort_field = req.body.sort_item[0];
                search_item = req.body.search_item
                search_value = req.body.search_value;
            }

            value = search_value;
            value = value.trim();
            value = value.replace(/ +(?= )/g, '');
            let query1 = {};
            let query2 = {};
            let query3 = {};
            let query4 = {};
            let query5 = {};
            let query6 = {};
            let search;
            if (search_item == "unique_id") {

                query1 = {};
                if (value != "") {
                    value = Number(value)
                    query1[search_item] = { $eq: value };
                    search = { "$match": query1 };
                }
                else {
                    search = { $match: {} };
                }
            } else if (search_item == "first_name") {
                query1 = {};
                query2 = {};
                query3 = {};
                query4 = {};
                query5 = {};
                query6 = {};

                let full_name = value.split(' ');
                if (typeof full_name[0] == 'undefined' || typeof full_name[1] == 'undefined') {
                    query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                    query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                    search = { "$match": { $or: [query1, query2] } };
                } else {
                    query1[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                    query2['last_name'] = { $regex: new RegExp(full_name[1], 'i') };
                    query3[search_item] = { $regex: new RegExp(full_name[0], 'i') };
                    query4['last_name'] = { $regex: new RegExp(full_name[0], 'i') };
                    query5[search_item] = { $regex: new RegExp(full_name[1], 'i') };
                    query6['last_name'] = { $regex: new RegExp(full_name[1], 'i') };

                    search = { "$match": { $or: [query1, query2, query3, query4, query5, query6] } };
                }
            } else {
                search = { "$match": { search_item: { $regex: new RegExp(value, 'i') } } };
            }

            let start_date = req.body.start_date;
            let end_date = req.body.end_date;
            if (end_date == '' || end_date == undefined) {
                end_date = new Date();
            } else {
                end_date = new Date(end_date);
                end_date = end_date.setHours(23, 59, 59, 999);
                end_date = new Date(end_date);
            }

            if (start_date == '' || start_date == undefined) {
                start_date = new Date(0);
                start_date = start_date.setHours(0, 0, 0, 0);
                start_date = new Date(start_date);
            } else {
                start_date = new Date(start_date);
                start_date = start_date.setHours(0, 0, 0, 0);
                start_date = new Date(start_date);
            }
            query1['created_at'] = { $gte: start_date, $lt: end_date };
            let filter = { "$match": query1 };

            let number_of_rec = 10;
            let page = req.body.page || 1;
            let skip = {};
            skip["$skip"] = (page - 1) * number_of_rec;

            let limit = {};
            limit["$limit"] = number_of_rec;
            let sort = { "$sort": {} };
            sort["$sort"][sort_field] = parseInt(sort_order);
            /* Count Total Trips */
            let trips_total = await Trip_history.aggregate([condition, lookup1, unwind1, group, filter, search, sort]);
            let total_pages = Math.ceil(trips_total.length / number_of_rec)

            let trips = await Trip_history.aggregate([condition, lookup1, unwind1, group, filter, search, sort, skip, limit]);
            return res.json({ success: true, trips: trips, page: total_pages });
        })
    };


exports.provider_submit_invoice = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        Trip.findOne({ _id: req.body.trip_id, is_trip_end: 1 }).then((trip) => {
                            Trip_history.findOne({ _id: req.body.trip_id, is_trip_end: 1 }).then(async (trip_history) => {
                                if (!trip) {
                                    trip = trip_history;
                                }
                                if (!trip && ! trip_history) {
                                    trip = await OpenRide.findOne({ _id: req.body.trip_id, is_trip_end: 1  })
                                }
                                if (trip) {
                                    User.findOne({ _id: trip.user_id }).then((user) => {
                                        trip.is_trip_completed = 1;
                                        trip.is_provider_invoice_show = 1;
                                        trip.save(async function () {
                                            provider.completed_request = provider.completed_request + 1;
                                            provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
                                            await provider.save();

                                            Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
                                                let email_notification = setting_detail.email_notification;
                                                if (email_notification) {
                                                    allemails.sendProviderInvoiceEmail(req, provider, trip, tripservice, user);
                                                }
                                            })

                                            if (trip.trip_type == Number(constant_json.TRIP_TYPE_DISPATCHER) || trip.trip_type == Number(constant_json.TRIP_TYPE_HOTEL) || trip.trip_type == Number(constant_json.TRIP_TYPE_PROVIDER) || trip.trip_type == Number(constant_json.TRIP_TYPE_GUEST_TOKEN)) {
                                                user.current_trip_id = null;
                                                user.save();
                                            }
                                            if(!trip.openride){

                                                Trip.findOneAndRemove({ _id: req.body.trip_id }).then((deleted_trip) => {
                                                    if (deleted_trip) {
                                                        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                        trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                                        trip_history_data.save(function (error) {
                                                            console.log(error)
                                                            res.json({ success: true });
                                                        });
                                                    } else {
                                                        res.json({ success: true });
                                                    }
                                                }, (error) => {
                                                    console.log(error)
                                                });
                                            }else{
                                                res.json({ success: true });
                                            }
                                        });
                                    });
                                } else {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_IS_NOT_END });
                                }
                            });
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

exports.user_submit_invoice = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {
                    if (req.body.token != null && user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        Trip.findOne({ _id: req.body.trip_id, is_trip_end: 1}).then((trip) => {
                            Trip_history.findOne({ _id: req.body.trip_id, is_trip_end: 1}).then(async (trip_history) => {
                                if (!trip) {
                                    trip = trip_history;
                                }
                                if (!trip && ! trip_history) {
                                    trip = await OpenRide.findOne({ _id: req.body.trip_id })
                                }
                                if (trip) {
                                    let userdetails_index = -1 
                                    let trip_payment
                                    if (trip.openride) {
                                        userdetails_index = trip.user_details.findIndex(item => (item.user_id).toString() == (user._id).toString())
                                        trip_payment = trip.user_details[userdetails_index].payment_status
                                    } else {
                                        trip_payment = trip.payment_status
                                    }

                                    if(trip_payment == PAYMENT_STATUS.COMPLETED){
                                        if (trip.openride) {
                                            if (userdetails_index != -1) {
                                                trip.user_details[userdetails_index].is_user_invoice_show = 1
                                            }
                                        } else {
                                            trip.is_user_invoice_show = 1;   
                                        }
                                        trip.save(function () {
                                            Provider.findOne({ _id: trip.provider_id }).then((provider) => {
                                                Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
                                                    let email_notification = setting_detail.email_notification;
                                                    if (email_notification) {
                                                        allemails.sendUserInvoiceEmail(req, user, provider, trip, tripservice);
                                                    }
                                                })
                                            })
                                            
                                            user.completed_request = user.completed_request + 1;
                                            user.current_trip_id = null;
                                            user.save();
                                            if(!trip.openride){
                                                Trip.findOneAndRemove({ _id: req.body.trip_id }).then((deleted_trip) => {
                                                    if (deleted_trip) {
                                                        let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                                                        trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                                                        trip_history_data.save().then(() => {
                                                            res.json({ success: true });
                                                        }, (error) => {
                                                            console.log(error)
                                                        });
                                                    } else {
                                                        res.json({ success: true });
                                                    }
                                                }, (error) => {
                                                    console.log(error)
                                                });
                                            }else{
                                                res.json({ success: true });
                                            }
                                        });
                                    }else{
                                        res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_PAYMENT_IS_PENDING });
                                    }
                                   
                                } else {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_IS_NOT_END });
                                }
                            });
                        });
                    }

                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
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
////////////// PROVIDER RATING SERVICE  //////////////////////////

exports.provider_rating = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const setting_detail = await Settings.findOne({});
        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return
        }
        let trip = await Trip.findOneAndUpdate({ _id: req.body.trip_id, is_trip_end: 1 }, req.body, { new: true }) || await Trip_history.findOne({ _id: req.body.trip_id, is_trip_end: 1 })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
            return
        }

        if (trip.is_trip_end == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_IS_NOT_END });
            return
        }
        let user = await User.findOne({ _id: trip.user_id })


        let country = await Country.findOne({countryname:user.country})
        if(!country){
            res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND });
            return;
        }

        let rating = req.body.rating;
        let old_rate = user.rate;
        let old_rate_count = user.rate_count;
        let new_rate_counter = (old_rate_count + 1);
        let new_rate = ((old_rate * old_rate_count) + rating) / new_rate_counter;
        user.rate = new_rate;
        user.rate_count++;
        await User.updateOne({ _id: user._id }, user.getChanges())
        let review = await Reviews.findOne({ trip_id: trip._id })
        if (!review) {

            let reviews = new Reviews({
                trip_id: trip._id,
                trip_unique_id: trip.unique_id,
                userRating: 0,
                userReview: "",
                providerRating: rating,
                providerReview: req.body.review,
                provider_id: trip.confirmed_provider,
                user_id: trip.user_id,

                country_id: trip.country_id,
                city_id: trip.city_id,

            });
            await reviews.save();
        } else {
            review.providerRating = rating;
            review.providerReview = req.body.review;
            await Reviews.updateOne({ _id: review._id }, review.getChanges())
        }
    
        if(country?.user_redeem_settings[0]?.is_user_redeem_point_reward_on && (country?.user_redeem_settings[0]?.user_review_redeem_point > 0)){
            let total_redeem_point = utils.add_redeem_point_history(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id,country._id,constant_json.REVIEW_REDEEM_POINT,user.wallet_currency_code,`Get redeem point via reviews: ${trip.unique_id}`,country?.user_redeem_settings[0]?.user_review_redeem_point, user?.total_redeem_point,constant_json.ADD_REDEEM_POINT,trip.unique_id)
            user.total_redeem_point = total_redeem_point
            user.save()
        }
        await Trip_history.findByIdAndUpdate(trip._id,{is_user_rated:1},{new:true})
        // await Trip.updateOne({ _id: trip._id }, trip.getChanges())
        Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
            let email_notification = setting_detail.email_notification;
            if (email_notification) {
                allemails.sendUserInvoiceEmail(req, user, provider, trip, tripservice);
            }
        })
        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_GIVE_RATING_SUCCESSFULLY
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};
////////////////////// USER  RATING  SERVICE/////////////

exports.user_rating = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        const setting_detail = await Settings.findOne({});
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }

        let country = await Country.findOne({countryname:user.country})
        if(!country){
            res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }
        let trip = await Trip.findOneAndUpdate({ _id: req.body.trip_id, is_trip_end: 1 }, req.body, { new: true }) || await Trip_history.findOne({ _id: req.body.trip_id, is_trip_end: 1 }) ||  await OpenRide.findOneAndUpdate({ _id: req.body.trip_id, is_trip_end: 1 }, req.body, { new: true })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND })
            return
        }
        if (trip.is_trip_end == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_IS_NOT_END });
            return
        }
        let provider = await Provider.findOne({ _id: trip.confirmed_provider })
        let city = await City.findOne({_id: provider.cityid})
        let rating = req.body.rating;
        let old_rate = provider.rate;
        let old_rate_count = provider.rate_count;
        let new_rate_counter = (old_rate_count + 1);
        let new_rate = ((Number(old_rate) * Number(old_rate_count)) + Number(rating)) / Number(new_rate_counter);
        let is_user_invoice_show = trip.is_user_invoice_show;
        provider.rate = new_rate;
        provider.rate_count++;
        await Provider.updateOne({ _id: provider._id }, provider.getChanges())
        let partner;
        if (provider.provider_type_id != null && provider.provider_type == PROVIDER_TYPE.PARTNER) {
            partner = await Partner.findById(provider.provider_type_id)
            if (!partner) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_DETAIL_NOT_FOUND });
                return;
            }
        }
        let review = await Reviews.findOne({ trip_id: trip._id })

        if (!review) {
            let reviews = new Reviews({
                trip_id: trip._id,
                trip_unique_id: trip.unique_id,
                userRating: rating,
                userReview: req.body.review,
                providerRating: 0,
                providerReview: "",
                provider_id: trip.confirmed_provider,
                user_id: trip.user_id,
                country_id: trip.country_id,
                city_id: trip.city_id,
            });
            await reviews.save();
        } else {
            review.userRating = rating;
            review.userReview = req.body.review;
            await Reviews.updateOne({ _id: review._id }, review.getChanges())
        }
        myAnalytics.insert_daily_provider_analytics(city.timezone, trip.confirmed_provider, TRIP_STATUS.FOR_REDEEM_POINTS, null,country._id,rating);

        trip.is_provider_rated = 1;
        trip.is_user_invoice_show = 1;
        user.current_trip_id = null;

        if(country?.driver_redeem_settings[0]?.is_driver_redeem_point_reward_on && (country?.driver_redeem_settings[0]?.driver_review_redeem_point > 0)){
            if (provider.provider_type_id != null && provider.provider_type == PROVIDER_TYPE.PARTNER) {
                let total_redeem_point = utils.add_redeem_point_history(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id,country._id,constant_json.REVIEW_REDEEM_POINT,partner.wallet_currency_code,`Get redeem point via reviews: ${trip.unique_id}`,country?.driver_redeem_settings[0]?.driver_review_redeem_point, partner?.total_redeem_point,constant_json.ADD_REDEEM_POINT,trip.unique_id)
                partner.total_redeem_point = total_redeem_point
                partner.save()
            }else{
                let total_redeem_point = utils.add_redeem_point_history(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id,country._id,constant_json.REVIEW_REDEEM_POINT,provider.wallet_currency_code,`Get redeem point via reviews: ${trip.unique_id}`,country?.driver_redeem_settings[0]?.driver_review_redeem_point, provider?.total_redeem_point,constant_json.ADD_REDEEM_POINT,trip.unique_id)
                provider.total_redeem_point = total_redeem_point
                provider.save()
            }
        }
        
        let need_to_move_ride = false
        await User.updateOne({ _id: user._id }, user.getChanges())
        if(setting_detail.is_wsal_service_use && country.is_use_wsal){
            wsal_services.TripsUpdateService(trip._id, rating)
        }
        if (trip.openride) {
            await OpenRide.updateOne({ _id: trip._id }, trip.getChanges())
        } else {
            await Trip_history.updateOne({ _id: trip._id }, trip.getChanges())
            need_to_move_ride = true
        }

        Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
            let email_notification = setting_detail.email_notification;
            if (email_notification) {
                allemails.sendUserInvoiceEmail(req, user, provider, trip, tripservice);
            }
        })

        if (need_to_move_ride && is_user_invoice_show == 1) {
            res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_USER_GIVE_RATING_SUCCESSFULLY
            });
            return;
        }

        if (need_to_move_ride) {
            await utils.move_trip_to_completed(trip._id)
        }



        res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_USER_GIVE_RATING_SUCCESSFULLY
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }

}
/////////// USER TRIP DETAIL ///////////////////
exports.user_tripdetail = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((users) => {
                if(!users){
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND })
                    return
                }

                if (users.token != req.body.token) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                } else {
                    let Table 
                    let Table1
                    if (req.body.is_open_ride) {
                        Table = OpenRide
                        Table1 = OpenRide
                    } else {
                        Table = Trip
                        Table1 = Trip_history
                    }
                    Table.aggregate([
                        {$match:  {_id: mongoose.Types.ObjectId(req.body.trip_id)} },
                        {
                            $lookup: {
                                from: 'promo_codes',
                                localField: 'promo_id',
                                foreignField: '_id',
                                as: 'promo_detail'
                            }
                        },
                        {
                            $unwind: {
                            path: "$promo_detail",
                            preserveNullAndEmptyArrays: true
                            }
                        }
                    ]).then((trip) => {
                        Table1.aggregate([
                            {$match:  {_id: mongoose.Types.ObjectId(req.body.trip_id)} },
                            {
                                $lookup: {
                                    from: 'promo_codes',
                                    localField: 'promo_id',
                                    foreignField: '_id',
                                    as: 'promo_detail'
                                }
                            },
                            {
                                $unwind: {
                                path: "$promo_detail",
                                preserveNullAndEmptyArrays: true
                                }
                            }
                        ]).then((trip_history) => {
                            if (trip.length == 0) {
                                trip = trip_history
                            }
                            if (trip.length > 0) {
                                if (trip[0].is_trip_cancelled == 0 || trip[0].is_trip_cancelled_by_user == 0 || trip[0].is_trip_cancelled_by_provider == 0 || trip[0].is_trip_end == 1) {

                                    Trip_Service.findOne({ _id: trip[0].trip_service_city_type_id }).then((tripservice) => {
                                        if (tripservice) {
                                            TripLocation.findOne({ tripID: trip[0]._id }).then((tripLocation) => {

                                                Provider.findOne({ _id: trip[0].confirmed_provider }).then((provider) => {

                                                    res.json({
                                                        success: true,
                                                        message: success_messages.MESSAGE_CODE_HISTORY_DETAIL_GET_SUCCESSFULLY,
                                                        trip: trip[0],
                                                        tripservice: tripservice,
                                                        provider: provider,
                                                        startTripToEndTripLocations: tripLocation.startTripToEndTripLocations
                                                    });
                                                });
                                            });

                                        } else {
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_TRIP_SERVICE_NOT_FOUND
                                            });

                                        }
                                    });

                                } else {
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
                                    });

                                }
                            } else {

                                res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });


                            }
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });

                        });
                    });
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

///////// PROVIDER TRIP DETAIL  //////////////
exports.provider_tripdetail = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider.token != req.body.token) {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                } else {
                    Trip.findOne({ _id: req.body.trip_id }).then((trip) => {
                        Trip_history.findOne({ _id: req.body.trip_id }).then(async (trip_history) => {
                            if (!trip) {
                                trip = trip_history
                            }
                            if(!trip){
                                trip = await OpenRide.findOne({ _id: req.body.trip_id })
                            }
                            if (trip) {
                                if (trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_user == 0 && trip.is_trip_cancelled_by_provider == 0 && trip.is_trip_end == 1) {

                                    Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
                                        if (tripservice) {

                                            TripLocation.findOne({ tripID: trip._id }).then((tripLocation) => {


                                                User.findOne({ _id: trip.user_id }).then((user) => {

                                                    res.json({
                                                        success: true,
                                                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_DETAIL_GET_SUCCESSFULLY,
                                                        trip: trip,
                                                        tripservice: tripservice,
                                                        user: user,
                                                        startTripToEndTripLocations: tripLocation.startTripToEndTripLocations
                                                    });
                                                });
                                            });

                                        } else {
                                            res.json({
                                                success: false,
                                                error_code: error_message.ERROR_CODE_TRIP_SERVICE_NOT_FOUND
                                            });

                                        }
                                    });

                                } else {
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
                                    });

                                }
                            } else {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_DETAIL_NOT_FOUND });

                            }
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });
                    });
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

// user_invoice //
exports.user_invoice = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {
                    if (req.body.token != null && user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        Trip.findOne({ _id: req.body.trip_id }).then((trip) => {
                            Trip_history.findOne({ _id: req.body.trip_id }).then(async (trip_history) => {
                                if (!trip) {
                                    trip = trip_history;
                                }
                                if (!trip && ! trip_history) {
                                    trip = await OpenRide.findOne({ _id: req.body.trip_id })
                                }
                                if (trip) {
                                    if (trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_provider == 0) {
                                        let provider_details
                                        Provider.findOne({ _id: trip.provider_id }).then((provider) => {
                                            if(trip.openride){
                                                provider_details = {
                                                    first_name : trip.provider_details[0].first_name,
                                                    last_name : trip.provider_details[0].last_name,
                                                    picture : trip.provider_details[0].picture
                                                }
                                            }else{
                                                provider_details = {
                                                    first_name: provider.first_name,
                                                    last_name: provider.last_name,
                                                    picture: provider.picture
                                                }
                                            }
                                            

                                            Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {

                                                if (!tripservice) {
                                                    res.json({
                                                        success: false,
                                                        error_code: error_message.ERROR_CODE_TRIP_SERVICE_NOT_FOUND
                                                    });
                                                } else {
                                                    //Old Code;
                                                    // let email_notification = setting_detail.email_notification;
                                                    // if (email_notification) {
                                                    // }

                                                    res.json({
                                                        success: true,
                                                        message: success_messages.MESSAGE_CODE_GET_YOUR_INVOICE_SUCCESSFULLY,
                                                        trip: trip,
                                                        tripservice: tripservice,
                                                        provider_detail: provider_details
                                                    });
                                                }
                                            });
                                        });

                                    } else {
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
                                        });
                                    }
                                } else {

                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND
                                    });

                                }
                            });
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
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

// provider_invoice // 
exports.provider_invoice = async function (req, res) {
    utils.check_request_params(req.body, [{ name: 'provider_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            Provider.findOne({ _id: req.body.provider_id }).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                       
                        Trip.findOne({ _id: req.body.trip_id }).then((trip) => {
                            Trip_history.findOne({ _id: req.body.trip_id }).then(async (trip_history) => {
                                if (!trip) {
                                    trip = trip_history;
                                }
                                if (!trip && ! trip_history) {
                                    trip = await OpenRide.findOne({ _id: req.body.trip_id })
                                }
                                if (trip) {
                                    if (trip.is_trip_cancelled == 0 && trip.is_trip_cancelled_by_provider == 0) {

                                        Trip_Service.findOne({ _id: trip.trip_service_city_type_id }).then((tripservice) => {
                                            if (!tripservice) {
                                                res.json({
                                                    success: false,
                                                    error_code: error_message.ERROR_CODE_TRIP_SERVICE_NOT_FOUND
                                                });
                                            } else {
                                                //Old Code;
                                                // let email_notification = setting_detail.email_notification;
                                                // if (email_notification) {
                                                // }


                                                res.json({
                                                    success: true,
                                                    message: success_messages.MESSAGE_CODE_GET_INVOICE_SUCCESSFULLY,
                                                    trip: trip,
                                                    tripservice: tripservice
                                                });

                                            }
                                        });
                                    } else {
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_TRIP_IS_ALREADY_CANCELLED
                                        });
                                    }

                                } else {
                                    res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
                                }
                            });
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
////////////////////////////////////

////////////////////////// USER SET DESTINATION ///////////////////////////////////////
exports.user_setdestination = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'user_id', type: 'string' }, {
        name: 'trip_id',
        type: 'string'
    }], function (response) {
        if (response.success) {
            User.findOne({ _id: req.body.user_id }).then((user) => {
                if (user) {
                    if (user.token != req.body.token) {
                        res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
                    } else {
                        Trip.findOne({
                            _id: req.body.trip_id,
                            is_trip_cancelled: 0,
                            is_trip_cancelled_by_provider: 0,
                            user_id: req.body.user_id,
                            is_trip_end: 0
                        }).then((trip) => {
                            if (trip) {
                                trip.destination_address = req.body.destination_address;
                                trip.destinationLocation = [req.body.d_latitude, req.body.d_longitude];
                                trip.save().then(() => {
                                    utils.update_request_status_socket(trip._id);
                                    Provider.findOne({ _id: trip.confirmed_provider }).then((providers) => {
                                        if(providers){
                                            const device_token = providers.device_token;
                                            const device_type = providers.device_type;
                                            //////////////////////  PUSH NOTIFICATION //////////////////////
                                            utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_SET_DESTINATION, "", null, providers.lang_code);
                                        }
                                    })

                                    res.json({
                                        success: true,
                                        message: success_messages.MESSAGE_CODE_SET_DESTINATION_SUCCESSFULLY,
                                        destinationLocation: trip.destinationLocation
                                    })
                                })
                            } else {
                                res.json({ success: false, error_code: error_message.ERROR_CODE_DESTINATION_NOT_SET });
                            }
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            })
                        });
                    }
                } else {
                    res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
                }
            }, (err) => {
                console.log(err);
                res.json({
                    success: false,
                    error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                })
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            })
        }
    });
};
// getgooglemappath

exports.getgooglemappath = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }], function (response) {
        if (response.success) {
            TripLocation.findOne({ tripID: req.body.trip_id }).then((tripLocation) => {

                if (tripLocation) {
                    res.json({ success: true, triplocation: tripLocation });
                } else {
                    res.json({ success: false });
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
//setgooglemappath  
exports.setgooglemappath = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }], function (response) {
        if (response.success) {
            TripLocation.findOne({ tripID: req.body.trip_id }).then((tripLocation) => {

                tripLocation.googlePickUpLocationToDestinationLocation = req.body.googlePickUpLocationToDestinationLocation;
                tripLocation.googlePathStartLocationToPickUpLocation = req.body.googlePathStartLocationToPickUpLocation;
                tripLocation.save().then(() => {
                    res.json({ success: true });

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


exports.check_trip_inside_zone_queue = function (city_id, latitude, longitude, res_data) {
    CityZone.find({ cityid: city_id }, function (error, zone_queue_list) {
        if (zone_queue_list.length > 0) {
            let is_trip_inside_zone_queue = false;
            zone_queue_list.forEach(function (zone_queue_data, index) {
                let geo = geolib.isPointInside(
                    { latitude: latitude, longitude: longitude },
                    zone_queue_data.kmlzone
                );
                if (geo) {
                    is_trip_inside_zone_queue = true;
                }
                if (index == zone_queue_list.length - 1) {
                    res_data({ is_trip_inside_zone_queue: is_trip_inside_zone_queue, zone_queue_id: zone_queue_data._id });
                }
            });
        } else {
            res_data({ is_trip_inside_zone_queue: false, zone_queue_id: null });
        }
    });
};



exports.twilio_voice_call = async function (req, res) {
    try {
        let { body } = req;
        let { trip_id, type } = body;
        
        let trip = await Trip.findOne({ _id: trip_id }) || await OpenRide.findOne({ _id: trip_id }) || await Rental_Trip.findOne({ _id: trip_id });
        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }
        
        const setting_detail = await Settings.findOne({});
        const { twilio_account_sid, twilio_auth_token, twilio_number, twiml_url } = setting_detail;
        
        const client = require('twilio')(twilio_account_sid, twilio_auth_token);

        const user_id = trip.user_id || body.user_id;
        const provider_id = trip.confirmed_provider || body.provider_id || trip.provider_id;

        if ( type == 1 || type == 2 ) {
            
            const [user, provider] = await Promise.all([
                User.findOne({ _id: user_id }),
                Provider.findOne({ _id: provider_id })
            ]);

            if (!user || !provider) {
                return res.json({ success: false });
            }

            let toNumber, fromNumber;
            if (type === 1) {
                fromNumber = user.country_phone_code + user.phone;
                toNumber = provider.country_phone_code + provider.phone;
            } else if (type === 2) {
                fromNumber = provider.country_phone_code + provider.phone;
                toNumber = user.country_phone_code + user.phone;
            }

            const updated_twiml_url = `${twiml_url}?to=${toNumber}`;

            await client.calls.create({
                url: updated_twiml_url,
                to: fromNumber,
                from: twilio_number
            });

            return res.json({ success: true });

        } else if ( type == 3 ) {
    
            const Table = is_user ? User : Provider;
            const id = is_user ? trip.user_id : trip.confirmed_provider || body.provider_id || trip.provider_id;

            const user = await Table.findOne({ _id: id });

            if (!user) {
                return res.json({ "success": false });
            }

            let support_number = req.body.support_phone_user;
            let user_number = user.country_phone_code + user.phone;
            let updated_twiml_url = `${twiml_url}?to=${user_number}`;

            await client.calls.create({
                url: updated_twiml_url,
                to: support_number,
                from: twilio_number
            });

            return res.json({ "success": true });

        } else {
            return res.json({ "success": false, error_code: error_message.ERROR_CODE_TWILIO_SERVICE_NOT_AVAILABLE });
        }
    } catch (error) {
        console.log(error);
        return res.json({ "success": false, error_code: error_message.ERROR_CODE_TWILIO_SERVICE_NOT_AVAILABLE });
    }

}



exports.refund_amount_in_wallet = function (req, res) {
    if (typeof req.session.userid == 'undefined') {
        return res.json({ success: false });
    }
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        let trip = await Trip.findOne({ _id: req.body.trip_id });
        let amount = Number(req.body.amount);
        if (!trip) {
            trip = await Trip_history.findOne({ _id: req.body.trip_id });
        }
        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }
        if (trip.total < amount) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_CAN_NOT_REFUND_MORE_THAN_TRIP_AMOUNT });
        }
        let user_data = await User.findById(trip.user_id);
        let status = constant_json.ADD_WALLET_AMOUNT;
        let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user_data.unique_id, user_data._id, user_data.country_id, user_data.wallet_currency_code, user_data.wallet_currency_code,
            1, Math.abs(amount), user_data.wallet, status, constant_json.ADDED_BY_ADMIN, "Refund Of This Trip : " + trip.unique_id);
        user_data.wallet = total_wallet_amount;
        await user_data.save();

        trip.refund_amount += amount;
        trip.is_amount_refund = true;
        await trip.save();
        res.json({ success: true });
    });
}

exports.refund_amount_in_card = function (req, res) {
    if (typeof req.session.userid == 'undefined') {
        return res.json({ success: false });
    }
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        let trip = await Trip.findOne({ _id: req.body.trip_id });
        if (!trip) {
            trip = await Trip_history.findOne({ _id: req.body.trip_id });
        }
        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }

        // ###payment
        if (!trip.payment_gateway_type || trip.payment_gateway_type == PAYMENT_GATEWAY.stripe) {
            cards.refund_payment(trip.payment_intent_id, PAYMENT_GATEWAY.stripe);
        } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.paystack) {
            cards.refund_payment(trip.payment_intent_id, PAYMENT_GATEWAY.paystack);
        } else if (trip.payment_gateway_type == PAYMENT_GATEWAY.payu) {
            cards.refund_payment(trip._id, PAYMENT_GATEWAY.payu);
        }
        trip.refund_amount += trip.card_payment;
        trip.is_amount_refund = true;
        await trip.save();
        res.json({ success: true });
    });
}

exports.pay_by_other_payment_mode = function (req, res) {
    utils.check_request_params(req.body, [{ name: 'trip_id', type: 'string' }], async function (response) {
        if (!response.success) {
            return res.json({ success: false, error_code: response.error_code, error_message: response.error_message });
        }
        let trip = await Trip.findOne({ _id: req.body.trip_id });

        if (!trip) {
            trip = await Trip_history.findOne({ _id: req.body.trip_id });
        }

        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }

        let city = await City.findOne({ _id: trip.city_id });
        let provider = await Provider.findOne({ _id: trip.confirmed_provider });
        let user = await User.findOne({ _id: trip.user_id });
        let corporate = await Corporate.findOne({ _id: trip.user_type_id });

        let is_main_user = true;
        let split_payment_index = null;
        trip.split_payment_users.forEach((split_payment_user_detail, index) => {
            if (split_payment_user_detail.user_id.toString() == req.body.user_id.toString()) {
                is_main_user = false;
                split_payment_index = index;
            }
        })
        let wallet_payment = 0;
        let remaining_payment = 0;
        if (city.is_payment_mode_cash == 1) {

            if (is_main_user) {
                let total = trip.remaining_payment;
                let total_after_wallet_payment = trip.remaining_payment;
                total_after_wallet_payment = Number((total_after_wallet_payment).toFixed(2));
                wallet_payment = Number((wallet_payment).toFixed(2));
                remaining_payment = total - wallet_payment;
                remaining_payment = Number((remaining_payment).toFixed(2));
                trip.wallet_payment += wallet_payment;
                trip.total_after_wallet_payment = total_after_wallet_payment;
                trip.remaining_payment = remaining_payment;
                trip.payment_status = PAYMENT_STATUS.COMPLETED;

                trip.payment_mode = constant_json.PAYMENT_MODE_CASH;
                trip.provider_have_cash = remaining_payment;
                trip.pay_to_provider = trip.provider_service_fees - trip.provider_have_cash;

                trip.is_paid = 1;
                trip.is_pending_payments = 0;
                trip.cash_payment = remaining_payment;
                trip.remaining_payment = 0;
                await trip.save()
            } else {
                remaining_payment = trip.split_payment_users[split_payment_index].remaining_payment;
                trip.split_payment_users[split_payment_index].remaining_payment = 0;
                trip.split_payment_users[split_payment_index].cash_payment = remaining_payment;
                trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                trip.split_payment_users[split_payment_index].payment_mode = constant_json.PAYMENT_MODE_CASH;
                trip.cash_payment = trip.cash_payment + remaining_payment;
                trip.provider_have_cash = trip.provider_have_cash + remaining_payment;
                trip.markModified('split_payment_users');
                trip.save();
            }
        } else {
            if (is_main_user) {
                let total = trip.remaining_payment;
                let total_after_wallet_payment = trip.remaining_payment;

                wallet_payment = total_after_wallet_payment;
                if (trip.trip_type == constant_json.TRIP_TYPE_CORPORATE && corporate) {
                    let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, corporate.unique_id, corporate._id, null,
                        corporate.wallet_currency_code, trip.currencycode,
                        trip.wallet_current_rate, wallet_payment, corporate.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                    corporate.wallet = total_wallet_amount;
                    await corporate.save();
                    user.corporate_wallet_limit = user.corporate_wallet_limit - wallet_payment;
                } else {
                    let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, user.unique_id, user._id, null,
                        user.wallet_currency_code, trip.currencycode,
                        trip.wallet_current_rate, wallet_payment, user.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                    user.wallet = total_wallet_amount;
                }
                await user.save();

                total_after_wallet_payment = total_after_wallet_payment - wallet_payment;

                total_after_wallet_payment = Number((total_after_wallet_payment).toFixed(2));
                wallet_payment = Number((wallet_payment).toFixed(2));
                remaining_payment = total - wallet_payment;
                remaining_payment = Number((remaining_payment).toFixed(2));
                trip.wallet_payment += wallet_payment;
                trip.total_after_wallet_payment = total_after_wallet_payment;
                trip.remaining_payment = remaining_payment;
                trip.payment_status = PAYMENT_STATUS.COMPLETED;

                trip.is_paid = 1;
                trip.is_pending_payments = 0;
                trip.card_payment = 0;
                await trip.save()
            } else {
                remaining_payment = trip.split_payment_users[split_payment_index].remaining_payment;
                User.findOne({ _id: split_user.user_id }).then((split_user_detail) => {
                    let total_wallet_amount = utils.addWalletHistory(constant_json.USER_UNIQUE_NUMBER, split_user_detail.unique_id, split_user_detail._id, null,
                        split_user_detail.wallet_currency_code, trip.currencycode,
                        trip.wallet_current_rate, remaining_payment, split_user_detail.wallet, constant_json.DEDUCT_WALLET_AMOUNT, constant_json.PAID_TRIP_AMOUNT, "Charge Of This Trip : " + trip.unique_id);
                    split_user_detail.wallet = total_wallet_amount;
                    split_user_detail.save();

                    trip.split_payment_users[split_payment_index].remaining_payment = 0;
                    trip.split_payment_users[split_payment_index].wallet_payment = remaining_payment;
                    trip.split_payment_users[split_payment_index].payment_status = PAYMENT_STATUS.COMPLETED;
                    trip.wallet_payment = trip.wallet_payment + remaining_payment;
                    trip.markModified('split_payment_users');
                    trip.save();
                });
            }
        }

        await utils.trip_provider_profit_card_wallet_settlement(trip, city, provider);
        utils.update_request_status_socket(trip._id);
        if (trip.payment_status == PAYMENT_STATUS.COMPLETED) {
            Trip.findOneAndRemove({ _id: trip._id }).then((deleted_trip) => {
                if (deleted_trip) {
                    let trip_history_data = new Trip_history(JSON.parse(JSON.stringify(deleted_trip)));
                    trip_history_data.split_payment_users = deleted_trip.split_payment_users;
                    trip_history_data.save(function () {
                        return res.json({
                            success: true,
                            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                            payment_status: trip.payment_status
                        });
                    });
                } else {
                    return res.json({
                        success: true,
                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                        payment_status: trip.payment_status
                    });
                }
            });
        } else {
            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_YOUR_TRIP_COMPLETED_SUCCESSFULLY,
                payment_status: trip.payment_status
            });
        }
    });
}

exports.provider_set_trip_stop_status = async function (req, res) {
    try {
        let params_array = [
            { name: 'provider_id', type: 'string' },
            { name: 'token', type: 'string' },
            { name: 'trip_id', type: 'string' },
            { name: 'address', type: 'string' },
            { name: 'latitude', type: 'number' },
            { name: 'longitude', type: 'number' }
        ]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }
        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }
        let trip = await Trip.findOne({ _id: req.body.trip_id, confirmed_provider: req.body.provider_id })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_NO_TRIP_FOUND });
            return;
        }
        if (trip.is_trip_cancelled != 0 && trip.is_trip_cancelled_by_provider != 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_MISMATCH_PROVIDER_ID_OR_TRIP_ID });
            return;
        }
        let now = new Date();
        trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].address = req.body.address;
        trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].location = [Number(req.body.latitude), Number(req.body.longitude)];
        trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].arrived_time = now;

        let time_diff = Math.abs(utils.getTimeDifferenceInMinute(now, trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].start_time));
        if (time_diff < 0) {
            time_diff = 0
        }
        trip.actual_destination_addresses[trip.actual_destination_addresses.length - 1].total_time = time_diff;
        trip.markModified('actual_destination_addresses');
        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

        utils.update_request_status_socket(trip._id);
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

exports.check_trip_inside_zone_queue_async = function (city_id, latitude, longitude) {
    return new Promise(async (resolve, reject) => {
        let zone_queue_list = await CityZone.find({ cityid: city_id })
        if (zone_queue_list.length == 0) {
            resolve({ is_trip_inside_zone_queue: false, zone_queue_id: null });
            return;
        }

        let is_trip_inside_zone_queue = false;
        let zone_queue_id = null
        zone_queue_list.forEach(function (zone_queue_data, index) {
            let geo = geolib.isPointInside(
                { latitude: latitude, longitude: longitude },
                zone_queue_data.kmlzone
            );
            if (geo) {
                is_trip_inside_zone_queue = true;
                zone_queue_id = zone_queue_data._id
            }
            if (index == zone_queue_list.length - 1) {
                resolve({ is_trip_inside_zone_queue: is_trip_inside_zone_queue, zone_queue_id: zone_queue_id });
            }
        });
    });
};
/////////////// USER CHANGE PAYMENT TYPE  
exports.change_paymenttype = async function (req, res) {

    try {
        
        let response = await utils.check_request_params_async(req.body, [{name: 'trip_id', type: 'string'}])
        if (!response.success) {
            return res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    
        let user = await User.findOne({_id: req.body.user_id});
        if (!user){
            return res.json({success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND});
        }
    
        if (req.body.token != null && user.token != req.body.token) {
            return res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
        }
    
        let payment_type = req.body.payment_type;
        let trip = await Trip.findOne({ _id: req.body.trip_id });
        if (!trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_NOT_FOUND });
        }

        if (payment_type === Number(constant_json.PAYMENT_MODE_CARD)) {
            let user_id = trip.trip_type === constant_json.TRIP_TYPE_CORPORATE ? trip.user_type_id : trip.user_id;

            let cards = await Card.find({ user_id, payment_gateway_type: trip.payment_gateway_type });
            if (cards.length === 0 && ![PAYMENT_GATEWAY.payu, PAYMENT_GATEWAY.paypal, PAYMENT_GATEWAY.razorpay].includes(trip.payment_gateway_type)) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_ADD_CREDIT_CARD_FIRST });
            }

            trip.payment_mode = payment_type;
            await trip.save();

            let provider = await Provider.findOne({ _id: trip.confirmed_provider });
            if (provider) {
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_PAYMENT_MODE_CARD, "", null, provider.lang_code);
            }
            utils.update_request_status_socket(trip._id);

            return res.json({ success: true, message: success_messages.MESSAGE_CODE_YOUR_PAYMEMT_MODE_CHANGE_SUCCESSFULLY });

        } else if (payment_type === Number(constant_json.PAYMENT_MODE_APPLE_PAY)) {
            // There is no need to check any condition because if stripe is set from country then only show apply pay option in iOS.
            trip.payment_mode = payment_type;
            await trip.save();

            let provider = await Provider.findOne({ _id: trip.confirmed_provider });
            if (provider) {
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_PAYMENT_MODE_APPLEPAY, "", null, provider.lang_code);
            }
            utils.update_request_status_socket(trip._id);

            return res.json({ success: true, message: success_messages.MESSAGE_CODE_YOUR_PAYMEMT_MODE_CHANGE_SUCCESSFULLY });

        } else {

            let city_detail = await City.findOne({ _id: trip.city_id });
            let provider = await Provider.findOne({ _id: trip.confirmed_provider });

            if (provider && city_detail && city_detail.is_check_provider_wallet_amount_for_received_cash_request && city_detail.provider_min_wallet_amount_set_for_received_cash_request > provider.wallet) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_CAN_NOT_CHANGE_PAYMENT_MODE });
            }

            trip.payment_mode = payment_type;
            await trip.save();

            if (provider) {
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_PAYMENT_MODE_CASH, "", null, provider.lang_code);
            }
            utils.update_request_status_socket(trip._id);

            return res.json({ success: true, message: success_messages.MESSAGE_CODE_YOUR_PAYMEMT_MODE_CHANGE_SUCCESSFULLY });
        }

    } catch (error) {
        utils.error_response(error, req, res)
    }

};

exports.get_cancellation_reason = async function (req, res) {
    try {
        let params_array = [{ name: "user_type", type: 'number' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let lang = req.body.lang;
        if (lang) {
            let langIndex = (await Languages.find({})).findIndex(value => value.code == req.body.lang)
            lang = langIndex == -1 ? 0 : langIndex
        }
        let list = await Cancel_reason.aggregate([{ $match: { user_type: req.body.user_type } }, { $group: { _id: null, reason_list: { $push: { $ifNull: [{ $arrayElemAt: ["$reason", Number(lang)] }, { $ifNull: [{ $arrayElemAt: ["$reason", 0] }, ""] }] } } } }])
        res.json({ success: true, reasons: list[0] ?  list[0].reason_list : [] })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.applepay_web_key = async (req, res) => {
    try {
        let fs = require('fs')
        let setting_detail = await Settings.findOne({},{is_production:1})
        let file;
        if (setting_detail?.is_production) {
            file = fs.readFileSync('data/apple_pay/live/apple-developer-merchantid-domain-association')
        } else {
            file = fs.readFileSync('data/apple_pay/developer/apple-developer-merchantid-domain-association')
        }
        res.send(file)
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.trip_remaning_payment = (req, res) => {
    console.log("apple_pay");
    console.log(req.body);
    
    let pramas_array = [{ name: "trip_id", type: 'string' }, { name: 'token', type: 'string' }, { name: 'user_id', type: 'string' }]
    utils.check_request_params(req.body, pramas_array, async (response) => {
        try {
            if (!response.success) {
                res.json(response)
                return
            }
            let user = await User.findOne({_id:req.body.user_id});
            if (user && user.token !== req.body.token) {
                res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                return
            }
            const setting_detail = await Settings.findOne({});
            const stripe = require('stripe')(setting_detail.stripe_secret_key)
            
            let trip = await Trip.findOne({ _id: req.body.trip_id })
            if (!trip) {
                trip = await Trip_history.findOne({ _id: req.body.trip_id })
            }

            if(req.body?.is_rental_trip_payment || req.body?.is_rental_trip_additional_payment){
                trip = await Rental_Trip.findOne({ _id: req.body.trip_id })
            }
            let metadata_object = {
                is_apple_pay:true,
                is_tip_payment: req.body?.is_tip,
                is_split_payment:req.body?.is_split_payment,
                trip_id:req.body.trip_id,
                user_id:req.body.user_id,
                is_cancel_trip:req.body?.is_cancel_trip,
                is_rental_trip_payment: req.body?.is_rental_trip_payment,
                is_rental_trip_additional_payment : req.body?.is_rental_trip_additional_payment
            }
            // FOR NORMAL TRIP
            let amount = trip.remaining_payment
            // FOR TIP
            if(req.body.is_tip){
                amount = req.body.amount
            }
            // for cancel charges
            if(req.body.is_cancel_trip){
                amount = trip.total
            }
            // for rental trip charges
            if(req.body?.is_rental_trip_payment){
                amount = trip.total
            }
            // for rental trip additional charges
            if(req.body?.is_rental_trip_additional_payment){
                amount = trip.total_additional_charge
            }
            // FOR SPLIT USER
            let find_split_user_index;
            if(trip.split_payment_users && trip.split_payment_users.length > 0 && req.body.is_split_payment){
                find_split_user_index = trip.split_payment_users.findIndex(value=> (value.user_id).toString() == req.body.user_id)
                if( find_split_user_index == -1){
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PAYMENT_FAILED })
                    return
                }                
                amount = trip.split_payment_users[find_split_user_index].remaining_payment
            } 

            if (amount > 0) {
                let currencycode = trip.currencycode ? trip.currencycode : setting_detail.adminCurrencyCode
                let paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round((amount * 100)),
                    currency: currencycode,
                    metadata: metadata_object,
                })
                if (paymentIntent) {
                    let country = await Country.findOne({ _id: trip.country_id }, { alpha2: 1, currencycode: 1 })
                    if(req.body.is_split_payment){
                        trip.split_payment_users[find_split_user_index].payment_intent_id = paymentIntent.id
                        trip.markModified('split_payment_users');
                    }else if(req.body.is_tip){
                        trip.tip_payment_intent_id = paymentIntent.id
                    }else if(req.body.is_rental_trip_additional_payment){
                        trip.additional_payment_intent_id = paymentIntent.id;
                    }else {
                        trip.payment_intent_id = paymentIntent.id;
                    }
                    await trip.save()
                    res.json({
                        success: true,
                        client_secret: paymentIntent.client_secret,
                        total_amount: amount,
                        country_code: country.alpha2,
                        currency_code: country.currencycode
                    });
                }else{
                    res.json({ success: false, error_code: error_message.ERROR_CODE_PAYMENT_FAILED })
                    return
                }
            } else {
                res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_PAYMENT_ALREADY_COMPLETED })
            }
        } catch (error) {
            if(error.raw.code){
                res.json({ success: false, error_message:error.raw.message})
                return
            }
            utils.error_response(error, req, res)
        }
    })
}

exports.apple_pay_webhooks = async (req, res) => {
    let body = req.body.data?.object
    console.log(body);
    let metadata = body?.metadata
    req.body.trip_id = metadata?.trip_id
    req.body.user_id = metadata?.user_id
    req.body.is_apple_pay = metadata?.is_apple_pay
    req.body.type = metadata?.type
    req.body.payment_intent_id = body?.payment_intent
    if (body.status != "succeeded") {
        res.json({ success: false, error_code: error_message.ERROR_CODE_PAYMENT_FAILED })
        return
    }
    if (metadata?.is_apple_pay) {
        if (metadata?.is_tip_payment) {
            await exports.pay_tip_payment(req, res)
            return
        } else if (metadata?.is_wallet_amount) {
            await user_controller.add_wallet_amount(req, res)
            return
        } else {
            // trip, spilt, cacellation charges and rental trip payment
            await exports.pay_stripe_intent_payment(req, res)
            return
        }
    }else{
        res.json({success:true})
    }
}

exports.fixed_old_trip = async (req, res) => {
    let Trip = require('mongoose').model('Trip');
    let user_lookup = {
        $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            pipeline: [{ $project: { unique_id: 1 } }],
            as: 'user_detail'
        }
    }
    let provider_lookup = {
        $lookup: {
            from: 'providers',
            localField: 'current_provider',
            pipeline: [{ $project: { unique_id: 1, phone: 1, country_phone_code: 1 } }],
            foreignField: '_id',
            as: 'provider_details'
        }
    }
    let vehicle_type_lookup = {
        $lookup: {
            from: 'types',
            localField: 'type_id',
            foreignField: '_id',
            pipeline: [{ $project: { typename: 1 } }],
            as: 'vehicle_type_details'
        }
    }
    let trip_history_list = await Trip.aggregate([{ $project: { _id: 1, user_id: 1, current_provider: 1, type_id: 1 } }, user_lookup, provider_lookup, vehicle_type_lookup])
    let i = 0;
    for (let trip of trip_history_list) {
        await Trip.findByIdAndUpdate(
            trip._id,
            {
                user_unique_id: trip.user_detail[0]?.unique_id || 0,
                typename: trip.vehicle_type_details[0]?.typename || "anonymous",
                provider_unique_id: trip.provider_details[0]?.unique_id || 0,
                provider_phone: trip.provider_details[0]?.phone || "0000000000",
                provider_phone_code: trip.provider_details[0]?.country_phone_code || "00"
            }
        )
        console.log(`${++i}/${trip_history_list.length}`)
    }
    res.json({ success: true })
}

exports.fixed_old_trip_history = async (req, res) => {
    let Trip_history = require('mongoose').model('Trip_history');
    let user_lookup = {
        $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            pipeline: [{ $project: { unique_id: 1 } }],
            as: 'user_detail'
        }
    }
    let provider_lookup = {
        $lookup: {
            from: 'providers',
            localField: 'current_provider',
            pipeline: [{ $project: { unique_id: 1, phone: 1, country_phone_code: 1 } }],
            foreignField: '_id',
            as: 'provider_details'
        }
    }
    let vehicle_type_lookup = {
        $lookup: {
            from: 'types',
            localField: 'type_id',
            foreignField: '_id',
            pipeline: [{ $project: { typename: 1 } }],
            as: 'vehicle_type_details'
        }
    }
    let trip_history_list = await Trip_history.aggregate([{ $project: { _id: 1, user_id: 1, current_provider: 1, type_id: 1 } }, user_lookup, provider_lookup, vehicle_type_lookup])
    let i = 0;
    for (let trip of trip_history_list) {
        await Trip_history.findByIdAndUpdate(
            trip._id,
            {
                user_unique_id: trip.user_detail[0]?.unique_id || 0,
                typename: trip.vehicle_type_details[0]?.typename || "anonymous",
                provider_unique_id: trip.provider_details[0]?.unique_id || 0,
                provider_phone: trip.provider_details[0]?.phone || "0000000000",
                provider_phone_code: trip.provider_details[0]?.country_phone_code || "00"
            }
        )
        console.log(`${++i}/${trip_history_list.length}`)
    }
    res.json({ success: true })
}

// rental trip booking apis start
exports.createrentaltrip = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'vehicle_id', type: 'string' },
            { name: 'start_date', type: 'string' },
            { name: 'end_date', type: 'string' }
        ]

        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            return res.json(response);
        }

        const user_id = req.body.user_id;
        let user_data = await User.findOne({ _id: req.body.user_id });
        if (!user_data) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }

        if (user_data.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        if (user_data.current_trip_id) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
        }

        if(user_data.is_documents_expired){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DOCUMENT_EXPIRED });
        }

        if (!user_data.is_document_uploaded) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_DOCUMENT_NOT_UPLOADED });
        }

        if (user_data.is_approved == 0) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_APPROVED });
        }

        if(user_data.user_type != 0){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_ONLY_NORMAL_USER_CAN_BOOKING });
        }

        const existingOrder = await Trip.findOne({
            user_id: user_id,
            is_schedule_trip: false,
            is_provider_accepted: 0,
            is_trip_completed: 0,
            is_trip_cancelled: 0
        });

        if (existingOrder) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_TRIP_ALREADY_RUNNING });
        }

        const setting_detail = await Settings.findOne({});
        let vehicle_detail = await Car_Rent_Vehicle.findOne({_id: req.body.vehicle_id});
        if(!vehicle_detail) return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_FOUND });

        // check vechile availability
        let start_date = new Date(req.body.start_date);
        let end_date = new Date(req.body.end_date);
        let startDate = new Date(req.body.start_date);
        let endDate = new Date(req.body.end_date);
        let location = [parseFloat(req.body.latitude), parseFloat(req.body.longitude)];
        let address = req.body.address;
        let vehicle_query = {
            _id: req.body.vehicle_id
        };
        // Check if start_date and end_date are provided
        if (start_date != '' && end_date != '') {
            // Extract hours and minutes from the start date
            let startHours = startDate.getHours();
            let startMinutes = startDate.getMinutes();
            let extractedStartTime = ("0" + startHours).slice(-2) + ":" + ("0" + startMinutes).slice(-2);

            // Extract hours and minutes from the end date
            let endHours = endDate.getHours();
            let endMinutes = endDate.getMinutes();
            let extractedEndTime = ("0" + endHours).slice(-2) + ":" + ("0" + endMinutes).slice(-2);

            vehicle_query.$or = [
                // For vehicles with handover_type 1, check the time range
                {
                    $and: [
                        { "handover_type": 1 },
                        {
                            $expr: {
                                $and: [
                                    // Check if the extracted start time is greater than or equal to handover start time
                                    {
                                        $gte: [
                                            extractedStartTime,
                                            { $arrayElemAt: ["$handover_time.start_time", 0] }
                                        ]
                                    },
                                    // Check if the extracted end time is less than or equal to handover end time
                                    {
                                        $lte: [
                                            extractedEndTime,
                                            { $arrayElemAt: ["$handover_time.end_time", 0] }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                },
                // For vehicles with handover_type 0, skip the time checks
                {
                    "handover_type": 0
                }
            ];
        }

        let available_vehicle = await Car_Rent_Vehicle.findOne(vehicle_query).select("_id non_availability");
        if(!available_vehicle){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_AVAILABLE });
        }

        // this condition will check vehicle non availability
        let filtered_vehicle;
        if(available_vehicle.non_availability?.length > 0){
            let vehicle_non_availability = available_vehicle.non_availability;
            let isAvailable = true;

            vehicle_non_availability.forEach((non_availability) => {
                const nonAvailableStartDate = new Date(non_availability.start_date);
                const nonAvailableEndDate = new Date(non_availability.end_date);

                // Check for conflicts between requested dates and non-availability periods
                if (
                    (startDate >= nonAvailableStartDate && startDate <= nonAvailableEndDate) || // Requested start is within non-availability
                    (endDate >= nonAvailableStartDate && endDate <= nonAvailableEndDate) || // Requested end is within non-availability
                    (startDate <= nonAvailableStartDate && endDate >= nonAvailableEndDate) // Non-availability is fully within requested period
                ) {
                    isAvailable = false; // Conflict found, mark as unavailable
                }

                // If no conflicts found, add vehicle to the filtered list
                if (isAvailable) {
                    filtered_vehicle = available_vehicle;
                }
            })
        } else {
            filtered_vehicle = available_vehicle;
        }

        if(!filtered_vehicle){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_AVAILABLE });
        }

        if(req.body?.booking_type == 1 && !vehicle_detail.is_delivery_available){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_VEHICLE_NOT_AVAILABLE });
        }

        let provider_detail = await Provider.findOne({_id: vehicle_detail.provider_id});
        let type_detail = await Car_Rent_Type.findOne({_id: vehicle_detail.type_id});
        let country_detail = await Country.findOne({_id: provider_detail.country_id});

        if (!country_detail) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_COUNTRY_NOT_FOUND });
        }

        if (country_detail.isRentalBusiness !== 1) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_OUR_BUSINESS_NOT_IN_YOUR_COUNTRY });
        }

        let payment_gateway_type = setting_detail.payment_gateway_type;
        if (country_detail.payment_gateways && country_detail.payment_gateways.length > 0) {
            payment_gateway_type = country_detail.payment_gateways[0];
        }


        const vehicle_id = req.body.vehicle_id;
        const created_by = Number(constant_json.CREATED_BY_USER_APP);
        const trip_type = Number(constant_json.TRIP_TYPE_NORMAL);
        let trip_user_type = TYPE_VALUE.USER;
        let tripDurationInDays = 1;
        let delivery_fee = 0;

        if(start_date && end_date){
            let startDate = new Date(req.body.start_date);
            let endDate = new Date(req.body.end_date);
            let differenceInMilliseconds = endDate - startDate;
            // Convert milliseconds to days
            tripDurationInDays = Math.ceil(differenceInMilliseconds / (1000 * 60 * 60 * 24));
        }

        if(vehicle_detail.is_delivery_available && req.body?.booking_type == 1 ){
            // to find distance from VehicleLocation to sourceLocation
            let distance = Math.abs(utils.getDistanceFromTwoLocation(vehicle_detail.location, location ));
            delivery_fee = Number(vehicle_detail.delivery_charge_per_unit_distance * Math.ceil(distance * 2));
        }

        let total = (Number(vehicle_detail?.base_price) * Number(tripDurationInDays)) + Number(type_detail?.plateform_fee) + Number(delivery_fee);

        const vehicle_price_details = {
            // vehicle price detail
            base_price: vehicle_detail?.base_price,
            platform_fee: type_detail?.plateform_fee,
            cancellation_price: vehicle_detail?.cancellation_charge,
            max_distance_per_day: vehicle_detail?.max_distance_per_day,
            additional_charge_per_unit_distance: vehicle_detail?.additional_charge_per_unit_distance,
            // vehicle detail
            unique_no: vehicle_detail?.unique_no,
            plate_no: vehicle_detail?.plate_no,
            color: vehicle_detail?.color,
            no_of_seats: vehicle_detail?.no_of_seats,
            fuel_type: vehicle_detail?.fuel_type,
            transmission_type: vehicle_detail?.transmission_type,
            description: vehicle_detail?.description,
            location: vehicle_detail?.location,
            address: vehicle_detail?.address,
            handover_type: vehicle_detail?.handover_type,
            handover_time: vehicle_detail?.handover_time,
            is_delivery_available: vehicle_detail?.is_delivery_available,
            delivery_distance: vehicle_detail?.delivery_distance,
            delivery_charge_per_unit_distance: vehicle_detail?.delivery_charge_per_unit_distance,
            delivery_time_type: vehicle_detail?.delivery_time_type
        };

        let rental_trip = new Rental_Trip ({
            user_id: user_data._id,
            user_type: constant_json.USER_TYPE_NORMAL,
            user_type_id: null,
            user_last_name: user_data.last_name,
            user_first_name: user_data.first_name,
            user_unique_id: user_data.unique_id,
            user_phone_code: user_data.country_phone_code,
            user_phone: user_data.phone,
            user_app_version: user_data.app_version,
            user_device_type: user_data.device_type,

            trip_type: trip_type,
            created_by: created_by,
            vehicle_id: vehicle_id,
            country_id: country_detail._id,
            provider_id: provider_detail._id,
            type_id: vehicle_detail.type_id,
            
            trip_duration: tripDurationInDays,
            base_price: Number(vehicle_detail?.base_price * tripDurationInDays),
            platform_fee: Number(type_detail?.plateform_fee),
            delivery_fee: Number(delivery_fee),

            payment_gateway_type: payment_gateway_type,

            vehicle_price_details: vehicle_price_details,

            total: total,

            location: location,
            address: address,

            booking_type: req.body.booking_type,
            currency: country_detail.currencysign,
            currencycode: country_detail.currencycode,
            admin_currency: setting_detail.adminCurrency,
            admin_currencycode: setting_detail.adminCurrencyCode,
            timezone: country_detail.countrytimezone,
            unit: vehicle_detail?.unit,

            schedule_start_time: start_date,
            schedule_end_time: end_date
        });

        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.CREATED, trip_user_type );
        await rental_trip.save();

        // set vehicle unavailable for trip_duration
        const nonAvailability = {
            start_date: moment.utc(start_date).toDate(),
            end_date: moment.utc(end_date).toDate(),
            trip_id: rental_trip._id,
            availability_type: 2
        };
        await Car_Rent_Vehicle.findByIdAndUpdate(
            vehicle_id,
            { $push: { non_availability: nonAvailability } },
            { new: true }
        );

        let unique_id = pad(rental_trip.unique_id, 7, '0');
        let invoice_number = constant_json.INVOICE_APP_NAME_CODE + " " + constant_json.INVOICE_PROVIDER_TRIP_EARNING_CODE + " " + (moment(new Date())).format(constant_json.DATE_FORMAT_MMDDYYYY) + " " + unique_id;
        rental_trip.invoice_number = invoice_number;
        await rental_trip.save();

        await Promise.all([
            User.updateOne({ _id: user_id }, { $inc: { total_rental_request: 1 } }),
            Provider.updateOne({ _id: vehicle_detail.provider_id }, { $inc: { total_rental_request: 1 } }),
            Car_Rent_Vehicle.updateOne({ _id: vehicle_id }, { $inc: { total_request: 1 } }),
        ]);
        utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_YOU_GOT_NEW_RENTAL_REQUEST, "", provider_detail.webpush_config, provider_detail.lang_code);
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_YOUR_BOOKING_CREATED_SUCCESSFULLY
        });

    } catch (err) {
        console.log(err);
        utils.error_response(err, req, res)
    }
};

exports.provider_get_pending_rental_request = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        // Define provider and trip conditions
        const provider_condition = {
            provider_id: Schema(req.body.provider_id),
            status: {$in: [0,1]}
        };

        let vehicle_lookup = {
            $lookup : {
                from: "car_rent_vehicles",
                localField: "vehicle_id",
                foreignField: "_id",
                pipeline:[{ $project:{ brand_id:1, model_id:1, type_id: 1, address:1, location:1, base_price:1, plate_no:1, _id:0 } }],
                as: "vehicle_details"
            }
        }

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "vehicle_details.brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "vehicle_details.model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let type_lookup = {
            $lookup : {
                from: "car_rent_types",
                localField: "vehicle_details.type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "type_details"
            }
        }

        let user_lookup = {
            $lookup : {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                pipeline:[{ $project:{ first_name:1, last_name:1, picture: 1, _id:0 } }],
                as: "users_details"
            }
        }

        // Query only the necessary fields
        const rental_trips = await Rental_Trip.aggregate([
            { $match: provider_condition },
            vehicle_lookup,
            brand_lookup,
            model_lookup,
            type_lookup,
            user_lookup,
            {
                $project: {
                    unique_id: 1,
                    vehicle_id: 1,
                    customer_id: 1,
                    schedule_start_time: 1,
                    schedule_end_time: 1,
                    user_name: {
                        $concat: [
                            { $arrayElemAt: ["$users_details.first_name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$users_details.last_name", 0] }
                            
                        ]
                    },
                    title: { 
                        $concat: [
                            { $arrayElemAt: ["$brand_details.name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$model_details.name", 0] }, 
                            " - ", 
                            { $arrayElemAt: ["$type_details.name", 0] }
                        ] 
                    },
                    plate_no: { $arrayElemAt: ["$vehicle_details.plate_no", 0] },
                    total: 1,
                    trip_duration: 1,
                    currency: 1,
                    status: 1,
                    booking_type: 1
                }
            },
            {
                $sort:{
                    unique_id: -1
                }
            }
        ]);
            
        return res.json({ success: true, rental_trips });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.user_get_pending_rental_request = async function (req, res) {
    try {
        let params_array = [
            { name: "user_id", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const user = await User.findOne({ _id: req.body.user_id })
        if(!user) return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND});

        if (req.body.token != null && user.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        // Define user and trip conditions
        const user_condition = {
            user_id: Schema(req.body.user_id),
            status: {$in: [0,1]}
        };

        let vehicle_lookup = {
            $lookup : {
                from: "car_rent_vehicles",
                localField: "vehicle_id",
                foreignField: "_id",
                pipeline:[{ $project:{ brand_id:1, model_id:1, type_id: 1, address:1, location:1, base_price:1, plate_no:1, _id:0 } }],
                as: "vehicle_details"
            }
        }

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "vehicle_details.brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "vehicle_details.model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let type_lookup = {
            $lookup : {
                from: "car_rent_types",
                localField: "vehicle_details.type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "type_details"
            }
        }

        let provider_lookup = {
            $lookup : {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                pipeline:[{ $project:{ first_name:1, last_name:1, picture: 1, _id:0 } }],
                as: "provider_details"
            }
        }

        // Query only the necessary fields
        const rental_trips = await Rental_Trip.aggregate([
            { $match: user_condition },
            vehicle_lookup,
            brand_lookup,
            model_lookup,
            type_lookup,
            provider_lookup,
            {
                $project: {
                    unique_id: 1,
                    vehicle_id: 1,
                    customer_id: 1,
                    schedule_start_time: 1,
                    schedule_end_time: 1,
                    provider_name: {
                        $concat: [
                            { $arrayElemAt: ["$provider_details.first_name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$provider_details.last_name", 0] }
                            
                        ]
                    },
                    title: { 
                        $concat: [
                            { $arrayElemAt: ["$brand_details.name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$model_details.name", 0] }, 
                            " - ", 
                            { $arrayElemAt: ["$type_details.name", 0] }
                        ] 
                    },
                    plate_no: { $arrayElemAt: ["$vehicle_details.plate_no", 0] },
                    total: 1,
                    trip_duration: 1,
                    currency: 1,
                    currencycode: 1,
                    status: 1,
                    payment_gateway_type: { $toString: "$payment_gateway_type" },
                    booking_type: 1
                }
            },
            {
                $sort:{
                    unique_id: -1
                }
            }
        ]);
            
        return res.json({ success: true, rental_trips });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
};

exports.provider_accept_rental_trip = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let rental_trip = await Rental_Trip.findOne({ _id: req.body.trip_id, provider_id: req.body.provider_id });
        if (!rental_trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
            return;
        }

        if (rental_trip.is_trip_cancelled == 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_ALREADY_CANCELLED });
            return;
        }

        if (rental_trip.is_provider_accepted == 1 ) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_ALREADY_ACCEPTED });
            return;
        }

        let trip_user_type = TYPE_VALUE.PROVIDER;

        rental_trip.provider_type = provider.provider_type;
        rental_trip.provider_type_id = provider.provider_type_id;
        rental_trip.provider_unique_id = provider.unique_id;
        rental_trip.provider_first_name = provider.first_name;
        rental_trip.provider_last_name = provider.last_name;
        rental_trip.provider_phone_code = provider.country_phone_code;
        rental_trip.provider_phone = provider.phone;
        rental_trip.provider_app_version = provider.app_version;
        rental_trip.provider_device_type = provider.device_type;
        rental_trip.is_provider_accepted = RENTAL_TRIP_STATUS.ACCEPTED;
        rental_trip.status = RENTAL_TRIP_STATUS.ACCEPTED;
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.ACCEPTED, trip_user_type );
        rental_trip.provider_accepted_time = new Date();

        if(rental_trip.invoice_number == ''){
            let unique_id = pad(rental_trip.unique_id, 7, '0');
            let invoice_number = constant_json.INVOICE_APP_NAME_CODE + " " + constant_json.INVOICE_PROVIDER_TRIP_EARNING_CODE + " " + (moment(new Date())).format(constant_json.DATE_FORMAT_MMDDYYYY) + " " + unique_id;
            rental_trip.invoice_number = invoice_number;
        }

        await rental_trip.save();
        let user = await User.findOne({_id: rental_trip.user_id}).select({
            device_type : 1, device_token : 1
        })
        await Car_Rent_Vehicle.updateOne(
            { _id: rental_trip.vehicle_id },
            { $inc: { accepted_request: 1 } }
        );
        if(user){
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_OWNER_ACCEPT_YOUR_TRIP, "", user.webpush_config, user.lang_code);
        }
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_BOOKING_ACCEPTED_SUCCESSFULLY
        });
        
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.user_rental_request_list = async function (req, res) {
    try {
        let params_array = [
            { name: "user_id", type: "string"}, { name: "list_type", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const user = await User.findOne({ _id: req.body.user_id })
        if(!user) return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND});

        if (req.body.token != null && user.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        let list_type = Number(req.body.list_type);
        let status = [RENTAL_TRIP_STATUS.PAYMENT];

        switch (list_type) {
            case 1: // upcoming
                status = [RENTAL_TRIP_STATUS.PAYMENT];
                break;
            case 2: // ongoing
                status = [RENTAL_TRIP_STATUS.DRIVER_HANDOVER, RENTAL_TRIP_STATUS.USER_HANDOVER, RENTAL_TRIP_STATUS.ADDITIONAL_PAYMENT];
                break;
            case 3: // completed
                status = [RENTAL_TRIP_STATUS.CANCELLED, RENTAL_TRIP_STATUS.COMPLETED];
                break;
            default:
                status = [RENTAL_TRIP_STATUS.PAYMENT];
                break;
        }

        // Define user and trip conditions
        const user_condition = {
            user_id: Schema(req.body.user_id),
            status: {$in: status}
        };

        let vehicle_lookup = {
            $lookup : {
                from: "car_rent_vehicles",
                localField: "vehicle_id",
                foreignField: "_id",
                pipeline:[{ $project:{ brand_id:1, model_id:1, type_id: 1, address:1, location:1, base_price:1, plate_no:1, _id:0, cancellation_charge:1 } }],
                as: "vehicle_details"
            }
        }

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "vehicle_details.brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "vehicle_details.model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let type_lookup = {
            $lookup : {
                from: "car_rent_types",
                localField: "vehicle_details.type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "type_details"
            }
        }

        let provider_lookup = {
            $lookup : {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                pipeline:[{ $project:{ first_name:1, last_name:1, picture: 1, _id:0, rental_rate:1 } }],
                as: "provider_details"
            }
        }

        // Query only the necessary fields
        const rental_trips = await Rental_Trip.aggregate([
            { $match: user_condition },
            vehicle_lookup,
            brand_lookup,
            model_lookup,
            type_lookup,
            provider_lookup,
            {
                $project: {
                    unique_id: 1,
                    vehicle_id: 1,
                    customer_id: 1,
                    provider_id: 1,
                    schedule_start_time: 1,
                    schedule_end_time: 1,
                    provider_name: {
                        $concat: [
                            { $arrayElemAt: ["$provider_details.first_name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$provider_details.last_name", 0] }
                            
                        ]
                    },
                    title: { 
                        $concat: [
                            { $arrayElemAt: ["$brand_details.name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$model_details.name", 0] }, 
                            " - ", 
                            { $arrayElemAt: ["$type_details.name", 0] }
                        ] 
                    },
                    plate_no: { $arrayElemAt: ["$vehicle_details.plate_no", 0] },
                    address: { $arrayElemAt: ["$vehicle_details.address", 0] },
                    total: 1,
                    trip_duration: 1,
                    currency: 1,
                    status: 1,
                    cancellation_charge: {
                        $add: [
                            { $toDouble: { $arrayElemAt: ["$vehicle_details.cancellation_charge", 0] } },
                            { $toDouble: "$platform_fee" }
                        ]
                    },
                    cancelled_by: { $toString: '$cancelled_by'},
                    total_additional_charge: 1,
                    payment_gateway_type : { $toString: '$payment_gateway_type'},
                    is_rated: {
                        $cond: {
                            if: { $eq: ["$is_vehicle_rated", 1] },
                            then: true,
                            else: false
                        }
                    },
                    provider_phone: 1, 
                    provider_phone_code: 1,
                    booking_type: 1,
                    delivery_fee: 1
                }
            },
            {
                $sort:{
                    unique_id: -1
                }
            }
        ]);
            
        return res.json({ success: true, rental_trips });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
};

exports.provider_rental_request_list = async function (req, res) {
    try {
        let params_array = [
            { name: "provider_id", type: "string"}, { name: "list_type", type: "string"}
        ]
        let response = await utils.check_request_params_async(req.body, params_array);
        if (!response.success)  return res.json(response);
       
        const provider = await Provider.findOne({ _id: req.body.provider_id })
        if(!provider) return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

        if (req.body.token != null && provider.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        let list_type = Number(req.body.list_type);
        let status = [RENTAL_TRIP_STATUS.PAYMENT];

        switch (list_type) {
            case 1: // upcoming
                status = [RENTAL_TRIP_STATUS.PAYMENT];
                break;
            case 2: // ongoing
                status = [RENTAL_TRIP_STATUS.DRIVER_HANDOVER, RENTAL_TRIP_STATUS.USER_HANDOVER, RENTAL_TRIP_STATUS.ADDITIONAL_PAYMENT];
                break;
            case 3: // completed
                status = [RENTAL_TRIP_STATUS.CANCELLED, RENTAL_TRIP_STATUS.COMPLETED];
                break;
            default:
                status = [RENTAL_TRIP_STATUS.PAYMENT];
                break;
        }


        // Define provider and trip conditions
        const provider_condition = {
            provider_id: Schema(req.body.provider_id),
            status: {$in: status}
        };

        let vehicle_lookup = {
            $lookup : {
                from: "car_rent_vehicles",
                localField: "vehicle_id",
                foreignField: "_id",
                pipeline:[{ $project:{ brand_id:1, model_id:1, type_id: 1, address:1, location:1, base_price:1, plate_no:1, _id:0 } }],
                as: "vehicle_details"
            }
        }

        let brand_lookup = {
            $lookup : {
                from: "car_rent_brands",
                localField: "vehicle_details.brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "brand_details"
            }
        }

        let model_lookup = {
            $lookup : {
                from: "car_rent_models",
                localField: "vehicle_details.model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "model_details"
            }
        }

        let type_lookup = {
            $lookup : {
                from: "car_rent_types",
                localField: "vehicle_details.type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, _id:0 } }],
                as: "type_details"
            }
        }

        let user_lookup = {
            $lookup : {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                pipeline:[{ $project:{ first_name:1, last_name:1, picture: 1, _id:0, rental_rate:1 } }],
                as: "users_details"
            }
        }

        // Query only the necessary fields
        const rental_trips = await Rental_Trip.aggregate([
            { $match: provider_condition },
            vehicle_lookup,
            brand_lookup,
            model_lookup,
            type_lookup,
            user_lookup,
            {
                $project: {
                    unique_id: 1,
                    vehicle_id: 1,
                    customer_id: 1,
                    schedule_start_time: 1,
                    schedule_end_time: 1,
                    user_id: 1,
                    user_name: {
                        $concat: [
                            { $arrayElemAt: ["$users_details.first_name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$users_details.last_name", 0] }
                            
                        ]
                    },
                    title: { 
                        $concat: [
                            { $arrayElemAt: ["$brand_details.name", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$model_details.name", 0] }, 
                            " - ", 
                            { $arrayElemAt: ["$type_details.name", 0] }
                        ] 
                    },
                    plate_no: { $arrayElemAt: ["$vehicle_details.plate_no", 0] },
                    address: { $arrayElemAt: ["$vehicle_details.address", 0] },
                    total: 1,
                    trip_duration: 1,
                    currency: 1,
                    status: 1,
                    cancelled_by: { $toString: '$cancelled_by'},
                    total_additional_charge: 1,
                    payment_gateway_type : { $toString: '$payment_gateway_type'},
                    is_rated: {
                        $cond: {
                            if: { $eq: ["$is_user_rated", 1] },
                            then: true,
                            else: false
                        }
                    },
                    user_phone: 1,
                    user_phone_code: 1,
                    booking_type: 1,
                    delivery_fee: 1
                }
            },
            {
                $sort:{
                    unique_id: -1
                }
            }
        ]);
            
        return res.json({ success: true, rental_trips });
       
    } catch (error) {
        utils.error_response(error, req, res);
    }
}

exports.provider_handover_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'trip_id', type: 'string' }, { name: 'pre_reading', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let rental_trip = await Rental_Trip.findOne({ _id: req.body.trip_id, provider_id: req.body.provider_id });
        if (!rental_trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
            return;
        }

        if (rental_trip.payment_status != 1) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_PAYMENT_IS_PENDING });
            return;
        }

        if(rental_trip.booking_type == 1 && rental_trip.vehicle_price_details.delivery_time_type == 1){
            // for check fixed handover
            if(rental_trip?.vehicle_price_details?.handover_type == 1 && rental_trip?.vehicle_price_details?.handover_time?.length > 0){
                let now_time = new Date();
                let start_time = new Date(now_time);
                let end_time = new Date(now_time);
                let handover_time = rental_trip?.vehicle_price_details?.handover_time[0];

                // Split the start_time and end_time strings into hours and minutes
                let startTimeParts = handover_time.start_time.split(':');
                let endTimeParts = handover_time.end_time.split(':');

                // Set the hours and minutes for start and end time
                start_time.setHours(startTimeParts[0], startTimeParts[1]);
                end_time.setHours(endTimeParts[0], endTimeParts[1]);

                // Check if now_time is NOT between start_time and end_time
                if (now_time < start_time || now_time > end_time) {
                    return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_CANT_HANDOVER_VEHICLE_AT_THIS_MOMENT });
                }
            }
        }

        let user_detail = await User.findOne({_id: rental_trip.user_id})
        let trip_user_type = TYPE_VALUE.PROVIDER;
        let pre_distance = req.body.pre_reading || 0;

        rental_trip.status = RENTAL_TRIP_STATUS.DRIVER_HANDOVER;
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.DRIVER_HANDOVER, trip_user_type );
        rental_trip.provider_handover_time = new Date();
        rental_trip.pre_distance = Number(pre_distance);
        rental_trip.is_notified = false;
        await rental_trip.save();
        if(user_detail){
            utils.sendPushNotification(user_detail.device_type, user_detail.device_token, push_messages.PUSH_CODE_FOR_OWNER_HANDOVER_VEHICLE, "", user_detail.webpush_config, user_detail.lang_code);
        }
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_DRIVER_HANDOVER_VEHICLE_SUCCESSFULLY
        });
        
    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.user_handover_vehicle = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }, { name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_NOT_FOUND });
            return;
        }

        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let rental_trip = await Rental_Trip.findOne({ _id: req.body.trip_id, user_id: req.body.user_id });
        if (!rental_trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
        }
        // for check fixed handover
        if(rental_trip?.vehicle_price_details?.handover_type == 1 && rental_trip?.vehicle_price_details?.handover_time?.length > 0){
            let now_time = new Date();
            let start_time = new Date(now_time);
            let end_time = new Date(now_time);
            let handover_time = rental_trip?.vehicle_price_details?.handover_time[0];

            // Split the start_time and end_time strings into hours and minutes
            let startTimeParts = handover_time.start_time.split(':');
            let endTimeParts = handover_time.end_time.split(':');

            // Set the hours and minutes for start and end time
            start_time.setHours(startTimeParts[0], startTimeParts[1]);
            end_time.setHours(endTimeParts[0], endTimeParts[1]);

            // Check if now_time is NOT between start_time and end_time
            if (now_time < start_time || now_time > end_time) {
                return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_CANT_HANDOVER_VEHICLE_AT_THIS_MOMENT });
            }
        }

        let trip_user_type = TYPE_VALUE.USER;
        rental_trip.status = RENTAL_TRIP_STATUS.USER_HANDOVER;
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.USER_HANDOVER, trip_user_type );
        rental_trip.user_handover_time = new Date();
        await rental_trip.save();
        let provider_detail = await Provider.findOne({_id: rental_trip.provider_id})
        if(provider_detail){
            utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_messages.PUSH_CODE_FOR_USER_HANDOVER_VEHICLE, "", provider_detail.webpush_config, provider_detail.lang_code);
        }
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_USER_HANDOVER_VEHICLE_SUCCESSFULLY
        });
        
    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.driver_set_additional_charge = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'trip_id', type: 'string' }, { name: 'post_reading', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return;
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let rental_trip = await Rental_Trip.findOne({ _id: req.body.trip_id, provider_id: req.body.provider_id });
        if (!rental_trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
            return;
        }
        let user_detail = await User.findOne({_id: rental_trip.user_id});
        let trip_user_type = TYPE_VALUE.PROVIDER;
        let additional_charge_per_unit_distance = rental_trip.vehicle_price_details.additional_charge_per_unit_distance;
        let additional_charge_per_extra_day = rental_trip.vehicle_price_details.base_price;
        let max_distance_per_day = rental_trip.vehicle_price_details.max_distance_per_day;
        let trip_duration = rental_trip.trip_duration;
        let pre_distance = rental_trip.pre_distance;
        let post_distance = req.body.post_reading;
        let provider_additional_charge = req.body.additional_charge || 0;
        let trip_distance = Number(trip_duration) * Number(max_distance_per_day);
        let actual_trip_distance = Number(post_distance) - Number(pre_distance);
        let additional_distance = 0;
        let extra_days = 0;
        if(actual_trip_distance > 0){
            if(trip_distance < actual_trip_distance){
                additional_distance = Number(actual_trip_distance) - Number(trip_distance);
            }
        }

        let end_date = new Date(rental_trip.schedule_end_time);
        let now_date = new Date();

        // Calculate the difference in time (milliseconds)
        let diffTime = now_date - end_date;
        if(diffTime > 0){
            let diffDays = diffTime / (1000 * 3600 * 24);
            extra_days = Math.ceil(diffDays);
        }

        if(additional_distance <= 0 && provider_additional_charge <= 0 && extra_days <= 0){
            let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), rental_trip.timezone);
            rental_trip.status = RENTAL_TRIP_STATUS.COMPLETED;
            rental_trip.post_distance = post_distance;
            rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.COMPLETED, trip_user_type );
            rental_trip.provider_completed_time = new Date();
            rental_trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
            let total_profit = Number(rental_trip.total) - Number(rental_trip.platform_fee);
            rental_trip.is_trip_completed = 1;
            rental_trip.is_trip_end = 1;
            rental_trip.provider_service_fees = total_profit;

            await utils.driver_non_availability_for_trip(rental_trip, rental_trip.vehicle_id);
            await rental_trip.save();
            if(user_detail){
                utils.sendPushNotification(user_detail.device_type, user_detail.device_token, push_messages.PUSH_CODE_BOOKING_COMPLETE, "", user_detail.webpush_config, user_detail.lang_code);
            }
            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_BOOKING_COMPLETED_SUCCESSFULLY
            });
        }

        rental_trip.additional_days = extra_days;
        rental_trip.status = RENTAL_TRIP_STATUS.ADDITIONAL_PAYMENT;
        rental_trip.post_distance = post_distance;
        let additional_days_charge = Number(extra_days) * Number(additional_charge_per_extra_day);
        rental_trip.additional_days_charge = additional_days_charge;
        rental_trip.base_price = rental_trip.base_price + additional_days_charge;
        rental_trip.trip_duration = rental_trip.trip_duration + extra_days;
        rental_trip.additional_charge_note = req.body.additional_description;
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.ADDITIONAL_PAYMENT, trip_user_type );
        rental_trip.additional_distance_charge = Number(additional_charge_per_unit_distance) * Number(additional_distance);
        rental_trip.additional_charge = Number(provider_additional_charge);
        rental_trip.total_additional_charge = (Number(additional_charge_per_unit_distance) * Number(additional_distance)) + Number(provider_additional_charge) + Number(additional_days_charge);
        rental_trip.total = Number(rental_trip.total) + Number(rental_trip.total_additional_charge);
        let total_profit = Number(rental_trip.total) - Number(rental_trip.platform_fee);
        rental_trip.provider_service_fees = total_profit;
        await rental_trip.save();
        if(user_detail){
            utils.sendPushNotification(user_detail.device_type, user_detail.device_token, push_messages.PUSH_CODE_OWNER_SET_ADDITIONAL_PAYMENT, "", user_detail.webpush_config, user_detail.lang_code);
        }
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_ADDITIONAL_CHARGE_SET_SUCCESSFULLY
        });

    } catch (err) {
        utils.error_response(err, req, res)
    }
}

exports.cancelrentaltrip = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' },
            { name: 'type', type: "string" }
        ];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let rental_trip = await Rental_Trip.findById(req.body.trip_id);         
        if (!rental_trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
        }

        let type = req.body.type || 1;
        let Table;
        switch (Number(type)) {
            case TYPE_VALUE.USER:
                Table = User;
                break;
            case TYPE_VALUE.PROVIDER:
                Table = Provider;
                break;
            default:
                Table = User;
                break;
        }
        
        let detail = await Table.findOne({ _id: req.body.user_id });
        if (!detail) {
            let error_code = error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND;
            if( Number(type) == TYPE_VALUE.PROVIDER ){
                error_code = error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND;
            }
            res.json({ success: false, error_code: error_code });
            return;
        }

        if (detail.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        if (rental_trip.is_trip_completed == 1) {
            return res.json({
                success: true,
                message: error_message.ERROR_CODE_BOOKING_ALREADY_COMPLETED
            });
        }

        if (rental_trip.is_trip_cancelled == 1 ) {
            return res.json({
                success: true,
                message: error_message.ERROR_CODE_BOOKING_ALREADY_CANCELLED
            });
        }

        let cancel_reason = req?.body?.reason || "";
        if(rental_trip.status >= RENTAL_TRIP_STATUS.DRIVER_HANDOVER){
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_CAN_NOT_BE_CANCELLED });
        }

        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), rental_trip.timezone);
        rental_trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        rental_trip.provider_completed_time = new Date();
        let status = rental_trip.status;
        let refund_amount = 0;
        let cancellation_charge = 0;
        if(Number(req.body.type) == TYPE_VALUE.USER){
            cancellation_charge = Number(rental_trip.platform_fee) + Number(rental_trip.vehicle_price_details.cancellation_price);
            refund_amount = Number(rental_trip.total) - Number(cancellation_charge);
        }

        if (status < RENTAL_TRIP_STATUS.PAYMENT || refund_amount <= 0) {
            rental_trip.cancel_reason = cancel_reason;
            rental_trip.is_trip_cancelled = 1;
            rental_trip.status = RENTAL_TRIP_STATUS.CANCELLED;
            let trip_user_type;
            let notification_device;
            let push_code;
            if(Number(req.body.type) == TYPE_VALUE.USER){
                rental_trip.cancelled_by = TYPE_VALUE.USER;
                trip_user_type = TYPE_VALUE.USER;
                notification_device = await Provider.findOne({_id: rental_trip.provider_id});
                push_code = push_messages.PUSH_CODE_USER_CANCEL_BOOKING
                await User.updateOne(
                    { _id: rental_trip.user_id },
                    { $inc: { rental_cancelled_request: 1 } }
                );
            } else if (Number(req.body.type) == TYPE_VALUE.PROVIDER) {
                rental_trip.cancelled_by = TYPE_VALUE.PROVIDER;
                trip_user_type = TYPE_VALUE.PROVIDER;
                notification_device = await User.findOne({_id: rental_trip.user_id});
                push_code = push_messages.PUSH_CODE_OWNER_CANCEL_BOOKING
                await Provider.updateOne(
                    { _id: rental_trip.provider_id },
                    { $inc: { rental_cancelled_request: 1 } }
                );
                await Car_Rent_Vehicle.updateOne(
                    { _id: rental_trip.vehicle_id },
                    { $inc: { cancelled_request: 1 } }
                );
            }
            rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.CANCELLED, trip_user_type )

            await Rental_Trip.updateOne({ _id: rental_trip._id }, rental_trip.getChanges())
            // Remove non-availability from vehicle
            let vehicle_detail = await Car_Rent_Vehicle.findOne({ _id: rental_trip.vehicle_id });
            vehicle_detail.non_availability = vehicle_detail.non_availability.filter((availability) => {
                return availability?.trip_id?.toString() !== rental_trip?._id?.toString();
            });

            // Update the vehicle with filtered non_availability first
            await Car_Rent_Vehicle.findByIdAndUpdate(
                rental_trip.vehicle_id,
                { $set: { non_availability: vehicle_detail.non_availability } }
            );
            if(notification_device){
                utils.sendPushNotification(notification_device.device_type, notification_device.device_token, push_code, "", notification_device.webpush_config, notification_device.lang_code);
            }

            return res.json({
                success: true,
                message: success_messages.MESSAGE_CODE_BOOKING_CANCELLED_SUCCESSFULLY
            });
        }

        // refund payment
        cards.refund_rental_payment(rental_trip, rental_trip.payment_intent_id, rental_trip.payment_gateway_type, refund_amount);
        rental_trip.refund_amount = refund_amount;
        rental_trip.is_amount_refund = true;

        rental_trip.cancel_reason = cancel_reason;
        rental_trip.is_trip_cancelled = 1;
        rental_trip.status = RENTAL_TRIP_STATUS.CANCELLED;
        let trip_user_type;
        let notification_device;
        let push_code;
        if(Number(req.body.type) == TYPE_VALUE.USER){
            rental_trip.is_cancellation_fee = 1;
            rental_trip.cancellation_price = cancellation_charge;
            rental_trip.provider_service_fees = rental_trip.vehicle_price_details.cancellation_price;
            rental_trip.cancelled_by = TYPE_VALUE.USER;
            trip_user_type = TYPE_VALUE.USER;
            notification_device = await Provider.findOne({_id: rental_trip.provider_id});
            push_code = push_messages.PUSH_CODE_USER_CANCEL_BOOKING
            await User.updateOne(
                { _id: rental_trip.user_id },
                { $inc: { rental_cancelled_request: 1 } }
            );
        } else if (Number(req.body.type) == TYPE_VALUE.PROVIDER) {
            rental_trip.cancelled_by = TYPE_VALUE.PROVIDER;
            trip_user_type = TYPE_VALUE.PROVIDER;
            notification_device = await User.findOne({_id: rental_trip.user_id});
            push_code = push_messages.PUSH_CODE_OWNER_CANCEL_BOOKING
            await Provider.updateOne(
                { _id: rental_trip.provider_id },
                { $inc: { rental_cancelled_request: 1 } }
            );
            await Car_Rent_Vehicle.updateOne(
                { _id: rental_trip.vehicle_id },
                { $inc: { cancelled_request: 1 } }
            );
        }
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.CANCELLED, trip_user_type )

        await Rental_Trip.updateOne({ _id: rental_trip._id }, rental_trip.getChanges())
        
        // Remove non-availability from vehicle
        let vehicle_detail = await Car_Rent_Vehicle.findOne({ _id: rental_trip.vehicle_id });
        vehicle_detail.non_availability = vehicle_detail.non_availability.filter((availability) => {
            return availability?.trip_id?.toString() !== rental_trip?._id?.toString();
        });

        // Update the vehicle with filtered non_availability first
        await Car_Rent_Vehicle.findByIdAndUpdate(
            rental_trip.vehicle_id,
            { $set: { non_availability: vehicle_detail.non_availability } }
        );
        if(notification_device){
            utils.sendPushNotification(notification_device.device_type, notification_device.device_token, push_code, "", notification_device.webpush_config, notification_device.lang_code);
        }
        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_BOOKING_CANCELLED_SUCCESSFULLY
        });
    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.user_get_rental_trip_vehicle_detail = async function (req, res) {
    try {
        let params_array = [
            { name: 'user_id', type: 'string' },
            { name: 'trip_id', type: 'string' }
        ];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let user_detail = await User.findOne({ _id: req.body.user_id });
        if (!user_detail) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
        }

        if (user_detail.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        let rental_trip = await Rental_Trip.findOne({_id: req.body.trip_id});         
        if (!rental_trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
        }

        let provider_lookup = {
            $lookup: {
                from: "providers",
                localField: "provider_id",
                foreignField: "_id",
                pipeline:[{ $project:{ first_name:1, last_name:1, picture:1, rental_rate:1, rental_completed_request:1 } }],
                as: "provider_details"
            }
        };

        let brand_lookup = {
            $lookup: {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1 } }],
                as: "brand_details"
            }
        };

        let model_lookup = {
            $lookup: {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, type_id:1 } }],
                as: "model_details"
            }
        };

        let type_lookup = {
            $lookup: {
                from: "car_rent_types",
                localField: "model_details.type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ plateform_fee:1, name:1 } }],
                as: "type_detail"
            }
        };

        let feature_lookup = {
            $lookup : {
                from: "car_rent_features",
                localField: "features",
                foreignField: "_id",
                pipeline:[{ $project:{ title:1 } }],
                as: "features_details"
            }
        };

        let project = {
            $project: {
                _id: 1,
                images: 1,
                features_details: 1,
                currency_sign: 1,
                title: { 
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] }, 
                        " ", 
                        { $arrayElemAt: ["$model_details.name", 0] }, 
                        " ", 
                        { $toString: "$year" }
                    ]
                },
                type: { $arrayElemAt: ["$type_detail.name", 0] },
                rate: {
                    $round: [
                        {
                            $cond: {
                                if: { $eq: [{ $type: "$rate" }, "int"] },
                                then: {
                                    $cond: {
                                        if: { $eq: ["$rate", 0] },
                                        then: 0.0,
                                        else: { $add: ["$rate", 0.00] }
                                    }
                                },
                                else: "$rate"
                            }
                        },
                        1
                    ]
                },
                provider_detail: {
                    rate: {
                        $round: [
                            {
                                $cond: {
                                    if: { $eq: [{ $type: { $arrayElemAt: ["$provider_details.rental_rate", 0] } }, "int"] },
                                    then: {
                                        $cond: {
                                            if: { $eq: [{ $arrayElemAt: ["$provider_details.rental_rate", 0] }, 0] },
                                            then: 0.0,
                                            else: { $add: [{ $arrayElemAt: ["$provider_details.rental_rate", 0] }, 0.00] }
                                        }
                                    },
                                    else: { $arrayElemAt: ["$provider_details.rental_rate", 0] }
                                }
                            },
                            1
                        ]
                    },                    
                    name: { 
                        $concat: [
                            { $arrayElemAt: ["$provider_details.first_name", 0] },
                            " ", 
                            { $arrayElemAt: ["$provider_details.last_name", 0] }
                        ]
                    },
                    picture: { 
                        $arrayElemAt: ["$provider_details.picture", 0]
                    },
                    completed_request: { 
                        $toString: { 
                            $arrayElemAt: ["$provider_details.rental_completed_request", 0]
                        }
                    }
                },
                distance_unit: {
                    $cond: {
                        if: { $eq: ["$unit", 0] },
                        then: 'mi',
                        else: 'km'
                    }
                }
            }
        };

        let vehicle_condition = { _id : Schema(rental_trip.vehicle_id)};

        let vehicle_detail = await Car_Rent_Vehicle.aggregate([
            { $match: vehicle_condition }, 
            provider_lookup, 
            brand_lookup, 
            model_lookup,
            type_lookup,
            feature_lookup,
            project
        ]);

        if(vehicle_detail.length == 0){
            return res.json({success : true, vehicle_detail: {} })
        }else {
            // vehicle price detail
            vehicle_detail[0].cancellation_charge = String(rental_trip.vehicle_price_details.cancellation_price);
            vehicle_detail[0].base_price = String(rental_trip.vehicle_price_details.base_price);
            vehicle_detail[0].platform_fee = String(rental_trip.vehicle_price_details.platform_fee);
            vehicle_detail[0].max_distance_per_day = String(rental_trip.vehicle_price_details.max_distance_per_day);
            vehicle_detail[0].additional_charge_per_unit_distance = String(rental_trip.vehicle_price_details.additional_charge_per_unit_distance);
            // vehicle comman detail
            vehicle_detail[0].color = rental_trip.vehicle_price_details.color;
            vehicle_detail[0].address = rental_trip.address;
            vehicle_detail[0].location = rental_trip.location;
            vehicle_detail[0].plate_no = rental_trip.vehicle_price_details.plate_no;
            vehicle_detail[0].unique_no = rental_trip.vehicle_price_details.unique_no;
            vehicle_detail[0].fuel_type = rental_trip.vehicle_price_details.fuel_type;
            vehicle_detail[0].no_of_seats = rental_trip.vehicle_price_details.no_of_seats;
            vehicle_detail[0].description = rental_trip.vehicle_price_details.description;
            vehicle_detail[0].transmission_type = rental_trip.vehicle_price_details.transmission_type;
            vehicle_detail[0].start_date = rental_trip.schedule_start_time;
            vehicle_detail[0].end_date = rental_trip.schedule_end_time;
            vehicle_detail[0].booking_type = rental_trip.booking_type;
            vehicle_detail[0].delivery_fee = rental_trip.delivery_fee;

            return res.json({success : true, vehicle_detail: vehicle_detail[0] })
        }

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.provider_get_rental_trip_vehicle_detail = async function (req, res) {
    try {
        let params_array = [
            { name: 'provider_id', type: 'string' },
            { name: 'trip_id', type: 'string' }
        ];
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }

        let provider_detail = await Provider.findOne({ _id: req.body.provider_id });
        if (!provider_detail) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
        }

        if (provider_detail.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        let rental_trip = await Rental_Trip.findOne({_id: req.body.trip_id});         
        if (!rental_trip) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND });
        }
        let user = await User.findOne({_id: rental_trip.user_id}).select({ rental_rate:1, rental_completed_request:1, picture:1, first_name:1, last_name:1 })

        let brand_lookup = {
            $lookup: {
                from: "car_rent_brands",
                localField: "brand_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1 } }],
                as: "brand_details"
            }
        };

        let model_lookup = {
            $lookup: {
                from: "car_rent_models",
                localField: "model_id",
                foreignField: "_id",
                pipeline:[{ $project:{ name:1, type_id:1 } }],
                as: "model_details"
            }
        };

        let type_lookup = {
            $lookup: {
                from: "car_rent_types",
                localField: "model_details.type_id",
                foreignField: "_id",
                pipeline:[{ $project:{ plateform_fee:1, name:1 } }],
                as: "type_detail"
            }
        };

        let feature_lookup = {
            $lookup : {
                from: "car_rent_features",
                localField: "features",
                foreignField: "_id",
                pipeline:[{ $project:{ title:1 } }],
                as: "features_details"
            }
        };

        let project = {
            $project: {
                _id: 1,
                images: 1,
                features_details: 1,
                currency_sign: 1,
                title: { 
                    $concat: [
                        { $arrayElemAt: ["$brand_details.name", 0] }, 
                        " ", 
                        { $arrayElemAt: ["$model_details.name", 0] }, 
                        " ", 
                        { $toString: "$year" }
                    ]
                },
                type: { $arrayElemAt: ["$type_detail.name", 0] },
                rate: {
                    $round: [
                        {
                            $cond: {
                                if: { $eq: [{ $type: "$rate" }, "int"] },
                                then: {
                                    $cond: {
                                        if: { $eq: ["$rate", 0] },
                                        then: 0.0,
                                        else: { $add: ["$rate", 0.00] }
                                    }
                                },
                                else: "$rate"
                            }
                        },
                        1
                    ]
                },
                distance_unit: {
                    $cond: {
                        if: { $eq: ["$unit", 0] },
                        then: 'mi',
                        else: 'km'
                    }
                }
            }
        };

        let vehicle_condition = { _id : Schema(rental_trip.vehicle_id)};

        let vehicle_detail = await Car_Rent_Vehicle.aggregate([
            { $match: vehicle_condition }, 
            brand_lookup, 
            model_lookup,
            type_lookup,
            feature_lookup,
            project
        ]);

        if(vehicle_detail.length == 0){
            return res.json({success : true, vehicle_detail: {} })
        }else {
            // vehicle price detail
            vehicle_detail[0].cancellation_charge = String(rental_trip.vehicle_price_details.cancellation_price);
            vehicle_detail[0].base_price = String(rental_trip.vehicle_price_details.base_price);
            vehicle_detail[0].platform_fee = String(rental_trip.vehicle_price_details.platform_fee);
            vehicle_detail[0].max_distance_per_day = String(rental_trip.vehicle_price_details.max_distance_per_day);
            vehicle_detail[0].additional_charge_per_unit_distance = String(rental_trip.vehicle_price_details.additional_charge_per_unit_distance);
            // vehicle comman detail
            vehicle_detail[0].color = rental_trip.vehicle_price_details.color;
            vehicle_detail[0].address = rental_trip.address;
            vehicle_detail[0].location = rental_trip.location;
            vehicle_detail[0].plate_no = rental_trip.vehicle_price_details.plate_no;
            vehicle_detail[0].unique_no = rental_trip.vehicle_price_details.unique_no;
            vehicle_detail[0].fuel_type = rental_trip.vehicle_price_details.fuel_type;
            vehicle_detail[0].no_of_seats = rental_trip.vehicle_price_details.no_of_seats;
            vehicle_detail[0].description = rental_trip.vehicle_price_details.description;
            vehicle_detail[0].transmission_type = rental_trip.vehicle_price_details.transmission_type;
            vehicle_detail[0].start_date = rental_trip.schedule_start_time;
            vehicle_detail[0].end_date = rental_trip.schedule_end_time;
            vehicle_detail[0].booking_type = rental_trip.booking_type;
            vehicle_detail[0].delivery_fee = rental_trip.delivery_fee;
            vehicle_detail[0].user_detail = {
                name: `${user.first_name} ${user.last_name}`,
                picture: user.picture,
                rate: user.rental_rate || 0,
                completed_request: String(user.rental_completed_request)
            }

            return res.json({success : true, vehicle_detail: vehicle_detail[0] })
        }

    } catch (err) {
        utils.error_response(err, req, res)
    }
};

exports.user_rental_rating = async function (req, res) {
    try {
        let params_array = [{ name: 'user_id', type: 'string' }, { name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let user = await User.findOne({ _id: req.body.user_id })
        if (!user) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_USER_DETAIL_NOT_FOUND });
            return;
        }
        if (req.body.token != null && user.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return;
        }

        let trip = await Rental_Trip.findOne({ _id: req.body.trip_id })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND })
            return
        }
        if (trip.is_trip_completed == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_IS_NOT_END });
            return
        }

        // provider rating
        let provider = await Provider.findOne({ _id: trip.provider_id });
        let provider_rating = req.body.provider_rating;
        let provider_old_rate = provider.rental_rate;
        let provider_old_rate_count = provider.rental_rate_count;
        let provider_new_rate = ((Number(provider_old_rate) * Number(provider_old_rate_count)) + Number(provider_rating)) / Number(provider_old_rate_count + 1).toFixed(2);
        provider.rental_rate = Number(provider_new_rate);
        provider.rental_rate_count++;
        trip.provider_review = "";
        trip.is_provider_rated = 1;
        trip.provider_rating = req.body.provider_rating;

        // vehicle rating
        let vehicle = await Car_Rent_Vehicle.findOne({ _id: trip.vehicle_id });
        let vehicle_rating = req.body.vehicle_rating;
        let vehicle_old_rate = vehicle.rate;
        let vehicle_old_rate_count = vehicle.rate_count;
        let vehicle_new_rate = ((Number(vehicle_old_rate) * Number(vehicle_old_rate_count)) + Number(vehicle_rating)) / Number(vehicle_old_rate_count + 1).toFixed(2);
        vehicle.rate = Number(vehicle_new_rate);
        vehicle.rate_count++;
        trip.is_vehicle_rated = 1;
        trip.vehicle_review = req.body.review;
        trip.vehicle_rating = req.body.vehicle_rating;
        
        await Promise.all([
            Provider.updateOne({ _id: provider._id }, provider.getChanges()),
            Car_Rent_Vehicle.updateOne({ _id: vehicle._id }, vehicle.getChanges()),
            Rental_Trip.updateOne({ _id: trip._id }, trip.getChanges())
        ]);        

        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_USER_GIVE_RATING_SUCCESSFULLY
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }

}

exports.provider_rental_rating = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'trip_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let provider = await Provider.findOne({ _id: req.body.provider_id })
        if (!provider) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
            return
        }

        if (req.body.token != null && provider.token != req.body.token) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
            return
        }
        let trip = await Rental_Trip.findOne({ _id: req.body.trip_id })
        if (!trip) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_BOOKING_DETAIL_NOT_FOUND })
            return
        }
        if (trip.is_trip_completed == 0) {
            res.json({ success: false, error_code: error_message.ERROR_CODE_YOUR_TRIP_IS_NOT_END });
            return
        }

        // user rating
        let user = await User.findOne({ _id: trip.user_id });
        let user_rating = req.body.user_rating;
        let user_old_rate = user.rental_rate;
        let user_old_rate_count = user.rental_rate_count;
        let user_new_rate = ((Number(user_old_rate) * Number(user_old_rate_count)) + Number(user_rating)) / Number(user_old_rate_count + 1).toFixed(2);
        user.rental_rate = Number(user_new_rate);
        user.rental_rate_count++;
        trip.is_user_rated = 1;
        trip.user_review = req.body.review;
        trip.user_rating = req.body.user_rating;

        await Promise.all([
            User.updateOne({ _id: user._id }, user.getChanges()),
            Rental_Trip.updateOne({ _id: trip._id }, trip.getChanges())
        ]);        

        return res.json({
            success: true,
            message: success_messages.MESSAGE_CODE_FOR_PROVIDER_GIVE_RATING_SUCCESSFULLY
        });
    } catch (error) {
        utils.error_response(error, req, res)
    }
};
