const TOKEN_SECRET = 'lFaLHZQWM2SN5ZD8';
const PAYMENT_GATEWAY = {
    stripe: 10,
    paystack: 11,
    payu: 12,
    paytabs: 13,
    paypal: 14,
    razorpay: 15
};

const IS_ADD_CARD = {
    10: true,
    11: true,
    12: false,
    13: true,
    14: false,
    15: false
}

const LANGUAGES = {
    english: 'en',
    japanese: 'ja',
    french: 'fr',
    arabic: 'ar',
    portuguese: 'pr',
    spanish: 'es'
};

const PAYMENT_STATUS = {
    WAITING: 0,
    COMPLETED: 1,
    FAILED: 2
}

const SPLIT_PAYMENT = {
    WAITING: 0,
    ACCEPTED: 1,
    REJECTED: 2
}

const TYPE_VALUE = {
    USER: 1,
    PROVIDER: 2,
    PARTNER: 3,
    CORPORATE: 4,
    HOTEL: 5,
    DISPATCHER: 6,
    VEHICLE:7,
    ADMIN:8,
    HUB:19,
}

const TRIP_STATUS = {
    WAITING_FOR_PROVIDER: 9,
    NO_PROVIDER_FOUND: 109,
    NOT_ANSWERED: 110,
    PROVIDER_ACCEPTED: 11,
    PROVIDER_REJECTED: 111,
    PROVIDER_CANCELLED: 112,
    FOR_REDEEM_POINTS: 115,
    TRIP_COMPLETED: 25,
    INITIATE_TRIP: 50
};

const TRIP_LIST = {
    RUNNING_TRIP:1,
    SCHEDULED_TRIP:2,
    COMPLETED_TRIP:3,
    CANCELLED_TRIP:4,
    WALLET_HISTORY :18,

}
// ORDER_CANCELLATION_CHARGE CONSTANT
const VEHICLE_ACCESIBILITY_TYPE = {
    BABY_SEAT: "baby_seat",
    HOTSPOTS: "hotspot",
    HANDICAPE: "handicap"
};
const VEHICLE_ACCESIBILITY_TYPE_STRING = {
    BABY_SEAT: "Baby Seat",
    HOTSPOTS: "Hotspot",
    HANDICAPE: "Handicap"
};




// VEHICLE_ACCESIBILITY CONSTANT ARRAY 
const VEHICLE_ACCESIBILITY = [
    { ID: VEHICLE_ACCESIBILITY_TYPE.BABY_SEAT, NAME: VEHICLE_ACCESIBILITY_TYPE_STRING.BABY_SEAT },
    { ID: VEHICLE_ACCESIBILITY_TYPE.HOTSPOTS, NAME: VEHICLE_ACCESIBILITY_TYPE_STRING.HOTSPOTS },
    { ID: VEHICLE_ACCESIBILITY_TYPE.HANDICAPE, NAME: VEHICLE_ACCESIBILITY_TYPE_STRING.HANDICAPE }


];

const DOCUMENT_TYPE = {
    USER: 0,
    PROVIDER: 1,
    VEHICLE: 2
};

const PROVIDER_STATUS = {
    WAITING: 0,
    ACCEPTED: 1,
    COMING: 2,
    ARRIVED: 4,
    TRIP_STARTED: 6,
    TRIP_COMPLETED: 9
};

// To store the timestamp of the trip based on the trip status
const TRIP_STATUS_TIMELIME = { 
    CREATED: 0,
    ACCEPTED: 1,
    COMING: 2,
    ARRIVED: 3,
    TRIP_STARTED: 4,
    TRIP_COMPLETED: 5,
    TRIP_CANCELLED: 6,
    OPEN_RIDE_USER_DROPPED: 7
};

const HIDE_DETAILS = {
    EMAIL : '************',
    PHONE : '************',
    COUNTRY_CODE:"***"
}


