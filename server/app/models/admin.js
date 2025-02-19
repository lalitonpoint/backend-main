let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let adminschema = new Schema({
	username: { type: String, trim: true, lowercase: true, default: "" },
	password: {type: String, default: ""},
	email: { type: String, trim: true, lowercase: true, default: "" },
	token:{type: String, default: ""},
	type: {type: Number, default: 0},
	url_array: {type: Array, default: []},
	created_at: { type: Date, default: Date.now },
	updated_at: { type: Date, default: Date.now },
	uid: {type: String},
	is_show_email:{type:Boolean,default:true},
	is_show_phone:{type:Boolean,default:true},

	is_country_based_access_control_enabled: {type:Boolean,default:false},
    allowed_countries: [{type: Schema.Types.ObjectId}],
	
	is_city_based_access_control_enabled: {type:Boolean,default:false},
    allowed_cities: [{type: Schema.Types.ObjectId}],

});
adminschema.index({email: 1}, {background: true});

module.exports = mongoose.model('admin',adminschema);



