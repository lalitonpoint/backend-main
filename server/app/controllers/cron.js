let utils = require('./utils');
let myTrips = require('./trip');
let allemails = require('../controllers/emails');
let Trip = require('mongoose').model('Trip');
let Trip_history = require('mongoose').model('Trip_history');
let Promo_Code = require('mongoose').model('Promo_Code');
let User_promo_use = require('mongoose').model('User_promo_use');
let User = require('mongoose').model('User');
let Provider = require('mongoose').model('Provider');
let Settings = require('mongoose').model('Settings');
let Partner = require('mongoose').model('Partner');
let Provider_Document = require('mongoose').model('Provider_Document');
let User_Document = require('mongoose').model('User_Document');
let moment = require('moment');
const moment_timezone = require('moment-timezone');
let City = require('mongoose').model('City');
let Reviews = require('mongoose').model('Reviews');
let Country = require('mongoose').model('Country');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Provider_Daily_Analytic = require('mongoose').model('provider_daily_analytic');
let cron = require('./cron');
let myAnalytics = require('./provider_analytics');
let { createClient } = require("redis")
let client = createClient({ legacyMode: true })
client.connect().catch(console.error)
let CronJob = require('cron-cluster')(client).CronJob
const Admin_Profit = require('mongoose').model('admin_profit');
let Vehicle = require('mongoose').model('Vehicle');
let OpenRide = require('mongoose').model('Open_Ride');
let mongoose = require('mongoose');
var wsal_services = require('../controllers/wsal_controller');
let Car_Rent_Vehicle = require('mongoose').model("Car_Rent_Vehicle");
let Rental_Trip = require('mongoose').model("Rental_Trip");
const {
    PROVIDER_STATUS,
    TRIP_STATUS_TIMELIME,
    PROVIDER_TYPE,
    SMS_TEMPLATE,
    OPEN_RIDE_STATUS,
    OPEN_RIDE_CANCEL_REASON,
    RENTAL_TRIP_STATUS,
    TYPE_VALUE
} = require('./constant');

let run_continue_30_sec_cron = new CronJob('*/30 * * * * *', async function () {
    let now = new Date();
    let date1 = new Date();
    date1.setSeconds(date1.getSeconds() - 30);

    let setting_data = await Settings.findOne({})
    let scheduled_request_pre_start_minute = setting_data.scheduled_request_pre_start_minute;
    let scheduled_request_start_time = now.setMinutes(now.getMinutes() + scheduled_request_pre_start_minute);
    scheduled_request_start_time = new Date(scheduled_request_start_time);
    let scheduledTrips = await Trip.find({
        is_schedule_trip: true,
        is_trip_cancelled: 0,
        is_trip_completed: 0,
        is_trip_end: 0,
        provider_id: null,
        find_nearest_provider_time: null,
        $or: [{is_provider_accepted: 0},{ current_providers: []}],
        server_start_time_for_schedule: { $lte: scheduled_request_start_time }
    })

    for (const scheduledTrip of scheduledTrips) {
        let user = await User.findOne({
            _id: scheduledTrip.user_id,
            $or: [
                { current_trip_id: null },
                { current_trip_id: scheduledTrip._id }
            ]
        })

        if (user) {
            if (scheduledTrip.confirmed_provider && scheduledTrip.is_provider_assigned_by_dispatcher) {
                let provider = await Provider.findById({ _id: scheduledTrip.current_provider })
                if(provider.is_available == 1 && provider.is_trip.length == 0) {
                    await Provider.findOneAndUpdate({ _id: provider._id }, { $push: { is_trip: scheduledTrip._id }, is_available: 0})
                    myTrips.accept_trip(provider, scheduledTrip)
                    await User.updateOne({ _id: scheduledTrip.user_id }, { current_trip_id: scheduledTrip._id });
                    setTimeout(() => {
                        utils.send_socket_request(scheduledTrip._id, provider._id, true);
                    }, 1500);
                }else{

                    await Provider.findOneAndUpdate({ _id: provider._id }, { $pull: { schedule_trip: scheduledTrip._id }})
                    if(scheduledTrip.is_provider_assigned_by_dispatcher && scheduledTrip.current_provider) {
                        await Provider.findOneAndUpdate({ _id: scheduledTrip.current_provider }, { $pull: { schedule_trip: scheduledTrip._id }})
                        myTrips.reject_trip(provider, scheduledTrip, true)
                    }
                    create_scheduled_trip(scheduledTrip);
                }
            } else {
                if(scheduledTrip.is_provider_assigned_by_dispatcher && scheduledTrip.current_provider) {
                    let provider = await Provider.findById({ _id: scheduledTrip.current_provider })
                    await Provider.findOneAndUpdate({ _id: scheduledTrip.current_provider }, { $pull: { schedule_trip: scheduledTrip._id }})
                    myTrips.reject_trip(provider, scheduledTrip, true)
                }
                create_scheduled_trip(scheduledTrip);
            }
        }
    }

    // for open ride
    let scheduledOpenRides = await OpenRide.find({
      is_schedule_trip: false,
      is_trip_cancelled: 0,
      is_trip_completed: 0,
      is_trip_end: 0,
      is_provider_accepted: 0,
      server_start_time_for_schedule: { $lte: new Date() }
    });

    for (const scheduledTrip of scheduledOpenRides) {
        check_ride_for_cron(scheduledTrip)
    }

    let provider_timeout;
    let trips = await Trip.find({
        is_provider_status: 0,
        is_provider_accepted: 0,
        is_trip_cancelled: 0,
        bids: []
    })
    for (const trip of trips) {
        if (trip.is_trip_bidding) {
            let country_detail = await Country.findOne({ _id: trip.country_id }, { provider_bidding_timeout: 1 });
            provider_timeout = country_detail.provider_bidding_timeout;
        } else {
            provider_timeout = setting_data.provider_timeout;
        }
        check_provider(trip, provider_timeout + 7)
    }

    let mTrip = require('./trip');

    let bidding_trips = await Trip.find({
        is_provider_status: 0,
        is_provider_accepted: 0,
        is_trip_cancelled: 0,
        is_trip_bidding: true,
        bids: { $ne: [] }
    })
    for (const trip of bidding_trips) {
        trip.bids.forEach(async (bid) => {
            console.log(bid.bid_end_at);
            console.log(new Date(bid.bid_end_at));
            if (bid.bid_end_at < new Date()) {

                let req = {
                    body: {
                        user_id: trip.user_id.toString(),
                        is_from_cron: true,
                        trip_id: trip._id.toString(),
                        provider_id: bid.provider_id.toString(),
                    }
                }
                await mTrip.user_reject_bid(req, null)
            }
        })
    }


    Provider.find({ is_active: 1, is_trip: { $ne: [] } }).then((providers) => {
        providers.forEach(function (provider) {
            check_provider_trip(provider)
        });
    }, (err) => {
        console.log(err)
    });

    now = new Date()
    let location_updated_time = now.setMinutes(now.getMinutes() - setting_data.provider_offline_min);
    location_updated_time = new Date(location_updated_time);

    Provider.find({ is_active: 1, is_available: 1, is_trip: [], bids: [], location_updated_time: { $lt: location_updated_time } }).then((providers) => {
        providers.forEach(function (provider) {
            check_provider_online(provider);
        });
    }, (err) => {
        console.log(err)
    });

    // for rental trips
    let rentalTrips = await Rental_Trip.find({
        status: {$lte: RENTAL_TRIP_STATUS.ACCEPTED},
        payment_status: 0,
        is_trip_cancelled: 0,
        is_trip_completed: 0,
        schedule_start_time: { $lte: new Date() }
    });
  
    for (const rentalTrip of rentalTrips) {
        cancel_rental_trip(rentalTrip._id)
    }
    // pre notification for user and owner
    now = new Date()
    let rental_trip_pre_notification_time = now.setMinutes(now.getMinutes() + setting_data.rental_trip_pre_notification_time);
    rental_trip_pre_notification_time = new Date(rental_trip_pre_notification_time);
    let paidRentalTrips = await Rental_Trip.find({
        status: { $eq: RENTAL_TRIP_STATUS.PAYMENT },
        payment_status: 1,
        is_trip_cancelled: 0,
        is_trip_completed: 0,
        is_notified: false,
        schedule_start_time: { $lte: rental_trip_pre_notification_time }
    });
  
    for (const rentalTrip of paidRentalTrips) {
        console.log(rentalTrip.unique_id);
        rental_pre_notification(rentalTrip._id)
    }

    // post notification for user
    let postRentalTrips = await Rental_Trip.find({
        status: { $eq: RENTAL_TRIP_STATUS.DRIVER_HANDOVER },
        payment_status: 1,
        is_trip_cancelled: 0,
        is_trip_completed: 0,
        is_notified: false,
        schedule_end_time: { $lte: rental_trip_pre_notification_time }
    });
  
    for (const rentalTrip of postRentalTrips) {
        console.log(rentalTrip.unique_id);
        rental_post_notification(rentalTrip._id)
    }
});
run_continue_30_sec_cron.start();

