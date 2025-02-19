let mongoose = require('mongoose'),
Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let vehicle_availability = new Schema({
    start_date: {
        type: Date,
        default: Date.now
    },
    end_date: {
        type: Date,
        default: Date.now
    },
    trip_id: {type: Schema.Types.ObjectId},
    availability_type: {type: Number, default: 1} // 1 by Driver, 2 by Trip and 3 by BufferTime
});

let car_rent_vehicle = new Schema({
    unique_id: Number,
    provider_id: {type: Schema.Types.ObjectId}, // An ID of vehicle owner

    unique_no: {type: String, default: ""}, // Vehicle unique number
    plate_no: {type: String, default: ""}, // Vehicle plate number
    brand_id: {type: Schema.Types.ObjectId}, // An ID of the Rent Vehicle brand
    model_id: {type: Schema.Types.ObjectId}, // An ID of the Rent vehicle model
    type_id: {type: Schema.Types.ObjectId}, // An ID of the Rent vehicle model
    color: {type: String, default: ""}, // Vehicle color
    year: {type: String, default: ""}, // Vehicle year

    no_of_seats : { type: String, default: "" }, // Vehicle seat count
    fuel_type: {type: Number, default: 1 }, // From constant FUEL_TYPE. default is GASOLINE
    transmission_type: {type: Number, default: 1}, // From constant TRANSMISSION_TYPE. default is AUTOMATIC
    features: { type: [Schema.Types.ObjectId], default: [] }, // Vehicle features

    min_trip_duration: {type: String, default: ""}, // minimum booking duration
    max_trip_duration: {type: String, default: ""}, // maximum booking duration
    buffer_time: {type: String, default: ""}, // Duration between two bookings for the same vehicle
    address: {type: String, default: ""}, // Address where the user can pick up the vehicle
    location: { type: [Number], index: '2d' }, // Location where the user can pick up the vehicle
    handover_type: { type: Number, default: 0 }, // When the user can pick up or drop off the vehicle. The default value of 0 means the user can pick up or drop off at any time.
    handover_time: { type: Array, default: [] }, // The user can pick up or drop off the vehicle within this time frame.
    description: { type: String, default: "" }, // Vehicle description
    
    base_price: {type: String, default: ""}, // base price of booking
    cancellation_charge: {type: String, default: ""}, // cancellation charge
    max_distance_per_day: {type: String, default: ""}, // User can travel this distance on average per day
    additional_charge_per_unit_distance: {type: String, default: ""}, // additional charge per unit distance

    images: {type: Array, default: []}, //vehicle images

    non_availability: [{type: vehicle_availability, default: []}], // The user can't book this vechile within this time frame.

    admin_status: {type: Number, default : 0 }, // Admin status, default as PENDING(0)
    is_active: { type: Boolean, default: false}, // vehicle business, default OFF
    rejection_reason: { type: String, default: "" }, // vehicle rejection reason
    rate:{type: Number, default: 0}, // Average rating
    rate_count: {type: Number, default: 0}, // Total rating count
    total_request: {type: Number, default: 0}, 
    accepted_request: {type: Number, default: 0}, 
    completed_request: {type: Number, default: 0}, 
    cancelled_request: {type: Number, default: 0}, 
    currency_code: { type: String, default: "" }, // Provider Currency Code
    currency_sign: { type: String, default: "" }, // Provider Currency Sign

    unit: { type: Number, default: 0 }, // Provider Distance Unit. MILES as 0 and KM as 1

    is_delivery_available: { type: Boolean, default: false}, // vehicle delivery
    delivery_distance: { type: String, default: "" }, // how far is vehicle delivery available
    delivery_charge_per_unit_distance: { type: String, default: "" }, // vehicle delivery charge per unit distance
    delivery_time_type: { type: Number, default: 0 }, // vehicle delivery type. default ANYTIME(0) or it can be SAME_AS_HANDOVER_TYPE(1)

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

car_rent_vehicle.plugin(autoIncrement.plugin, {model: 'car_rent_vehicle', field: 'unique_id', startAt: 1, incrementBy: 1});
module.exports = mongoose.model('Car_Rent_Vehicle', car_rent_vehicle);