let bank_detail = require('mongoose').model('bank_detail');
let Provider = require('mongoose').model('Provider');
let Partner = require('mongoose').model('Partner');
let utils = require('./utils');
let fs = require("fs");
let Country = require('mongoose').model('Country');
let console = require('./console');
let Settings = require('mongoose').model('Settings');
const {
    PAYMENT_GATEWAY,
} = require('./constant');

// #PAYMENT_MODULE_CHANGE
exports.add_bank_detail = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    utils.check_request_params(req.body,  [{name: 'provider_id', type: 'string'},{name: 'account_number', type: 'string'}], function (response) {
        if (response.success) {
            let social_id = req.body.social_unique_id;
            let encrypted_password = req.body.password;
            encrypted_password = utils.encryptPassword(encrypted_password);

                let type = Number(req.body.type);
                let Table;
                switch (type) {
                    case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                    Table = Provider;
                    break;
                    case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                    Table = Partner;
                    break;
                }

                Table.findOne({_id: req.body.provider_id}).then((provider) => {
                    if (provider) {
                        if (social_id == undefined || social_id == null || social_id == "") {
                            social_id = null;
                        }
                        if (social_id == null && encrypted_password != "" && encrypted_password != provider.password) {
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_YOUR_PASSWORD_IS_NOT_MATCH_WITH_OLD_PASSWORD
                            });
                        } else if (social_id != null && provider.social_unique_id != social_id) {
                            res.json({success: false, error_code: 100});
                        } else {
                            
                            if(!req.body.payment_gateway_type || req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe){
                                Country.findOne({"countryname": provider.country}).then((country_detail) => {

                                    if (!country_detail) {
                                        res.json({
                                            success: false,
                                            error_code: error_message.ERROR_CODE_FOR_PROBLEM_IN_ADD_BANK_DETAIL_PLEASE_RETRY
                                        });
                                    } else {
                                        let url = setting_detail.payments_base_url + "/create_bank_account"
                                        let data = {
                                            files: req.files,
                                                account_holder_name: req.body.account_holder_name,
                                                account_holder_type: req.body.account_holder_type,
                                                routing_number: req.body.routing_number,
                                                account_number: req.body.account_number,
                                                dob: req.body.dob,
                                                personal_id_number: req.body.personal_id_number,
                                                gender: req.body.gender,
                                                address: req.body.address,
                                                postal_code: req.body.postal_code,
                                                payment_gateway_type: PAYMENT_GATEWAY.stripe,
                                                country_detail:country_detail,
                                                provider:provider
                                        }
                            
                                        const request = require('request');
                                        request.post(
                                        {
                                            url: url,
                                            headers: {
                                                "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify(data),
                                        }, (error, response, body) => {
                                            if (error) {
                                                console.error(error);
                                                return error
                                            } else {
                                                body = JSON.parse(body);
                                                res.json(body)
                                            }
                                        });
                                    }
                                });
                            } else if(req.body.payment_gateway_type == PAYMENT_GATEWAY.paystack) {
                                let url = setting_detail.payments_base_url + "/create_bank_account"
                                let data = {

                                        account_number: req.body.account_number,
                                        bank_code: req.body.bank_code,
                                        routing_number: req.body.routing_number,
                                        dob: req.body.dob,
                                        personal_id_number: req.body.personal_id_number,
                                        gender: req.body.gender,
                                        address: req.body.address,
                                        postal_code: req.body.postal_code,
                                        payment_gateway_type: PAYMENT_GATEWAY.paystack
                                    
                                }
                    
                                const request = require('request');
                                request.post(
                                {
                                    url: url,
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(data),
                                }, (error, response, body) => {
                                    if (error) {
                                        console.error(error);
                                        return error
                                    } else {
                                        body = JSON.parse(body);
                                        res.json(body)
                                    }
                                });
                            } else {
                                provider.account_number = req.body.account_number;
                                provider.bank_code = req.body.bank_code;
                                provider.save();
                                res.json({
                                    success: true,
                                    message: success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_ADDED_SUCCESSFULLY
                                });
                            }

                        }

                    } else {
                        res.json({success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});

                    }
                });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });

};