async function rental_post_notification(rentalTrip) {
    let rental_trip = await Rental_Trip.findOne({ _id: rentalTrip });
    if(rental_trip){
        rental_trip.is_notified = true;
        await Rental_Trip.updateOne({ _id: rental_trip._id }, rental_trip.getChanges());
    
        let end_time = moment_timezone(rental_trip.schedule_end_time).tz(rental_trip.timezone).format('HH:mm');

        let user = await User.findOne({_id: rental_trip.user_id}).select("device_type device_token");
        if(user){
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_YOUR_RENTAL_BOOKING_WILL_END_SHORTLY, {trip_id: rental_trip.unique_id, end_time}, null, user.lang_code);
        }
    }
}

async function rental_pre_notification(rentalTrip) {
    let rental_trip = await Rental_Trip.findOne({ _id: rentalTrip });
    if(rental_trip){
        rental_trip.is_notified = true;
        await Rental_Trip.updateOne({ _id: rental_trip._id }, rental_trip.getChanges());
    
        let pickup_time = moment_timezone(rental_trip.schedule_start_time).tz(rental_trip.timezone).format('HH:mm');

        let user = await User.findOne({_id: rental_trip.user_id}).select("device_type device_token");
        if(user){
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_YOUR_RENTAL_WILL_START_SHORTLY_USER, {trip_id: rental_trip.unique_id, pickup_time}, null, user.lang_code);
        }
        let provider = await Provider.findOne({_id: rental_trip.provider_id}).select("device_type device_token");
        if(provider){
            utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_YOUR_RENTAL_WILL_START_SHORTLY_OWNER, {trip_id: rental_trip.unique_id, pickup_time}, null, provider.lang_code);
        }
    }
}

async function cancel_rental_trip(rentalTrip) {
    let rental_trip = await Rental_Trip.findOne({ _id: rentalTrip });
    if(rental_trip){
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), rental_trip.timezone);
        rental_trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        rental_trip.provider_completed_time = new Date();
        rental_trip.is_trip_cancelled = 1;
        rental_trip.cancelled_by = TYPE_VALUE.ADMIN;
        rental_trip.status = RENTAL_TRIP_STATUS.CANCELLED;
        rental_trip.trip_status = await utils.addTripStatusTimeline(rental_trip, RENTAL_TRIP_STATUS.CANCELLED, TYPE_VALUE.ADMIN);

        await Rental_Trip.updateOne({ _id: rental_trip._id }, rental_trip.getChanges());
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
        if(rental_trip.status == RENTAL_TRIP_STATUS.CREATED){
            let user = await User.findOne({_id: rental_trip.user_id}).select("device_type device_token");
            if(user){
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_RENTAL_BOOKING_TIME_PASSED_NO_RESPONSE_FROM_OWNER, {trip_id: rental_trip.unique_id}, null, user.lang_code);
            }
        }
        if(rental_trip.status == RENTAL_TRIP_STATUS.ACCEPTED){
            let user = await User.findOne({_id: rental_trip.user_id}).select("device_type device_token");
            if(user){
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_RENTAL_BOOKING_TIME_PASSED_NOT_PAID_BY_USER, {trip_id: rental_trip.unique_id}, null, user.lang_code);
            }
            let provider = await Provider.findOne({_id: rental_trip.provider_id}).select("device_type device_token");
            if(provider){
                utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_RENTAL_BOOKING_TIME_PASSED_NOT_PAID_BY_USER, {trip_id: rental_trip.unique_id}, null, provider.lang_code);
            }
        }

    }
}

async function check_provider_trip(provider) {
    Trip.find({ _id: { $in: provider.is_trip } }).then(trips => {
        trips.forEach(trip => {
            if (trip && (trip.is_trip_completed == 1 || trip.is_trip_cancelled == 1)) {
                provider = utils.remove_is_trip_from_provider(provider, trip._id, trip.initialDestinationLocation)
            }
        })
        provider.save();
    })
}

