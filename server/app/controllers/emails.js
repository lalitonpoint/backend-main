let fs = require("fs");
let City = require('mongoose').model('City');
let moment = require('moment');
let Email = require('mongoose').model('email_detail');
let myEmail = require('./emails');
let Settings = require('mongoose').model('Settings');
let utils = require('./utils');
const Corporate = require('mongoose').model('Corporate')
const Hotel = require('mongoose').model('Hotel');

exports.sendEmail = function (req, provider, user, emailID, extraParam) {

    let name = "";
    let email = "";
    if (provider != null) {
        name = provider.first_name + " " + provider.last_name;
        email = provider.email;
    } else {
        name = user.first_name + " " + user.last_name;
        email = user.email;
    }

    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
    let ejs = require("ejs");
    try {
        if (email != "") {
            Email.findOne({emailUniqueId: emailID}).then((email_data) => {

                let title = email_data.emailTitle;
                let emailContent = email_data.emailContent;
                let emailAdminInfo = email_data.emailAdminInfo;
                const validIDs = [1, 13, 4, 31, 21, 14];
                if (validIDs.includes(emailID)) {
                    emailContent = emailContent.replace("XXXXXX", extraParam);
                }

                let template = process.cwd() + '/app/views/email/email.html';
                fs.readFile(template, 'utf8', async function (err, file) {
                    if (err) {
                        console.log("ERROR! in sendEmail function")
                        // Commented below line as getting error due to "res is not defined"
                        // return res.send('ERROR!');
                    } else {

                        let settings= await Settings.findOne()
                        let compiledTmpl = ejs.compile(file, {filename: template});
                        let mail_title_image_url = settings.image_base_url + "/web_images/mail_title_image.png";
                        let context = {
                            title: title,
                            name: name,
                            emailContent: emailContent,
                            emailAdminInfo: emailAdminInfo,
                            mail_title_image_url: mail_title_image_url,
                            date: date
                        };
                        let htmls = compiledTmpl(context);
                        htmls = htmls.replace(/&lt;/g, "<");
                        htmls = htmls.replace(/&gt;/g, ">");
                        htmls = htmls.replace(/&#34;/g, '"');
                        utils.mail_notification(email, email_data.emailTitle, "", htmls);
                    }
                });
            });

        }
    } catch (error) {
        console.log('ERROR!');
    }


};
exports.sendEmailCron = function (req, provider, user, emailID, extraParam) {

    let name = "";
    let email = "";
    if (provider != null) {
        name = provider.first_name + " " + provider.last_name;
        email = provider.email;
    } else {
        name = user.first_name + " " + user.last_name;
        email = user.email;
    }

    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
    let ejs = require("ejs");
    try {
        if (email != "") {
            Email.findOne({emailUniqueId: emailID}).then((email_data) => {

                let title = email_data.emailTitle;
                let emailContent = email_data.emailContent;
                let emailAdminInfo = email_data.emailAdminInfo;

                const validIDs = [1, 13, 4, 31, 21, 14];
                if (validIDs.includes(emailID)) {
                    emailContent = emailContent.replace("XXXXXX", extraParam);
                }

                let template = process.cwd() + '/app/views/email/email.html';
                fs.readFile(template, 'utf8', async function (err, file) {
                    if (err) {
                        console.log("ERROR! in sendEmailCron function")
                        // Commented below line as getting error due to "res is not defined"
                        // return res.send('ERROR!');
                    } else {
                        let settings= await Settings.findOne()
                        let compiledTmpl = ejs.compile(file, {filename: template});
                        let mail_title_image_url = settings.image_base_url + "/web_images/mail_title_image.png";
                        let context = {
                            title: title,
                            name: name,
                            emailContent: emailContent,
                            emailAdminInfo: emailAdminInfo,
                            mail_title_image_url: mail_title_image_url,
                            date: date
                        };
                        let htmls = compiledTmpl(context);
                        htmls = htmls.replace(/&lt;/g, "<");
                        htmls = htmls.replace(/&gt;/g, ">");
                        htmls = htmls.replace(/&#34;/g, '"');
                        utils.mail_notification(email, email_data.emailTitle, "", htmls);
                    }
                });
            });

        }
    } catch (error) {
        console.log('ERROR!');
    }


};


exports.sendEmailPartnerDispatcher = function (req, partner, dispatcher, emailID, extraParam) {

    let name = "";
    let email = "";
    if (partner != null) {
        name = partner.first_name + " " + partner.last_name;
        email = partner.email;
    } else {
        name = dispatcher.first_name + " " + dispatcher.last_name;
        email = dispatcher.email;
    }

    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
    let ejs = require("ejs");

    try {
        if (email != "") {


            Email.findOne({emailUniqueId: emailID}).then((email_data) => {

                let title = email_data.emailTitle;
                let emailContent = email_data.emailContent;
                let emailAdminInfo = email_data.emailAdminInfo;
                if (emailID == 21 || emailID == 31 || emailID == 51) {
                    emailContent = emailContent.replace("XXXXXX", extraParam);
                }


                let template = process.cwd() + '/app/views/email/email.html';
                fs.readFile(template, 'utf8', async function (err, file) {
                    if (err) {
                        console.log("ERROR! in sendAdminProfitInvoiceEmail function")
                        // Commented below line as getting error due to "res is not defined"
                        // return res.send('ERROR!');
                    } else {
                        let settings= await Settings.findOne()
                        let compiledTmpl = ejs.compile(file, {filename: template});
                        let mail_title_image_url = settings.image_base_url + "/web_images/mail_title_image.png";
                        let context = {
                            title: title,
                            name: name,
                            mail_title_image_url: mail_title_image_url,
                            emailContent: emailContent,
                            emailAdminInfo: emailAdminInfo,
                            date: date
                        };
                        let htmls = compiledTmpl(context);
                        utils.mail_notification(email, email_data.emailTitle, "", htmls);
                    }
                });
            });
        }
    } catch (error) {
        console.log('ERROR!');
    }


};


exports.sendEmailHotel = function (req, hotel, emailID, extraParam) {

    let name = "";
    let email = "";
    if (hotel != null) {
        name = hotel.hotel_name;
        email = hotel.email;
    }


    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
    let ejs = require("ejs");

    try {
        if (email != "") {
            Email.findOne({emailUniqueId: emailID}).then((email_data) => {
                let title = email_data.emailTitle;
                let emailContent = email_data.emailContent;
                let emailAdminInfo = email_data.emailAdminInfo;
                if (emailID == 41) {
                    emailContent = emailContent.replace("XXXXXX", extraParam);
                }


                let template = process.cwd() + '/app/views/email/email.html';
                fs.readFile(template, 'utf8', async function (err, file) {
                    if (err) {
                        console.log("ERROR! in sendAdminProfitInvoiceEmail function")
                        // Commented below line as getting error due to "res is not defined"
                        // return res.send('ERROR!');
                    } else {
                        let settings= await Settings.findOne()
                        let compiledTmpl = ejs.compile(file, {filename: template});
                        let mail_title_image_url = settings.image_base_url + "/web_images/mail_title_image.png";
                        let context = {
                            title: title,
                            name: name,
                            mail_title_image_url: mail_title_image_url,
                            emailContent: emailContent,
                            emailAdminInfo: emailAdminInfo,
                            date: date
                        };
                        let htmls = compiledTmpl(context);
                        utils.mail_notification(email, email_data.emailTitle, "", htmls);
                    }
                });
            });

        }

    } catch (error) {
        console.log('ERROR!');
    }


};


///////////////////  ADD HOTEL  ////////////////////////

exports.sendAddHotelEmail = function (req, hotel, name) {
    try {
        myEmail.sendEmailHotel(req, hotel, 41, name);
    } catch (error) {
        console.log('ERROR!');
    }

};


//////////////////// PARTNER REGISTER/////////////////////////


exports.sendCorporateRegisterEmail = function (req, partner, name) {
    try {
        myEmail.sendEmailPartnerDispatcher(req, partner, null, 51, name);
    } catch (error) {
        console.log('ERROR!');
    }

};

exports.sendPartnerRegisterEmail = function (req, partner, name) {
    try {
        myEmail.sendEmailPartnerDispatcher(req, partner, null, 21,name);
    } catch (error) {
        console.log('ERROR!');
    }

};


//////////////////// PARTNER DECLINE/////////////////////////
exports.sendPartnerDeclineEmail = function (req, partner) {
    try {
        myEmail.sendEmailPartnerDispatcher(req, partner, null, 22, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

//////////////////// PARTNER APPROVED/////////////////////////
exports.sendPartnerApprovedEmail = function (req, partner) {
    try {
        myEmail.sendEmailPartnerDispatcher(req, partner, null, 23, "");
    } catch (error) {
        console.log('ERROR!');
    }

};


//////////////////// DISPATCHER REGISTER/////////////////////////

exports.sendDispatcherRegisterEmail = function (req, dispatcher, name) {
    try {
        myEmail.sendEmailPartnerDispatcher(req, null, dispatcher, 31, name);
    } catch (error) {
        console.log('ERROR!');
    }

};

///////////////////// PROVIDER REGISTER /////

exports.sendProviderRegisterEmail = function (req, provider, name) {
    try {
        myEmail.sendEmail(req, provider, null, 14, name);
    } catch (error) {
        console.log('ERROR!');
    }

};


//////////////////// USER REGISTER/////////////////////////

exports.sendUserRegisterEmail = function (req, user, name) {
    try {
        myEmail.sendEmail(req, null, user, 4, name);
    } catch (error) {
        console.log('ERROR!');
    }

};

//////////////////// USER PAYMENT PENDING/////////////////////////
exports.sendUserPendingPaymentEmail = function (req, user, amount) {
    try {
        myEmail.sendEmail(req, null, user, 5, amount);
    } catch (error) {
        console.log('ERROR!');
    }

};

//////// USER FORGOTPASSWORD //////////
exports.userForgotPassword = function (req, user, new_password) {
    try {
        myEmail.sendEmail(req, null, user, 1, new_password);
    } catch (error) {
        console.log('ERROR!');
    }

};


//////////////////// USER DECLINE/////////////////////////
exports.sendUserDeclineEmail = function (req, user) {
    try {
        myEmail.sendEmail(req, null, user, 3, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

exports.sendUserDocumentExpiredEmail = function (req, user) {
    try {
        myEmail.sendEmailCron(req, null, user, 16, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

//////////////////// USER APPROVED/////////////////////////
exports.sendUserApprovedEmail = function (req, user) {
    try {
        myEmail.sendEmail(req, null, user, 6, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

//////////////////// PROVIDER DECLINE/////////////////////////
exports.sendProviderDocumentExpiredEmail = function (req, provider) {
    try {
        myEmail.sendEmailCron(req, provider, null, 15, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

exports.sendProviderDeclineEmail = function (req, provider) {
    try {
        myEmail.sendEmail(req, provider, null, 11, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

//////////////////// PROVIDER APPROVED/////////////////////////
exports.sendProviderApprovedEmail = function (req, provider) {
    try {
        myEmail.sendEmail(req, provider, null, 12, "");
    } catch (error) {
        console.log('ERROR!');
    }

};

//////// PROVIDER FORGOTPASSWORD //////////
exports.providerForgotPassword = function (req, provider, new_password) {
    try {
        myEmail.sendEmail(req, provider, null, 13, new_password);
    } catch (error) {
        console.log('ERROR!');
    }

};


/// OTP VERIFICATION EMAIL ///
exports.emailForOTPVerification = function (req, email, otpForEmail, emailID) {
    email = req.body.email;
    try {
        if (email != "") {
            Email.findOne({emailUniqueId: emailID}).then((email_data) => {
                let title = email_data.emailTitle;
                let emailContent = email_data.emailContent;
                let emailAdminInfo = email_data.emailAdminInfo;
                emailContent = emailContent.replace("XXXXXX", otpForEmail);
                let ejs = require("ejs");
                let template = process.cwd() + '/app/views/email/otpverification.html';
                fs.readFile(template, 'utf8', async function (err, file) {
                    if (err) {
                        console.log("ERROR! in emailForOTPVerification function")
                        // Commented below line as getting error due to "res is not defined"
                        // console.log('ERROR!');
                        // return res.send('ERROR!');
                    } else {
                        let settings= await Settings.findOne()
                        let compiledTmpl = ejs.compile(file, {filename: template});
                        let mail_title_image_url = settings.image_base_url + "/web_images/mail_title_image.png";
                        let context = {
                            title: title,
                            emailContent: emailContent,
                            emailAdminInfo: emailAdminInfo,
                            mail_title_image_url: mail_title_image_url
                        };
                        let htmls = compiledTmpl(context);
                        utils.mail_notification(email, email_data.emailTitle, "", htmls);
                    }
                });
            });

        }

    } catch (error) {
        console.log('ERROR!');
    }

};

//////////////////// USER INVOICE/////////////////////////
exports.sendUserInvoiceEmail = async function (req, user, provider, trip, tripservice) {
    const setting_detail = await Settings.findOne({});

    
    const support_email = `mailto:${setting_detail.admin_email}`
    let provider_name = provider.first_name + " " + provider.last_name;
    let provider_email = provider.email;
    let provider_picture = setting_detail.image_base_url + '/' + provider.picture;
    let provider_phone = provider.country_phone_code + provider.phone;

    let user_name = user.first_name + " " + user.last_name;

    let user_email = user.email;
    let title = "User Invoice";
    let pattern = "User Invoice";
    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);

    let ejs = require("ejs");

    let template = process.cwd() + '/app/views/email/userinvoice.html';


    let start = trip.sourceLocation;
    let end = trip.destinationLocation;
    let stops = trip.actual_destination_addresses;
    let start_source_location = start[0] + "," + start[1];
    let map = "";
    let path = "color:0x0000ff|weight:5";


    let pickup_small_pin_url = setting_detail.image_base_url + "/map_pin/pickup.png";
    let desination_small_pin_url = setting_detail.image_base_url + "/map_pin/destination.png";
    let stop_small_pin_url = setting_detail.image_base_url + "/map_pin/stop_pin_url.png";


    let support = setting_detail.image_base_url + "/map_pin/support.png";
    let hour_icon = setting_detail.image_base_url + "/map_pin/hour_icon.png";
    let km_icon = setting_detail.image_base_url + "/map_pin/km_icon.png";
    let credit_card = setting_detail.image_base_url + "/map_pin/credit_card.png";


    let pickup_pin_url = setting_detail.image_base_url + "/map_pin/pickup2x.png";
    let desination_pin_url = setting_detail.image_base_url + "/map_pin/destination2x.png";
    let stop_pin_url = setting_detail.image_base_url + "/map_pin/stop_pin_url.png";
    let size_scale = "size=512x512&scale=4";


    let key =setting_detail.web_app_google_key;

    if (end[0] != 0 || end[1] != 0) {
        let end_source_location = end[0] + "," + end[1];
    
        map = "https://maps-api-ssl.google.com/maps/api/staticmap?key=" + key + "&&" + size_scale +
            "&markers=shadow:true|scale:2|icon:" + pickup_pin_url + "|" + start_source_location;
        stops.forEach(stop=>{
            if (stop.address != ''){
                map += "&markers=shadow:false|scale:2|icon:" + stop_pin_url + "|" + stop.location[0] + "," + stop.location[1]     
            }
        })
        map += "&markers=shadow:false|scale:2|icon:" + desination_pin_url + "|" + end_source_location + "&path=" + path;


    } else {
        map = "https://maps-api-ssl.google.com/maps/api/staticmap?key=" + key + "&&" + size_scale +
            "&markers=shadow:true|scale:2|icon:" + pickup_pin_url + "|" + start_source_location;
        stops.forEach(stop=>{
            if (stop.address != ''){
                map += "&markers=shadow:false|scale:2|icon:" + stop_pin_url + "|" + stop.location[0] + "," + stop.location[1]     
            }
        })
        map += "|&path=" + path;

    }

    try {
        if (user_email != "") {

            fs.readFile(template, 'utf8', function (err, file) {
                if (err) {
                    console.log('ERROR!');
                    return err;
                } else {
                    Settings.findOne({}, function (err, settingData) {

                        City.findById(provider.cityid).then((city_data) => {

                            let distance_unit = city_data.unit

                            if (distance_unit == 1) {
                                distance_unit = req.__('unit_km');
                            } else {
                                distance_unit = req.__('unit_mile');
                            }


                            let is_public_demo = settingData.is_public_demo;
                            let compiledTmpl = ejs.compile(file, {filename: template});
                            let mail_title_image_url = settingData.image_base_url + "/web_images/mail_title_image.png";
                            let context = {
                                title: setting_detail.app_name, date: date,
                                total: trip.total,
                                source_address: trip.source_address, destination_address: trip.destination_address,
                                total_distance: trip.total_distance,
                                distance_unit: distance_unit,
                                total_time: trip.total_time,
                                card_payment: trip.card_payment, currency: trip.currency,
                                referral_payment: trip.referral_payment,
                                promo_payment: trip.promo_payment,
                                distance_cost: trip.distance_cost,
                                time_cost: trip.time_cost,
                                waiting_time_cost: trip.waiting_time_cost,
                                tax_fee: trip.tax_fee,
                                user_tax_fee: trip.user_tax_fee,
                                user_miscellaneous_fee: trip.user_miscellaneous_fee,
                                actual_destination_addresses: trip.actual_destination_addresses ? trip.actual_destination_addresses : [],
                                is_fixed_fare: trip.is_fixed_fare,
                                fixed_price: trip.fixed_price,
                                surge_fee: trip.surge_fee,
                                base_price: tripservice.base_price,
                                price_per_unit_distance: tripservice.price_per_unit_distance,
                                price_for_total_time: tripservice.price_for_total_time,
                                price_for_waiting_time: tripservice.price_for_waiting_time,
                                price_for_waiting_time_multiple_stops: tripservice.price_for_waiting_time_multiple_stops ?
                                    tripservice.price_for_waiting_time_multiple_stops : 0,
                                service_type_name: tripservice.service_type_name,
                                provider_name: provider_name,
                                provider_email: provider_email,
                                provider_phone: provider_phone,
                                provider_picture: provider_picture,
                                user_name: user_name,
                                map_url: map,
                                toll: trip.toll_amount,
                                tip: trip.tip_amount,
                                pickup_small_pin_url: pickup_small_pin_url,
                                desination_small_pin_url: desination_small_pin_url,
                                stop_small_pin_url: stop_small_pin_url,
                                mail_title_image_url: mail_title_image_url,
                                is_public_demo: is_public_demo,
                                support: support,
                                hour_icon: hour_icon,
                                km_icon: km_icon,
                                credit_card: credit_card,
                                detail: trip,
                                support_email
                            };
                            let htmls = compiledTmpl(context);
                            utils.mail_notification(user_email, title, pattern, htmls);
                            send_invoice_whatsapp(user, trip, htmls);
                        });

                    });
                }
            });

        }

    } catch (error) {
        console.error('ERROR!');
    }


};

// exports.send_invoice_whatsapp = async function (user, trip, htmls){
function send_invoice_whatsapp(user, trip, htmls){
    let html_to_pdf = require('html-pdf');
    const path = require('path');
    let configs = {
        "childProcessOptions": {
            "detached": true,
            env: {
                OPENSSL_CONF: '/dev/null',
            },
        },
        orientation: 'portrait',
        type: 'pdf',
        timeout: '50000',
        format: "A4",
        height: "24.5in",
        width: "10in",

    }
    let filePath = path.join(__dirname, `./Trip Invoice_${trip?.unique_id}.pdf`);
    
    html_to_pdf.create(htmls, configs).toFile(filePath, async function (err, res) {
        if (!err) {
            const pdfData = fs.readFileSync(filePath, 'base64');

            setTimeout(function () {
                fs.unlink(filePath, function () { });
            }, 1000)

            let phoneWithCode = user.country_phone_code + user.phone;
            let configs = {
                description: `Here is the invoice of Trip ${trip?.unique_id}. Thanks for Ride with us 🚗👏🙏.`,
                type: "FILE",

                file: pdfData,
                fileType: "application/pdf",
                fileName: `Trip_${trip?.unique_id}.pdf`
            }

            utils.sendWhatsapp(phoneWithCode, "Here is invoice of trip " + trip?.unique_id, configs)
        }
    });
}


//////////////////// PROVIDER INVOICE/////////////////////////

exports.sendProviderInvoiceEmail = async function (req, provider, trip, tripservice, user) {
    const setting_detail = await Settings.findOne({});

    const support_email = `mailto:${setting_detail.admin_email}`
    let provider_email = provider.email;
    let title = "Provider Invoice";
    let pattern = "Provider Invoice";
    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);

    let ejs = require("ejs");

    let template = process.cwd() + '/app/views/email/providerinvoice.html';
    let start = trip.sourceLocation;
    let end = trip.destinationLocation;
    let stops = trip.actual_destination_addresses;
    let start_source_location = start[0] + "," + start[1];
    let map = "";
    let path = "color:0x0000ff|weight:5";
    
    let pickup_small_pin_url = setting_detail.image_base_url + "/map_pin/pickup.png";
    let desination_small_pin_url = setting_detail.image_base_url + "/map_pin/destination.png";
    let stop_small_pin_url = setting_detail.image_base_url + "/map_pin/stop_pin_url.png";

    let pickup_pin_url = setting_detail.image_base_url + "/map_pin/pickup2x.png";
    let desination_pin_url = setting_detail.image_base_url + "/map_pin/destination2x.png";
    let stop_pin_url = setting_detail.image_base_url + "/map_pin/stop_pin_url.png";
    let size_scale = "size=512x512&scale=4";

    let support = setting_detail.image_base_url + "/map_pin/support.png";
    let hour_icon = setting_detail.image_base_url + "/map_pin/hour_icon.png";
    let km_icon = setting_detail.image_base_url + "/map_pin/km_icon.png";
    let credit_card = setting_detail.image_base_url + "/map_pin/credit_card.png";


    let key =setting_detail.web_app_google_key;

    if (end[0] != 0 || end[1] != 0) {
        let end_source_location = end[0] + "," + end[1];

        map = "https://maps-api-ssl.google.com/maps/api/staticmap?key=" + key + "&&" + size_scale +
            "&markers=shadow:true|scale:2|icon:" + pickup_pin_url + "|" + start_source_location;
        stops.forEach(stop => {
            if (stop.address != '') {
                map += "&markers=shadow:false|scale:1|icon:" + stop_pin_url + "|" + stop.location[0] + "," + stop.location[1]
            }
        })
        map += "&markers=shadow:false|scale:2|icon:" + desination_pin_url + "|" + end_source_location + "&path=" + path;


    } else {
        map = "https://maps-api-ssl.google.com/maps/api/staticmap?key=" + key + "&&" + size_scale +
            "&markers=shadow:true|scale:2|icon:" + pickup_pin_url + "|" + start_source_location;
        stops.forEach(stop => {
            if (stop.address != '') {
                map += "&markers=shadow:false|scale:1|icon:" + stop_pin_url + "|" + stop.location[0] + "," + stop.location[1]
            }
        })
        map += "|&path=" + path;

    }
    try {
        if (provider_email != "") {
            fs.readFile(template, 'utf8', function (err, file) {
                if (err) {
                    console.log('ERROR!');
                    return err;
                } else {

                    City.findById(provider.cityid).then((city_data) => {

                        let distance_unit = city_data.unit

                        if (distance_unit == 1) {
                            distance_unit = req.__('unit_km');
                        } else {
                            distance_unit = req.__('unit_mile');
                        }
                        Settings.findOne({}, function (err, settingData) {
                            let is_public_demo = settingData.is_public_demo;
                            let compiledTmpl = ejs.compile(file, {filename: template});
                            let mail_title_image_url = setting_detail.image_base_url + "/web_images/mail_title_image.png";

                            let provider_name = user?.first_name + " " + user?.last_name;
                            let provider_picture = setting_detail.image_base_url + '/' + user?.picture;
                            let provider_phone = user?.country_phone_code + user?.phone;

                            let context = {
                                title: setting_detail.app_name, date: date,
                                total: trip.total,
                                source_address: trip.source_address, destination_address: trip.destination_address,
                                total_distance: trip.total_distance,
                                distance_unit: distance_unit,
                                total_time: trip.total_time,
                                card_payment: trip.card_payment, currency: trip.currency,
                                referral_payment: trip.referral_payment,
                                promo_payment: trip.promo_payment,
                                distance_cost: trip.distance_cost,
                                time_cost: trip.time_cost,
                                waiting_time_cost: trip.waiting_time_cost,
                                tax_fee: trip.tax_fee,
                                user_tax_fee: trip.user_tax_fee,
                                user_miscellaneous_fee: trip.user_miscellaneous_fee,
                                actual_destination_addresses: trip.actual_destination_addresses ? trip.actual_destination_addresses : [],
                                is_fixed_fare: trip.is_fixed_fare,
                                fixed_price: trip.fixed_price,
                                surge_fee: trip.surge_fee,
                                toll: trip.toll_amount,
                                tip: trip.tip_amount,
                                base_price: tripservice.base_price,
                                price_per_unit_distance: tripservice.price_per_unit_distance,
                                price_for_total_time: tripservice.price_for_total_time,
                                price_for_waiting_time: tripservice.price_for_waiting_time,
                                price_for_waiting_time_multiple_stops: tripservice.price_for_waiting_time_multiple_stops ?
                                tripservice.price_for_waiting_time_multiple_stops : 0,
                                service_type_name: tripservice.service_type_name,
                                provider_name: provider_name,
                                provider_email: provider_email,
                                provider_phone: provider_phone,
                                provider_picture: provider_picture,
                                map_url: map,
                                pickup_small_pin_url: pickup_small_pin_url,
                                desination_small_pin_url: desination_small_pin_url,
                                stop_small_pin_url: stop_small_pin_url,
                                mail_title_image_url: mail_title_image_url,
                                is_public_demo: is_public_demo,
                                support: support,
                                hour_icon: hour_icon,
                                km_icon: km_icon,
                                detail: trip,
                                credit_card: credit_card,
                                support_email
                            };


                            let htmls = compiledTmpl(context);
                            utils.mail_notification(provider_email, title, pattern, htmls);
                        });
                    });
                }
            });

        }
    } catch (error) {
        console.error('ERROR!');
    }

};


//////////////////// PROVIDER DAILY REPORT /////////////////////////
exports.sendProviderDailyReportEmail = async function (req, provider) {
    const setting_detail = await Settings.findOne({});

    let provider_name = provider.first_name + " " + provider.last_name;
    let provider_email = provider.email;
    let title = "DailyReport";
    let pattern = "DailyReport";
    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
    let ejs = require("ejs");

    try {
        if (provider_email != "") {
            let template = process.cwd() + '/app/views/email/dailyreport.html';
            fs.readFile(template, 'utf8', function (err, file) {
                if (err) {
                    console.log("ERROR! in sendProviderDailyReportEmail function")
                    // Commented below line as getting error due to "res is not defined"
                    // console.log('ERROR!');
                    // return res.send('ERROR!');
                } else {
                    let compiledTmpl = ejs.compile(file, {filename: template});
                    let mail_title_image_url = setting_detail.image_base_url + "/web_images/mail_title_image.png";
                    let context = {
                        title: setting_detail.app_name,
                        provider_name: provider_name,
                        date: date,
                        mail_title_image_url: mail_title_image_url
                    };
                    let htmls = compiledTmpl(context);
                    utils.mail_notification(provider_email, title, pattern, htmls);
                }
            });
        }
    } catch (error) {
    }
};

//////////////////// PROVIDER WEEKLY REPORT /////////////////////////
exports.sendProviderWeeklyReportEmail = async function (req, provider) {
    const setting_detail = await Settings.findOne({});

    let provider_name = provider.first_name + " " + provider.last_name;
    let provider_email = provider.email;
    let title = "WEEKLY REPORT";
    let pattern = "WEEKLY REPORT";
    let test = new Date(Date.now());
    let d = moment(test);
    let date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
    let ejs = require("ejs");
    try {
        if (provider_email != "") {
            let template = process.cwd() + '/app/views/email/weeklyreport.html';
            fs.readFile(template, 'utf8', function (err, file) {
                if (err) {
                    console.log("ERROR! in sendProviderWeeklyReportEmail function")
                    // Commented below line as getting error due to "res is not defined"
                    // console.log('ERROR!');
                    // return res.send('ERROR!');
                } else {
                    let compiledTmpl = ejs.compile(file, {filename: template});
                    let mail_title_image_url = setting_detail.image_base_url + "/web_images/mail_title_image.png";
                    let context = {
                        title: setting_detail.app_name,
                        provider_name: provider_name,
                        date: date,
                        mail_title_image_url: mail_title_image_url
                    };
                    let htmls = compiledTmpl(context);
                    utils.mail_notification(provider_email, title, pattern, htmls);
                }
            });
        }
    } catch (error) {
    }
};

exports.sendAdminProfitInvoiceEmail = async function (req, user_profit_list) {
    try {
    const setting_detail = await Settings.findOne({});
    user_profit_list.forEach(async (profits, index) => {
        let user_type_id = profits[0].user_type_id
        let user_type = profits[0].user_type
        let Table
        let user_data
        let user_name = ""
        switch (Number(user_type)) {
            case Number(constant_json.USER_TYPE_CORPORATE):
                Table = Corporate
                user_data = await Table.findOne({_id: user_type_id}).select({name:1, email:1}).lean()
                user_name = user_data.name
                break;
            case Number(constant_json.USER_TYPE_HOTEL):
                Table = Hotel
                user_data = await Table.findOne({_id: user_type_id}).select({hotel_name:1, email:1}).lean()
                user_name = user_data.hotel_name
                break;
            default:
                break;
        }

        const user_email = user_data.email;
        const title = "MONTHLY REPORT";
        const pattern = "MONTHLY REPORT";
        const test = new Date(Date.now());
        const d = moment(test);
        const date = d.format(constant_json.DATE_FORMAT_MMM_D_YYYY);
        const ejs = require("ejs");
        try {
            if (user_email != "") {
                const template = process.cwd() + '/app/views/email/adminProfitMonthlyReport.html';
                fs.readFile(template, 'utf8', function (err, file) {
                    if (err) {
                        console.log("ERROR! in sendAdminProfitInvoiceEmail function")
                        // Commented below line as getting error due to "res is not defined"
                        // console.log('ERROR!');
                        // return res.send('ERROR!');
                    } else {
                        const compiledTmpl = ejs.compile(file, {filename: template});
                        const mail_title_image_url = setting_detail.api_base_url + "/web_images/mail_title_image.png";
                        const context = {
                            title: setting_detail.app_name,
                            user_name: user_name,
                            date: date,
                            mail_title_image_url: mail_title_image_url,
                            profits:profits
                        };
                        const htmls = compiledTmpl(context);
                        utils.mail_notification(user_email, title, pattern, htmls);
                    }
                });
            }
        } catch (error) {
        }
    })


    } catch (error) {
            
    }
};
