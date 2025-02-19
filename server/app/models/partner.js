let mongoose = require('mongoose'),
        mongoosePaginate = require('mongoose-paginate'),
        Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');


let partnerSchema = new Schema({
    unique_id: Number,
    first_name: {type: String, default: ""},
    last_name: {type: String, default: ""},
    password: {type: String, default: ""},
    email: {type: String, default: ""},
    country_phone_code: {type: String, default: ""},
    phone: {type: String, default: ""},
    country: {type: String, default: ""},

    country_id: {type: Schema.Types.ObjectId},
    wallet_currency_code: {type: String, default: ""},
    is_vehicle_document_uploaded: {type: Boolean, default: false},
    city_id: {type: Schema.Types.ObjectId},
    // vehicle_detail: {type: Array, default: []},
    customer_id: {type: String, default: ""},
    

    // FOR BANK DETAIL //
    stripe_doc: {type: String, default: ""},
    account_id: {type: String, default: ""},
    bank_id: {type: String, default: ""},
    account_number: {type: String, default: ""},
    bank_code: {type: String, default: ""},
    ////    

    city: {type: String, default: ""},
    address: {type: String, default: ""},
    picture: {type: String, default: ""},
    token: {type: String, default: ""},
    partner_company_name: {type: String, default: ""},
    government_id_proof: {type: String, default: ""},
    is_approved: {type: Number, default: 0},
    wallet: {type: Number, default: 0},
    transaction_reference: {type: String, default: ""},
    
    refferal_code: {type: String, default: ""},
    total_redeem_point: {type: Number, default: 0},
    last_transferred_date: {
        type: Date,
        default: Date.now
    },
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
partnerSchema.index({phone: 1}, {background: true});
partnerSchema.index({email: 1}, {background: true});
partnerSchema.index({country: 1}, {background: true});

partnerSchema.plugin(mongoosePaginate);
partnerSchema.plugin(autoIncrement.plugin, {model: 'partner', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(partnerSchema);

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('Partner', partnerSchema);

