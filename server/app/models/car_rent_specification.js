let mongoose = require('mongoose'),
Schema = mongoose.Schema;

let car_rent_specification = new Schema({
    title: {type: String, default: ""}, // Specification name like fual type, Seats, etc.
    is_active: {type: Boolean, default: false}, // For status is active or not. Default is false. 
    options: {type: Array, default : [] }, // Specification options like petrol, EV, etc.
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

module.exports = mongoose.model('Car_Rent_Specification', car_rent_specification);