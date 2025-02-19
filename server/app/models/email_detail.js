let mongoose = require('mongoose'),
    Schema = mongoose.Schema;

let emailSchema = new Schema({
    emailUniqueId: Number,
    emailUniqueTitle: {type: String, default: ""},
    emailTitle: {type: String, default: ""},
    emailContent:{type: String, default: ""},
    emailAdminInfo:{type: String, default: ""}

});

let Email = mongoose.model('email_detail', emailSchema);
module.exports = Email;

