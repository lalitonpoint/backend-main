let mongoose = require('mongoose');
let mongoosePaginate = require('mongoose-paginate');
let Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');

let wallet_history = new Schema({
    unique_id: Number,
    user_type: Number,
    user_unique_id: Number,
    user_id: {type: Schema.Types.ObjectId},
    country_id: {type: Schema.Types.ObjectId},
    from_amount: {type: Number, default: 0},
    from_currency_code: {type: String, default: ""},
    to_currency_code: {type: String, default: ""},
    current_rate: {type: Number, default: 1},
    wallet_status: {type: Number, default: 0},
    wallet_comment_id: {type: Number, default: 1},
    wallet_description: {type: String, default: ""},
    wallet_info: {type: String, default: ""},
    trans_ref: {type: String, default: ""},
    wallet_amount: {type: Number, default: 0},
    added_wallet: {type: Number, default: 0},
    total_wallet_amount: {type: Number, default: 0},
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

wallet_history.index({user_type: 1, created_at: 1}, {background: true});


wallet_history.plugin(mongoosePaginate);
wallet_history.plugin(autoIncrement.plugin, {model: 'wallet_history', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(wallet_history);
module.exports = mongoose.model('Wallet_history', wallet_history);

