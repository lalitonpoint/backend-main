let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let vehicle_price_detail = new Schema({
    base_price: {type: Number, default: 0},
    platform_fee: {type: Number, default: 0},
    cancellation_price: {type: Number, default: 0},
    max_distance_per_day : {type: Number, default: 0},
    additional_charge_per_unit_distance : {type: Number, default: 0},
    plate_no: {type: String, default: ""},
    unique_no: {type: String, default: ""},
    color: {type: String, default: ""},
    no_of_seats: {type: String, default: ""},
    transmission_type: {type: Number},
    fuel_type: {type: Number},
    features: {type: Array, default: []},
    location: {
        type: [Number],
        index: '2d'
    },
    address: {type: String, default: ""},
    description: {type: String, default: ""},
    handover_type: { type: Number, default: 1 },
    handover_time: { type: Array, default: [] },
    is_delivery_available: { type: Boolean, default: false},
    delivery_distance: { type: String, default: "" },
    delivery_charge_per_unit_distance: { type: String, default: "" },
    delivery_time_type: { type: Number, default: 0 }
})

let Rental_Trip = new Schema({
    unique_id: Number, 
    invoice_number: {type: String, default: ""},
    vehicle_id: {type: Schema.Types.ObjectId},
    country_id: {type: Schema.Types.ObjectId},
    type_id: {type: Schema.Types.ObjectId},
    
    trip_duration: Number,
    
    vehicle_price_details:{ type: vehicle_price_detail, default: {} },

    base_price: {type: Number, default: 0},
    platform_fee: {type: Number, default: 0},
    delivery_fee: {type: Number, default: 0},
    additional_price: {type: Number, default: 0},

    pre_distance: {type: Number, default: 0},
    post_distance: {type: Number, default: 0},

    provider_id: {type: Schema.Types.ObjectId},
    provider_type: Number,
    provider_type_id: {type: Schema.Types.ObjectId},
    provider_unique_id: { type: Number },
    provider_first_name: {type: String, default: ""},
    provider_last_name: {type: String, default: ""},
    provider_phone_code: { type: String, default: "" },
    provider_phone: { type: String, default: "" },
    provider_app_version: {type: String, default: ""},
    provider_device_type: {type: String, default: ""},

    user_id: {type: Schema.Types.ObjectId},
    user_type: Number,
    user_type_id: {type: Schema.Types.ObjectId},
    user_unique_id: { type: Number },
    user_first_name: {type: String, default: ""},
    user_last_name: {type: String, default: ""},
    user_phone_code: { type: String, default: "" },
    user_phone: { type: String, default: "" },
    user_app_version: {type: String, default: ""},
    user_device_type: {type: String, default: ""},
    
    payment_gateway_type: {type: Number, default: 10},
    payment_intent_id: {type: String, default: ""},
    additional_payment_intent_id: {type: String, default: ""},
    payment_status: {type: Number, default: 0},

    is_provider_accepted: {type: Number, default: 0},

    trip_status: {type: Array, default: []},
    status: {type: Number, default: 0},

    is_trip_end: {type: Number, default: 0},
    is_trip_completed: {type: Number, default: 0},
    is_trip_cancelled: {type: Number, default: 0},
    cancelled_by: { type: Number, default: 0 }, // default Set to USER
    
    is_user_rated: {type: Number, default: 0},
    is_vehicle_rated: {type: Number, default: 0},
    is_provider_rated: {type: Number, default: 0},

    user_rating: {type: Number, default: 0},
    vehicle_rating: {type: Number, default: 0},
    provider_rating: {type: Number, default: 0},

    user_review: {type: String, default: ""},
    vehicle_review: {type: String, default: ""},
    provider_review: {type: String, default: ""},

    is_user_invoice_show: {type: Number,default: 0},
    is_provider_invoice_show: {type: Number,default: 0},

    is_paid: {type: Number, default: 0},
    is_cancellation_fee: {type: Number, default: 0},
    is_pending_payments: {type: Number, default: 0},
    total_after_wallet_payment: {type: Number, default: 0},
    remaining_payment: {type: Number,default: 0},

    cancellation_price: {type: Number,default: 0},

    pickup_address: {type: String, default: ""},
    pickupLocation: {
        type: [Number],
        index: '2d'
    },
    dropoff_address: {type: String, default: ""},
    dropoffLocation: {
        type: [Number],
        index1: '2d'
    },
    address: {type: String, default: ""},
    location: {
        type: [Number],
        index1: '2d'
    },
    
    currency: {type: String, default: ""},
    currencycode: {type: String, default: ""},
    admin_currency: {type: String, default: ""},
    admin_currencycode: {type: String, default: ""},
    cancel_reason: {type: String, default: ""},
    payment_error: {type: String, default: ""},
    payment_error_message: {type: String, default: ""},

    is_provider_earning_set_in_wallet: {type: Boolean, default: false},
    is_provider_earning_added_in_wallet: {type: Boolean, default: false},
    provider_income_set_in_wallet: {type: Number, default: 0},
    is_transfered: {type: Boolean, default: false},
    pay_to_provider: {type: Number, default: 0},
    payment_transaction: {type: Array, default: []},

    is_notified: {type: Boolean, default: false},

    is_amount_refund: {type: Boolean, default: false},
    refund_amount: {type: Number, default: 0},
    created_by: { type: Number },
    is_otp_verification: { type: Boolean },
    confirmation_code: { type: Number },
    support_phone_user: {type: String, default: ""},
    timezone: {type: String, default: ""},
    unit: {type: Number, default: 0},

    booking_type: {type: Number, default: 0}, // 0 as NORMAL and 1 as WITH_VEHICLE_DELIVERY

    payment_mode: {
        type: Number, 
        default: 0 // default payment_mode is CARD
    },
    current_rate: Number,
    wallet_current_rate: Number,
    
    total_service_fees: {
        type: Number,
        default: 0
    },
    service_total_in_admin_currency: {
        type: Number,
        default: 0
    },
    tax_fee: {
        type: Number,
        default: 0
    },
    total_after_tax_fees: {
        type: Number,
        default: 0
    },
    user_miscellaneous_fee: {
        type: Number,
        default: 0
    },
    provider_miscellaneous_fee: {
        type: Number,
        default: 0
    },
    user_tax_fee: {
        type: Number,
        default: 0
    },
    total_after_user_tax_fees: {
        type: Number,
        default: 0
    },
    provider_tax_fee: {
        type: Number,
        default: 0
    },
    promo_payment: {
        type: Number,
        default: 0
    },
    total_after_promo_payment: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    },
    total_in_admin_currency: {
        type: Number,
        default: 0
    },
    cash_payment: {
        type: Number,
        default: 0
    },
    card_payment: {
        type: Number,
        default: 0
    },
    wallet_payment: {
        type: Number,
        default: 0
    },
    provider_service_fees: {
        type: Number,
        default: 0
    },
    provider_service_fees_in_admin_currency: {
        type: Number,
        default: 0
    },
    additional_distance_charge: {
        type: Number,
        default: 0
    },
    additional_charge: {
        type: Number,
        default: 0
    },
    additional_days: {
        type: Number,
        default: 0
    },
    additional_days_charge: {
        type: Number,
        default: 0
    },
    total_additional_charge: {
        type: Number,
        default: 0
    },
    additional_charge_note: { type: String, default: "" },

    user_create_time: {
        type: Date,
        default: Date.now
    },
    schedule_start_time: {
        type: Date,
        default: Date.now
    },
    schedule_end_time: {
        type: Date,
        default: Date.now
    },
    provider_accepted_time: {
        type: Date,
        default: Date.now
    },
    user_payment_time: {
        type: Date,
        default: Date.now
    },
    provider_handover_time: {
        type: Date,
        default: Date.now
    },
    user_handover_time: {
        type: Date,
        default: Date.now
    },
    provider_completed_time: {
        type: Date, 
        default: Date.now 
    },
    complete_date_in_city_timezone: {
        type: Date, 
        default: Date.now 
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
},{
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

//for find
Rental_Trip.index({user_id: 1, is_trip_cancelled: 1, is_trip_completed: 1}, {background: true});
Rental_Trip.index({provider_id: 1, is_trip_cancelled: 1, is_trip_completed: 1}, {background: true});
Rental_Trip.index({vehicle_id: 1, is_trip_cancelled: 1, is_trip_completed: 1}, {background: true});
Rental_Trip.index({is_provider_status: 1, is_trip_cancelled: 1}, {background: true});
Rental_Trip.index({typename: 1}, { background: true });

//for aggregate
Rental_Trip.index({is_schedule_trip: 1, is_trip_cancelled: 1, is_trip_completed: 1, is_trip_end: 1, current_provider: 1, user_type_id: 1}, {background: true});

//for auto increament
Rental_Trip.plugin(autoIncrement.plugin, {model: 'Rental_Trip', field: 'unique_id', startAt: 1, incrementBy: 1});

Rental_Trip = mongoose.model('Rental_Trip', Rental_Trip);
module.exports = Rental_Trip;