async function check_provider_online(provider) {
    City.findOne({ _id: provider.cityid }).then(async (city) => {
        let city_timezone = city.timezone;

        Trip.findOne({ is_provider_status: 0, current_providers: provider._id }).then(async (trip) => {

            let is_offline = 0;
            if (trip) {
                if (trip.is_trip_completed == 1 || trip.is_trip_cancelled == 1) {
                    is_offline = 1;
                }
            } else {
                is_offline = 1;
            }


            if (is_offline == 1) {
                let start_time = provider.location_updated_time;
                provider.is_active = 0;
                await provider.save();
                // Start push Added by Bharti 2 May //
                let device_token = provider.device_token;
                let device_type = provider.device_type;
                utils.sendPushNotification(device_type, device_token, push_messages.PUSH_CODE_FOR_PROVIDER_OFFLINE, "", null, provider.lang_code);
                // End push Added by Bharti 2 May //
                if(provider.zone_queue_id){
                    await utils.remove_from_zone_queue_new(provider);
                }

                // Entry in daily analytic //
                myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, 0, start_time);
                // }
            }
        }, (err) => {
            console.log(err)
        });
    }, (err) => {
        console.log(err)

    });
}

async function check_provider(trip, total_timeout) {
    let start_time = trip.find_nearest_provider_time;
    let end_time = new Date();
    let time_diff = utils.getTimeDifferenceInSecond(end_time, start_time);

    if (time_diff > total_timeout) {
        if (trip.current_providers.length > 0) {
            let provider_list = await Provider.find({ _id: trip.current_providers })
            for (const provider of provider_list) {
                let is_trip_condition = { _id: provider._id, is_trip: trip._id };
                let is_trip_update = { is_available: 1, is_trip: [] };

                if (provider.is_trip.length > 1) {
                    is_trip_update = { is_available: 0, $pull: { is_trip: trip._id } };
                }

                if (!provider.is_near_trip) { provider.is_near_trip = [] }
                if (provider.is_near_trip.length != 0) {
                    is_trip_condition = { _id: provider._id, is_near_trip: trip._id };
                    is_trip_update = { is_near_available: 1, is_near_trip: [] };
                }

                provider.bids = provider.bids.filter(function (bid) { return (bid.trip_id).toString() !== (trip._id).toString(); });
                is_trip_update.bids = provider.bids

                await Provider.updateOne(is_trip_condition, is_trip_update);
                utils.remove_from_zone_queue_new(provider);

                trip.bids = trip.bids.filter(function (bid) { return (bid.provider_id).toString() !== (provider._id).toString(); });
            }
        }
        if (trip.is_schedule_trip) {
            console.log(`---------------providers_id_that_rejected_trip(${trip.unique_id})(${trip.no_of_time_send_request}) : ${trip.providers_id_that_rejected_trip}---------------`);
            console.log(`---------------current_providers(${trip.unique_id})(${trip.no_of_time_send_request}) : ${trip.current_providers}---------------`);
            trip.providers_id_that_rejected_trip = trip.providers_id_that_rejected_trip.concat(trip.current_providers);
            trip.providers_id_that_rejected_trip = [...new Set(trip.providers_id_that_rejected_trip)];

            await Trip.findOneAndUpdate({ _id: trip._id }, { $addToSet: {providers_id_that_rejected_trip_for_schedule: trip.current_provider}})
            
            create_scheduled_trip(trip)

            // This below code caused the scheduled trip to get stuck in an infinite loop as it never reached the maximum number of attempts required to cancel the request.
            // So incrementing 'no_of_time_send_request' is important to keep track of how many times we have attempted to find a driver for the scheduled trip.
            // let nearest_provider_response = await myTrips.nearest_provider(trip, null, [])
            // if (!nearest_provider_response.success) {
            //     console.log(`---------------check_provider_driver_not_found_for_loop(${trip.unique_id})(${trip.no_of_time_send_request})---------------`);
            //     await Trip.updateOne({ _id: trip._id }, {
            //         current_providers: [],
            //         current_provider: null,
            //         provider_unique_id: null,
            //         provider_phone_code: "",
            //         provider_phone: "",
            //         provider_first_name: "",
            //         provider_last_name: "",
            //         bids: [],
            //         find_nearest_provider_time: null,
            //         providers_id_that_rejected_trip: []
            //     })
            // }
        } else {
            trip.providers_id_that_rejected_trip = trip.providers_id_that_rejected_trip.concat(trip.current_providers);
            trip.providers_id_that_rejected_trip = [...new Set(trip.providers_id_that_rejected_trip)];
            let nearest_provider_response = await myTrips.nearest_provider(trip, null, [])
            if (!nearest_provider_response.success) {
                await User.updateOne({ _id: trip.user_id }, { current_trip_id: null })
            }
        }
    }
}

async function create_scheduled_trip(trip) {
    const setting_detail = await Settings.findOne({});

    trip.no_of_time_send_request = trip.no_of_time_send_request + 1;
    trip.is_provider_assigned_by_dispatcher = false
    if (trip.no_of_time_send_request == 1) {
        console.log(`---------------create_scheduled_trip(${trip.unique_id})---------------`);
    }
    console.log(`---------------no_of_time_send_request(${trip.unique_id}) : ${trip.no_of_time_send_request}---------------`);
    if (Number(trip.no_of_time_send_request) <= Number(setting_detail.number_of_try_for_scheduled_request)) {
        trip.current_providers = []
        trip.current_provider = null
        trip.provider_unique_id = null;
        trip.provider_first_name = ""
        trip.provider_last_name = ""
        trip.provider_phone_code = ""
        trip.provider_phone = ""
        trip.find_nearest_provider_time = null
        trip.providers_id_that_rejected_trip = []
        let nearest_provider_response = await myTrips.nearest_provider(trip, null, [])
        if (nearest_provider_response.success) {
            await User.updateOne({ _id: trip.user_id }, { current_trip_id: trip._id });
        }
        if (!nearest_provider_response.success) {
            console.log(`---------------driver_not_found_for_loop(${trip.unique_id})(${trip.no_of_time_send_request})---------------`);
            await Trip.updateOne({ _id: trip._id }, {
                current_providers: [],
                current_provider: null,
                provider_unique_id: null,
                provider_phone_code: "",
                provider_phone: "",
                provider_first_name: "",
                provider_last_name: "",
                find_nearest_provider_time: null,
                providers_id_that_rejected_trip: []
            })
        }
    } else {
        console.log(`---------------scheduled_trip_cancelled(${trip.unique_id})---------------`);
        trip.is_trip_cancelled = 1;
        trip.current_provider = null;
        trip.current_providers = [];
        trip.is_schedule_trip = false;
        let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), trip.timezone);
        let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        trip.complete_date_in_city_timezone = complete_date_in_city_timezone;
        trip.complete_date_tag = complete_date_tag;
        trip.provider_trip_end_time = new Date();

        // Set trip status
        trip.trip_status = await utils.addTripStatusTimeline(trip, TRIP_STATUS_TIMELIME.TRIP_CANCELLED, null, "System")

        await Trip.updateOne({ _id: trip._id }, trip.getChanges())

       await utils.remove_trip_promo_code(trip)
        utils.update_request_status_socket(trip._id);

        await utils.move_trip_to_completed(trip._id)

        await User.updateOne({ _id: trip.user_id }, { current_trip_id: null })
    }
}

