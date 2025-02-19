let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

/**
 *     Admin Notification
 *
 *     This model represent an admin notification.
 *     It is used to store notifications such as User registered, Driver registered.
 *
 *     Fields:
 *       unique_id:         Primary key, a unique identifier for each notification.
 *       type:              Type of the notification. Use numeric values to represent different types of notifications.
 *                              - ADMIN_NOTIFICATION_TYPE constant
 *       user_id:           ID of the user which is associated with the notification
 *       username:          Name of the user who is associated with the notification
 *       picture:           Profile picture url of the user who is associated with the notification
 *       user_unique_id:    Unique ID of an user which is associated with the notification
 *       is_read:           Boolean indicating whether the notification is read or not
 *       city_id:           City ID of an user which is associated with the notification
 *       country_id:           Country ID of an user which is associated with the notification
 *       created_at:        Timestamp when the notification was created. It defaults to the current date and time when the entry is inserted into the database.
 **/

let admin_notification = new Schema({
    unique_id: Number,
    type: {type: Number, default: 0},
    user_id: {type: Schema.Types.ObjectId},
    username: {type: String, default: ""},
    picture: {type: String, default: ""},
    user_unique_id: {type: String, default: ""},
    is_read: {type: Boolean, default: false},
    city_id: {type: Schema.Types.ObjectId},
    country_id: {type: Schema.Types.ObjectId},
    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    strict: true,
    timestamps: {
        createdAt: 'created_at',
    }

});
admin_notification.plugin(autoIncrement.plugin, {model: 'admin_notification', field: 'unique_id', startAt: 1, incrementBy: 1});
module.exports = mongoose.model('admin_notification', admin_notification);