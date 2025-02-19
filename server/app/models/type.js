let mongoose = require('mongoose'),
    Schema = mongoose.Schema;


let typeSchema = new Schema({
    typename: {type: String, default: ""},
    description: {type: String, default: ""},
    type_image_url: {type: String, default: ""},
    map_pin_image_url:{type: String, default: ""},
    service_type: Number,
    priority: { type: Number, default: 0 },
    is_business:{
        type: Number,
        default: 1
    },
    is_default_selected: {type: Boolean, default: false},
    ride_share_limit: { type: Number, default: 2 },

    vehicle_type: {type: Number, default: 0}, // From constant VEHICLE_TYPE. default is NORMAL

    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }

});
typeSchema.index({typename: 1}, {background: true});

let Type = mongoose.model('Type', typeSchema);
module.exports = Type;

