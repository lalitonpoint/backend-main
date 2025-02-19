let mongoose = require('mongoose'),
    Schema = mongoose.Schema;


let otpSchema = new Schema({
    phone: { type: String},
    country_phone_code: { type: String},
    email : {type : String}, 
    otp_sms: { type: String},
    otp_mail : {type : String},
    type : {type : Number},
    created_at: {
        type: Date,
        default: Date.now
    },
});

let Otps = mongoose.model('Otps', otpSchema);
module.exports = Otps;
