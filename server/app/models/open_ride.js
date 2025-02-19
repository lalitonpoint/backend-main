let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let user_detail = new Schema({
    user_id: { type: Schema.Types.ObjectId },
    first_name: { type: String, default: '' },
    last_name: { type: String, default: '' },
    country_phone_code: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    picture: { type: String, default: "" },
    rate: { type: Number, default: 0 },
    payment_gateway_type: { type: Number, default: 0 },
    payment_intent_id: { type: String, default: "" },
    status: {
        type: Number,
        enum: [0, 1, 2, 3,4],
        default: 0
    },
    payment_mode: { type: Number },
    payment_status: { type: Number, enum: [0, 1, 2], default: 0 },
    total: { type: Number, default: 0 },

    //* 27 Oct 2023
    refund_amount: { type: Number, default: 0 },
    is_amount_refund: { type: Boolean, default: false },
    confirmation_code: { type: Number },
    is_otp_verification: { type: Boolean },

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
    unique_id: {
        type: Number
    },
    is_user_invoice_show: {
        type: Number,
        default: 0
    },
    user_booked_time: {
        type: Date,
        default: Date.now
    },
    booking_cancelled: {
        type: Number,
        default: 0
    },
    booking_cancelled_by_user: {
        type: Number,
        default: 0
    },
    booking_cancelled_by_provider: {
        type: Number,
        default: 0
    },
    user_ride_completed: {
        type: Number,
        default: 0
    },
    cancel_reason: { type: String, default: "" },
    sourceLocation: {
        type: [Number],
        index: '2d'
    },
    destinationLocation: {
        type: [Number],
        index1: '2d'
    },
    source_address: { type: String, default: "" },
    destination_address: { type: String, default: "" },
    is_paid: { type: Number, default: 0 },
    total_after_wallet_payment: { type: Number, default: 0 },
    remaining_payment: {
        type: Number,
        default: 0
    },
    user_toll_amount: {
        type: Number,
        default: 0
    },
    is_pending_payments: {type: Number, default: 0},
    send_req_to_provider_first_time: {type: Number, default: 0},
    device_token: { type: String, default: "" },
    device_type: { type: String, default: "" },
    webpush_config: { type: Object, default: {} }
});

let provider_detail = new Schema({
    first_name: { type: String, default: '' },
    last_name: { type: String, default: '' },
    country_phone_code: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    picture: { type: String, default: "" },
    unique_id: { type: Number },
    rate: { type: Number, default: 0 },
});

