let mongoose = require('mongoose'),
    Schema = mongoose.Schema;

let SmsdetailSchema = new Schema({
    smsUniqueId: Number,
    smsUniqueTitle: {type: String, default: ""},
    smsContent: {type: String, default: ""},

    isSendSMS:{type: Boolean, default: true},
    isSendWhatsapp:{type: Boolean, default: true},

});
let Smsdetail = mongoose.model('sms_detail', SmsdetailSchema);
module.exports = Smsdetail;

