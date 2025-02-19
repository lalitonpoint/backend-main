let mongoose = require('mongoose'),
Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let vehicle_history = new Schema({
    unique_id: Number, // A numeric unique identifier of log entry

    vehicle_id: {type: Schema.Types.ObjectId}, // An ID of the vehicle
    vehicle_unique_id: {type: Number}, // A numberic Unique ID of the vehicle

    logs: {type: Array, default: []}, // An array of log records

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

vehicle_history.plugin(autoIncrement.plugin, {model: 'vehicle_history', field: 'unique_id', startAt: 1, incrementBy: 1});
// set up a mongoose model and pass it using module.export
module.exports = mongoose.model('Vehicle_History', vehicle_history);