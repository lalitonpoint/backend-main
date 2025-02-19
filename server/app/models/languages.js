let mongoose = require('mongoose');
let mongoosePaginate = require('mongoose-paginate');
let Schema = mongoose.Schema;
let mongoosePages = require('mongoose-pages');
let autoIncrement = require('mongoose-id-autoincrement');
let language = new Schema({
    unique_id: Number,
    name: { type: String, default: "" },
    code: { type: String, default: "" },
    string_file_path: { type: String, default: '' },
    is_lang_rtl: { type: Boolean, default: false },
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

language.plugin(mongoosePaginate);
language.plugin(autoIncrement.plugin, { model: 'language', field: 'unique_id', startAt: 1, incrementBy: 1 });
mongoosePages.skip(language);
module.exports = mongoose.model('language', language);

