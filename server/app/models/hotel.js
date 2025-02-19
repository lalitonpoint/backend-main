let mongoose = require('mongoose'),
    mongoosePaginate = require('mongoose-paginate'),
    
    Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');


let hotel = new Schema({
    unique_id: Number,
    hotel_name: {type: String, default: ""},
    password:{type: String, default: ""},
    token:{type: String, default: ""},
    email: {type: String, default: ""},
    country_phone_code: {type: String, default: ""},
    phone: {type: String, default: ""},
    country: {type: String, default: ""},
    countryid:{ type: Schema.Types.ObjectId},
    city:{type: String, default: ""},
    address:{type: String, default: ""},
    latitude:{type: Number, default: 22},
    customer_id: {type: String, default: ""},
    
    longitude:{type: Number, default: 70},
    cityid:{ type: Schema.Types.ObjectId},
    admin_profit_type: {type: Number, default: 0},
    admin_profit_value: {type: Number, default: 0},
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }

});
hotel.index({phone: 1}, {background: true});
hotel.index({email: 1}, {background: true});

hotel.plugin( mongoosePaginate );
hotel.plugin(autoIncrement.plugin, {model: 'hotel', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(hotel);


module.exports =  mongoose.model('Hotel', hotel);
