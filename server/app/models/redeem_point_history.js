let mongoose = require('mongoose');
let mongoosePaginate = require('mongoose-paginate');
let Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');

let redeem_point_history = new Schema({
    unique_id: Number,
    user_type: Number, // if type = 1 => user && type = 2 => driver
    user_unique_id: Number,
    user_id: {type: Schema.Types.ObjectId},
    country_id: {type: Schema.Types.ObjectId},
    redeem_point_type: {type: Number, default: 0}, 
    redeem_point_currency : {type: String, default: ""},
    redeem_point_description: {type: String, default: ""},
    added_redeem_point: {type: Number, default: 0},
    total_redeem_point: {type: Number, default: 0},
    wallet_status:{type: Number, default: 0},
    trip_unique_id: {type: String, default:null},
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }

});

redeem_point_history.index({user_type: 1, created_at: 1}, {background: true});


redeem_point_history.plugin(mongoosePaginate);
redeem_point_history.plugin(autoIncrement.plugin, {model: 'redeem_point_history', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(redeem_point_history);
module.exports = mongoose.model('redeem_point_history', redeem_point_history);

