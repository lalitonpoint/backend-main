let mongoose = require('mongoose'),
Schema = mongoose.Schema;

let car_rent_feature = new Schema({
    title: {type: String, default: ""}, // feature name like fual type, wifi, etc.
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

module.exports = mongoose.model('Car_Rent_Feature', car_rent_feature);