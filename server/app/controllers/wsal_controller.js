const axios = require('axios');
const utils = require('./utils');
var mongoose = require('mongoose');
const provider = require('../models/provider');
const Schema = mongoose.Types.ObjectId;
const Provider = require('mongoose').model('Provider');
const Vehicle = require('mongoose').model('Vehicle');
var Settings = require('mongoose').model('Settings');
var Trip = require('mongoose').model('Trip');
var Trip_history = require('mongoose').model('Trip_history');
var wsal_services = require('./wsal_controller')


// Driver and Vehicle Registration Service
exports.DriverVehicleRegistrationService = async function (provider_id, vehicle_id = null) {
    
    let provider_details = await Provider.findOne({_id: Schema(provider_id)});
    if(provider_details){
        let vehicle_details;
        if(vehicle_id){
            vehicle_details = await Vehicle.findOne({provider_id: Schema(provider_id), _id: Schema(vehicle_id)})
        } else {
            vehicle_details = await Vehicle.findOne({provider_id: Schema(provider_id)});
        }
        if(vehicle_details){

            let selected_vehicle_details = vehicle_details;
            const setting_details = await Settings.findOne({},{wsal_client_id:1, wsal_app_id:1, wsal_app_key:1, sms_notification:1});
            let base_url = "https://wasl.api.elm.sa/api/dispatching/v2/drivers";
            let headers = {
                "Content-Type": "application/json",
                "client-id": setting_details.wsal_client_id,
                "app-id": setting_details.wsal_app_id,
                "app-key": setting_details.wsal_app_key
            }
            var driver_object = {
                "identityNumber": provider_details.national_id, // Driver’s national identity number (Iqama ID for Non-Saudis)
                "emailAddress": provider_details.email,
                "mobileNumber": provider_details.country_phone_code + provider_details.phone
            }

            if((provider_details.national_id).charAt(0) == '1'){
                driver_object["dateOfBirthHijri"] = provider_details.date_of_birth; // Date of birth in Hijri for Saudi drivers
            } else {
                driver_object["dateOfBirthGregorian"] = provider_details.date_of_birth; // Date of birth in Gregorian for Non-Saudi drivers
            }
            
            let req_body = {
                "driver": driver_object,
                "vehicle": {
                    "sequenceNumber": selected_vehicle_details.sequence_number,
                    "plateLetterRight": selected_vehicle_details.right_plate_letter,
                    "plateLetterMiddle": selected_vehicle_details.center_plate_letter,
                    "plateLetterLeft": selected_vehicle_details.left_plate_letter,
                    "plateNumber": selected_vehicle_details.plate_no,
                    "plateType": selected_vehicle_details.plate_type
                }
            }
            provider_details.wsal_request = {base_url,...req_body}
            try {
                const response = await axios.post(base_url, req_body, { headers });
                if (response.status === 200) {
                    if(response.data.result?.eligibility == 'VALID'){
                        provider_details.is_driver_approved_from_wsal = true;
                    }
                    if(vehicle_details.admin_type_id && vehicle_details.service_type && response.data.result?.eligibility == 'VALID'){
                        provider_details.is_approved = true;
                    }
                    provider_details.wsal_transc_date = new Date();
                    provider_details.wsal_result_code = response.data.resultCode;
                    provider_details.wsal_eligibility = response.data.result?.eligibility;
                    provider_details.wsal_eligibility_expiry_date = response.data.result?.eligibilityExpiryDate;
                    provider_details.wsal_rejection_reason = response.data.result?.rejectionReasons || provider_details.wsal_rejection_reason;
                    provider_details.wsal_response = response.data;
                    await Provider.updateOne({ _id: provider_details._id }, provider_details.getChanges());
                    vehicle_details.wsal_vehicle_license_eligibility_expiry_date = response.data.result?.vehicleLicenseExpiryDate;
                    await Vehicle.updateOne({ _id: vehicle_details._id }, vehicle_details.getChanges());
                    let push_code_response = await utils.getPushCodeString(provider_details.wsal_result_code);
                    utils.sendPushNotification(provider_details.device_type, provider_details.device_token, push_code_response.push_code, "", provider_details.webpush_config, provider_details.lang_code);
                    if(setting_details.sms_notification){
                        utils.sendSMS(provider_details.country_phone_code + provider_details.phone, push_code_response.sms_string);
                        utils.sendWhatsapp(provider_details.country_phone_code + provider_details.phone, push_code_response.sms_string);
                    }
                }
            } catch (error) {
                provider_details.wsal_result_code = error.response?.data?.resultCode;
                provider_details.is_driver_approved_from_wsal = false;
                provider_details.wsal_transc_date = new Date();
                provider_details.wsal_response = error.response?.data;
                provider_details.wsal_eligibility = "INVALID";
                await Provider.updateOne({ _id: provider_details._id }, provider_details.getChanges());
                vehicle_details.wsal_eligibility = "INVALID";
                await Vehicle.updateOne({ _id: vehicle_details._id }, vehicle_details.getChanges());
                if(provider.wsal_result_code && provider.wsal_result_code != '' ){
                    let push_code_response = await utils.getPushCodeString(provider_details.wsal_result_code);
                    utils.sendPushNotification(provider_details.device_type, provider_details.device_token, push_code_response.push_code, "", provider_details.webpush_config, provider_details.lang_code);
                    if(setting_details.sms_notification){
                        utils.sendSMS(provider_details.country_phone_code + provider_details.phone, push_code_response.sms_string);
                        utils.sendWhatsapp(provider_details.country_phone_code + provider_details.phone, push_code_response.sms_string);
                    }
                }
            }
            
        }
        
    }
};

