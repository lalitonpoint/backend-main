let mongoose = require('mongoose'),
    Schema = mongoose.Schema;

let cardSchema = new Schema({
    payment_method: {type: String, default: ""},
    card_type: {type: String, default: ""},
    user_id: {type: Schema.Types.ObjectId},
    last_four: {type: String, default: ""},
    customer_id: {type: String, default: ""},
    is_default: {type: Number, default: 0},
    payment_gateway_type: {type: Number, default: 10},
    type:Number,
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});
cardSchema.index({user_id: 1, is_default: 1}, {background: true});

let Card = mongoose.model('Card', cardSchema);
module.exports = Card;