// run_continue_30_min_cron
let run_continue_30_min_cron = new CronJob('0 */30 * * * *', function () {
    City.find({}).then((city_details) => {
        if (city_details) {
            city_details.forEach(async function (city_detail) {
                let city_timezone = city_detail.timezone;
                if (city_timezone != "" && city_timezone != undefined) {
                    let city_date_now = new Date();
                    let city_date_next = city_detail.daily_cron_date;
                    if (!city_date_next) {
                        city_date_next = new Date();
                        city_date_next = city_date_next.setMinutes(city_date_now.getMinutes() - 2);
                        city_date_next = utils.get_date_now_at_city(city_date_next, city_timezone);
                    } else {
                        city_date_next = city_date_next.setMinutes(city_date_next.getMinutes());
                        city_date_next = utils.get_date_now_at_city(city_date_next, city_timezone);
                    }
                    city_date_now = city_date_now.setMinutes(city_date_now.getMinutes());
                    city_date_now = utils.get_date_now_at_city(city_date_now, city_timezone);
                    let city_date_now_tag = moment.utc(city_date_now).format("DDMMYYYY");

                    let city_date_next_tag = moment.utc(city_date_next).format("DDMMYYYY");


                    if (city_date_now_tag != city_date_next_tag) {
                        city_detail.daily_cron_date = new Date();
                        city_detail.save();
                        city_date_now = new Date();
                        city_date_now = city_date_now.setMinutes(city_date_now.getMinutes() - 1);
                        city_date_now = new Date(city_date_now);
                        check_provider_document_expired(city_detail._id, city_timezone);
                        cron.getOnlineProviderAnalytics(city_detail._id, city_timezone, city_date_now);
                        provider_auto_transfer(city_detail);
                        provider_rental_profit_auto_transfer(city_detail);
                        check_provider_vehicle(city_detail);
                        const setting_detail = await Settings.findOne({});
                        let country_data = await Country.findOne({_id:city_detail.countryid})
                        if(setting_detail.is_wsal_service_use && country_data.is_use_wsal){
                            check_driver_wsal_status(city_detail);
                            check_driver_wsal_status_for_expiry(city_detail);
                            check_driver_for_unblocked(city_detail);
                        }
                    }
                }

            });
        }
    }, (err) => {
        console.log(err)

    });

    Country.find({}).then((country_list) => {
        country_list.forEach(function (country_detail) {
            let city_timezone = country_detail.countrytimezone;
            if (city_timezone != "" && city_timezone != undefined) {
                let city_date_now = new Date();
                let city_date_next = country_detail.daily_cron_date;
                if (!city_date_next) {
                    city_date_next = new Date();
                    city_date_next = city_date_next.setMinutes(city_date_next.getMinutes() - 2);
                    city_date_next = utils.get_date_now_at_city(city_date_next, city_timezone);
                } else {
                    city_date_next = city_date_next.setMinutes(city_date_next.getMinutes());
                    city_date_next = utils.get_date_now_at_city(city_date_next, city_timezone);
                }

                city_date_now = city_date_now.setMinutes(city_date_now.getMinutes());
                city_date_now = utils.get_date_now_at_city(city_date_now, city_timezone);
                let city_date_now_tag = moment.utc(city_date_now).format("DDMMYYYY");

                let city_date_next_tag = moment.utc(city_date_next).format("DDMMYYYY");

                if (city_date_now_tag != city_date_next_tag) {
                    country_detail.daily_cron_date = new Date();
                    country_detail.save();
                    partner_auto_transfer(country_detail)
                    cron.get_online_provider_analytics_for_redeem_points(country_detail);
                    //Send Profit Mail
                    // if (date_now == "01") {
                    // admin_profits_send_mail(country_detail)
                    // }
                }
            }
        })
    }, (err) => {
        console.log(err)
    })

    check_user_document_expire()
    deleteOldOtp();
});
run_continue_30_min_cron.start();


async function deleteOldOtp() {
    let Otps = require('mongoose').model('Otps');
    const currentTime = new Date();
    const timeThreshold = new Date(currentTime.getTime() - 30 * 60 * 1000);
    try {
        // Query for all OTPs created before the last 30 minutes
        await Otps.deleteMany({ created_at: { $lt: timeThreshold } });
    } catch (error) {
        console.log(error);
    }
}

async function provider_auto_transfer(city_detail) {
    const setting_detail = await Settings.findOne({});

    let today = new Date(Date.now());
    Country.findOne({ _id: city_detail.countryid }).then((country_detail) => {
        if (country_detail.is_auto_transfer) {
            let auto_transfer_day = country_detail.auto_transfer_day;
            let final_day = new Date(today.setDate(today.getDate() - auto_transfer_day));
            Provider.find({
                provider_type: Number(constant_json.PROVIDER_TYPE_NORMAL),
                cityid: city_detail._id,
                last_transferred_date: { $lte: final_day },
                $and: [
                    { account_id: { $exists: true, $ne: '' } },
                    { bank_id: { $exists: true, $ne: '' } }
                ]
            }).then((provider_list) => {
                provider_list.forEach(function (provider_detail) {
                    let payment_gateway_type = setting_detail.payment_gateway_type;
                    if (country_detail && country_detail.payment_gateways && country_detail.payment_gateways.length > 0) {
                        payment_gateway_type = country_detail.payment_gateways[0];
                    }
                    transfer_payment_to_provider(provider_detail, country_detail.currencycode, country_detail._id, payment_gateway_type);
                });
            }, (err) => {
                console.log(err)
            });
        }
    }, (err) => {
        console.log(err)        
    });
}

async function check_driver_wsal_status(city_detail) {
    try {
        const provider_list = await Provider.find({ cityid: city_detail._id });
        await Promise.all(provider_list.map(provider_detail => 
            wsal_services.DriverVehicleEligibilityInquiryService(provider_detail._id)
        ));
    } catch (err) {
        console.log(err);
    }
}

async function check_driver_wsal_status_for_expiry(city_detail) {
    try {
        const provider_list = await Provider.find({ cityid: city_detail._id });
        provider_list.forEach((provider)=>{
            check_driver_wsal_eligibility_expiry(provider);
        })
    } catch (err) {
        console.log(err);
    }
}