const COLLECTION = {
    USER: 1,
    PROVIDER: 2,
    PARTNER: 3,
    CORPORATE: 4,
    HOTEL: 5,
    DISPATCHER: 6,
    VEHICLE:7,
    TRIP:8,
    COUNTRY:9,
    CITY:10,
    CITY_TYPE: 11,
    DOCUMENT: 12,
    PROMO: 13,
    MASS_NOTIFICATION: 14,
    WALLET_HISTORY: 15,
    TRANSFER_HISTORY: 16,
    ADMIN_NOTIFICATION: 17,
    HUB: 19,
}

const UPDATE_LOG_TYPE = {
    ADMIN_SETTINGS: 1,
    CITY_SETTINGS: 2,
    AIRPORT_SETTINGS: 3,
    ZONE_SETTINGS: 4,
    RED_ZONE_SETTINGS: 5,
    COUNTRY_SETTINGS: 6,
    TYPE_DETAIL: 7,
    CITY_TYPE_SETTINGS: 8,
    RICH_AREA_SURGE_SETTINGS: 9,
    CITY_TO_CITY_SETTINGS: 10,
    AIRPORT_TO_CITY_SETTINGS: 11,
    RENTAL_CAR_SETTINGS: 12,
    DOCUMENT_SETTINGS: 13,
    LANGUAGE_SETTINGS: 14,
    PROMO_SETTINGS: 15,
    EMAIL_SETTINGS: 16,
    SMS_SETTINGS: 17,
    PRIVACY_SETTINGS: 18,
    CANCEL_REASON_SETTINGS: 19,
    SUB_ADMIN_SETTINGS: 20,
}

const UPDATE_LOG_OPERATION = {
    ADDED: 1,
    UPDATED: 2,
    DELETED: 3,
}

// Admin notification types
const ADMIN_NOTIFICATION_TYPE = {
    USER_REGISTERED: 1,
    DRIVER_REGISTERED: 2,
    PARTNER_REGISTERED: 3,
    CORPORATE_REGISTERED: 4,
}

const PERMISSION_TO_NOTIFICATION_TYPE = {
    "user": ADMIN_NOTIFICATION_TYPE.USER_REGISTERED,
    "driver-user": ADMIN_NOTIFICATION_TYPE.DRIVER_REGISTERED,
    "partner": ADMIN_NOTIFICATION_TYPE.PARTNER_REGISTERED,
    "corporate": ADMIN_NOTIFICATION_TYPE.CORPORATE_REGISTERED,
};

// Booking type constants
const TRIP_TYPE = {
    RIDE_NOW: 1,
    SCHEDULED: 2,
    CITY_TO_CITY: 3,
    RENTAL: 4,
    AIRPORT: 5,
    ZONE: 6,
    GUEST: 7,
    BIDDING: 8,
    FIXED: 9,
    RIDE_SHARE: 10,
    OPEN_RIDE:11

}

const PROFIT_TYPE = {
    ABSOLUTE: 1,
    PERCENTAGE: 2
};

const OTP_TYPE = {
	FORGOT_PASSWORD: 1,
	OTP_LOGIN: 2
}

const VEHICLE_TYPE = {
	NORMAL: 0,
	EV: 1
}

const PROVIDER_TYPE = {
	NORMAL: 0,
	PARTNER: 1,
	ADMIN: 2
}

const VEHICLE_HISTORY_TYPE = { // Type of vehicle history log
	ADDED: 0,
	UPDATED: 1,
	ASSIGNED: 2,
	UNASSIGNED: 3,
    PICKED: 4,
	DROPPED: 5
}

const DEFAULT_VALUE = {
    OTP: "123456",
    PASSWORD: "123456",
}

