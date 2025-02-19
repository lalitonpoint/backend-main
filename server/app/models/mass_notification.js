let mongoose = require('mongoose')
let schema = mongoose.Schema
let autoIncrement = require('mongoose-id-autoincrement');

let mass_notification = new schema({
    unique_id: Number,
    user_type: Number,
    device_type: { type: String },
    user_id: {type: schema.Types.ObjectId},
    username: {type: String, default: ""},
    email: {type: String, default: ""},
    country: { type: schema.Types.ObjectId },
    message: {type: String, default: ''},
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

mass_notification.plugin(autoIncrement.plugin, {model: 'mass_notification', field: 'unique_id', startAt: 1, incrementBy: 1});
module.exports = mongoose.model('mass_notification', mass_notification);