//Driver & Vehicle Eligibility Inquiry Service
exports.DriverVehicleEligibilityInquiryService = async function (driver_id) {
    let provider_detail = await Provider.findOne({_id: Schema(driver_id)});
    if(provider_detail){

        const setting_details = await Settings.findOne({});
        var existing_criminalRecordStatus = provider_detail?.wsal_response?.criminalRecordStatus
        var existing_is_approved = provider_detail.is_approved
        let identityNumber = provider_detail.national_id;
        let base_url = `https://wasl.api.elm.sa/api/dispatching/v2/drivers/eligibility/${identityNumber}`;
        provider_detail.wsal_request = {base_url}
        let headers = {
            "Content-Type": "application/json",
            "client-id": setting_details.wsal_client_id,
            "app-id": setting_details.wsal_app_id,
            "app-key": setting_details.wsal_app_key
        }
        try {
            const response = await axios.get(base_url, { headers });
            let is_driver_approved_from_wsal = false;
            let is_approved = 0;
            provider_detail.wsal_transc_date = new Date();
            provider_detail.wsal_response = response.data;
            provider_detail.wsal_eligibility = response.data?.driverEligibility;
            provider_detail.wsal_criminal_record_status = response.data?.criminalRecordStatus || "";
            provider_detail.wsal_eligibility_expiry_date = response.data?.eligibilityExpiryDate;
            provider_detail.wsal_rejection_reason = response.data?.rejectionReasons || provider_detail.wsal_rejection_reason;
            await Provider.updateOne({ _id: provider_detail._id }, provider_detail.getChanges());

            let vehicle_list = response.data?.vehicles;

            if(vehicle_list && vehicle_list.length > 0){
                    for (const vehicle of vehicle_list) {
                        let vehicle_detail = await Vehicle.findOne({ provider_id : provider_detail._id, sequence_number: vehicle.sequenceNumber });
                        if (vehicle_detail) {
                            vehicle_detail.wsal_eligibility = vehicle.vehicleEligibility;
                            vehicle_detail.wsal_vehicle_eligibility_expiry_date = vehicle?.eligibilityExpiryDate;
                            vehicle_detail.wsal_vehicle_license_eligibility_expiry_date = vehicle?.vehicleLicenseExpiryDate;
                            vehicle_detail.wsal_rejection_reason = vehicle?.rejectionReasons || vehicle_detail.wsal_rejection_reason;
                            await Vehicle.updateOne({ provider_id : provider_detail._id, sequence_number: vehicle.sequenceNumber }, vehicle_detail.getChanges());
                        }
                    }
            }

            let approved_vehicle = await Vehicle.findOne({provider_id: Schema(provider_detail._id), is_selected: true, wsal_eligibility: "VALID"});
            let today = new Date()
            if(approved_vehicle && provider_detail.wsal_eligibility == "VALID"){
                is_driver_approved_from_wsal = true;
                if(provider_detail.provider_unblocked_date < today){
                    is_approved = 1;
                }
            }
            await Provider.findByIdAndUpdate(provider_detail._id, {is_driver_approved_from_wsal: is_driver_approved_from_wsal, is_approved: is_approved});

            let status_code = [];
            if (response.data) {
                status_code = response.data.criminalRecordStatus ? [response.data.criminalRecordStatus] : (response.data.rejectionReasons ? response.data.rejectionReasons : []);
            }

            if(status_code.length > 0 && response?.data?.criminalRecordStatus != existing_criminalRecordStatus && existing_is_approved != is_approved){
                let push_code_response = await utils.getPushCodeString(status_code[0]);
                utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_code_response.push_code, "", provider_detail.webpush_config, provider_detail.lang_code);
                if(setting_details.sms_notification){
                    utils.sendSMS(provider_detail.country_phone_code + provider_detail.phone, push_code_response.sms_string);
                    utils.sendWhatsapp(provider_detail.country_phone_code + provider_detail.phone, push_code_response.sms_string);
                }
            }

        } catch (error) {
            provider_detail.wsal_result_code = error?.response?.data?.resultCode || '';
            provider_detail.is_driver_approved_from_wsal = false;
            provider_detail.wsal_transc_date = new Date();
            provider_detail.wsal_response = error?.response?.data || '';
            provider_detail.wsal_eligibility = "INVALID";
            provider_detail.is_approved = 0;
            provider_detail.wsal_rejection_reason = error?.response?.data?.resultCode ? [error?.response?.data?.resultCode] : provider_detail.wsal_rejection_reason;
            await Provider.updateOne({ _id: provider_detail._id }, provider_detail.getChanges());
            await Vehicle.updateMany({ provider_id: provider_detail._id }, { wsal_eligibility:"INVALID" });
            let push_code_response = await utils.getPushCodeString("INVALID_ID");
            utils.sendPushNotification(provider_detail.device_type, provider_detail.device_token, push_code_response.push_code, "", provider_detail.webpush_config, provider_detail.lang_code);
            if(setting_details.sms_notification){
                utils.sendSMS(provider_detail.country_phone_code + provider_detail.phone, push_code_response.sms_string);
                utils.sendWhatsapp(provider_detail.country_phone_code + provider_detail.phone, push_code_response.sms_string);
            }
        }
    }
};

