let mongoose = require('mongoose');
let mongoosePaginate = require('mongoose-paginate');
let Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');

let transfer_history = new Schema({
    unique_id: Number,
    user_type: Number,
    user_id: {type: Schema.Types.ObjectId},
    country_id: {type: Schema.Types.ObjectId},
    amount: {type: Number, default: 0},
    currency_code: {type: String, default: ""},
    transfer_status: {type: Number , default: 0},
    transfered_by: {type: Number , default: 0},
    error: {type: Object},
    transfer_id: {type: String, default: ''},
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


transfer_history.plugin(mongoosePaginate);
transfer_history.plugin(autoIncrement.plugin, {model: 'transfer_history', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(transfer_history);
module.exports = mongoose.model('transfer_history', transfer_history);

