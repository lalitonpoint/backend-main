let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let autoIncrement = require('mongoose-id-autoincrement');
let Document = new Schema({
    unique_id: Number,
    countryid: {type: Schema.Types.ObjectId},
    title: {type: String, default: ""},
    type: {type: Number, default: 8},
    option: {type: Number, default: 0}, // if is_mandatory then value 1 else 0
    expired_date: {
        type: Date
    },
    is_unique_code: {type: Boolean, default: false},
    is_expired_date: {type: Boolean, default: false},
    is_visible: {type: Boolean, default: false},
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

Document.index({countryid: 1, type: 1}, {background: true});
Document.plugin(autoIncrement.plugin, {model: 'Document', field: 'unique_id', startAt: 1, incrementBy: 1});
Document = mongoose.model('Document', Document);

module.exports = Document;

