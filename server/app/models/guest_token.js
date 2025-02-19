let mongoose = require('mongoose'),
    Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let guest_token_schema = new Schema({
    unique_id: Number,
    token_name: { type: String, default: "" },
    token_value: { type: String, default: "" },
    state: { type: Boolean, default: true },
    start_date: {
        type: Date,
        default: Date.now
    },
    code_expiry: {
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
});

guest_token_schema.plugin(autoIncrement.plugin, { model: 'guest_token', field: 'unique_id', startAt: 1, incrementBy: 1 });
let Guest_Token = mongoose.model('guest_token', guest_token_schema);
module.exports = Guest_Token;