// Driver and Vehicle Registration Service Check
exports.DriverVehicleRegistrationServiceStatusCheck = async function (provider_id, vehicle_id) {

    return new Promise(async (resolve, reject) => {
        let provider_details = await Provider.findOne({_id: Schema(provider_id)});
        if(!provider_details){
            resolve({success: false})
        }
        let vehicle_details = await Vehicle.findOne({provider_id: Schema(provider_id), _id: Schema(vehicle_id)})
        if(!vehicle_details){
            resolve({success: false})
        }
        let selected_vehicle_details = vehicle_details;
        const setting_details = await Settings.findOne({},{wsal_client_id:1, wsal_app_id:1, wsal_app_key:1, sms_notification:1});
        let base_url = "https://wasl.api.elm.sa/api/dispatching/v2/drivers";
        let headers = {
            "Content-Type": "application/json",
            "client-id": setting_details.wsal_client_id,
            "app-id": setting_details.wsal_app_id,
            "app-key": setting_details.wsal_app_key
        }
        var driver_object = {
            "identityNumber": provider_details.national_id, // Driver’s national identity number (Iqama ID for Non-Saudis)
            "emailAddress": provider_details.email, // Optional
            "mobileNumber": provider_details.country_phone_code + provider_details.phone
        }

        if((provider_details.national_id).charAt(0) == '1'){
            driver_object["dateOfBirthHijri"] = provider_details.date_of_birth; // Date of birth in Hijri for Saudi drivers
        } else {
            driver_object["dateOfBirthGregorian"] = provider_details.date_of_birth; // Date of birth in Gregorian for Non-Saudi drivers
        }
        
        let req_body = {
            "driver": driver_object,
            "vehicle": {
                "sequenceNumber": selected_vehicle_details.sequence_number, // Vehicle’s sequence number
                "plateLetterRight": selected_vehicle_details.right_plate_letter,
                "plateLetterMiddle": selected_vehicle_details.center_plate_letter,
                "plateLetterLeft": selected_vehicle_details.left_plate_letter,
                "plateNumber": selected_vehicle_details.plate_no,
                "plateType": selected_vehicle_details.plate_type // Vehicle’s plate type
            }
        }
        provider_details.wsal_request = {base_url,...req_body} //storing request body with driver


        try {
            const response = await axios.post(base_url, req_body, { headers });
            console.log(response.data);
            resolve({success:true})
        } catch (error) {
            console.log(error.response?.data);
            resolve({success:false})
        }
        
    })
    
};