async function check_driver_wsal_eligibility_expiry(provider){
    var setting_detail = await Settings.findOne({},{eligibility_check_days:1})
    var provider_expiry_date = new Date(provider.wsal_eligibility_expiry_date);
    let eligibility_check_days = setting_detail.driver_notify_days;
    let today = new Date()
    let check_date = new Date();
    check_date.setDate(check_date.getDate() + eligibility_check_days);
    if(check_date > provider_expiry_date && today < provider_expiry_date){
        // from here driver eligibility expiry notification will sent 
        utils.sendPushNotification(constant_json.PROVIDER_UNIQUE_NUMBER, provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_WSAL_ELIGIBILITY_EXPIRY, constant_json.PUSH_NOTIFICATION_SOUND_FILE_IN_IOS), "", "", provider.lang_code;
    }

    // to check vehicle expiry
    var vehicle_list = await Vehicle.find({provider_id: Schema(provider._id)});
    for (const vehicle of vehicle_list) {
        check_driver_wsal_vehicle_eligibility_expiry(provider, vehicle, eligibility_check_days);
    }
}

async function check_driver_wsal_vehicle_eligibility_expiry(provider, vehicle, eligibility_check_days){

    let today = new Date()
    let check_date = new Date();
    check_date.setDate(check_date.getDate() + eligibility_check_days);
    
    var provider_vehicle_expiry_date = new Date(vehicle.wsal_vehicle_eligibility_expiry_date);
    if(check_date > provider_vehicle_expiry_date && today < provider_vehicle_expiry_date){
        // from here driver vehicle eligibility expiry notification will sent
        utils.sendPushNotification(constant_json.PROVIDER_UNIQUE_NUMBER, provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_WSAL_VEHICLE_ELIGIBILITY_EXPIRY, constant_json.PUSH_NOTIFICATION_SOUND_FILE_IN_IOS, "", "", provider.lang_code);
    }
    
}

async function check_driver_for_unblocked(city_detail) {
    try {
        let date = new Date();
        await Provider.updateMany(
            {
                cityid: city_detail._id,
                is_driver_approved_from_wsal : true,
                is_approved: 0,
                provider_unblocked_date: { $lte: date }
            },
            { is_approved: 1 }
        );
    } catch (err) {
        console.log(err);
    }
}

function transfer_payment_to_provider(provider_detail, currencycode, country_id, payment_gateway_type) {

    Trip_history.aggregate([{ $match: { 'confirmed_provider': { $eq: provider_detail._id } } },
    { $match: { 'is_trip_completed': { $eq: 1 } } },
    { $match: { 'is_provider_earning_set_in_wallet': { $eq: false } } },
    { $match: { 'is_transfered': { $eq: false } } },
    { $group: { _id: null, total: { $sum: '$pay_to_provider' } } }
    ]).then((trip) => {
        if (trip.length > 0) {
            let amount = trip[0].total.toFixed(2);
            utils.stripe_auto_transfer(amount, provider_detail, currencycode, payment_gateway_type, function (response_data) {
                if (response_data.success) {
                    utils.add_transfered_history(Number(constant_json.PROVIDER_UNIQUE_NUMBER), provider_detail._id, country_id,
                        amount, currencycode, 1, response_data.transfer_id, Number(constant_json.ADMIN_UNIQUE_NUMBER), null);
                    Trip_history.updateMany({
                        is_trip_completed: 1,
                        is_provider_earning_set_in_wallet: false,
                        is_transfered: false,
                        confirmed_provider: provider_detail._id
                    }, { is_transfered: true }, { multi: true }, function (err, trip_data) {
                    });
                    provider_detail.last_transferred_date = new Date();
                    provider_detail.save();
                    utils.sendOtherSMS(provider_detail.country_phone_code + provider_detail.phone,SMS_TEMPLATE.WEEKLY_PAYMENT)
                } else {
                    if(response_data.error != "PAYOUT_NOT_SUPPORT"){
                        utils.add_transfered_history(Number(constant_json.PROVIDER_UNIQUE_NUMBER), provider_detail._id, country_id,
                            amount, currencycode, 0, '', Number(constant_json.ADMIN_UNIQUE_NUMBER), response_data.error);
                    }
                }
            })
        }
    }, (err) => {
        console.log(err)
    });
}

async function check_provider_vehicle(city_detail) {
    let provider_list = await Provider.find({cityid: city_detail._id});
    provider_list.forEach(async function (provider_detail) {
        let vehicle_list = await Car_Rent_Vehicle.find({provider_id: provider_detail._id});
        if(vehicle_list.length > 0){
            check_vehicle_availability(vehicle_list);
        }
    });
}

async function check_vehicle_availability(vehicle_list) {
    vehicle_list.forEach(async function (vehicle) {
        let vehicle_detail = await Car_Rent_Vehicle.findOne({_id: vehicle._id});
        if(vehicle_detail && vehicle_detail.non_availability.length > 0){
            let today = new Date(Date.now());
            let filtered_non_availability = vehicle_detail.non_availability.filter(nonAvailability => {
                if (nonAvailability.availability_type === 3 || nonAvailability.availability_type === 1 ) {
                    return nonAvailability.end_date > today;
                }
                return true;
            });
            //Only save if any change
            if (JSON.stringify(filtered_non_availability) !== JSON.stringify(vehicle_detail.non_availability)) {
                vehicle_detail.non_availability = filtered_non_availability;
                vehicle_detail.markModified('non_availability');
                await vehicle_detail.save();
            }
        }
    });
}

async function provider_rental_profit_auto_transfer(city_detail) {
    const setting_detail = await Settings.findOne({});

    let today = new Date(Date.now());
    Country.findOne({ _id: city_detail.countryid }).then((country_detail) => {
        if (country_detail.is_auto_transfer) {
            let auto_transfer_day = country_detail.auto_transfer_day;
            let final_day = new Date(today.setDate(today.getDate() - auto_transfer_day));
            Provider.find({
                cityid: city_detail._id,
                last_rental_profit_transferred_date: { $lte: final_day },
                $and: [
                    { account_id: { $exists: true, $ne: '' } },
                    { bank_id: { $exists: true, $ne: '' } }
                ]
            }).then((provider_list) => {
                provider_list.forEach(function (provider_detail) {
                    let payment_gateway_type = setting_detail.payment_gateway_type;
                    if (country_detail && country_detail.payment_gateways && country_detail.payment_gateways.length > 0) {
                        payment_gateway_type = country_detail.payment_gateways[0];
                    }
                    transfer_rental_payment_to_provider(provider_detail, country_detail.currencycode, country_detail._id, payment_gateway_type);
                });
            }, (err) => {
                console.log(err)
            });
        }
    }, (err) => {
        console.log(err)        
    });
}

