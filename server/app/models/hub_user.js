let mongoose = require('mongoose'),
mongoosePaginate = require('mongoose-paginate'),
Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');

let hubUser = new Schema({
    unique_id: Number,

    first_name: {type: String, default: ""},
    last_name: {type: String, default: ""},

    email: {type: String, default: ""},
    country_phone_code: {type: String, default: ""},
    phone: {type: String, default: ""},

    password: {type: String, default: ""},
    token: {type: String, default: ""},

    hub_id: {type: Schema.Types.ObjectId, default: null},

    is_approved: {type: Boolean, default: true},

    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }

},{
    usePushEach: true,
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

hubUser.plugin(mongoosePaginate);
mongoosePages.skip(hubUser);

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('Hub_User', hubUser);

