let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let find_provider_logs = new Schema({
    unique_id: Number,
    quey: {type: Object},
    body: {type: Object},
    online_providers:  {type: Array , default : []},
    city_id: {type: Schema.Types.ObjectId},
    trip_id: {type: Schema.Types.ObjectId},
    no_of_time_send_request : {type: Number, default: 0},
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
find_provider_logs.index({'body.user_id': 1}, {background: true});
find_provider_logs.index({trip_id: 1}, {background: true});

module.exports = mongoose.model('find_provider_logs', find_provider_logs);