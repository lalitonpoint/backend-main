let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

/**
 * Change Log
 *
 * This model represents a change log entry.
 * It is used to store information about various changes made within the system, such as settings modifications or user updates.
 *
 * Fields:
 *   unique_id:         Primary key, a unique identifier for each change log entry.
 *   setting_type:      Type of the setting that was changed. Use numeric values to represent different types of settings.
 *   log_type:          Type of the log that was changed. Add == 1, Update == 2, Delete
 *   user_id:           ID of the user associated with the change log entry.
 *   username:          Name of the user who triggered the change.
 *   email:             Email address associated with the user who triggered the change.
 *   changes:           An array that stores the details of the changes made.
 *   info:              Additional information related to the change.
 *   info_detail:       Detailed information about the change.
 *   meta_data:         Additional metadata associated with the change log entry, stored as an object.
 *   ip:                The IP address from which the change was initiated.
 *   created_at:        Timestamp when the change log entry was created. If not explicitly provided, it defaults to the current date and time when the entry is inserted into the database.
 **/

let change_log = new Schema({
    unique_id: Number,
    setting_type: {type: Number, default: 0},
    log_type: {type: Number, default: 0},
    user_id: {type: Schema.Types.ObjectId},
    username: {type: String, default: ""},
    email: {type: String, default: ""},
    changes: {type: Array, default: []},
    info: {type: String, default: ""},
    info_detail: {type: String, default: ""},
    meta_data:{type: Object, default: {}},
    ip: {type: String, default: ""},
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
change_log.plugin(autoIncrement.plugin, {model: 'change_log', field: 'unique_id', startAt: 1, incrementBy: 1});
module.exports = mongoose.model('change_log', change_log);