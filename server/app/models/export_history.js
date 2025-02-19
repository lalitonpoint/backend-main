let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let export_history = new Schema({
    unique_id: Number,
    type: Number,
    data: {type: Object},
    status: Number,
    export_user_id: {
        type: String,
    },
    url: String,
    user_id: {type: Schema.Types.ObjectId},
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

});
module.exports = mongoose.model('export_history', export_history);