const SMS_TEMPLATE = {
    USER_OTP_VERIFICATION: 1,
    PROVIDER_OTP_VERIFICATION: 2,
    FORGOT_PASSWORD: 3,
    RIDE_BOOKING: 4,
    TRIP_ACCEPTED: 5,
    WEEKLY_PAYMENT: 6,
    START_RIDE: 7,
    EMERGENCY_HELP: 8,
    OTP_VERIFICATION: 9,
    FORGOT_PASSWORD_OTP:10,
    RENTAL_WEEKLY_PAYMENT: 11
}


const OPEN_RIDE_STATUS = {
	WAITING: 0,
	ACCEPTED: 1,
	REJECTED: 2,
	DRIVER_REMOVED_USER: 3,
	NO_RESPOND_FROM_USER: 4, // pop up gone from user
}

const OPEN_RIDE_CANCEL_REASON = {
	NO_USER_FOUND: 0,
	NO_ACCEPTED_USER_FOUND: 1,
}

exports = WSAL_SMS_STRING = {
    "BAD_REQUEST" : "Defined in “resultMsg”",
	"DRIVER_VEHICLE_DUPLICATE" : "Driver or vehicle already registered",
	"DRIVER_NOT_ALLOWED" : "Foreign nationalities are not allowed per TGA rules",
	"DRIVER_NOT_FOUND" : "Driver information is not correct kindly revise input data before re-attempting registration",
	"VEHICLE_NOT_FOUND" : "Vehicle information is not correct kindly revise input data before re-attempting registration",
	"VEHICLE_NOT_OWNED_BY_FINANCIER" : "Vehicle ownership is not associated/linked to the driver nor an approved by SAMA financer",
	"DRIVER_NOT_AUTHORIZED_TO_DRIVE_VEHICLE" : "Driver does not own the vehicle and there is no legal association between the driver and the vehicle “Not the co-owner/actual driver of the vehicle in MOI/Absher systems”",
	"NO_VALID_OPERATION_CARD" : "No valid operating card found",
	"CONTACT_WASL_SUPPORT" : "System internal error/missing data, kindly contact Wasl Support",
	"NO_OPERATIONAL_CARD_FOUND" : "No valid operation card found",

	"ALIEN_LEGAL_STATUS_NOT_VALID":"Alien residency is not valid",
	"MAX_AGE_NOT_SATISFIED":"Driver’s age is greater than 65",
	"MIN_AGE_NOT_SATISFIED":"Driver age is less than 18",
	"DRIVER_IDENTITY_EXPIRED":"Driver’s identity is expired",
	"DRIVER_IS_BANNED":"Driver is banned from practicing dispatching Alien residency is not valid activities from Wasl platform per TGA order",
	"DRIVER_LICENSE_EXPIRED":"Driver license is expired",
	"DRIVER_LICENSE_NOT_ALLOWED":"Driver’s license type is not allowed",
	"VEHICLE_INSURANCE_EXPIRED":"Vehicle’s insurance has expired",
	"VEHICLE_LICENSE_EXPIRED":"Vehicle’s license has expired",
	"VEHICLE_NOT_INSURED":"Vehicle does not have a valid insured",
	"OLD_VEHICLE_MODEL":"Vehicle’s model is older than 5 years",
	"PERIODIC_INSPECTION_POLICY_EXPIRED":"Vehicle’s periodic inspection expired",
	"DRIVER_FAILED_CRIMINAL_RECORD_CHECK":"Criminal record check is complete and the driver is ineligible to practice the dispatching activity due to the criminal record check result",
	"DRIVER_REJECTED_CRIMINAL_RECORD_CHECK":"Criminal record check was declined by the driver on Absher portal",
	"CRIMINAL_RECORD_CHECK_PERIOD_EXPIRED":"The driver did not accept nor decline the criminal record check on Absher portal within 10 days since the request initiation date",
	"VEHICLE_PLATE_TYPE_NOT_ALLOWED":"Vehicle License Type/Category is not allowed",
	"OPERATION_CARD_EXPIRED":"Vehicle operation card is expired. Utilize the registration service in order to update the driver eligibility status.",
	"DRIVER_ELIGIBILITY_EXPIRED":"Driver eligibility status is expired. Utilize the registration service in order to update the driver eligibility status.",
	"DRIVER_VEHICLE_INELIGIBLE":"Driver does not have an eligible vehicle, the company should check associated vehicles rejection reasons to the driver then fix the reason then reregister the driver and vehicle again.",
	"VEHICLE_ELIGIBILITY_EXPIRED":"Vehicle eligibility expired.",
	"NO_VALID_OPERATION_CARD_FOUND":"Vehicle does not have a valid operation card to renew eligibility.",
	"NO_PERIODIC_INSPECTION_POLICY_EXPIRY_DATE":"Vehicle does not have a periodic inspection expiry date.",

	"WAITING":"Waiting for sending criminal record check request",
	"PENDING_DRIVER_APPROVAL":"Driver criminal record check request is initiated and an SMS message has been sent to the driver’s mobile number to approve/reject the request on Absher portal",
	"DRIVER_APPROVED":"Criminal record check was approved by the driver on Absher portal",
	"DRIVER_REJECTED":"Criminal record check was declined by the driver on Absher portal",
	"UNDER_PROCESSING":"Driver is undergoing criminal record checks",
	"DONE_RESULT_OK":"Criminal record check is complete and the result indicates that the driver can practice the dispatching activity",
	"DONE_RESULT_NOT_OK":"Criminal record check is complete and the driver is ineligible to practice the dispatching activity due to the criminal record check result",
	"REQUEST_EXPIRED":"The driver did not accept nor decline the criminal record check on Absher portal within 10 days since the request initiation date",
    "SUCCESS":"Request Successfully",
    "INVALID_ID":"Your ID Is Not Valid."
}