function transfer_rental_payment_to_provider(provider_detail, currencycode, country_id, payment_gateway_type) {

    Rental_Trip.aggregate([
        { $match: { 'provider_id': { $eq: provider_detail._id } } },
        { $match: { 'is_trip_completed': { $eq: 1 } } },
        { $match: { 'is_provider_earning_set_in_wallet': { $eq: false } } },
        { $match: { 'is_transfered': { $eq: false } } },
        { $group: { _id: null, total: { $sum: '$provider_service_fees' } } }
    ]).then((trip) => {
        if (trip.length > 0) {
            let amount = trip[0].total.toFixed(2);
            utils.stripe_auto_transfer(amount, provider_detail, currencycode, payment_gateway_type, function (response_data) {
                if (response_data.success) {
                    utils.add_transfered_history(Number(constant_json.PROVIDER_UNIQUE_NUMBER), provider_detail._id, country_id,
                        amount, currencycode, 1, response_data.transfer_id, Number(constant_json.ADMIN_UNIQUE_NUMBER), null);
                    Rental_Trip.updateMany({
                        is_trip_completed: 1,
                        is_provider_earning_set_in_wallet: false,
                        is_transfered: false,
                        provider_id: provider_detail._id
                    }, { is_transfered: true }, { multi: true }, function (err, trip_data) {
                    });
                    provider_detail.last_rental_profit_transferred_date = new Date();
                    provider_detail.save();
                    utils.sendOtherSMS(provider_detail.country_phone_code + provider_detail.phone, SMS_TEMPLATE.RENTAL_WEEKLY_PAYMENT);
                } else {
                    if(response_data.error != "PAYOUT_NOT_SUPPORT"){
                        utils.add_transfered_history(Number(constant_json.PROVIDER_UNIQUE_NUMBER), provider_detail._id, country_id,
                            amount, currencycode, 0, '', Number(constant_json.ADMIN_UNIQUE_NUMBER), response_data.error);
                    }
                }

            })
        }
    }, (err) => {
        console.log(err)
    });
}

function check_provider_document_expired(city_id, city_timezone) {
    let date = new Date().toLocaleString("en-US", { timeZone: city_timezone })
    Provider.find({ cityid: city_id, is_approved: 1 }).then((provider_list) => {
        provider_list.forEach(function (provider_data) {
            provider_document_expire(provider_data, date)
            provider_vehicle_document_expired(provider_data, date)
        })
    }, (err) => {
        console.log(err)
    });
}

function provider_document_expire(provider_data, date) {

    Provider_Document.find({
        expired_date: { $lt: date },
        provider_id: provider_data._id,
        is_document_expired: false,
        is_visible: true,
        is_uploaded: 1,
        is_expired_date: true,
    }).then((provider_document_list) => {
        provider_document_list.forEach(function (provider_document_detail) {
            if (!provider_data.is_documents_expired && provider_document_detail.option == 1) {
                provider_data.is_documents_expired = true;
                provider_data.is_active = 0;
                provider_data.save().then((providers) => {
                    utils.remove_from_zone_queue_new(providers);
                });
            }
            allemails.sendProviderDocumentExpiredEmail({}, provider_data);
            provider_document_detail.is_document_expired = true;
            provider_document_detail.save().then(() => {
            });
            // }

        })
    })
}

async function check_user_document_expire() {
    try {
        const setting_data = await Settings.findOne({})
        const time_zone = setting_data.adminTimeZone

        const date = new Date().toLocaleString("en-US", { timeZone: time_zone.trim() })
        
        const user_documents = await User_Document.find({
            expired_date: { $lt: date },
            is_document_expired: false,
            is_visible: true,
            is_uploaded: 1,
            is_expired_date: true,
        })

        for (const document of user_documents) {
            const user = await User.findOne({ _id: document.user_id })

            if (!user.is_documents_expired && document.option == 1) {
                user.is_documents_expired = true
                await user.save()
            }
            if(user.email) {
                allemails.sendProviderDocumentExpiredEmail({}, user)
            }
            document.is_document_expired = true
            await document.save()
        }
    } catch (error) {
        console.log(error)
    }
}
    
async function provider_vehicle_document_expired(provider_data, date) {
    let vehicles = await Vehicle.find({ user_type_id: provider_data._id })
    vehicles.forEach(function (vehicle_data) {
        provider_vehicle_document(provider_data, vehicle_data, date)
    })
}

function provider_vehicle_document(provider_data, vehicle_data, date) {
    Provider_Vehicle_Document.find({
        expired_date: { $lt: date },
        vehicle_id: vehicle_data._id,
        provider_id: provider_data._id,
        is_document_expired: false,
        is_visible: true,
        is_uploaded: 1,
        is_expired_date: true,
        // option:1
    }).then((provider_vehicle_document_list) => {
        provider_vehicle_document_list.forEach(function (provider_vehicle_document_detail) {
            if (!vehicle_data.is_documents_expired && provider_vehicle_document_detail.option == 1) {
                vehicle_data.is_documents_expired = true;
                vehicle_data.save()
            }
            allemails.sendProviderDocumentExpiredEmail({}, provider_data);
            provider_vehicle_document_detail.is_document_expired = true;
            provider_vehicle_document_detail.save().then(() => {
            });
        })
    }, (err) => {
        console.log(err)
    })
}

async function partner_auto_transfer(country_detail) {
    const setting_detail = await Settings.findOne({});

    let today = new Date(Date.now());
    if (country_detail.is_auto_transfer) {
        let auto_transfer_day = country_detail.auto_transfer_day;
        let final_day = new Date(today.setDate(today.getDate() - auto_transfer_day));
        Partner.find({
            country_id: country_detail._id,
            last_transferred_date: { $lte: final_day },
            $and: [
                { account_id: { $exists: true, $ne: '' } },
                { bank_id: { $exists: true, $ne: '' } }
            ]
        }).then((partner_list) => {
            partner_list.forEach(function (partner_detail) {
                let payment_gateway_type = setting_detail.payment_gateway_type;
                if (country_detail && country_detail.payment_gateways && country_detail.payment_gateways.length > 0) {
                    payment_gateway_type = country_detail.payment_gateways[0];
                }
                transfer_payment_to_partner(partner_detail, country_detail.currencycode, country_detail._id, payment_gateway_type);
            });
        }, (err) => {
            console.log(err)
        });
    }
}

