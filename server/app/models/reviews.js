let mongoose = require('mongoose'),
    Schema = mongoose.Schema;


let reviewsSchema = new Schema({

    trip_unique_id:Number,
    trip_id: { type: Schema.Types.ObjectId},
    userRating: {type: Number, default: 0},
    vehicleRating: {type: Number, default: 0},
    providerRating: {type: Number, default: 0},
    userReview: { type : String, default:""},
    vehicleReview: { type : String, default:""},
    providerReview: { type : String, default:""},
    user_id: { type: Schema.Types.ObjectId},
    vehicle_id: { type: Schema.Types.ObjectId},
    provider_id: { type: Schema.Types.ObjectId},
    country_id: {type: Schema.Types.ObjectId},
    city_id: {type: Schema.Types.ObjectId},
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

reviewsSchema.index({trip_id: 1}, {background: true});
reviewsSchema.index({created_at: 1}, {background: true});


let Reviews = mongoose.model('Reviews', reviewsSchema);
module.exports = Reviews;

