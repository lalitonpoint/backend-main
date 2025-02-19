let crypto = require('crypto');
let Partner = require('mongoose').model('Partner');
let Wallet_history = require('mongoose').model('Wallet_history');
let Provider = require('mongoose').model('Provider');
let Trip_history = require('mongoose').model('Trip_history');
let Trip = require('mongoose').model('Trip');
let Card = require('mongoose').model('Card');
let Provider_Vehicle_Document = require('mongoose').model('Provider_Vehicle_Document');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic');
let Provider_Document = require('mongoose').model('Provider_Document');
let utils = require('../../controllers/utils');
let allemails = require('../../controllers/emails');
let Document = require('mongoose').model('Document');
let City = require('mongoose').model('City');
let Country = require('mongoose').model('Country');
let mongoose = require('mongoose');
let list = require('../../admin/controller/list')
let Schema = mongoose.Types.ObjectId;
let Settings = require('mongoose').model('Settings')
let OpenRide = require('mongoose').model('Open_Ride');
let CityZone = require('mongoose').model('CityZone');
let Vehicle = require('mongoose').model('Vehicle');
const {
    PARTNER_MESSAGE_CODE,
} = require('../../utils/success_code')
const {
    PARTNER_ERROR_CODE,
} = require('../../utils/error_code')

const {
    ADMIN_NOTIFICATION_TYPE,
} = require('../../controllers/constant');

// create partner_provider
exports.create_partner_provider = async function (req, res) {
    try {
        const setting_detail = await Settings.findOne({});

        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        let old_Provider_phone = await Provider.findOne({ phone: req.body.phone, country_phone_code: req.body.country_phone_code })
        let old_Provider_email = await Provider.findOne({ email: req.body.email })
        let error_code;
        if (old_Provider_phone) {
            error_code = PARTNER_ERROR_CODE.PHONE_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }
        if (old_Provider_email) {
            error_code = PARTNER_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }
        let city = await City.findOne({ cityname: req.body.city })
        if (!city) {
            res.json({ success: false });
            return;
        }
        let city_id = city._id;
        let password = req.body.password;
        let token = utils.tokenGenerator(32);
        let first_name = req.body.first_name;
        let last_name = req.body.last_name;
        let zipcode = "";
        let address = "";
        if (first_name != undefined) {
            first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);
        }
        if (last_name != undefined) {
            last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);

        }

        if (zipcode != undefined) {
            zipcode = req.body.zipcode;
        }
        if (address != undefined) {
            address = (req.body.address).trim();
        }

        let partner = await Partner.findById(req.body.partner_id)
        let partner_country = await Country.findById(partner.country_id)
        
        let provider = new Provider({
            first_name: first_name,
            last_name: last_name,
            country_phone_code: req.body.country_phone_code,
            email: ((req.body.email).trim()).toLowerCase(),
            phone: req.body.phone,
            password: utils.encryptPassword(password),
            service_type: null,
            // referral_code: referral_code,
            car_model: req.body.car_model,
            car_number: req.body.car_number,
            device_token: "",
            device_type: "",
            bio: "",
            address: address,
            zipcode: zipcode,
            social_unique_id: "",
            login_by: "",
            device_timezone: "",
            providerLocation: [
                0,
                0
            ],
            city: req.body.city,
            cityid: city_id,
            country: partner_country?.countryname,
            country_id : partner.country_id,
            token: token,
            is_available: 1,
            is_document_uploaded: 0,
            is_active: 0,
            is_approved: 0,
            is_partner_approved_by_admin: 1,
            rate: 0,
            rate_count: 0,
            is_trip: [],
            admintypeid: null,
            wallet: 0,
            bearing: 0,
            picture: "",
            provider_type: Number(constant_json.PROVIDER_TYPE_PARTNER),
            provider_type_id: partner._id
        });


        if (req.files != undefined) {
            if (req.files.length != 0) {
                let image_name = provider._id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                provider.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 2);
            }
        }
        let country = await Country.findOne({ countryname: provider.country })
        if (!country) {
            res.json({ success: false });
            return;
        }

        let country_id = country._id;
        let document = await Document.find({ countryid: country_id, type: 1 })

        let is_document_uploaded = 0;
        let document_size = document.length;
        if (document_size === 0) {
            is_document_uploaded = 1;
            provider.is_document_uploaded = is_document_uploaded;
        }


        let count = 0;
        for (let i = 0; i < document_size; i++) {
            if (document[i].option == 0) {
                count++;
            } else {
                break;
            }
        }
        if (count == document_size) {
            is_document_uploaded = 1;
        }


        document.forEach(async function (entry) {
            let providerdocument = new Provider_Document({
                provider_id: provider._id,
                document_id: entry._id,
                name: entry.title,
                option: entry.option,
                document_picture: "",
                unique_code: entry.unique_code,
                expired_date: "",
                is_unique_code: entry.is_unique_code,
                is_expired_date: entry.is_expired_date,
                is_document_expired: false,
                is_uploaded: 0,
                is_visible: entry.is_visible
            });

            provider.is_document_uploaded = is_document_uploaded;
            await providerdocument.save()
        });

        provider.wallet_currency_code = country.currencycode;
        await provider.save()
        console.log(provider)
        let email_notification = setting_detail.email_notification;
        if (email_notification) {
            allemails.sendProviderRegisterEmail(req, provider);
        }
        let message = PARTNER_MESSAGE_CODE.ADD_SUCCESSFULLY;
        res.json({ success: true, message: message })

        // Trigger admin notification
        utils.addNotification({
            type: ADMIN_NOTIFICATION_TYPE.DRIVER_REGISTERED,
            user_id: provider._id,
            username: provider.first_name + " " + provider.last_name,
            picture: provider.picture,
            user_unique_id: provider.unique_id,
        })
    } catch (error) {
        utils.error_response(error, req, res)
    }
};


