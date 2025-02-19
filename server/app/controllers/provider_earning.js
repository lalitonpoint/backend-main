let utils = require('./utils');
let mongoose = require('mongoose');
let Schema = mongoose.Types.ObjectId;
let moment = require('moment-timezone');
let Provider = require('mongoose').model('Provider');
let City = require('mongoose').model('City');
let Country = require('mongoose').model('Country');
let Provider_daily_analytic = require('mongoose').model('provider_daily_analytic');
let console = require('./console');
let Trip_history = require('mongoose').model('Trip_history');
let Settings = require('mongoose').model('Settings');
let Rental_Trip = require('mongoose').model("Rental_Trip");

// get_provider_daily_earning_detail
exports.get_provider_daily_earning_detail = function (req, res) {
    utils.check_request_params(req.body, [{name: 'provider_id', type: 'string'},{name: 'date', type: 'string'}], function (response) {
        if (response.success) {
            Provider.findOne({_id: req.body.provider_id}).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else {

                        Country.findOne({_id: provider.country_id}).then((country) => {
                            let currency = "";
                            let currencycode = "";
                            if (country) {
                                currency = country.currencysign;
                                currencycode = country.currencycode;
                            }

                            let provider_id = Schema(req.body.provider_id);

                            let today = req.body.date;
                            if (today == '' || today == undefined || today == null) {
                                today = new Date();
                            } else {
                                today = new Date(today);
                            }

                            let complete_date_tag = moment(moment(today).startOf('day')).format(constant_json.DATE_FORMAT_MMM_D_YYYY);
                            let date_filter = {$match: {"complete_date_tag": {$eq: complete_date_tag}}};

                            let trip_condition = {'is_trip_completed': 1};
                            let trip_condition_new = {$and: [{'is_trip_cancelled_by_user': 1}, {'pay_to_provider': {$gt: 0}}]};
                            trip_condition = {$match: {$or: [trip_condition, trip_condition_new]}}

                            let provider_match_condition = {$match: {'provider_id': {$eq: provider_id}}};

                            let provider_daily_analytic_data = {};
                            let provider_daily_earning_data = {};
                            let provider_trips_data = [];

                            Provider_daily_analytic.findOne({
                                provider_id: provider_id,
                                date_tag: complete_date_tag
                            }).then((provider_daily_analytic) => {
                                if (provider_daily_analytic) {
                                    provider_daily_analytic_data = provider_daily_analytic;
                                }

                                let project_selection_data_from_trip = {
                                    $project: {
                                        _id: 0,
                                        unique_id: 1,
                                        provider_service_fees: 1,
                                        total: 1,
                                        payment_mode: 1,
                                        provider_have_cash: 1,
                                        pay_to_provider: 1,
                                        provider_income_set_in_wallet: 1
                                    }
                                };

                                Trip_history.aggregate([trip_condition, date_filter, provider_match_condition, project_selection_data_from_trip]).then((daily_trips) => {

                                    if (daily_trips.length == 0) {
                                        res.json({
                                            success: true,
                                            currency: currency,
                                            currencycode: currencycode,
                                            provider_daily_analytic: provider_daily_analytic_data,
                                            provider_daily_earning: provider_daily_earning_data,
                                            trips: provider_trips_data
                                        })
                                    } else {

                                        let group_trip_data_condition = {
                                            $group: {
                                                _id: null,
                                                total_distance: {$sum: '$total_distance'},
                                                total_time: {$sum: '$total_time'},
                                                total_waiting_time: {$sum: '$total_waiting_time'},
                                                total_service_surge_fees: {$sum: '$surge_fee'},
                                                service_total: {$sum: '$total_after_surge_fees'},

                                                total_provider_tax_fees: {$sum: '$provider_tax_fee'},
                                                total_provider_miscellaneous_fees: {$sum: '$provider_miscellaneous_fee'},
                                                total_toll_amount: {$sum: '$toll_amount'},
                                                total_tip_amount: {$sum: '$tip_amount'},
                                                total_provider_service_fees: {$sum: '$provider_service_fees'},

                                                total_provider_have_cash: {$sum: {'$cond': [{'$eq': ['$payment_mode', 1]}, '$cash_payment', 0]}},
                                                // total_deduct_wallet_amount: {
                                                //     $sum: {
                                                //         '$cond': [{
                                                //             '$eq': ['$is_provider_earning_set_in_wallet', true],
                                                //             '$eq': ['$payment_mode', 1]
                                                //         }, '$provider_income_set_in_wallet', 0]
                                                //     }
                                                // },
                                                // total_added_wallet_amount: {
                                                //     $sum: {
                                                //         '$cond': [{
                                                //             '$eq': ['$is_provider_earning_set_in_wallet', true],
                                                //             '$eq': ['$payment_mode', 0]
                                                //         }, '$provider_income_set_in_wallet', 0]
                                                //     }
                                                // },
                                                total_deduct_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, { '$ne': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 1] }] }, '$provider_income_set_in_wallet', 0] } },
                                                total_added_wallet_amount: { $sum: { '$cond': [{ $and: [{ '$eq': ['$is_provider_earning_set_in_wallet', true] }, {$or: [{ '$eq': ['$is_provider_earning_added_in_wallet', true] }, { '$eq': ['$payment_mode', 0] } ]} ] }, '$provider_income_set_in_wallet', 0] } },
                                
                                                total_paid_in_wallet_payment: {$sum: {'$cond': [{'$eq': ['$is_provider_earning_set_in_wallet', true]}, '$provider_income_set_in_wallet', 0]}},

                                                total_transferred_amount: {$sum: {'$cond': [{$and: [{'$eq': ['$is_provider_earning_set_in_wallet', false]}, {'$eq': ['$is_transfered', true]}]}, '$pay_to_provider', 0]}},
                                                total_pay_to_provider: {$sum: {'$cond': [{$and: [{'$eq': ['$is_provider_earning_set_in_wallet', false]}, {'$eq': ['$is_transfered', false]}]}, '$pay_to_provider', 0]}},

                                                currency: {$first: '$currency'},
                                                unit: {$first: '$unit'},
                                                statement_number: {$first: '$invoice_number'},

                                            }
                                        }

                                        Trip_history.aggregate([trip_condition, date_filter, provider_match_condition, group_trip_data_condition]).then((trips) => {
                                            if (trips.length == 0) {
                                                res.json({success: false, error_code: error_message.ERROR_CODE_EARNING_NOT_FOUND})
                                            } else {
                                                provider_daily_earning_data = trips[0];
                                                res.json({
                                                    success: true,
                                                    currency: currency,
                                                    currencycode: currencycode,
                                                    provider_daily_analytic: provider_daily_analytic_data,
                                                    provider_daily_earning: provider_daily_earning_data,
                                                    trips: daily_trips
                                                });
                                            }
                                        }, (err) => {
                                            console.log(err)
                                            res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                        });
                                    }
                                }, (err) => {
                                    console.log(err)
                                    res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                });
                            });
                        });
                    }
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


