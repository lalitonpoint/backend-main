let mongoose = require('mongoose'),
Schema = mongoose.Schema;

let car_rent_model = new Schema({
    brand_id: {type: Schema.Types.ObjectId}, // An ID of the Vehicle Brand
    name: {type: String, default: ""}, // Vehicle Brand name like TATA, Mahindra, etc
    is_active: {type: Boolean, default: false}, // For status is active or not. Default is false.
    type_id: {type: Schema.Types.ObjectId}, // An ID of the Type
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

module.exports = mongoose.model('Car_Rent_Model', car_rent_model);
