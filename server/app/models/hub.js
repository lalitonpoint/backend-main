let mongoose = require('mongoose'),
mongoosePaginate = require('mongoose-paginate'),
Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');

let hubSchema = new Schema({
    unique_id: Number,
    name: {type: String, default: ""},

    country_id: {type: Schema.Types.ObjectId},
    city_id: {type: Schema.Types.ObjectId},

    address: {type: String, default: ""},
    location: {
        type: [Number],
        index: '2d'
    },
    kmlzone:{
        type: Array,
        index1: '3d'
    },

    is_active: {type: Boolean, default: true},

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

hubSchema.plugin(mongoosePaginate);
hubSchema.plugin(autoIncrement.plugin, {model: 'Hub', field: 'unique_id', startAt: 1, incrementBy: 1});
mongoosePages.skip(hubSchema);

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('Hub', hubSchema);

