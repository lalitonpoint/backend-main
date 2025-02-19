let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');

let admin_profit = new Schema({
    user_type_id: {type: Schema.Types.ObjectId}, // User's ID
    user_type: {type: Number, default: 0}, // 1 - Corporate, 3 - Hotel
    profit_type: {type: Number, default: 0}, // 1 - Absolute, 2 - Percentage
    profit_value: {type: Number, default: 0}, // Profit value set by Admin
    profit: {type: Number, default: 0}, // Trip Profit
    trip_id: {type: Schema.Types.ObjectId}, // Trip ID
    trip_unique_id: {type: Number}, // Trip Unique ID,
    country_id: {type: Schema.Types.ObjectId}, // User Country ID
    invoice_sent: {type: Boolean, default: false}
},{
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

admin_profit.plugin(autoIncrement.plugin, {model: 'admin_profit', field: 'unique_id', startAt: 1, incrementBy: 1});
module.exports = mongoose.model('admin_profit', admin_profit);