const FUEL_TYPE = {
	GASOLINE: 1,
	DIESEL: 2,
	ELECTRIC: 3,
	HYBRID: 4
}

const TRANSMISSION_TYPE = {
	AUTOMATIC: 1,
	MANUAL: 2
}

// Rental Trip Status
const RENTAL_TRIP_STATUS = {
    CREATED: 0,
    ACCEPTED: 1,
    PAYMENT: 2,
    DRIVER_HANDOVER: 3,
    USER_HANDOVER: 4,
    ADDITIONAL_PAYMENT: 5,
    COMPLETED: 6,
    CANCELLED: 7
};

// Rental Trip Status
const RENTAL_CLIENT_SUBSCRIPTION_TYPE = {
    STRIPE: 0,
    MEMO_PAYMENT: 1
};

module.exports = {
    TOKEN_SECRET,
    PAYMENT_GATEWAY,
    IS_ADD_CARD,
    LANGUAGES,
    PAYMENT_STATUS,
    SPLIT_PAYMENT,
    TYPE_VALUE,
    TRIP_STATUS,
    TRIP_LIST,
    VEHICLE_ACCESIBILITY_TYPE,
    VEHICLE_ACCESIBILITY_TYPE_STRING,
    VEHICLE_ACCESIBILITY,
    DOCUMENT_TYPE,
    PROVIDER_STATUS,
    TRIP_STATUS_TIMELIME,
    HIDE_DETAILS,
    COLLECTION,
    UPDATE_LOG_TYPE,
    UPDATE_LOG_OPERATION,
    ADMIN_NOTIFICATION_TYPE,
    PERMISSION_TO_NOTIFICATION_TYPE,
    TRIP_TYPE,
    PROFIT_TYPE,
    OTP_TYPE,
    VEHICLE_TYPE,
    PROVIDER_TYPE,
    VEHICLE_HISTORY_TYPE,
    DEFAULT_VALUE,
    SMS_TEMPLATE,
    OPEN_RIDE_STATUS,
    OPEN_RIDE_CANCEL_REASON,
    FUEL_TYPE,
    TRANSMISSION_TYPE,
    RENTAL_TRIP_STATUS,
    RENTAL_CLIENT_SUBSCRIPTION_TYPE
};