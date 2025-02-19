let mongoose = require('mongoose'),
Schema = mongoose.Schema;

let user_redeem_point_schema = new Schema({
    is_user_redeem_point_reward_on:{type: Boolean, default: false},
    trip_redeem_point:{type: Number, default: 0},
    tip_redeem_point:{type: Number, default: 0},
    referring_redeem_point_to_user:{type: Number, default: 0},
    referring_redeem_point_to_users_friend:{type: Number, default: 0},
    user_review_redeem_point:{type: Number, default: 0},
    user_redeem_point_value:{type: Number, default: 0},
    user_minimum_point_require_for_withdrawal:{type: Number, default: 0}
})

let driver_redeem_point_schema = new Schema({
    is_driver_redeem_point_reward_on:{type: Boolean, default: false},

    daily_completed_trip_count_for_redeem_point:{type: Number, default: 0},
    daily_accepted_trip_count_for_redeem_point:{type: Number, default: 0},
    rating_average_count_for_redeem_point:{type: Number, default: 0},

    daily_completed_trip_redeem_point:{type: Number, default: 0},
    daily_accepted_trip_redeem_point:{type: Number, default: 0},
    high_rating_redeem_point:{type: Number, default: 0},

    driver_review_redeem_point:{type: Number, default: 0},
    driver_redeem_point_value:{type: Number, default: 0},

    driver_minimum_point_require_for_withdrawal:{type: Number, default: 0}

})

let countrySchema = new Schema({

    countryname: {type: String, default: ""},
    countrycode: {type: String, default: ""},
    alpha2: {type: String, default: ""},
    currency: {type: String, default: ""},
    flag_url: {type: String, default: ""},
    currencycode: {type: String, default: ""},
    currencysign: {type: String, default: ""},
    countrytimezone: {type: String, default: ""},
    country_all_timezone: {type: Array, default: []},
    payment_gateways: {type: Array, default: []},
    countryphonecode: {type: String, default: ""},
    isBusiness: {type: Number, default: 1},
    isRentalBusiness: {type: Number, default: 0},
    referral_bonus_to_user: {type: Number, default: 0},
    bonus_to_providerreferral: {type: Number, default: 0},
    referral_bonus_to_provider: {type: Number, default: 0},
    bonus_to_userreferral: {type: Number, default: 0},
    phone_number_min_length: {type: Number, default: 8},
    phone_number_length: {type: Number, default: 10},
    is_referral: {type: Boolean, default: true},
    userreferral: {type: Number, default: 0},
    is_provider_referral: {type: Boolean, default: true},
    providerreferral: {type: Number, default: 0},
    default_selected: {type: Boolean, default: false},
    is_auto_transfer: {type: Boolean, default: true},
    auto_transfer_day: {type: Number, default: 7},
    user_redeem_settings: [user_redeem_point_schema],
    driver_redeem_settings: [driver_redeem_point_schema],
    is_allow_trip_bidding: {type: Boolean, default: false},
    is_user_can_set_bid_price: {type: Boolean, default: false},
    user_bidding_timeout: {type: Number, default: 300},
    provider_bidding_timeout: {type: Number, default: 60},
    no_of_providers_can_bid: {type: Number, default: 5},
    user_min_bidding_limit: {type: Number, default: 0},
    driver_max_bidding_limit: {type: Number, default: 0},
    is_send_money_for_user: {type: Boolean, default: false},
    is_send_money_for_provider: {type: Boolean, default: false},
    is_use_wsal: {type: Boolean, default: false},
    countryLatLong : {
        type: [Number],
        index: '2d'
    },
    
    daily_cron_date: {
        type: Date
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }

});
countrySchema.index({countryname: 1, isBusiness: 1}, {background: true});

let Country = mongoose.model('Country', countrySchema);
module.exports = Country;