exports.add_bank_detail_web = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    utils.check_request_params(req.body, [{name: 'provider_id', type: 'string'},{name: 'account_holder_name', type: 'string'},{name: 'account_holder_type', type: 'string'},
        {name: 'password', type: 'string'},{name: 'routing_number', type: 'string'},
        {name: 'dob', type: 'string'},{name: 'personal_id_number', type: 'string'},
        {name: 'account_holder_type', type: 'string'},{name: 'account_number', type: 'string'}], function (response) {
        console.log(response)
        if (response.success) {
            Provider.findOne({_id: req.body.provider_id}).then((provider) => {
                if (provider) {
                    let crypto = require('crypto');
                    let password = req.body.password;
                    let hash = crypto.createHash('md5').update(password).digest('hex');
                    if (provider.password !== hash) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_PASSWORD});
                    } else {                        
                        Country.findOne({ "countryname": provider.country }).then((country_detail) => {

                            if (!country_detail) {
                                res.json({
                                    success: false,
                                    error_code: error_message.ERROR_CODE_FOR_PROBLEM_IN_ADD_BANK_DETAIL_PLEASE_RETRY
                                });
                            } else {
                                let pictureData_buffer1 = fs.readFileSync(req.files[0].path);
                                let pictureData_buffer2 = fs.readFileSync(req.files[1].path);
                                let pictureData_buffer3 = fs.readFileSync(req.files[2].path);
                                let stripe = require("stripe")(setting_detail.stripe_secret_key);
                                stripe.setApiVersion('2020-08-27');
                                stripe.tokens.create({
                                    bank_account: {
                                        country: "US", // country_detail.alpha2
                                        currency: "USD",
                                        account_holder_name: req.body.account_holder_name,
                                        account_holder_type: req.body.account_holder_type,
                                        routing_number: req.body.routing_number,
                                        account_number: req.body.account_number
                                    }
                                }, function (err, token) {
                                    if (err) {
                                        res.json({
                                            success: false,
                                            error_message: err.message,
                                            error_code: error_message.ERROR_CODE_FOR_ACCOUNT_DETAIL_NOT_VALID
                                        });
                                    } else {

                                        stripe.files.create({
                                            file: {
                                                data: pictureData_buffer1,
                                                name: "front.jpg",
                                                type: "application/octet-stream",
                                            },
                                            purpose: "identity_document",
                                        }, (err, fileUpload) => {

                                            stripe.files.create({
                                                file: {
                                                    data: pictureData_buffer2,
                                                    name: "back.jpg",
                                                    type: "application/octet-stream",
                                                },
                                                purpose: "identity_document",
                                            }, (err, fileUpload1) => {

                                                stripe.files.create({
                                                    file: {
                                                        data: pictureData_buffer3,
                                                        name: "back.jpg",
                                                        type: "application/octet-stream",
                                                    },
                                                    purpose: "identity_document",
                                                }, (err, fileUpload2) => {

                                                    let dob = req.body.dob;
                                                    dob = dob.split('-');

                                                    let phone_number = provider.country_phone_code + provider.phone;

                                                    stripe.accounts.create({
                                                        type: 'custom',
                                                        country: "US", // country_detail.alpha2
                                                        email: provider.email,
                                                        requested_capabilities: [
                                                            'card_payments',
                                                            'transfers',
                                                        ],
                                                        business_type: 'individual',
                                                        business_profile: {
                                                            mcc: "4789",
                                                            name: provider.first_name + ' ' + provider.last_name,
                                                            product_description: "We sell transportation services to passengers, and we charge once the job is complete",
                                                            support_email: setting_detail.admin_email
                                                        },
                                                        individual: {
                                                            first_name: provider.first_name,
                                                            last_name: provider.last_name,
                                                            email: provider.email,
                                                            id_number: req.body.personal_id_number,
                                                            phone: phone_number,
                                                            gender: req.body.gender,
                                                            dob: {
                                                                day: dob[0],
                                                                month: dob[1],
                                                                year: dob[2]
                                                            },
                                                            address: {
                                                                city: provider.city,
                                                                country: "US",
                                                                state: req.body.state,
                                                                line1: req.body.address,
                                                                line2: req.body.address,
                                                                postal_code: req.body.postal_code
                                                            },
                                                            verification: {
                                                                document: {
                                                                    front: fileUpload.id,
                                                                    back: fileUpload1.id
                                                                },
                                                                additional_document: {
                                                                    front: fileUpload2.id
                                                                }
                                                            }
                                                        }
                                                    }, function (err, account) {
                                                        console.log(err)
                                                        if (err || !account) {
                                                            res.json({
                                                                success: false,
                                                                error_message: err.message,
                                                                error_code: error_message.ERROR_CODE_FOR_ACCOUNT_DETAIL_NOT_VALID
                                                            });
                                                        } else {
                                                            stripe.accounts.createExternalAccount(
                                                                account.id,
                                                                {
                                                                    external_account: token.id,
                                                                    default_for_currency: true
                                                                },
                                                                function (err, bank_account) {
                                                                
                                                                    if (err || !bank_account) {
                                                                        res.json({
                                                                            success: false,
                                                                            error_message: err.message,
                                                                            error_code: error_message.ERROR_CODE_FOR_PROBLEM_IN_ADD_BANK_DETAIL_PLEASE_RETRY
                                                                        });

                                                                    } else {
                                                                        provider.account_id = account.id;
                                                                        provider.bank_id = bank_account.id;
                                                                        provider.save();
                                                                        stripe.accounts.update(
                                                                            account.id,
                                                                            {
                                                                                tos_acceptance: {
                                                                                    date: Math.floor(Date.now() / 1000),
                                                                                    ip: req.connection.remoteAddress // Assumes you're not using a proxy
                                                                                }
                                                                            }, function (err, update_bank_account) {

                                                                                if (err || !update_bank_account) {
                                                                                    res.json({
                                                                                        success: false,
                                                                                        error_message: err.message,
                                                                                        error_code: error_message.ERROR_CODE_FOR_PROVIDER_BANK_DETAIL_ARE_NOT_VERIFIED
                                                                                    });
                                                                                } else {
                                                                                    //for ejs Code global.message = "Bank Detail Added Successfully";
                                                                                    res.redirect('/provider_payments');
                                                                                }
                                                                            });
                                                                    }
                                                                }
                                                            );
                                                        }
                                                    });
                                                });
                                            });
                                        });
                                    }

                                });
                            }
                        });
                    }
                } else {
                    res.json({success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});
                
                }
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

// #PAYMENT_MODULE_CHANGE
exports.get_bank_detail = async function (req, res) {
    let setting_detail = await Settings.findOne({})
    utils.check_request_params(req.body, [], async function (response) {
        if (response.success) {
            let type = Number(req.body.type);
                let Table = Provider;
                switch (type) {
                    case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                    Table = Provider;
                    break;
                    case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                    Table = Partner;
                    break;
                }

                Table.findOne({_id: req.body.provider_id}).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else {
                        let country_query = {_id: provider.country_id}
                        
                        Country.findOne(country_query, function(error, country_detail){
                            let payment_gateway_type = setting_detail.payment_gateway_type;
                            if(country_detail && country_detail.payment_gateways && country_detail.payment_gateways.length>0){
                                payment_gateway_type = country_detail.payment_gateways[0];
                            }
                            if(payment_gateway_type == PAYMENT_GATEWAY.stripe){
                                let stripe = require("stripe")(setting_detail.stripe_secret_key);
                                stripe.setApiVersion('2020-08-27');
                                stripe.accounts.retrieveExternalAccount(
                                    provider.account_id,
                                    provider.bank_id,
                                    function (err, external_account) {
                                    

                                        if (err || !external_account) {
                                            res.json({
                                                success: false,
                                                payment_gateway_type: payment_gateway_type,
                                                error_code: error_message.ERROR_CODE_FOR_PROBLEM_IN_GET_BANK_DETAIL,
                                                error_message: err.message
                                            });
                                        } else {

                                            res.json({
                                                success: true,
                                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_GET_SUCCESSFULLY,
                                                payment_gateway_type: payment_gateway_type,
                                                bankdetails: {
                                                    account_number: external_account.last4,
                                                    routing_number: external_account.routing_number,
                                                    account_holder_name: external_account.account_holder_name,
                                                    account_holder_type: external_account.account_holder_type,
                                                    account_id: provider.account_id
                                                }
                                            });
                                        }
                                    }
                                );
                            } else if(payment_gateway_type == PAYMENT_GATEWAY.paystack || payment_gateway_type == PAYMENT_GATEWAY.payu || payment_gateway_type == PAYMENT_GATEWAY.paytabs || payment_gateway_type == PAYMENT_GATEWAY.paypal || payment_gateway_type == PAYMENT_GATEWAY.razorpay) {
                                if (!provider.account_number) {
                                    res.json({
                                        success: false,
                                        payment_gateway_type: payment_gateway_type,
                                        error_code: error_message.ERROR_CODE_FOR_PROBLEM_IN_GET_BANK_DETAIL
                                    });
                                } else {
                                    res.json({
                                        success: true,
                                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_GET_SUCCESSFULLY,
                                        payment_gateway_type: payment_gateway_type,
                                        bankdetails: {
                                            account_number: provider.account_number,
                                            routing_number: provider.bank_code,
                                            bank_id: provider.bank_id,
                                            account_id: provider.account_id
                                        }
                                    });
                                }
                            }
                        });
                    }
                } else {
                    res.json({success: false,payment_gateway_type: null, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});
                }
            });
        } else {
            res.json({
                success: false,
                payment_gateway_type: null,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};

// #PAYMENT_MODULE_CHANGE
exports.delete_bank_detail = async function (req, res) {
    const setting_detail = await Settings.findOne({});

    utils.check_request_params(req.body, [], function (response) {
        if (response.success) {
            let social_id = req.body.social_unique_id;
            let type = Number(req.body.type);
            let Table = Provider;
            switch (type) {
                case Number(constant_json.PROVIDER_UNIQUE_NUMBER):
                Table = Provider;
                break;
                case Number(constant_json.PARTNER_UNIQUE_NUMBER):
                Table = Partner;
                break;
            }
                
            Table.findOne({_id: req.body.provider_id}).then((provider) => {

                if (provider) {
                    if (social_id == undefined || social_id == null || social_id == "") {
                        social_id = null;
                    }
                    if(!req.body.payment_gateway_type || req.body.payment_gateway_type == PAYMENT_GATEWAY.stripe){
                        let stripe = require("stripe")(setting_detail.stripe_secret_key);
                        stripe.setApiVersion('2020-08-27');

                        stripe.accounts.del(provider.account_id, function (err, test) {
                        
                            if (err || !test) {
                                res.json({
                                    success: false,
                                    error_message: err.message,
                                    error_code: error_message.ERROR_CODE_FOR_PROBLEM_IN_DELETED_BANK_DETAIL_PLEASE_RETRY
                                });
                            } else {
                                provider.account_id = "";
                                provider.bank_id = "";
                                provider.save().then(() => {
                                    res.json({
                                        success: true,
                                        message: success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_DELETED_SUCCESSFULLY
                                    });
                                }, (err) => {
                                    console.log(err);
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                });
                            }

                        })
                    } else {
                        provider.account_number = '';
                        provider.account_id = '';
                        provider.bank_id = '';
                        provider.bank_code = '';
                        provider.save().then(() => {
                            res.json({
                                success: true,
                                message: success_messages.MESSAGE_CODE_FOR_PROVIDER_BANK_DETAIL_DELETED_SUCCESSFULLY
                            });
                        }, (err) => {
                            console.log(err);
                            res.json({
                                success: false,
                                error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                            });
                        });
                    }
                } else {
                    res.json({success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND});
                }
            });
        } else {
            res.json({
                success: false,
                error_code: response.error_code,
                error_message: response.error_message
            });
        }
    });
};