function transfer_payment_to_partner(partner_detail, currencycode, country_id, payment_gateway_type) {
    Trip_history.aggregate([{ $match: { 'provider_type_id': { $eq: partner_detail._id } } },
    { $match: { 'is_trip_completed': { $eq: 1 } } },
    { $match: { 'is_provider_earning_set_in_wallet': { $eq: false } } },
    { $match: { 'is_transfered': { $eq: false } } },
    { $group: { _id: null, total: { $sum: '$pay_to_provider' } } }
    ]).then((trip) => {
        if (trip.length > 0) {
            let amount = trip[0].total.toFixed(2)
            utils.stripe_auto_transfer(amount, partner_detail, currencycode, payment_gateway_type, function (response_data) {
                if (response_data.success) {
                    utils.add_transfered_history(Number(constant_json.PARTNER_UNIQUE_NUMBER), partner_detail._id, country_id,
                        amount, currencycode, 1, response_data.transfer_id, Number(constant_json.ADMIN_UNIQUE_NUMBER), null);
                    Trip_history.updateMany({
                        is_trip_completed: 1,
                        is_provider_earning_set_in_wallet: false,
                        is_transfered: false,
                        provider_type_id: partner_detail._id
                    }, { is_transfered: true }, { multi: true }, function (err, trip_data) {
                    });
                    partner_detail.last_transferred_date = new Date();
                    partner_detail.save();
                } else {
                    utils.add_transfered_history(Number(constant_json.PARTNER_UNIQUE_NUMBER), partner_detail._id, country_id,
                        amount, currencycode, 0, '', Number(constant_json.ADMIN_UNIQUE_NUMBER), response_data.error);
                }
            })
        }
    }, (err) => {
        console.log(err)
    });
}

//getOnlineProviderAnalytics
exports.getOnlineProviderAnalytics = function (city_id, city_timezone, city_date_now) {
    Provider.find({ is_active: 1, cityid: city_id }).then((providers) => {
        providers.forEach(function (provider) {
            if (provider) {
                myAnalytics.insert_daily_provider_analytics_with_date(city_date_now, city_timezone, provider._id, 0, provider.start_online_time, provider.country_id);
                provider.start_online_time = new Date();
                myAnalytics.insert_daily_provider_analytics(city_timezone, provider._id, 0,provider.start_online_time, provider.country_id);

                provider.save().then(() => {
                });
            }
        });
    }, (err) => {
        console.log(err)
    });
};

//get Online Provider Analytics For Redeem points
exports.get_online_provider_analytics_for_redeem_points = async function (country) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const formattedDate = date.toISOString();
    if(country?.driver_redeem_settings[0]?.is_driver_redeem_point_reward_on){

        const redeemSettings = country.driver_redeem_settings[0];
        let provider_daily_analytic = await Provider_Daily_Analytic.find({
            $or: [
                { completed: { $gte: redeemSettings.daily_completed_trip_count_for_redeem_point } },
                { accepted: { $gte: redeemSettings.daily_accepted_trip_count_for_redeem_point } },
                { rating_average: { $gte: redeemSettings.rating_average_for_redeem_point } }
            ],
            created_at: { $gte: formattedDate, $lte: new Date() },
            country_id: country._id
        });
        if (provider_daily_analytic.length != 0) {

            provider_daily_analytic.forEach(async (item) => {
                let provider = await Provider.findById(item.provider_id)
                if (provider) {
                    let partner 
                    if (provider.provider_type_id != null && provider.provider_type == PROVIDER_TYPE.PARTNER) {
                        partner = await Partner.findById(provider.provider_type_id)
                    }
                    if ((item.accepted >= country.driver_redeem_settings[0].daily_completed_trip_count_for_redeem_point) && (country.driver_redeem_settings[0].daily_completed_trip_redeem_point > 0)) {
                        if (provider.provider_type_id != null && provider.provider_type == PROVIDER_TYPE.PARTNER) {
                            let total_redeem_point = utils.add_redeem_point_history(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner?.country._id, constant_json.DAILY_TRIP_ACCEPTED_REDEEM_POINT, partner.wallet_currency_code, "Get redeem point via Daily Trips acception ratio", country.driver_redeem_settings[0].daily_accepted_trip_redeem_point, partner?.total_redeem_point, constant_json.ADD_REDEEM_POINT)
                            partner.total_redeem_point = total_redeem_point
                            await partner.save()
                            
                        }else{
                            let total_redeem_point = utils.add_redeem_point_history(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country._id, constant_json.DAILY_TRIP_ACCEPTED_REDEEM_POINT, provider.wallet_currency_code, "Get redeem point via Daily Trips acception ratio", country.driver_redeem_settings[0].daily_accepted_trip_redeem_point, provider?.total_redeem_point, constant_json.ADD_REDEEM_POINT)
                            provider.total_redeem_point = total_redeem_point
                        }
                        
                    }

                    if (item.completed >= country.driver_redeem_settings[0].daily_accepted_trip_count_for_redeem_point && (country.driver_redeem_settings[0].daily_accepted_trip_redeem_point > 0)) {
                        if (provider.provider_type_id != null && provider.provider_type == PROVIDER_TYPE.PARTNER) {
                            let total_redeem_point = utils.add_redeem_point_history(constant_json.PARTNER_UNIQUE_NUMBER, partner.unique_id, partner._id, partner?.country._id, constant_json.DAILY_TRIP_COMPLETED_REDEEM_POINT, partner.wallet_currency_code, "Get redeem point via Daily Trips completed ratio", country.driver_redeem_settings[0].daily_completed_trip_redeem_point, partner?.total_redeem_point, constant_json.ADD_REDEEM_POINT)
                            partner.total_redeem_point = total_redeem_point
                            await partner.save()
                        }else{
                            let total_redeem_point = utils.add_redeem_point_history(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country._id, constant_json.DAILY_TRIP_COMPLETED_REDEEM_POINT, provider.wallet_currency_code, "Get redeem point via Daily Trips completed ratio", country.driver_redeem_settings[0].daily_completed_trip_redeem_point, provider.total_redeem_point, constant_json.ADD_REDEEM_POINT)
                            provider.total_redeem_point = total_redeem_point
                        }
                        
                    }

                    if (item.rating_average >= country.driver_redeem_settings[0].rating_average_count_for_redeem_point && (country.driver_redeem_settings[0].high_rating_redeem_point > 0)) {
                        if (provider.provider_type_id != null && provider.provider_type == PROVIDER_TYPE.PARTNER) {
                            let total_redeem_point = utils.add_redeem_point_history(constant_json.PARTNER_UNIQUE_NUMBER, provider.unique_id, partner._id, partner?.country._id, constant_json.HIGH_RATING_REDEEM_POINT, partner.wallet_currency_code, "Get redeem point via High rating", country.driver_redeem_settings[0].high_rating_redeem_point,partner?.total_redeem_point, constant_json.ADD_REDEEM_POINT)
                            partner.total_redeem_point = total_redeem_point
                            await partner.save()
                        }else{
                            let total_redeem_point = utils.add_redeem_point_history(constant_json.PROVIDER_UNIQUE_NUMBER, provider.unique_id, provider._id, provider.country._id, constant_json.HIGH_RATING_REDEEM_POINT, provider.wallet_currency_code, "Get redeem point via High rating", country.driver_redeem_settings[0].high_rating_redeem_point, provider.total_redeem_point, constant_json.ADD_REDEEM_POINT)
                            provider.total_redeem_point = total_redeem_point
                        }
                    }
                    if(partner) {
                        await partner.save()
                    } else {
                        await provider.save()
                    }
                }
            })
        }
    }
};


