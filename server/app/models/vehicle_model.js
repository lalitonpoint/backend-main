let mongoose = require('mongoose'),
Schema = mongoose.Schema;

let vehicle_model = new Schema({
    brand_id: {type: Schema.Types.ObjectId}, // An ID of the Vehicle Brand
    vehicle_type: {type: Number, default: 0}, // From constant VEHICLE_TYPE. default is NORMAL
    name: {type: String, default: ""}, // Vehicle Brand name like TATA, Mahindra, etc
    is_active: {type: Boolean, default: false}, // For status is active or not. Default is false.
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
},{
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

module.exports = mongoose.model('Vehicle_Model', vehicle_model);