let Open_Ride_Schema = new Schema({
    unique_id: Number,
    invoice_number: { type: String, default: "" },
    provider_language: [{ type: Schema.Types.ObjectId }],
    received_trip_from_gender: [{ type: String }],
    accessibility: [{ type: String }],
    service_type_id: { type: Schema.Types.ObjectId },
    type_id: { type: Schema.Types.ObjectId },
    user_ids: [{ type: Schema.Types.ObjectId }],
    provider_id: { type: Schema.Types.ObjectId },
    confirmed_provider: { type: Schema.Types.ObjectId },
    typeid: { type: Schema.Types.ObjectId },
    provider_details: [provider_detail],
    user_details: [user_detail],
    trip_service_city_type_id: { type: Schema.Types.ObjectId },
    pickup_city_id: { type: Schema.Types.ObjectId },
    destination_city_id: { type: Schema.Types.ObjectId },
    speed: { type: Number, default: 0 },
    bearing: { type: Number, default: 0 },
    vehicle_capacity: { type: Number, default: 0 },
    luggage_allowacation: { type: Number, default: 0 },
    provider_vehicle_id: { type: Schema.Types.ObjectId },
    trip_type: Number,
    user_type: Number,
    user_type_id: { type: Schema.Types.ObjectId },
    provider_type: Number,
    provider_type_id: { type: Schema.Types.ObjectId },
    payment_gateway_type: { type: Number, default: 10 },
    payment_id: Number,
    support_phone_user: { type: String, default: "" },
    
    payment_intent_id: { type: String, default: "" },
    tip_payment_intent_id: { type: String, default: "" },
    is_surge_hours: {type: Number, default: 0},
    surge_multiplier: {type: Number, default: 0},
    // payment_status: { type: Number, default: 0 },

    is_provider_status: { type: Number, default: 0 },
    is_provider_accepted: {type: Number, default: 0},
    is_trip_end: { type: Number, default: 0 },
    is_trip_completed: { type: Number, default: 0 },
    is_trip_cancelled: { type: Number, default: 0 },
    is_trip_cancelled_by_provider: { type: Number, default: 0 },
    is_trip_cancelled_by_admin: { type: Number, default: 0 },
    trip_type_amount: { type: Number, default: 0 },
    is_min_fare_used: { type: Number, default: 0 },
    is_provider_rated: { type: Number, default: 0 },
    is_user_rated: { type: Number, default: 0 },
    total_service_fees: { type: Number, default: 0 },

    user_app_version: { type: String, default: "" },
    provider_app_version: { type: String, default: "" },
    user_device_type: { type: String, default: "" },
    provider_device_type: { type: String, default: "" },
    booking_type: {type: Array, default: []},

    // provider_to_user_estimated_distance: { type: Number },
    // provider_to_user_estimated_time: { type: Number },

    // is_user_invoice_show: {
    //     type: Number,
    //     default: 0
    // },

    token:  { type: String, default: "" },
    is_provider_invoice_show: {
        type: Number,
        default: 0
    },
    is_cancellation_fee: {
        type: Number,
        default: 0
    },
    
    is_schedule_trip: {type: Boolean, default: false},
    is_tip: { type: Boolean, default: false },
    tip_amount: {
        type: Number,
        default: 0
    },
    is_toll: { type: Boolean, default: false },
    toll_amount: {
        type: Number,
        default: 0
    },
    source_address: { type: String, default: "" },
    destination_address: { type: String, default: "" },
    sourceLocation: {
        type: [Number],
        index: '2d'
    },
    initialDestinationLocation: {
        type: [Number],
        index1: '2d'
    },
    destinationLocation: {
        type: [Number],
        index1: '2d'
    },
    providerPreviousLocation: {
        type: [Number],
        index: '2d'
    },
    providerLocation: {
        type: [Number],
        index1: '2d'
    },

    complete_date_tag: { type: String, default: "" },
    complete_date_in_city_timezone: {
        type: Date
    },

    promo_id: { type: Schema.Types.ObjectId },
    currency: { type: String, default: "" },
    currencycode: { type: String, default: "" },
    admin_currency: { type: String, default: "" },
    admin_currencycode: { type: String, default: "" },
    unit: { type: Number, default: 0 },
    timezone: { type: String, default: "" },

    cancel_reason: { type: String, default: "" },
    payment_error: { type: String, default: "" },
    payment_error_message: { type: String, default: "" },
    total_distance: { type: Number, default: 0 },
    total_time: { type: Number, default: 0 },
    total_waiting_time: { type: Number, default: 0 },
    total_stop_waiting_time: { type: Number, default: 0 },
    actual_time: { type: Number, default: 0 },
    actual_distance: { type: Number, default: 0 },
    // actual_price: { type: Number, default: 0 },
    // is_provider_assigned_by_dispatcher: { type: Boolean, default: false },

    // Start 6 March //
    distance_cost: {type: Number,
        default: 0
    },
    time_cost: {type: Number,
        default: 0
    },
    base_distance_cost: {type: Number, default: 0},
    city_id: { type: Schema.Types.ObjectId },
    country_id: { type: Schema.Types.ObjectId },
    is_fixed_fare: { type: Boolean, default: false },
    fixed_price: { type: Number, default: 0 },
    openride: { type: Boolean, default: true },
    is_provider_earning_set_in_wallet: { type: Boolean, default: false },
    is_provider_earning_added_in_wallet: { type: Boolean, default: false },
    is_transfered: { type: Boolean, default: false },
    provider_have_cash: { type: Number, default: 0 },
    pay_to_provider: { type: Number, default: 0 },
    provider_income_set_in_wallet: { type: Number, default: 0 },
    payment_transaction: { type: Array, default: [] },
    booked_seats: { type: Number, default: 0 },
    source_city_name: { type: String, default: "" },
    destination_city_name: { type: String, default: "" },
    // refund_amount: { type: Number, default: 0 },
    // is_amount_refund: { type: Boolean, default: false },

    // All trip statuses will be stored in this array with timestamp
    trip_status: { type: Array, default: [] },

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
    // payment_mode: Number,
    wallet_payment: {
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
    current_rate: {
        type: Number,
        default: 0
    },
    wallet_current_rate: Number,
    provider_service_fees: {
        type: Number,
        default: 0
    },
    total_in_admin_currency: {
        type: Number,
        default: 0
    },
    service_total_in_admin_currency: {
        type: Number,
        default: 0
    },
    provider_service_fees_in_admin_currency: {
        type: Number,
        default: 0
    },
    total_after_user_tax_fees: {
        type: Number,
        default: 0
    },
    provider_profit_fees: {
        type: Number,
        default: 0
    },
    user_miscellaneous_fee: {type: Number,
        default: 0
    },
    user_tax: {type: Number,
        default: 0
    },
    total_after_surge_fees: {type: Number,
        default: 0
    },
    tax_fee: {type: Number,
        default: 0
    },
    total_after_tax_fees: {type: Number,
        default: 0
    },
    user_tax_fee: {type: Number,
        default: 0
    },
    provider_miscellaneous_fee: {type: Number,
        default: 0
    },
    provider_tax_fee: {type: Number,
        default: 0
    },

    surge_fee: {type: Number,
        default: 0
    },
    payment_status: { type: Number,  default: 0 },
    user_create_time: {
        type: Date,
        default: Date.now
    },
    schedule_start_time: {
        type: Date,
        default: Date.now
    },
    server_start_time_for_schedule: {
        type: Date,
        default: Date.now
    },
    provider_arrived_time: {
        type: Date,
        default: Date.now
    },
    provider_trip_start_time: {
        type: Date,
        default: Date.now
    },
    provider_trip_end_time: {
        type: Date,
        default: Date.now
    },
    destination_addresses: { type: Array, default: [] },
    actual_destination_addresses: { type: Array, default: [] },
    // is_otp_verification: { type: Boolean },
    // confirmation_code: { type: Number },
    created_by: { type: Number },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date
    }
},
    {
        strict: true,
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

Open_Ride_Schema.plugin(autoIncrement.plugin, { model: 'Open_Ride', field: 'unique_id', startAt: 1, incrementBy: 1 });
let Open_Ride = mongoose.model('Open_Ride', Open_Ride_Schema);
module.exports = Open_Ride;