exports.get_provider_details = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let condition = { $match: { _id: Schema(req.body.provider_id)} }
        let lookup = {
            $lookup:{
                from:"types",
                localField:'admintypeid',
                foreignField:'_id',
                as:'service_details'
            }
        }
        let unwind = {
            $unwind:{
                path:'$service_details',
                preserveNullAndEmptyArrays:true
            }
        }
        let project = {
            $project:{
                first_name:1,
                last_name:1,
                email:1,
                phone:1,
                address:1,
                city:1,
                cityid:1,
                service_type:1,
                zipcode:1,
                password:1,
                created_at:1,
                picture:1,
                type_name:"$service_details.typename",
                country_phone_code:1,
                country:1
            }
        } 
        let provider = await Provider.aggregate([condition,lookup,unwind,project])
        let message;
        if (provider) {
            message = PARTNER_MESSAGE_CODE.GET_DETAILS_SUCCESSFULLY;
            res.json({ success: true, message: message, provider })
            return
        } else {
            message = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, message: message })
            return
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.update_provider_details = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }, { name: 'phone', type: 'string' }, { name: 'email', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let id = req.body.provider_id
        let new_password = req.body.new_password
        let new_password_hash;
        if (new_password) {
            new_password_hash = crypto.createHash('md5').update(new_password).digest('hex')
        }
        let old_Provider_phone = await Provider.findOne({ _id: { $ne: id }, phone: req.body.phone, country_phone_code: req.body.country_phone_code })
        let old_Provider_email = await Provider.findOne({ _id: { $ne: id }, email: req.body.email })
        let error_code;
        let message;
        if (old_Provider_phone) {
            error_code = PARTNER_ERROR_CODE.PHONE_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }
        if (old_Provider_email) {
            error_code = PARTNER_ERROR_CODE.EMAIL_ALREADY_REGISTERED
            return res.json({ success: false, error_code: error_code })
        }
        let provider = await Provider.findOne({ _id: req.body.provider_id })

        if (!provider) {
            message = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, message: message })
            return
        }

        if (req.body.new_password != '') {
            req.body.password = new_password_hash
        } else {
            req.body.password = hash
        }

        let first_name = req.body.first_name;
        req.body.first_name = first_name.charAt(0).toUpperCase() + first_name.slice(1);

        let last_name = req.body.last_name;
        req.body.last_name = last_name.charAt(0).toUpperCase() + last_name.slice(1);

        if (req.files.length != 0) {
            let picture = req.files[0].originalname;
            if (picture != "") {

                utils.deleteImageFromFolder(provider.picture, 2);
                let image_name = id + utils.tokenGenerator(4);
                let url = utils.getImageFolderPath(req, 2) + image_name + '.jpg';
                req.body.picture = url;
                utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 2);
            }
        }


        let update_provider = await Provider.findByIdAndUpdate({ _id: req.body.provider_id }, req.body, { new: true })
        if (!update_provider._id) {
            message = PARTNER_ERROR_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, message: message })
            return
        }
        message = PARTNER_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
        res.json({ success: true, message: message, update_provider })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}