async function admin_profits_send_mail(country) {
    try {
        const currentDate = new Date();

        // Calculate the date for the 1st minute of the previous month
        const firstMinuteOfPreviousMonth = new Date(currentDate);
        firstMinuteOfPreviousMonth.setMonth(currentDate.getMonth() - 1);
        firstMinuteOfPreviousMonth.setDate(1);
        firstMinuteOfPreviousMonth.setHours(0, 0, 0, 0);
        const formatted_date_start = firstMinuteOfPreviousMonth.toISOString();

        // Calculate the date for the last minute of the previous month
        const lastMinuteOfPreviousMonth = new Date(currentDate);
        lastMinuteOfPreviousMonth.setDate(0);
        lastMinuteOfPreviousMonth.setHours(23, 59, 59, 999);
        const formatted_date_last = lastMinuteOfPreviousMonth.toISOString();

        const profit_list = await Admin_Profit.find({
            invoice_sent: false,
            created_at: { $gte: formatted_date_start, $lte: formatted_date_last },
            country_id: country._id
        })
        await Admin_Profit.updateMany({
            invoice_sent: false,
            created_at: { $gte: formatted_date_start, $lte: formatted_date_last  },
            country_id: country._id
        }, { invoice_sent: true });



        const groupedData = {};

        profit_list.forEach(obj => {
            const userTypeId = obj.user_type_id;
            if (!groupedData[userTypeId]) {
                groupedData[userTypeId] = [];
            }
            groupedData[userTypeId].push(obj);
        });

        const result = Object.values(groupedData);
        if (result.length > 0) {
            allemails.sendAdminProfitInvoiceEmail({}, result);
        }

    } catch (error) {

    }
}

async function check_ride_for_cron(open_ride){
    let openride = await OpenRide.findOne({_id:open_ride._id})
    let provider = await Provider.findOne({_id: openride.provider_id});

    // cancel trip id not user found
    if (openride.user_details.length == 0) {
        cancel_open_ride(openride, OPEN_RIDE_CANCEL_REASON.NO_USER_FOUND)
    }

    // find accepted user requests
    const accepted_users = openride.user_details.filter((user) => {
        return user.booking_cancelled === 0 && user.booking_cancelled_by_user === 0 && user.booking_cancelled_by_provider === 0 && user.status == OPEN_RIDE_STATUS.ACCEPTED
    })

    // cancel trip id user request not accepted by driver
    if (accepted_users.length == 0) {
        openride.user_details.forEach(async (user_request)=>{
            if(user_request.booking_cancelled == 0 && user_request.booking_cancelled_by_user == 0 && user_request.booking_cancelled_by_provider == 0 && user_request.status == 0){
                user_request.status = 2
                user_request.booking_cancelled = 1
                user_request.booking_cancelled_by_provider = 1
                let user = await User.findOne({ _id: user_request.user_id })
                utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_PROVIDER, "", user.webpush_config, user.lang_code);
            }
        })

        cancel_open_ride(openride, OPEN_RIDE_CANCEL_REASON.NO_ACCEPTED_USER_FOUND)

        await Provider.findOneAndUpdate({ _id: provider._id }, { $pull: { open_ride: openride._id }})
        utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_NO_USER_FOUND, "", provider.webpush_config, provider.lang_code);
        return
    }

    await Provider.findOneAndUpdate({ _id: provider._id },{$push: { is_trip: openride._id},$set: {is_available: 0}});
    for await (const user_request of openride.user_details) {
        const user = await User.findById(user_request.user_id)

        if (user_request.booking_cancelled == 0 && user_request.booking_cancelled_by_user == 0 && user_request.booking_cancelled_by_provider == 0 && user_request.status == 1 && !user_request.current_trip_id) {
            start_open_ride_for_user(user, openride)
        } else if (user_request.booking_cancelled == 0 && user_request.booking_cancelled_by_user == 0 && user_request.booking_cancelled_by_provider == 0 && user_request.status == 0) {
            openride.booked_seats -= 1
            user_request.status = 2
            user_request.booking_cancelled = 1
            user_request.booking_cancelled_by_provider = 1
            utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_TRIP_CANCELLED_BY_PROVIDER, "", user.webpush_config, user.lang_code);
        }
    }

    openride.is_provider_accepted = 1
    openride.is_provider_status = PROVIDER_STATUS.ARRIVED
    openride.markModified('user_details')

    await openride.save()
    utils.send_socket_request(openride._id, openride.provider_id, true);
    utils.sendPushNotification(provider.device_type, provider.device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_STARTED, "", provider.webpush_config, provider.lang_code);
}

async function start_open_ride_for_user(user, openride){
    user.current_trip_id = openride._id
    await user.save();
    if (user.device_token && user.device_type) {
        utils.sendPushNotification(user.device_type, user.device_token, push_messages.PUSH_CODE_FOR_YOUR_TRIP_STARTED, "", user.webpush_config, user.lang_code);
    }
    utils.req_type_id_socket(user._id)
}

async function cancel_open_ride(openride, cancel_reason){
    let complete_date_in_city_timezone = utils.get_date_now_at_city(new Date(), openride.timezone);
    let complete_date_tag = moment(moment(complete_date_in_city_timezone).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);

    openride.is_trip_end = 1;
    openride.is_trip_cancelled = 1;
    openride.cancel_reason = cancel_reason;
    openride.payment_status = 1
    openride.provider_trip_end_time = new Date();
    openride.complete_date_in_city_timezone = complete_date_in_city_timezone;
    openride.complete_date_tag = complete_date_tag;

    await OpenRide.updateOne({ _id: openride._id }, openride.getChanges())
}