// Trip Registration Service
exports.TripRegistrationService = async function (trip_id) {
    let trip = await Trip.findOne({_id: Schema(trip_id)}) || await Trip_history.findOne({_id: Schema(trip_id)});
    if(trip){
        let provider = await Provider.findOne({_id: trip.confirmed_provider});
        if(provider){
            let vehicle = await Vehicle.findOne({provider_id: provider._id, is_selected: true});
            if(vehicle){
                let driver_accepted_time = new Date(trip.accepted_time);
                let driver_arrived_time = new Date(trip.provider_arrived_time);
                let waiting_time = (driver_arrived_time.getTime() - driver_accepted_time.getTime()) / 1000;

                let pick_time = new Date(trip.provider_trip_start_time);
                let dropoff_time = new Date(trip.provider_trip_end_time);
                let trip_time = (dropoff_time.getTime() - pick_time.getTime()) / 1000;


                if(trip.total_distance < 1){
                    trip.total_distance = 1
                }

                let req_body = {
                    "sequenceNumber": vehicle.sequence_number, // Vehicle sequence number.
                    "driverId": provider.national_id, // Driver national ID number/Iqama.
                    "tripId": trip.unique_id, // Trip Unique_id in our case
                    "distanceInMeters": trip.total_distance, // The distance the trip took from the rider pickup location to the customer drop-off location (In Meters).
                    "durationInSeconds": trip_time, // Trip duration: from “pickupTimestamp” to “dropoffTimestamp”.
                    "customerRating": 0, // Rider rating of the trip (out of 5), Zero value accepted for unrated trips
                    "customerWaitingTimeInSeconds": waiting_time, // The period of which the driver accepted the trip request until his/her arrival time to the customer location
                    "originLatitude": trip.sourceLocation[0], // Departure Latitude
                    "originLongitude": trip.sourceLocation[1], // Departure Longitude
                    "destinationLatitude": trip.destinationLocation[0], // Destination Latitude
                    "destinationLongitude": trip.destinationLocation[1], // Destination Longitude
                    "pickupTimestamp": trip.provider_trip_start_time, // The time when the customer got into the vehicle. (KSA Time)
                    "dropoffTimestamp": trip.provider_trip_end_time, // The time when the customer got off the vehicle or the trip ended by the driver. (KSA Time)
                    "startedWhen": trip.user_create_time, // The time when the customer requested the ride on the App.
                    "tripCost": trip.total // Trip Total Cost
                }
                
                const setting_details = await Settings.findOne({});
                let base_url = "https://wasl.api.elm.sa/api/dispatching/v2/trips";
                let headers = {
                    "Content-Type": "application/json",
                    "client-id": setting_details.wsal_client_id,
                    "app-id": setting_details.wsal_app_id,
                    "app-key": setting_details.wsal_app_key
                }
                try {
                    const response = await axios.post(base_url, req_body, { headers });
                    await Trip.findByIdAndUpdate(trip_id, { wsal_response: response.data, is_trip_register_in_wsal: true });
                    await Trip_history.findByIdAndUpdate(trip_id, { wsal_response: response.data, is_trip_register_in_wsal: true });
                } catch (error) {
                    await Trip.findByIdAndUpdate(trip_id, { wsal_response: error.response?.data });
                    await Trip_history.findByIdAndUpdate(trip_id, { wsal_response: error.response?.data });
                }
            }
        }
    }
    
};

// Trips Update Service
exports.TripsUpdateService = async function (trip_id, customer_rate = 0) {
    let trip = await Trip.findOne({_id: Schema(trip_id)}) || await Trip_history.findOne({_id: Schema(trip_id)});
    if(trip){
        const setting_details = await Settings.findOne({});
    
        let base_url = "https://wasl.api.elm.sa/api/dispatching/v2/trips";
        let headers = {
            "Content-Type": "application/json",
            "client-id": setting_details.wsal_client_id,
            "app-id": setting_details.wsal_app_id,
            "app-key": setting_details.wsal_app_key
        }
        let req_body = {
            "trips":
            [
                {
                    "tripId": trip.unique_id,
                    "tripCost": trip.total
                }
            ]
        }
        if(customer_rate > 0){
            req_body.trips[0]["customerRating"] = customer_rate;
        }
        try {
            const response = await axios.post(base_url, req_body, { headers });

            await Trip.findByIdAndUpdate(trip_id, { wsal_response: response.data, is_trip_update_in_wsal: true });
            await Trip_history.findByIdAndUpdate(trip_id, { wsal_response: response.data, is_trip_update_in_wsal: true });
        } catch (error) {
            await Trip.findByIdAndUpdate(trip_id, { wsal_response: error.response?.data });
            await Trip_history.findByIdAndUpdate(trip_id, { wsal_response: error.response?.data });
        }
    }
};

// Update Current Location
exports.UpdateCurrentLocation = async function (national_id, sequence_number, location, is_user_in_trip, last_update_time) {

    const setting_details = await Settings.findOne({});
    
    let base_url = "https://wasl.api.elm.sa/api/dispatching/v2/locations";
    let headers = {
        "Content-Type": "application/json",
        "client-id": setting_details.wsal_client_id,
        "app-id": setting_details.wsal_app_id,
        "app-key": setting_details.wsal_app_key
    }
    let req_body = {
        "locations":[
            {
                "driverIdentityNumber": national_id,
                "vehicleSequenceNumber": sequence_number,
                "latitude": location[0],
                "longitude": location[1],
                "hasCustomer": is_user_in_trip, // Vehicle currently has customer or not
                "updatedWhen": last_update_time // Last update time for location
            }
        ]
    }
    
    try {
        axios.post(base_url, req_body, { headers })
        // .then(response=>{
        //     console.log(response.data);
        // });
    } catch (error) {
        console.log(error.response?.data);
    }
};