exports.delete_provider_details = async function (req, res) {
    try {
        let params_array = [{ name: 'provider_id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return
        }
        let delete_id = req.body.provider_id;
        let provider = await Provider.findOne({ _id: delete_id })
        if (!provider) {
            let message = PARTNER_MESSAGE_CODE.DETAIL_NOT_FOUND;
            res.json({ success: false, message: message })
            return
        }

        if (provider.is_trip.length != 0) {
            let message = error_message.ERROR_CODE_TRIP_RUNNING
            return res.json({ success: false, error_code: message })
        }
        let ride_details = await OpenRide.countDocuments({
            $and: [
                {confirmed_provider: provider._id},
                {is_trip_end: 0},
                {is_trip_completed: 0},
                {is_trip_cancelled: 0}
            ]
           
        })
        
        if (ride_details > 0) {
            let message = error_message.ERROR_CODE_PLEASE_DELETE_YOUR_FUTURE_RIDE_FIRST
            return res.json({ success: false, error_code: message })
        }

        let provider_detail = await Provider.findOne({ phone: '0000000000' });
        if (!provider_detail) {
            provider_detail = new Provider({
                _id: Schema('000000000000000000000000'),
                first_name: 'anonymous',
                last_name: 'provider',
                email: 'anonymousprovider@gmail.com',
                phone: '0000000000',
                country_phone_code: '',
            })
            await provider_detail.save();
        }
        await Trip_history.updateMany({ confirmed_provider: provider._id }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id });
        await Trip.updateMany({ $or: [{ current_provider: provider._id }, { confirmed_provider: provider._id }] }, { confirmed_provider: provider_detail._id, current_provider: provider_detail._id });
        await OpenRide.updateMany({ confirmed_provider: provider._id }, { confirmed_provider: provider_detail._id, provider_id: provider_detail._id });
        await Wallet_history.updateMany({ user_id: provider._id }, { user_id: provider_detail._id });
        await Card.deleteMany({ user_id: provider._id });
        await Provider_Document.deleteMany({ provider_id: provider._id });
        await Provider_Vehicle_Document.deleteMany({ provider_id: provider._id });
        await Provider_daily_analytic.deleteMany({ provider_id: provider._id })
        await Provider.deleteOne({ _id: provider._id })
        await Vehicle.updateMany({provider_id:provider._id},{$set:{provider_id:null}})
        await CityZone.updateMany({},{$pull:{total_provider_in_zone_queue:provider._id}})
        utils.delete_firebase_user(provider.uid);
        let message = PARTNER_MESSAGE_CODE.DELETE_SUCCESSFULLY
        res.json({ success: true, message: message });
    } catch (error) {
        utils.error_response(error, req, res)
    }
}



exports.partner_provider_documents_list = async function (req, res) {
    try {
        let params_array = [{ name: 'id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let provider_document = await Provider_Document.findById(req.body.id)
        let message = PARTNER_MESSAGE_CODE.GET_DETAILS_SUCCESSFULLY;
        res.json({ success: true, message: message, provider_document })
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.partner_provider_documents_update = async function (req, res) {
    try {
        let params_array = [{ name: 'id', type: 'string' }]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        let provider_document = await Provider_Document.findById(req.body.id)
        provider_document.expired_date = req.body.expired_date;
        provider_document.unique_code = req.body.unique_code;
        await provider_document.save()
        let message = PARTNER_MESSAGE_CODE.UPDATE_SUCCESSFULLY;
        if (req.files.length > 0) {
            let image_name = provider_document.provider_id + utils.tokenGenerator(4);
            let url = utils.getImageFolderPath(req, 3) + image_name + '.jpg';
            utils.saveImageFromBrowser(req.files[0].path, image_name + '.jpg', 3);

            provider_document.document_picture = url;
            provider_document.is_uploaded = 1;
            await provider_document.save()
            res.json({ success: true, message: message, update_provider })
        } else {
            res.json({ success: true, message: message, update_provider })
        }
    } catch (error) {
        utils.error_response(error, req, res)
    }
}

exports.partner_documents_list = async function (req, res) {
    try {
        let params_array = []
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response)
            return;
        }
        // code 
        list.fetch_document_list(req, res)
        return
    } catch (error) {
        utils.error_response(error, req, res)
    }
}
