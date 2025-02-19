let mongoose = require('mongoose'),
Schema = mongoose.Schema;

let vehicle_brand = new Schema({
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

module.exports = mongoose.model('Vehicle_Brand', vehicle_brand);