// get_provider_weekly_earning_detail
exports.get_provider_weekly_earning_detail = function (req, res) {
    utils.check_request_params(req.body, [{name: 'provider_id', type: 'string'},{name: 'date', type: 'string'}], function (response) {
        if (response.success) {
            Provider.findOne({_id: req.body.provider_id}).then((provider) => {
                if (provider) {
                    if (req.body.token != null && provider.token != req.body.token) {
                        res.json({success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN});
                    } else {
                        let country_id = provider.country_id;
                        let city_id = provider.cityid;
                        City.findOne({_id: city_id}).then((city) => {
                            if (city) {
                                country_id = city.countryid;
                                Country.findOne({_id: country_id}).then((country) => {
                                    if (country) {
                                        let currency = country.currencysign;
                                        let currencycode = country.currencycode;
                                        let provider_id = Schema(req.body.provider_id);
                                        let today = req.body.date;
                                        if (today == '' || today == undefined || today == null) {
                                            today = new Date();
                                        } else {
                                            today = new Date(today);
                                        }
                                        let start_date_view = today;
                                        let week_start_date_time = today;
                                        let trip_condition = {'is_trip_completed': 1};
                                        let trip_condition_new = {$and: [{'is_trip_cancelled_by_user': 1}, {'pay_to_provider': {$gt: 0}}]};
                                        trip_condition = {$match: {$or: [trip_condition, trip_condition_new]}}
                                        let provider_match_condition = {$match: {'provider_id': {$eq: provider_id}}};

                                        let provider_daily_analytic_data = [];
                                        for (let i = 0; i < 7; i++) {
                                            provider_daily_analytic_data.push(moment(today).format(constant_json.DATE_FORMAT_MMM_D_YYYY));
                                            today = moment(today).add(1, 'days');
                                        }
                                        let provider_daily_analytic_query = {$match: {date_tag: {$in: provider_daily_analytic_data}}};
                                        let date_filter = {$match: {complete_date_tag: {$in: provider_daily_analytic_data}}};

                                        let group_analytic_data_condition = {
                                            $group: {
                                                _id: null,
                                                received: {$sum: '$received'},
                                                accepted: {$sum: '$accepted'},
                                                rejected: {$sum: '$rejected'},
                                                not_answered: {$sum: '$not_answered'},
                                                cancelled: {$sum: '$cancelled'},
                                                completed: {$sum: '$completed'},        
                                                acception_ratio: {$sum: '$acception_ratio'},
                                                rejection_ratio: {$sum: '$rejection_ratio'},
                                                cancellation_ratio: {$sum: '$cancellation_ratio'},
                                                completed_ratio: {$sum: '$completed_ratio'},

                                                total_online_time: {$sum: '$total_online_time'}
                                            }
                                        }

                                        Provider_daily_analytic.aggregate([provider_match_condition, provider_daily_analytic_query, group_analytic_data_condition]).then((provider_daily_analytic) => {
                                            let provider_weekly_analytic_data = {};

                                            if (provider_daily_analytic.length > 0) {
                                                provider_weekly_analytic_data = provider_daily_analytic[0];
                                                if ((Number(provider_weekly_analytic_data.received)) > 0) {
                                                    let received = provider_weekly_analytic_data.received;
                                                    provider_weekly_analytic_data.acception_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.accepted * 100) / received));
                                                    provider_weekly_analytic_data.cancellation_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.cancelled * 100) / received));
                                                    provider_weekly_analytic_data.completed_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.completed * 100) / received));
                                                    provider_weekly_analytic_data.rejection_ratio = utils.precisionRoundTwo(Number((provider_weekly_analytic_data.rejected * 100) / received));
                                                }
                                            }


                                            let provider_weekly_earning_data = {};
                                            let daily_condition = {
                                                $group: {
                                                    _id: null,
                                                    date1: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(0, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date2: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(1, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date3: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(2, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date4: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(3, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date5: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(4, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date6: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(5, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}},
                                                    date7: {$sum: {$cond: [{$eq: ["$complete_date_tag", moment(new Date(moment(week_start_date_time).add(6, 'days'))).format(constant_json.DATE_FORMAT_MMM_D_YYYY)]}, '$provider_service_fees', 0]}}
                                                }

                                            }
                                            let date = {
                                                date1: new Date(moment(start_date_view)),
                                                date2: new Date(moment(start_date_view).add(1, 'days')),
                                                date3: new Date(moment(start_date_view).add(2, 'days')),
                                                date4: new Date(moment(start_date_view).add(3, 'days')),
                                                date5: new Date(moment(start_date_view).add(4, 'days')),
                                                date6: new Date(moment(start_date_view).add(5, 'days')),
                                                date7: new Date(moment(start_date_view).add(6, 'days'))

                                            }

                                            Trip_history.aggregate([trip_condition, date_filter, provider_match_condition, daily_condition]).then((daily_trips) => {
                                                if (daily_trips.length == 0) {
                                                    res.json({
                                                        success: true,
                                                        currency: currency,
                                                        currencycode: currencycode,
                                                        provider_weekly_analytic: provider_weekly_analytic_data,
                                                        provider_weekly_earning: provider_weekly_earning_data,
                                                        date: date,
                                                        trip_day_total: {}
                                                    })
                                                } else {
                                                    let group_trip_data_condition = {
                                                        $group: {
                                                            _id: null,
                                                            total_distance: {$sum: '$total_distance'},
                                                            total_time: {$sum: '$total_time'},
                                                            total_waiting_time: {$sum: '$total_waiting_time'},
                                                            total_service_surge_fees: {$sum: '$surge_fee'},
                                                            service_total: {$sum: '$total_after_surge_fees'},

                                                            total_provider_tax_fees: {$sum: '$provider_tax_fee'},
                                                            total_provider_miscellaneous_fees: {$sum: '$provider_miscellaneous_fee'},
                                                            total_toll_amount: {$sum: '$toll_amount'},
                                                            total_tip_amount: {$sum: '$tip_amount'},

                                                            total_provider_service_fees: {$sum: '$provider_service_fees'},
                                                            total_provider_have_cash: {$sum: {'$cond': [{'$eq': ['$payment_mode', 1]}, '$cash_payment', 0]}},
                                                            total_deduct_wallet_amount: {
                                                                $sum: {
                                                                    $cond: [{
                                                                        $and: [{ $eq: ["$is_provider_earning_set_in_wallet", true] },
                                                                        { $lt: ["$pay_to_provider", 0] }                                        ]
                                                                    },'$provider_income_set_in_wallet',0]
                                                                }
                                                            },
                                                            total_added_wallet_amount:{
                                                                $sum: {
                                                                    $cond: [{
                                                                        $and: [{ $eq: ["$is_provider_earning_set_in_wallet", true] },
                                                                        { $gt: ["$pay_to_provider", 0] }                                        ]
                                                                    },'$provider_income_set_in_wallet',0]
                                                                }
                                                            },
                                                            total_paid_in_wallet_payment: {$sum: {'$cond': [{'$eq': ['$is_provider_earning_set_in_wallet', true]}, '$provider_income_set_in_wallet', 0]}},
                                                            total_pay_to_provider: {$sum: {'$cond': [{'$eq': ['$is_provider_earning_set_in_wallet', false]}, '$pay_to_provider', 0]}},

                                                            currency: {$first: '$currency'},
                                                            unit: {$first: '$unit'},
                                                            statement_number: {$first: '$invoice_number'},

                                                        }
                                                    }

                                                    Trip_history.aggregate([trip_condition, date_filter, provider_match_condition, group_trip_data_condition]).then((trips) => {
                                                        if (trips.length == 0) {
                                                            res.json({
                                                                success: false,
                                                                error_code: error_message.ERROR_CODE_EARNING_NOT_FOUND
                                                            })
                                                        } else {
                                                            provider_weekly_earning_data = trips[0];
                                                            res.json({
                                                                success: true,
                                                                currency: currency,
                                                                currencycode: currencycode,
                                                                provider_weekly_analytic: provider_weekly_analytic_data,
                                                                provider_weekly_earning: provider_weekly_earning_data,
                                                                date: date,
                                                                trip_day_total: daily_trips[0]
                                                            });
                                                        }
                                                    }, (err) => {
                                                        console.log(err)
                                                        res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                                    });

                                                }
                                            }, (err) => {
                                                console.log(err)
                                                res.json({
                                        success: false,
                                        error_code: error_message.ERROR_CODE_SOMETHING_WENT_WRONG
                                    });
                                            });
                                        });
                                    }
                                });


                            } else {
                                res.json({success: false, error_code: error_message.ERROR_CODE_EARNING_NOT_FOUND});

                            }
                        });

                    }
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


// get weekly  earning in new user panel
exports.get_web_provider_weekly_earning_detail = async function (req, res) {
    const setting_detail = await Settings.findOne({});
    let page;
    let next;
    let pre;
    let search_item;
    let search_value;
    let sort_order;
    let sort_field;
    let filter_start_date;
    let filter_end_date;
    let start_date
    let end_date
    if (req.body.page == undefined)
    {
        page = 0;
        next = 1;
        pre = 0;
    } else
    {
        page = req.body.page;
        next = parseInt(req.body.page) + 1;
        pre = req.body.page;
    }
    if (req.body.search_item == undefined) {
        search_item = 'provider_detail.first_name';
        search_value = '';
        sort_order = 1;
        sort_field = 'provider_detail.first_name';
       
    } else {
        search_item = req.body.search_item;
        search_value = req.body.search_value;
        sort_order = req.body.sort_item[1];
        sort_field = req.body.sort_item[0];
        
    }


    if (req.body.start_date == '' || req.body.end_date == '') {

        if (req.body.start_date == '' && req.body.end_date == '') {
            start_date = new Date(0);
            end_date = new Date(Date.now());
        } else if (req.body.start_date == '') {
            start_date = new Date(0);
            end_date = req.body.end_date;
            end_date = new Date(end_date);
            end_date = end_date.setHours(23, 59, 59, 999);
            end_date = new Date(end_date);
        } else {
            start_date = req.body.start_date;
            start_date = new Date(start_date);
            start_date = start_date.setHours(0, 0, 0, 0);
            start_date = new Date(start_date);
            end_date = new Date(Date.now());
        }
    } else if (req.body.start_date == undefined || req.body.end_date == undefined) {

        let date = new Date(Date.now());
        date = date.setHours(0, 0, 0, 0);
        start_date = new Date(date);
        end_date = new Date(Date.now());

        filter_start_date = moment(start_date).format("YYYY-MM-DD");
        filter_end_date = moment(end_date).format("YYYY-MM-DD");

    } else {

        start_date = req.body.start_date;
        end_date = req.body.end_date;
        start_date = new Date(start_date);
        start_date = start_date.setHours(0, 0, 0, 0);
        start_date = new Date(start_date);
        end_date = new Date(end_date);
        end_date = end_date.setHours(23, 59, 59, 999);
        end_date = new Date(end_date);
    }

    
    let number_of_rec = 10;
 
    ///// For date filter /////
    let filter = {"$match": {}};
    filter["$match"]['provider_trip_end_time'] = {$gte: start_date, $lt: end_date};

    ///// For sort by field /////
    let sort = {"$sort": {}};
    sort["$sort"]["unique_id"] = -1;
   
    ///// For Count number of result /////
    /////////////////////////////////////

    //// For skip number of result /////
    let skip = {};
    skip["$skip"] = page * 10

    ///// For limitation on result /////
    let limit = {};
    limit["$limit"] = 10

    if (typeof req.body.provider_id != 'undefined') {

        let timezone_for_display_date = setting_detail.timezone_for_display_date;
        let mongoose = require('mongoose');
        let Schema = mongoose.Types.ObjectId;
        let condition = {$match: {'confirmed_provider': {$eq: Schema(req.body.provider_id)}}};
        let trip_condition = {$match: {'is_trip_completed': {$eq: 1}}};


        Trip_history.aggregate([condition, trip_condition, filter]).then((array) => { 
            if (array.length == 0) {
                array = [];
                res.json({success: true,detail: array, timezone_for_display_date: timezone_for_display_date,
                    'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date});
            } else {
                let pages = Math.ceil(array.length / number_of_rec);
                console.log(pages)
                Trip_history.aggregate([condition, trip_condition, filter,sort,skip,limit]).then((array) => { 
                    if (array.length == 0) {
                        array = [];
                        res.json({success: true,detail: array, timezone_for_display_date: timezone_for_display_date,
                            'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date
                        });

                    } else {

                        Trip_history.aggregate([condition, trip_condition, filter,sort,skip,limit]).then((trip_total) => { 

                            if (trip_total.length == 0) {
                                array = [];
                                res.json( {success: true,detail: array, timezone_for_display_date: timezone_for_display_date,
                                    'current_page': 1, type: req.body.type, 'pages': 0, 'next': 1, 'pre': 0, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date
                                });
                            } else {
                                res.json({success: true,detail: array, timezone_for_display_date: timezone_for_display_date,
                                    'current_page': page, trip_total: trip_total, type: req.body.type, 'pages': pages, 'next': next, 'pre': pre, moment: moment, sort_field, sort_order, search_item, search_value, filter_start_date, filter_end_date
                                });
                            }
                        }, (err) => {
                            utils.error_response(err, req, res)
                        }); 
                    }
                }, (err) => {
                    utils.error_response(err, req, res)
                });
            }
        }, (err) => {
            utils.error_response(err, req, res)
        });

    } else
    {
        res.json({error:'Data Not Found!'})
    }
    
};


// get provider rental earning
exports.get_provider_rental_earning_detail = async function (req, res) {
    try {
        let params_array = [{name: 'provider_id', type: 'string'}, {name: 'start_date', type: 'string'}, {name: 'end_date', type: 'string'}]
        let response = await utils.check_request_params_async(req.body, params_array)
        if (!response.success) {
            res.json(response);
            return;
        }
        let provider_detail = await Provider.findOne({ _id: req.body.provider_id });
        if (!provider_detail) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_PROVIDER_DETAIL_NOT_FOUND });
        }

        if (provider_detail.token != req.body.token) {
            return res.json({ success: false, error_code: error_message.ERROR_CODE_INVALID_TOKEN });
        }

        // Set up date range filter
        let start_date = req.body.start_date || null;
        let end_date = req.body.end_date || null;
        let date_filter = { "$match": {} };
        
        if (start_date && end_date) {
            let startDate = moment.utc(start_date).startOf('day').toDate();
            let endDate = moment.utc(end_date).endOf('day').toDate();
            date_filter["$match"]["provider_completed_time"] = { $gte: startDate, $lt: endDate };
        }
        
        let provider_condition = { provider_id : Schema(req.body.provider_id)};

        let group_trip_data = {
            $group: {
                _id: null,
                currency: { $first: '$currency' },
                total_earning: { $sum: '$provider_service_fees' }
            }
        };

        let rental_detail = await Rental_Trip.aggregate([
            { $match: provider_condition },
            date_filter,
            group_trip_data
        ]);

        if(rental_detail.length == 0){
            let country = await Country.findOne({_id: provider_detail.country_id}).select("currencysign");
            let rental_detail = {
                _id: null,
                currency : country?.currencysign,
                total_earning : 0
            }
            return res.json({ success: true, rental_earning: rental_detail });
        }

        return res.json({ success: true, rental_earning: rental_detail[0] });

    } catch (error) {
        utils.error_response(error, req, res)
    }
    
};