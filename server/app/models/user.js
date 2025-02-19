let mongoose = require('mongoose');
let mongoosePaginate = require('mongoose-paginate');
let Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');
/// set up a mongoose model and pass it using module.exports

let user = new Schema({
    unique_id: Number,
    user_type: Number,
    user_type_id: {type: Schema.Types.ObjectId, default: null},
    first_name: {type: String, default: ""},
    last_name: {type: String, default: ""},
    email: {type: String, default: ""},
    country_phone_code: {type: String, default: ""},
    alpha2: { type: String, trim: true, uppercase: true, default: "" },
    phone: {type: String, default: ""},
    gender: {type: String, default: ""},
    token: {type: String, default: ""},
    password: {type: String, default: ""},
    picture: {type: String, default: ""},
    device_token: {type: String, default: ""},
    device_type: {type: String, default: ""},
    corporate_ids: {type: Array, default: []},
    bio: {type: String, default: ""},
    favourite_providers: [{type: Schema.Types.ObjectId}],
    favourite_rent_vehicles: [{type: Schema.Types.ObjectId}],
    address: {type: String, default: ""},
    zipcode: {type: String, default: ""},
    social_unique_id: {type: String, default: ""},
    social_ids: [{type: String, default: []}],
    login_by: {type: String, default: ""},
    device_timezone: {type: String, default: ""},
    customer_id: {type: String, default: ""},
    city: {type: String, default: ""},
    is_document_uploaded: {type: Number, default: 1},
    referred_by: {type: Schema.Types.ObjectId, default: null},
    is_referral: {type: Number, default: 0},
    country: {type: String, default: ""},
    total_referrals: {type: Number, default: 0},
    refferal_credit: {type: Number, default: 0},
    total_redeem_point: {type: Number, default: 0},
    corporate_wallet_limit: {type: Number, default: 0},
    wallet: {type: Number, default: 0},
    wallet_currency_code: {type: String, default: ""},
    transaction_reference: {type: String, default: ""},
    is_use_wallet: {type: Number, default: 0},
    current_trip_id: {type: Schema.Types.ObjectId, default: null},
    is_approved: {type: Number, default: 1},
    promo_count: {type: Number, default: 0},
    home_address: {type: String, default: ""},
    work_address: {type: String, default: ""},
    otp_sms: {type: String, default: ""},
    otp_mail: {type: String, default: ""},
    is_documents_expired: {type: Boolean, default: false},
    home_location: {
        type: [Number],
        index1: '2d'
    },
    work_location: {
        type: [Number],
        index1: '2d'
    },
    total_request: {type: Number, default: 0},
    completed_request: {type: Number, default: 0},
    cancelled_request: {type: Number, default: 0},
    total_rental_request: {type: Number, default: 0},
    rental_completed_request: {type: Number, default: 0},
    rental_cancelled_request: {type: Number, default: 0},
    rental_rate:{type: Number, default: 0},
    rental_rate_count: {type: Number, default: 0},
    img: {data: Buffer, contentType: String},
    app_version: {type: String, default: ""},
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    },
    referral_code: {type: String, default: ""},
    rate: {type: Number, default: 0},
    rate_count: { type: Number, default: 0 },
    uid: { type: String },
    webpush_config:{type:Object,default:{}},
    lang_code: {type: String, default: 'en'}

}, {
  usePushEach: true 
}, {
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})
user.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});
user.index({country: 1, is_approved: 1}, {background: true});
user.index({phone: 1, is_approved: 1}, {background: true});
user.index({email: 1, is_approved: 1}, {background: true});
user.index({social_unique_id: 1}, {background: true});
user.index({updated_at: 1}, {background: true});
user.index({referral_code: 1}, {background: true});

user.index({device_type: 1, unique_id: 1, device_token: 1}, {background: true});
user.index({referred_by: 1}, {background: true});
user.index({country: 1}, {background: true});
user.index({country_phone_code: 1, phone: 1}, {background: true});
user.index({first_name: 'text', last_name: 'text'}, {background: true});


user.plugin(mongoosePaginate);
user.plugin(autoIncrement.plugin, {model: 'user', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(user);

module.exports = mongoose.model('User', user);