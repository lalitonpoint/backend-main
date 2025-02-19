const mongoose = require('mongoose');
const { Schema } = mongoose;
const bannerSchema = new Schema({
    banner_title: { type: String, default: "" },
    redirect_url: { type: String, default: "" },
    action_link: { type: String, default: "" },
    is_visible: { type: Boolean, default: true },
    action_text: { type: String, default: "" },
}, {
    strict: true,
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});
module.exports = mongoose.model('banner', bannerSchema);
