let mongoose = require('mongoose'),
        mongoosePaginate = require('mongoose-paginate'),
        Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');

let provider = new Schema({
    provider_type: Number,
    provider_type_id: {type: Schema.Types.ObjectId},
    unique_id: Number,
    first_name: {type: String, default: ""},
    languages: [{type: Schema.Types.ObjectId}],
    received_trip_from_gender: [{type: String}],
    is_trip: [{type: Schema.Types.ObjectId}],
    schedule_trip: [{type: Schema.Types.ObjectId}],
    is_near_trip: [{ type: Schema.Types.ObjectId }],
    is_near_available: { type: Number, default: 0 },
    is_go_home: { type: Number, default: 0 },
    is_ride_share: { type: Number, default: 0 },
    wallet: {type: Number, default: 0},
    wallet_currency_code: {type: String, default: ""},
    last_name: {type: String, default: ""},
    email: {type: String, default: ""},
    gender: {type: String, default: ""},
    country_phone_code: {type: String, default: ""},
    customer_id: {type: String, default: ""},
    open_ride: [{type: Schema.Types.ObjectId}],

    total_redeem_point: {type: Number, default: 0},
    
    // 25 May //
    is_documents_expired: {type: Boolean, default: false},
    account_id: {type: String, default: ""},
    account_number: {type: String, default: ""},
    bank_code: {type: String, default: ""},
    bank_id: {type: String, default: ""},
    //  //    

    is_vehicle_document_uploaded: {type: Boolean, default: false},
    phone: {type: String, default: ""},
    password: {type: String, default: ""},
    picture: {type: String, default: ""},
    token: {type: String, default: ""},
    service_type: {type: Schema.Types.ObjectId},
    admintypeid: {type: Schema.Types.ObjectId},
    car_model: {type: String, default: ''},
    car_number: {type: String, default: ''},
    device_token: {type: String, default: ""},
    device_type: {type: String, default: ""},
    app_version: {type: String, default: ""},
    bio: {type: String, default: ""},
    address: {type: String, default: ""},
    address_location: { type: [Number] },
    zipcode: {type: String, default: ""},
    social_unique_id: {type: String, default: ""},
    social_ids: [{type: String, default: []}],
    login_by: {type: String, default: ""},
    device_timezone: {type: String, default: ""},
    bearing: {type: Number, default: 0},
    city: {type: String, default: ""},
    cityid: {type: Schema.Types.ObjectId},
    country: {type: String, default: ""},
    country_id: {type: Schema.Types.ObjectId},
    is_use_google_distance: {
        type: Boolean,
        default: false
    },
    // vehicle_detail: {type: Array, default: []},

    paypal_client_id:{type: String, default: ""},
    paypal_secret_key:{type: String, default: ""},
    paypal_environment:{type: String, default: ""},

    destinationLocation: {type: Array, default: []},

    providerPreviousLocation: {
        type: [Number],
        index1: '2d'
    },
    providerLocation: {
        type: [Number],
        index: '2d'
    },
    is_available: {type: Number, default: 0},
    total_request: {type: Number, default: 0},
    accepted_request: {type: Number, default: 0},
    completed_request: {type: Number, default: 0},
    cancelled_request: {type: Number, default: 0},
    rejected_request: {type: Number, default: 0},
    total_rental_request: {type: Number, default: 0},
    rental_completed_request: {type: Number, default: 0},
    rental_cancelled_request: {type: Number, default: 0},
    rental_rate:{type: Number, default: 0},
    rental_rate_count: {type: Number, default: 0},
    is_active: {type: Number, default: 0},
    is_approved: {type: Number, default: 0},
    is_rental_approved: {type: Number, default: 1},
    is_partner_approved_by_admin: {type: Number, default: 0},
    is_document_uploaded: {type: Number, default: 0},
    device_unique_code: {type: String, default: ""},
    rate:{type: Number, default: 0},
    rate_count: {type: Number, default: 0},
    transaction_reference: {type: String, default: ""},
    otp_sms: {type: String, default: ""},
    otp_mail: {type: String, default: ""},
    national_id: {type: String, default: ""},
    date_of_birth: {type: String, default: ""},

    // wsal status 
    is_driver_approved_from_wsal: {type: Boolean, default: false},
    wsal_result_code: {type: String, default: ''},
    wsal_eligibility: {type: String, default: ''},
    wsal_eligibility_expiry_date: { type: String, default: '' },
    wsal_rejection_reason: {type:Array,default:[]},
    wsal_request: {type:Object,default:{}},
    wsal_response: {type:Object,default:{}},
    wsal_transc_date: {
        type: Date,
        default: Date.now
    },
    wsal_criminal_record_status: { type: String, default: "" },
    provider_unblocked_date: { 
        type: Date,
        default: Date.now
    },

    // trip bidding
    bids: {type: Array, default: []},

    vehicle_type: {type: Number, default: 0}, // From constant VEHICLE_TYPE. default is NORMAL

    // 13 march 
    start_online_time: {
        type: Date
    },

    referred_by: {type: Schema.Types.ObjectId, default: null},
    is_referral: {type: Number, default: 1},
    referral_code: {type: String, default: ""},
    total_referrals: {type: Number, default: 0},

    /// 21 oct

    zone_queue_id: {type: Schema.Types.ObjectId},
    uid: {type: String},

    webpush_config:{type:Object,default:{}},
    lang_code: {type: String, default: 'en'},
    //
    location_updated_time: {
        type: Date,
        default: Date.now
    },
    last_transferred_date: {
        type: Date,
        default: Date.now
    },
    last_rental_profit_transferred_date: {
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
//     usePushEach: true 
// }, {
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

provider.index({email: 1}, {background: true});
provider.index({is_approved: 1, cityid: 1}, {background: true});
provider.index({is_active: 1, is_trip: 1}, {background: true});
provider.index({phone: 1, country_phone_code: 1}, {background: true});
provider.index({is_approved: 1, provider_type_id: 1, cityid: 1, shift: 1}, {background: true});
provider.index({first_name: 'text', last_name: 'text'}, {background: true});

provider.plugin(mongoosePaginate);
provider.plugin(autoIncrement.plugin, {model: 'provider', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(provider);

// set up a mongoose model and pass it using module.export
module.exports = mongoose.model('Provider', provider);