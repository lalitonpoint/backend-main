let mongoose = require('mongoose'),
Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let vehicle = new Schema({
    unique_id: Number,
    user_type: {type: Number, default: 2}, // From constant TYPE_VALUE. default is PROVIDER
    vehicle_type: {type: Number, default: 0}, // From constant VEHICLE_TYPE. default is NORMAL

    country_id: {type: Schema.Types.ObjectId}, // An ID of the country in which the vehicle is added

    name: {type: String, default: ""}, // Vehicle name
    model: {type: String, default: ""}, // Vehicle model
    color: {type: String, default: ""}, // Vehicle color
    plate_no: {type: String, default: ""}, // Vehicle plate number
    passing_year: {type: String, default: ""}, // Vehicle passing year

    brand_id: {type: Schema.Types.ObjectId}, // An ID of the Vehicle brand
    model_id: {type: Schema.Types.ObjectId}, // An ID of the vehicle model

    service_type: {type: Schema.Types.ObjectId}, // Vehicle service type id
    admin_type_id: {type: Schema.Types.ObjectId}, // Admin tyoe id

    user_type_id: {type: Schema.Types.ObjectId}, // An ID of the driver/partner who owns the vehicle
    provider_id: {type: Schema.Types.ObjectId}, // An ID of provider to whom the vehicle is assigned

    is_selected: {type: Boolean, default: false}, // Toggle if vehicle is selected or not
    is_assigned: {type: Boolean, default: false}, // For partners. Default is false.

    is_document_uploaded: {type: Boolean, default: false},
    is_documents_expired: {type: Boolean, default: false},

    //wsal registration data
    sequence_number:{type: String, default: ""},
    plate_type: {type: String, default: "6"}, // defult TAXI as per WASL Documentation.
    left_plate_letter: {type: String, default: ""},
    center_plate_letter: {type: String, default: ""},
    right_plate_letter: {type: String, default: ""},

    //wsal status
    wsal_eligibility: {type: String, default: ""},
    wsal_vehicle_license_eligibility_expiry_date: { type: String, default: "" },
    wsal_vehicle_eligibility_expiry_date: { type: String, default: "" },
    wsal_rejection_reason: {type:Array,default:[]},

    accessibility: { type: [String] },

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

vehicle.plugin(autoIncrement.plugin, {model: 'vehicle', field: 'unique_id', startAt: 1, incrementBy: 1});
// set up a mongoose model and pass it using module.export
module.exports = mongoose.model('Vehicle', vehicle);